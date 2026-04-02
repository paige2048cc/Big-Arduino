/**
 * Component Image Scanner
 *
 * Scans the components directory for image files and determines
 * which ones need JSON definitions generated.
 */

import * as fs from 'fs';
import * as path from 'path';

export interface ComponentImage {
  imagePath: string;
  jsonPath: string;
  category: string;
  name: string;
  hasJson: boolean;
}

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.svg'];

/**
 * Recursively scan directory for component images
 */
export async function scanForNewComponents(baseDir: string): Promise<ComponentImage[]> {
  const components: ComponentImage[] = [];

  if (!fs.existsSync(baseDir)) {
    console.log(`Creating components directory: ${baseDir}`);
    fs.mkdirSync(baseDir, { recursive: true });
    return components;
  }

  // Get all category directories
  const entries = fs.readdirSync(baseDir, { withFileTypes: true });
  const categories = entries.filter(e => e.isDirectory()).map(e => e.name);

  for (const category of categories) {
    const categoryPath = path.join(baseDir, category);
    const files = fs.readdirSync(categoryPath);

    for (const file of files) {
      const ext = path.extname(file).toLowerCase();

      // Skip non-image files
      if (!IMAGE_EXTENSIONS.includes(ext)) continue;

      const name = path.basename(file, ext);
      const imagePath = path.join(categoryPath, file);
      const jsonPath = path.join(categoryPath, `${name}.json`);
      const hasJson = fs.existsSync(jsonPath);

      components.push({
        imagePath,
        jsonPath,
        category,
        name,
        hasJson
      });
    }
  }

  return components;
}

/**
 * Get image dimensions using native Node.js
 * (Works for PNG and SVG files)
 */
export function getImageDimensions(imagePath: string): { width: number; height: number } | null {
  try {
    const buffer = fs.readFileSync(imagePath);
    const ext = path.extname(imagePath).toLowerCase();

    if (ext === '.png') {
      // PNG dimensions are at bytes 16-23 (width) and 20-23 (height)
      if (buffer.length > 24 && buffer.toString('ascii', 1, 4) === 'PNG') {
        const width = buffer.readUInt32BE(16);
        const height = buffer.readUInt32BE(20);
        return { width, height };
      }
    }

    if (ext === '.jpg' || ext === '.jpeg') {
      // JPEG is more complex - skip for now, use default
      return null;
    }

    if (ext === '.svg') {
      // Parse SVG width/height or viewBox attributes
      const svgContent = buffer.toString('utf-8');

      // Try to get width and height attributes
      const widthMatch = svgContent.match(/\bwidth=["'](\d+(?:\.\d+)?)/);
      const heightMatch = svgContent.match(/\bheight=["'](\d+(?:\.\d+)?)/);

      if (widthMatch && heightMatch) {
        return {
          width: Math.round(parseFloat(widthMatch[1])),
          height: Math.round(parseFloat(heightMatch[1]))
        };
      }

      // Fallback to viewBox
      const viewBoxMatch = svgContent.match(/viewBox=["'][\d.]+\s+[\d.]+\s+([\d.]+)\s+([\d.]+)/);
      if (viewBoxMatch) {
        return {
          width: Math.round(parseFloat(viewBoxMatch[1])),
          height: Math.round(parseFloat(viewBoxMatch[2]))
        };
      }

      return null;
    }

    return null;
  } catch {
    return null;
  }
}
