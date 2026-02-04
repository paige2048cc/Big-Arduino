import type { VercelRequest, VercelResponse } from '@vercel/node';

// Request body interface
interface ChatRequest {
  message: string;
  systemPrompt: string;
  context: string;
}

// Response interface
interface ChatResponse {
  content: string;
  error?: string;
}

// Gemini API response structure
interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
  error?: {
    message: string;
    code: number;
  };
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ content: '', error: 'Method not allowed' });
  }

  const apiKey = 'AIzaSyBHaBsPNC68LBQbvMojTDDsMRki4QdVnYs';

  try {
    const { message, systemPrompt, context } = req.body as ChatRequest;

    if (!message) {
      return res.status(400).json({ content: '', error: 'Message is required' });
    }

    // Build the full prompt
    const fullPrompt = `${systemPrompt || ''}

${context || ''}

User Question: ${message}`;

    const apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: fullPrompt
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2048,
        }
      })
    });

    const data = await response.json() as GeminiResponse;

    if (!response.ok) {
      console.error('Gemini API error:', data.error?.message || response.statusText);
      throw new Error(data.error?.message || `HTTP ${response.status}`);
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (text) {
      return res.status(200).json({ content: text });
    } else {
      throw new Error('No text in response');
    }

  } catch (error) {
    console.error('Gemini API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({
      content: '',
      error: `API request failed: ${errorMessage}`
    });
  }
}
