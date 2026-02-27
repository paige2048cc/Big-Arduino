#!/usr/bin/env node
/**
 * Component Pin Mapping Generator CLI
 *
 * Usage:
 *   npm run generate-pins -- --list-templates          # List available templates
 *   npm run generate-pins -- --template arduino-uno    # Use template (recommended)
 *   npm run generate-pins -- --manual                  # Manual mode (no AI)
 *   npm run generate-pins -- --figma <url>             # Extract from Figma
 *   npm run generate-pins                              # AI mode (default)
 *
 * Modes:
 *   - Template mode: Pre-defined pins from database, you only position them
 *   - Manual mode: Empty template for manual pin placement
 *   - Figma mode: Extracts pin positions from Figma design markers
 *   - AI mode: Uses Claude/Gemini vision to detect pins (~75% accuracy)
 */

import { scanForNewComponents, getImageDimensions, type ComponentImage } from './scanner.js';
import { analyzeComponent } from './ai-analyzer.js';
import { extractPinsFromFigmaApi, createEmptyPinTemplate } from './figma-extractor.js';
import { listTemplates, loadTemplate, templateToPins } from './pin-database/index.js';
import { startPreviewServer } from './server.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const COMPONENTS_DIR = path.resolve(__dirname, '../../public/components');

interface PendingComponent {
  imagePath: string;
  jsonPath: string;
  category: string;
  name: string;
  analyzed: boolean;
}

interface ParsedArgs {
  manual: boolean;
  figma: string | null;
  image: string | null;
  template: string | null;
  listTemplates: boolean;
  editor: boolean;
  help: boolean;
}

function parseArgs(argv: string[]): ParsedArgs {
  const result: ParsedArgs = {
    manual: false,
    figma: null,
    image: null,
    template: null,
    listTemplates: false,
    editor: false,
    help: false
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--manual' || arg === '-m') {
      result.manual = true;
    } else if (arg === '--figma' || arg === '-f') {
      result.figma = argv[++i] || null;
    } else if (arg === '--image' || arg === '-i') {
      result.image = argv[++i] || null;
    } else if (arg === '--template' || arg === '-t') {
      result.template = argv[++i] || null;
    } else if (arg === '--list-templates' || arg === '-l') {
      result.listTemplates = true;
    } else if (arg === '--editor' || arg === '-e') {
      result.editor = true;
    } else if (arg === '--help' || arg === '-h') {
      result.help = true;
    }
  }

  return result;
}

function showHelp() {
  console.log(`
🔧 Component Pin Mapping Generator

Usage:
  npm run generate-pins -- --editor                    # Open editor for all components
  npm run generate-pins -- --list-templates            # List available templates
  npm run generate-pins -- --template <id>             # Use template (recommended)
  npm run generate-pins -- --manual                    # Manual mode
  npm run generate-pins -- --figma <url>               # Figma mode
  npm run generate-pins                                # AI mode (default)

Options:
  --editor, -e            Open editor to view/edit all existing components
  --list-templates, -l    List all available pin templates
  --template, -t <id>     Use pre-defined pin template (e.g., arduino-uno)
  --manual, -m            Create empty template for manual placement
  --figma, -f <url>       Extract pins from Figma design
  --image, -i <path>      Process single image file
  --help, -h              Show this help message

Modes:
  Template Mode (recommended)
    Pre-defined pins with names, types, and descriptions from official docs
    You only need to position pins on the image - no metadata entry required

  Manual Mode
    Creates empty JSON templates for manual pin placement
    No API keys required, no token consumption

  Figma Mode
    Extracts pin positions from Figma design markers
    Requires FIGMA_TOKEN environment variable

  AI Mode (default)
    Uses Claude/Gemini vision to detect pins (~75% accuracy)
    Requires ANTHROPIC_API_KEY or GOOGLE_API_KEY

Examples:
  npm run generate-pins -- --list-templates
  npm run generate-pins -- --template arduino-uno
  npm run generate-pins -- --template led-red --image public/components/LED_Red_OFF.png
  npm run generate-pins -- --manual
`);
}

