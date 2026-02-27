import type { QueryResultRow } from 'pg';
import { dbQuery } from '../db/pool.js';

export type BuyerLaunchScope = 'corridor' | 'out_of_scope';
export type BuyerVerifiedStatus = 'verified' | 'needs_review' | 'unverified' | null;

export interface BuyerListFilters {
    state?: string;
    crop?: string;
    type?: string;
    region?: string;
    scope?: BuyerLaunchScope | 'all';
    verifiedOnly?: boolean;
    search?: string;
    limit?: number;
    offset?: number;
}

export interface BuyerApiRecord {
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
    railConfidence: number | null;
    launchScope: BuyerLaunchScope;
    active: boolean;
    contactRole: string | null;
    facilityPhone: string | null;
    website: string | null;
    contactName: string | null;
    email: string | null;
    verifiedStatus: BuyerVerifiedStatus;
    contactConfidenceScore: number | null;
    contactVerifiedAt: string | null;
    contactLastCheckedAt: string | null;
    buyerUpdatedAt: string;
    contactUpdatedAt: string | null;
}

interface BuyerRow extends QueryResultRow {
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
    railConfidence: number | null;
    launchScope: BuyerLaunchScope;
    active: boolean;
    contactRole: string | null;
    facilityPhone: string | null;
    website: string | null;
    contactName: string | null;
    email: string | null;
    verifiedStatus: BuyerVerifiedStatus;
    contactConfidenceScore: number | null;
    contactVerifiedAt: Date | null;
    contactLastCheckedAt: Date | null;
    buyerUpdatedAt: Date;
    contactUpdatedAt: Date | null;
    contactId: string | null;
}

interface DirectoryUpdatedRow extends QueryResultRow {
    directoryUpdatedAt: Date | null;
}

interface CountRow extends QueryResultRow {
    count: number;
}

function mapBuyerRow(row: BuyerRow): BuyerApiRecord {
    return {
        ...row,
        contactVerifiedAt: row.contactVerifiedAt?.toISOString() ?? null,
        contactLastCheckedAt: row.contactLastCheckedAt?.toISOString() ?? null,
        buyerUpdatedAt: row.buyerUpdatedAt.toISOString(),
        contactUpdatedAt: row.contactUpdatedAt?.toISOString() ?? null,
    };
}

function buildWhereClause(filters: BuyerListFilters) {
    const clauses: string[] = ['b.active = TRUE'];
    const params: unknown[] = [];

    if (filters.scope && filters.scope !== 'all') {
        params.push(filters.scope);
        clauses.push(`b.launch_scope = $${params.length}`);
    }
    if (filters.state) {
        params.push(filters.state.toUpperCase());
        clauses.push(`b.state = $${params.length}`);
    }
    if (filters.crop) {
        params.push(filters.crop);
        clauses.push(`b.crop_type = $${params.length}`);
    }
    if (filters.type) {
        params.push(filters.type);
        clauses.push(`b.type = $${params.length}`);
    }
    if (filters.region) {
        params.push(`%${filters.region}%`);
        clauses.push(`b.region ILIKE $${params.length}`);
    }
    if (filters.verifiedOnly) {
        clauses.push(`bc.verified_status = 'verified'`);
    }
    if (filters.search) {
        params.push(`%${filters.search}%`);
        const p = `$${params.length}`;
        clauses.push(`(
            b.name ILIKE ${p}
            OR b.city ILIKE ${p}
            OR b.state ILIKE ${p}
            OR b.region ILIKE ${p}
        )`);
    }

    return {
        sql: clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '',
        params,
    };
}

const BUYER_SELECT = `
    SELECT
        b.id,
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
        b.rail_confidence AS "railConfidence",
        b.launch_scope AS "launchScope",
        b.active,
        b.updated_at AS "buyerUpdatedAt",
        bc.id AS "contactId",
        bc.contact_role AS "contactRole",
        bc.facility_phone AS "facilityPhone",
        bc.website_url AS "website",
        bc.contact_name AS "contactName",
        bc.email,
        bc.verified_status AS "verifiedStatus",
        bc.confidence_score AS "contactConfidenceScore",
        bc.verified_at AS "contactVerifiedAt",
        bc.last_checked_at AS "contactLastCheckedAt",
        bc.updated_at AS "contactUpdatedAt"
    FROM buyers b
    LEFT JOIN buyer_contacts bc ON bc.buyer_id = b.id
`;

