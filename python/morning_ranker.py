#!/usr/bin/env python3
"""Corn Intel morning buyer ranker (Mac mini local production).

What it does each morning:
1) Optionally scrape buyer websites / PDFs for posted cash bids.
2) Pull USDA proxy data (futures + basis) from the local API.
3) Rank BNSF-priority corridor buyers for the morning call list.
4) Persist the run + ranked results to Postgres for the web app/API.

This keeps AI off the critical path and uses deterministic scoring by default.
Optional ML coefficients can be loaded to guide the final ranking blend.
"""

from __future__ import annotations

import argparse
import io
import json
import math
import os
import re
import sys
from dataclasses import dataclass
from datetime import date, datetime, timezone
from typing import Any, Dict, Iterable, List, Optional, Tuple
from urllib.parse import urljoin, quote

try:
    import psycopg  # type: ignore
    from psycopg.rows import dict_row  # type: ignore
except Exception:  # pragma: no cover
    psycopg = None
    dict_row = None


DEFAULT_API_BASE_URL = os.environ.get("CORN_INTEL_API_BASE_URL", "http://localhost:3000")
DEFAULT_CROP = "Yellow Corn"
UTC = timezone.utc

PRIMARY_CORRIDOR_STATES = {
    "ND", "MN", "SD", "IA", "NE", "KS",
    "TX", "WA", "OR", "CA", "OK", "MO",
}

STATE_TO_REGION = {
    "TX": "Texas",
    "CA": "California",
    "WA": "Washington",
    "OR": "PNW",
    "ID": "Idaho",
    "IA": "Midwest",
    "IL": "Midwest",
    "NE": "Midwest",
    "MN": "Midwest",
    "SD": "Midwest",
    "ND": "Midwest",
    "KS": "Midwest",
    "MO": "Midwest",
    "OH": "Midwest",
    "IN": "Midwest",
    "OK": "Midwest",
}

FALLBACK_REGIONAL_BASIS = {
    "Texas": 0.85,
    "Washington": 1.10,
    "California": 1.45,
    "Midwest": -0.25,
    "Idaho": 0.95,
    "PNW": 1.15,
}

# Approximate BNSF freight estimates from Campbell, MN. This is intentionally simple and cheap.
STATE_FREIGHT_ESTIMATE = {
    "ND": 0.18,
    "MN": 0.22,
    "SD": 0.25,
    "IA": 0.31,
    "NE": 0.36,
    "KS": 0.43,
    "MO": 0.40,
    "OK": 0.48,
    "TX": 0.58,
    "WA": 0.64,
    "OR": 0.68,
    "CA": 0.76,
}

DEFAULT_WEIGHTED_SCORE = {
    "cash_bid": 0.34,
    "estimated_net_bid": 0.31,
    "rail_confidence": 0.15,
    "contact_verified": 0.08,
    "bid_freshness": 0.07,
    "source_confidence": 0.05,
}

GENERIC_CASH_PATTERNS = [
    r"(?i)cash\s+bid[^\n\r]{0,120}?\$?([0-9]+(?:\.[0-9]{1,4})?)",
    r"(?i)corn[^\n\r]{0,120}?\$?([0-9]+(?:\.[0-9]{1,4})?)",
    r"(?i)(yellow\s+corn)[^\n\r]{0,120}?\$?([0-9]+(?:\.[0-9]{1,4})?)",
]
GENERIC_BASIS_PATTERN = r"(?i)basis[^\n\r]{0,80}?([+-]?[0-9]+(?:\.[0-9]{1,4})?)"


@dataclass
class BuyerRow:
    id: str
    external_seed_key: Optional[str]
    name: str
    type: str
    city: str
    state: str
    region: str
    lat: float
    lng: float
    crop_type: str
    launch_scope: str
    rail_confidence: Optional[int]
    verified_status: Optional[str]
    facility_phone: Optional[str]
    website_url: Optional[str]
    contact_role: Optional[str]


@dataclass
class SourceConfig:
    buyer_external_seed_key: str
    crop_type: str
    mode: str  # html | pdf | html_to_pdf
    url: str
    label: str
    text_selector: Optional[str] = None
    pdf_link_regex: Optional[str] = None
    value_regex: Optional[str] = None
    basis_regex: Optional[str] = None
    futures_regex: Optional[str] = None
    confidence_score: int = 90


@dataclass
class BidObservation:
    buyer_id: str
    crop_type: str
    source_kind: str
    source_label: str
    source_url: str
    observed_at: datetime
    cash_bid: Optional[float]
    basis: Optional[float]
    futures_price: Optional[float]
    confidence_score: int
    parsed_from_pdf: bool
    raw_excerpt: Optional[str]
    raw_payload_json: Dict[str, Any]


@dataclass
class RankedBuyer:
    buyer: BuyerRow
    cash_bid: Optional[float]
    basis: Optional[float]
    futures_price: Optional[float]
    estimated_freight: float
    estimated_net_bid: Optional[float]
    bid_source_kind: str
    bid_source_label: Optional[str]
    bid_source_url: Optional[str]
    bid_observed_at: Optional[datetime]
    source_confidence: float
    bid_freshness_hours: float
    feature_values: Dict[str, float]
    weighted_score: float
    ml_score: Optional[float]
    composite_score: float
    rationale: Dict[str, Any]


