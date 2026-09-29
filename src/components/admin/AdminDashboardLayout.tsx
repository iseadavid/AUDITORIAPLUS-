/**
 * AUDITORIAPLUS+ Desktop Administration Cockpit (1920x1080)
 * Rol Superusuario
 * 
 * Sub-modules:
 * - M0: Dashboard Live (/admin/live-control)
 * - M1: Ingesta Estática con Merge Engine y Hash SHA-256 (/admin/ingesta)
 * - M2: Overrides (/admin/overrides)
 * - M3: Traslados Virtuales (/admin/traslados)
 * - M4: Analítica de Misión (/admin/analitica)
 */

import React from 'react';
import { useAuditStore, AdminTab } from '../../store/useAuditStore';
import { AdminLiveControlView } from './AdminLiveControlView';
import { AdminIngestionView } from './AdminIngestionView';
import { AdminOverridesView } from './AdminOverridesView';
import { AdminVirtualTransfersView } from './AdminVirtualTransfersView';
import { AdminAnalyticsView } from './AdminAnalyticsView';
import { 
  Activity, 
  UploadCloud, 
  ShieldAlert, 
  GitCompare, 
  BarChart3, 
  Shield, 
  Terminal, 
  Cpu, 
  Radio, 
  Layers 
} from 'lucide-react';

export const AdminDashboardLayout: React.FC = () => {
  const { activeAdminTab, setAdminTab, rateLimitDelayMs } = useAuditStore();

  const navigationItems: Array<{
    id: AdminTab;
    label: string;
    route: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string;
  }> = [
    {
      id: 'live-control',
      label: 'M0: Live Control',
      route: '/admin/live-control',
      icon: Activity,
      badge: `${rateLimitDelayMs}ms`,
    },
    {
      id: 'ingesta',
      label: 'M1: Ingesta & Hash SHA-256',
      route: '/admin/ingesta',
      icon: UploadCloud,
    },
    {
      id: 'overrides',
      label: 'M2: Overrides & Desbloqueos',
      route: '/admin/overrides',
      icon: ShieldAlert,
    },
    {
      id: 'traslados',
      label: 'M3: Traslados Virtuales 150104',
      route: '/admin/traslados',
      icon: GitCompare,
    },
    {
      id: 'analitica',
      label: 'M4: Analítica de Misión',
      route: '/admin/analitica',
      icon: BarChart3,
      badge: 'Recharts',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Superuser Cockpit Header Navigation Strip */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-2.5 shadow-md">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Module Tabs (Desktop 1920x1080 optimized) */}
          <div className="flex flex-wrap items-center gap-1.5">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeAdminTab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => setAdminTab(item.id)}
                  className={`px-3.5 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
                    isActive
                      ? 'bg-slate-800 text-white shadow-xs border border-slate-700 font-bold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-emerald-400' : 'text-slate-500'}`} />
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-950 text-slate-300 border border-slate-800">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Superuser Badge & Server State */}
          <div className="flex items-center gap-3 px-3 py-1 font-mono text-xs text-slate-400">
            <div className="flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-white font-bold">ROL SUPERUSUARIO</span>
            </div>
            <span>·</span>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-emerald-400 font-semibold">1920x1080 Cockpit</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main View Area */}
      <div className="transition-all">
        {activeAdminTab === 'live-control' && <AdminLiveControlView />}
        {activeAdminTab === 'ingesta' && <AdminIngestionView />}
        {activeAdminTab === 'overrides' && <AdminOverridesView />}
        {activeAdminTab === 'traslados' && <AdminVirtualTransfersView />}
        {activeAdminTab === 'analitica' && <AdminAnalyticsView />}
      </div>
    </div>
  );
};