export async function listBuyers(filters: BuyerListFilters): Promise<{
    data: BuyerApiRecord[];
    count: number;
    directoryUpdatedAt: string | null;
}> {
    const { sql: whereSql, params } = buildWhereClause(filters);
    const limit = Math.min(Math.max(filters.limit ?? 500, 1), 2000);
    const offset = Math.max(filters.offset ?? 0, 0);

    const countQuery = `
        SELECT COUNT(*)::int AS count
        FROM buyers b
        LEFT JOIN buyer_contacts bc ON bc.buyer_id = b.id
        ${whereSql}
    `;
    const countResult = await dbQuery<CountRow>(countQuery, params);

    const dataQuery = `
        ${BUYER_SELECT}
        ${whereSql}
        ORDER BY
            CASE WHEN b.launch_scope = 'corridor' THEN 0 ELSE 1 END,
            b.state ASC,
            b.name ASC
        LIMIT $${params.length + 1}
        OFFSET $${params.length + 2}
    `;
    const dataResult = await dbQuery<BuyerRow>(dataQuery, [...params, limit, offset]);

    const directoryUpdatedQuery = `
        SELECT MAX(updated_ts) AS "directoryUpdatedAt"
        FROM (
            SELECT b.updated_at AS updated_ts
            FROM buyers b
            UNION ALL
            SELECT bc.updated_at AS updated_ts
            FROM buyer_contacts bc
        ) t
    `;
    const directoryResult = await dbQuery<DirectoryUpdatedRow>(directoryUpdatedQuery);

    return {
        data: dataResult.rows.map(mapBuyerRow),
        count: countResult.rows[0]?.count ?? 0,
        directoryUpdatedAt: directoryResult.rows[0]?.directoryUpdatedAt?.toISOString() ?? null,
    };
}

export async function getBuyerById(id: string): Promise<BuyerApiRecord | null> {
    const result = await dbQuery<BuyerRow>(
        `
            ${BUYER_SELECT}
            WHERE b.id = $1 AND b.active = TRUE
            LIMIT 1
        `,
        [id]
    );
    const row = result.rows[0];
    return row ? mapBuyerRow(row) : null;
}

export async function getBuyerByExternalSeedKey(externalSeedKey: string): Promise<BuyerApiRecord | null> {
    const result = await dbQuery<BuyerRow>(
        `
            ${BUYER_SELECT}
            WHERE b.external_seed_key = $1 AND b.active = TRUE
            LIMIT 1
        `,
        [externalSeedKey]
    );
    const row = result.rows[0];
    return row ? mapBuyerRow(row) : null;
}

export async function getBuyerProvenanceSummary(buyerId: string): Promise<{
    provenanceCount: number;
    latestSources: Array<{
        sourceType: string;
        sourceRef: string | null;
        observedPhone: string | null;
        observedWebsite: string | null;
        matchScore: number | null;
        createdAt: string;
    }>;
}> {
    const result = await dbQuery<{
        sourceType: string;
        sourceRef: string | null;
        observedPhone: string | null;
        observedWebsite: string | null;
        matchScore: number | null;
        createdAt: Date;
        provenanceCount: number;
    }>(
        `
            WITH contact AS (
                SELECT id
                FROM buyer_contacts
                WHERE buyer_id = $1
                LIMIT 1
            ),
            count_cte AS (
                SELECT COUNT(*)::int AS provenance_count
                FROM buyer_contact_provenance
                WHERE buyer_contact_id IN (SELECT id FROM contact)
            )
            SELECT
                p.source_type AS "sourceType",
                p.source_ref AS "sourceRef",
                p.observed_phone AS "observedPhone",
                p.observed_website AS "observedWebsite",
                p.match_score AS "matchScore",
                p.created_at AS "createdAt",
                c.provenance_count AS "provenanceCount"
            FROM count_cte c
            LEFT JOIN buyer_contact_provenance p
                ON p.buyer_contact_id IN (SELECT id FROM contact)
            ORDER BY p.created_at DESC NULLS LAST
            LIMIT 5
        `,
        [buyerId]
    );

    const provenanceCount = result.rows[0]?.provenanceCount ?? 0;
    const latestSources = result.rows
        .filter((row) => row.createdAt)
        .map((row) => ({
            sourceType: row.sourceType,
            sourceRef: row.sourceRef,
            observedPhone: row.observedPhone,
            observedWebsite: row.observedWebsite,
            matchScore: row.matchScore,
            createdAt: row.createdAt.toISOString(),
        }));

    return { provenanceCount, latestSources };
}
