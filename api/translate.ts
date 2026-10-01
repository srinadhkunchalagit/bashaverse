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
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        // use raw body
      }
    }

    const { text, sourceLangCode, sourceLangName, targetLangCode, targetLangName } = body || {};

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
Accurately translate the text while capturing full conversational and cultural nuance.
Source Language: ${sourceLangCode === 'auto' ? 'Auto-Detect language' : `${sourceLangName} (${sourceLangCode})`}
Target Language: ${targetLangName} (${targetLangCode})

Input text:
"""${text.trim()}"""

CRITICAL INSTRUCTIONS FOR NATIVE SCRIPT AND ACCURATE TRANSLATION:
1. "detectedSourceLang": Identify the true language of the input.
   - If the user wrote an Indian language (e.g., Telugu, Hindi, Tamil, Kannada, Malayalam, Bengali, Marathi, Gujarati, Punjabi) using English/Latin alphabet (e.g. "ela unnaru" is Telugu; "namaste kaise ho" is Hindi; "epdi irukinga" is Tamil), identify that language.
2. "sourceNativeScript":
   - If the input was written in English/Latin letters but represents an Indian or regional language, convert the user's input into its authentic native script (e.g., "ela unnaru" -> "ఎలా ఉన్నారు", "namaste aap kaise ho" -> "नमस्ते आप कैसे हो").
   - If already in native script or standard English, return the text in native script.
3. "translation": Natural, accurate translation into ${targetLangName} (${targetLangCode}).
4. "transliteration": Romanized phonetic pronunciation guide for the translation.`;

        const modelsToTry = ['gemini-3.8-flash', 'gemini-3.1-flash-lite'];
        for (const modelName of modelsToTry) {
          try {
            const response = await ai.models.generateContent({
              model: modelName,
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
            if (parsed.translation && parsed.translation.trim()) {
              return res.status(200).json({
                translation: parsed.translation.trim(),
                transliteration: parsed.transliteration || '',
                detectedSourceLang: parsed.detectedSourceLang || '',
                sourceNativeScript: parsed.sourceNativeScript || '',
              });
            }
          } catch (modelErr) {
            // try next model
          }
        }
      } catch (geminiError: any) {
        console.warn('Gemini translation failed, using Google Translate fallback:', geminiError?.message);
      }
    }

    // Server-side fallback: Google Translate Web API
    try {
      const sl = sourceLangCode === 'auto' ? 'auto' : sourceLangCode;
      const tl = targetLangCode;
      const cleanText = text.trim();
      const url = `https://translate.googleapis.com/translate_a/single?client=dict-chrome-ex&sl=${encodeURIComponent(
        sl
      )}&tl=${encodeURIComponent(tl)}&dt=t&dt=rm&q=${encodeURIComponent(cleanText)}`;

      const gRes = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          Accept: '*/*',
        },
      });

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
        if (gData && typeof gData[2] === 'string') {
          detectedSourceLang = gData[2];
        }

        let sourceNativeScript = '';
        const checkLang = (detectedSourceLang || sourceLangCode || 'hi').toLowerCase();
        const indicCodes = ['hi', 'te', 'ta', 'bn', 'mr', 'gu', 'kn', 'ml', 'pa', 'or', 'ur'];
        if (indicCodes.includes(checkLang) && /^[a-zA-Z0-9\s.,!?'"()-]+$/.test(cleanText)) {
          try {
            const inputToolsUrl = `https://inputtools.google.com/request?text=${encodeURIComponent(
              cleanText
            )}&itc=${checkLang}-t-i0-und&num=1`;
            const itRes = await fetch(inputToolsUrl);
            if (itRes.ok) {
              const itData = await itRes.json();
              if (itData && itData[0] === 'SUCCESS' && itData[1]?.[0]?.[1]?.[0]) {
                sourceNativeScript = itData[1][0][1][0];
              }
            }
          } catch {
            // ignore
          }
        }

        if (fullTranslation.trim()) {
          return res.status(200).json({
            translation: fullTranslation.trim(),
            transliteration,
            detectedSourceLang,
            sourceNativeScript,
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
