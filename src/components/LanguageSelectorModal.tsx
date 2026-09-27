import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Search, X, Check, Globe, Sparkles, Mic, MicOff, Loader2 } from 'lucide-react';
import { Language } from '../types';
import { LANGUAGES, AUTO_DETECT_LANGUAGE } from '../data/languages';
import { LocaleStrings } from '../data/locales';

interface LanguageSelectorProps {
  selectedCode: string;
  onSelect: (lang: Language) => void;
  allowAutoDetect?: boolean;
  label: string;
  strings: LocaleStrings;
  recentCodes?: string[];
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  selectedCode,
  onSelect,
  allowAutoDetect = false,
  label,
  strings,
  recentCodes = ['en', 'hi', 'te', 'ta', 'es', 'fr', 'zh', 'ar'],
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'indian' | 'popular' | 'asia' | 'europe' | 'americas_africa'>('all');
  const [isVoiceSearching, setIsVoiceSearching] = useState(false);
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  const selectedLang = useMemo(() => {
    if (selectedCode === 'auto') return AUTO_DETECT_LANGUAGE;
    return LANGUAGES.find((l) => l.code === selectedCode) || LANGUAGES[0];
  }, [selectedCode]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 60);
    } else {
      setSearchQuery('');
      stopVoiceSearch();
    }
  }, [isOpen]);

  useEffect(() => {
    return () => {
      stopVoiceSearch();
    };
  }, []);

  const stopVoiceSearch = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
    setIsVoiceSearching(false);
    setVoiceNotice(null);
  };

  const handleVoiceSearch = () => {
    if (isVoiceSearching) {
      stopVoiceSearch();
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setVoiceNotice('Voice search not supported in this browser. Please type.');
      setTimeout(() => setVoiceNotice(null), 3000);
      return;
    }

    try {
      stopVoiceSearch();
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.lang = 'en-US';
      recognition.interimResults = false;
      recognition.continuous = false;

      recognition.onstart = () => {
        setIsVoiceSearching(true);
        setVoiceNotice(strings.voiceSearchListening || 'Listening... say a language');
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript.trim();
        if (transcript) {
          // Clean up common filler words like "language", "find", "search for"
          const cleaned = transcript
            .replace(/^(search for|find|select|language|translate to|translate into)\s+/i, '')
            .replace(/\s+language$/i, '')
            .trim();

          setSearchQuery(cleaned);
          setVoiceNotice(`Found: "${cleaned}"`);
          setTimeout(() => setVoiceNotice(null), 2500);

          // Focus input
          searchInputRef.current?.focus();
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Voice search error:', event.error);
        if (event.error === 'not-allowed') {
          setVoiceNotice('Microphone permission denied.');
        } else if (event.error === 'no-speech') {
          setVoiceNotice('No speech detected. Try again.');
        } else {
          setVoiceNotice('Could not recognize. Please try again.');
        }
        setIsVoiceSearching(false);
        setTimeout(() => setVoiceNotice(null), 3000);
      };

      recognition.onend = () => {
        setIsVoiceSearching(false);
      };

      recognition.start();
    } catch (err) {
      console.error('Failed to start voice search:', err);
      setIsVoiceSearching(false);
      setVoiceNotice('Voice search failed to start.');
      setTimeout(() => setVoiceNotice(null), 3000);
    }
  };

  const filteredLanguages = useMemo(() => {
    let list = allowAutoDetect ? [AUTO_DETECT_LANGUAGE, ...LANGUAGES] : LANGUAGES;

    // Filter by Tab
    if (activeTab === 'indian') {
      list = list.filter((l) => l.isIndian || l.code === 'auto');
    } else if (activeTab === 'popular') {
      list = list.filter((l) => l.popular || l.isIndian || l.code === 'auto');
    } else if (activeTab === 'asia') {
      list = list.filter((l) => l.region === 'Asia' || l.region === 'Middle East' || l.region === 'India');
    } else if (activeTab === 'europe') {
      list = list.filter((l) => l.region === 'Europe');
    } else if (activeTab === 'americas_africa') {
      list = list.filter((l) => l.region === 'Americas' || l.region === 'Africa' || l.region === 'Oceania');
    }

    // Filter by Search Query
    if (!searchQuery.trim()) return list;

    const q = searchQuery.toLowerCase().trim();
    return list.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        l.nativeName.toLowerCase().includes(q) ||
        l.code.toLowerCase().includes(q) ||
        l.region.toLowerCase().includes(q)
    );
  }, [searchQuery, activeTab, allowAutoDetect]);

  const recentLanguagesList = useMemo(() => {
    return LANGUAGES.filter((l) => recentCodes.includes(l.code));
  }, [recentCodes]);

  const handleSelect = (lang: Language) => {
    onSelect(lang);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      {/* Trigger Button - Vibrant and High Contrast */}
      <div className="flex flex-col">
        <span className="text-xs font-extrabold uppercase tracking-wider text-cyan-300 mb-1.5 flex items-center gap-1.5">
          <Globe className="w-3.5 h-3.5 text-cyan-400" />
          {label}
        </span>
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="group flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-[#0f172a] hover:bg-[#19243d] border-2 border-indigo-500/40 hover:border-cyan-400 transition-all duration-200 shadow-lg shadow-indigo-950/50 text-left w-full cursor-pointer hover:scale-[1.01] active:scale-[0.99]"
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-2xl leading-none shrink-0 drop-shadow-sm" role="img" aria-label="flag">
              {selectedLang.flag}
            </span>
            <div className="min-w-0">
              <div className="text-sm sm:text-base font-bold text-white truncate flex items-center gap-2">
                <span>{selectedLang.name}</span>
                {selectedLang.isIndian && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 font-extrabold shrink-0 shadow-sm">
                    INDIA 🇮🇳
                  </span>
                )}
              </div>
              <div className="text-xs text-cyan-200/90 font-medium truncate mt-0.5">
                {selectedLang.nativeName}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-cyan-400 group-hover:text-white transition-colors shrink-0 ml-1">
            <Search className="w-4 h-4 stroke-[2.5]" />
          </div>
        </button>
      </div>

      {/* Modal Backdrop and Dialog */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
          <div
            className="w-full max-w-2xl bg-[#0b1329] border-2 border-indigo-500/50 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-slate-100 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with Search Box & Voice Search Option */}
            <div className="p-4 sm:p-5 border-b border-indigo-950/90 bg-[#0e172a]">
              <div className="flex items-center justify-between mb-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-cyan-500/20">
                    <Globe className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-extrabold text-white tracking-tight flex items-center gap-2">
                      <span>{strings.searchLanguage.replace('...', '')}</span>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-cyan-400/20 text-cyan-300 border border-cyan-400/30">
                        130+ Total
                      </span>
                    </h3>
                    <p className="text-xs text-slate-300 font-medium mt-0.5">
                      Type name, native script, or use voice input
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-2 text-slate-300 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5 stroke-[2.5]" />
                </button>
              </div>

              {/* 2. Search Input Bar with Voice Input */}
              <div className="relative flex items-center">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-400 pointer-events-none stroke-[2.5]" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={
                    isVoiceSearching
                      ? strings.voiceSearchListening || 'Listening... say a language'
                      : strings.searchLanguage
                  }
                  className="w-full pl-10 pr-24 py-3 bg-[#060a14] border-2 border-indigo-400/50 hover:border-indigo-400 focus:border-cyan-400 rounded-xl text-white placeholder-slate-400 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-cyan-400/30 transition-all shadow-inner"
                />

                {/* Right controls inside search bar: Clear & Voice Search Mic */}
                <div className="absolute right-2 flex items-center gap-1">
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                      title="Clear search"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}

                  {/* 2. VOICE INPUT IN SEARCH OPTION */}
                  <button
                    type="button"
                    onClick={handleVoiceSearch}
                    title={
                      isVoiceSearching
                        ? strings.stopListening
                        : strings.voiceSearchPrompt || 'Search language by voice'
                    }
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all shadow-md ${
                      isVoiceSearching
                        ? 'bg-rose-600 text-white ring-2 ring-rose-400 animate-pulse'
                        : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white'
                    }`}
                  >
                    {isVoiceSearching ? (
                      <>
                        <MicOff className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Listening</span>
                      </>
                    ) : (
                      <>
                        <Mic className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Voice</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Voice Notice Feedback Bar */}
              {voiceNotice && (
                <div className="mt-2 text-xs font-semibold text-amber-300 bg-amber-950/80 px-3 py-1.5 rounded-lg border border-amber-500/40 flex items-center gap-2 animate-in fade-in">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                  <span>{voiceNotice}</span>
                </div>
              )}

              {/* Category Filter Tabs with Vivid Colors */}
              <div className="flex items-center gap-1.5 overflow-x-auto pt-3 pb-0.5 scrollbar-thin scrollbar-thumb-slate-700">
                <button
                  type="button"
                  onClick={() => setActiveTab('all')}
                  className={`px-3.5 py-1.5 text-xs font-bold rounded-lg whitespace-nowrap transition-all ${
                    activeTab === 'all'
                      ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30'
                      : 'bg-slate-800 text-slate-200 hover:bg-slate-750 hover:text-white border border-slate-700'
                  }`}
                >
                  {strings.allLanguages} ({LANGUAGES.length})
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('indian')}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg whitespace-nowrap transition-all ${
                    activeTab === 'indian'
                      ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/30'
                      : 'bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 border-2 border-amber-400/50'
                  }`}
                >
                  <span>🇮🇳</span>
                  <span>{strings.indianLanguages}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('popular')}
                  className={`px-3.5 py-1.5 text-xs font-bold rounded-lg whitespace-nowrap transition-all ${
                    activeTab === 'popular'
                      ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30'
                      : 'bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700'
                  }`}
                >
                  {strings.popularLanguages}
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('asia')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg whitespace-nowrap transition-all ${
                    activeTab === 'asia'
                      ? 'bg-cyan-500 text-slate-950 shadow-md'
                      : 'bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700'
                  }`}
                >
                  Asia
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('europe')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg whitespace-nowrap transition-all ${
                    activeTab === 'europe'
                      ? 'bg-cyan-500 text-slate-950 shadow-md'
                      : 'bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700'
                  }`}
                >
                  Europe
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('americas_africa')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg whitespace-nowrap transition-all ${
                    activeTab === 'americas_africa'
                      ? 'bg-cyan-500 text-slate-950 shadow-md'
                      : 'bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700'
                  }`}
                >
                  Americas & Africa
                </button>
              </div>
            </div>

            {/* Quick Suggestions / Recents */}
            {!searchQuery && activeTab === 'all' && (
              <div className="px-4 py-2.5 bg-[#090f21] border-b border-indigo-950/80 flex items-center gap-2 overflow-x-auto text-xs">
                <span className="text-amber-400 flex items-center gap-1 shrink-0 font-bold">
                  <Sparkles className="w-3.5 h-3.5" />
                  Quick:
                </span>
                {recentLanguagesList.map((lang) => (
                  <button
                    key={`quick-${lang.code}`}
                    type="button"
                    onClick={() => handleSelect(lang)}
                    className="shrink-0 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-indigo-600 text-white border border-slate-700 hover:border-indigo-400 flex items-center gap-1.5 transition-colors font-medium cursor-pointer"
                  >
                    <span>{lang.flag}</span>
                    <span>{lang.name}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Language Grid - High Contrast & Clearly Legible */}
            <div className="p-3 sm:p-4 overflow-y-auto max-h-[50vh] grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 bg-[#070b17]">
              {filteredLanguages.length === 0 ? (
                <div className="col-span-full py-12 text-center text-slate-300">
                  <Search className="w-10 h-10 mx-auto mb-3 opacity-50 text-cyan-400" />
                  <p className="text-base font-bold text-white">No languages found matching "{searchQuery}"</p>
                  <p className="text-xs text-slate-400 mt-1">Try speaking or typing another name, or click the voice button</p>
                </div>
              ) : (
                filteredLanguages.map((lang) => {
                  const isSelected = lang.code === selectedCode;
                  return (
                    <button
                      key={lang.code}
                      type="button"
                      onClick={() => handleSelect(lang)}
                      className={`group flex items-center justify-between p-3 rounded-xl border-2 text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-cyan-500/20 border-cyan-400 text-white shadow-lg shadow-cyan-500/20 ring-1 ring-cyan-400'
                          : 'bg-[#0f172a] hover:bg-[#1a2542] border-[#223157] hover:border-cyan-400/80 text-white'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-2xl shrink-0 leading-none" role="img" aria-label="flag">
                          {lang.flag}
                        </span>
                        <div className="min-w-0">
                          <div className="text-sm font-bold truncate flex items-center gap-1.5 text-white">
                            <span>{lang.name}</span>
                            {lang.isIndian && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-amber-400 text-slate-950 font-extrabold shadow-sm">
                                IN
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-cyan-300/90 font-medium truncate mt-0.5">
                            {lang.nativeName}
                          </div>
                        </div>
                      </div>

                      {isSelected && (
                        <div className="w-6 h-6 rounded-full bg-cyan-400 text-slate-950 flex items-center justify-center shrink-0 ml-1.5 shadow-md">
                          <Check className="w-4 h-4 stroke-[3]" />
                        </div>
                      )}
                    </button>
                  );
                })
              )}
            </div>

            {/* Footer with language count & Voice hint */}
            <div className="px-4 py-3 bg-[#0a0f1d] border-t border-indigo-950/80 text-xs text-slate-300 flex items-center justify-between font-medium">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>Showing {filteredLanguages.length} languages</span>
              </span>
              <span className="text-cyan-300 flex items-center gap-1">
                <Mic className="w-3.5 h-3.5" />
                <span>Voice search available</span>
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
