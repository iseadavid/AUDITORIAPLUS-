/**
 * AUDITORIAPLUS+ Architecture & Mobile PWA Cockpit
 * React + TypeScript + PWA Offline Resilience (IndexedDB 'idb' & Zustand)
 */

import React, { useState } from 'react';
import { Header, ActiveNavTab } from './components/Header';
import { AuditorApp } from './components/auditor/AuditorApp';
import { AdminDashboardLayout } from './components/admin/AdminDashboardLayout';
import { OfflinePwaCockpit } from './components/OfflinePwaCockpit';
import { EdgeFunctionsConsole } from './components/EdgeFunctionsConsole';
import { Simulator } from './components/Simulator';
import { CodeViewer } from './components/CodeViewer';
import { ArchitectureDoc } from './components/ArchitectureDoc';
import { UserCheck, Smartphone, Shield } from 'lucide-react';
import { useAuditStore } from './store/useAuditStore';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveNavTab>('auditor-pwa');
  const { isOffline, activeQueueCount } = useAuditStore();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500/20 selection:text-emerald-300">
      {/* 3-Zone Header Contract */}
      <Header activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Content Area */}
      {activeTab === 'auditor-pwa' ? (
        <AuditorApp />
      ) : (
        <main className={`flex-1 w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 ${activeTab === 'admin-desktop' ? 'max-w-[1920px]' : 'max-w-7xl'}`}>
          {/* Contextual Sub-Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
                <span>{activeTab === 'admin-desktop' ? 'Panel de Control Superusuario (Desktop 1920x1080)' : 'AUDITORIAPLUS+ Mobile Client & PWA'}</span>
                <span className="text-xs font-mono font-medium text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded">
                  {activeTab === 'admin-desktop' ? 'M0-M4 Suite Forense & Live Control' : 'IndexedDB (idb) + Zustand + Service Worker'}
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-3xl">
                {activeTab === 'admin-desktop'
                  ? 'Monitor en caliente de latencia y rate-limiting, ingesta estática con hash SHA-256 deduplicado, gestión forense de overrides, traslados virtuales (150104) y analítica con 4 gráficos.'
                  : 'Capa base offline-first con 3 almacenes IndexedDB (missions_cache, sku_master_local, offline_events_queue), sincronizador secuencial causal por timestamp_utc y gestión de conflictos HTTP 409.'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 self-start sm:self-auto bg-slate-900 border border-slate-800 p-1 rounded-lg">
              <button
                onClick={() => setActiveTab('admin-desktop')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'admin-desktop'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold'
                    : 'text-amber-400 hover:bg-slate-800'
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Panel Superusuario</span>
              </button>

              <button
                onClick={() => setActiveTab('auditor-pwa')}
                className="px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer flex items-center gap-1.5 text-emerald-400 hover:bg-slate-800"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>App Auditor PWA</span>
              </button>

              <button
                onClick={() => setActiveTab('offline-pwa')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'offline-pwa'
                    ? 'bg-slate-800 text-white shadow-sm font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>IndexedDB Explorer</span>
                {activeQueueCount > 0 && (
                  <span className="text-[10px] font-mono font-bold bg-amber-500 text-slate-950 px-1.5 py-0.2 rounded-full">
                    {activeQueueCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('edge-functions')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  activeTab === 'edge-functions'
                    ? 'bg-slate-800 text-white shadow-sm font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Edge Functions
              </button>

              <button
                onClick={() => setActiveTab('relay-simulator')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  activeTab === 'relay-simulator'
                    ? 'bg-slate-800 text-white shadow-sm font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Relay Agent
              </button>

              <button
                onClick={() => setActiveTab('code')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  activeTab === 'code'
                    ? 'bg-slate-800 text-white shadow-sm font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Código TypeScript
              </button>
            </div>
          </div>

          {/* Tab Viewport */}
          {activeTab === 'admin-desktop' && <AdminDashboardLayout />}
          {activeTab === 'offline-pwa' && <OfflinePwaCockpit />}
          {activeTab === 'edge-functions' && <EdgeFunctionsConsole />}
          {activeTab === 'relay-simulator' && <Simulator />}
          {activeTab === 'code' && <CodeViewer />}
          {activeTab === 'architecture' && <ArchitectureDoc />}
        </main>
      )}

      {/* Clean Uncluttered Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-3.5 px-6 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-mono text-[11px]">
            <span>AUDITORIAPLUS+ PWA Suite</span>
            <span>·</span>
            <span>Header #263988</span>
            <span>·</span>
            <span>CTA #009045</span>
            <span>·</span>
            <span>Fondo #F8F9FA</span>
          </div>
          <div className="font-mono text-[11px] text-slate-400 flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${isOffline ? 'bg-amber-400' : 'bg-emerald-400'}`} />
            <span>{isOffline ? 'OFFLINE (IndexedDB Buffer)' : 'ONLINE (Conectado)'}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
