import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { runMigrations } from '../db/migrations.js';
import { closeDbPool, isDatabaseConfigured, withDbTransaction } from '../db/pool.js';
import { loadFacilitySeed, type FacilitySeedRecord } from '../seed/facilities.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CORRIDOR_STATES = new Set([
    'ND', 'MN', 'SD', 'IA', 'NE', 'KS',
    'TX', 'WA', 'OR', 'CA',
]);

interface GeneratedBuyerRow {
    id?: string;
    name: string;
    type: string;
    city: string;
    state: string;
    region?: string;
    railConfidence?: number;
    cropType?: string;
    organic?: boolean;
}

function normalizeKey(name: string, city: string, state: string, type: string): string {
    return [name, city, state, type]
        .map((part) => part.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''))
        .join('__');
}

function stableExternalSeedKey(facility: FacilitySeedRecord): string {
    return normalizeKey(facility.name, facility.city, facility.state, facility.type);
}

function resolveGeneratedBuyersPath(): string {
    const candidates = [
        path.resolve(process.cwd(), 'src/data/buyers.json'),
        path.resolve(__dirname, '../../../../src/data/buyers.json'),
    ];
    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) return candidate;
    }
    throw new Error(`Could not find generated buyers.json. Checked: ${candidates.join(', ')}`);
}

function loadGeneratedBuyerMap(): Map<string, GeneratedBuyerRow> {
    const generatedPath = resolveGeneratedBuyersPath();
    const generated = JSON.parse(fs.readFileSync(generatedPath, 'utf-8')) as GeneratedBuyerRow[];
    const map = new Map<string, GeneratedBuyerRow>();
    for (const buyer of generated) {
        map.set(normalizeKey(buyer.name, buyer.city, buyer.state, buyer.type), buyer);
    }
    return map;
}

function seedPayloadHash(facility: FacilitySeedRecord): string {
    return crypto
        .createHash('sha256')
        .update(JSON.stringify({
            phone: facility.phone ?? null,
            website: facility.website ?? null,
        }))
        .digest('hex');
}

async function main() {
    if (!isDatabaseConfigured()) {
        throw new Error('DATABASE_URL is required to run buyers:seed');
    }

    await runMigrations();

    const { path: seedPath, facilities } = loadFacilitySeed();
    const generatedBuyerMap = loadGeneratedBuyerMap();

    let buyersInsertedOrUpdated = 0;
    let contactsInsertedOrUpdated = 0;
    let seedProvenanceInserted = 0;

    await withDbTransaction(async (client) => {
        for (const facility of facilities) {
            const externalSeedKey = stableExternalSeedKey(facility);
            const generatedMatch = generatedBuyerMap.get(externalSeedKey);
            const launchScope = CORRIDOR_STATES.has(facility.state.toUpperCase()) ? 'corridor' : 'out_of_scope';
            const cropType = facility.cropType ?? generatedMatch?.cropType ?? 'Yellow Corn';
            const organic = Boolean(facility.organic ?? generatedMatch?.organic ?? false);
            const railConfidence = generatedMatch?.railConfidence ?? null;
            const contactRole = facility.type === 'transload' ? 'Operations' : 'Grain Desk';
            const facilityPhone = facility.phone?.trim() || null;
            const websiteUrl = facility.website?.trim() || null;

            const buyerResult = await client.query<{ id: string }>(
                `
                    INSERT INTO buyers (
                        external_seed_key, name, type, city, state, region, lat, lng,
                        crop_type, organic, rail_confidence, launch_scope, active
                    ) VALUES (
                        $1, $2, $3, $4, $5, $6, $7, $8,
                        $9, $10, $11, $12, TRUE
                    )
                    ON CONFLICT (external_seed_key) DO UPDATE
                    SET
                        name = EXCLUDED.name,
                        type = EXCLUDED.type,
                        city = EXCLUDED.city,
                        state = EXCLUDED.state,
                        region = EXCLUDED.region,
                        lat = EXCLUDED.lat,
                        lng = EXCLUDED.lng,
                        crop_type = EXCLUDED.crop_type,
                        organic = EXCLUDED.organic,
                        rail_confidence = EXCLUDED.rail_confidence,
                        launch_scope = EXCLUDED.launch_scope,
                        active = TRUE
                    RETURNING id
                `,
                [
                    externalSeedKey,
                    facility.name,
                    facility.type,
                    facility.city,
                    facility.state.toUpperCase(),
                    facility.region,
                    facility.lat,
                    facility.lng,
                    cropType,
                    organic,
                    railConfidence,
                    launchScope,
                ]
            );
            buyersInsertedOrUpdated++;

            const buyerId = buyerResult.rows[0].id;
            const hasSeedContactValue = Boolean(facilityPhone || websiteUrl);

            const contactResult = await client.query<{ id: string }>(
                `
                    INSERT INTO buyer_contacts (
                        buyer_id, contact_role, facility_phone, website_url,
                        verified_status, verification_method, notes
                    ) VALUES (
                        $1, $2, $3, $4,
                        'unverified',
                        $5,
                        $6
                    )
                    ON CONFLICT (buyer_id) DO UPDATE
                    SET
                        contact_role = EXCLUDED.contact_role,
                        facility_phone = COALESCE(buyer_contacts.facility_phone, EXCLUDED.facility_phone),
                        website_url = COALESCE(buyer_contacts.website_url, EXCLUDED.website_url),
                        verification_method = COALESCE(buyer_contacts.verification_method, EXCLUDED.verification_method),
                        notes = COALESCE(buyer_contacts.notes, EXCLUDED.notes)
                    RETURNING id
                `,
                [
                    buyerId,
                    contactRole,
                    facilityPhone,
                    websiteUrl,
                    hasSeedContactValue ? 'seed' : null,
                    hasSeedContactValue ? 'Seeded from curated facility list; requires verification' : 'No seed contact data; nightly sync required',
                ]
            );
            contactsInsertedOrUpdated++;

            if (hasSeedContactValue) {
                const buyerContactId = contactResult.rows[0].id;
                const payloadHash = seedPayloadHash(facility);

                const existing = await client.query<{ id: string }>(
                    `
                        SELECT id
                        FROM buyer_contact_provenance
                        WHERE buyer_contact_id = $1
                          AND source_type = 'seed'
                          AND payload_hash = $2
                        LIMIT 1
                    `,
                    [buyerContactId, payloadHash]
                );

                if (existing.rowCount === 0) {
                    await client.query(
                        `
                            INSERT INTO buyer_contact_provenance (
                                buyer_contact_id, source_type, source_ref,
                                observed_phone, observed_website, match_score,
                                payload_hash, payload_json
                            ) VALUES (
                                $1, 'seed', $2,
                                $3, $4, 100,
                                $5, $6::jsonb
                            )
                        `,
                        [
                            buyerContactId,
                            'curated-facilities-seed',
                            facilityPhone,
                            websiteUrl,
                            payloadHash,
                            JSON.stringify({
                                source: 'curated-facilities-seed',
                                externalSeedKey,
                                phone: facilityPhone,
                                website: websiteUrl,
                            }),
                        ]
                    );
                    seedProvenanceInserted++;
                }
            }
        }
    });

    console.log(`Seed file: ${seedPath}`);
    console.log(`Facilities processed: ${facilities.length}`);
    console.log(`Buyers upserted: ${buyersInsertedOrUpdated}`);
    console.log(`Contacts upserted: ${contactsInsertedOrUpdated}`);
    console.log(`Seed provenance inserted: ${seedProvenanceInserted}`);
}

main()
    .catch((error) => {
        console.error('buyers:seed failed:', error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await closeDbPool();
    });
