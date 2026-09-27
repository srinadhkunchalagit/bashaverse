import { GoogleGenAI } from '@google/genai';

async function fetchGoogleTTSAudio(text: string, langCode: string): Promise<Buffer | null> {
  try {
    const cleanText = text.trim();
    if (!cleanText) return null;

    // Split text into chunks up to 180 chars on whitespace to respect Google TTS length limits
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

    // Limit to max 6 chunks to avoid timeout
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

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');

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

    const { text, languageCode, languageName, gender } = body || {};

    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Text is required for speech synthesis.' });
    }

    const langCode = (languageCode || 'en').toLowerCase();
    const isFemale = gender === 'female';
    const voiceName = isFemale ? 'Kore' : 'Puck';
    const speakerStyle = isFemale
      ? `Clear, natural native female speaker fluent in ${languageName || 'the target language'}`
      : `Clear, natural native male speaker fluent in ${languageName || 'the target language'}`;

    const apiKey = process.env.GEMINI_API_KEY;

    // 1. Try Gemini AI TTS first if API key is present
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

        if (audioPart?.inlineData?.data) {
          return res.status(200).json({
            audioBase64: audioPart.inlineData.data,
            mimeType: audioPart.inlineData.mimeType || 'audio/wav',
            source: 'gemini',
            gender: isFemale ? 'female' : 'male',
          });
        }
      } catch (geminiError: any) {
        console.warn('Gemini TTS unavailable, falling back to Google TTS engine:', geminiError?.message);
      }
    }

    // 2. High-reliability fallback: Google TTS engine (always works on Vercel without API key)
    const audioBuffer = await fetchGoogleTTSAudio(text, langCode);
    if (audioBuffer && audioBuffer.length > 0) {
      return res.status(200).json({
        audioBase64: audioBuffer.toString('base64'),
        mimeType: 'audio/mpeg',
        source: 'google-tts',
        gender: isFemale ? 'female' : 'male',
      });
    }

    // 3. Fallback to client browser synthesis
    return res.status(200).json({ fallbackToBrowser: true, gender: isFemale ? 'female' : 'male' });
  } catch (error: any) {
    console.warn('Vercel TTS error, client fallback triggered:', error?.message);
    return res.status(200).json({ fallbackToBrowser: true });
  }
}
