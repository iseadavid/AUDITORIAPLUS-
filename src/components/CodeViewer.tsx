import React, { useState } from 'react';
import { AGENT_FILES } from '../data/agentFiles';
import { Copy, Check, Download, FileText, Code2, Terminal, Container, Settings } from 'lucide-react';

export const CodeViewer: React.FC = () => {
  const [selectedFileIndex, setSelectedFileIndex] = useState<number>(0);
  const [copied, setCopied] = useState<boolean>(false);

  const currentFile = AGENT_FILES[selectedFileIndex];

  const handleCopy = () => {
    navigator.clipboard.writeText(currentFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadSingle = () => {
    const blob = new Blob([currentFile.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = currentFile.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getFileIcon = (filename: string) => {
    if (filename.includes('Docker')) return <Container className="w-4 h-4 text-sky-400" />;
    if (filename.endsWith('.js')) return <Code2 className="w-4 h-4 text-amber-400" />;
    if (filename.endsWith('.json')) return <Settings className="w-4 h-4 text-emerald-400" />;
    if (filename.endsWith('.sql')) return <Terminal className="w-4 h-4 text-purple-400" />;
    return <FileText className="w-4 h-4 text-slate-400" />;
  };

  const lines = currentFile.content.split('\n');

  return (
    <div className="space-y-4">
      {/* File Selector Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-slate-900 border border-slate-800 rounded-lg">
        {AGENT_FILES.map((file, idx) => (
          <button
            key={file.filename}
            onClick={() => {
              setSelectedFileIndex(idx);
              setCopied(false);
            }}
            className={`flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-md transition-colors cursor-pointer ${
              selectedFileIndex === idx
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            {getFileIcon(file.filename)}
            <span>{file.filename}</span>
          </button>
        ))}
      </div>

      {/* Code Card Container */}
      <div className="bg-slate-950 border border-slate-800 rounded-lg overflow-hidden">
        {/* File Header Bar */}
        <div className="px-4 py-3 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white font-mono">
                {currentFile.filename}
              </span>
              <span className="text-xs text-slate-500 font-mono">
                · {lines.length} líneas · {currentFile.language.toUpperCase()}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {currentFile.description}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded transition-colors cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copiado</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-400" />
                  <span>Copiar Código</span>
                </>
              )}
            </button>

            <button
              onClick={handleDownloadSingle}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Descargar Archivo</span>
            </button>
          </div>
        </div>

        {/* Code Content with Line Numbers */}
        <div className="overflow-x-auto max-h-[650px] overflow-y-auto p-4 font-mono text-xs text-slate-300 bg-slate-950 leading-relaxed scrollbar-thin">
          <table className="w-full border-collapse">
            <tbody>
              {lines.map((line, lineIndex) => (
                <tr key={lineIndex} className="hover:bg-slate-900/40">
                  <td className="w-12 pr-4 text-right select-none text-slate-600 font-mono text-[11px] align-top">
                    {lineIndex + 1}
                  </td>
                  <td className="whitespace-pre font-mono text-slate-200">
                    {line || ' '}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
