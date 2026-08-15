-- Seed data for demo: one product with stock=1 (single item = easy race)
CREATE TABLE IF NOT EXISTS inventory (
    product_id   VARCHAR(50) PRIMARY KEY,
    name         VARCHAR(255) NOT NULL,
    stock        INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS orders (
    order_id    VARCHAR(50) PRIMARY KEY,
    user_id     VARCHAR(50) NOT NULL,
    product_id  VARCHAR(50) NOT NULL,
    status      VARCHAR(50) NOT NULL DEFAULT 'CREATED',
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Insert the contested product
INSERT INTO inventory (product_id, name, stock)
VALUES ('PRODUCT_X', 'Limited Edition Widget', 1)
ON CONFLICT (product_id) DO UPDATE SET stock = 1;

-- Snapshot store schema (for orchestrator)
CREATE TABLE IF NOT EXISTS snapshots (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    snapshot_id   VARCHAR(100) UNIQUE NOT NULL,
    service_id    VARCHAR(100) NOT NULL,
    trace_id      VARCHAR(100) NOT NULL,
    vector_clock  JSONB NOT NULL,
    storage_key   VARCHAR(255),
    schema_version INTEGER NOT NULL DEFAULT 1,
    sequence_num  BIGSERIAL,
    captured_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS snapshot_causal_order (
    id              BIGSERIAL PRIMARY KEY,
    session_id      VARCHAR(100) NOT NULL,
    causal_position INTEGER NOT NULL,
    snapshot_id     VARCHAR(100) NOT NULL,
    UNIQUE(session_id, snapshot_id)
);
CREATE INDEX IF NOT EXISTS idx_causal_order_session
    ON snapshot_causal_order(session_id, causal_position);

CREATE TABLE IF NOT EXISTS replay_sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      VARCHAR(100) UNIQUE NOT NULL,
    status          VARCHAR(50) NOT NULL DEFAULT 'CREATED',
    start_vc        JSONB,
    end_vc          JSONB,
    services        TEXT[],
    replay_trace    JSONB,
    rca_report      JSONB,
    error_message   TEXT,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Projection checkpoint
CREATE TABLE IF NOT EXISTS projection_checkpoint (
    id              INTEGER PRIMARY KEY DEFAULT 1,
    last_sequence   BIGINT NOT NULL DEFAULT 0
);
INSERT INTO projection_checkpoint (id, last_sequence) VALUES (1, 0)
    ON CONFLICT DO NOTHING;
