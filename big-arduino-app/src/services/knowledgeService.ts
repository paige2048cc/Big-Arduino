/**
 * Knowledge Service
 *
 * Handles loading and searching the knowledge layer (Layer 2) documentation.
 * Knowledge files are Markdown with YAML frontmatter, stored in /public/knowledge/
 */

import matter from 'gray-matter';
import { validateKnowledgeFrontmatter } from './validation';
import { LRUCache, createCacheKey } from '../utils/cache';

// Types for knowledge file structure
export interface KnowledgePin {
  name: string;
  function: string;
  notes: string;
}

export interface KnowledgeFrontmatter {
  id: string;
  name: string;
  aliases: string[];
  category: string;
  pins?: KnowledgePin[];
  common_issues?: string[];
  safety?: string[];
  sources?: string[];
  boards?: string[];
  related_components?: string[];
  concepts?: string[];
  libraries?: string[];
  difficulty?: string;
  intent?: string;
  source_book?: string;
  source_files?: string[];
}

export interface KnowledgeFile {
  frontmatter: KnowledgeFrontmatter;
  content: string; // Markdown body content
}

export interface KnowledgeIndexEntry {
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

export interface KnowledgeIndex {
  version: string;
  components: KnowledgeIndexEntry[];
  concepts: KnowledgeIndexEntry[];
  recipes: KnowledgeIndexEntry[];
}

export type KnowledgeKind = keyof Pick<KnowledgeIndex, 'components' | 'concepts' | 'recipes'>;

export interface KnowledgeSearchOptions {
  kinds?: KnowledgeKind[];
  board?: string;
  relatedComponentIds?: string[];
  limit?: number;
}

// Cache for loaded knowledge files - using LRU cache for better performance
const knowledgeCache = new LRUCache<KnowledgeFile>(100); // Store up to 100 knowledge files
let indexCache: KnowledgeIndex | null = null;

// Cache for search results - short TTL since circuit state changes frequently
const searchCache = new LRUCache<Array<KnowledgeIndexEntry & { kind: KnowledgeKind }>>(50);

function getCacheKey(kind: KnowledgeKind, id: string): string {
  return `${kind}:${id}`;
}

function scoreKnowledgeEntry(
  entry: KnowledgeIndexEntry,
  kind: KnowledgeKind,
  query: string,
  options: KnowledgeSearchOptions
): number {
  const lowerQuery = query.toLowerCase().trim();
  const queryTerms = lowerQuery.split(/\s+/).filter(Boolean);
  let score = 0;

  if (!lowerQuery && kind === 'recipes') {
    score += 1;
  }

  const haystacks = [
    entry.id.toLowerCase(),
    entry.name.toLowerCase(),
    entry.summary.toLowerCase(),
    ...entry.aliases.map(alias => alias.toLowerCase()),
    ...(entry.concepts || []).map(concept => concept.toLowerCase()),
    ...(entry.related_components || []).map(component => component.toLowerCase()),
  ];

  if (lowerQuery) {
    if (entry.id.toLowerCase() === lowerQuery) score += 10;
    if (entry.name.toLowerCase() === lowerQuery) score += 10;

    for (const term of queryTerms) {
      for (const haystack of haystacks) {
        if (haystack === term) {
          score += 6;
        } else if (haystack.includes(term)) {
          score += 3;
        }
      }
    }
  }

  if (options.board && entry.boards?.includes(options.board)) {
    score += 4;
  }

  if (options.relatedComponentIds && options.relatedComponentIds.length > 0) {
    const relatedSet = new Set(options.relatedComponentIds);
    const relatedMatches = (entry.related_components || []).filter(componentId => relatedSet.has(componentId)).length;
    score += relatedMatches * 4;
  }

  if (kind === 'recipes' && /code|sketch|program|example|代码|程序|示例|案例/.test(lowerQuery)) {
    score += 4;
  }

  if (kind === 'concepts' && /what|why|how|概念|原理|区别|什么意思|是什么/.test(lowerQuery)) {
    score += 2;
  }

  return score;
}

/**
 * Parse YAML frontmatter from markdown content using gray-matter
 * This replaces the hand-written parser with a robust library
 */
function parseFrontmatter(content: string): { frontmatter: Record<string, unknown>; body: string } {
  try {
    const { data, content: body } = matter(content);

    // Validate frontmatter structure
    try {
      const validated = validateKnowledgeFrontmatter(data);
      return { frontmatter: validated as unknown as Record<string, unknown>, body };
    } catch (validationError) {
      // Log validation error but still return data for backward compatibility
      console.warn('[KnowledgeService] Frontmatter validation failed:', validationError);
      return { frontmatter: data, body };
    }
  } catch (error) {
    console.error('[KnowledgeService] Failed to parse frontmatter:', error);
    return { frontmatter: {}, body: content };
  }
}

/**
 * Load the knowledge index file
 */
export async function getKnowledgeIndex(): Promise<KnowledgeIndex> {
  if (indexCache) {
    return indexCache;
  }

  try {
    const response = await fetch('/knowledge/_index.json');
    if (!response.ok) {
      throw new Error(`Failed to load knowledge index: ${response.status}`);
    }
    indexCache = await response.json();
    return indexCache!;
  } catch (error) {
    console.error('Error loading knowledge index:', error);
    // Return empty index on error
    return { version: '1.0', components: [], concepts: [], recipes: [] };
  }
}

/**
 * Load a knowledge file by kind and entry ID
 */
export async function loadKnowledgeEntry(kind: KnowledgeKind, entryId: string): Promise<KnowledgeFile | null> {
  const cacheKey = getCacheKey(kind, entryId);

  const cached = knowledgeCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const index = await getKnowledgeIndex();
    const entry = index[kind].find(item => item.id === entryId);

    if (!entry) {
      console.warn(`Knowledge file not found for ${kind}:${entryId}`);
      return null;
    }

    const response = await fetch(`/knowledge/${entry.path}`);
    if (!response.ok) {
      throw new Error(`Failed to load knowledge file: ${response.status}`);
    }

    const content = await response.text();
    const { frontmatter, body } = parseFrontmatter(content);

    const knowledgeFile: KnowledgeFile = {
      frontmatter: frontmatter as unknown as KnowledgeFrontmatter,
      content: body
    };

    knowledgeCache.put(cacheKey, knowledgeFile);

    return knowledgeFile;
  } catch (error) {
    console.error(`Error loading knowledge for ${kind}:${entryId}:`, error);
    return null;
  }
}