def now_utc() -> datetime:
    return datetime.now(tz=UTC)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Corn Intel morning ranker")
    parser.add_argument("--database-url", default=os.environ.get("DATABASE_URL"))
    parser.add_argument("--api-base-url", default=DEFAULT_API_BASE_URL)
    parser.add_argument("--crop", default=DEFAULT_CROP)
    parser.add_argument("--bid-source-config", default=os.environ.get("CORN_INTEL_BID_SOURCE_CONFIG"))
    parser.add_argument("--limit", type=int, default=250, help="Max buyers to evaluate")
    parser.add_argument("--top-n", type=int, default=30, help="How many ranked buyers to persist")
    parser.add_argument("--top-states", type=int, default=3, help="How many top states to keep")
    parser.add_argument("--verified-only", action="store_true", help="Only rank buyers with verified contacts")
    parser.add_argument("--skip-scrape", action="store_true", help="Disable web/PDF scraping and use USDA fallback only")
    parser.add_argument("--max-bid-age-hours", type=float, default=36.0)
    parser.add_argument("--http-timeout", type=float, default=15.0)
    parser.add_argument("--model-coefficients-file", help="Optional JSON coefficients exported by train_rank_model.py")
    parser.add_argument("--dry-run", action="store_true", help="Compute rankings but do not write DB rows")
    parser.add_argument("--debug", action="store_true")
    return parser.parse_args()


def require_psycopg() -> None:
    if psycopg is None or dict_row is None:
        raise RuntimeError(
            "psycopg is required. Install dependencies from python/requirements.txt and try again."
        )


def require_requests():
    try:
        import requests  # type: ignore
        return requests
    except Exception as exc:  # pragma: no cover
        raise RuntimeError("requests is required for USDA/web scraping (python/requirements.txt)") from exc


def require_bs4():
    try:
        from bs4 import BeautifulSoup  # type: ignore
        return BeautifulSoup
    except Exception as exc:  # pragma: no cover
        raise RuntimeError("beautifulsoup4 is required for HTML scraping (python/requirements.txt)") from exc


def require_pypdf():
    try:
        from pypdf import PdfReader  # type: ignore
        return PdfReader
    except Exception as exc:  # pragma: no cover
        raise RuntimeError("pypdf is required for PDF parsing (python/requirements.txt)") from exc


def load_model_coefficients(path: Optional[str]) -> Optional[Dict[str, Any]]:
    if not path:
        return None
    with open(path, "r", encoding="utf-8") as f:
        payload = json.load(f)
    if "coefficients" not in payload:
        raise ValueError("Invalid model coefficients file: missing 'coefficients'")
    return payload


def load_source_configs(path: Optional[str], crop: str) -> List[SourceConfig]:
    if not path:
        return []
    with open(path, "r", encoding="utf-8") as f:
        payload = json.load(f)
    raw_sources = payload.get("sources", []) if isinstance(payload, dict) else []
    result: List[SourceConfig] = []
    for raw in raw_sources:
        if not isinstance(raw, dict):
            continue
        crop_type = str(raw.get("crop_type") or DEFAULT_CROP)
        if crop_type != crop:
            continue
        mode = str(raw.get("mode") or "html").strip().lower()
        if mode not in {"html", "pdf", "html_to_pdf"}:
            continue
        result.append(
            SourceConfig(
                buyer_external_seed_key=str(raw["buyer_external_seed_key"]),
                crop_type=crop_type,
                mode=mode,
                url=str(raw["url"]),
                label=str(raw.get("label") or raw.get("url")),
                text_selector=(str(raw.get("text_selector")) if raw.get("text_selector") else None),
                pdf_link_regex=(str(raw.get("pdf_link_regex")) if raw.get("pdf_link_regex") else None),
                value_regex=(str(raw.get("value_regex")) if raw.get("value_regex") else None),
                basis_regex=(str(raw.get("basis_regex")) if raw.get("basis_regex") else None),
                futures_regex=(str(raw.get("futures_regex")) if raw.get("futures_regex") else None),
                confidence_score=int(raw.get("confidence_score") or 90),
            )
        )
    return result


def connect_db(database_url: str):
    require_psycopg()
    return psycopg.connect(database_url, row_factory=dict_row)  # type: ignore[arg-type]


def fetch_buyers(conn, crop: str, verified_only: bool, limit: int) -> List[BuyerRow]:
    clauses = ["b.active = TRUE", "b.crop_type = %s", "b.launch_scope = 'corridor'", "b.state = ANY(%s)"]
    params: List[Any] = [crop, list(PRIMARY_CORRIDOR_STATES)]
    if verified_only:
        clauses.append("bc.verified_status = 'verified'")

    sql = f"""
        SELECT
            b.id,
            b.external_seed_key,
            b.name,
            b.type,
            b.city,
            b.state,
            b.region,
            b.lat,
            b.lng,
            b.crop_type,
            b.launch_scope,
            b.rail_confidence,
            bc.verified_status,
            bc.facility_phone,
            bc.website_url,
            bc.contact_role
        FROM buyers b
        LEFT JOIN buyer_contacts bc ON bc.buyer_id = b.id
        WHERE {' AND '.join(clauses)}
        ORDER BY COALESCE(b.rail_confidence, 0) DESC, b.state ASC, b.name ASC
        LIMIT %s
    """
    params.append(max(1, min(limit, 5000)))

    with conn.cursor() as cur:
        cur.execute(sql, params)
        rows = cur.fetchall()

    return [
        BuyerRow(
            id=row["id"],
            external_seed_key=row.get("external_seed_key"),
            name=row["name"],
            type=row["type"],
            city=row["city"],
            state=row["state"],
            region=row["region"],
            lat=float(row["lat"]),
            lng=float(row["lng"]),
            crop_type=row["crop_type"],
            launch_scope=row["launch_scope"],
            rail_confidence=int(row["rail_confidence"]) if row.get("rail_confidence") is not None else None,
            verified_status=row.get("verified_status"),
            facility_phone=row.get("facility_phone"),
            website_url=row.get("website_url"),
            contact_role=row.get("contact_role"),
        )
        for row in rows
    ]


