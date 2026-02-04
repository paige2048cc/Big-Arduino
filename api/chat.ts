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

// Supported Gemini model
const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

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

  // Get API key from environment variable (set in Vercel dashboard)
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('GEMINI_API_KEY environment variable is not configured');
    return res.status(500).json({
      content: '',
      error: 'Server configuration error: API key not configured'
    });
  }

  // Parse and validate request body
  let message: string;
  let systemPrompt: string;
  let context: string;

  try {
    const body = req.body as ChatRequest;
    message = body?.message;
    systemPrompt = body?.systemPrompt || '';
    context = body?.context || '';

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ content: '', error: 'Message is required' });
    }
  } catch {
    return res.status(400).json({ content: '', error: 'Invalid request body' });
  }

  // Build the full prompt
  const fullPrompt = `${systemPrompt}

${context}

User Question: ${message}`;

  // Call Gemini API
  let response: Response;
  try {
    response = await fetch(GEMINI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
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
  } catch (fetchError) {
    console.error('Network error calling Gemini API:', fetchError);
    return res.status(502).json({
      content: '',
      error: 'Failed to connect to AI service'
    });
  }

  // Parse Gemini response
  let data: GeminiResponse;
  try {
    data = await response.json() as GeminiResponse;
  } catch {
    console.error('Failed to parse Gemini API response');
    return res.status(502).json({
      content: '',
      error: 'Invalid response from AI service'
    });
  }

  // Handle Gemini API errors
  if (!response.ok) {
    const errorMessage = data.error?.message || `HTTP ${response.status}`;
    console.error('Gemini API error:', errorMessage);

    // Map common error codes to user-friendly messages
    if (response.status === 401 || response.status === 403) {
      return res.status(502).json({
        content: '',
        error: 'AI service authentication failed'
      });
    }
    if (response.status === 429) {
      return res.status(429).json({
        content: '',
        error: 'AI service rate limit exceeded. Please try again later.'
      });
    }
    if (response.status === 404) {
      return res.status(502).json({
        content: '',
        error: 'AI model not available'
      });
    }

    return res.status(502).json({
      content: '',
      error: `AI service error: ${errorMessage}`
    });
  }

  // Extract text from response
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    console.error('No text in Gemini response:', JSON.stringify(data));
    return res.status(502).json({
      content: '',
      error: 'AI service returned empty response'
    });
  }

  return res.status(200).json({ content: text });
}
