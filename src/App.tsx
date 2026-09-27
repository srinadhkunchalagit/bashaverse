import React, { useState } from 'react';
import { ThreeBackground } from './components/ThreeBackground';
import { Navbar } from './components/Navbar';
import { TranslationCard } from './components/TranslationCard';
import { HistoryModal } from './components/HistoryModal';
import { LANGUAGES, AUTO_DETECT_LANGUAGE } from './data/languages';
import { APP_LOCALES } from './data/locales';
import { Language, IndianAppLocale, TranslationResult } from './types';
import { Globe, Mic, Volume2, Compass } from 'lucide-react';

export default function App() {
  // App interface locale (default to Hindi or English, saved in localStorage)
  const [currentLocale, setCurrentLocale] = useState<IndianAppLocale>(() => {
    const saved = localStorage.getItem('bhasha_locale') as IndianAppLocale;
    return saved && APP_LOCALES[saved] ? saved : 'hi';
  });

  // Source and Target languages
  const [sourceLang, setSourceLang] = useState<Language>(() => {
    return AUTO_DETECT_LANGUAGE;
  });

  const [targetLang, setTargetLang] = useState<Language>(() => {
    return LANGUAGES.find((l) => l.code === 'te') || LANGUAGES.find((l) => l.code === 'hi') || LANGUAGES[0];
  });

  // 3D Background animation intensity
  const [bgIntensity, setBgIntensity] = useState<'vibrant' | 'subtle' | 'off'>(() => {
    const saved = localStorage.getItem('bhasha_3d_bg');
    return (saved as any) || 'vibrant';
  });

  // Translation history
  const [history, setHistory] = useState<TranslationResult[]>(() => {
    try {
      const saved = localStorage.getItem('bhasha_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [recentLangCodes, setRecentLangCodes] = useState<string[]>([
    'hi',
    'te',
    'ta',
    'bn',
    'en',
    'es',
    'ja',
    'ar',
  ]);

  const strings = APP_LOCALES[currentLocale] || APP_LOCALES.en;

  const handleLocaleChange = (locale: IndianAppLocale) => {
    setCurrentLocale(locale);
    localStorage.setItem('bhasha_locale', locale);

    // Auto update target language to match user's selected Indian app locale if appropriate
    const matchingLang = LANGUAGES.find((l) => l.code === locale);
    if (matchingLang && sourceLang.code !== locale) {
      setTargetLang(matchingLang);
    }
  };

  const handleSaveToHistory = (result: TranslationResult) => {
    setHistory((prev) => {
      const updated = [result, ...prev.slice(0, 49)];
      localStorage.setItem('bhasha_history', JSON.stringify(updated));
      return updated;
    });

    // Track recents
    setRecentLangCodes((prev) => {
      const set = new Set([result.targetLang, ...prev]);
      return Array.from(set).slice(0, 10);
    });
  };

  const handleClearHistory = () => {
    setHistory([]);
    localStorage.removeItem('bhasha_history');
  };

  const handleSwapLanguages = () => {
    if (sourceLang.code === 'auto') return;
    const prevSource = sourceLang;
    setSourceLang(targetLang);
    setTargetLang(prevSource);
  };

  const toggleBgIntensity = () => {
    setBgIntensity((prev) => {
      const next = prev === 'vibrant' ? 'subtle' : prev === 'subtle' ? 'off' : 'vibrant';
      localStorage.setItem('bhasha_3d_bg', next);
      return next;
    });
  };

  const quickPairs: { from: string; to: string; label: string }[] = [
    { from: 'en', to: 'te', label: 'English ➔ Telugu (తెలుగు)' },
    { from: 'en', to: 'hi', label: 'English ➔ Hindi (हिन्दी)' },
    { from: 'en', to: 'ta', label: 'English ➔ Tamil (தமிழ்)' },
    { from: 'hi', to: 'te', label: 'Hindi ➔ Telugu' },
    { from: 'en', to: 'bn', label: 'English ➔ Bengali (বাংলা)' },
    { from: 'en', to: 'mr', label: 'English ➔ Marathi (मराठी)' },
    { from: 'en', to: 'ja', label: 'English ➔ Japanese (日本語)' },
    { from: 'en', to: 'es', label: 'English ➔ Spanish (Español)' },
  ];

  const handleQuickPair = (fromCode: string, toCode: string) => {
    const src = LANGUAGES.find((l) => l.code === fromCode);
    const tgt = LANGUAGES.find((l) => l.code === toCode);
    if (src) setSourceLang(src);
    if (tgt) setTargetLang(tgt);
  };

  return (
    <div className="min-h-screen text-slate-100 flex flex-col relative selection:bg-cyan-500 selection:text-slate-950 font-sans">
      {/* 3D Animations Background */}
      <ThreeBackground intensity={bgIntensity} />

      {/* Navigation Bar with Indian Language Switcher */}
      <Navbar
        currentLocale={currentLocale}
        onLocaleChange={handleLocaleChange}
        strings={strings}
        onOpenHistory={() => setIsHistoryOpen(true)}
        historyCount={history.length}
        bgIntensity={bgIntensity}
        onToggleBgIntensity={toggleBgIntensity}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* Hero Banner / Header Intro - High Contrast & No 3D in Titles */}
        <div className="text-center max-w-3xl mx-auto space-y-2.5 pt-2">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#0f172a] border-2 border-indigo-500/40 text-cyan-300 text-xs shadow-xl backdrop-blur-md">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
            <span className="font-extrabold text-white">130+ Total World & All Indian Languages</span>
            <span className="text-indigo-400">·</span>
            <span className="text-amber-300 font-bold">👧 Girl & 👦 Boy Voices</span>
          </div>

          <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white drop-shadow-lg">
            {strings.appName}
          </h2>
          <p className="text-sm sm:text-base text-slate-200 max-w-2xl mx-auto leading-relaxed font-medium">
            {strings.appSubtitle}
          </p>
        </div>

        {/* Quick Language Pair Chips */}
        <div className="flex items-center justify-center gap-2 overflow-x-auto py-1 scrollbar-none">
          <span className="text-xs text-amber-300 font-extrabold hidden sm:inline mr-1">
            Quick:
          </span>
          {quickPairs.map((pair, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleQuickPair(pair.from, pair.to)}
              className="shrink-0 px-3 py-1.5 rounded-xl bg-[#0f172a] hover:bg-indigo-600 text-slate-100 hover:text-white border-2 border-indigo-500/35 hover:border-indigo-400 text-xs transition-all font-bold backdrop-blur-md shadow-md cursor-pointer hover:scale-105 active:scale-95"
            >
              {pair.label}
            </button>
          ))}
        </div>

        {/* 1, 2, 3, 5: Translation Card with Searchable Selection, Voice Input, Heading, and Girl/Boy Voice */}
        <TranslationCard
          sourceLang={sourceLang}
          targetLang={targetLang}
          onSourceLangChange={setSourceLang}
          onTargetLangChange={setTargetLang}
          onSwapLanguages={handleSwapLanguages}
          strings={strings}
          onSaveToHistory={handleSaveToHistory}
          recentLangCodes={recentLangCodes}
        />

        {/* Feature Highlights Grid - High contrast cards */}
        <section className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* Feature 1 */}
            <div className="p-4 rounded-2xl bg-[#0f172a]/95 border-2 border-cyan-500/30 hover:border-cyan-400/60 backdrop-blur-md space-y-2 shadow-xl transition-all">
              <div className="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 flex items-center justify-center shadow-md shadow-cyan-500/20">
                <Globe className="w-5 h-5" />
              </div>
              <h3 className="text-xs sm:text-sm font-extrabold text-white tracking-wide">
                Total World & Indian Languages
              </h3>
              <p className="text-xs text-slate-300 leading-normal font-medium">
                130+ languages worldwide with instant voice & text search across all Indian scripts.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="p-4 rounded-2xl bg-[#0f172a]/95 border-2 border-emerald-500/30 hover:border-emerald-400/60 backdrop-blur-md space-y-2 shadow-xl transition-all">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 flex items-center justify-center shadow-md shadow-emerald-500/20">
                <Mic className="w-5 h-5" />
              </div>
              <h3 className="text-xs sm:text-sm font-extrabold text-white tracking-wide">
                Real-Time Voice Input
              </h3>
              <p className="text-xs text-slate-300 leading-normal font-medium">
                Voice speech-to-text dictation with visual sound wave equalizer and instant transcription.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="p-4 rounded-2xl bg-[#0f172a]/95 border-2 border-pink-500/30 hover:border-pink-400/60 backdrop-blur-md space-y-2 shadow-xl transition-all">
              <div className="w-9 h-9 rounded-xl bg-pink-500/20 border border-pink-400/40 text-pink-300 flex items-center justify-center shadow-md shadow-pink-500/20">
                <Volume2 className="w-5 h-5" />
              </div>
              <h3 className="text-xs sm:text-sm font-extrabold text-white tracking-wide">
                Girl & Boy Clear Voices
              </h3>
              <p className="text-xs text-slate-300 leading-normal font-medium">
                Crystal-clear native pronunciation with female (👧) and male (👦) voice persona options.
              </p>
            </div>

            {/* Feature 4 - Without 3D in title */}
            <div className="p-4 rounded-2xl bg-[#0f172a]/95 border-2 border-amber-500/30 hover:border-amber-400/60 backdrop-blur-md space-y-2 shadow-xl transition-all">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-300 flex items-center justify-center shadow-md shadow-amber-500/20">
                <Compass className="w-5 h-5" />
              </div>
              <h3 className="text-xs sm:text-sm font-extrabold text-white tracking-wide">
                Interactive Cosmos Motion
              </h3>
              <p className="text-xs text-slate-300 leading-normal font-medium">
                Real-time WebGL interactive background with rotating globe, language arcs, and depth parallax.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Translation History Modal */}
      <HistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        history={history}
        onClearHistory={handleClearHistory}
        onSelectResult={(item) => {
          const src = LANGUAGES.find((l) => l.name === item.sourceLang);
          const tgt = LANGUAGES.find((l) => l.name === item.targetLang);
          if (src) setSourceLang(src);
          if (tgt) setTargetLang(tgt);
        }}
        strings={strings}
      />

      {/* Footer - High Contrast */}
      <footer className="mt-auto border-t-2 border-indigo-500/30 bg-[#070b17] py-4 text-center text-xs text-slate-300 font-medium">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-bold text-white">{strings.appName}</span>
            <span className="text-indigo-400">·</span>
            <span className="text-slate-300">Global & Indian Multilingual Translation Platform</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span className="text-cyan-300 font-semibold">Gemini AI Engine</span>
            <span>·</span>
            <span className="text-indigo-300">Voice Synthesis & Cosmos Motion</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
