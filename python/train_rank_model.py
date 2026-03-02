#!/usr/bin/env python3
"""Train a simple logistic-regression reranker model from labeled call outcomes.

Expected CSV columns:
- cash_bid
- estimated_net_bid
- rail_confidence
- contact_verified (0/1)
- bid_freshness_hours
- source_confidence
- outcome_won (0/1)

Exports a JSON coefficient file that `morning_ranker.py` can load via --model-coefficients-file.
"""

from __future__ import annotations

import argparse
import json
import sys


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--csv", required=True, help="Training CSV with labeled outcomes")
    parser.add_argument("--out", required=True, help="Output JSON coefficients file")
    args = parser.parse_args()

    try:
        import pandas as pd  # type: ignore
        from sklearn.linear_model import LogisticRegression  # type: ignore
    except Exception as exc:  # pragma: no cover
        print(
            "Missing optional training deps. Install from python/requirements.txt (pandas, scikit-learn).",
            file=sys.stderr,
        )
        print(str(exc), file=sys.stderr)
        return 2

    feature_cols = [
        "cash_bid",
        "estimated_net_bid",
        "rail_confidence",
        "contact_verified",
        "bid_freshness_hours",
        "source_confidence",
    ]
    target_col = "outcome_won"

    df = pd.read_csv(args.csv)
    missing = [c for c in feature_cols + [target_col] if c not in df.columns]
    if missing:
        print(f"Missing columns: {missing}", file=sys.stderr)
        return 2

    X = df[feature_cols].fillna(0)
    y = df[target_col].astype(int)

    model = LogisticRegression(max_iter=200, class_weight="balanced")
    model.fit(X, y)

    coefs = model.coef_[0]
    payload = {
        "model_type": "logistic_regression",
        "feature_order": feature_cols,
        "intercept": float(model.intercept_[0]),
        "coefficients": {feature_cols[i]: float(coefs[i]) for i in range(len(feature_cols))},
        "notes": "Use with python/morning_ranker.py --model-coefficients-file",
    }

    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)

    print(f"Wrote coefficients to {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
