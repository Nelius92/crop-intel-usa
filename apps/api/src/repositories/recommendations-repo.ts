import type { QueryResultRow } from 'pg';
import { dbQuery } from '../db/pool.js';

type RecommendationRunStatus = 'running' | 'success' | 'partial' | 'failed';

export interface MorningRecommendationRunRecord {
    id: string;
    runDate: string;
    cropType: string;
    status: RecommendationRunStatus;
    startedAt: string;
    endedAt: string | null;
    topStates: string[];
    sourceSummary: Record<string, unknown>;
    summary: Record<string, unknown>;
}

export interface MorningRecommendationApiItem {
    rank: number;
    compositeScore: number;
    cashBid: number | null;
    basis: number | null;
    futuresPrice: number | null;
    estimatedFreight: number | null;
    estimatedNetBid: number | null;
    railConfidence: number | null;
    bidSourceKind: string | null;
    bidSourceLabel: string | null;
    bidSourceUrl: string | null;
    bidObservedAt: string | null;
    rationale: Record<string, unknown>;
    buyer: {
        id: string;
        externalSeedKey: string | null;
        name: string;
        type: string;
        city: string;
        state: string;
        region: string;
        lat: number;
        lng: number;
        cropType: string;
        organic: boolean;
        launchScope: 'corridor' | 'out_of_scope';
        active: boolean;
        railConfidence: number | null;
        contactRole: string | null;
        facilityPhone: string | null;
        website: string | null;
        verifiedStatus: 'verified' | 'needs_review' | 'unverified' | null;
        contactConfidenceScore: number | null;
        contactLastCheckedAt: string | null;
    };
}

interface RunRow extends QueryResultRow {
    id: string;
    runDate: Date | string;
    cropType: string;
    status: RecommendationRunStatus;
    startedAt: Date;
    endedAt: Date | null;
    topStates: string[] | null;
    sourceSummary: Record<string, unknown> | null;
    summary: Record<string, unknown> | null;
}

interface RecommendationRow extends QueryResultRow {
    rank: number;
    compositeScore: string | number;
    cashBid: string | number | null;
    basis: string | number | null;
    futuresPrice: string | number | null;
    estimatedFreight: string | number | null;
    estimatedNetBid: string | number | null;
    railConfidence: number | null;
    bidSourceKind: string | null;
    bidSourceLabel: string | null;
    bidSourceUrl: string | null;
    bidObservedAt: Date | null;
    rationale: Record<string, unknown> | null;
    buyerId: string;
    externalSeedKey: string | null;
    name: string;
    type: string;
    city: string;
    state: string;
    region: string;
    lat: number;
    lng: number;
    cropType: string;
    organic: boolean;
    launchScope: 'corridor' | 'out_of_scope';
    active: boolean;
    buyerRailConfidence: number | null;
    contactRole: string | null;
    facilityPhone: string | null;
    website: string | null;
    verifiedStatus: 'verified' | 'needs_review' | 'unverified' | null;
    contactConfidenceScore: number | null;
    contactLastCheckedAt: Date | null;
}

function toNumber(value: string | number | null): number | null {
    if (value == null) return null;
    return typeof value === 'number' ? value : Number(value);
}

function mapRunRow(row: RunRow): MorningRecommendationRunRecord {
    return {
        id: row.id,
        runDate: row.runDate instanceof Date ? row.runDate.toISOString().slice(0, 10) : String(row.runDate),
        cropType: row.cropType,
        status: row.status,
        startedAt: row.startedAt.toISOString(),
        endedAt: row.endedAt?.toISOString() ?? null,
        topStates: row.topStates ?? [],
        sourceSummary: row.sourceSummary ?? {},
        summary: row.summary ?? {},
    };
}

