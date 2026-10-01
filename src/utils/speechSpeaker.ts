// High-clarity female speech synthesizer utility

let currentAudio: HTMLAudioElement | null = null;
let currentSource: AudioBufferSourceNode | null = null;
let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return null;
    if (!audioContext || audioContext.state === 'closed') {
      audioContext = new AudioCtx();
    }
    return audioContext;
  } catch {
    return null;
  }
}

export function stopCurrentSpeech(): void {
  if (currentSource) {
    try {
      currentSource.stop();
      currentSource.disconnect();
    } catch {
      // already stopped
    }
    currentSource = null;
  }

  if (currentAudio) {
    try {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    } catch {
      // ignore
    }
    currentAudio = null;
  }

  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

export async function speakFemaleVoice(
  text: string,
  langCode: string,
  langName?: string,
  rate = 1.0,
  onStart?: () => void,
  onEnd?: () => void,
  onError?: () => void
): Promise<void> {
  const cleanText = text.trim();
  if (!cleanText) return;

  stopCurrentSpeech();

  const ctx = getAudioContext();
  if (ctx && ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }

  // 1. Backend /api/tts
  try {
    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        text: cleanText.slice(0, 500),
        languageCode: langCode,
        languageName: langName || langCode,
        gender: 'female',
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.audioBase64) {
        if (ctx) {
          try {
            const buf = base64ToArrayBuffer(data.audioBase64);
            const decoded = await ctx.decodeAudioData(buf);
            const source = ctx.createBufferSource();
            source.buffer = decoded;
            source.playbackRate.value = rate;

            // Pitch & clarity presence filter for female voice
            if (data.source !== 'gemini' && source.detune) {
              source.detune.value = 180;
            }

            source.connect(ctx.destination);
            currentSource = source;

            onStart?.();

            source.onended = () => {
              currentSource = null;
              onEnd?.();
            };

            source.start(0);
            return;
          } catch {
            // fallback to HTML5 Audio
          }
        }

        // HTML5 Audio playback of base64
        const audio = new Audio(`data:${data.mimeType || 'audio/mpeg'};base64,${data.audioBase64}`);
        audio.playbackRate = rate;
        currentAudio = audio;

        audio.onplay = () => onStart?.();
        audio.onended = () => {
          currentAudio = null;
          onEnd?.();
        };
        audio.onerror = () => {
          currentAudio = null;
          fallbackToBrowserSpeech(cleanText, langCode, rate, onStart, onEnd, onError);
        };

        await audio.play();
        return;
      }
    }
  } catch {
    // continue to fallback
  }

  // 2. Direct Google TTS fallback
  try {
    const googleTtsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(
      cleanText.slice(0, 180)
    )}&tl=${encodeURIComponent(langCode)}&client=tw-ob`;

    const audio = new Audio(googleTtsUrl);
    audio.playbackRate = rate;
    currentAudio = audio;

    audio.onplay = () => onStart?.();
    audio.onended = () => {
      currentAudio = null;
      onEnd?.();
    };
    audio.onerror = () => {
      currentAudio = null;
      fallbackToBrowserSpeech(cleanText, langCode, rate, onStart, onEnd, onError);
    };

    await audio.play();
    return;
  } catch {
    fallbackToBrowserSpeech(cleanText, langCode, rate, onStart, onEnd, onError);
  }
}

function fallbackToBrowserSpeech(
  text: string,
  langCode: string,
  rate = 1.0,
  onStart?: () => void,
  onEnd?: () => void,
  onError?: () => void
): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    onError?.();
    return;
  }

  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = langCode;
    utterance.rate = rate;
    utterance.pitch = 1.25; // crisp female pitch

    const voices = window.speechSynthesis.getVoices();
    const lc = langCode.toLowerCase().slice(0, 2);
    const matchingVoices = voices.filter(
      (v) => v.lang.toLowerCase().startsWith(lc) || v.lang.toLowerCase().replace('_', '-').startsWith(lc)
    );

    const femaleVoice =
      matchingVoices.find((v) => {
        const n = v.name.toLowerCase();
        return (
          n.includes('female') ||
          n.includes('girl') ||
          n.includes('woman') ||
          n.includes('zira') ||
          n.includes('samantha') ||
          n.includes('karen') ||
          n.includes('victoria') ||
          n.includes('veena') ||
          n.includes('leena') ||
          n.includes('google')
        );
      }) || matchingVoices[0];

    if (femaleVoice) {
      utterance.voice = femaleVoice;
    }

    utterance.onstart = () => onStart?.();
    utterance.onend = () => onEnd?.();
    utterance.onerror = () => {
      onError?.();
    };

    window.speechSynthesis.speak(utterance);
  } catch {
    onError?.();
  }
}
