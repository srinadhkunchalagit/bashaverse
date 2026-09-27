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
    if (!apiKey) {
      // If GEMINI_API_KEY is not set on Vercel, return 503 so client-side fallback triggers seamlessly
      return res.status(503).json({ error: 'GEMINI_API_KEY not configured on serverless environment' });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

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
    return res.status(200).json({
      translation: parsed.translation || '',
      transliteration: parsed.transliteration || '',
      detectedSourceLang: parsed.detectedSourceLang || '',
    });
  } catch (error: any) {
    console.error('Vercel serverless translation error:', error);
    return res.status(500).json({
      error: error.message || 'Translation failed on serverless function',
    });
  }
}
