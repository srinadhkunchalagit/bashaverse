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
  try {
    const { text, sourceLangCode, sourceLangName, targetLangCode, targetLangName } = req.body;

    if (!text || !targetLangCode) {
      return res.status(400).json({ error: 'Text and target language are required.' });
    }

    const prompt = `You are a world-class professional translator and linguistic expert.
Translate the following text accurately, preserving nuance, cultural context, and natural flow.
Source Language: ${sourceLangCode === 'auto' ? 'Auto-Detect the language' : `${sourceLangName} (${sourceLangCode})`}
Target Language: ${targetLangName} (${targetLangCode})

Input text:
"""${text}"""

Provide a JSON response with:
1. "translation": The exact translated text in ${targetLangName}.
2. "transliteration": Romanized phonetic pronunciation guide (how to pronounce it using English/Latin alphabet, especially helpful for Indian scripts like Telugu, Hindi, Tamil, Bengali or Asian/Cyrillic/Arabic scripts).
3. "detectedSourceLang": If source was auto-detect, specify the identified source language name, otherwise empty.`;

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
          },
          required: ['translation'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    if (parsed.translation) {
      return res.json({
        translation: parsed.translation || '',
        transliteration: parsed.transliteration || '',
        detectedSourceLang: parsed.detectedSourceLang || '',
      });
    }
  } catch (geminiError: any) {
    console.warn('Gemini translation error, falling back to Google Translate engine:', geminiError?.message);
  }

  // Fallback to Google Translate
  try {
    const { text, sourceLangCode, targetLangCode } = req.body;
    const sl = sourceLangCode === 'auto' ? 'auto' : sourceLangCode;
    const tl = targetLangCode;
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(
      sl
    )}&tl=${encodeURIComponent(tl)}&dt=t&dt=rm&q=${encodeURIComponent((text || '').trim())}`;

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
        return res.json({
          translation: fullTranslation,
          transliteration,
          detectedSourceLang,
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

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-transcribe',
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

  app.listen(PORT, () => {
    console.log(`BhashaVerse server running on port ${PORT}`);
  });
}

startServer();