def fetch_latest_observations(conn, crop: str, buyer_ids: Iterable[str]) -> Dict[str, BidObservation]:
    ids = list(buyer_ids)
    if not ids:
        return {}
    sql = """
        SELECT DISTINCT ON (buyer_id)
            buyer_id,
            crop_type,
            source_kind,
            COALESCE(source_label, source_kind) AS source_label,
            COALESCE(source_url, '') AS source_url,
            observed_at,
            cash_bid,
            basis,
            futures_price,
            COALESCE(confidence_score, 50) AS confidence_score,
            parsed_from_pdf,
            raw_excerpt,
            raw_payload_json
        FROM buyer_cash_bid_observations
        WHERE buyer_id = ANY(%s)
          AND crop_type = %s
        ORDER BY buyer_id, observed_at DESC, COALESCE(confidence_score, 0) DESC
    """
    with conn.cursor() as cur:
        cur.execute(sql, [ids, crop])
        rows = cur.fetchall()

    out: Dict[str, BidObservation] = {}
    for row in rows:
        out[row["buyer_id"]] = BidObservation(
            buyer_id=row["buyer_id"],
            crop_type=row["crop_type"],
            source_kind=row["source_kind"],
            source_label=row.get("source_label") or row["source_kind"],
            source_url=row.get("source_url") or "",
            observed_at=row["observed_at"],
            cash_bid=float(row["cash_bid"]) if row.get("cash_bid") is not None else None,
            basis=float(row["basis"]) if row.get("basis") is not None else None,
            futures_price=float(row["futures_price"]) if row.get("futures_price") is not None else None,
            confidence_score=int(row.get("confidence_score") or 50),
            parsed_from_pdf=bool(row.get("parsed_from_pdf")),
            raw_excerpt=row.get("raw_excerpt"),
            raw_payload_json=row.get("raw_payload_json") or {},
        )
    return out


def create_run(conn, crop: str) -> str:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO morning_recommendation_runs (run_date, crop_type, status, started_at)
            VALUES (CURRENT_DATE, %s, 'running', NOW())
            RETURNING id
            """,
            [crop],
        )
        row = cur.fetchone()
    return row["id"]


def finalize_run(conn, run_id: str, status: str, top_states: List[str], source_summary: Dict[str, Any], summary: Dict[str, Any]) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE morning_recommendation_runs
            SET status = %s,
                ended_at = NOW(),
                top_states = %s,
                source_summary_json = %s::jsonb,
                summary_json = %s::jsonb
            WHERE id = %s
            """,
            [status, top_states, json.dumps(source_summary), json.dumps(summary), run_id],
        )


def insert_observations(conn, observations: List[BidObservation]) -> int:
    if not observations:
        return 0
    inserted = 0
    with conn.cursor() as cur:
        for obs in observations:
            cur.execute(
                """
                INSERT INTO buyer_cash_bid_observations (
                    buyer_id, crop_type, source_kind, source_label, source_url, observed_at,
                    cash_bid, basis, futures_price, confidence_score, parsed_from_pdf,
                    raw_excerpt, raw_payload_json
                ) VALUES (
                    %s, %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s,
                    %s, %s::jsonb
                )
                """,
                [
                    obs.buyer_id,
                    obs.crop_type,
                    obs.source_kind,
                    obs.source_label,
                    obs.source_url,
                    obs.observed_at,
                    obs.cash_bid,
                    obs.basis,
                    obs.futures_price,
                    obs.confidence_score,
                    obs.parsed_from_pdf,
                    obs.raw_excerpt,
                    json.dumps(obs.raw_payload_json),
                ],
            )
            inserted += 1
    return inserted


def insert_recommendations(conn, run_id: str, ranked: List[RankedBuyer]) -> int:
    inserted = 0
    with conn.cursor() as cur:
        for idx, item in enumerate(ranked, start=1):
            cur.execute(
                """
                INSERT INTO morning_recommendations (
                    run_id, buyer_id, rank, state, composite_score,
                    cash_bid, basis, futures_price, estimated_freight, estimated_net_bid,
                    rail_confidence, bid_source_kind, bid_source_label, bid_source_url,
                    bid_observed_at, rationale_json
                ) VALUES (
                    %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s,
                    %s, %s, %s, %s,
                    %s, %s::jsonb
                )
                """,
                [
                    run_id,
                    item.buyer.id,
                    idx,
                    item.buyer.state,
                    round(item.composite_score, 4),
                    item.cash_bid,
                    item.basis,
                    item.futures_price,
                    item.estimated_freight,
                    item.estimated_net_bid,
                    item.buyer.rail_confidence,
                    item.bid_source_kind,
                    item.bid_source_label,
                    item.bid_source_url,
                    item.bid_observed_at,
                    json.dumps(item.rationale),
                ],
            )
            inserted += 1
    return inserted


def fetch_json(url: str, timeout: float) -> Dict[str, Any]:
    requests = require_requests()
    response = requests.get(url, timeout=timeout, headers={"User-Agent": "CornIntelMorningRanker/1.0"})
    response.raise_for_status()
    return response.json()


