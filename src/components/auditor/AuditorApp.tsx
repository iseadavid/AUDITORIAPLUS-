// ==============================================================================
// AUDITORIAPLUS+ Auditor Role Main Container (React PWA)
// Header Azul Marino: #263988 | CTA Verde: #009045 | Fondo: #F8F9FA
// ==============================================================================

import React from 'react';
import { useAuditStore } from '../../store/useAuditStore';
import { AuditorHeader } from './AuditorHeader';
import { MissionSelectorView } from './MissionSelectorView';
import { ScanningInterfaceView } from './ScanningInterfaceView';
import { AuditHistoryView } from './AuditHistoryView';
import { LeaderboardView } from './LeaderboardView';

export const AuditorApp: React.FC = () => {
  const { activeAuditorTab } = useAuditStore();

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-slate-900 flex flex-col font-sans selection:bg-[#009045]/20 selection:text-[#009045]">
      {/* Header Corporativo Azul Marino #263988 */}
      <AuditorHeader />

      {/* Main Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        {activeAuditorTab === 'selector' && <MissionSelectorView />}
        {activeAuditorTab === 'scan' && <ScanningInterfaceView />}
        {activeAuditorTab === 'history' && <AuditHistoryView />}
        {activeAuditorTab === 'ranking' && <LeaderboardView />}
      </main>
    </div>
  );
};
