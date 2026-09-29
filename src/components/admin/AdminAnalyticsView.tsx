/**
 * M4: Analítica de Misión (/admin/analitica)
 * AUDITORIAPLUS+ Superuser Desktop Cockpit (1920x1080)
 * 
 * Renderiza con Recharts los 4 gráficos obligatorios:
 * 1. Grafo 1: Curva S de Avance (Líneas Teórico vs Real vs Reconciliado)
 * 2. Grafo 2: Heatmap / Treemap de Discrepancias (Por volumen financiero en USD)
 * 3. Grafo 3: Histograma Divergente de Errores (Barras de varianza -10 a +10 con eje cero central)
 * 4. Grafo 4: Rendimiento Operativo vs Latencia (Área de escaneos/min vs Línea de latencia ms)
 */

import React, { useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  Cell,
  ReferenceLine,
  ComposedChart,
  Area,
  Treemap
} from 'recharts';
import { 
  BarChart3, 
  TrendingUp, 
  DollarSign, 
  Activity, 
  Layers, 
  Calendar,
  Zap,
  Info
} from 'lucide-react';

// ==============================================================================
// 1. DATA: Curva S de Avance (Horas de jornada de auditoría)
// ==============================================================================
const S_CURVE_DATA = [
  { time: '08:00', teorico: 0, real: 0, reconciliado: 0 },
  { time: '09:00', teorico: 25, real: 18, reconciliado: 18 },
  { time: '10:00', teorico: 55, real: 42, reconciliado: 40 },
  { time: '11:00', teorico: 90, real: 75, reconciliado: 72 },
  { time: '12:00', teorico: 120, real: 105, reconciliado: 100 },
  { time: '13:00', teorico: 135, real: 115, reconciliado: 112 },
  { time: '14:00', teorico: 155, real: 140, reconciliado: 138 },
  { time: '15:00', teorico: 180, real: 172, reconciliado: 168 },
  { time: '16:00', teorico: 200, real: 195, reconciliado: 192 },
  { time: '17:00', teorico: 210, real: 208, reconciliado: 206 },
];

// ==============================================================================
// 2. DATA: Heatmap / Treemap de Discrepancias por Volumen Financiero ($ USD)
// ==============================================================================
const DISCREPANCY_HEATMAP_DATA = [
  { name: 'Antibióticos (Almacén 150101)', size: 1850, category: 'Antibióticos', fill: '#ef4444', items: 28 },
  { name: 'Oncología & Biológicos (Galpón 150107)', size: 1420, category: 'Especializados', fill: '#f97316', items: 8 },
  { name: 'Gastroenterología (Piso 150103)', size: 980, category: 'Gastro', fill: '#f59e0b', items: 35 },
  { name: 'Cardiovascular (Almacén 150101)', size: 760, category: 'Cardio', fill: '#eab308', items: 19 },
  { name: 'Analgésicos & AINEs (Piso 150103)', size: 620, category: 'Analgésicos', fill: '#10b981', items: 42 },
  { name: 'Dermatología (Avería 150102)', size: 430, category: 'Derma', fill: '#06b6d4', items: 14 },
  { name: 'Suplementos & Vitaminas (Galpón 150107)', size: 310, category: 'Nutrición', fill: '#8b5cf6', items: 22 },
  { name: 'Material Médico Descartable (Piso 150103)', size: 210, category: 'Insumos', fill: '#64748b', items: 50 },
];

// ==============================================================================
// 3. DATA: Histograma Divergente de Errores (Varianza -10 a +10)
// ==============================================================================
const DIVERGENT_VARIANCE_DATA = [
  { varianza: '-10', frecuencia: 1, delta: -10 },
  { varianza: '-8', frecuencia: 2, delta: -8 },
  { varianza: '-6', frecuencia: 4, delta: -6 },
  { varianza: '-5', frecuencia: 5, delta: -5 },
  { varianza: '-4', frecuencia: 8, delta: -4 },
  { varianza: '-3', frecuencia: 12, delta: -3 },
  { varianza: '-2', frecuencia: 24, delta: -2 },
  { varianza: '-1', frecuencia: 48, delta: -1 },
  { varianza: '0 (Match)', frecuencia: 165, delta: 0 }, // Centro exacto
  { varianza: '+1', frecuencia: 42, delta: 1 },
  { varianza: '+2', frecuencia: 20, delta: 2 },
  { varianza: '+3', frecuencia: 11, delta: 3 },
  { varianza: '+4', frecuencia: 7, delta: 4 },
  { varianza: '+5', frecuencia: 6, delta: 5 },
  { varianza: '+6', frecuencia: 3, delta: 6 },
  { varianza: '+8', frecuencia: 2, delta: 8 },
  { varianza: '+10', frecuencia: 1, delta: 10 },
];