def coerce_usda_basis(value: Any) -> Optional[float]:
    if value is None:
        return None
    try:
        num = float(value)
    except Exception:
        return None
    # Many USDA responses encode basis in cents.
    if abs(num) > 10:
        num = num / 100.0
    return num


def parse_usda_regional_basis(grain_report_payload: Dict[str, Any]) -> Dict[str, float]:
    adjustments: Dict[str, float] = {}
    data = grain_report_payload.get("data") or {}
    results = data.get("results") if isinstance(data, dict) else None
    if not isinstance(results, list):
        results = data if isinstance(data, list) else []

    for item in results:
        if not isinstance(item, dict):
            continue
        state = str(item.get("state") or item.get("location_state") or "").upper()
        region = STATE_TO_REGION.get(state)
        if not region:
            region = str(item.get("region") or "").strip() or None
        if not region:
            continue
        basis = coerce_usda_basis(item.get("basis"))
        if basis is None:
            continue
        adjustments[region] = basis

    if not adjustments:
        return dict(FALLBACK_REGIONAL_BASIS)
    # Ensure default coverage remains available.
    merged = dict(FALLBACK_REGIONAL_BASIS)
    merged.update(adjustments)
    return merged


def fetch_usda_market_context(api_base_url: str, timeout: float, crop: str) -> Tuple[float, Dict[str, float], Dict[str, Any]]:
    futures_price = 4.30
    futures_source = "fallback"
    regional_basis = dict(FALLBACK_REGIONAL_BASIS)
    grain_source = "fallback"

    if crop != DEFAULT_CROP:
        # Non-corn crops currently use fallback until crop-specific sources are added.
        return futures_price, regional_basis, {
            "futuresSource": futures_source,
            "grainSource": grain_source,
            "crop": crop,
            "note": "Non-corn crop uses fallback USDA mapping in morning ranker",
        }

    try:
        futures = fetch_json(f"{api_base_url.rstrip('/')}/api/usda/futures-price", timeout)
        fp = futures.get("futuresPrice")
        if fp is not None:
            futures_price = float(fp)
        futures_source = str(futures.get("source") or futures_source)
    except Exception as exc:
        futures_source = f"fallback ({exc})"

    try:
        grain = fetch_json(
            f"{api_base_url.rstrip('/')}/api/usda/grain-report?commodity={quote('Corn')}",
            timeout,
        )
        regional_basis = parse_usda_regional_basis(grain)
        grain_source = str(grain.get("source") or grain_source)
    except Exception as exc:
        grain_source = f"fallback ({exc})"

    return futures_price, regional_basis, {
        "futuresSource": futures_source,
        "grainSource": grain_source,
        "crop": crop,
    }


def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    PdfReader = require_pypdf()
    reader = PdfReader(io.BytesIO(pdf_bytes))
    chunks: List[str] = []
    for page in reader.pages:
        try:
            chunks.append(page.extract_text() or "")
        except Exception:
            continue
    return "\n".join(chunks)


def fetch_url(url: str, timeout: float) -> Tuple[bytes, str]:
    requests = require_requests()
    response = requests.get(url, timeout=timeout, headers={"User-Agent": "CornIntelMorningRanker/1.0"})
    response.raise_for_status()
    return response.content, response.headers.get("Content-Type", "")


def extract_html_text(html: str, selector: Optional[str]) -> str:
    BeautifulSoup = require_bs4()
    soup = BeautifulSoup(html, "html.parser")
    if selector:
        nodes = soup.select(selector)
        if nodes:
            return "\n".join(node.get_text(" ", strip=True) for node in nodes)
    return soup.get_text("\n", strip=True)


def find_pdf_link(html: str, base_url: str, regex: Optional[str]) -> Optional[str]:
    BeautifulSoup = require_bs4()
    soup = BeautifulSoup(html, "html.parser")
    pattern = re.compile(regex) if regex else None
    for a in soup.find_all("a", href=True):
        href = str(a.get("href"))
        text = a.get_text(" ", strip=True)
        candidate = href if href.lower().endswith(".pdf") else text
        if pattern and not pattern.search(candidate):
            continue
        if ".pdf" in href.lower() or (pattern and pattern.search(text)):
            return urljoin(base_url, href)
    if pattern:
        for match in re.finditer(r'https?://[^\s"\']+\.pdf', html, flags=re.I):
            if pattern.search(match.group(0)):
                return match.group(0)
    else:
        match = re.search(r'https?://[^\s"\']+\.pdf', html, flags=re.I)
        if match:
            return match.group(0)
    return None


def parse_number(text: str) -> Optional[float]:
    cleaned = text.strip().replace(",", "")
    cleaned = cleaned.replace("$", "")
    if not cleaned:
        return None
    try:
        return float(cleaned)
    except Exception:
        return None


def normalize_basis_value(value: Optional[float]) -> Optional[float]:
    if value is None:
        return None
    if abs(value) > 10:
        return value / 100.0
    return value


def extract_match_and_excerpt(text: str, pattern: str) -> Tuple[Optional[re.Match[str]], Optional[str]]:
    match = re.search(pattern, text, flags=re.I | re.M)
    if not match:
        return None, None
    start = max(0, match.start() - 80)
    end = min(len(text), match.end() + 80)
    excerpt = text[start:end].replace("\n", " ")
    return match, excerpt


