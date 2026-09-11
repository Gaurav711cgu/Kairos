-- Seed data for production demo: realistic product catalog + contested race item
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

-- Insert realistic production product catalog
INSERT INTO inventory (product_id, name, stock)
VALUES 
    ('PRODUCT_X', 'Limited Edition AI Accelerator Card', 1),
    ('PROD_LAPTOP_01', 'Developer Workstation Pro 16', 45),
    ('PROD_MONITOR_02', '4K Ultra-Wide IPS Display', 120),
    ('PROD_KEYBOARD_03', 'Low-Profile Mechanical Keyboard', 250),
    ('PROD_MOUSE_04', 'Ergonomic Precision Wireless Mouse', 310),
    ('PROD_HEADSET_05', 'Active Noise-Cancelling Headset', 85),
    ('PROD_DOCK_06', 'Thunderbolt 4 Quad-Display Dock', 60),
    ('PROD_SERVER_07', '1U Rackmount Edge Compute Node', 12),
    ('PROD_ROUTER_08', 'Enterprise 10GbE Core Router', 8),
    ('PROD_CABLE_09', 'Cat6A Shielded Patch Cable 2m', 1500)
ON CONFLICT (product_id) DO UPDATE SET stock = EXCLUDED.stock;

-- Insert historical baseline orders
INSERT INTO orders (order_id, user_id, product_id, status, created_at)
VALUES
    ('ord-hist-101', 'user-001', 'PROD_LAPTOP_01', 'COMPLETED', CURRENT_TIMESTAMP - INTERVAL '2 hours'),
    ('ord-hist-102', 'user-002', 'PROD_MONITOR_02', 'COMPLETED', CURRENT_TIMESTAMP - INTERVAL '90 minutes'),
    ('ord-hist-103', 'user-003', 'PROD_KEYBOARD_03', 'COMPLETED', CURRENT_TIMESTAMP - INTERVAL '45 minutes'),
    ('ord-hist-104', 'user-004', 'PROD_HEADSET_05', 'COMPLETED', CURRENT_TIMESTAMP - INTERVAL '20 minutes')
ON CONFLICT (order_id) DO NOTHING;

-- Snapshot store schema (for orchestrator)
CREATE TABLE IF NOT EXISTS snapshots (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    snapshot_id   VARCHAR(100) UNIQUE NOT NULL,
    service_id    VARCHAR(100) NOT NULL,
    trace_id      VARCHAR(100) NOT NULL,
    vector_clock  JSONB NOT NULL,
    storage_key   VARCHAR(255),
    method        VARCHAR(20),
    path          VARCHAR(500),
    request_headers JSONB,
    request_body  TEXT,
    response_status INTEGER,
    response_headers JSONB,
    response_body TEXT,
    latency_ms    BIGINT,
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
