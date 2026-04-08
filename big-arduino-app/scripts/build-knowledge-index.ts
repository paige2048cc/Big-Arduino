#!/usr/bin/env tsx
/**
 * Knowledge Index Builder
 *
 * Automatically generates the knowledge index by scanning markdown files
 * in the public/knowledge directory and extracting their frontmatter.
 *
 * Usage: npm run build-knowledge-index
 */

import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

interface KnowledgeIndexEntry {
  id: string;
  name: string;
  category: string;
  path: string;
  aliases: string[];
  summary: string;
  boards?: string[];
  related_components?: string[];
  concepts?: string[];
  difficulty?: string;
  intent?: string;
  source_book?: string;
}

interface KnowledgeIndex {
  version: string;
  components: KnowledgeIndexEntry[];
  concepts: KnowledgeIndexEntry[];
  recipes: KnowledgeIndexEntry[];
}

// Knowledge directory paths
const KNOWLEDGE_DIR = path.join(process.cwd(), 'public', 'knowledge');
const OUTPUT_FILE = path.join(KNOWLEDGE_DIR, '_index.json');

/**
 * Scan a directory for markdown files
 */
function scanDirectory(dir: string): string[] {
  const files: string[] = [];

  function scan(currentDir: string) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory() && entry.name !== 'node_modules') {
        scan(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        files.push(fullPath);
      }
    }
  }

  scan(dir);
  return files;
}

/**
 * Extract frontmatter from a markdown file
 */
function extractFrontmatter(filePath: string): KnowledgeIndexEntry | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const { data } = matter(content);

    // Validate required fields
    if (!data.id || !data.name || !data.category) {
      console.warn(`[Warning] Skipping ${filePath}: missing required fields (id, name, category)`);
      return null;
    }

    // Calculate relative path from knowledge directory
    const relativePath = path.relative(KNOWLEDGE_DIR, filePath).replace(/\\/g, '/');

    // Extract summary (first 200 chars of content or use summary field)
    const summaryText = data.summary || '';

    return {
      id: data.id,
      name: data.name,
      category: data.category,
      path: relativePath,
      aliases: Array.isArray(data.aliases) ? data.aliases : [],
      summary: summaryText,
      boards: Array.isArray(data.boards) ? data.boards : undefined,
      related_components: Array.isArray(data.related_components) ? data.related_components : undefined,
      concepts: Array.isArray(data.concepts) ? data.concepts : undefined,
      difficulty: data.difficulty,
      intent: data.intent,
      source_book: data.source_book,
    };
  } catch (error) {
    console.error(`[Error] Failed to process ${filePath}:`, error);
    return null;
  }
}

/**
 * Determine knowledge kind from file path
 */
function getKindFromPath(filePath: string): 'components' | 'concepts' | 'recipes' | null {
  const relativePath = path.relative(KNOWLEDGE_DIR, filePath).replace(/\\/g, '/');

  // Direct top-level directories
  if (relativePath.startsWith('components/')) return 'components';
  if (relativePath.startsWith('concepts/')) return 'concepts';
  if (relativePath.startsWith('recipes/')) return 'recipes';

  // Component category directories (these are treated as components)
  const componentDirs = ['passive', 'microcontrollers', 'boards', 'output', 'sensors', 'modules'];
  for (const dir of componentDirs) {
    if (relativePath.startsWith(dir + '/')) {
      return 'components';
    }
  }

  return null;
}

/**
 * Build the knowledge index
 */
function buildIndex(): void {
  console.log('[KnowledgeIndexBuilder] Starting index build...');

  const index: KnowledgeIndex = {
    version: '1.0',
    components: [],
    concepts: [],
    recipes: [],
  };

  // Scan all markdown files
  const markdownFiles = scanDirectory(KNOWLEDGE_DIR);
  console.log(`[KnowledgeIndexBuilder] Found ${markdownFiles.length} markdown files`);

  for (const filePath of markdownFiles) {
    // Skip the index file itself
    if (path.basename(filePath) === '_index.json') {
      continue;
    }

    const entry = extractFrontmatter(filePath);
    if (!entry) {
      continue;
    }

    const kind = getKindFromPath(filePath);
    if (!kind) {
      console.warn(`[Warning] Could not determine kind for ${filePath}`);
      continue;
    }

    index[kind].push(entry);
  }

  // Sort entries by name
  index.components.sort((a, b) => a.name.localeCompare(b.name));
  index.concepts.sort((a, b) => a.name.localeCompare(b.name));
  index.recipes.sort((a, b) => a.name.localeCompare(b.name));

  // Write the index file
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(index, null, 2), 'utf-8');

  console.log(`[KnowledgeIndexBuilder] Index built successfully!`);
  console.log(`  - Components: ${index.components.length}`);
  console.log(`  - Concepts: ${index.concepts.length}`);
  console.log(`  - Recipes: ${index.recipes.length}`);
  console.log(`  - Output: ${OUTPUT_FILE}`);
}

// Run the builder
buildIndex();
