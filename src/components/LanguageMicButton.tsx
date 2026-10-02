import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Loader2, Check } from 'lucide-react';
import { Language } from '../types';
import { matchLanguageFromSpeech } from '../utils/languageMatcher';

interface LanguageMicButtonProps {
  onLanguageSelected: (language: Language) => void;
  allowAutoDetect?: boolean;
  label?: string;
}

export const LanguageMicButton: React.FC<LanguageMicButtonProps> = ({
  onLanguageSelected,
  allowAutoDetect = false,
  label = 'language',
}) => {
  const [isListening, setIsListening] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const feedbackTimeoutRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      stopRecognition();
      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    };
  }, []);

  const showFeedback = (msg: string) => {
    setFeedback(msg);
    if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    feedbackTimeoutRef.current = setTimeout(() => {
      setFeedback(null);
    }, 2800);
  };

  const stopRecognition = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
    setIsListening(false);
  };

  const startListening = () => {
    if (typeof window === 'undefined') return;

    if (isListening) {
      stopRecognition();
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      showFeedback('Voice selection not supported');
      return;
    }

    try {
      stopRecognition();
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;

      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.maxAlternatives = 3;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
        showFeedback(`Say a language (e.g. Telugu, Hindi)...`);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results?.[0]?.[0]?.transcript || '';
        if (transcript) {
          const { language, matchedName } = matchLanguageFromSpeech(
            transcript,
            allowAutoDetect
          );

          if (language) {
            onLanguageSelected(language);
            showFeedback(`✓ Selected ${matchedName}`);
            stopRecognition();
          } else {
            showFeedback(`Couldn't match "${transcript}". Try again.`);
          }
        }
      };

      recognition.onerror = (event: any) => {
        if (event.error === 'not-allowed') {
          showFeedback('Microphone permission denied');
        } else if (event.error === 'no-speech') {
          showFeedback('No speech heard. Tap again');
        } else {
          showFeedback('Voice error. Tap to try again');
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch (err) {
      console.error('Language mic error:', err);
      setIsListening(false);
      showFeedback('Could not start voice recognition');
    }
  };

  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        onClick={startListening}
        title={isListening ? 'Listening... say a language' : `Speak to select ${label}`}
        className={`flex items-center justify-center p-2.5 rounded-xl border-2 transition-all duration-200 shadow-md cursor-pointer ${
          isListening
            ? 'bg-rose-600 text-white border-rose-400 ring-2 ring-rose-400/50 animate-pulse scale-105'
            : 'bg-[#131d3b] hover:bg-cyan-500 text-cyan-300 hover:text-slate-950 border-cyan-500/40 hover:border-cyan-300'
        }`}
      >
        {isListening ? (
          <MicOff className="w-4 h-4 stroke-[2.5]" />
        ) : (
          <Mic className="w-4 h-4 stroke-[2.5]" />
        )}
      </button>

      {/* Floating status tooltip */}
      {feedback && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-3 py-1.5 rounded-xl bg-slate-900 border-2 border-cyan-400 text-cyan-200 text-[11px] font-bold shadow-2xl z-50 whitespace-nowrap animate-in fade-in zoom-in-95 pointer-events-none">
          {feedback}
        </div>
      )}
    </div>
  );
};