function mapRecommendationRow(row: RecommendationRow): MorningRecommendationApiItem {
    return {
        rank: row.rank,
        compositeScore: toNumber(row.compositeScore) ?? 0,
        cashBid: toNumber(row.cashBid),
        basis: toNumber(row.basis),
        futuresPrice: toNumber(row.futuresPrice),
        estimatedFreight: toNumber(row.estimatedFreight),
        estimatedNetBid: toNumber(row.estimatedNetBid),
        railConfidence: row.railConfidence,
        bidSourceKind: row.bidSourceKind,
        bidSourceLabel: row.bidSourceLabel,
        bidSourceUrl: row.bidSourceUrl,
        bidObservedAt: row.bidObservedAt?.toISOString() ?? null,
        rationale: row.rationale ?? {},
        buyer: {
            id: row.buyerId,
            externalSeedKey: row.externalSeedKey,
            name: row.name,
            type: row.type,
            city: row.city,
            state: row.state,
            region: row.region,
            lat: row.lat,
            lng: row.lng,
            cropType: row.cropType,
            organic: row.organic,
            launchScope: row.launchScope,
            active: row.active,
            railConfidence: row.buyerRailConfidence,
            contactRole: row.contactRole,
            facilityPhone: row.facilityPhone,
            website: row.website,
            verifiedStatus: row.verifiedStatus,
            contactConfidenceScore: row.contactConfidenceScore,
            contactLastCheckedAt: row.contactLastCheckedAt?.toISOString() ?? null,
        },
    };
}

export async function getLatestMorningRecommendationRun(cropType: string): Promise<MorningRecommendationRunRecord | null> {
    const result = await dbQuery<RunRow>(
        `
            SELECT
                id,
                run_date AS "runDate",
                crop_type AS "cropType",
                status,
                started_at AS "startedAt",
                ended_at AS "endedAt",
                top_states AS "topStates",
                source_summary_json AS "sourceSummary",
                summary_json AS "summary"
            FROM morning_recommendation_runs
            WHERE crop_type = $1
              AND status IN ('success', 'partial')
            ORDER BY run_date DESC, started_at DESC
            LIMIT 1
        `,
        [cropType]
    );

    const row = result.rows[0];
    return row ? mapRunRow(row) : null;
}

export async function listMorningRecommendationsForRun(args: {
    runId: string;
    limit?: number;
    verifiedOnly?: boolean;
    scope?: 'corridor' | 'out_of_scope' | 'all';
}): Promise<MorningRecommendationApiItem[]> {
    const limit = Math.min(Math.max(args.limit ?? 25, 1), 200);
    const params: unknown[] = [args.runId];

    const clauses = ['mr.run_id = $1', 'b.active = TRUE'];
    if (args.scope && args.scope !== 'all') {
        params.push(args.scope);
        clauses.push(`b.launch_scope = $${params.length}`);
    }
    if (args.verifiedOnly) {
        clauses.push(`bc.verified_status = 'verified'`);
    }

    params.push(limit);

    const result = await dbQuery<RecommendationRow>(
        `
            SELECT
                mr.rank,
                mr.composite_score AS "compositeScore",
                mr.cash_bid AS "cashBid",
                mr.basis,
                mr.futures_price AS "futuresPrice",
                mr.estimated_freight AS "estimatedFreight",
                mr.estimated_net_bid AS "estimatedNetBid",
                mr.rail_confidence AS "railConfidence",
                mr.bid_source_kind AS "bidSourceKind",
                mr.bid_source_label AS "bidSourceLabel",
                mr.bid_source_url AS "bidSourceUrl",
                mr.bid_observed_at AS "bidObservedAt",
                mr.rationale_json AS "rationale",
                b.id AS "buyerId",
                b.external_seed_key AS "externalSeedKey",
                b.name,
                b.type,
                b.city,
                b.state,
                b.region,
                b.lat,
                b.lng,
                b.crop_type AS "cropType",
                b.organic,
                b.launch_scope AS "launchScope",
                b.active,
                b.rail_confidence AS "buyerRailConfidence",
                bc.contact_role AS "contactRole",
                bc.facility_phone AS "facilityPhone",
                bc.website_url AS "website",
                bc.verified_status AS "verifiedStatus",
                bc.confidence_score AS "contactConfidenceScore",
                bc.last_checked_at AS "contactLastCheckedAt"
            FROM morning_recommendations mr
            JOIN buyers b ON b.id = mr.buyer_id
            LEFT JOIN buyer_contacts bc ON bc.buyer_id = b.id
            WHERE ${clauses.join(' AND ')}
            ORDER BY mr.rank ASC
            LIMIT $${params.length}
        `,
        params
    );

    return result.rows.map(mapRecommendationRow);
}

