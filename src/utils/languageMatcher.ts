import { Language } from '../types';
import { LANGUAGES, AUTO_DETECT_LANGUAGE } from '../data/languages';

// Comprehensive language aliases map (spoken variations, phonetic spellings, native pronunciations)
const LANGUAGE_ALIASES: Record<string, string[]> = {
  te: ['telugu', 'telgu', 'theugu', 'telugoo', 'telug', 'తెలుగు', 'andhra'],
  hi: ['hindi', 'hindi language', 'hindu', 'hndi', 'hindee', 'हिन्दी', 'हिंदी'],
  en: ['english', 'inglish', 'englesh', 'eng', 'american', 'british', 'angrezi'],
  ta: ['tamil', 'tamizh', 'thamil', 'tamul', 'தமிழ்'],
  kn: ['kannada', 'kanada', 'kannad', 'canarese', 'ಕನ್ನಡ'],
  ml: ['malayalam', 'malyalam', 'malayalam language', 'kerala', 'മലയാളം'],
  bn: ['bengali', 'bangla', 'bangali', 'বাংলা'],
  mr: ['marathi', 'marati', 'मराठी', 'maharashtrian'],
  gu: ['gujarati', 'gujrati', 'gujarati language', 'ગુજરાતી'],
  pa: ['punjabi', 'panjabi', 'punjabi language', 'ਪੰਜਾਬੀ'],
  or: ['odia', 'oriya', 'orissa', 'ଓଡ଼ିଆ'],
  ur: ['urdu', 'oorzoo', 'اردو'],
  as: ['assamese', 'asomiya', 'asamiya', 'অসমীয়া'],
  sa: ['sanskrit', 'sanskriti', 'संस्कृतम्', 'samskritam'],
  ne: ['nepali', 'nepalese', 'नेपाली'],
  es: ['spanish', 'espanol', 'español', 'castilian', 'spain'],
  fr: ['french', 'francais', 'français', 'france'],
  de: ['german', 'deutsch', 'germany', 'aleman'],
  ja: ['japanese', 'japan', 'nihongo', '日本語'],
  zh: ['chinese', 'mandarin', 'simplified chinese', 'china', 'zhongwen', '中文'],
  ko: ['korean', 'korea', 'hangul', '한국어'],
  ar: ['arabic', 'arab', 'arabia', 'العربية'],
  ru: ['russian', 'russia', 'russkiy', 'Русский'],
  it: ['italian', 'italiano', 'italy'],
  pt: ['portuguese', 'portugues', 'português', 'brazil'],
  tr: ['turkish', 'turkce', 'türkçe', 'turkey'],
  vi: ['vietnamese', 'vietnam', 'tieng viet', 'tiếng việt'],
  th: ['thai', 'thailand', 'ไทย'],
  id: ['indonesian', 'indonesia', 'bahasa indonesia'],
  auto: ['auto', 'detect', 'auto detect', 'automatic', 'identify'],
};

// Simple Levenshtein distance for fuzzy matching
function levenshteinDistance(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;
  const dp: number[][] = [];

  for (let i = 0; i <= m; i++) {
    dp[i] = [i];
  }
  for (let j = 0; j <= n; j++) {
    dp[0][j] = j;
  }

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1, // deletion
          dp[i][j - 1] + 1, // insertion
          dp[i - 1][j - 1] + 1 // substitution
        );
      }
    }
  }

  return dp[m][n];
}

function stringSimilarity(s1: string, s2: string): number {
  const longer = s1.length > s2.length ? s1 : s2;
  if (longer.length === 0) return 1.0;
  const dist = levenshteinDistance(s1, s2);
  return (longer.length - dist) / longer.length;
}

/**
 * Normalizes speech input by stripping common voice command prefixes/suffixes
 */
