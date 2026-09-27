import React from 'react';
import { Globe, History, Sparkles, Layers } from 'lucide-react';
import { IndianAppLocale } from '../types';
import { LocaleStrings } from '../data/locales';

interface NavbarProps {
  currentLocale: IndianAppLocale;
  onLocaleChange: (locale: IndianAppLocale) => void;
  strings: LocaleStrings;
  onOpenHistory: () => void;
  historyCount: number;
  bgIntensity: 'vibrant' | 'subtle' | 'off';
  onToggleBgIntensity: () => void;
}

const INDIAN_APP_LANGUAGES: { code: IndianAppLocale; name: string; nativeName: string; flag: string }[] = [
  { code: 'en', name: 'English', nativeName: 'English', flag: '🌐' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳' },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు', flag: '🇮🇳' },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்', flag: '🇮🇳' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা', flag: '🇮🇳' },
  { code: 'mr', name: 'Marathi', nativeName: 'मराठी', flag: '🇮🇳' },
  { code: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી', flag: '🇮🇳' },
  { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ', flag: '🇮🇳' },
  { code: 'ml', name: 'Malayalam', nativeName: 'മലയാളം', flag: '🇮🇳' },
  { code: 'pa', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ', flag: '🇮🇳' },
  { code: 'or', name: 'Odia', nativeName: 'ଓଡ଼ିଆ', flag: '🇮🇳' },
  { code: 'ur', name: 'Urdu', nativeName: 'اردو', flag: '🇮🇳' },
  { code: 'as', name: 'Assamese', nativeName: 'অসমীয়া', flag: '🇮🇳' },
];

export const Navbar: React.FC<NavbarProps> = ({
  currentLocale,
  onLocaleChange,
  strings,
  onOpenHistory,
  historyCount,
  bgIntensity,
  onToggleBgIntensity,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full bg-[#0b1226]/95 backdrop-blur-2xl border-b-2 border-indigo-500/35 shadow-lg shadow-indigo-950/40">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Brand / Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 via-blue-600 to-indigo-600 p-[1.5px] shadow-lg shadow-cyan-500/30">
            <div className="w-full h-full bg-[#0b1226] rounded-[10px] flex items-center justify-center">
              <Globe className="w-5 h-5 text-cyan-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-xl font-extrabold text-white tracking-tight flex items-center gap-1.5">
                {strings.appName}
              </h1>
              <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-cyan-400/20 text-cyan-200 border border-cyan-400/40 hidden sm:inline-flex items-center gap-1 shadow-sm">
                <Sparkles className="w-3 h-3 text-cyan-400" />
                AI Voice
              </span>
            </div>
            <p className="text-xs text-slate-300 font-medium hidden md:block truncate max-w-md">
              {strings.appSubtitle}
            </p>
          </div>
        </div>

        {/* Right Action Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Background Motion Toggle */}
          <button
            type="button"
            onClick={onToggleBgIntensity}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border-2 transition-all cursor-pointer ${
              bgIntensity !== 'off'
                ? 'bg-[#141f3d] text-cyan-300 border-indigo-400/50 hover:bg-[#1a2952]'
                : 'bg-[#0f172a] text-slate-400 border-slate-700 hover:text-white'
            }`}
            title="Toggle Background Motion"
          >
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Cosmos</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#090e1f] font-mono text-cyan-300 font-extrabold">
              {bgIntensity === 'vibrant' ? 'ON' : bgIntensity === 'subtle' ? 'LOW' : 'OFF'}
            </span>
          </button>

          {/* History Button */}
          <button
            type="button"
            onClick={onOpenHistory}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#141f3d] hover:bg-[#1c2c54] text-amber-300 hover:text-white border-2 border-amber-500/40 transition-colors text-xs font-bold shadow-sm cursor-pointer"
            title={strings.history}
          >
            <History className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">{strings.history}</span>
            {historyCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-amber-400 text-slate-950 text-[10px] flex items-center justify-center font-extrabold shadow-sm">
                {historyCount}
              </span>
            )}
          </button>

          {/* Indian App Language Switcher */}
          <div className="flex items-center gap-1.5 bg-[#0e1730] border-2 border-amber-400 hover:border-amber-300 p-1 pl-2.5 rounded-xl transition-all shadow-md">
            <span className="text-xs font-extrabold text-amber-300 flex items-center gap-1 shrink-0">
              <span className="text-base">🇮🇳</span>
              <span className="hidden lg:inline">{strings.appLanguage}:</span>
            </span>
            <select
              value={currentLocale}
              onChange={(e) => onLocaleChange(e.target.value as IndianAppLocale)}
              className="bg-transparent text-xs text-white font-bold focus:outline-none cursor-pointer pr-1 py-1"
            >
              {INDIAN_APP_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code} className="bg-[#0b1226] text-white font-bold">
                  {lang.flag} {lang.nativeName} ({lang.name})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </header>
  );
};
