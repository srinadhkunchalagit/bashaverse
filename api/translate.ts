import { GoogleGenAI, Type } from '@google/genai';

export default async function handler(req: any, res: any) {
  // Allow CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { text, sourceLangCode, sourceLangName, targetLangCode, targetLangName } = req.body || {};

    if (!text || !targetLangCode) {
      return res.status(400).json({ error: 'Text and target language are required.' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      try {
        const ai = new GoogleGenAI({
          apiKey,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build',
            },
          },
        });

        const prompt = `You are a world-class professional translator and linguistic expert like Google Translate.
Translate accurately, preserving nuance, conversational tone, and natural flow.
Source Language: ${sourceLangCode === 'auto' ? 'Auto-Detect the language' : `${sourceLangName} (${sourceLangCode})`}
Target Language: ${targetLangName} (${targetLangCode})

Input text:
"""${text}"""

CRITICAL INSTRUCTIONS:
1. "detectedSourceLang": Identify true source language (e.g., Telugu, Hindi, Tamil, English).
2. "sourceNativeScript": If user typed an Indian or regional language using English/Latin alphabet (e.g. "ela unnaru", "namaste kaise ho", "epdi irukinga"), convert it to its authentic native script (e.g. "ఎలా ఉన్నారు", "नमस्ते कैसे हो").
3. "translation": Natural, accurate translation into ${targetLangName}.
4. "transliteration": Romanized phonetic pronunciation guide.`;

        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                translation: {
                  type: Type.STRING,
                  description: 'The translated text in the target language',
                },
                transliteration: {
                  type: Type.STRING,
                  description: 'Romanized phonetic pronunciation guide',
                },
                detectedSourceLang: {
                  type: Type.STRING,
                  description: 'Detected language name if auto-detected',
                },
                sourceNativeScript: {
                  type: Type.STRING,
                  description: 'Input text converted to its native script if typed in English letters',
                },
              },
              required: ['translation'],
            },
          },
        });

        const parsed = JSON.parse(response.text || '{}');
        if (parsed.translation) {
          return res.status(200).json({
            translation: parsed.translation || '',
            transliteration: parsed.transliteration || '',
            detectedSourceLang: parsed.detectedSourceLang || '',
            sourceNativeScript: parsed.sourceNativeScript || '',
          });
        }
      } catch (geminiError: any) {
        console.warn('Gemini translation failed, using Google Translate fallback:', geminiError?.message);
      }
    }

    // Server-side fallback: Google Translate Web API
    try {
      const sl = sourceLangCode === 'auto' ? 'auto' : sourceLangCode;
      const tl = targetLangCode;
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(
        sl
      )}&tl=${encodeURIComponent(tl)}&dt=t&dt=rm&q=${encodeURIComponent(text.trim())}`;

      const gRes = await fetch(url);
      if (gRes.ok) {
        const gData = await gRes.json();
        let fullTranslation = '';
        let transliteration = '';

        if (Array.isArray(gData) && Array.isArray(gData[0])) {
          for (const item of gData[0]) {
            if (item && item[0]) fullTranslation += item[0];
            if (item && item[2] && typeof item[2] === 'string' && !transliteration) {
              transliteration = item[2];
            } else if (item && item[3] && typeof item[3] === 'string' && !transliteration) {
              transliteration = item[3];
            }
          }
        }

        let detectedSourceLang = '';
        if (sourceLangCode === 'auto' && gData[2] && typeof gData[2] === 'string') {
          detectedSourceLang = gData[2];
        }

        if (fullTranslation.trim()) {
          return res.status(200).json({
            translation: fullTranslation,
            transliteration,
            detectedSourceLang,
          });
        }
      }
    } catch (fallbackError) {
      console.warn('Google Translate API fallback error:', fallbackError);
    }
  } catch (error: any) {
    console.error('Vercel serverless translation error:', error);
    return res.status(500).json({
      error: error.message || 'Translation failed on serverless function',
    });
  }
}
