import { GoogleGenerativeAI } from '@google/generative-ai';
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

    // Initialize Gemini
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    // Build the full prompt
    const fullPrompt = `${systemPrompt || ''}

${context || ''}

User Question: ${message}`;

    // Generate response
    const result = await model.generateContent(fullPrompt);
    const response = result.response;
    const text = response.text();

    return res.status(200).json({ content: text });
  } catch (error) {
    console.error('Gemini API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({
      content: '',
      error: `API request failed: ${errorMessage}`
    });
  }
}
