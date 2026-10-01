import React, { useState } from 'react';
import { X, Trash2, ArrowRight, Copy, Check, Clock, Volume2, Square, AlertCircle } from 'lucide-react';
import { TranslationResult } from '../types';
import { LocaleStrings } from '../data/locales';
import { speakFemaleVoice, stopCurrentSpeech } from '../utils/speechSpeaker';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  history: TranslationResult[];
  onClearHistory: () => void;
  onDeleteItem: (index: number) => void;
  onSelectResult: (result: TranslationResult) => void;
  strings: LocaleStrings;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({
  isOpen,
  onClose,
  history,
  onClearHistory,
  onDeleteItem,
  onSelectResult,
  strings,
}) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [itemIndexToDelete, setItemIndexToDelete] = useState<number | null>(null);
  const [isConfirmingClearAll, setIsConfirmingClearAll] = useState(false);
  const [speakingTimestamp, setSpeakingTimestamp] = useState<number | null>(null);

  if (!isOpen) return null;

  const handleCopy = (text: string, index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 1500);
  };

  const handlePlayVoice = (item: TranslationResult, e: React.MouseEvent) => {
    e.stopPropagation();
    if (speakingTimestamp === item.timestamp) {
      stopCurrentSpeech();
      setSpeakingTimestamp(null);
      return;
    }

    speakFemaleVoice(
      item.translatedText,
      item.targetLang,
      item.targetLang,
      1.0,
      () => setSpeakingTimestamp(item.timestamp),
      () => setSpeakingTimestamp(null),
      () => setSpeakingTimestamp(null)
    );
  };

  const handleConfirmDelete = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    onDeleteItem(index);
    setItemIndexToDelete(null);
  };

  const handleCancelDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setItemIndexToDelete(null);
  };

  const handleConfirmClearAll = () => {
    onClearHistory();
    setIsConfirmingClearAll(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
      <div className="w-full max-w-xl bg-[#0b1329] border-2 border-indigo-500/50 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh] text-slate-100 animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b-2 border-indigo-950/90 flex items-center justify-between bg-[#0e172a]">
          <div className="flex items-center gap-2.5">
            <Clock className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="text-base sm:text-lg font-extrabold text-white tracking-tight">
                {strings.history} ({history.length})
              </h3>
              <p className="text-[10px] text-cyan-300 font-bold hidden sm:block">
                Designed & Directed by Srinadh Kunchala
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {history.length > 0 && (
              <button
                type="button"
                onClick={() => setIsConfirmingClearAll(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-rose-300 hover:text-white bg-rose-950/60 hover:bg-rose-600 rounded-xl transition-colors border border-rose-600/50 cursor-pointer shadow-sm"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{strings.clearHistory}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                stopCurrentSpeech();
                onClose();
              }}
              className="p-1.5 text-slate-300 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5 stroke-[2.5]" />
            </button>
          </div>
        </div>

        {/* Clear All Confirmation Banner */}
        {isConfirmingClearAll && (
          <div className="p-3.5 bg-rose-950/95 border-b-2 border-rose-500/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-rose-100 font-bold animate-in slide-in-from-top-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>Are you sure you want to clear all {history.length} translations?</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleConfirmClearAll}
                className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-extrabold shadow-sm cursor-pointer"
              >
                Yes, Clear All
              </button>
              <button
                type="button"
                onClick={() => setIsConfirmingClearAll(false)}
                className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Content list */}
        <div className="p-3 sm:p-4 overflow-y-auto space-y-3 flex-1 bg-[#070b17]">
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
                className="group p-4 rounded-xl bg-[#0f172a] hover:bg-[#15203a] border-2 border-slate-700/80 hover:border-cyan-400/80 transition-all cursor-pointer shadow-md relative"
              >
                {/* Header row with languages and action icons */}
                <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                  <div className="flex items-center gap-2 font-bold">
                    <span className="text-cyan-400 uppercase text-xs tracking-wider">{item.sourceLang}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-500 stroke-[2.5]" />
                    <span className="text-emerald-400 uppercase text-xs tracking-wider">{item.targetLang}</span>
                  </div>

                  <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                    {/* Read Out Voice Button */}
                    <button
                      type="button"
                      onClick={(e) => handlePlayVoice(item, e)}
                      className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                        speakingTimestamp === item.timestamp
                          ? 'bg-rose-500 text-white border-rose-400 ring-2 ring-rose-400/40'
                          : 'bg-slate-800 text-pink-300 hover:text-white hover:bg-pink-600 border-slate-700 hover:border-pink-500'
                      }`}
                      title="Read aloud with Voice Assistant"
                    >
                      {speakingTimestamp === item.timestamp ? (
                        <div className="flex items-center gap-1">
                          <Square className="w-3.5 h-3.5 fill-current" />
                          <span className="w-1.5 h-3 bg-white rounded-full animate-bounce [animation-delay:-0.2s]" />
                          <span className="w-1.5 h-4 bg-white rounded-full animate-bounce" />
                        </div>
                      ) : (
                        <Volume2 className="w-3.5 h-3.5" />
                      )}
                    </button>

                    {/* Copy Button */}
                    <button
                      type="button"
                      onClick={(e) => handleCopy(item.translatedText, idx, e)}
                      className="p-1.5 text-slate-300 hover:text-white rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors cursor-pointer"
                      title="Copy translated text"
                    >
                      {copiedIndex === idx ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400 stroke-[3]" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 text-cyan-400" />
                      )}
                    </button>

                    {/* Delete item button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setItemIndexToDelete(idx);
                      }}
                      className="p-1.5 text-rose-400 hover:text-white rounded-lg bg-slate-800 hover:bg-rose-600 border border-slate-700 hover:border-rose-500 transition-colors cursor-pointer"
                      title="Delete translation"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Confirm Delete Inline Box */}
                {itemIndexToDelete === idx && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="my-2 p-2.5 rounded-lg bg-rose-950/95 border border-rose-500/60 flex items-center justify-between gap-2 text-xs font-bold text-rose-200 animate-in fade-in"
                  >
                    <span>Delete this translation?</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => handleConfirmDelete(idx, e)}
                        className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white font-extrabold cursor-pointer"
                      >
                        Yes, Delete
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelDelete}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Original text */}
                <div className="text-xs text-slate-300 line-clamp-2 mb-1.5 font-medium">
                  {item.originalText}
                </div>

                {/* Native script representation if user typed in English letters */}
                {item.sourceNativeScript && item.sourceNativeScript !== item.originalText && (
                  <div className="text-xs text-cyan-300 font-semibold mb-2 bg-cyan-950/60 px-2.5 py-1 rounded-lg border border-cyan-500/40 inline-flex items-center gap-1.5 shadow-sm">
                    <span className="text-[10px] uppercase font-bold text-cyan-400">Native Script:</span>
                    <span className="font-extrabold text-white text-sm">{item.sourceNativeScript}</span>
                  </div>
                )}

                {/* Translated text */}
                <div className="text-sm sm:text-base font-bold text-white line-clamp-2">
                  {item.translatedText}
                </div>

                {/* Transliteration */}
                {item.transliteration && (
                  <div className="text-xs text-amber-300 italic mt-1.5 font-mono font-semibold">
                    {item.transliteration}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Modal Footer with Srinadh Kunchala credit */}
        <div className="p-3 bg-[#0a0f21] border-t border-indigo-950/80 text-center">
          <p className="text-[11px] font-bold text-slate-400">
            Designed and Directed by <span className="text-amber-400 font-extrabold">Srinadh Kunchala</span>
          </p>
        </div>
      </div>
    </div>
  );
};
