import React, { useState } from 'react';
import {
  ArrowLeftRight,
  Sparkles,
  Copy,
  Check,
  RotateCcw,
  Volume2,
  FileText,
  CornerDownLeft,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { Language, TranslationResult } from '../types';
import { LocaleStrings } from '../data/locales';
import { LanguageSelector } from './LanguageSelectorModal';
import { VoiceInputButton } from './VoiceInputButton';
import { VoiceOutputControls } from './VoiceOutputControls';
import { translateText } from '../utils/translator';
import { speakFemaleVoice, stopCurrentSpeech } from '../utils/speechSpeaker';

interface TranslationCardProps {
  sourceLang: Language;
  targetLang: Language;
  onSourceLangChange: (lang: Language) => void;
  onTargetLangChange: (lang: Language) => void;
  onSwapLanguages: () => void;
  strings: LocaleStrings;
  onSaveToHistory: (result: TranslationResult) => void;
  recentLangCodes: string[];
}

export const TranslationCard: React.FC<TranslationCardProps> = ({
  sourceLang,
  targetLang,
  onSourceLangChange,
  onTargetLangChange,
  onSwapLanguages,
  strings,
  onSaveToHistory,
  recentLangCodes,
}) => {
  const [inputText, setInputText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [transliteration, setTransliteration] = useState('');
  const [detectedLangName, setDetectedLangName] = useState('');
  const [sourceNativeScript, setSourceNativeScript] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [isPlayingNativeAudio, setIsPlayingNativeAudio] = useState(false);
  const [copiedNative, setCopiedNative] = useState(false);

  const executeTranslate = async (textToTranslate: string) => {
    const clean = textToTranslate.trim();
    if (!clean) return;

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const data = await translateText(
        clean,
        sourceLang.code,
        sourceLang.name,
        targetLang.code,
        targetLang.name
      );

      setTranslatedText(data.translation || '');
      setTransliteration(data.transliteration || '');
      setDetectedLangName(data.detectedSourceLang || '');
      setSourceNativeScript(data.sourceNativeScript || '');

      const result: TranslationResult = {
        originalText: clean,
        sourceLang: data.detectedSourceLang || sourceLang.name,
        targetLang: targetLang.name,
        translatedText: data.translation,
        transliteration: data.transliteration,
        detectedSourceLang: data.detectedSourceLang,
        sourceNativeScript: data.sourceNativeScript,
        timestamp: Date.now(),
      };

      onSaveToHistory(result);
    } catch (err: any) {
      console.error('Translation error:', err);
      setErrorMessage(
        err.message?.includes('JSON')
          ? 'Network error reaching translation service. Retrying...'
          : err.message || 'Error occurred while translating. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleTranslate = async () => {
    await executeTranslate(inputText);
  };

  const handlePlayNativeScript = () => {
    if (!sourceNativeScript.trim()) return;
    if (isPlayingNativeAudio) {
      stopCurrentSpeech();
      setIsPlayingNativeAudio(false);
      return;
    }

    const langToSpeak = detectedLangName || sourceLang.code || 'hi';
    speakFemaleVoice(
      sourceNativeScript,
      langToSpeak,
      detectedLangName,
      1.0,
      () => setIsPlayingNativeAudio(true),
      () => setIsPlayingNativeAudio(false),
      () => setIsPlayingNativeAudio(false)
    );
  };

  const handleCopyNative = () => {
    if (!sourceNativeScript) return;
    navigator.clipboard.writeText(sourceNativeScript);
    setCopiedNative(true);
    setTimeout(() => setCopiedNative(false), 2000);
  };

  const handleClear = () => {
    setInputText('');
    setTranslatedText('');
    setTransliteration('');
    setDetectedLangName('');
    setSourceNativeScript('');
    setErrorMessage(null);
  };

  const handleCopy = () => {
    if (!translatedText) return;
    navigator.clipboard.writeText(translatedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleTranslate();
    }
  };

  const handlePickSample = (sample: string) => {
    setInputText(sample);
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-4">
      {/* 1. Language Selection Row with Search and Voice */}
      <div className="bg-[#0f172a]/95 backdrop-blur-2xl border-2 border-indigo-500/35 rounded-2xl p-4 sm:p-5 shadow-2xl shadow-indigo-950/60">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3.5">
          {/* Source Language */}
          <div className="w-full sm:flex-1">
            <LanguageSelector
              selectedCode={sourceLang.code}
              onSelect={onSourceLangChange}
              allowAutoDetect={true}
              label={strings.sourceLangLabel}
              strings={strings}
              recentCodes={recentLangCodes}
            />
          </div>

          {/* Swap Button - High Contrast Vibrant Indigo/Cyan */}
          <div className="shrink-0 pt-2 sm:pt-6">
            <button
              type="button"
              onClick={onSwapLanguages}
              disabled={sourceLang.code === 'auto'}
              title={strings.swapLanguages}
              className={`p-3 rounded-xl border-2 transition-all duration-200 shadow-md ${
                sourceLang.code === 'auto'
                  ? 'bg-slate-900 border-slate-800 text-slate-500 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-cyan-400 hover:text-slate-950 text-white border-indigo-400/60 hover:border-cyan-300 shadow-indigo-600/30 hover:scale-105 active:scale-95 cursor-pointer'
              }`}
            >
              <ArrowLeftRight className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>

          {/* Target Language */}
          <div className="w-full sm:flex-1">
            <LanguageSelector
              selectedCode={targetLang.code}
              onSelect={onTargetLangChange}
              allowAutoDetect={false}
              label={strings.targetLangLabel}
              strings={strings}
              recentCodes={recentLangCodes}
            />
          </div>
        </div>
      </div>

      {/* 2. Main Translation Box (Input + Output) with High Contrast Clarity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left Side: Input Text Card */}
        <div className="bg-[#0f172a]/95 backdrop-blur-2xl border-2 border-indigo-500/35 hover:border-indigo-400/60 rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-2xl shadow-indigo-950/60 transition-all">
          <div>
            {/* Input Heading above text giving bar - High contrast vibrant cyan */}
            <div className="flex items-center justify-between border-b-2 border-[#1c294a] pb-3 mb-3.5">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-md shadow-cyan-400/50" />
                <h2 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-cyan-200 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-cyan-400" />
                  {strings.inputHeading}
                </h2>
              </div>

              {/* Voice Input Button & Clear Button */}
              <div className="flex items-center gap-2">
                <VoiceInputButton
                  sourceLangBcp47={sourceLang.bcp47}
                  onTranscription={(text) => {
                    const combined = inputText ? `${inputText} ${text}` : text;
                    setInputText(combined);
                    executeTranslate(combined);
                  }}
                  strings={strings}
                />
                {inputText && (
                  <button
                    type="button"
                    onClick={handleClear}
                    className="p-1.5 rounded-xl text-slate-300 hover:text-white bg-slate-800 hover:bg-rose-900/60 border border-slate-700 hover:border-rose-500/50 transition-colors text-xs flex items-center gap-1 font-semibold cursor-pointer"
                    title={strings.clearBtn}
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{strings.clearBtn}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Input Textarea Bar - Deep contrast background & bright text */}
            <div className="relative">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={strings.inputPlaceholder}
                rows={5}
                className="w-full bg-[#070b16] border-2 border-slate-700 hover:border-slate-600 focus:border-cyan-400 rounded-xl p-4 text-slate-50 placeholder-slate-400 text-sm sm:text-base resize-none focus:outline-none focus:ring-2 focus:ring-cyan-400/25 transition-all font-sans leading-relaxed shadow-inner"
              />
            </div>

            {/* Native Script Transliteration for Romanized / English-letter Indian Input */}
            {sourceNativeScript && sourceNativeScript.trim() !== inputText.trim() && (
              <div className="mt-3 p-3.5 rounded-xl bg-gradient-to-r from-indigo-950/90 via-[#0e1938] to-slate-900 border-2 border-cyan-400/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-lg animate-in fade-in">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-cyan-300 font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-500/40">
                      {detectedLangName || 'Native'} Script
                    </span>
                    <span className="text-[11px] text-amber-300 font-semibold">
                      (Converted from English letters)
                    </span>
                  </div>
                  <p className="text-white font-black text-base sm:text-lg tracking-wide font-sans">{sourceNativeScript}</p>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={handlePlayNativeScript}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                      isPlayingNativeAudio
                        ? 'bg-rose-500 text-white border-rose-400'
                        : 'bg-slate-800 hover:bg-pink-600 text-pink-300 hover:text-white border-slate-700 hover:border-pink-400'
                    }`}
                    title="Listen to native pronunciation"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>{isPlayingNativeAudio ? 'Stop' : 'Listen'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyNative}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition-all cursor-pointer"
                    title="Copy native script"
                  >
                    {copiedNative ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedNative ? 'Copied' : 'Copy'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setInputText(sourceNativeScript)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-black text-xs transition-colors cursor-pointer shadow-sm"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Use in Input</span>
                  </button>
                </div>
              </div>
            )}

            {/* Character counter & Helper */}
            <div className="flex items-center justify-between text-xs text-slate-300 mt-2 px-1 font-medium">
              <span>
                {inputText.length} {strings.charCount}
              </span>
              <span className="hidden sm:inline text-cyan-300/80">
                Press Ctrl+Enter / ⌘+Enter to translate
              </span>
            </div>
          </div>

          {/* Translate Button & Quick Samples */}
          <div className="mt-4 pt-3.5 border-t-2 border-[#1c294a]">
            <div className="flex items-center justify-between gap-3">
              {/* Quick Sample Dropdown/Chips */}
              <div className="hidden sm:flex items-center gap-1.5 overflow-x-auto text-xs py-1">
                <span className="text-amber-300 text-xs shrink-0 font-bold">Try:</span>
                {strings.samplePhrases.slice(0, 2).map((phrase, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handlePickSample(phrase)}
                    className="shrink-0 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-indigo-600 text-slate-200 hover:text-white border border-slate-700 hover:border-indigo-400 text-xs truncate max-w-[160px] transition-colors font-medium cursor-pointer"
                    title={phrase}
                  >
                    "{phrase}"
                  </button>
                ))}
              </div>

              {/* Primary Translate Button - Vibrant Radiant Gradient */}
              <button
                type="button"
                onClick={handleTranslate}
                disabled={isLoading || !inputText.trim()}
                className={`ml-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-extrabold text-xs sm:text-sm tracking-wide shadow-xl transition-all duration-200 ${
                  isLoading || !inputText.trim()
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed shadow-none border border-slate-700'
                    : 'bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:via-blue-500 hover:to-indigo-500 text-white shadow-cyan-500/30 hover:scale-[1.02] active:scale-[0.98] cursor-pointer'
                }`}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{strings.translating}</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>{strings.translateBtn}</span>
                    <CornerDownLeft className="w-3.5 h-3.5 opacity-70 hidden sm:inline" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Right Side: Output Result Card with Girl & Boy Voice */}
        <div className="bg-[#0f172a]/95 backdrop-blur-2xl border-2 border-indigo-500/35 hover:border-indigo-400/60 rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-2xl shadow-indigo-950/60 transition-all">
          <div>
            {/* Output Heading - High contrast vibrant Emerald */}
            <div className="flex items-center justify-between border-b-2 border-[#1c294a] pb-3 mb-3.5">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-md shadow-emerald-400/50" />
                <h2 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-emerald-200 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  {strings.outputHeading}
                </h2>
                {detectedLangName && (
                  <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-cyan-400/20 text-cyan-200 border border-cyan-400/40 font-bold">
                    Detected: {detectedLangName}
                  </span>
                )}
              </div>

              {/* Copy button */}
              {translatedText && (
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors shadow-sm cursor-pointer"
                  title={strings.copyBtn}
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400 stroke-[3]" />
                      <span className="text-emerald-400">{strings.copied}</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-cyan-400" />
                      <span>{strings.copyBtn}</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Error Message if any */}
            {errorMessage && (
              <div className="mb-3 p-3 rounded-xl bg-rose-950/80 border-2 border-rose-600/70 text-xs text-rose-200 font-semibold">
                {errorMessage}
              </div>
            )}

            {/* Translated Output Display Bar - High contrast clear text */}
            <div className="min-h-[140px] bg-[#070b16] border-2 border-slate-700 rounded-xl p-4 flex flex-col justify-between shadow-inner">
              {translatedText ? (
                <div className="space-y-3.5">
                  <p className="text-slate-50 text-lg sm:text-xl font-semibold leading-relaxed select-text font-sans">
                    {translatedText}
                  </p>

                  {/* Script Transliteration / Romanization pronunciation guide */}
                  {transliteration && (
                    <div className="pt-2.5 border-t border-slate-800 text-xs text-amber-200 font-mono flex items-start gap-2 bg-amber-950/50 p-2.5 rounded-xl border border-amber-500/30">
                      <span className="text-amber-400 font-bold shrink-0 text-sm">Aa:</span>
                      <div>
                        <span className="text-slate-400 text-[10px] block font-sans font-medium">
                          {strings.transliterationLabel}:
                        </span>
                        <span className="italic font-bold text-amber-300">{transliteration}</span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-center text-slate-300 text-xs sm:text-sm py-10">
                  {isLoading ? (
                    <div className="flex flex-col items-center gap-2 text-cyan-400 font-bold">
                      <Loader2 className="w-7 h-7 animate-spin" />
                      <span>{strings.translating}</span>
                    </div>
                  ) : (
                    <p className="max-w-md font-medium text-slate-400 leading-relaxed">
                      {strings.outputPlaceholder}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 3. VOICE ASSISTANT AUDIO PRONUNCIATION */}
          <div className="mt-4 pt-3.5 border-t-2 border-[#1c294a]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-xs font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
                <Volume2 className="w-4 h-4 text-cyan-400" />
                <span>Voice Assistant Audio:</span>
              </div>

              {/* Voice Output Controls: Girl (👧) & Boy (👦) */}
              <VoiceOutputControls
                textToSpeak={translatedText}
                targetLang={targetLang}
                strings={strings}
                disabled={!translatedText}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
