import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// Use '/' for Vercel, '/Big-Arduino/' for GitHub Pages
const base = process.env.VERCEL ? '/' : '/Big-Arduino/'

// Supported Gemini model
const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// Local API handler plugin for development
function localApiPlugin(): Plugin {
  return {
    name: 'local-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url === '/api/chat' && req.method === 'POST') {
          // Handle CORS
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

          // Collect request body
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', async () => {
            try {
              const { message, systemPrompt, context } = JSON.parse(body);

              if (!message) {
                res.statusCode = 400;
                res.end(JSON.stringify({ content: '', error: 'Message is required' }));
                return;
              }

              // Get API key from environment variable
              const apiKey = process.env.GEMINI_API_KEY;
              if (!apiKey) {
                console.error('[API] GEMINI_API_KEY environment variable is not set');
                console.error('[API] Create a .env file with GEMINI_API_KEY=your_key');
                res.statusCode = 500;
                res.end(JSON.stringify({
                  content: '',
                  error: 'API key not configured. Set GEMINI_API_KEY in .env file.'
                }));
                return;
              }

              // Build prompt
              const fullPrompt = `${systemPrompt || ''}\n\n${context || ''}\n\nUser Question: ${message}`;

              const response = await fetch(GEMINI_API_URL, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'x-goog-api-key': apiKey,
                },
                body: JSON.stringify({
                  contents: [{ parts: [{ text: fullPrompt }] }],
                  generationConfig: { temperature: 0.7, maxOutputTokens: 2048 }
                })
              });

              const data = await response.json() as {
                candidates?: { content?: { parts?: { text?: string }[] } }[];
                error?: { message?: string }
              };

              if (response.ok && data.candidates?.[0]?.content?.parts?.[0]?.text) {
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ content: data.candidates[0].content.parts[0].text }));
                return;
              }

              res.statusCode = 502;
              res.end(JSON.stringify({
                content: '',
                error: data.error?.message || 'AI service error'
              }));
            } catch (e) {
              console.error('[API] Error:', e);
              res.statusCode = 500;
              res.end(JSON.stringify({ content: '', error: 'Internal server error' }));
            }
          });
          return;
        }

        // Handle CORS preflight
        if (req.url === '/api/chat' && req.method === 'OPTIONS') {
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
          res.statusCode = 200;
          res.end();
          return;
        }

        next();
      });
    }
  };
}

export default defineConfig({
  plugins: [react(), localApiPlugin()],
  base,
})