async function main() {
  console.log('\n🔧 Component Pin Mapping Generator\n');
  console.log('━'.repeat(50));

  // Parse command line arguments
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    showHelp();
    return;
  }

  // Handle --list-templates
  if (args.listTemplates) {
    console.log('\n📋 Available Pin Templates:\n');
    const templates = listTemplates();
    if (templates.length === 0) {
      console.log('   No templates found.\n');
      return;
    }

    // Group by category
    const grouped = templates.reduce((acc, t) => {
      if (!acc[t.category]) acc[t.category] = [];
      acc[t.category].push(t);
      return acc;
    }, {} as Record<string, typeof templates>);

    for (const [category, items] of Object.entries(grouped)) {
      console.log(`   ${category}/`);
      for (const item of items) {
        console.log(`     • ${item.id.padEnd(20)} ${item.name} (${item.pinCount} pins)`);
      }
      console.log();
    }

    console.log('Usage: npm run generate-pins -- --template <id>\n');
    return;
  }

  // Handle --editor (just open the editor for all existing components)
  if (args.editor) {
    console.log('\n🌐 Starting pin editor...\n');
    console.log('   The editor will load all components from public/components/\n');
    await startPreviewServer([]);
    return;
  }

  let componentsToProcess: ComponentImage[] = [];

  if (args.image) {
    // Process single image
    const fullPath = path.resolve(args.image);
    if (!fs.existsSync(fullPath)) {
      console.error(`❌ Image not found: ${fullPath}`);
      process.exit(1);
    }

    const dir = path.dirname(fullPath);
    const category = path.basename(dir);
    const name = path.basename(fullPath, path.extname(fullPath));
    const jsonPath = fullPath.replace(/\.(png|jpg|jpeg|webp)$/i, '.json');

    componentsToProcess = [{
      imagePath: fullPath,
      jsonPath,
      category,
      name,
      hasJson: fs.existsSync(jsonPath)
    }];
  } else {
    // Scan for all new components
    console.log(`📁 Scanning: ${COMPONENTS_DIR}\n`);
    componentsToProcess = await scanForNewComponents(COMPONENTS_DIR);
  }

  // Filter to only those without JSON (unless processing single image)
  const newComponents = args.image
    ? componentsToProcess
    : componentsToProcess.filter(c => !c.hasJson);

  if (newComponents.length === 0) {
    console.log('✅ All component images have JSON definitions!\n');

    // Show existing components
    const existingComponents = componentsToProcess.filter(c => c.hasJson);
    if (existingComponents.length > 0) {
      console.log('📦 Existing components:');
      existingComponents.forEach(c => {
        console.log(`   • ${c.category}/${c.name}`);
      });
    }

    console.log('\n💡 To re-analyze an existing component, delete its JSON file first.');
    console.log('   Or use: npm run generate-pins -- --image path/to/image.png\n');
    return;
  }

  console.log(`📷 Found ${newComponents.length} component(s) to process:\n`);
  newComponents.forEach(c => {
    console.log(`   • ${c.category}/${c.name}`);
  });
  console.log();

  const analyzedComponents: Array<{component: ComponentImage; pins: any}> = [];

  // Choose processing mode
  if (args.template) {
    // Template mode - use pre-defined pin definitions
    const template = loadTemplate(args.template);
    if (!template) {
      console.error(`❌ Template not found: ${args.template}`);
      console.log('\nAvailable templates:');
      listTemplates().forEach(t => console.log(`   • ${t.id}`));
      process.exit(1);
    }

    console.log(`📦 Using template: ${template.componentName}\n`);
    console.log(`   Source: ${template.source}`);
    console.log(`   Pins: ${template.pins.length}\n`);

    for (const component of newComponents) {
      const dimensions = getImageDimensions(component.imagePath) || { width: 500, height: 400 };

      // Create pins from template with placeholder positions
      const pins = templateToPins(template);

      const result = {
        id: component.name.toLowerCase().replace(/\s+/g, '-'),
        name: template.componentName,
        category: component.category,
        image: path.basename(component.imagePath),
        width: dimensions.width,
        height: dimensions.height,
        pins: pins.map(p => ({
          id: p.id,
          label: p.label,
          description: p.description,
          type: p.type,
          x: p.x,
          y: p.y,
          hitRadius: p.hitRadius
        }))
      };

      analyzedComponents.push({ component, pins: result });
      console.log(`   ✓ ${component.name} (${pins.length} pins from template)`);
    }

  } else if (args.figma) {
    // Figma mode - extract from Figma design
    console.log('🎨 Extracting pins from Figma...\n');

    try {
      const figmaResult = await extractPinsFromFigmaApi(args.figma);
      console.log(`   Found ${figmaResult.pins.length} pin markers`);
      console.log(`   Frame size: ${figmaResult.frameWidth}x${figmaResult.frameHeight}\n`);

      // Apply Figma pins to all components
      for (const component of newComponents) {
        const dimensions = getImageDimensions(component.imagePath) || {
          width: figmaResult.frameWidth,
          height: figmaResult.frameHeight
        };

        // Scale pins if image dimensions differ from Figma frame
        const scaleX = dimensions.width / figmaResult.frameWidth;
        const scaleY = dimensions.height / figmaResult.frameHeight;

        const scaledPins = figmaResult.pins.map(pin => ({
          ...pin,
          x: Math.round(pin.x * scaleX),
          y: Math.round(pin.y * scaleY)
        }));

        const result = {
          id: component.name.toLowerCase().replace(/\s+/g, '-'),
          name: component.name.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
          category: component.category,
          image: path.basename(component.imagePath),
          width: dimensions.width,
          height: dimensions.height,
          pins: scaledPins
        };

        analyzedComponents.push({ component, pins: result });
        console.log(`   ✓ ${component.name} (${scaledPins.length} pins)`);
      }
    } catch (error) {
      console.error(`❌ Figma extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      process.exit(1);
    }

  } else if (args.manual) {
    // Manual mode - create empty templates
    console.log('📝 Creating empty templates (manual mode)...\n');

    for (const component of newComponents) {
      const dimensions = getImageDimensions(component.imagePath) || { width: 500, height: 400 };

      const result = createEmptyPinTemplate(
        component.imagePath,
        component.name,
        component.category,
        dimensions.width,
        dimensions.height
      );

      analyzedComponents.push({ component, pins: result });
      console.log(`   ✓ ${component.name} (empty template)`);
    }

  } else {
    // AI mode - analyze with vision API
    console.log('🤖 Analyzing components with AI Vision...\n');

    for (const component of newComponents) {
      process.stdout.write(`   Analyzing ${component.name}...`);

      try {
        const result = await analyzeComponent(component.imagePath, component.name, component.category);
        analyzedComponents.push({ component, pins: result });
        console.log(' ✓');
      } catch (error) {
        console.log(' ✗');
        console.error(`      Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  if (analyzedComponents.length === 0) {
    console.log('\n❌ No components were processed successfully.');
    if (!args.manual && !args.figma) {
      console.log('   Check your ANTHROPIC_API_KEY or GOOGLE_API_KEY environment variable.\n');
    }
    return;
  }

  // Save preliminary JSON files
  console.log('\n📝 Saving JSON files...\n');

  for (const { component, pins } of analyzedComponents) {
    const jsonContent = JSON.stringify(pins, null, 2);
    fs.writeFileSync(component.jsonPath, jsonContent);
    console.log(`   • ${component.jsonPath}`);
  }

  // Start preview server
  console.log('\n🌐 Starting preview server...\n');

  await startPreviewServer(analyzedComponents.map(a => ({
    ...a.component,
    pins: a.pins
  })));
}

// Run CLI
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
