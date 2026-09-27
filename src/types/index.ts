export interface Language {
  code: string;
  name: string;
  nativeName: string;
  bcp47: string;
  region: 'India' | 'Asia' | 'Europe' | 'Americas' | 'Africa' | 'Middle East' | 'Oceania';
  flag: string;
  popular?: boolean;
  isIndian?: boolean;
}

export type IndianAppLocale =
  | 'en'
  | 'hi'
  | 'te'
  | 'ta'
  | 'bn'
  | 'mr'
  | 'gu'
  | 'kn'
  | 'ml'
  | 'pa'
  | 'or'
  | 'ur'
  | 'as';

export interface TranslationResult {
  originalText: string;
  sourceLang: string;
  targetLang: string;
  translatedText: string;
  transliteration?: string;
  detectedSourceLang?: string;
  audioPronunciationNotes?: string;
  formality?: string;
  timestamp: number;
}

export interface TTSRequest {
  text: string;
  languageCode: string;
  languageName: string;
  gender: 'female' | 'male';
}

export interface TTSResponse {
  audioBase64?: string;
  mimeType?: string;
  fallbackToBrowser?: boolean;
}
