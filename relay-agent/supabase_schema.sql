-- ==============================================================================
-- MaraPlus Relay Agent - Supabase Database Schema & Realtime Setup
-- Ejecutar este script en el SQL Editor de su proyecto Supabase Cloud.
-- ==============================================================================

-- 1. Tabla de Cola de Relevo (Relay_Queue)
CREATE TABLE IF NOT EXISTS public."Relay_Queue" (
    id BIGSERIAL PRIMARY KEY,
    "SkuCode" VARCHAR(100) NOT NULL,
    "DepositCode" VARCHAR(50) NOT NULL,
    "Status" VARCHAR(20) NOT NULL DEFAULT 'Pending', -- 'Pending', 'Processing', 'Completed', 'Failed'
    
    -- Campos retornados por la API física de MaraPlus
    stock_quantity NUMERIC(14, 4) DEFAULT 0,
    ventas_dia NUMERIC(14, 4) DEFAULT 0,
    precio_base NUMERIC(14, 4) DEFAULT 0,
    impuesto_porcentaje NUMERIC(6, 2) DEFAULT 0,
    
    -- Diagnóstico y telemetría
    response_payload JSONB DEFAULT NULL,
    error_message TEXT DEFAULT NULL,
    processed_at TIMESTAMPTZ DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices optimizados para consulta FIFO y filtrado por estado
CREATE INDEX IF NOT EXISTS idx_relay_queue_status_created 
    ON public."Relay_Queue" ("Status", "created_at" ASC);

CREATE INDEX IF NOT EXISTS idx_relay_queue_sku 
    ON public."Relay_Queue" ("SkuCode");

-- 2. Tabla de Panel de Control Administrativo (Read_Admin_Control_Panel)
CREATE TABLE IF NOT EXISTS public."Read_Admin_Control_Panel" (
    id BIGSERIAL PRIMARY KEY,
    "RateLimitDelayMs" INTEGER NOT NULL DEFAULT 300 CHECK ("RateLimitDelayMs" >= 200 AND "RateLimitDelayMs" <= 2000),
    is_active BOOLEAN NOT NULL DEFAULT true,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes TEXT DEFAULT 'Delay inter-peticiones en milisegundos para MaraPlus On-Premise Relay Agent'
);

-- Insertar configuración inicial por defecto si está vacía
INSERT INTO public."Read_Admin_Control_Panel" (id, "RateLimitDelayMs", is_active, notes)
VALUES (1, 300, true, 'Configuración estándar: 300ms entre llamadas, lote de 10 peticiones, 2000ms cooldown')
ON CONFLICT (id) DO NOTHING;

-- 3. Habilitar Replicación en Tiempo Real (Supabase Realtime)
-- Permite que el Relay Agent reciba eventos INSERT vía WebSocket
ALTER PUBLICATION supabase_realtime ADD TABLE public."Relay_Queue";
ALTER PUBLICATION supabase_realtime ADD TABLE public."Read_Admin_Control_Panel";

-- 4. Seguridad de Nivel de Fila (Row Level Security - RLS)
ALTER TABLE public."Relay_Queue" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Read_Admin_Control_Panel" ENABLE ROW LEVEL SECURITY;

-- Política para que el Service Role (usado por el agente Docker) tenga acceso total
CREATE POLICY "Full access for service role" ON public."Relay_Queue"
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Read access for service role on control panel" ON public."Read_Admin_Control_Panel"
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Política de lectura para usuarios autenticados (opcional para frontends)
CREATE POLICY "Allow authenticated read" ON public."Relay_Queue"
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated read on control panel" ON public."Read_Admin_Control_Panel"
    FOR SELECT
    TO authenticated
    USING (true);
