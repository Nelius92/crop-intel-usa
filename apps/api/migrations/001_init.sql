CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS buyers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_seed_key TEXT UNIQUE,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    region TEXT NOT NULL,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    crop_type TEXT NOT NULL DEFAULT 'Yellow Corn',
    organic BOOLEAN NOT NULL DEFAULT FALSE,
    rail_confidence INTEGER,
    launch_scope TEXT NOT NULL DEFAULT 'out_of_scope'
        CHECK (launch_scope IN ('corridor', 'out_of_scope')),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_buyers_state ON buyers(state);
CREATE INDEX IF NOT EXISTS idx_buyers_crop_type ON buyers(crop_type);
CREATE INDEX IF NOT EXISTS idx_buyers_type ON buyers(type);
CREATE INDEX IF NOT EXISTS idx_buyers_launch_scope ON buyers(launch_scope);
CREATE INDEX IF NOT EXISTS idx_buyers_active ON buyers(active);
CREATE INDEX IF NOT EXISTS idx_buyers_name_trgm_placeholder ON buyers(name);

CREATE TABLE IF NOT EXISTS buyer_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    buyer_id UUID NOT NULL UNIQUE REFERENCES buyers(id) ON DELETE CASCADE,
    contact_role TEXT NOT NULL DEFAULT 'Grain Desk',
    facility_phone TEXT,
    website_url TEXT,
    contact_name TEXT,
    email TEXT,
    verified_status TEXT NOT NULL DEFAULT 'unverified'
        CHECK (verified_status IN ('verified', 'needs_review', 'unverified')),
    verified_at TIMESTAMPTZ,
    verification_method TEXT
        CHECK (verification_method IN ('seed', 'google_places', 'website_verified', 'manual_review')),
    confidence_score INTEGER CHECK (confidence_score >= 0 AND confidence_score <= 100),
    last_checked_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_buyer_contacts_verified_status ON buyer_contacts(verified_status);
CREATE INDEX IF NOT EXISTS idx_buyer_contacts_last_checked_at ON buyer_contacts(last_checked_at);

CREATE TABLE IF NOT EXISTS buyer_contact_provenance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    buyer_contact_id UUID NOT NULL REFERENCES buyer_contacts(id) ON DELETE CASCADE,
    source_type TEXT NOT NULL CHECK (source_type IN ('seed', 'google_places', 'website', 'manual')),
    source_ref TEXT,
    observed_phone TEXT,
    observed_website TEXT,
    match_score INTEGER CHECK (match_score >= 0 AND match_score <= 100),
    payload_hash TEXT,
    payload_json JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_buyer_contact_provenance_contact_id
    ON buyer_contact_provenance(buyer_contact_id);
CREATE INDEX IF NOT EXISTS idx_buyer_contact_provenance_created_at
    ON buyer_contact_provenance(created_at DESC);

CREATE TABLE IF NOT EXISTS sync_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_type TEXT NOT NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    status TEXT NOT NULL CHECK (status IN ('success', 'partial', 'failed', 'running')),
    processed_count INTEGER NOT NULL DEFAULT 0,
    updated_count INTEGER NOT NULL DEFAULT 0,
    review_count INTEGER NOT NULL DEFAULT 0,
    error_count INTEGER NOT NULL DEFAULT 0,
    summary_json JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_sync_runs_job_type_started_at
    ON sync_runs(job_type, started_at DESC);

CREATE TABLE IF NOT EXISTS buyer_review_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    buyer_id UUID NOT NULL REFERENCES buyers(id) ON DELETE CASCADE,
    reason_code TEXT NOT NULL CHECK (reason_code IN ('no_place_match', 'multiple_matches', 'domain_mismatch', 'phone_missing')),
    candidate_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'ignored')),
    resolved_by TEXT,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_buyer_review_queue_status ON buyer_review_queue(status);
CREATE INDEX IF NOT EXISTS idx_buyer_review_queue_buyer_id ON buyer_review_queue(buyer_id);

DROP TRIGGER IF EXISTS trg_buyers_set_updated_at ON buyers;
CREATE TRIGGER trg_buyers_set_updated_at
BEFORE UPDATE ON buyers
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_buyer_contacts_set_updated_at ON buyer_contacts;
CREATE TRIGGER trg_buyer_contacts_set_updated_at
BEFORE UPDATE ON buyer_contacts
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_buyer_review_queue_set_updated_at ON buyer_review_queue;
CREATE TRIGGER trg_buyer_review_queue_set_updated_at
BEFORE UPDATE ON buyer_review_queue
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
