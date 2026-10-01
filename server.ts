import express, { Request, Response } from 'express';
import path from 'path';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '20mb' }));

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// 1. Translation Endpoint
app.post('/api/translate', async (req: Request, res: Response) => {
  const { text, sourceLangCode, sourceLangName, targetLangCode, targetLangName } = req.body || {};

  if (!text || !text.trim() || !targetLangCode) {
    return res.status(400).json({ error: 'Text and target language are required.' });
  }

  const cleanText = text.trim();

  // Tier 1: Try Gemini AI (Primary: gemini-3.8-flash, Secondary: gemini-3.1-flash-lite)
  if (process.env.GEMINI_API_KEY) {
    const prompt = `You are a world-class professional translator and linguistic expert like Google Translate.
Accurately translate the text while capturing full conversational and cultural nuance.
Source Language: ${sourceLangCode === 'auto' ? 'Auto-Detect language' : `${sourceLangName} (${sourceLangCode})`}
Target Language: ${targetLangName} (${targetLangCode})

Input text:
"""${cleanText}"""

CRITICAL INSTRUCTIONS FOR NATIVE SCRIPT AND ACCURATE TRANSLATION:
1. "detectedSourceLang": Identify the true language of the input.
   - If the user wrote an Indian language (e.g., Telugu, Hindi, Tamil, Kannada, Malayalam, Bengali, Marathi, Gujarati, Punjabi) using English/Latin alphabet (e.g. "ela unnaru" or "meeru ela unnaru" is Telugu; "namaste kaise ho" is Hindi; "epdi irukinga" is Tamil; "kemon acho" is Bengali), identify that language (e.g. "Telugu", "Hindi", "Tamil").

2. "sourceNativeScript":
   - If the input was written in English/Latin letters but represents an Indian or regional language, convert the user's input into its authentic native script (e.g., "ela unnaru" -> "ఎలా ఉన్నారు", "namaste aap kaise ho" -> "नमस्ते आप कैसे हो", "meeru em chesthunnaru" -> "మీరు ఏమి చేస్తున్నారు").
   - If already in native script or standard English, return the text in native script.

3. "translation":
   - The exact, highly natural translation in ${targetLangName} (${targetLangCode}) matching the quality of Google Translate.
   - If the source and target language are the same (e.g. user typed Telugu in English letters "ela unnaru", and target is Telugu), provide the proper native script in "translation" ("ఎలా ఉన్నారు?").

4. "transliteration":
   - Romanized phonetic pronunciation guide for the translation (e.g. "Aap kaise hain?" or "Ela unnaru?").`;

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
          return res.json({
            translation: parsed.translation.trim(),
            transliteration: parsed.transliteration || '',
            detectedSourceLang: parsed.detectedSourceLang || '',
            sourceNativeScript: parsed.sourceNativeScript || '',
          });
        }
      } catch (geminiError: any) {
        console.warn(`Gemini (${modelName}) translation error:`, geminiError?.message);
      }
    }
  }

  // Tier 2: High-reliability Google Translate engine (dict-chrome-ex) + Google Input Tools transliteration
  try {
    const sl = sourceLangCode === 'auto' ? 'auto' : sourceLangCode;
    const tl = targetLangCode;
    const gUrl = `https://translate.googleapis.com/translate_a/single?client=dict-chrome-ex&sl=${encodeURIComponent(
      sl
    )}&tl=${encodeURIComponent(tl)}&dt=t&dt=rm&q=${encodeURIComponent(cleanText)}`;

    const gRes = await fetch(gUrl, {
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

      // Check if source text was typed in English letters and can be converted to native Indic script
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
        } catch (itErr) {
          console.warn('Google Input Tools transliteration failed:', itErr);
        }
      }

      if (fullTranslation.trim()) {
        return res.json({
          translation: fullTranslation.trim(),
          transliteration,
          detectedSourceLang,
          sourceNativeScript,
        });
      }
    }
  } catch (error: any) {
    console.error('Translation fallback error:', error);
  }

  return res.status(500).json({
    error: 'Failed to translate. Please check input and try again.',
  });
});