// ==============================================================================
// 4. DATA: Rendimiento Operativo vs Latencia (Escaneos/min vs Latencia ms)
// ==============================================================================
const PERFORMANCE_LATENCY_DATA = [
  { time: '08:00', escaneosMin: 12, latenciaMs: 38 },
  { time: '09:00', escaneosMin: 45, latenciaMs: 42 },
  { time: '10:00', escaneosMin: 68, latenciaMs: 58 },
  { time: '11:00', escaneosMin: 85, latenciaMs: 76 },
  { time: '12:00', escaneosMin: 52, latenciaMs: 45 },
  { time: '13:00', escaneosMin: 30, latenciaMs: 39 },
  { time: '14:00', escaneosMin: 74, latenciaMs: 64 },
  { time: '15:00', escaneosMin: 92, latenciaMs: 82 },
  { time: '16:00', escaneosMin: 78, latenciaMs: 60 },
  { time: '17:00', escaneosMin: 35, latenciaMs: 40 },
];

export const AdminAnalyticsView: React.FC = () => {
  const [selectedHeatmapItem, setSelectedHeatmapItem] = useState<any>(null);

  return (
    <div className="space-y-6">
      {/* Route & Sub-header */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-blue-400 bg-blue-950/60 border border-blue-800/60 px-2 py-0.5 rounded">
              M4: ANALÍTICA DE MISIÓN
            </span>
            <span className="text-slate-600">·</span>
            <span className="text-xs font-mono text-slate-400">/admin/analitica</span>
            <span className="text-slate-600">·</span>
            <span className="text-xs text-slate-400 font-mono">4 Gráficos Especializados Recharts</span>
          </div>
          <h2 className="text-xl font-bold text-white mt-1">
            Inteligencia Forense y Rendimiento Operativo de Auditoría
          </h2>
          <p className="text-xs text-slate-400">
            Monitoreo multidimensional del progreso físico, impacto financiero por categoría, normalidad estadística de varianzas y correlación de latencia de red.
          </p>
        </div>

        {/* Global Summary Badge */}
        <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 px-4 py-2 rounded-xl self-start xl:self-auto">
          <div className="text-right font-mono">
            <div className="text-[10px] text-slate-400 uppercase">Avance Global Misión</div>
            <div className="text-base font-black text-emerald-400">98.1% Reconciliado</div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* 2x2 High Density Analytics Grid (1920x1080 optimized) */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        
        {/* ==================================================================== */}
        {/* GRAFO 1: Curva S de Avance (Teórico vs Real vs Reconciliado)          */}
        {/* ==================================================================== */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  <span>Grafo 1: Curva S de Avance Físico</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Líneas acumuladas: Teórico ERP vs Real Físico vs Reconciliado en Sistema
                </p>
              </div>
              <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
                Líneas Acumuladas
              </span>
            </div>

            <div className="h-72 w-full pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={S_CURVE_DATA} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="time" stroke="#64748b" fontSize={11} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#020617', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                    labelStyle={{ color: '#94a3b8', fontFamily: 'monospace' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Line 
                    type="monotone" 
                    dataKey="teorico" 
                    name="Teórico Proyectado" 
                    stroke="#94a3b8" 
                    strokeWidth={2} 
                    strokeDasharray="4 4"
                    dot={{ r: 3 }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="real" 
                    name="Conteo Real Físico" 
                    stroke="#38bdf8" 
                    strokeWidth={2.5} 
                    dot={{ r: 3.5 }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="reconciliado" 
                    name="Reconciliado Exacto (Match)" 
                    stroke="#009045" 
                    strokeWidth={3} 
                    dot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="mt-2 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono text-slate-400">
            <span>Objetivo turno: 210 tareas</span>
            <span className="text-emerald-400">Divergencia final: 0.95% (Excelente)</span>
          </div>
        </div>

        {/* ==================================================================== */}
        {/* GRAFO 2: Heatmap de Discrepancias (Treemap por volumen financiero $) */}
        {/* ==================================================================== */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-rose-400" />
                  <span>Grafo 2: Heatmap de Discrepancias por Categoría</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Mapa de calor y volumen financiero en riesgo ($ USD) desglosado por depósito
                </p>
              </div>
              <span className="text-[11px] font-mono text-rose-400 bg-rose-950 px-2 py-0.5 rounded border border-rose-800">
                Total: $6,580 USD
              </span>
            </div>

            {/* Interactive Grid Representation of Heatmap/Treemap */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-4">
              {DISCREPANCY_HEATMAP_DATA.map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => setSelectedHeatmapItem(item)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                    selectedHeatmapItem?.name === item.name
                      ? 'border-white ring-2 ring-white/20 bg-slate-800 shadow-md'
                      : 'border-slate-800 bg-slate-950 hover:border-slate-700'
                  }`}
                  style={{ borderLeftColor: item.fill, borderLeftWidth: '4px' }}
                >
                  <div className="space-y-1">
                    <div className="text-[10px] font-mono uppercase text-slate-400 line-clamp-1">{item.category}</div>
                    <div className="text-xs font-bold text-white line-clamp-2 leading-tight">{item.name}</div>
                  </div>
                  <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-baseline justify-between font-mono">
                    <span className="text-sm font-black text-rose-400">${item.size.toLocaleString()}</span>
                    <span className="text-[10px] text-slate-500">{item.items} uds</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
            <span className="text-slate-400">
              {selectedHeatmapItem ? (
                <span className="text-white font-mono">
                  Seleccionado: <strong>{selectedHeatmapItem.name}</strong> · Impacto: ${selectedHeatmapItem.size} USD ({selectedHeatmapItem.items} unidades)
                </span>
              ) : (
                <span>Toca una celda para ver el detalle de auditoría por categoría</span>
              )}
            </span>
            <span className="text-rose-400 font-mono text-[11px]">85% concentrado en Almacén</span>
          </div>
        </div>

        {/* ==================================================================== */}
        {/* GRAFO 3: Histograma Divergente de Errores (Varianza -10 a +10)        */}
        {/* ==================================================================== */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-amber-400" />
                  <span>Grafo 3: Histograma Divergente de Errores (ΔReal)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Distribución estadística de varianzas físicas de $-10$ a $+10$ con punto cero (Match)
                </p>
              </div>
              <span className="text-[11px] font-mono text-amber-400 bg-amber-950 px-2 py-0.5 rounded border border-amber-800">
                165 Matches Exactos
              </span>
            </div>

            <div className="h-72 w-full pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={DIVERGENT_VARIANCE_DATA} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="varianza" stroke="#64748b" fontSize={10} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#020617', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                    formatter={(value: any) => [`${value} ítems`, 'Frecuencia']}
                    labelStyle={{ color: '#cbd5e1', fontFamily: 'monospace' }}
                  />
                  <ReferenceLine x="0 (Match)" stroke="#009045" strokeWidth={2} label={{ value: 'Centro (Δ=0)', fill: '#009045', fontSize: 10 }} />
                  <Bar dataKey="frecuencia" radius={[4, 4, 0, 0]}>
                    {DIVERGENT_VARIANCE_DATA.map((entry, index) => {
                      let color = '#f59e0b';
                      if (entry.delta === 0) color = '#009045'; // Exact Match
                      else if (entry.delta < 0) color = '#ef4444'; // Faltante
                      else if (entry.delta > 0) color = '#3b82f6'; // Sobrante
                      return <Cell key={`cell-${index}`} fill={color} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="mt-2 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              <span>Rojo: Faltante (-Δ)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#009045]" />
              <span>Verde: Match Exacto (Δ=0)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              <span>Azul: Sobrante (+Δ)</span>
            </span>
          </div>
        </div>

        {/* ==================================================================== */}
        {/* GRAFO 4: Rendimiento Operativo vs Latencia (Área vs Línea ms)        */}
        {/* ==================================================================== */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Activity className="w-4 h-4 text-purple-400" />
                  <span>Grafo 4: Rendimiento Operativo vs Latencia de Red</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Área de escaneos/minuto (eje izq) combinada con Línea de latencia LAN en ms (eje der)
                </p>
              </div>
              <span className="text-[11px] font-mono text-purple-400 bg-purple-950 px-2 py-0.5 rounded border border-purple-800">
                Pico: 92 escaneos/min
              </span>
            </div>

            <div className="h-72 w-full pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={PERFORMANCE_LATENCY_DATA} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="time" stroke="#64748b" fontSize={11} tickLine={false} />
                  <YAxis yAxisId="left" stroke="#8b5cf6" fontSize={11} tickLine={false} />
                  <YAxis yAxisId="right" orientation="right" stroke="#f59e0b" fontSize={11} tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#020617', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                    labelStyle={{ color: '#cbd5e1', fontFamily: 'monospace' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="escaneosMin"
                    name="Escaneos / Minuto"
                    fill="#8b5cf6"
                    fillOpacity={0.25}
                    stroke="#8b5cf6"
                    strokeWidth={2}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="latenciaMs"
                    name="Latencia MaraPlus (ms)"
                    stroke="#f59e0b"
                    strokeWidth={2.5}
                    dot={{ r: 3.5 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="mt-2 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono text-slate-400">
            <span>Tasa de saturación: Normal</span>
            <span className="text-amber-400">Sin estrangulamiento térmico ni descarte de paquetes</span>
          </div>
        </div>

      </div>
    </div>
  );
};
