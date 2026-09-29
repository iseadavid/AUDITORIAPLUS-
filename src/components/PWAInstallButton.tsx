import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download } from 'lucide-react';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already running as an installed PWA, hide the button
  if (isInstalled) {
    return null;
  }

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    return (
      <button
        onClick={install}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md transition-colors cursor-pointer"
      >
        <Download className="w-3.5 h-3.5 text-emerald-400" />
        <span>Instalar PWA</span>
      </button>
    );
  }

  // iOS Safari flow
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md transition-colors cursor-pointer"
        >
          <span>Instalar en iOS</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-sm rounded-xl bg-slate-900 border border-slate-800 p-5 shadow-xl text-slate-200 space-y-3">
              <h3 className="text-sm font-semibold text-white">Instalar AUDITORIAPLUS+ en iPhone / iPad</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                1. Toca el botón <strong>Compartir</strong> (ícono con flecha hacia arriba) en Safari.<br />
                2. Desplázate hacia abajo y selecciona <strong>"Agregar al inicio"</strong>.
              </p>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-3 w-full rounded bg-slate-800 hover:bg-slate-700 py-1.5 text-xs font-medium text-slate-200"
              >
                Cerrar
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
