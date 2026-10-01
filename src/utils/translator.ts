/**
 * Robust Translation Service with multi-tier fallback:
 * Tier 1: Local / Cloud Run / Vercel Serverless backend API (/api/translate powered by Gemini AI)
 * Tier 2: Direct Google Translate Web API (used by googletrans, works 100% on static Vercel/Netlify with no API key)
 */

export interface TranslationResponse {
  translation: string;
  transliteration?: string;
  detectedSourceLang?: string;
  sourceNativeScript?: string;
}

export async function translateText(
  text: string,
  sourceLangCode: string,
  sourceLangName: string,
  targetLangCode: string,
  targetLangName: string
): Promise<TranslationResponse> {
  const cleanText = text.trim();
  if (!cleanText) {
    throw new Error('Please provide text to translate.');
  }

  // Tier 1: Try backend /api/translate (Gemini AI + server-side Google Translate with Indic transliteration)
  try {
    const response = await fetch('/api/translate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        text: cleanText,
        sourceLangCode,
        sourceLangName,
        targetLangCode,
        targetLangName,
      }),
    });

    const contentType = response.headers.get('content-type') || '';

    // If server responded with valid JSON
    if (response.ok && contentType.includes('application/json')) {
      const data = await response.json();
      if (data.translation) {
        return {
          translation: data.translation,
          transliteration: data.transliteration || '',
          detectedSourceLang: data.detectedSourceLang || '',
          sourceNativeScript: data.sourceNativeScript || '',
        };
      }
    }
  } catch (backendError) {
    console.warn('Backend API translation unavailable, falling back to direct translation engine:', backendError);
  }

  // Tier 2: Direct Google Translate Engine (using high-reliability dict-chrome-ex endpoint)
  try {
    const sl = sourceLangCode === 'auto' ? 'auto' : sourceLangCode;
    const tl = targetLangCode;

    // dt=t (translation), dt=rm (transliteration / romanization)
    const url = `https://translate.googleapis.com/translate_a/single?client=dict-chrome-ex&sl=${encodeURIComponent(
      sl
    )}&tl=${encodeURIComponent(tl)}&dt=t&dt=rm&q=${encodeURIComponent(cleanText)}`;

    const gResponse = await fetch(url);
    if (gResponse.ok) {
      const gData = await gResponse.json();
      let fullTranslation = '';
      let transliteration = '';

      if (Array.isArray(gData) && Array.isArray(gData[0])) {
        for (const item of gData[0]) {
          if (item && item[0]) {
            fullTranslation += item[0];
          }
          if (item && item[2] && typeof item[2] === 'string' && !transliteration) {
            transliteration = item[2];
          } else if (item && item[3] && typeof item[3] === 'string' && !transliteration) {
            transliteration = item[3];
          }
        }
      }

      let detectedSourceLang = '';
      if (gData && typeof gData[2] === 'string') {
        detectedSourceLang = gData[2];
      }

      // Check if input can be transliterated to native script via Google Input Tools
      let sourceNativeScript = '';
      const checkLang = (detectedSourceLang || sourceLangCode || 'hi').toLowerCase();
      const indicCodes = ['hi', 'te', 'ta', 'bn', 'mr', 'gu', 'kn', 'ml', 'pa', 'or', 'ur'];
      if (indicCodes.includes(checkLang) && /^[a-zA-Z0-9\s.,!?'"()-]+$/.test(cleanText)) {
        try {
          const inputToolsUrl = `https://inputtools.google.com/request?text=${encodeURIComponent(cleanText)}&itc=${checkLang}-t-i0-und&num=1`;
          const itRes = await fetch(inputToolsUrl);
          if (itRes.ok) {
            const itData = await itRes.json();
            if (itData && itData[0] === 'SUCCESS' && itData[1]?.[0]?.[1]?.[0]) {
              sourceNativeScript = itData[1][0][1][0];
            }
          }
        } catch {
          // ignore transliteration error
        }
      }

      if (fullTranslation.trim()) {
        return {
          translation: fullTranslation,
          transliteration: transliteration || '',
          detectedSourceLang: detectedSourceLang || '',
          sourceNativeScript,
        };
      }
    }
  } catch (clientError: any) {
    console.warn('Client-side Google Translate error, trying fallback:', clientError);
  }

  throw new Error('Unable to translate at this moment. Please check your internet connection and try again.');
}
