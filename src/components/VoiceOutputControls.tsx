import React, { useState, useRef, useEffect } from 'react';
import { Volume2, VolumeX, Loader2, Play, Square } from 'lucide-react';
import { LocaleStrings } from '../data/locales';
import { Language } from '../types';

interface VoiceOutputControlsProps {
  textToSpeak: string;
  targetLang: Language;
  strings: LocaleStrings;
  disabled?: boolean;
}

export const VoiceOutputControls: React.FC<VoiceOutputControlsProps> = ({
  textToSpeak,
  targetLang,
  strings,
  disabled = false,
}) => {
  const [activeVoice, setActiveVoice] = useState<'female' | 'male' | null>(null);
  const [isLoading, setIsLoading] = useState<'female' | 'male' | null>(null);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);

  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  // Load browser synthesis voices
  useEffect(() => {
    const updateVoices = () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        setAvailableVoices(window.speechSynthesis.getVoices());
      }
    };

    updateVoices();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }

    return () => {
      stopAllAudio();
    };
  }, []);

  const stopAllAudio = () => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setActiveVoice(null);
    setIsLoading(null);
  };

  const playVoice = async (gender: 'female' | 'male') => {
    if (!textToSpeak.trim()) return;

    // If currently playing this voice, stop it
    if (activeVoice === gender) {
      stopAllAudio();
      return;
    }

    stopAllAudio();
    setIsLoading(gender);

    try {
      // 1. Try Gemini high-fidelity server TTS first
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: textToSpeak,
          languageCode: targetLang.code,
          languageName: targetLang.name,
          gender,
        }),
      });

      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        if (data.audioBase64) {
          playBase64Audio(data.audioBase64, data.mimeType || 'audio/mp3', gender);
          return;
        }
      }

      // 2. Fallback to Web Speech API with gender-tuned voice/pitch
      playBrowserSynthesis(gender);
    } catch (err) {
      console.warn('Server TTS failed, falling back to client synthesis:', err);
      playBrowserSynthesis(gender);
    } finally {
      setIsLoading(null);
    }
  };

  const playBase64Audio = (base64: string, mimeType: string, gender: 'female' | 'male') => {
    try {
      const audioUrl = `data:${mimeType};base64,${base64}`;
      const audio = new Audio(audioUrl);
      audio.playbackRate = playbackSpeed;
      currentAudioRef.current = audio;

      audio.onplay = () => {
        setActiveVoice(gender);
      };

      audio.onended = () => {
        setActiveVoice(null);
        currentAudioRef.current = null;
      };

      audio.onerror = () => {
        console.warn('Audio playback error, trying browser synthesis fallback');
        playBrowserSynthesis(gender);
      };

      audio.play().catch(() => {
        playBrowserSynthesis(gender);
      });
    } catch (err) {
      playBrowserSynthesis(gender);
    }
  };

  const playBrowserSynthesis = (gender: 'female' | 'male') => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.rate = playbackSpeed;

    // Attempt to match language
    const langCode = targetLang.bcp47;
    const matchingVoices = availableVoices.filter(
      (v) => v.lang.toLowerCase().startsWith(langCode.toLowerCase().slice(0, 2)) || v.lang === langCode
    );

    if (gender === 'female') {
      // Find female voice or adjust pitch higher
      const femaleVoice = matchingVoices.find(
        (v) =>
          v.name.toLowerCase().includes('female') ||
          v.name.toLowerCase().includes('zira') ||
          v.name.toLowerCase().includes('samantha') ||
          v.name.toLowerCase().includes('girl') ||
          v.name.toLowerCase().includes('google')
      );
      if (femaleVoice) {
        utterance.voice = femaleVoice;
      } else if (matchingVoices.length > 0) {
        utterance.voice = matchingVoices[0];
      }
      utterance.pitch = 1.25; // feminine higher frequency
    } else {
      // Male voice or adjust pitch lower
      const maleVoice = matchingVoices.find(
        (v) =>
          v.name.toLowerCase().includes('male') ||
          v.name.toLowerCase().includes('david') ||
          v.name.toLowerCase().includes('george') ||
          v.name.toLowerCase().includes('boy')
      );
      if (maleVoice) {
        utterance.voice = maleVoice;
      } else if (matchingVoices.length > 0) {
        utterance.voice = matchingVoices[matchingVoices.length - 1];
      }
      utterance.pitch = 0.82; // masculine lower frequency
    }

    utterance.onstart = () => {
      setActiveVoice(gender);
    };

    utterance.onend = () => {
      setActiveVoice(null);
    };

    utterance.onerror = () => {
      setActiveVoice(null);
    };

    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      {/* 👧 Girl Voice Button - Vibrant Rose / Pink */}
      <button
        type="button"
        onClick={() => playVoice('female')}
        disabled={disabled || !textToSpeak.trim() || isLoading !== null}
        className={`group relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all duration-200 shadow-md ${
          activeVoice === 'female'
            ? 'bg-rose-500 text-white shadow-rose-500/40 ring-4 ring-rose-400/50 scale-105'
            : 'bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white border-2 border-pink-400/60 shadow-pink-900/40 hover:scale-[1.02] active:scale-[0.98]'
        } ${disabled || !textToSpeak.trim() ? 'opacity-40 cursor-not-allowed saturate-50' : 'cursor-pointer'}`}
      >
        <span className="text-lg leading-none" role="img" aria-label="girl">
          👧
        </span>
        <div className="flex items-center gap-1.5">
          <span>{strings.girlVoice}</span>
          {isLoading === 'female' ? (
            <Loader2 className="w-4 h-4 animate-spin text-white" />
          ) : activeVoice === 'female' ? (
            <Square className="w-3.5 h-3.5 fill-current" />
          ) : (
            <Volume2 className="w-4 h-4 text-white group-hover:scale-110 transition-transform" />
          )}
        </div>

        {/* Live sound wave for girl voice */}
        {activeVoice === 'female' && (
          <span className="flex items-center gap-0.5 ml-1">
            <span className="w-1 h-3.5 bg-white rounded-full animate-bounce [animation-delay:-0.2s]" />
            <span className="w-1 h-4.5 bg-white rounded-full animate-bounce [animation-delay:-0.1s]" />
            <span className="w-1 h-3 bg-white rounded-full animate-bounce" />
          </span>
        )}
      </button>

      {/* 👦 Boy Voice Button - Vibrant Cobalt / Blue */}
      <button
        type="button"
        onClick={() => playVoice('male')}
        disabled={disabled || !textToSpeak.trim() || isLoading !== null}
        className={`group relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all duration-200 shadow-md ${
          activeVoice === 'male'
            ? 'bg-blue-500 text-white shadow-blue-500/40 ring-4 ring-blue-400/50 scale-105'
            : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white border-2 border-blue-400/60 shadow-blue-900/40 hover:scale-[1.02] active:scale-[0.98]'
        } ${disabled || !textToSpeak.trim() ? 'opacity-40 cursor-not-allowed saturate-50' : 'cursor-pointer'}`}
      >
        <span className="text-lg leading-none" role="img" aria-label="boy">
          👦
        </span>
        <div className="flex items-center gap-1.5">
          <span>{strings.boyVoice}</span>
          {isLoading === 'male' ? (
            <Loader2 className="w-4 h-4 animate-spin text-white" />
          ) : activeVoice === 'male' ? (
            <Square className="w-3.5 h-3.5 fill-current" />
          ) : (
            <Volume2 className="w-4 h-4 text-white group-hover:scale-110 transition-transform" />
          )}
        </div>

        {/* Live sound wave for boy voice */}
        {activeVoice === 'male' && (
          <span className="flex items-center gap-0.5 ml-1">
            <span className="w-1 h-3.5 bg-white rounded-full animate-bounce [animation-delay:-0.2s]" />
            <span className="w-1 h-4.5 bg-white rounded-full animate-bounce [animation-delay:-0.1s]" />
            <span className="w-1 h-3 bg-white rounded-full animate-bounce" />
          </span>
        )}
      </button>

      {/* Stop button when speaking */}
      {activeVoice && (
        <button
          type="button"
          onClick={stopAllAudio}
          className="p-2.5 rounded-xl bg-slate-800 text-rose-400 hover:text-white hover:bg-rose-600 border-2 border-slate-700 hover:border-rose-500 transition-colors shadow-md cursor-pointer"
          title="Stop speech"
        >
          <VolumeX className="w-4 h-4" />
        </button>
      )}

      {/* Speed Selector - High Contrast */}
      <div className="flex items-center gap-1 bg-[#0b1329] p-1 rounded-xl border-2 border-indigo-500/30 text-xs">
        {[0.8, 1.0, 1.2].map((spd) => (
          <button
            key={spd}
            type="button"
            onClick={() => setPlaybackSpeed(spd)}
            className={`px-2 py-1 rounded-lg transition-colors font-bold ${
              playbackSpeed === spd
                ? 'bg-cyan-500 text-slate-950 shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            {spd}x
          </button>
        ))}
      </div>
    </div>
  );
};
