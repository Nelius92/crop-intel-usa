-- Migration 003: Add cash bid columns for daily Firecrawl pipeline
-- Run: npm run migrate

ALTER TABLE buyers ADD COLUMN IF NOT EXISTS cash_bid NUMERIC(6,2);
ALTER TABLE buyers ADD COLUMN IF NOT EXISTS posted_basis NUMERIC(6,2);
ALTER TABLE buyers ADD COLUMN IF NOT EXISTS bid_date DATE;
ALTER TABLE buyers ADD COLUMN IF NOT EXISTS bid_source TEXT;

-- Index for finding stale bids
CREATE INDEX IF NOT EXISTS idx_buyers_bid_date ON buyers(bid_date);

-- Table to log pipeline runs
CREATE TABLE IF NOT EXISTS bid_pipeline_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    states_scraped INTEGER NOT NULL DEFAULT 0,
    total_bids_found INTEGER NOT NULL DEFAULT 0,
    matched INTEGER NOT NULL DEFAULT 0,
    updated INTEGER NOT NULL DEFAULT 0,
    unmatched_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    errors_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    status TEXT NOT NULL DEFAULT 'running'
        CHECK (status IN ('running', 'success', 'partial', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_bid_pipeline_runs_started_at
    ON bid_pipeline_runs(started_at DESC);
