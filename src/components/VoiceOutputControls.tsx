import React, { useState, useRef, useEffect } from 'react';
import { Volume2, VolumeX, Loader2, Square } from 'lucide-react';
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
  const audioContextRef = useRef<AudioContext | null>(null);
  const activeSourceRef = useRef<AudioBufferSourceNode | null>(null);

  // Initialize and keep synthesis voices updated
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

  const getAudioContext = (): AudioContext | null => {
    if (typeof window === 'undefined') return null;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return null;
      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        audioContextRef.current = new AudioCtx();
      }
      return audioContextRef.current;
    } catch {
      return null;
    }
  };

  const stopAllAudio = () => {
    // 1. Stop Web Audio buffer source
    if (activeSourceRef.current) {
      try {
        activeSourceRef.current.stop();
        activeSourceRef.current.disconnect();
      } catch {
        // already stopped
      }
      activeSourceRef.current = null;
    }

    // 2. Stop HTML5 Audio
    if (currentAudioRef.current) {
      try {
        currentAudioRef.current.pause();
        currentAudioRef.current.currentTime = 0;
      } catch {
        // ignore
      }
      currentAudioRef.current = null;
    }

    // 3. Stop browser speech synthesis
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    setActiveVoice(null);
    setIsLoading(null);
  };

  // Convert base64 string to ArrayBuffer for Web Audio decoding
  const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  };

  // Play audio using Web Audio API with pitch & timbre equalization for Girl vs Boy
  const playWithWebAudio = async (
    arrayBuffer: ArrayBuffer,
    gender: 'female' | 'male',
    isGeminiAiVoice: boolean
  ): Promise<boolean> => {
    const ctx = getAudioContext();
    if (!ctx) return false;

    try {
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      // decodeAudioData consumes the buffer, so slice a copy
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.playbackRate.value = playbackSpeed;

      if (!isGeminiAiVoice) {
        // Apply gender characteristics to audio:
        if (gender === 'female') {
          // 👧 Girl Voice: Higher pitch (+190 cents) & bright presence filter
          if (source.detune) {
            source.detune.value = 190;
          }
          const filter = ctx.createBiquadFilter();
          filter.type = 'peaking';
          filter.frequency.value = 3200;
          filter.Q.value = 1.2;
          filter.gain.value = 3.5;

          source.connect(filter);
          filter.connect(ctx.destination);
        } else {
          // 👦 Boy Voice: Lower pitch (-210 cents) & warm chest bass resonance
          if (source.detune) {
            source.detune.value = -210;
          }
          const filter = ctx.createBiquadFilter();
          filter.type = 'lowshelf';
          filter.frequency.value = 240;
          filter.gain.value = 4.0;

          source.connect(filter);
          filter.connect(ctx.destination);
        }
      } else {
        // Gemini AI voices are pre-synthesized natively for Kore (girl) or Puck (boy)
        source.connect(ctx.destination);
      }

      activeSourceRef.current = source;
      setActiveVoice(gender);

      source.onended = () => {
        if (activeVoice === gender) {
          setActiveVoice(null);
        }
        activeSourceRef.current = null;
      };

      source.start(0);
      return true;
    } catch (err) {
      console.warn('Web Audio decode failed, attempting HTML5 audio fallback:', err);
      return false;
    }
  };

  // Play audio via HTML5 Audio element
  const playHtml5Audio = (
    src: string,
    gender: 'female' | 'male',
    onFail: () => void
  ) => {
    try {
      const audio = new Audio(src);
      // Subtle playback rate adjustment if using generic fallback
      audio.playbackRate =
        gender === 'female' ? playbackSpeed * 1.07 : playbackSpeed * 0.93;
      currentAudioRef.current = audio;

      audio.onplay = () => {
        setActiveVoice(gender);
        setIsLoading(null);
      };

      audio.onended = () => {
        setActiveVoice(null);
        currentAudioRef.current = null;
      };

      audio.onerror = () => {
        console.warn('HTML5 Audio playback error');
        currentAudioRef.current = null;
        onFail();
      };

      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn('HTML5 audio play rejected:', err);
          onFail();
        });
      }
    } catch {
      onFail();
    }
  };

  // Fallback 2: Browser Speech Synthesis with gender matching and correct language
  const playBrowserSynthesis = (gender: 'female' | 'male') => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setActiveVoice(null);
      setIsLoading(null);
      return;
    }

    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      const langCode = targetLang.bcp47 || targetLang.code || 'en-US';
      utterance.lang = langCode;
      utterance.rate = playbackSpeed;

      const voices =
        availableVoices.length > 0
          ? availableVoices
          : window.speechSynthesis.getVoices();

      const matchingVoices = voices.filter((v) => {
        const vl = v.lang.toLowerCase();
        const tl = langCode.toLowerCase();
        return (
          vl === tl ||
          vl.startsWith(tl.slice(0, 2)) ||
          vl.replace('_', '-').startsWith(tl.replace('_', '-').slice(0, 2))
        );
      });

      if (gender === 'female') {
        const femaleVoice = matchingVoices.find((v) => {
          const name = v.name.toLowerCase();
          return (
            name.includes('female') ||
            name.includes('girl') ||
            name.includes('woman') ||
            name.includes('zira') ||
            name.includes('samantha') ||
            name.includes('karen') ||
            name.includes('victoria') ||
            name.includes('fiona') ||
            name.includes('heera') ||
            name.includes('kalpana') ||
            name.includes('veena') ||
            name.includes('leena') ||
            name.includes('google')
          );
        }) || matchingVoices[0];

        if (femaleVoice) utterance.voice = femaleVoice;
        utterance.pitch = 1.28; // clearly distinct feminine pitch
      } else {
        const maleVoice = matchingVoices.find((v) => {
          const name = v.name.toLowerCase();
          return (
            name.includes('male') ||
            name.includes('boy') ||
            name.includes('man') ||
            name.includes('david') ||
            name.includes('mark') ||
            name.includes('george') ||
            name.includes('daniel') ||
            name.includes('rishi') ||
            name.includes('ravi') ||
            name.includes('alex')
          );
        }) || (matchingVoices.length > 1 ? matchingVoices[matchingVoices.length - 1] : matchingVoices[0]);

        if (maleVoice) utterance.voice = maleVoice;
        utterance.pitch = 0.82; // clearly distinct masculine pitch
      }

      utterance.onstart = () => {
        setActiveVoice(gender);
        setIsLoading(null);
      };

      utterance.onend = () => {
        setActiveVoice(null);
      };

      utterance.onerror = (e) => {
        console.warn('SpeechSynthesis error:', e);
        setActiveVoice(null);
        setIsLoading(null);
      };

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('Browser synthesis failed:', e);
      setActiveVoice(null);
      setIsLoading(null);
    }
  };

  const playVoice = async (gender: 'female' | 'male') => {
    if (!textToSpeak.trim()) return;

    // Toggle off if already playing
    if (activeVoice === gender) {
      stopAllAudio();
      return;
    }

    stopAllAudio();
    setIsLoading(gender);

    // Warm up AudioContext immediately on user gesture to avoid iOS/Chrome autoplay blocks
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    try {
      // Step 1: Call /api/tts (Gemini AI TTS with automatic Google TTS engine fallback on server/Vercel)
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
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
          const buffer = base64ToArrayBuffer(data.audioBase64);
          const isGemini = data.source === 'gemini';

          const played = await playWithWebAudio(buffer, gender, isGemini);
          if (played) {
            setIsLoading(null);
            return;
          }

          // If Web Audio API decode failed, play as HTML5 data audio URI
          const mime = data.mimeType || (isGemini ? 'audio/wav' : 'audio/mpeg');
          playHtml5Audio(`data:${mime};base64,${data.audioBase64}`, gender, () => {
            playBrowserSynthesis(gender);
          });
          return;
        }
      }

      // Step 2: Direct Google TTS URL fallback (works 100% on static Vercel without backend)
      const directGoogleTtsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(
        textToSpeak.slice(0, 180)
      )}&tl=${encodeURIComponent(targetLang.code)}&client=tw-ob`;

      playHtml5Audio(directGoogleTtsUrl, gender, () => {
        // Step 3: Web Speech API synthesis
        playBrowserSynthesis(gender);
      });
    } catch (err) {
      console.warn('Network TTS failed, falling back to direct voice engine:', err);
      const directGoogleTtsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(
        textToSpeak.slice(0, 180)
      )}&tl=${encodeURIComponent(targetLang.code)}&client=tw-ob`;

      playHtml5Audio(directGoogleTtsUrl, gender, () => {
        playBrowserSynthesis(gender);
      });
    }
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