def match_to_value(match: re.Match[str]) -> Optional[float]:
    groups = [g for g in match.groups() if g is not None]
    if not groups:
        return parse_number(match.group(0))
    # Prefer last numeric-looking group when prompt regex has labels + numeric capture.
    for raw in reversed(groups):
        v = parse_number(raw)
        if v is not None:
            return v
    return None


def extract_bid_metrics(text: str, source: SourceConfig) -> Tuple[Optional[float], Optional[float], Optional[float], Optional[str]]:
    cash_bid: Optional[float] = None
    basis: Optional[float] = None
    futures_price: Optional[float] = None
    excerpt: Optional[str] = None

    cash_patterns = [source.value_regex] if source.value_regex else []
    cash_patterns.extend(GENERIC_CASH_PATTERNS)

    for pat in cash_patterns:
        if not pat:
            continue
        match, found_excerpt = extract_match_and_excerpt(text, pat)
        if not match:
            continue
        candidate = match_to_value(match)
        if candidate is None:
            continue
        # Ignore clearly invalid values.
        if 2.0 <= candidate <= 20.0:
            cash_bid = candidate
            excerpt = found_excerpt
            break
        # Some sources post cents; convert if likely cents.
        if 200 <= candidate <= 2000:
            cash_bid = candidate / 100.0
            excerpt = found_excerpt
            break

    if source.basis_regex:
        match, _ = extract_match_and_excerpt(text, source.basis_regex)
        if match:
            basis = normalize_basis_value(match_to_value(match))
    else:
        match, _ = extract_match_and_excerpt(text, GENERIC_BASIS_PATTERN)
        if match:
            basis = normalize_basis_value(match_to_value(match))

    if source.futures_regex:
        match, _ = extract_match_and_excerpt(text, source.futures_regex)
        if match:
            futures_price = match_to_value(match)
            if futures_price and futures_price > 20:
                futures_price = futures_price / 100.0

    return cash_bid, basis, futures_price, excerpt


def scrape_bid_source(source: SourceConfig, buyer: BuyerRow, timeout: float, debug: bool = False) -> Tuple[Optional[BidObservation], Optional[str]]:
    try:
        parsed_from_pdf = False
        final_url = source.url
        payload: Dict[str, Any] = {"mode": source.mode, "buyer": buyer.name}

        if source.mode == "pdf":
            raw_bytes, content_type = fetch_url(source.url, timeout)
            parsed_from_pdf = True
            text = extract_text_from_pdf(raw_bytes)
            payload["contentType"] = content_type
        else:
            raw_bytes, content_type = fetch_url(source.url, timeout)
            html = raw_bytes.decode("utf-8", errors="ignore")
            payload["contentType"] = content_type

            if source.mode == "html_to_pdf":
                pdf_url = find_pdf_link(html, source.url, source.pdf_link_regex)
                if not pdf_url:
                    return None, f"No PDF link matched at {source.url}"
                final_url = pdf_url
                pdf_bytes, pdf_ct = fetch_url(pdf_url, timeout)
                parsed_from_pdf = True
                payload["resolvedPdfUrl"] = pdf_url
                payload["pdfContentType"] = pdf_ct
                text = extract_text_from_pdf(pdf_bytes)
            else:
                text = extract_html_text(html, source.text_selector)

        cash_bid, basis, futures_price, excerpt = extract_bid_metrics(text, source)
        if cash_bid is None:
            return None, f"No cash bid extracted from {final_url}"

        source_kind = "website_pdf" if parsed_from_pdf else "website_html"
        obs = BidObservation(
            buyer_id=buyer.id,
            crop_type=source.crop_type,
            source_kind=source_kind,
            source_label=source.label,
            source_url=final_url,
            observed_at=now_utc(),
            cash_bid=float(cash_bid),
            basis=float(basis) if basis is not None else None,
            futures_price=float(futures_price) if futures_price is not None else None,
            confidence_score=max(0, min(int(source.confidence_score), 100)),
            parsed_from_pdf=parsed_from_pdf,
            raw_excerpt=excerpt,
            raw_payload_json={
                **payload,
                "externalSeedKey": buyer.external_seed_key,
                "buyerName": buyer.name,
                "buyerCity": buyer.city,
                "buyerState": buyer.state,
            },
        )
        if debug:
            print(f"[scrape] {buyer.name}: cash={obs.cash_bid} source={obs.source_kind} url={final_url}")
        return obs, None
    except Exception as exc:
        return None, str(exc)


def estimate_freight(state: str, rail_confidence: Optional[int]) -> float:
    base = STATE_FREIGHT_ESTIMATE.get(state.upper(), 0.56)
    rc = rail_confidence if rail_confidence is not None else 0
    if rc < 40:
        base += 0.20
    elif rc < 70:
        base += 0.08
    return round(base, 4)


def basis_for_state(state: str, regional_basis: Dict[str, float]) -> float:
    region = STATE_TO_REGION.get(state.upper(), "Midwest")
    return float(regional_basis.get(region, FALLBACK_REGIONAL_BASIS.get(region, -0.25)))


def score_contact_verified(status: Optional[str]) -> float:
    if status == "verified":
        return 1.0
    if status == "needs_review":
        return 0.5
    return 0.0


def hours_since(ts: Optional[datetime], reference: datetime) -> float:
    if ts is None:
        return 9999.0
    delta = reference - ts.astimezone(UTC)
    return max(delta.total_seconds() / 3600.0, 0.0)