/**
 * Backwards-compatible helper for component knowledge
 */
export async function loadKnowledge(componentId: string): Promise<KnowledgeFile | null> {
  return loadKnowledgeEntry('components', componentId);
}

/**
 * Search knowledge files by query string
 * Returns matching entries from the index
 */
export async function searchKnowledge(
  query: string,
  options: KnowledgeSearchOptions = {}
): Promise<Array<KnowledgeIndexEntry & { kind: KnowledgeKind }>> {
  // Create cache key from search parameters
  const cacheKey = createCacheKey(
    query,
    options.kinds?.join(','),
    options.board,
    options.relatedComponentIds?.join(','),
    options.limit
  );

  // Check cache first
  const cached = searchCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const index = await getKnowledgeIndex();
  const kinds = options.kinds && options.kinds.length > 0
    ? options.kinds
    : (['components', 'concepts', 'recipes'] as KnowledgeKind[]);
  const results: Array<KnowledgeIndexEntry & { kind: KnowledgeKind; score: number }> = [];

  for (const kind of kinds) {
    for (const entry of index[kind]) {
      if (options.board && entry.boards && !entry.boards.includes(options.board)) {
        continue;
      }

      const score = scoreKnowledgeEntry(entry, kind, query, options);
      if (score > 0) {
        results.push({ ...entry, kind, score });
      }
    }
  }

  const searchResults = results
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, options.limit ?? 8)
    .map(result => ({
      id: result.id,
      name: result.name,
      category: result.category,
      path: result.path,
      aliases: result.aliases,
      summary: result.summary,
      boards: result.boards,
      related_components: result.related_components,
      concepts: result.concepts,
      difficulty: result.difficulty,
      intent: result.intent,
      source_book: result.source_book,
      kind: result.kind,
    }));

  // Cache the results
  searchCache.put(cacheKey, searchResults);

  return searchResults;
}

/**
 * Get knowledge for multiple components at once
 * Useful for building AI context with multiple referenced components
 */
export async function loadMultipleKnowledge(componentIds: string[]): Promise<Map<string, KnowledgeFile>> {
  const results = new Map<string, KnowledgeFile>();

  await Promise.all(
    componentIds.map(async (id) => {
      const knowledge = await loadKnowledge(id);
      if (knowledge) {
        results.set(id, knowledge);
      }
    })
  );

  return results;
}

export async function getKnowledgeEntries(
  query: string,
  options: KnowledgeSearchOptions = {}
): Promise<Array<{ entry: KnowledgeIndexEntry & { kind: KnowledgeKind }; file: KnowledgeFile }>> {
  const entries = await searchKnowledge(query, options);
  const files = await Promise.all(
    entries.map(async entry => {
      const file = await loadKnowledgeEntry(entry.kind, entry.id);
      return file ? { entry, file } : null;
    })
  );

  return files.filter((item): item is { entry: KnowledgeIndexEntry & { kind: KnowledgeKind }; file: KnowledgeFile } => item !== null);
}

/**
 * Get a summary of a component's knowledge for AI context
 * Returns a condensed version suitable for including in prompts
 */
export async function getKnowledgeSummary(componentId: string): Promise<string | null> {
  const knowledge = await loadKnowledge(componentId);
  if (!knowledge) return null;

  const { frontmatter } = knowledge;

  let summary = `## ${frontmatter.name}\n\n`;

  // Add pins
  if (frontmatter.pins && frontmatter.pins.length > 0) {
    summary += '### Pins\n';
    for (const pin of frontmatter.pins) {
      summary += `- **${pin.name}**: ${pin.function}. ${pin.notes}\n`;
    }
    summary += '\n';
  }

  // Add common issues
  if (frontmatter.common_issues && frontmatter.common_issues.length > 0) {
    summary += '### Common Issues\n';
    for (const issue of frontmatter.common_issues) {
      summary += `- ${issue}\n`;
    }
    summary += '\n';
  }

  // Add safety notes
  if (frontmatter.safety && frontmatter.safety.length > 0) {
    summary += '### Safety\n';
    for (const note of frontmatter.safety) {
      summary += `- ${note}\n`;
    }
    summary += '\n';
  }

  return summary;
}

/**
 * Clear the knowledge cache
 * Useful for development/testing
 */
export function clearKnowledgeCache(): void {
  knowledgeCache.clear();
  searchCache.clear();
  indexCache = null;
}

/**
 * Get cache statistics for monitoring
 */
export function getKnowledgeCacheStats() {
  return {
    knowledgeCache: knowledgeCache.getStats(),
    searchCache: searchCache.getStats(),
  };
}
