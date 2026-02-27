/**
 * Knowledge Service
 *
 * Handles loading and searching the knowledge layer (Layer 2) documentation.
 * Knowledge files are Markdown with YAML frontmatter, stored in /public/knowledge/
 */

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
  pins: KnowledgePin[];
  common_issues: string[];
  safety: string[];
  sources: string[];
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
}

export interface KnowledgeIndex {
  version: string;
  components: KnowledgeIndexEntry[];
  concepts: KnowledgeIndexEntry[];
}

// Cache for loaded knowledge files
const knowledgeCache = new Map<string, KnowledgeFile>();
let indexCache: KnowledgeIndex | null = null;

/**
 * Parse YAML frontmatter from markdown content
 */
function parseFrontmatter(content: string): { frontmatter: Record<string, unknown>; body: string } {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return { frontmatter: {}, body: content };
  }

  const yamlContent = match[1];
  const body = match[2];

  // Simple YAML parser for our specific format
  const frontmatter: Record<string, unknown> = {};
  const lines = yamlContent.split('\n');
  let currentKey = '';
  let currentArray: unknown[] = [];
  let inArray = false;
  let inNestedObject = false;
  let nestedObjects: Record<string, string>[] = [];
  let currentNestedObject: Record<string, string> = {};

  for (const line of lines) {
    // Skip empty lines
    if (!line.trim()) continue;

    // Check for array item with nested object (pins)
    if (line.match(/^\s{2}-\s+name:/)) {
      if (inNestedObject && Object.keys(currentNestedObject).length > 0) {
        nestedObjects.push(currentNestedObject);
      }
      currentNestedObject = {};
      const value = line.match(/name:\s*(.+)/)?.[1]?.trim() || '';
      currentNestedObject['name'] = value;
      inNestedObject = true;
      continue;
    }

    // Check for nested object property
    if (inNestedObject && line.match(/^\s{4}\w+:/)) {
      const nestedMatch = line.match(/^\s{4}(\w+):\s*(.+)/);
      if (nestedMatch) {
        currentNestedObject[nestedMatch[1]] = nestedMatch[2].trim();
      }
      continue;
    }

    // Check for simple array item
    if (line.match(/^\s{2}-\s+/)) {
      const value = line.replace(/^\s{2}-\s+/, '').trim();
      currentArray.push(value);
      continue;
    }

    // Check for key with inline array [item1, item2]
    const inlineArrayMatch = line.match(/^(\w+):\s*\[(.+)\]/);
    if (inlineArrayMatch) {
      // Save previous array if exists
      if (inArray && currentKey) {
        if (inNestedObject) {
          frontmatter[currentKey] = nestedObjects;
          nestedObjects = [];
          inNestedObject = false;
        } else {
          frontmatter[currentKey] = currentArray;
        }
        currentArray = [];
        inArray = false;
      }

      const key = inlineArrayMatch[1];
      const values = inlineArrayMatch[2].split(',').map(v => v.trim());
      frontmatter[key] = values;
      continue;
    }

    // Check for key-value pair
    const keyValueMatch = line.match(/^(\w+):\s*(.*)$/);
    if (keyValueMatch) {
      // Save previous array if exists
      if (inArray && currentKey) {
        if (inNestedObject) {
          if (Object.keys(currentNestedObject).length > 0) {
            nestedObjects.push(currentNestedObject);
          }
          frontmatter[currentKey] = nestedObjects;
          nestedObjects = [];
          currentNestedObject = {};
          inNestedObject = false;
        } else {
          frontmatter[currentKey] = currentArray;
        }
        currentArray = [];
        inArray = false;
      }

      currentKey = keyValueMatch[1];
      const value = keyValueMatch[2].trim();

      if (value === '' || value === undefined) {
        // Start of array
        inArray = true;
        currentArray = [];
      } else {
        frontmatter[currentKey] = value;
      }
    }
  }

  // Save final array if exists
  if (inArray && currentKey) {
    if (inNestedObject) {
      if (Object.keys(currentNestedObject).length > 0) {
        nestedObjects.push(currentNestedObject);
      }
      frontmatter[currentKey] = nestedObjects;
    } else {
      frontmatter[currentKey] = currentArray;
    }
  }

  return { frontmatter, body };
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
    return { version: '1.0', components: [], concepts: [] };
  }
}

/**
 * Load a knowledge file by component ID
 */
export async function loadKnowledge(componentId: string): Promise<KnowledgeFile | null> {
  // Check cache first
  if (knowledgeCache.has(componentId)) {
    return knowledgeCache.get(componentId)!;
  }

  try {
    // Get index to find the file path
    const index = await getKnowledgeIndex();
    const entry = index.components.find(c => c.id === componentId);

    if (!entry) {
      console.warn(`Knowledge file not found for component: ${componentId}`);
      return null;
    }

    // Load the markdown file
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

    // Cache the result
    knowledgeCache.set(componentId, knowledgeFile);

    return knowledgeFile;
  } catch (error) {
    console.error(`Error loading knowledge for ${componentId}:`, error);
    return null;
  }
}

/**
 * Search knowledge files by query string
 * Returns matching entries from the index
 */
export async function searchKnowledge(query: string): Promise<KnowledgeIndexEntry[]> {
  const index = await getKnowledgeIndex();
  const lowerQuery = query.toLowerCase();

  const results: KnowledgeIndexEntry[] = [];

  // Search components
  for (const entry of index.components) {
    const matchesName = entry.name.toLowerCase().includes(lowerQuery);
    const matchesId = entry.id.toLowerCase().includes(lowerQuery);
    const matchesAlias = entry.aliases.some(a => a.toLowerCase().includes(lowerQuery));
    const matchesSummary = entry.summary.toLowerCase().includes(lowerQuery);

    if (matchesName || matchesId || matchesAlias || matchesSummary) {
      results.push(entry);
    }
  }

  // Search concepts
  for (const entry of index.concepts) {
    const matchesName = entry.name.toLowerCase().includes(lowerQuery);
    const matchesId = entry.id.toLowerCase().includes(lowerQuery);
    const matchesAlias = entry.aliases.some(a => a.toLowerCase().includes(lowerQuery));
    const matchesSummary = entry.summary.toLowerCase().includes(lowerQuery);

    if (matchesName || matchesId || matchesAlias || matchesSummary) {
      results.push(entry);
    }
  }

  return results;
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
  indexCache = null;
}