def freshness_score(hours_old: float) -> float:
    if hours_old <= 4:
        return 1.0
    if hours_old <= 12:
        return 0.9
    if hours_old <= 24:
        return 0.8
    if hours_old <= 48:
        return 0.6
    if hours_old <= 72:
        return 0.45
    if hours_old <= 168:
        return 0.25
    return 0.1


def source_confidence_norm(score: Optional[float]) -> float:
    if score is None:
        return 0.4
    return max(0.0, min(float(score) / 100.0, 1.0))


def min_max_norm(values: List[float]) -> List[float]:
    if not values:
        return []
    lo = min(values)
    hi = max(values)
    if math.isclose(lo, hi):
        return [0.5 for _ in values]
    return [(v - lo) / (hi - lo) for v in values]


def compute_top_states_by_cash(ranked_items: List[RankedBuyer], top_states: int) -> List[str]:
    per_state: Dict[str, List[RankedBuyer]] = {}
    for item in ranked_items:
        per_state.setdefault(item.buyer.state, []).append(item)

    scored: List[Tuple[str, float, float, float]] = []
    for state, items in per_state.items():
        sorted_items = sorted(items, key=lambda x: (x.cash_bid or -1e9, x.estimated_net_bid or -1e9), reverse=True)
        top_slice = sorted_items[:3]
        cash_vals = [x.cash_bid for x in top_slice if x.cash_bid is not None]
        net_vals = [x.estimated_net_bid for x in top_slice if x.estimated_net_bid is not None]
        rail_vals = [float(x.buyer.rail_confidence or 0) for x in items]
        avg_cash = sum(cash_vals) / len(cash_vals) if cash_vals else -999.0
        avg_net = sum(net_vals) / len(net_vals) if net_vals else -999.0
        avg_rail = sum(rail_vals) / len(rail_vals) if rail_vals else 0.0
        scored.append((state, avg_cash, avg_net, avg_rail))

    scored.sort(key=lambda x: (x[1], x[2], x[3]), reverse=True)
    return [state for state, *_ in scored[: max(1, top_states)]]


def load_ml_coefficients(path: Optional[str]) -> Optional[Dict[str, Any]]:
    if not path:
        return None
    return load_model_coefficients(path)


def compute_ml_score(model: Optional[Dict[str, Any]], raw_features: Dict[str, float]) -> Optional[float]:
    if not model:
        return None
    coeffs = model.get("coefficients") or {}
    intercept = float(model.get("intercept") or 0.0)
    total = intercept
    for name, value in raw_features.items():
        coef = coeffs.get(name)
        if coef is None:
            continue
        total += float(coef) * float(value)
    # Sigmoid if logistic-style; otherwise just return linear bounded value.
    if str(model.get("model_type", "")).startswith("logistic"):
        try:
            return 1.0 / (1.0 + math.exp(-total))
        except OverflowError:
            return 1.0 if total > 0 else 0.0
    return total


