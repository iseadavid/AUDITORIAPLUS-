-- ==============================================================================
-- AUDITORIAPLUS+ Schema DDL & Inmutable EventStore (Supabase PostgreSQL)
-- ==============================================================================

-- 1. Tabla Inmutable EventStore (Event Sourcing)
CREATE TABLE IF NOT EXISTS public."EventStore" (
    id BIGSERIAL PRIMARY KEY,
    event_type VARCHAR(100) NOT NULL,
    aggregate_type VARCHAR(50) NOT NULL, -- 'MissionTask', 'VirtualTransfer', 'AdminConfig', 'InventorySku'
    aggregate_id VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    emitted_by VARCHAR(100) NOT NULL DEFAULT 'system',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para consulta ultra-rápida de eventos por agregado y tipo
CREATE INDEX IF NOT EXISTS idx_eventstore_aggregate ON public."EventStore" (aggregate_type, aggregate_id);
CREATE INDEX IF NOT EXISTS idx_eventstore_created_at ON public."EventStore" (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_eventstore_type ON public."EventStore" (event_type);

-- Restricción inmutable: No permitir UPDATE ni DELETE en EventStore
CREATE OR REPLACE FUNCTION prevent_eventstore_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'EventStore es una tabla estrictamente inmutable (append-only). Las operaciones UPDATE y DELETE están prohibidas.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_eventstore_mutation ON public."EventStore";
CREATE TRIGGER trg_prevent_eventstore_mutation
BEFORE UPDATE OR DELETE ON public."EventStore"
FOR EACH ROW EXECUTE FUNCTION prevent_eventstore_mutation();

-- 2. Tabla Read_Mission_Tasks (Tareas de Conteo de Misión)
CREATE TABLE IF NOT EXISTS public."Read_Mission_Tasks" (
    id BIGSERIAL PRIMARY KEY,
    mission_id VARCHAR(50) NOT NULL,
    sku_code VARCHAR(100) NOT NULL,
    sku_name VARCHAR(255) DEFAULT NULL,
    deposit_code VARCHAR(50) NOT NULL, -- Ej: '150101' (Almacén), '150103' (Piso)
    status VARCHAR(50) NOT NULL DEFAULT 'Pending_Count', 
    -- 'Pending_Count', 'In_Progress', 'Reconciled_Match', 'Discrepancy_Pending_Review', 'Overridden', 'Completed'
    
    -- Variables del Cálculo Matemático:
    system_quantity NUMERIC(14, 4) NOT NULL DEFAULT 0, -- S (Stock teórico ERP)
    sales_during_audit NUMERIC(14, 4) NOT NULL DEFAULT 0, -- V (Ventas del día durante auditoría)
    counted_quantity NUMERIC(14, 4) DEFAULT NULL, -- C (Conteo físico)
    delta_real NUMERIC(14, 4) DEFAULT NULL, -- ΔReal = C - (S - V)
    
    is_locked BOOLEAN NOT NULL DEFAULT false,
    auditor_id VARCHAR(100) DEFAULT NULL,
    override_reason TEXT DEFAULT NULL,
    forced_quantity NUMERIC(14, 4) DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mission_tasks_mission_sku ON public."Read_Mission_Tasks" (mission_id, sku_code);
CREATE INDEX IF NOT EXISTS idx_mission_tasks_status ON public."Read_Mission_Tasks" (status);

-- 3. Tabla Read_Virtual_Transfers (Compensaciones Virtuales & Nodo 150104)
CREATE TABLE IF NOT EXISTS public."Read_Virtual_Transfers" (
    id BIGSERIAL PRIMARY KEY,
    mission_id VARCHAR(50) NOT NULL,
    sku_code VARCHAR(100) NOT NULL,
    from_deposit VARCHAR(50) NOT NULL, -- Depósito origen con sobrante (+Δ)
    to_deposit VARCHAR(50) NOT NULL, -- Depósito destino con faltante (-Δ)
    quantity_to_move NUMERIC(14, 4) NOT NULL,
    transit_deposit VARCHAR(50) NOT NULL DEFAULT '150104', -- Nodo de Tránsito Virtual
    status VARCHAR(50) NOT NULL DEFAULT 'Suggested', 
    -- 'Suggested', 'Pending_ERP_Confirmation', 'Executed', 'Rejected', 'Cancelled'
    suggested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sent_to_erp_at TIMESTAMPTZ DEFAULT NULL,
    confirmed_at TIMESTAMPTZ DEFAULT NULL,
    erp_movement_id VARCHAR(100) DEFAULT NULL,
    notes TEXT DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_virtual_transfers_status ON public."Read_Virtual_Transfers" (status);
CREATE INDEX IF NOT EXISTS idx_virtual_transfers_mission ON public."Read_Virtual_Transfers" (mission_id, sku_code);

-- 4. Tabla Relay_Queue (Cola de Relevo para el Relay Agent LAN)
CREATE TABLE IF NOT EXISTS public."Relay_Queue" (
    id BIGSERIAL PRIMARY KEY,
    "SkuCode" VARCHAR(100) NOT NULL,
    "DepositCode" VARCHAR(50) NOT NULL,
    "Status" VARCHAR(20) NOT NULL DEFAULT 'Pending', -- 'Pending', 'Processing', 'Completed', 'Failed'
    stock_quantity NUMERIC(14, 4) DEFAULT 0,
    ventas_dia NUMERIC(14, 4) DEFAULT 0,
    precio_base NUMERIC(14, 4) DEFAULT 0,
    impuesto_porcentaje NUMERIC(6, 2) DEFAULT 0,
    response_payload JSONB DEFAULT NULL,
    error_message TEXT DEFAULT NULL,
    processed_at TIMESTAMPTZ DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_relay_queue_fifo ON public."Relay_Queue" ("Status", "created_at" ASC);

-- 5. Tabla Read_Admin_Control_Panel
CREATE TABLE IF NOT EXISTS public."Read_Admin_Control_Panel" (
    id BIGSERIAL PRIMARY KEY,
    "RateLimitDelayMs" INTEGER NOT NULL DEFAULT 300 CHECK ("RateLimitDelayMs" >= 200 AND "RateLimitDelayMs" <= 2000),
    is_active BOOLEAN NOT NULL DEFAULT true,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes TEXT DEFAULT 'Delay inter-peticiones en ms'
);

INSERT INTO public."Read_Admin_Control_Panel" (id, "RateLimitDelayMs", is_active)
VALUES (1, 300, true)
ON CONFLICT (id) DO UPDATE SET "RateLimitDelayMs" = EXCLUDED."RateLimitDelayMs";

-- 6. Habilitar Replicación Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public."Read_Mission_Tasks";
ALTER PUBLICATION supabase_realtime ADD TABLE public."Read_Virtual_Transfers";
ALTER PUBLICATION supabase_realtime ADD TABLE public."EventStore";
ALTER PUBLICATION supabase_realtime ADD TABLE public."Relay_Queue";
ALTER PUBLICATION supabase_realtime ADD TABLE public."Read_Admin_Control_Panel";

-- 7. Datos de Prueba Iniciales (Demostración de Caso Real)
-- Misión MIS-2026-001 con SKU 7591001234567:
-- Depósito 150101 (Almacén Central): Faltante de -5 unidades
-- Depósito 150103 (Piso de Venta): Sobrante de +6 unidades
-- Compensación hacia Nodo 150104
INSERT INTO public."Read_Mission_Tasks" 
    (mission_id, sku_code, sku_name, deposit_code, status, system_quantity, sales_during_audit, counted_quantity, delta_real, is_locked)
VALUES
    ('MIS-2026-001', '7591001234567', 'Amoxicilina 500mg x 10 Cáps', '150101', 'Discrepancy_Pending_Review', 25, 0, 20, -5, true),
    ('MIS-2026-001', '7591001234567', 'Amoxicilina 500mg x 10 Cáps', '150103', 'Discrepancy_Pending_Review', 12, 2, 16, 6, true),
    ('MIS-2026-001', '7592004567891', 'Ibuprofeno 400mg x 20 Tab', '150101', 'Pending_Count', 50, 4, NULL, NULL, false),
    ('MIS-2026-001', '7593009876543', 'Paracetamol 650mg x 10 Tab', '150103', 'Reconciled_Match', 30, 5, 25, 0, false)
ON CONFLICT DO NOTHING;
