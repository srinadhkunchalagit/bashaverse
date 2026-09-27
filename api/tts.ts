import { GoogleGenAI } from '@google/genai';

export default async function handler(req: any, res: any) {
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
    const { text, languageName, gender } = req.body || {};

    if (!text) {
      return res.status(400).json({ error: 'Text is required for speech synthesis.' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(200).json({ fallbackToBrowser: true });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

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
      return res.status(200).json({
        audioBase64: audioPart.inlineData.data,
        mimeType: audioPart.inlineData.mimeType || 'audio/mp3',
      });
    }

    return res.status(200).json({ fallbackToBrowser: true });
  } catch (error: any) {
    console.warn('Vercel TTS error, client will fallback to browser speech synthesis:', error.message);
    return res.status(200).json({ fallbackToBrowser: true });
  }
}