async function fetchGoogleTTSAudio(text: string, langCode: string): Promise<Buffer | null> {
  try {
    const cleanText = text.trim();
    if (!cleanText) return null;

    const words = cleanText.split(/\s+/);
    const chunks: string[] = [];
    let currentChunk = '';

    for (const word of words) {
      if ((currentChunk + ' ' + word).trim().length > 180) {
        if (currentChunk.trim()) chunks.push(currentChunk.trim());
        currentChunk = word;
      } else {
        currentChunk = (currentChunk + ' ' + word).trim();
      }
    }
    if (currentChunk.trim()) chunks.push(currentChunk.trim());
    if (chunks.length === 0) chunks.push(cleanText.slice(0, 180));

    const validChunks = chunks.slice(0, 6);
    const buffers: Buffer[] = [];

    for (const chunk of validChunks) {
      const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(
        chunk
      )}&tl=${encodeURIComponent(langCode)}&client=tw-ob`;

      const response = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: '*/*',
        },
      });

      if (response.ok) {
        const arr = await response.arrayBuffer();
        buffers.push(Buffer.from(arr));
      }
    }

    if (buffers.length > 0) {
      return Buffer.concat(buffers);
    }
  } catch (error) {
    console.warn('Google TTS fetch error:', error);
  }
  return null;
}

// 2. TTS Voice Endpoint (Girl & Boy voice generation)
app.post('/api/tts', async (req: Request, res: Response) => {
  try {
    const { text, languageCode, languageName, gender } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Text is required for speech synthesis.' });
    }

    const langCode = (languageCode || 'en').toLowerCase();
    const isFemale = gender === 'female';
    const voiceName = isFemale ? 'Kore' : 'Puck';
    const speakerStyle = isFemale
      ? `Clear, natural native female speaker fluent in ${languageName || 'the target language'}`
      : `Clear, natural native male speaker fluent in ${languageName || 'the target language'}`;

    // 1. Try Gemini TTS if API key is configured
    if (process.env.GEMINI_API_KEY) {
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash-lite-tts',
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: text.slice(0, 500),
                  speechMetadata: {
                    style: speakerStyle,
                  },
                },
              ],
            },
          ],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName },
              },
            },
          },
        });

        const candidate = response.candidates?.[0];
        const audioPart = candidate?.content?.parts?.find((p: any) => p.inlineData?.data);

        if (audioPart && audioPart.inlineData?.data) {
          return res.json({
            audioBase64: audioPart.inlineData.data,
            mimeType: audioPart.inlineData.mimeType || 'audio/wav',
            source: 'gemini',
            gender: isFemale ? 'female' : 'male',
          });
        }
      } catch (geminiError: any) {
        console.warn('Gemini TTS error, falling back to Google TTS engine:', geminiError?.message);
      }
    }

    // 2. High-reliability Google TTS engine fallback
    const audioBuffer = await fetchGoogleTTSAudio(text, langCode);
    if (audioBuffer && audioBuffer.length > 0) {
      return res.json({
        audioBase64: audioBuffer.toString('base64'),
        mimeType: 'audio/mpeg',
        source: 'google-tts',
        gender: isFemale ? 'female' : 'male',
      });
    }

    return res.json({ fallbackToBrowser: true, gender: isFemale ? 'female' : 'male' });
  } catch (error: any) {
    console.warn('TTS error (falling back to browser synthesis):', error.message);
    return res.json({ fallbackToBrowser: true, error: error.message });
  }
});

// 3. Audio Transcription Endpoint (Microphone audio recording fallback)
app.post('/api/transcribe', async (req: Request, res: Response) => {
  try {
    const { audioBase64, mimeType, langCode } = req.body;

    if (!audioBase64) {
      return res.status(400).json({ error: 'Audio data is required.' });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({ error: 'Gemini API key is not configured for audio transcription.' });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType || 'audio/webm',
              data: audioBase64,
            },
          },
          {
            text: `Transcribe this speech verbatim into text. Language expected: ${langCode || 'Auto'}. Output only the transcribed spoken text without commentary.`,
          },
        ],
      },
    });

    const text = response.text?.trim() || '';
    return res.json({ text });
  } catch (error: any) {
    console.error('Transcription error:', error);
    return res.status(500).json({ error: 'Failed to transcribe audio.' });
  }
});

// Mount Vite or static build
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve('dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const HOST = '0.0.0.0';
  app.listen(Number(PORT), HOST, () => {
    console.log(`BhashaVerse server running on http://${HOST}:${PORT}`);
  });
}

startServer();
