/**
 * Component Service
 *
 * Loads component definitions from JSON files and handles variant resolution.
 * Components are stored in public/components/{category}/{component}.json
 */

import type {
  ComponentDefinition,
  Pin,
  VariantMapping,
  ComponentCategory,
  ComponentCatalog,
  ComponentCatalogEntry,
  LibraryComponentSection,
} from '../types/components';
import { validateComponentDefinition, validateCatalog, safeValidateComponentDefinition } from './validation';
import { LRUCache } from '../utils/cache';

// Re-export Pin type for use in other modules
export type { Pin };

// Cache for loaded component definitions - using LRU cache for better memory management
const definitionCache = new LRUCache<ComponentDefinition>(100);
let catalogCache: ComponentCatalog | null = null;

// Variant mappings - maps specific component file IDs to base definitions
// This allows LED_Red_OFF and LED_Red_ON to share the same pin positions
const variantMappings: Record<string, VariantMapping> = {
  // LED variants
  'led_red_off': { baseId: 'led-5mm', variant: 'red-off', defaultState: 'off' },
  'led_red_on': { baseId: 'led-5mm', variant: 'red-on', defaultState: 'on' },
  'LED_Red_OFF': { baseId: 'led-5mm', variant: 'red-off', defaultState: 'off' },
  'LED_Red_ON': { baseId: 'led-5mm', variant: 'red-on', defaultState: 'on' },
  // Pushbutton variants
  'pushbutton_off': { baseId: 'pushbutton', variant: 'off', defaultState: 'off' },
  'pushbutton_on': { baseId: 'pushbutton', variant: 'on', defaultState: 'on' },
  'pushbutton_OFF': { baseId: 'pushbutton', variant: 'off', defaultState: 'off' },
  'pushbutton_ON': { baseId: 'pushbutton', variant: 'on', defaultState: 'on' },
};

// Legacy fallback categories used if the catalog is unavailable
const legacyComponentCategories: ComponentCategory[] = [
  {
    id: 'boards',
    name: 'Boards',
    components: ['breadboard'],
  },
  {
    id: 'microcontrollers',
    name: 'Microcontrollers',
    components: ['arduino-uno'],
  },
  {
    id: 'passive',
    name: 'Passive Components',
    components: ['led-5mm', 'pushbutton', 'resistor-220'],
  },
  {
    id: 'Output',
    name: 'Output',
    components: ['buzzer', 'vibration-motor'],
  },
];

function normalizeComponentId(componentId: string): string {
  return componentId.toLowerCase().replace(/[_-]/g, '-');
}

export async function getComponentCatalog(): Promise<ComponentCatalog> {
  if (catalogCache) {
    return catalogCache;
  }

  try {
    const response = await fetch(`${import.meta.env.BASE_URL}components/_catalog.json`);
    if (!response.ok) {
      throw new Error(`Failed to load component catalog: ${response.status}`);
    }

    const rawCatalog = await response.json();

    // Validate catalog structure
    catalogCache = validateCatalog(rawCatalog);
    return catalogCache;
  } catch (error) {
    console.warn('[ComponentService] Falling back to legacy catalog:', error);
    return {
      version: 'legacy',
      components: legacyComponentCategories.flatMap(category =>
        category.components.map(id => ({
          id,
          name: id,
          category: category.id,
          componentPath: `${category.id}/${id}.json`,
          renderReady: true,
          simulationReady: true,
          knowledgeReady: false,
          visibleInLibrary: true,
        }))
      )
    };
  }
}

async function getCatalogEntry(componentId: string): Promise<ComponentCatalogEntry | null> {
  const normalizedId = normalizeComponentId(componentId);
  const catalog = await getComponentCatalog();

  for (const entry of catalog.components) {
    if (normalizeComponentId(entry.id) === normalizedId) {
      return entry;
    }
  }

  const mapping = variantMappings[componentId];
  if (mapping) {
    return getCatalogEntry(mapping.baseId);
  }

  return null;
}