def build_rankings(
    buyers: List[BuyerRow],
    latest_obs: Dict[str, BidObservation],
    scraped_obs: Dict[str, BidObservation],
    futures_price: float,
    regional_basis: Dict[str, float],
    max_bid_age_hours: float,
    model_payload: Optional[Dict[str, Any]],
    top_states_count: int,
    top_n: int,
) -> Tuple[List[RankedBuyer], List[str], Dict[str, Any]]:
    reference = now_utc()
    pre_rank: List[RankedBuyer] = []

    # First pass: resolve bids + build raw features.
    for buyer in buyers:
        rail_conf = buyer.rail_confidence if buyer.rail_confidence is not None else 0
        if rail_conf < 40:
            # BNSF-focused morning list: keep strong/likely rail-served only.
            continue

        obs = scraped_obs.get(buyer.id) or latest_obs.get(buyer.id)
        use_obs = None
        if obs:
            age_h = hours_since(obs.observed_at, reference)
            if age_h <= max_bid_age_hours:
                use_obs = obs
        state_basis = basis_for_state(buyer.state, regional_basis)

        if use_obs and use_obs.cash_bid is not None:
            cash_bid = use_obs.cash_bid
            basis = use_obs.basis if use_obs.basis is not None else (cash_bid - (use_obs.futures_price or futures_price))
            used_futures = use_obs.futures_price if use_obs.futures_price is not None else futures_price
            bid_source_kind = use_obs.source_kind
            bid_source_label = use_obs.source_label
            bid_source_url = use_obs.source_url
            bid_observed_at = use_obs.observed_at
            src_conf = float(use_obs.confidence_score)
        else:
            basis = state_basis
            used_futures = futures_price
            cash_bid = round(used_futures + basis, 4)
            bid_source_kind = "usda"
            bid_source_label = "USDA-derived regional basis"
            bid_source_url = None
            bid_observed_at = None
            src_conf = 70.0

        freight = estimate_freight(buyer.state, buyer.rail_confidence)
        est_net = round(cash_bid - freight, 4) if cash_bid is not None else None
        freshness_h = hours_since(bid_observed_at, reference) if bid_observed_at else 9999.0

        raw_features = {
            "cash_bid": float(cash_bid or 0.0),
            "estimated_net_bid": float(est_net or 0.0),
            "rail_confidence": float(rail_conf),
            "contact_verified": 1.0 if buyer.verified_status == "verified" else 0.0,
            "bid_freshness_hours": float(min(freshness_h, 9999.0)),
            "source_confidence": float(src_conf),
        }

        pre_rank.append(
            RankedBuyer(
                buyer=buyer,
                cash_bid=float(cash_bid) if cash_bid is not None else None,
                basis=float(basis) if basis is not None else None,
                futures_price=float(used_futures) if used_futures is not None else None,
                estimated_freight=float(freight),
                estimated_net_bid=float(est_net) if est_net is not None else None,
                bid_source_kind=bid_source_kind,
                bid_source_label=bid_source_label,
                bid_source_url=bid_source_url,
                bid_observed_at=bid_observed_at,
                source_confidence=src_conf,
                bid_freshness_hours=freshness_h,
                feature_values=raw_features,
                weighted_score=0.0,
                ml_score=None,
                composite_score=0.0,
                rationale={},
            )
        )

    if not pre_rank:
        return [], [], {"evaluated": 0}

    # Normalize selected features for weighted deterministic score.
    cash_norm = min_max_norm([x.feature_values["cash_bid"] for x in pre_rank])
    net_norm = min_max_norm([x.feature_values["estimated_net_bid"] for x in pre_rank])
    rail_norm = min_max_norm([x.feature_values["rail_confidence"] for x in pre_rank])
    contact_norm = [score_contact_verified(x.buyer.verified_status) for x in pre_rank]
    freshness_norm = [freshness_score(x.bid_freshness_hours) for x in pre_rank]
    source_conf_norm = [source_confidence_norm(x.source_confidence) for x in pre_rank]

    ml_scores = [compute_ml_score(model_payload, x.feature_values) for x in pre_rank]
    ml_norm = min_max_norm([s for s in ml_scores if s is not None]) if any(s is not None for s in ml_scores) else []
    ml_iter_idx = 0

    for idx, item in enumerate(pre_rank):
        contributions = {
            "cash_bid": cash_norm[idx] * DEFAULT_WEIGHTED_SCORE["cash_bid"],
            "estimated_net_bid": net_norm[idx] * DEFAULT_WEIGHTED_SCORE["estimated_net_bid"],
            "rail_confidence": rail_norm[idx] * DEFAULT_WEIGHTED_SCORE["rail_confidence"],
            "contact_verified": contact_norm[idx] * DEFAULT_WEIGHTED_SCORE["contact_verified"],
            "bid_freshness": freshness_norm[idx] * DEFAULT_WEIGHTED_SCORE["bid_freshness"],
            "source_confidence": source_conf_norm[idx] * DEFAULT_WEIGHTED_SCORE["source_confidence"],
        }
        weighted_score = sum(contributions.values())
        item.weighted_score = weighted_score

        ml_score = ml_scores[idx]
        item.ml_score = ml_score
        if ml_score is not None:
            normalized_ml = ml_norm[ml_iter_idx]
            ml_iter_idx += 1
            # Blend deterministic score + ML guidance so ML cannot dominate bad data.
            composite = (weighted_score * 0.7) + (normalized_ml * 0.3)
        else:
            composite = weighted_score

        item.composite_score = composite
        item.rationale = {
            "contributions": {k: round(v, 4) for k, v in contributions.items()},
            "rawFeatures": {k: round(v, 4) for k, v in item.feature_values.items()},
            "weightedScore": round(weighted_score, 4),
            "mlScore": round(ml_score, 6) if ml_score is not None else None,
            "compositeScore": round(composite, 4),
            "bidSourceKind": item.bid_source_kind,
            "bidFreshnessHours": round(item.bid_freshness_hours, 2),
            "estimatedFreight": item.estimated_freight,
        }

    top_states = compute_top_states_by_cash(pre_rank, top_states_count)
    filtered = [x for x in pre_rank if x.buyer.state in set(top_states)]

    filtered.sort(
        key=lambda x: (
            x.composite_score,
            x.estimated_net_bid if x.estimated_net_bid is not None else -1e9,
            x.cash_bid if x.cash_bid is not None else -1e9,
            x.buyer.rail_confidence or 0,
        ),
        reverse=True,
    )

    top_ranked = filtered[: max(1, top_n)]

    summary = {
        "evaluated": len(pre_rank),
        "returned": len(top_ranked),
        "topStates": top_states,
        "usesMlGuidance": model_payload is not None,
        "weights": DEFAULT_WEIGHTED_SCORE,
    }
    return top_ranked, top_states, summary


def scrape_observations_for_buyers(
    buyers: List[BuyerRow],
    configs: List[SourceConfig],
    timeout: float,
    debug: bool,
) -> Tuple[List[BidObservation], Dict[str, BidObservation], Dict[str, Any]]:
    by_key = {b.external_seed_key: b for b in buyers if b.external_seed_key}
    grouped: Dict[str, List[SourceConfig]] = {}
    for cfg in configs:
        grouped.setdefault(cfg.buyer_external_seed_key, []).append(cfg)

    observations: List[BidObservation] = []
    best_for_buyer: Dict[str, BidObservation] = {}
    errors: List[str] = []
    attempted = 0
    succeeded = 0

    for external_key, cfgs in grouped.items():
        buyer = by_key.get(external_key)
        if not buyer:
            errors.append(f"No DB buyer found for source key: {external_key}")
            continue
        for cfg in cfgs:
            attempted += 1
            obs, err = scrape_bid_source(cfg, buyer, timeout, debug=debug)
            if err:
                errors.append(f"{buyer.name}: {err}")
                continue
            if not obs:
                continue
            succeeded += 1
            observations.append(obs)
            prev = best_for_buyer.get(buyer.id)
            if prev is None or (obs.confidence_score, obs.observed_at) > (prev.confidence_score, prev.observed_at):
                best_for_buyer[buyer.id] = obs

    summary = {
        "configuredSourceCount": len(configs),
        "attempted": attempted,
        "succeeded": succeeded,
        "failed": max(0, attempted - succeeded),
        "sampleErrors": errors[:15],
    }
    return observations, best_for_buyer, summary


