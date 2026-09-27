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
    return res.json({
      translation: parsed.translation || '',
      transliteration: parsed.transliteration || '',
      detectedSourceLang: parsed.detectedSourceLang || '',
    });
  } catch (error: any) {
    console.error('Translation error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to translate. Please check input and try again.',
    });
  }
});

// 2. TTS Voice Endpoint (Girl & Boy voice generation)
app.post('/api/tts', async (req: Request, res: Response) => {
  try {
    const { text, languageCode, languageName, gender } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text is required for speech synthesis.' });
    }

    // Female voice: 'Kore' or 'Zephyr'; Male voice: 'Puck' or 'Fenrir'
    const isFemale = gender === 'female';
    const voiceName = isFemale ? 'Kore' : 'Puck';
    const speakerStyle = isFemale
      ? `Clear, natural native female speaker fluent in ${languageName || 'the target language'}`
      : `Clear, natural native male speaker fluent in ${languageName || 'the target language'}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash-lite-tts',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: text,
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

    if (audioPart && audioPart.inlineData) {
      return res.json({
        audioBase64: audioPart.inlineData.data,
        mimeType: audioPart.inlineData.mimeType || 'audio/mp3',
      });
    }

    return res.json({ fallbackToBrowser: true });
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