export function cleanLanguageUtterance(spokenText: string): string {
  if (!spokenText) return '';
  let text = spokenText.toLowerCase().trim();

  // Remove common polite or intent words
  text = text.replace(/^(please\s+|can\s+you\s+|i\s+want\s+|change\s+to\s+|switch\s+to\s+|select\s+|choose\s+|translate\s+to\s+|translate\s+into\s+|set\s+to\s+|language\s+)/i, '');
  text = text.replace(/\s+(please|language|now|thanks)$/i, '');
  text = text.replace(/[.,!?'"()\-]/g, ' ').trim();
  text = text.replace(/\s+/g, ' ');

  return text;
}

/**
 * Intelligent Language Matcher
 * Returns the matched Language object immediately with zero user confirmation required.
 */
export function matchLanguageFromSpeech(
  spokenText: string,
  allowAutoDetect = false
): { language: Language | null; confidence: number; matchedName: string } {
  const clean = cleanLanguageUtterance(spokenText);
  if (!clean) {
    return { language: null, confidence: 0, matchedName: '' };
  }

  const candidateLanguages = allowAutoDetect ? [AUTO_DETECT_LANGUAGE, ...LANGUAGES] : LANGUAGES;

  // 1. Exact alias match (highest confidence)
  for (const [code, aliases] of Object.entries(LANGUAGE_ALIASES)) {
    if (!allowAutoDetect && code === 'auto') continue;
    for (const alias of aliases) {
      if (clean === alias || clean === `to ${alias}` || clean === `${alias} language`) {
        const found = candidateLanguages.find((l) => l.code === code);
        if (found) {
          return { language: found, confidence: 1.0, matchedName: found.name };
        }
      }
    }
  }

  // 2. Exact match against candidate properties (name, nativeName, code)
  for (const lang of candidateLanguages) {
    const nameLower = lang.name.toLowerCase();
    const nativeLower = lang.nativeName.toLowerCase();
    const codeLower = lang.code.toLowerCase();

    if (
      clean === nameLower ||
      clean === nativeLower ||
      clean === codeLower ||
      clean.startsWith(`${nameLower} `) ||
      clean.endsWith(` ${nameLower}`)
    ) {
      return { language: lang, confidence: 0.95, matchedName: lang.name };
    }
  }

  // 3. Substring inclusion check (e.g. user said "i want to speak in telugu")
  for (const lang of candidateLanguages) {
    const nameLower = lang.name.toLowerCase();
    if (nameLower.length >= 4 && clean.includes(nameLower)) {
      return { language: lang, confidence: 0.9, matchedName: lang.name };
    }
  }

  for (const [code, aliases] of Object.entries(LANGUAGE_ALIASES)) {
    if (!allowAutoDetect && code === 'auto') continue;
    for (const alias of aliases) {
      if (alias.length >= 4 && clean.includes(alias)) {
        const found = candidateLanguages.find((l) => l.code === code);
        if (found) {
          return { language: found, confidence: 0.88, matchedName: found.name };
        }
      }
    }
  }

  // 4. Fuzzy Similarity matching for slight speech errors (e.g. "telgu", "englis", "tamul", "kannad")
  let bestMatch: Language | null = null;
  let highestScore = 0;

  for (const lang of candidateLanguages) {
    const nameLower = lang.name.toLowerCase();
    const score = stringSimilarity(clean, nameLower);
    if (score > highestScore && score >= 0.72) {
      highestScore = score;
      bestMatch = lang;
    }

    // Check against aliases
    const aliases = LANGUAGE_ALIASES[lang.code] || [];
    for (const alias of aliases) {
      const aliasScore = stringSimilarity(clean, alias);
      if (aliasScore > highestScore && aliasScore >= 0.72) {
        highestScore = aliasScore;
        bestMatch = lang;
      }
    }
  }

  if (bestMatch && highestScore >= 0.72) {
    return { language: bestMatch, confidence: highestScore, matchedName: bestMatch.name };
  }

  return { language: null, confidence: 0, matchedName: '' };
}
