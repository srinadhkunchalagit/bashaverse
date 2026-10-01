import React, { useState, useRef, useEffect } from 'react';
import { Volume2, VolumeX, Loader2, Square, Play, Pause } from 'lucide-react';
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
  const [playbackState, setPlaybackState] = useState<'idle' | 'loading' | 'playing' | 'paused'>('idle');
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);

  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const activeSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const isSpeechSynthesisRef = useRef<boolean>(false);

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

  // When textToSpeak changes, stop any previous audio
  useEffect(() => {
    stopAllAudio();
  }, [textToSpeak]);

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
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    }

    isSpeechSynthesisRef.current = false;
    setPlaybackState('idle');
  };

  const pauseAudio = () => {
    if (playbackState !== 'playing') return;

    // If using HTML5 audio
    if (currentAudioRef.current) {
      try {
        currentAudioRef.current.pause();
        setPlaybackState('paused');
        return;
      } catch {
        // ignore
      }
    }

    // If using Web Audio
    if (audioContextRef.current && audioContextRef.current.state === 'running') {
      try {
        audioContextRef.current.suspend().then(() => {
          setPlaybackState('paused');
        });
        return;
      } catch {
        // ignore
      }
    }

    // If using SpeechSynthesis
    if (isSpeechSynthesisRef.current && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.pause();
        setPlaybackState('paused');
        return;
      } catch {
        // ignore
      }
    }

    setPlaybackState('paused');
  };

  const resumeAudio = () => {
    if (playbackState !== 'paused') return;

    // If HTML5 audio
    if (currentAudioRef.current) {
      try {
        currentAudioRef.current.play().then(() => {
          setPlaybackState('playing');
        });
        return;
      } catch {
        // restart
      }
    }

    // If Web Audio
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      try {
        audioContextRef.current.resume().then(() => {
          setPlaybackState('playing');
        });
        return;
      } catch {
        // restart
      }
    }

    // If SpeechSynthesis
    if (isSpeechSynthesisRef.current && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.resume();
        setPlaybackState('playing');
        return;
      } catch {
        // restart
      }
    }

    // If unable to resume directly, restart playback
    playVoice();
  };

  const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  };

  const playWithWebAudio = async (
    arrayBuffer: ArrayBuffer,
    isGeminiAiVoice: boolean
  ): Promise<boolean> => {
    const ctx = getAudioContext();
    if (!ctx) return false;

    try {
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.playbackRate.value = playbackSpeed;

      if (!isGeminiAiVoice) {
        // Bright, clear female voice equalization
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
        source.connect(ctx.destination);
      }

      activeSourceRef.current = source;
      setPlaybackState('playing');

      // CRITICAL: Stop automatically as soon as audio completes naturally
      source.onended = () => {
        activeSourceRef.current = null;
        setPlaybackState('idle');
      };

      source.start(0);
      return true;
    } catch (err) {
      console.warn('Web Audio decode failed:', err);
      return false;
    }
  };

  const playHtml5Audio = (src: string, onFail: () => void) => {
    try {
      const audio = new Audio(src);
      audio.playbackRate = playbackSpeed * 1.05;
      currentAudioRef.current = audio;

      audio.onplay = () => {
        setPlaybackState('playing');
      };

      // CRITICAL: Stop automatically as soon as audio completes naturally
      audio.onended = () => {
        currentAudioRef.current = null;
        setPlaybackState('idle');
      };

      audio.onerror = () => {
        currentAudioRef.current = null;
        onFail();
      };

      audio.play().catch(() => {
        onFail();
      });
    } catch {
      onFail();
    }
  };

  const playBrowserSynthesis = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setPlaybackState('idle');
      return;
    }

    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      const langCode = targetLang.bcp47 || targetLang.code || 'en-US';
      utterance.lang = langCode;
      utterance.rate = playbackSpeed;
      utterance.pitch = 1.25;

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

      const femaleVoice =
        matchingVoices.find((v) => {
          const name = v.name.toLowerCase();
          return (
            name.includes('female') ||
            name.includes('girl') ||
            name.includes('woman') ||
            name.includes('zira') ||
            name.includes('samantha') ||
            name.includes('karen') ||
            name.includes('victoria') ||
            name.includes('heera') ||
            name.includes('kalpana') ||
            name.includes('veena') ||
            name.includes('leena') ||
            name.includes('google')
          );
        }) || matchingVoices[0];

      if (femaleVoice) utterance.voice = femaleVoice;

      utterance.onstart = () => {
        isSpeechSynthesisRef.current = true;
        setPlaybackState('playing');
      };

      // CRITICAL: Stop automatically as soon as speech completes
      utterance.onend = () => {
        isSpeechSynthesisRef.current = false;
        setPlaybackState('idle');
      };

      utterance.onerror = () => {
        isSpeechSynthesisRef.current = false;
        setPlaybackState('idle');
      };

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('Browser synthesis failed:', e);
      setPlaybackState('idle');
    }
  };

  const playVoice = async () => {
    if (!textToSpeak.trim()) return;

    stopAllAudio();
    setPlaybackState('loading');

    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    try {
      // Step 1: Call /api/tts (Gemini AI TTS with Kore clear female persona)
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          text: textToSpeak,
          languageCode: targetLang.code,
          languageName: targetLang.name,
          gender: 'female',
        }),
      });

      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        if (data.audioBase64) {
          const buffer = base64ToArrayBuffer(data.audioBase64);
          const isGemini = data.source === 'gemini';

          const played = await playWithWebAudio(buffer, isGemini);
          if (played) return;

          const mime = data.mimeType || (isGemini ? 'audio/wav' : 'audio/mpeg');
          playHtml5Audio(`data:${mime};base64,${data.audioBase64}`, () => {
            playBrowserSynthesis();
          });
          return;
        }
      }

      // Step 2: Direct Google TTS URL fallback
      const directGoogleTtsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(
        textToSpeak.slice(0, 180)
      )}&tl=${encodeURIComponent(targetLang.code)}&client=tw-ob`;

      playHtml5Audio(directGoogleTtsUrl, () => {
        playBrowserSynthesis();
      });
    } catch (err) {
      console.warn('Network TTS failed, falling back to direct voice engine:', err);
      const directGoogleTtsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(
        textToSpeak.slice(0, 180)
      )}&tl=${encodeURIComponent(targetLang.code)}&client=tw-ob`;

      playHtml5Audio(directGoogleTtsUrl, () => {
        playBrowserSynthesis();
      });
    }
  };

  const handleMainButtonClick = () => {
    if (playbackState === 'playing') {
      pauseAudio();
    } else if (playbackState === 'paused') {
      resumeAudio();
    } else {
      playVoice();
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* 🎙️ Voice Assistant Button */}
      <button
        type="button"
        onClick={handleMainButtonClick}
        disabled={disabled || !textToSpeak.trim() || playbackState === 'loading'}
        className={`group relative flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition-all duration-200 shadow-md ${
          playbackState === 'playing'
            ? 'bg-rose-500 text-white shadow-rose-500/40 ring-4 ring-rose-400/50 scale-105'
            : playbackState === 'paused'
            ? 'bg-amber-500 text-slate-950 ring-4 ring-amber-400/40 scale-102 font-black'
            : 'bg-gradient-to-r from-pink-600 via-rose-600 to-indigo-600 hover:from-pink-500 hover:to-rose-500 text-white border-2 border-pink-400/60 shadow-pink-900/40 hover:scale-[1.02] active:scale-[0.98]'
        } ${disabled || !textToSpeak.trim() ? 'opacity-40 cursor-not-allowed saturate-50' : 'cursor-pointer'}`}
      >
        <span className="text-base leading-none" role="img" aria-label="voice assistant">
          🎙️
        </span>

        <div className="flex items-center gap-1.5">
          <span>
            {playbackState === 'loading'
              ? 'Loading...'
              : playbackState === 'playing'
              ? 'Speaking (Click Pause)'
              : playbackState === 'paused'
              ? 'Paused (Click Resume)'
              : 'Voice Assistant'}
          </span>

          {playbackState === 'loading' ? (
            <Loader2 className="w-4 h-4 animate-spin text-white" />
          ) : playbackState === 'playing' ? (
            <Pause className="w-3.5 h-3.5 fill-current" />
          ) : playbackState === 'paused' ? (
            <Play className="w-3.5 h-3.5 fill-current text-slate-950" />
          ) : (
            <Volume2 className="w-4 h-4 text-white group-hover:scale-110 transition-transform" />
          )}
        </div>

        {/* Live sound wave when playing */}
        {playbackState === 'playing' && (
          <span className="flex items-center gap-0.5 ml-1">
            <span className="w-1 h-3.5 bg-white rounded-full animate-bounce [animation-delay:-0.2s]" />
            <span className="w-1 h-4.5 bg-white rounded-full animate-bounce [animation-delay:-0.1s]" />
            <span className="w-1 h-3 bg-white rounded-full animate-bounce" />
          </span>
        )}
      </button>

      {/* Dedicated Pause / Resume Button when active */}
      {(playbackState === 'playing' || playbackState === 'paused') && (
        <button
          type="button"
          onClick={playbackState === 'playing' ? pauseAudio : resumeAudio}
          className="flex items-center gap-1 px-3 py-2 rounded-xl bg-slate-800 text-amber-300 hover:text-white hover:bg-amber-600 border-2 border-slate-700 hover:border-amber-400 text-xs font-bold transition-all shadow-md cursor-pointer"
          title={playbackState === 'playing' ? 'Pause playback' : 'Resume playback'}
        >
          {playbackState === 'playing' ? (
            <>
              <Pause className="w-3.5 h-3.5" />
              <span>Pause</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Resume</span>
            </>
          )}
        </button>
      )}

      {/* Stop button when speaking or paused */}
      {(playbackState === 'playing' || playbackState === 'paused') && (
        <button
          type="button"
          onClick={stopAllAudio}
          className="flex items-center gap-1 px-3 py-2 rounded-xl bg-slate-800 text-rose-400 hover:text-white hover:bg-rose-600 border-2 border-slate-700 hover:border-rose-500 text-xs font-bold transition-colors shadow-md cursor-pointer"
          title="Stop speech completely"
        >
          <Square className="w-3 h-3 fill-current" />
          <span>Stop</span>
        </button>
      )}

      {/* Speed Selector */}
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
