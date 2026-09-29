import React from 'react';
import { Network, ShieldCheck, Cpu, HardDrive, ArrowRight, Zap, CheckCircle2 } from 'lucide-react';

export const ArchitectureDoc: React.FC = () => {
  return (
    <div className="space-y-8 max-w-5xl">
      {/* Overview & Mission */}
      <div className="p-6 bg-slate-900 border border-slate-800 rounded-lg space-y-4">
        <h2 className="text-lg font-semibold text-white tracking-tight flex items-center gap-2.5">
          <Network className="w-5 h-5 text-emerald-400" />
          Arquitectura del Agente On-Premise Relay
        </h2>
        <p className="text-sm text-slate-300 leading-relaxed">
          Este agente actúa como puente seguro y unidireccional entre la base de datos en la nube (<strong>Supabase Cloud</strong>) 
          y los servidores físicos locales de inventario (<strong>MaraPlus API en LAN</strong>). Permite que aplicaciones web o móviles consulten 
          y sincronicen existencias en tiempo real sin necesidad de abrir puertos entrantes en el firewall perimetral de la empresa ni exponer la IP pública de la sucursal.
        </p>
      </div>

      {/* Network Topology Visualizer */}
      <div className="p-6 bg-slate-900 border border-slate-800 rounded-lg space-y-6">
        <h3 className="text-sm font-semibold text-white uppercase tracking-wider text-slate-200">
          Topología de Red & Flujo de Datos
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 relative">
          {/* Node 1: Cloud */}
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-mono">Nube WAN</span>
              <ShieldCheck className="w-4 h-4 text-sky-400" />
            </div>
            <div className="text-sm font-semibold text-white">Supabase Cloud</div>
            <ul className="text-xs text-slate-400 space-y-1.5 font-sans">
              <li>· Tabla <code className="text-slate-200 font-mono">Relay_Queue</code> (INSERT Status='Pending')</li>
              <li>· Tabla <code className="text-slate-200 font-mono">Read_Admin_Control_Panel</code></li>
              <li>· Replicación en tiempo real por WebSockets (WSS)</li>
            </ul>
          </div>

          {/* Node 2: On-Premise Relay Agent */}
          <div className="p-4 bg-slate-950 border-2 border-emerald-500/40 rounded-lg space-y-3 shadow-lg shadow-emerald-950/20">
            <div className="flex items-center justify-between text-xs text-emerald-400 font-medium">
              <span className="font-mono">LAN On-Premise</span>
              <Cpu className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-sm font-semibold text-white">Relay Agent (Docker Node.js)</div>
            <ul className="text-xs text-slate-400 space-y-1.5 font-sans">
              <li>· Suscripción persistente WebSocket entrante</li>
              <li>· Cursor FIFO con eliminación de duplicados</li>
              <li>· Lote estricto de máx 10 peticiones</li>
              <li>· Cooldown de 2000ms obligatorio</li>
            </ul>
          </div>

          {/* Node 3: Physical MaraPlus Server */}
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-mono">LAN Física</span>
              <HardDrive className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-sm font-semibold text-white">MaraPlus Physical API</div>
            <ul className="text-xs text-slate-400 space-y-1.5 font-sans">
              <li>· Host: <code className="text-slate-200 font-mono">192.168.15.225:3002</code></li>
              <li>· Endpoint: <code className="text-slate-200 font-mono">/api/inventory</code></li>
              <li>· Parámetros: SkuCode, Deposito, onlyOffers</li>
              <li>· Retorna existencias, ventas día, precio base</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Strict Anti-Saturation Algorithm Breakdown */}
      <div className="p-6 bg-slate-900 border border-slate-800 rounded-lg space-y-4">
        <h3 className="text-sm font-semibold text-white uppercase tracking-wider text-slate-200 flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-400" />
          Mecanismo Anti-Saturación Strict
        </h3>

        <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
          <div className="p-3 bg-slate-950 rounded border border-slate-800/80 space-y-1">
            <div className="font-semibold text-white">1. Cola FIFO en Memoria con Cursor Secuencial</div>
            <p className="text-slate-400">
              Los eventos WebSocket recibidos desde Supabase se encolan secuencialmente. 
              Si ocurre una ráfaga masiva (ej. 100 consultas simultáneas al abrir la tienda), el agente las almacena en memoria y nunca satura la API local con llamadas concurrentes.
            </p>
          </div>

          <div className="p-3 bg-slate-950 rounded border border-slate-800/80 space-y-1">
            <div className="font-semibold text-white">2. RateLimitDelayMs Dinámico (200ms - 2000ms)</div>
            <p className="text-slate-400">
              Antes de cada petición consecutiva dentro del lote, el agente consulta la tabla <code className="text-slate-300 font-mono">Read_Admin_Control_Panel</code>. 
              El valor se valida estrictamente dentro del rango 200ms a 2000ms (default 300ms). Esto permite a los administradores acelerar o ralentizar el agente en vivo sin reiniciar el contenedor.
            </p>
          </div>

          <div className="p-3 bg-slate-950 rounded border border-slate-800/80 space-y-1">
            <div className="font-semibold text-white">3. Lote Estricto de 10 Peticiones & Cooldown de 2000ms</div>
            <p className="text-slate-400">
              Un contador interno registra las llamadas consecutivas hacia MaraPlus. Al alcanzar exactamente <strong>10 peticiones</strong>, 
              la ejecución se suspende obligatoriamente por <strong>2000 ms</strong>:
            </p>
            <div className="bg-slate-900 p-2 rounded font-mono text-[11px] text-amber-300">
              await new Promise(r =&gt; setTimeout(r, 2000));
            </div>
            <p className="text-slate-400 mt-1">
              Esto garantiza que el motor de base de datos de MaraPlus en el servidor local no experimente bloqueos de tablas ni consumo excesivo de CPU.
            </p>
          </div>

          <div className="p-3 bg-slate-950 rounded border border-slate-800/80 space-y-1">
            <div className="font-semibold text-white">4. Actualización Atómica y Resiliente en Supabase</div>
            <p className="text-slate-400">
              Una vez recibido el payload de MaraPlus, el agente actualiza la fila en <code className="text-slate-300 font-mono">Relay_Queue</code>:
              <br />
              <code className="text-emerald-400 font-mono">Status = 'Completed'</code>, almacenando de forma atómica: 
              <code className="text-slate-200 font-mono"> stock_quantity, ventas_dia, precio_base, impuesto_porcentaje</code>.
            </p>
          </div>
        </div>
      </div>

      {/* Network Configuration Tip for DevOps */}
      <div className="p-6 bg-slate-900 border border-slate-800 rounded-lg space-y-4">
        <h3 className="text-sm font-semibold text-white uppercase tracking-wider text-slate-200">
          Nota Técnica Crítica de Despliegue en Red LAN
        </h3>
        
        <div className="p-4 bg-amber-950/20 border border-amber-800/40 rounded-lg text-xs text-amber-200 leading-relaxed space-y-2">
          <p className="font-semibold">
            ¿Por qué se utiliza <code className="text-amber-100 font-mono">network_mode: host</code> en docker-compose.yml?
          </p>
          <p className="text-amber-300/80">
            En entornos Docker sobre Linux (Ubuntu, Debian, Alpine), el modo de red por defecto (<code className="text-amber-100 font-mono">bridge</code>) 
            aíslan el contenedor en una subred virtual (como <code className="text-amber-100 font-mono">172.17.0.0/16</code>). 
            Para que el agente pueda enrutar paquetes directamente hacia la IP física <code className="text-amber-100 font-mono">192.168.15.225</code> 
            en el puerto <code className="text-amber-100 font-mono">3002</code>, el uso de <code className="text-amber-100 font-mono">network_mode: host</code> 
            es la solución más confiable, evitando problemas de NAT y ruteo local.
          </p>
        </div>
      </div>
    </div>
  );
};
