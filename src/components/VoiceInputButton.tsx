import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { LocaleStrings } from '../data/locales';

// Extend window interface for SpeechRecognition
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

  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const startListening = async () => {
    setErrorMsg(null);
    setInterimText('');

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognitionRef.current = recognition;

        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = sourceLangBcp47 === 'auto' ? 'en-US' : sourceLangBcp47;

        recognition.onstart = () => {
          setIsListening(true);
        };

        recognition.onresult = (event: any) => {
          let currentInterim = '';
          let finalTranscript = '';

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript;
            } else {
              currentInterim += event.results[i][0].transcript;
            }
          }

          if (currentInterim) {
            setInterimText(currentInterim);
          }

          if (finalTranscript) {
            onTranscription(finalTranscript);
            setInterimText('');
          }
        };

        recognition.onerror = (event: any) => {
          console.warn('SpeechRecognition error:', event.error);
          if (event.error === 'not-allowed') {
            setErrorMsg('Microphone access denied. Please allow microphone permissions.');
            stopListening();
          } else if (event.error === 'no-speech') {
            // keep listening or reset
          } else {
            // Fallback to media recorder if recognition network failed
            fallbackToMediaRecorder();
          }
        };

        recognition.onend = () => {
          setIsListening(false);
          setInterimText('');
        };

        recognition.start();
      } catch (err) {
        console.warn('Failed to start SpeechRecognition, using audio recording fallback:', err);
        fallbackToMediaRecorder();
      }
    } else {
      fallbackToMediaRecorder();
    }
  };

  const fallbackToMediaRecorder = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        if (audioBlob.size > 0) {
          await transcribeWithGemini(audioBlob);
        }
      };

      mediaRecorder.start();
      setIsListening(true);
    } catch (err) {
      console.error('Microphone error:', err);
      setErrorMsg('Microphone permission required for voice input.');
      setIsListening(false);
    }
  };

  const transcribeWithGemini = async (blob: Blob) => {
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
            mimeType: 'audio/webm',
            langCode: sourceLangBcp47,
          }),
        });
        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('application/json')) {
          const data = await res.json();
          if (data.text) {
            onTranscription(data.text);
          } else if (data.error) {
            setErrorMsg(data.error);
          }
        } else {
          console.warn('Voice transcription endpoint returned non-JSON');
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
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
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
          title={isListening ? strings.stopListening : strings.voiceInput}
          className={`relative group flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all duration-200 shadow-md ${
            isListening
              ? 'bg-rose-600 text-white shadow-rose-600/50 shadow-lg ring-4 ring-rose-400 animate-pulse'
              : 'bg-emerald-600 hover:bg-emerald-500 text-white border-2 border-emerald-400/60 shadow-emerald-950/40 hover:scale-[1.02] active:scale-[0.98]'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          {isProcessingAudio ? (
            <Loader2 className="w-4 h-4 animate-spin text-white" />
          ) : isListening ? (
            <MicOff className="w-4 h-4 text-white" />
          ) : (
            <Mic className="w-4 h-4 text-white group-hover:scale-110 transition-transform" />
          )}

          <span className="hidden sm:inline font-bold">
            {isProcessingAudio
              ? 'Processing voice...'
              : isListening
              ? strings.stopListening
              : strings.voiceInput}
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
        <div className="mt-1.5 text-xs font-bold text-amber-300 bg-amber-950/90 px-3 py-1 rounded-full border border-amber-500/50 flex items-center gap-2 animate-in fade-in shadow-lg">
          <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
          <span>{interimText ? `"${interimText}..."` : strings.listening}</span>
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
