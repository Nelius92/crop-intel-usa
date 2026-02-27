CREATE TABLE IF NOT EXISTS buyer_cash_bid_observations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    buyer_id UUID NOT NULL REFERENCES buyers(id) ON DELETE CASCADE,
    crop_type TEXT NOT NULL DEFAULT 'Yellow Corn',
    source_kind TEXT NOT NULL CHECK (
        source_kind IN ('usda', 'website_html', 'website_pdf', 'manual', 'api')
    ),
    source_label TEXT,
    source_url TEXT,
    source_ref TEXT,
    observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    cash_bid NUMERIC(12, 4),
    basis NUMERIC(12, 4),
    futures_price NUMERIC(12, 4),
    confidence_score INTEGER CHECK (confidence_score >= 0 AND confidence_score <= 100),
    parsed_from_pdf BOOLEAN NOT NULL DEFAULT FALSE,
    raw_excerpt TEXT,
    raw_payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_buyer_cash_bid_obs_buyer_crop_observed
    ON buyer_cash_bid_observations (buyer_id, crop_type, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_buyer_cash_bid_obs_observed_at
    ON buyer_cash_bid_observations (observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_buyer_cash_bid_obs_source_kind
    ON buyer_cash_bid_observations (source_kind);

CREATE TABLE IF NOT EXISTS morning_recommendation_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_date DATE NOT NULL DEFAULT CURRENT_DATE,
    crop_type TEXT NOT NULL DEFAULT 'Yellow Corn',
    status TEXT NOT NULL CHECK (status IN ('running', 'success', 'partial', 'failed')),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    top_states TEXT[] NOT NULL DEFAULT '{}'::text[],
    source_summary_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    summary_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_morning_reco_runs_crop_date
    ON morning_recommendation_runs (crop_type, run_date DESC, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_morning_reco_runs_status
    ON morning_recommendation_runs (status);

CREATE TABLE IF NOT EXISTS morning_recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL REFERENCES morning_recommendation_runs(id) ON DELETE CASCADE,
    buyer_id UUID NOT NULL REFERENCES buyers(id) ON DELETE CASCADE,
    rank INTEGER NOT NULL CHECK (rank > 0),
    state TEXT NOT NULL,
    composite_score NUMERIC(12, 4) NOT NULL,
    cash_bid NUMERIC(12, 4),
    basis NUMERIC(12, 4),
    futures_price NUMERIC(12, 4),
    estimated_freight NUMERIC(12, 4),
    estimated_net_bid NUMERIC(12, 4),
    rail_confidence INTEGER CHECK (rail_confidence >= 0 AND rail_confidence <= 100),
    bid_source_kind TEXT CHECK (bid_source_kind IN ('usda', 'website_html', 'website_pdf', 'manual', 'api')),
    bid_source_label TEXT,
    bid_source_url TEXT,
    bid_observed_at TIMESTAMPTZ,
    rationale_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (run_id, buyer_id),
    UNIQUE (run_id, rank)
);

CREATE INDEX IF NOT EXISTS idx_morning_recos_run_rank
    ON morning_recommendations (run_id, rank);
CREATE INDEX IF NOT EXISTS idx_morning_recos_buyer
    ON morning_recommendations (buyer_id);