/**
 * Load a component definition from JSON
 */
export async function loadComponentDefinition(
  componentId: string
): Promise<ComponentDefinition | null> {
  // Check cache first
  const cached = definitionCache.get(componentId);
  if (cached) {
    return cached;
  }

  // Check if this is a variant, load from the specific file
  const category = await getCategoryForComponent(componentId);
  if (!category) {
    console.warn(`[ComponentService] Unknown component: ${componentId}`);
    return null;
  }

  try {
    const response = await fetch(`${import.meta.env.BASE_URL}components/${category}/${componentId}.json`);
    if (!response.ok) {
      throw new Error(`Failed to load component: ${response.status}`);
    }

    const rawDefinition = await response.json();

    // Validate component definition
    const validationResult = safeValidateComponentDefinition(rawDefinition);
    if (!validationResult.success) {
      console.error(`[ComponentService] Component ${componentId} validation failed:`, validationResult.error);
      // Still use the data for backward compatibility, but log the issue
    }

    const definition = validationResult.success ? validationResult.data : rawDefinition as ComponentDefinition;
    definitionCache.put(componentId, definition);
    return definition;
  } catch (error) {
    console.error(`[ComponentService] Error loading component ${componentId}:`, error);
    return null;
  }
}

/**
 * Load a component by its file name (without extension)
 * Handles variant resolution
 */
export async function loadComponentByFileName(
  fileName: string,
  category: string
): Promise<ComponentDefinition | null> {
  const cacheKey = `${category}/${fileName}`;

  const cached = definitionCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  // Encode the filename for URL (handles special chars like Ω)
  const encodedFileName = encodeURIComponent(fileName);
  const url = `${import.meta.env.BASE_URL}components/${category}/${encodedFileName}.json`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const rawDefinition = await response.json();

    // Validate component definition
    const validationResult = safeValidateComponentDefinition(rawDefinition);
    if (!validationResult.success) {
      console.error(`[ComponentService] Component ${fileName} validation failed:`, validationResult.error);
    }

    const definition = validationResult.success ? validationResult.data : rawDefinition as ComponentDefinition;
    definitionCache.put(cacheKey, definition);
    return definition;
  } catch (error) {
    console.error(`[ComponentService] Error loading ${fileName}:`, error);
    return null;
  }
}

/**
 * Get the category folder for a component ID
 * Now exclusively uses the catalog as the single source of truth
 */
async function getCategoryForComponent(componentId: string): Promise<string | null> {
  // First check catalog (primary source)
  const catalogEntry = await getCatalogEntry(componentId);
  if (catalogEntry?.componentPath) {
    return catalogEntry.componentPath.split('/')[0] || null;
  }

  // Check variant mappings
  const mapping = variantMappings[componentId];
  if (mapping) {
    return getCategoryForComponent(mapping.baseId);
  }

  // Fallback to legacy categories only if catalog lookup fails
  // This is a safety net for backward compatibility during migration
  const id = normalizeComponentId(componentId);
  for (const category of legacyComponentCategories) {
    if (category.components.some((c) => c.toLowerCase() === id)) {
      console.warn(`[ComponentService] Component ${componentId} found in legacy categories but not in catalog. Please update _catalog.json`);
      return category.id;
    }
  }

  console.error(`[ComponentService] Component ${componentId} not found in catalog or legacy categories`);
  return null;
}

/**
 * Get the image URL for a component in a given state
 */
export function getComponentImageUrl(
  definition: ComponentDefinition,
  state: 'on' | 'off' = 'off',
  color?: string
): string {
  const baseUrl = `${import.meta.env.BASE_URL}components/${definition.category}`;

  // Check for variant image
  if (definition.variants) {
    const variantKey = color ? `${color}-${state}` : state;
    const variant = definition.variants[variantKey];
    if (variant?.image) {
      return `${baseUrl}/${variant.image}`;
    }
  }

  // Fall back to default image
  return `${baseUrl}/${definition.image}`;
}

