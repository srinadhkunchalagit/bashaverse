import React from 'react';
import { X, Trash2, ArrowRight, Copy, Check, Clock } from 'lucide-react';
import { TranslationResult } from '../types';
import { LocaleStrings } from '../data/locales';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  history: TranslationResult[];
  onClearHistory: () => void;
  onSelectResult: (result: TranslationResult) => void;
  strings: LocaleStrings;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({
  isOpen,
  onClose,
  history,
  onClearHistory,
  onSelectResult,
  strings,
}) => {
  const [copiedIndex, setCopiedIndex] = React.useState<number | null>(null);

  if (!isOpen) return null;

  const handleCopy = (text: string, index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
      <div className="w-full max-w-xl bg-[#0b1329] border-2 border-indigo-500/50 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] text-slate-100 animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b-2 border-indigo-950/90 flex items-center justify-between bg-[#0e172a]">
          <div className="flex items-center gap-2.5">
            <Clock className="w-5 h-5 text-amber-400" />
            <h3 className="text-base sm:text-lg font-extrabold text-white tracking-tight">
              {strings.history} ({history.length})
            </h3>
          </div>
          <div className="flex items-center gap-2">
            {history.length > 0 && (
              <button
                type="button"
                onClick={onClearHistory}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-rose-300 hover:text-white bg-rose-950/60 hover:bg-rose-600 rounded-xl transition-colors border border-rose-600/50 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{strings.clearHistory}</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-300 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5 stroke-[2.5]" />
            </button>
          </div>
        </div>

        {/* Content list */}
        <div className="p-4 overflow-y-auto space-y-3 flex-1 bg-[#070b17]">
          {history.length === 0 ? (
            <div className="py-14 text-center text-slate-300">
              <Clock className="w-10 h-10 mx-auto mb-3 opacity-40 text-amber-400" />
              <p className="text-base font-bold text-white">{strings.noHistory}</p>
            </div>
          ) : (
            history.map((item, idx) => (
              <div
                key={`${item.timestamp}-${idx}`}
                onClick={() => {
                  onSelectResult(item);
                  onClose();
                }}
                className="group p-4 rounded-xl bg-[#0f172a] hover:bg-[#1a2542] border-2 border-slate-700/80 hover:border-cyan-400 transition-all cursor-pointer shadow-md"
              >
                <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                  <div className="flex items-center gap-2 font-bold">
                    <span className="text-cyan-400 uppercase text-xs tracking-wider">{item.sourceLang}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-500 stroke-[2.5]" />
                    <span className="text-emerald-400 uppercase text-xs tracking-wider">{item.targetLang}</span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => handleCopy(item.translatedText, idx, e)}
                    className="p-1.5 text-slate-300 hover:text-white rounded-lg hover:bg-slate-700 transition-colors"
                    title="Copy translated text"
                  >
                    {copiedIndex === idx ? (
                      <Check className="w-4 h-4 text-emerald-400 stroke-[3]" />
                    ) : (
                      <Copy className="w-4 h-4 text-cyan-400" />
                    )}
                  </button>
                </div>

                <div className="text-xs text-slate-300 line-clamp-2 mb-2 font-medium">
                  {item.originalText}
                </div>
                <div className="text-sm sm:text-base font-bold text-white line-clamp-2">
                  {item.translatedText}
                </div>
                {item.transliteration && (
                  <div className="text-xs text-amber-300 italic mt-1.5 font-mono font-semibold">
                    {item.transliteration}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
