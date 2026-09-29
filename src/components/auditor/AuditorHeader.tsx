import React from 'react';
import { useAuditStore, AuditorTab } from '../../store/useAuditStore';
import { getAuditorTier } from '../../utils/auditFormulas';
import { 
  Flame, 
  Wifi, 
  WifiOff, 
  Trophy, 
  Clock, 
  Scan, 
  Building2, 
  User 
} from 'lucide-react';
import { PWAInstallButton } from '../PWAInstallButton';

export const AuditorHeader: React.FC = () => {
  const { 
    userAuth, 
    userXP, 
    currentStreak, 
    isOffline, 
    activeQueueCount, 
    activeAuditorTab, 
    setAuditorTab,
    currentMissionId,
    currentDepositCode 
  } = useAuditStore();

  const tier = getAuditorTier(userXP);

  return (
    <header className="sticky top-0 z-40 bg-[#263988] text-white shadow-md border-b border-[#1d2d6d]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Top Zone: Brand Wordmark, User Status, Gamification Badges */}
        <div className="flex items-center justify-between h-14">
          {/* Brand & Mission breadcrumb */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setAuditorTab('selector')}
              className="text-left cursor-pointer group"
            >
              <div className="text-base font-bold tracking-tight text-white flex items-center gap-2">
                <span>AUDITORIAPLUS+</span>
                <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-white/10 text-emerald-300 border border-white/15">
                  AUDITOR PWA
                </span>
              </div>
              <div className="text-[11px] text-blue-200/80 font-mono hidden sm:block">
                {currentMissionId || 'Sin Misión'} · Dep: {currentDepositCode || '150101'}
              </div>
            </button>
          </div>

          {/* Gamification Live Indicators & Profile */}
          <div className="flex items-center gap-3">
            {/* Streak Counter */}
            <div 
              title="Racha de Conteos Exactos Consecutivos (Bonus XP)"
              className="flex items-center gap-1.5 px-2.5 py-1 bg-white/10 rounded-full border border-white/15 text-xs font-mono"
            >
              <Flame className="w-3.5 h-3.5 text-amber-400 fill-amber-400 animate-pulse" />
              <span className="font-bold text-amber-300 tabular-nums">{currentStreak}</span>
              <span className="text-[10px] text-blue-200 hidden md:inline">Racha</span>
            </div>

            {/* User Tier & Cumulative XP */}
            <button
              onClick={() => setAuditorTab('ranking')}
              className="flex items-center gap-2 px-3 py-1 bg-white/10 hover:bg-white/15 rounded-lg border border-white/15 text-xs transition-colors cursor-pointer"
            >
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
              <div className="text-left font-mono">
                <span className="font-bold text-white tabular-nums">{userXP.toLocaleString()} XP</span>
                <span className="text-[10px] text-blue-200 ml-1.5 hidden lg:inline">({tier.tier})</span>
              </div>
            </button>

            {/* Offline Status indicator */}
            <div
              title={isOffline ? 'Modo Offline: Guardando en IndexedDB' : 'Conectado a Supabase Cloud'}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono ${
                isOffline 
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' 
                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
              }`}
            >
              {isOffline ? <WifiOff className="w-3.5 h-3.5" /> : <Wifi className="w-3.5 h-3.5" />}
              <span className="text-[11px] font-medium hidden sm:inline">
                {isOffline ? `Offline (${activeQueueCount})` : 'Online'}
              </span>
            </div>

            <PWAInstallButton />
          </div>
        </div>

        {/* Bottom Zone: Auditor Tabs Navigation */}
        <div className="flex items-center gap-1 -mb-px overflow-x-auto text-xs font-medium scrollbar-none">
          <button
            onClick={() => setAuditorTab('selector')}
            className={`px-3 py-2.5 border-b-2 transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeAuditorTab === 'selector'
                ? 'border-emerald-400 text-white font-semibold'
                : 'border-transparent text-blue-200 hover:text-white'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>1. Misiones & Depósitos</span>
          </button>

          <button
            onClick={() => setAuditorTab('scan')}
            className={`px-3 py-2.5 border-b-2 transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeAuditorTab === 'scan'
                ? 'border-emerald-400 text-white font-semibold'
                : 'border-transparent text-blue-200 hover:text-white'
            }`}
          >
            <Scan className="w-3.5 h-3.5" />
            <span>2. Escaneo & Conteo Live</span>
          </button>

          <button
            onClick={() => setAuditorTab('history')}
            className={`px-3 py-2.5 border-b-2 transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeAuditorTab === 'history'
                ? 'border-emerald-400 text-white font-semibold'
                : 'border-transparent text-blue-200 hover:text-white'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>3. Historial de Turno</span>
          </button>

          <button
            onClick={() => setAuditorTab('ranking')}
            className={`px-3 py-2.5 border-b-2 transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeAuditorTab === 'ranking'
                ? 'border-emerald-400 text-white font-semibold'
                : 'border-transparent text-blue-200 hover:text-white'
            }`}
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>4. Leaderboard & Niveles</span>
          </button>
        </div>
      </div>
    </header>
  );
};
