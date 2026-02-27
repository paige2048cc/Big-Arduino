/**
 * Preview Server
 *
 * Starts a local development server for the pin editor UI.
 * Uses Express for API endpoints and serves static files.
 */

import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import type { ComponentImage } from './scanner.js';
import type { ComponentDefinition } from './ai-analyzer.js';
import { listTemplates, loadTemplate, templateToPins } from './pin-database/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const COMPONENTS_DIR = path.resolve(__dirname, '../../public/components');

interface AnalyzedComponent extends ComponentImage {
  pins: ComponentDefinition;
}

let currentComponents: AnalyzedComponent[] = [];
const PORT = 3001;

/**
 * Scan all components from the public/components folder
 */
function scanAllComponents(): Array<{
  imagePath: string;
  jsonPath: string;
  category: string;
  name: string;
  definition: any;
}> {
  const components: Array<{
    imagePath: string;
    jsonPath: string;
    category: string;
    name: string;
    definition: any;
  }> = [];

  // Scan category folders
  const categories = fs.readdirSync(COMPONENTS_DIR).filter(f => {
    const fullPath = path.join(COMPONENTS_DIR, f);
    return fs.statSync(fullPath).isDirectory();
  });

  for (const category of categories) {
    const categoryPath = path.join(COMPONENTS_DIR, category);
    const files = fs.readdirSync(categoryPath);

    // Find image files
    const imageFiles = files.filter(f => /\.(png|jpg|jpeg|webp|svg)$/i.test(f));

    for (const imageFile of imageFiles) {
      const imagePath = path.join(categoryPath, imageFile);
      const baseName = imageFile.replace(/\.(png|jpg|jpeg|webp|svg)$/i, '');
      const jsonPath = path.join(categoryPath, `${baseName}.json`);

      // Load or create default definition
      let definition = {
        id: baseName.toLowerCase().replace(/\s+/g, '-'),
        name: baseName.replace(/[-_]/g, ' '),
        category: category,
        image: imageFile,
        width: 100,
        height: 100,
        pins: []
      };

      if (fs.existsSync(jsonPath)) {
        try {
          definition = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
        } catch (e) {
          // Use default if JSON is invalid
        }
      }

      components.push({
        imagePath: `/components/${category}/${imageFile}`,
        jsonPath: jsonPath,
        category: category,
        name: baseName,
        definition: definition
      });
    }
  }

  return components;
}

/**
 * Start the preview server
 */
export async function startPreviewServer(components: AnalyzedComponent[]): Promise<void> {
  currentComponents = components;

  const server = http.createServer((req, res) => {
    const url = new URL(req.url || '/', `http://localhost:${PORT}`);

    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    // API endpoints
    if (url.pathname === '/api/components') {
      handleGetComponents(req, res);
      return;
    }

    if (url.pathname === '/api/save' && req.method === 'POST') {
      handleSaveComponent(req, res);
      return;
    }

    if (url.pathname === '/api/templates') {
      handleGetTemplates(req, res);
      return;
    }

    if (url.pathname.startsWith('/api/templates/') && req.method === 'GET') {
      const templateId = url.pathname.replace('/api/templates/', '');
      handleGetTemplate(templateId, req, res);
      return;
    }

    // Serve component images
    if (url.pathname.startsWith('/components/')) {
      serveComponentImage(url.pathname, res);
      return;
    }

    // Serve static preview files
    serveStaticFile(url.pathname, res);
  });

  server.listen(PORT, () => {
    console.log(`   ✓ Server running at http://localhost:${PORT}`);
    console.log(`   ✓ Opening browser...\n`);
    console.log('━'.repeat(50));
    console.log('\n📌 Review and adjust pins in the browser.');
    console.log('   Click "Save" when done.\n');
    console.log('   Press Ctrl+C to exit.\n');

    // Open browser
    openBrowser(`http://localhost:${PORT}`);
  });

  // Keep process running
  await new Promise(() => {});
}

function handleGetComponents(req: http.IncomingMessage, res: http.ServerResponse) {
  // Always scan fresh from disk to get all components
  const allComponents = scanAllComponents();

  res.setHeader('Content-Type', 'application/json');
  res.writeHead(200);
  res.end(JSON.stringify(allComponents));
}

