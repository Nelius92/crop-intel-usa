import crypto from 'crypto';
import { dbQuery, withDbTransaction } from '../db/pool.js';
import { searchGooglePlaces, fetchGooglePlaceDetails, type GooglePlaceCandidate, type GooglePlaceDetails } from './google-places.js';
import { normalizeWebsite, verifyWebsiteForBuyer } from './website-verification.js';

type ReviewReason = 'no_place_match' | 'multiple_matches' | 'domain_mismatch' | 'phone_missing';
type VerifiedStatus = 'verified' | 'needs_review' | 'unverified';

interface SyncCandidateRow {
    buyerId: string;
    name: string;
    type: string;
    city: string;
    state: string;
    lat: number;
    lng: number;
    contactId: string | null;
    currentVerifiedStatus: VerifiedStatus | null;
    currentPhone: string | null;
    currentWebsite: string | null;
    lastCheckedAt: Date | null;
}

export interface BuyerContactSyncSummary {
    syncRunId: string;
    startedAt: string;
    endedAt: string;
    processedCount: number;
    updatedCount: number;
    reviewCount: number;
    errorCount: number;
    skippedVerifiedCount: number;
    status: 'success' | 'partial' | 'failed';
    sampleErrors: string[];
}

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeName(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function nameScore(buyerName: string, candidateName: string): number {
    const buyerTokens = new Set(normalizeName(buyerName).split(' ').filter((t) => t.length >= 3));
    const candidateTokens = new Set(normalizeName(candidateName).split(' ').filter((t) => t.length >= 3));
    if (buyerTokens.size === 0 || candidateTokens.size === 0) return 0;

    let overlap = 0;
    for (const token of buyerTokens) {
        if (candidateTokens.has(token)) overlap++;
    }
    const ratio = overlap / Math.max(buyerTokens.size, 1);
    return Math.round(ratio * 40);
}

function haversineMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const toRad = (d: number) => (d * Math.PI) / 180;
    const R = 3959;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function distanceScore(buyer: SyncCandidateRow, candidate: GooglePlaceCandidate): number {
    if (candidate.lat == null || candidate.lng == null) return 0;
    const miles = haversineMiles(buyer.lat, buyer.lng, candidate.lat, candidate.lng);
    if (miles <= 1) return 30;
    if (miles <= 5) return 25;
    if (miles <= 15) return 18;
    if (miles <= 30) return 10;
    if (miles <= 60) return 5;
    return 0;
}

function typeKeywordScore(buyerType: string, candidateName: string): number {
    const candidate = candidateName.toLowerCase();
    const map: Record<string, string[]> = {
        ethanol: ['ethanol', 'biofuel', 'bio'],
        feedlot: ['feed', 'cattle', 'livestock'],
        processor: ['milling', 'foods', 'processing', 'grain'],
        export: ['export', 'terminal', 'port'],
        shuttle: ['terminal', 'shuttle', 'grain'],
        transload: ['transload', 'logistics', 'intermodal'],
        crush: ['crush', 'soy'],
        elevator: ['grain', 'elevator', 'co-op', 'coop', 'cooperative'],
        river: ['river', 'terminal', 'port'],
    };
    const keywords = map[buyerType] ?? [];
    return keywords.some((k) => candidate.includes(k)) ? 15 : 0;
}

function classifyConfidence(score: number): VerifiedStatus {
    if (score >= 90) return 'verified';
    if (score >= 70) return 'needs_review';
    return 'unverified';
}

function payloadHash(value: unknown): string {
    return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

async function createSyncRun(): Promise<{ id: string; startedAt: Date }> {
    const result = await dbQuery<{ id: string; startedAt: Date }>(
        `
            INSERT INTO sync_runs (
                job_type, status, started_at, summary_json
            ) VALUES (
                'buyer_contact_sync', 'running', NOW(), '{}'::jsonb
            )
            RETURNING id, started_at AS "startedAt"
        `
    );
    return result.rows[0];
}

async function finalizeSyncRun(
    syncRunId: string,
    summary: Omit<BuyerContactSyncSummary, 'syncRunId' | 'startedAt' | 'endedAt'>
): Promise<void> {
    await dbQuery(
        `
            UPDATE sync_runs
            SET
                ended_at = NOW(),
                status = $2,
                processed_count = $3,
                updated_count = $4,
                review_count = $5,
                error_count = $6,
                summary_json = $7::jsonb
            WHERE id = $1
        `,
        [
            syncRunId,
            summary.status,
            summary.processedCount,
            summary.updatedCount,
            summary.reviewCount,
            summary.errorCount,
            JSON.stringify(summary),
        ]
    );
}

async function fetchSyncCandidates(limit: number, staleDays: number): Promise<SyncCandidateRow[]> {
    const result = await dbQuery<SyncCandidateRow>(
        `
            SELECT
                b.id AS "buyerId",
                b.name,
                b.type,
                b.city,
                b.state,
                b.lat,
                b.lng,
                bc.id AS "contactId",
                bc.verified_status AS "currentVerifiedStatus",
                bc.facility_phone AS "currentPhone",
                bc.website_url AS "currentWebsite",
                bc.last_checked_at AS "lastCheckedAt"
            FROM buyers b
            LEFT JOIN buyer_contacts bc ON bc.buyer_id = b.id
            WHERE
                b.active = TRUE
                AND b.launch_scope = 'corridor'
                AND (
                    bc.id IS NULL
                    OR bc.last_checked_at IS NULL
                    OR bc.last_checked_at < NOW() - ($1::text || ' days')::interval
                    OR bc.verified_status <> 'verified'
                )
            ORDER BY b.state, b.name
            LIMIT $2
        `,
        [String(staleDays), limit]
    );
    return result.rows;
}

async function enqueueReview(
    buyerId: string,
    reasonCode: ReviewReason,
    candidateJson: unknown
): Promise<void> {
    await withDbTransaction(async (client) => {
        const existing = await client.query<{ id: string }>(
            `
                SELECT id
                FROM buyer_review_queue
                WHERE buyer_id = $1 AND reason_code = $2 AND status = 'open'
                LIMIT 1
            `,
            [buyerId, reasonCode]
        );

        if ((existing.rowCount ?? 0) > 0) {
            await client.query(
                `
                    UPDATE buyer_review_queue
                    SET candidate_json = $3::jsonb
                    WHERE id = $1
                `,
                [existing.rows[0].id, reasonCode, JSON.stringify(candidateJson)]
            );
            return;
        }

        await client.query(
            `
                INSERT INTO buyer_review_queue (buyer_id, reason_code, candidate_json, status)
                VALUES ($1, $2, $3::jsonb, 'open')
            `,
            [buyerId, reasonCode, JSON.stringify(candidateJson)]
        );
    });
}

async function upsertContactFromSync(args: {
    buyer: SyncCandidateRow;
    details: GooglePlaceDetails;
    verifiedStatus: VerifiedStatus;
    confidenceScore: number;
    websiteVerified: boolean;
    placeScorePayload: unknown;
    syncRunId: string;
}): Promise<{ updated: boolean; queuedReview: boolean }> {
    const normalizedWebsite = normalizeWebsite(args.details.website);
    const facilityPhone = args.details.phone?.trim() || null;
    const nowNeedsReview = args.verifiedStatus === 'needs_review';
    const shouldQueueLowConfidence = args.verifiedStatus === 'unverified';

    if (!facilityPhone || !normalizedWebsite) {
        await enqueueReview(args.buyer.buyerId, 'phone_missing', {
            syncRunId: args.syncRunId,
            placeId: args.details.placeId,
            proposedPhone: facilityPhone,
            proposedWebsite: normalizedWebsite,
            score: args.confidenceScore,
        });
        return { updated: false, queuedReview: true };
    }

    if (shouldQueueLowConfidence) {
        await enqueueReview(args.buyer.buyerId, 'multiple_matches', {
            syncRunId: args.syncRunId,
            placeId: args.details.placeId,
            proposedPhone: facilityPhone,
            proposedWebsite: normalizedWebsite,
            score: args.confidenceScore,
        });
        return { updated: false, queuedReview: true };
    }

    if (!args.websiteVerified && args.confidenceScore < 90) {
        await enqueueReview(args.buyer.buyerId, 'domain_mismatch', {
            syncRunId: args.syncRunId,
            placeId: args.details.placeId,
            proposedPhone: facilityPhone,
            proposedWebsite: normalizedWebsite,
            score: args.confidenceScore,
        });
        return { updated: false, queuedReview: true };
    }

    const result = await withDbTransaction(async (client) => {
        const existingContact = await client.query<{
            id: string;
            verifiedStatus: VerifiedStatus;
        }>(
            `
                SELECT id, verified_status AS "verifiedStatus"
                FROM buyer_contacts
                WHERE buyer_id = $1
                LIMIT 1
            `,
            [args.buyer.buyerId]
        );

        const existing = existingContact.rows[0];
        if (existing?.verifiedStatus === 'verified' && args.confidenceScore < 90) {
            return { updated: false, contactId: existing.id };
        }

        const contactRole = args.buyer.type === 'transload' ? 'Operations' : 'Grain Desk';

        const upsert = await client.query<{ id: string }>(
            `
                INSERT INTO buyer_contacts (
                    buyer_id, contact_role, facility_phone, website_url,
                    verified_status, verified_at, verification_method,
                    confidence_score, last_checked_at, notes
                ) VALUES (
                    $1, $2, $3, $4,
                    $5, CASE WHEN $5 = 'verified' THEN NOW() ELSE NULL END, $6,
                    $7, NOW(), $8
                )
                ON CONFLICT (buyer_id) DO UPDATE
                SET
                    contact_role = EXCLUDED.contact_role,
                    facility_phone = EXCLUDED.facility_phone,
                    website_url = EXCLUDED.website_url,
                    verified_status = EXCLUDED.verified_status,
                    verified_at = CASE
                        WHEN EXCLUDED.verified_status = 'verified' THEN NOW()
                        ELSE buyer_contacts.verified_at
                    END,
                    verification_method = EXCLUDED.verification_method,
                    confidence_score = EXCLUDED.confidence_score,
                    last_checked_at = NOW(),
                    notes = EXCLUDED.notes
                RETURNING id
            `,
            [
                args.buyer.buyerId,
                contactRole,
                facilityPhone,
                normalizedWebsite,
                nowNeedsReview ? 'needs_review' : 'verified',
                args.websiteVerified ? 'website_verified' : 'google_places',
                args.confidenceScore,
                `Auto-synced via Google Places (run ${args.syncRunId})`,
            ]
        );

        const contactId = upsert.rows[0].id;

        const provenancePayload = {
            syncRunId: args.syncRunId,
            placeScore: args.placeScorePayload,
            details: args.details,
            websiteVerified: args.websiteVerified,
        };
        const hash = payloadHash(provenancePayload);

        const existingProv = await client.query(
            `
                SELECT 1
                FROM buyer_contact_provenance
                WHERE buyer_contact_id = $1
                  AND source_type = 'google_places'
                  AND payload_hash = $2
                LIMIT 1
            `,
            [contactId, hash]
        );

        if ((existingProv.rowCount ?? 0) === 0) {
            await client.query(
                `
                    INSERT INTO buyer_contact_provenance (
                        buyer_contact_id, source_type, source_ref,
                        observed_phone, observed_website, match_score,
                        payload_hash, payload_json
                    ) VALUES (
                        $1, 'google_places', $2,
                        $3, $4, $5,
                        $6, $7::jsonb
                    )
                `,
                [
                    contactId,
                    args.details.placeId,
                    facilityPhone,
                    normalizedWebsite,
                    args.confidenceScore,
                    hash,
                    JSON.stringify(provenancePayload),
                ]
            );
        }

        return { updated: true, contactId };
    });

    if (nowNeedsReview) {
        await enqueueReview(args.buyer.buyerId, 'multiple_matches', {
            syncRunId: args.syncRunId,
            placeId: args.details.placeId,
            proposedPhone: facilityPhone,
            proposedWebsite: normalizedWebsite,
            score: args.confidenceScore,
        });
        return { updated: result.updated, queuedReview: true };
    }

    return { updated: result.updated, queuedReview: false };
}

function scorePlaceCandidate(
    buyer: SyncCandidateRow,
    candidate: GooglePlaceCandidate
): { score: number; breakdown: Record<string, number> } {
    const breakdown = {
        name: nameScore(buyer.name, candidate.name),
        distance: distanceScore(buyer, candidate),
        state: candidate.formattedAddress?.toLowerCase().includes(buyer.state.toLowerCase()) ? 10 : 0,
        city: candidate.formattedAddress?.toLowerCase().includes(buyer.city.toLowerCase()) ? 5 : 0,
        type: typeKeywordScore(buyer.type, candidate.name),
    };
    const score = Object.values(breakdown).reduce((sum, value) => sum + value, 0);
    return { score, breakdown };
}

export async function runBuyerContactSync(options?: {
    limit?: number;
    staleDays?: number;
    delayMs?: number;
}): Promise<BuyerContactSyncSummary> {
    const limit = Math.min(Math.max(options?.limit ?? 500, 1), 2000);
    const staleDays = Math.min(Math.max(options?.staleDays ?? 30, 1), 365);
    const delayMs = Math.min(Math.max(options?.delayMs ?? 150, 0), 5000);

    const syncRun = await createSyncRun();
    const sampleErrors: string[] = [];

    let processedCount = 0;
    let updatedCount = 0;
    let reviewCount = 0;
    let errorCount = 0;
    let skippedVerifiedCount = 0;

    try {
        const buyers = await fetchSyncCandidates(limit, staleDays);

        for (const buyer of buyers) {
            processedCount++;
            try {
                const query = `${buyer.name} ${buyer.city} ${buyer.state}`;
                const candidates = await searchGooglePlaces(query);

                if (candidates.length === 0) {
                    await enqueueReview(buyer.buyerId, 'no_place_match', {
                        syncRunId: syncRun.id,
                        query,
                    });
                    reviewCount++;
                    if (delayMs > 0) await sleep(delayMs);
                    continue;
                }

                const scored = candidates.map((candidate) => ({
                    candidate,
                    ...scorePlaceCandidate(buyer, candidate),
                })).sort((a, b) => b.score - a.score);

                const top = scored[0];
                const second = scored[1];

                if (second && top.score - second.score <= 8 && top.score < 95) {
                    await enqueueReview(buyer.buyerId, 'multiple_matches', {
                        syncRunId: syncRun.id,
                        query,
                        candidates: scored.slice(0, 3).map((item) => ({
                            placeId: item.candidate.placeId,
                            name: item.candidate.name,
                            formattedAddress: item.candidate.formattedAddress,
                            score: item.score,
                            breakdown: item.breakdown,
                        })),
                    });
                    reviewCount++;
                    if (delayMs > 0) await sleep(delayMs);
                    continue;
                }

                const details = await fetchGooglePlaceDetails(top.candidate.placeId);
                const websiteCheck = await verifyWebsiteForBuyer(buyer.name, details.website);
                const finalScore = Math.max(0, Math.min(100, top.score + websiteCheck.scoreAdjustment));
                const verifiedStatus = classifyConfidence(finalScore);

                const result = await upsertContactFromSync({
                    buyer,
                    details,
                    verifiedStatus,
                    confidenceScore: finalScore,
                    websiteVerified: websiteCheck.ok,
                    placeScorePayload: {
                        query,
                        selectedCandidate: top.candidate,
                        selectedScore: top.score,
                        selectedBreakdown: top.breakdown,
                        websiteCheck,
                    },
                    syncRunId: syncRun.id,
                });

                if (result.updated) updatedCount++;
                if (result.queuedReview) reviewCount++;
                if (!result.updated && !result.queuedReview && buyer.currentVerifiedStatus === 'verified') {
                    skippedVerifiedCount++;
                }
            } catch (error) {
                errorCount++;
                const message = `${buyer.name} (${buyer.city}, ${buyer.state}): ${error instanceof Error ? error.message : String(error)}`;
                sampleErrors.push(message);
                if (sampleErrors.length > 10) sampleErrors.shift();
            }

            if (delayMs > 0) {
                await sleep(delayMs);
            }
        }

        const status: BuyerContactSyncSummary['status'] =
            errorCount === 0 ? 'success' : updatedCount > 0 || reviewCount > 0 ? 'partial' : 'failed';

        const endedAt = new Date();
        const summary: BuyerContactSyncSummary = {
            syncRunId: syncRun.id,
            startedAt: syncRun.startedAt.toISOString(),
            endedAt: endedAt.toISOString(),
            processedCount,
            updatedCount,
            reviewCount,
            errorCount,
            skippedVerifiedCount,
            status,
            sampleErrors,
        };

        await finalizeSyncRun(syncRun.id, {
            processedCount,
            updatedCount,
            reviewCount,
            errorCount,
            skippedVerifiedCount,
            status,
            sampleErrors,
        });

        return summary;
    } catch (error) {
        errorCount++;
        const endedAt = new Date();
        const status: BuyerContactSyncSummary['status'] = 'failed';
        const summary: BuyerContactSyncSummary = {
            syncRunId: syncRun.id,
            startedAt: syncRun.startedAt.toISOString(),
            endedAt: endedAt.toISOString(),
            processedCount,
            updatedCount,
            reviewCount,
            errorCount,
            skippedVerifiedCount,
            status,
            sampleErrors: [
                ...sampleErrors,
                error instanceof Error ? error.message : String(error),
            ].slice(-10),
        };

        await finalizeSyncRun(syncRun.id, {
            processedCount,
            updatedCount,
            reviewCount,
            errorCount,
            skippedVerifiedCount,
            status,
            sampleErrors: summary.sampleErrors,
        });

        throw error;
    }
}
