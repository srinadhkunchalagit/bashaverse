import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Loader2, Sparkles, Check } from 'lucide-react';
import { LocaleStrings } from '../data/locales';

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

interface VoiceInputButtonProps {
  sourceLangBcp47: string;
  onTranscription: (text: string) => void;
  strings: LocaleStrings;
  disabled?: boolean;
}

export const VoiceInputButton: React.FC<VoiceInputButtonProps> = ({
  sourceLangBcp47,
  onTranscription,
  strings,
  disabled = false,
}) => {
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [isProcessingAudio, setIsProcessingAudio] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);
  const latestSpeechTextRef = useRef<string>('');

  useEffect(() => {
    return () => {
      stopListening();
    };
  }, []);

  const getEffectiveLanguage = (): string => {
    if (sourceLangBcp47 && sourceLangBcp47 !== 'auto') {
      return sourceLangBcp47;
    }
    if (typeof navigator !== 'undefined' && navigator.language) {
      return navigator.language;
    }
    return 'en-IN';
  };

  const startListening = async () => {
    setErrorMsg(null);
    setInterimText('');
    latestSpeechTextRef.current = '';
    setRecordingSeconds(0);

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognitionRef.current = recognition;

        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;
        recognition.lang = getEffectiveLanguage();

        recognition.onstart = () => {
          setIsListening(true);
          timerRef.current = setInterval(() => {
            setRecordingSeconds((prev) => prev + 1);
          }, 1000);
        };

        // Anti-duplication on mobile & laptop: Rebuild cumulative transcript from all result indices
        recognition.onresult = (event: any) => {
          let fullTranscript = '';
          let currentInterim = '';

          for (let i = 0; i < event.results.length; ++i) {
            const transcript = event.results[i][0]?.transcript || '';
            if (event.results[i].isFinal) {
              fullTranscript += (fullTranscript ? ' ' : '') + transcript.trim();
            } else {
              currentInterim += (currentInterim ? ' ' : '') + transcript.trim();
            }
          }

          const combined = fullTranscript || currentInterim;
          if (combined) {
            latestSpeechTextRef.current = fullTranscript || currentInterim;
            setInterimText(currentInterim || fullTranscript);
          }
        };

        recognition.onerror = (event: any) => {
          console.warn('SpeechRecognition error:', event.error);
          if (event.error === 'not-allowed') {
            setErrorMsg('Microphone access denied. Please allow microphone permissions.');
            stopListening();
          } else if (event.error === 'no-speech') {
            // Keep active
          } else {
            // If browser speech recognition fails on laptop/mobile network, switch to Gemini audio recording
            startGeminiAudioRecording();
          }
        };

        recognition.onend = () => {
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          setIsListening(false);
          setInterimText('');

          const finalText = latestSpeechTextRef.current.trim();
          if (finalText) {
            onTranscription(finalText);
          }
        };

        recognition.start();
        return;
      } catch (err) {
        console.warn('SpeechRecognition initialization error, using Gemini audio recorder:', err);
      }
    }

    // Direct Gemini High-Precision Audio Recording fallback
    startGeminiAudioRecording();
  };

  const startGeminiAudioRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4'
          : '',
      });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const mimeType = mediaRecorder.mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        if (audioBlob.size > 0) {
          await transcribeWithGemini(audioBlob, mimeType);
        }
      };

      mediaRecorder.start(250);
      setIsListening(true);
      timerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error('Microphone recording error:', err);
      setErrorMsg('Microphone access required. Please check browser permissions.');
      setIsListening(false);
    }
  };

  const transcribeWithGemini = async (blob: Blob, mimeType: string) => {
    setIsProcessingAudio(true);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        const base64Audio = (reader.result as string).split(',')[1];
        const res = await fetch('/api/transcribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            audioBase64: base64Audio,
            mimeType: mimeType || 'audio/webm',
            langCode: getEffectiveLanguage(),
          }),
        });

        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('application/json')) {
          const data = await res.json();
          if (data.text && data.text.trim()) {
            onTranscription(data.text.trim());
          } else if (data.error) {
            setErrorMsg(data.error);
          }
        }
      };
    } catch (err) {
      console.error('Transcription error:', err);
      setErrorMsg('Failed to process voice audio.');
    } finally {
      setIsProcessingAudio(false);
      setIsListening(false);
    }
  };

  const stopListening = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // ignore
      }
    }

    setIsListening(false);
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  return (
    <div className="flex flex-col items-center">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={toggleListening}
          disabled={disabled || isProcessingAudio}
          title={isListening ? 'Click to Stop Speaking' : 'Click to Speak (Voice Input)'}
          className={`relative group flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all duration-200 shadow-md ${
            isListening
              ? 'bg-rose-600 text-white shadow-rose-600/50 ring-4 ring-rose-400 animate-pulse'
              : 'bg-emerald-600 hover:bg-emerald-500 text-white border-2 border-emerald-400/60 shadow-emerald-950/40 hover:scale-[1.02] active:scale-[0.98]'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          {isProcessingAudio ? (
            <Loader2 className="w-4 h-4 animate-spin text-white" />
          ) : isListening ? (
            <Check className="w-4 h-4 text-white stroke-[3]" />
          ) : (
            <Mic className="w-4 h-4 text-white group-hover:scale-110 transition-transform" />
          )}

          <span className="font-bold">
            {isProcessingAudio
              ? 'Transcribing...'
              : isListening
              ? `Done Speaking (${recordingSeconds}s)`
              : 'Voice Input'}
          </span>

          {/* Equalizer animation when listening */}
          {isListening && (
            <span className="flex items-center gap-0.5 ml-1">
              <span className="w-1 h-3 bg-white rounded-full animate-bounce [animation-delay:-0.3s]" />
              <span className="w-1 h-4 bg-white rounded-full animate-bounce [animation-delay:-0.15s]" />
              <span className="w-1 h-2 bg-white rounded-full animate-bounce" />
            </span>
          )}
        </button>
      </div>

      {/* Floating Status Notification */}
      {isListening && (
        <div className="mt-1.5 text-xs font-bold text-amber-300 bg-amber-950/90 px-3 py-1 rounded-full border border-amber-500/50 flex items-center gap-2 animate-in fade-in shadow-lg max-w-xs truncate">
          <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
          <span>{interimText ? `"${interimText}"` : 'Listening... Speak naturally'}</span>
        </div>
      )}

      {errorMsg && (
        <div className="mt-1.5 text-xs font-bold text-rose-200 bg-rose-950/90 px-3 py-1 rounded-full border border-rose-500/50 shadow-lg">
          {errorMsg}
        </div>
      )}
    </div>
  );
};