function handleSaveComponent(req: http.IncomingMessage, res: http.ServerResponse) {
  let body = '';

  req.on('data', chunk => {
    body += chunk.toString();
  });

  req.on('end', () => {
    try {
      const { jsonPath, definition } = JSON.parse(body);

      // Validate jsonPath is within components directory
      const normalizedPath = path.normalize(jsonPath);
      if (!normalizedPath.includes('components')) {
        throw new Error('Invalid save path');
      }

      // Save JSON file
      fs.writeFileSync(jsonPath, JSON.stringify(definition, null, 2));

      // Sync pin positions into any base JSON that the app reads directly.
      // e.g. pushbutton_OFF.json → pushbutton.json (the app loads pushbutton.json
      // from componentCategories, so the two files must stay in sync).
      const baseSyncMap: Record<string, string> = {
        'pushbutton_OFF.json': 'pushbutton.json',
        'pushbutton_ON.json':  'pushbutton.json',
      };
      const savedFileName = path.basename(jsonPath);
      const baseFileName = baseSyncMap[savedFileName];
      if (baseFileName) {
        const baseJsonPath = path.join(path.dirname(jsonPath), baseFileName);
        if (fs.existsSync(baseJsonPath)) {
          try {
            const baseDefinition = JSON.parse(fs.readFileSync(baseJsonPath, 'utf-8'));
            baseDefinition.pins = definition.pins;
            baseDefinition.width = definition.width;
            baseDefinition.height = definition.height;
            fs.writeFileSync(baseJsonPath, JSON.stringify(baseDefinition, null, 2));
            console.log(`   🔗 Synced pins → ${baseFileName}`);
          } catch (syncError) {
            console.warn(`   ⚠️  Could not sync to ${baseFileName}: ${syncError}`);
          }
        }
      }

      res.setHeader('Content-Type', 'application/json');
      res.writeHead(200);
      res.end(JSON.stringify({ success: true, path: jsonPath }));

      console.log(`   💾 Saved: ${jsonPath}`);
    } catch (error) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: String(error) }));
    }
  });
}

function handleGetTemplates(req: http.IncomingMessage, res: http.ServerResponse) {
  res.setHeader('Content-Type', 'application/json');
  res.writeHead(200);
  res.end(JSON.stringify(listTemplates()));
}

function handleGetTemplate(templateId: string, req: http.IncomingMessage, res: http.ServerResponse) {
  const template = loadTemplate(templateId);
  if (!template) {
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Template not found' }));
    return;
  }

  // Return template with pins converted to placement format
  const pins = templateToPins(template);
  res.setHeader('Content-Type', 'application/json');
  res.writeHead(200);
  res.end(JSON.stringify({
    ...template,
    pins
  }));
}

function serveComponentImage(pathname: string, res: http.ServerResponse) {
  // /components/category/image.png -> public/components/category/image.png
  // Decode URL to handle special characters like Ω
  const relativePath = decodeURIComponent(pathname.replace('/components/', ''));
  const imagePath = path.resolve(__dirname, '../../public/components', relativePath);

  if (!fs.existsSync(imagePath)) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  const ext = path.extname(imagePath).toLowerCase();
  const contentType = ext === '.png' ? 'image/png' :
                      ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' :
                      ext === '.webp' ? 'image/webp' : ext === '.svg' ? 'image/svg+xml' : 'application/octet-stream';

  res.setHeader('Content-Type', contentType);
  res.writeHead(200);
  res.end(fs.readFileSync(imagePath));
}

function serveStaticFile(pathname: string, res: http.ServerResponse) {
  // Default to index.html
  if (pathname === '/' || pathname === '/index.html') {
    pathname = '/index.html';
  }

  const previewDir = path.resolve(__dirname, 'preview');
  const filePath = path.join(previewDir, pathname);

  // Security check - ensure path is within preview directory
  if (!filePath.startsWith(previewDir)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  if (!fs.existsSync(filePath)) {
    // Return index.html for SPA routing
    if (!pathname.includes('.')) {
      serveStaticFile('/index.html', res);
      return;
    }
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentTypes: Record<string, string> = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
  };

  res.setHeader('Content-Type', contentTypes[ext] || 'text/plain');
  res.writeHead(200);
  res.end(fs.readFileSync(filePath));
}

function openBrowser(url: string) {
  const platform = process.platform;
  let command: string;

  if (platform === 'win32') {
    command = `start "" "${url}"`;
  } else if (platform === 'darwin') {
    command = `open "${url}"`;
  } else {
    command = `xdg-open "${url}"`;
  }

  exec(command, (error: Error | null) => {
    if (error) {
      console.log(`   ⚠️  Could not open browser automatically.`);
      console.log(`      Please open: ${url}\n`);
    }
  });
}
