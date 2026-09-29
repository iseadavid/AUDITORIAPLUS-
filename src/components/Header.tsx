import React, { useState } from 'react';
import JSZip from 'jszip';
import { AGENT_FILES } from '../data/agentFiles';
import { Download, Check, FileCode2, UserCheck, Smartphone } from 'lucide-react';
import { useAuditStore } from '../store/useAuditStore';
import { PWAInstallButton } from './PWAInstallButton';

export type ActiveNavTab = 'auditor-pwa' | 'admin-desktop' | 'offline-pwa' | 'edge-functions' | 'relay-simulator' | 'code' | 'architecture';

interface HeaderProps {
  activeTab: ActiveNavTab;
  setActiveTab: (tab: ActiveNavTab) => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab }) => {
  const [isZipping, setIsZipping] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const { activeQueueCount, userXP, currentStreak } = useAuditStore();

  const handleDownloadZip = async () => {
    try {
      setIsZipping(true);
      const zip = new JSZip();
      
      const folder = zip.folder('auditoriaplus-full-suite');
      if (folder) {
        AGENT_FILES.forEach(file => {
          folder.file(file.filename, file.content);
        });
        folder.file('.dockerignore', 'node_modules\nnpm-debug.log\n.env\n.git\n.gitignore\n*.md\n.DS_Store\n');
      }

      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'auditoriaplus-pwa-auditor-suite.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 3000);
    } catch (err) {
      console.error('Error generating ZIP:', err);
    } finally {
      setIsZipping(false);
    }
  };

  return (
    <header className="sticky top-0 z-50 flex items-center justify-between px-6 py-3 bg-[#1d2d6d] border-b border-[#263988] text-slate-100 shadow-sm">
      {/* Zone 1: Single text element wordmark */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400">
          <Smartphone className="w-4 h-4" />
        </div>
        <button 
          onClick={() => setActiveTab('auditor-pwa')} 
          className="text-base font-bold tracking-tight text-white hover:text-emerald-300 transition-colors cursor-pointer text-left"
        >
          AUDITORIAPLUS+
        </button>
      </div>

      {/* Zone 2: Clean text navigation links */}
      <nav className="hidden md:flex items-center gap-5 text-xs font-semibold text-slate-300">
        <button
          onClick={() => setActiveTab('auditor-pwa')}
          className={`transition-colors cursor-pointer pb-0.5 flex items-center gap-1.5 ${
            activeTab === 'auditor-pwa'
              ? 'text-white border-b-2 border-emerald-400 font-bold'
              : 'hover:text-white'
          }`}
        >
          <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Vistas Rol Auditor PWA</span>
        </button>

        <button
          onClick={() => setActiveTab('admin-desktop')}
          className={`transition-colors cursor-pointer pb-0.5 flex items-center gap-1.5 ${
            activeTab === 'admin-desktop'
              ? 'text-white border-b-2 border-amber-400 font-bold'
              : 'hover:text-white'
          }`}
        >
          <FileCode2 className="w-3.5 h-3.5 text-amber-400" />
          <span>Panel Superusuario (Desktop)</span>
        </button>

        <button
          onClick={() => setActiveTab('offline-pwa')}
          className={`transition-colors cursor-pointer pb-0.5 flex items-center gap-1.5 ${
            activeTab === 'offline-pwa'
              ? 'text-white border-b-2 border-emerald-400 font-bold'
              : 'hover:text-white'
          }`}
        >
          <span>IndexedDB & Sync SW</span>
          {activeQueueCount > 0 && (
            <span className="text-[10px] font-mono font-bold bg-amber-500 text-slate-950 px-1.5 py-0.2 rounded-full">
              {activeQueueCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('edge-functions')}
          className={`transition-colors cursor-pointer pb-0.5 ${
            activeTab === 'edge-functions'
              ? 'text-white border-b-2 border-emerald-400 font-bold'
              : 'hover:text-white'
          }`}
        >
          Edge Functions & Nodo 150104
        </button>

        <button
          onClick={() => setActiveTab('relay-simulator')}
          className={`transition-colors cursor-pointer pb-0.5 ${
            activeTab === 'relay-simulator'
              ? 'text-white border-b-2 border-emerald-400 font-bold'
              : 'hover:text-white'
          }`}
        >
          Relay Agent LAN
        </button>

        <button
          onClick={() => setActiveTab('code')}
          className={`transition-colors cursor-pointer pb-0.5 ${
            activeTab === 'code'
              ? 'text-white border-b-2 border-emerald-400 font-bold'
              : 'hover:text-white'
          }`}
        >
          Código TypeScript
        </button>

        <button
          onClick={() => setActiveTab('architecture')}
          className={`transition-colors cursor-pointer pb-0.5 ${
            activeTab === 'architecture'
              ? 'text-white border-b-2 border-emerald-400 font-bold'
              : 'hover:text-white'
          }`}
        >
          Topología
        </button>
      </nav>

      {/* Zone 3: Primary action buttons */}
      <div className="flex items-center gap-3">
        <PWAInstallButton />

        <button
          onClick={handleDownloadZip}
          disabled={isZipping}
          className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-bold text-white bg-[#009045] hover:bg-[#007b3b] rounded-lg transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap shadow-sm"
        >
          {downloadSuccess ? (
            <>
              <Check className="w-3.5 h-3.5 text-white" />
              <span>ZIP Descargado</span>
            </>
          ) : (
            <>
              <Download className="w-3.5 h-3.5 text-white" />
              <span>{isZipping ? 'Comprimiendo...' : 'Descargar Bundle (.ZIP)'}</span>
            </>
          )}
        </button>
      </div>
    </header>
  );
};
