# MaraPlus On-Premise Relay Agent

Agente relay en Node.js contenerizado con Docker diseñado para ejecutarse dentro de la red física local (LAN) de la empresa. Conecta **Supabase Cloud** con la API física local de **MaraPlus** (`http://192.168.15.225:3002`).

---

## 🚀 Arquitectura y Flujo de Datos

```
[ Supabase Cloud ] 
       │
       ▼ (WebSocket Realtime INSERT - Status='Pending')
[ On-Premise Relay Agent (Docker) ]
       │  - Cursor FIFO en memoria
       │  - RateLimitDelayMs dinámico (200ms - 2000ms, default 300ms) desde Read_Admin_Control_Panel
       │  - Lote estricto de máximo 10 peticiones
       │  - Cooldown obligatorio de 2000ms al completar cada lote
       ▼ (HTTP GET LAN)
[ MaraPlus API Física (192.168.15.225:3002) ]
       │
       ▼ (stock_quantity, ventas_dia, precio_base, impuesto_porcentaje)
[ On-Premise Relay Agent ]
       │
       ▼ (UPDATE Status='Completed')
[ Supabase Cloud Relay_Queue ]
```

---

## 🛠️ Requisitos Previos

1. Servidor físico o máquina virtual en la misma subred LAN (`192.168.15.x`) con Docker y Docker Compose instalados.
2. Acceso HTTP verificado hacia `http://192.168.15.225:3002/api/inventory`.
3. Proyecto activo en Supabase con las tablas creadas (ver `supabase_schema.sql`).

---

## ⚙️ Instalación Rápida con Docker Compose

### 1. Clonar o copiar los archivos al servidor local
Coloca los archivos en un directorio del servidor, por ejemplo `/opt/maraplus-relay`.

### 2. Configurar variables de entorno
Copia `.env.example` a `.env` y asigna tus credenciales de Supabase:

```bash
cp .env.example .env
nano .env
```

Configura:
```env
SUPABASE_URL="https://tu-proyecto.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOi..."
MARAPLUS_BASE_URL="http://192.168.15.225:3002"
MARAPLUS_TIMEOUT_MS=7000
```

### 3. Construir e iniciar el contenedor

```bash
# Construir imagen e iniciar en segundo plano
docker compose up -d --build

# Ver logs en tiempo real
docker compose logs -f maraplus-relay
```

---

## 🧪 Verificación de Funcionamiento

Para probar el flujo completo:

1. Ve a Supabase SQL Editor o Table Editor e inserta un registro:
```sql
INSERT INTO "Relay_Queue" ("SkuCode", "DepositCode", "Status")
VALUES ('7591001234567', 'DEP-01', 'Pending');
```

2. Observa la salida del log del contenedor:
```text
[INFO] [REALTIME-INSERT] Received new Pending job #1 via WebSocket.
[INFO] [BATCH 1/10] Processing Job #1 [SKU: 7591001234567, Deposito: DEP-01]
[INFO] Dispatching HTTP GET -> http://192.168.15.225:3002/api/inventory?search=7591001234567&deposito=DEP-01&onlyOffers=false
[INFO] [COMPLETED] Job #1 -> SKU: 7591001234567 | Stock: 42 | Ventas Día: 5 | Precio Base: $14.50 | Impuesto: 16%
```

3. Si insertas 15 registros de golpe, observarás:
- Procesamiento de los primeros 10 con retraso `RateLimitDelayMs` (default 300ms).
- Pausa estricta obligatoria de **2000 ms** (`await new Promise(r => setTimeout(r, 2000))`).
- Procesamiento de los 5 restantes.