/**
 * Get variant mapping for a component ID
 */
export function getVariantMapping(componentId: string): VariantMapping | null {
  return variantMappings[componentId] || null;
}

/**
 * Get base component ID from a variant ID
 */
export function getBaseComponentId(componentId: string): string {
  const mapping = variantMappings[componentId];
  return mapping?.baseId || componentId;
}

/**
 * Check if component is a stateful component (LED, button)
 */
export function isStatefulComponent(componentId: string): boolean {
  const id = componentId.toLowerCase();
  return id.includes('led') || id.includes('button');
}

/**
 * Get legacy categories for backward compatibility
 */
export function getComponentCategories(): ComponentCategory[] {
  return legacyComponentCategories;
}

/**
 * Get component sections for the library UI from the catalog
 */
export async function getComponentLibrarySections(): Promise<LibraryComponentSection[]> {
  const catalog = await getComponentCatalog();
  const sections = new Map<string, LibraryComponentSection>();

  for (const entry of catalog.components) {
    if (!entry.visibleInLibrary) continue;

    const folder = entry.componentPath.split('/')[0] || entry.category;
    const image = entry.image || entry.variants?.[0]?.componentPath.split('/').pop()?.replace('.json', '.svg') || '';
    const sectionId = entry.librarySection || entry.category;
    const sectionName = entry.librarySectionName || titleCase(sectionId);

    if (!sections.has(sectionId)) {
      sections.set(sectionId, {
        id: sectionId,
        name: sectionName,
        components: [],
      });
    }

    sections.get(sectionId)!.components.push({
      id: entry.id,
      name: entry.name,
      image,
      folder,
    });
  }

  return Array.from(sections.values()).map(section => ({
    ...section,
    components: section.components.sort((a, b) => a.name.localeCompare(b.name)),
  }));
}

/**
 * Scan components from a category folder
 */
export async function scanCategoryComponents(
  category: string
): Promise<string[]> {
  const catalog = await getComponentCatalog();
  return catalog.components
    .filter(entry => entry.category === category || entry.librarySection === category)
    .map(entry => entry.id);
}

/**
 * Get pin at a specific position within a component
 * Uses 21×21 rectangular hit area for precise detection
 */
export function getPinAtPosition(
  definition: ComponentDefinition,
  localX: number,
  localY: number
): Pin | null {
  const hitSize = 21; // 21×21 rectangular hit area
  const halfSize = hitSize / 2;

  for (const pin of definition.pins) {
    // Rectangular hit detection
    if (
      localX >= pin.x - halfSize &&
      localX <= pin.x + halfSize &&
      localY >= pin.y - halfSize &&
      localY <= pin.y + halfSize
    ) {
      return pin;
    }
  }
  return null;
}

/**
 * Convert pin position from component-local to canvas coordinates
 */
export function pinToCanvasCoords(
  pin: Pin,
  componentX: number,
  componentY: number,
  rotation: number = 0,
  scale: number = 1
): { x: number; y: number } {
  // Apply rotation around component center
  const cos = Math.cos((rotation * Math.PI) / 180);
  const sin = Math.sin((rotation * Math.PI) / 180);

  const rotatedX = pin.x * cos - pin.y * sin;
  const rotatedY = pin.x * sin + pin.y * cos;

  return {
    x: componentX + rotatedX * scale,
    y: componentY + rotatedY * scale,
  };
}

/**
 * Clear the definition cache (useful for hot reloading)
 */
export function clearDefinitionCache(): void {
  definitionCache.clear();
  catalogCache = null;
}

/**
 * Get cache statistics for monitoring
 */
export function getComponentCacheStats() {
  return {
    definitionCache: definitionCache.getStats(),
  };
}

function titleCase(value: string): string {
  return value
    .split(/[-_]/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
