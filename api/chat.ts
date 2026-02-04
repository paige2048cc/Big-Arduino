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
  res: VercelResponse<ChatResponse>
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

  // Get API key from environment (Vercel injects this)
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('GEMINI_API_KEY not configured');
    return res.status(500).json({ content: '', error: 'API key not configured' });
  }

  try {
    const { message, systemPrompt, context } = req.body as ChatRequest;

    if (!message) {
      return res.status(400).json({ content: '', error: 'Message is required' });
    }

    // Build the full prompt
    const fullPrompt = `${systemPrompt || ''}

${context || ''}

User Question: ${message}`;

    // Use Gemini REST API directly with v1 endpoint
    // Try multiple models in order of preference
    const models = [
      'gemini-2.0-flash',
      'gemini-1.5-flash',
      'gemini-1.5-pro',
      'gemini-pro'
    ];

    let lastError: Error | null = null;

    for (const modelName of models) {
      try {
        const apiUrl = `https://generativelanguage.googleapis.com/v1/models/${modelName}:generateContent?key=${apiKey}`;

        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
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
          console.log(`Model ${modelName} failed:`, data.error?.message || response.statusText);
          lastError = new Error(data.error?.message || `HTTP ${response.status}`);
          continue; // Try next model
        }

        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (text) {
          console.log(`Successfully used model: ${modelName}`);
          return res.status(200).json({ content: text });
        } else {
          lastError = new Error('No text in response');
          continue;
        }
      } catch (modelError) {
        console.log(`Model ${modelName} error:`, modelError);
        lastError = modelError instanceof Error ? modelError : new Error(String(modelError));
        continue;
      }
    }

    // All models failed
    throw lastError || new Error('All models failed');

  } catch (error) {
    console.error('Gemini API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({
      content: '',
      error: `API request failed: ${errorMessage}`
    });
  }
}
