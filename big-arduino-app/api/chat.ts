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

// Claude API response structure
interface ClaudeResponse {
  content?: Array<{
    type: string;
    text?: string;
  }>;
  error?: {
    type: string;
    message: string;
  };
}

// Claude API configuration
const CLAUDE_MODEL = 'claude-sonnet-4-20250514';
const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';

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
  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) {
    console.error('CLAUDE_API_KEY environment variable is not configured');
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

  // Build the user message with context
  const userMessage = context
    ? `${context}\n\nUser Question: ${message}`
    : message;

  // Call Claude API
  let response: Response;
  try {
    response = await fetch(CLAUDE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 2048,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: userMessage
          }
        ]
      })
    });
  } catch (fetchError) {
    console.error('Network error calling Claude API:', fetchError);
    return res.status(502).json({
      content: '',
      error: 'Failed to connect to AI service'
    });
  }

  // Parse Claude response
  let data: ClaudeResponse;
  try {
    data = await response.json() as ClaudeResponse;
  } catch {
    console.error('Failed to parse Claude API response');
    return res.status(502).json({
      content: '',
      error: 'Invalid response from AI service'
    });
  }

  // Handle Claude API errors
  if (!response.ok) {
    const errorMessage = data.error?.message || `HTTP ${response.status}`;
    console.error('Claude API error:', errorMessage);

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
  const textContent = data.content?.find(c => c.type === 'text');
  const text = textContent?.text;

  if (!text) {
    console.error('No text in Claude response:', JSON.stringify(data));
    return res.status(502).json({
      content: '',
      error: 'AI service returned empty response'
    });
  }

  return res.status(200).json({ content: text });
}