def print_rank_preview(ranked: List[RankedBuyer], top_states: List[str]) -> None:
    print(f"Top states: {', '.join(top_states) if top_states else '(none)'}")
    for item in ranked[:15]:
        print(
            f"#{ranked.index(item)+1:02d} {item.buyer.name} ({item.buyer.city}, {item.buyer.state}) "
            f"score={item.composite_score:.3f} cash={item.cash_bid or 0:.2f} "
            f"net={item.estimated_net_bid or 0:.2f} rail={item.buyer.rail_confidence or 0} "
            f"src={item.bid_source_kind}"
        )


def main() -> int:
    args = parse_args()

    if not args.database_url:
        print("DATABASE_URL is required (or pass --database-url)", file=sys.stderr)
        return 2

    if not args.skip_scrape and args.bid_source_config and not os.path.exists(args.bid_source_config):
        print(f"Bid source config not found: {args.bid_source_config}", file=sys.stderr)
        return 2

    model_payload = load_ml_coefficients(args.model_coefficients_file)
    source_configs = load_source_configs(args.bid_source_config, args.crop) if (args.bid_source_config and not args.skip_scrape) else []

    conn = None
    run_id: Optional[str] = None
    try:
        conn = connect_db(args.database_url)
        conn.autocommit = False

        buyers = fetch_buyers(conn, args.crop, args.verified_only, args.limit)
        if not buyers:
            print("No buyers found for morning ranking scope.", file=sys.stderr)
            return 1

        latest_obs = fetch_latest_observations(conn, args.crop, [b.id for b in buyers])

        scraped_obs_list: List[BidObservation] = []
        scraped_best_map: Dict[str, BidObservation] = {}
        scrape_summary: Dict[str, Any] = {"configuredSourceCount": 0, "attempted": 0, "succeeded": 0, "failed": 0}
        if source_configs and not args.skip_scrape:
            scraped_obs_list, scraped_best_map, scrape_summary = scrape_observations_for_buyers(
                buyers,
                source_configs,
                timeout=args.http_timeout,
                debug=args.debug,
            )

        futures_price, regional_basis, usda_summary = fetch_usda_market_context(args.api_base_url, args.http_timeout, args.crop)

        ranked, top_states, ranking_summary = build_rankings(
            buyers=buyers,
            latest_obs=latest_obs,
            scraped_obs=scraped_best_map,
            futures_price=futures_price,
            regional_basis=regional_basis,
            max_bid_age_hours=args.max_bid_age_hours,
            model_payload=model_payload,
            top_states_count=args.top_states,
            top_n=args.top_n,
        )

        if not ranked:
            print("No ranked buyers produced (check rail confidence/contact scope).", file=sys.stderr)
            return 1

        status = "success"
        source_summary = {
            "usda": usda_summary,
            "scrape": scrape_summary,
            "config": {
                "crop": args.crop,
                "verifiedOnly": bool(args.verified_only),
                "maxBidAgeHours": args.max_bid_age_hours,
                "topStates": args.top_states,
                "topN": args.top_n,
                "skipScrape": bool(args.skip_scrape),
                "bidSourceConfig": args.bid_source_config,
            },
        }
        summary_json = {
            **ranking_summary,
            "futuresPrice": futures_price,
            "runDate": date.today().isoformat(),
            "buyerCountInput": len(buyers),
            "scrapedObservationsNew": len(scraped_obs_list),
        }

        if args.dry_run:
            print(json.dumps({
                "dryRun": True,
                "topStates": top_states,
                "summary": summary_json,
                "preview": [
                    {
                        "rank": i + 1,
                        "buyer": f"{item.buyer.name} ({item.buyer.state})",
                        "cashBid": item.cash_bid,
                        "estimatedNetBid": item.estimated_net_bid,
                        "railConfidence": item.buyer.rail_confidence,
                        "source": item.bid_source_kind,
                        "score": round(item.composite_score, 4),
                    }
                    for i, item in enumerate(ranked[:15])
                ],
            }, indent=2))
            conn.rollback()
            return 0

        run_id = create_run(conn, args.crop)
        inserted_observations = insert_observations(conn, scraped_obs_list)
        inserted_recommendations = insert_recommendations(conn, run_id, ranked)
        summary_json["scrapedObservationsInserted"] = inserted_observations
        summary_json["recommendationsInserted"] = inserted_recommendations
        finalize_run(conn, run_id, status, top_states, source_summary, summary_json)
        conn.commit()

        print(json.dumps({
            "runId": run_id,
            "status": status,
            "topStates": top_states,
            "summary": summary_json,
            "sourceSummary": source_summary,
        }, indent=2))
        return 0
    except KeyboardInterrupt:
        print("Interrupted", file=sys.stderr)
        if conn is not None:
            conn.rollback()
        return 130
    except Exception as exc:
        if conn is not None:
            try:
                if run_id:
                    finalize_run(conn, run_id, "failed", [], {"error": str(exc)}, {"error": str(exc)})
                    conn.commit()
                else:
                    conn.rollback()
            except Exception:
                conn.rollback()
        print(f"morning_ranker failed: {exc}", file=sys.stderr)
        return 1
    finally:
        if conn is not None:
            conn.close()


if __name__ == "__main__":
    raise SystemExit(main())
