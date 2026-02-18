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
} from '../types/components';

// Re-export Pin type for use in other modules
export type { Pin };

// Cache for loaded component definitions
const definitionCache = new Map<string, ComponentDefinition>();

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

// Component categories and their members
const componentCategories: ComponentCategory[] = [
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

/**
 * Load a component definition from JSON
 */
export async function loadComponentDefinition(
  componentId: string
): Promise<ComponentDefinition | null> {
  // Check cache first
  if (definitionCache.has(componentId)) {
    return definitionCache.get(componentId)!;
  }

  // Check if this is a variant, load from the specific file
  const category = getCategoryForComponent(componentId);
  if (!category) {
    console.warn(`Unknown component: ${componentId}`);
    return null;
  }

  try {
    const response = await fetch(`${import.meta.env.BASE_URL}components/${category}/${componentId}.json`);
    if (!response.ok) {
      throw new Error(`Failed to load component: ${response.status}`);
    }

    const definition: ComponentDefinition = await response.json();
    definitionCache.set(componentId, definition);
    return definition;
  } catch (error) {
    console.error(`Error loading component ${componentId}:`, error);
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

  if (definitionCache.has(cacheKey)) {
    console.log(`[ComponentService] Cache hit for: ${cacheKey}`);
    return definitionCache.get(cacheKey)!;
  }

  // Encode the filename for URL (handles special chars like Ω)
  const encodedFileName = encodeURIComponent(fileName);
  const url = `${import.meta.env.BASE_URL}components/${category}/${encodedFileName}.json`;

  console.log(`[ComponentService] Fetching: ${url}`);

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const definition: ComponentDefinition = await response.json();
    console.log(`[ComponentService] Loaded definition:`, definition.id);
    definitionCache.set(cacheKey, definition);
    return definition;
  } catch (error) {
    console.error(`[ComponentService] Error loading ${fileName}:`, error);
    return null;
  }
}

/**
 * Get the category folder for a component ID
 */
function getCategoryForComponent(componentId: string): string | null {
  const id = componentId.toLowerCase().replace(/[_-]/g, '-');

  for (const category of componentCategories) {
    if (category.components.some((c) => c.toLowerCase() === id)) {
      return category.id;
    }
  }

  // Check variant mappings
  const mapping = variantMappings[componentId];
  if (mapping) {
    return getCategoryForComponent(mapping.baseId);
  }

  // Default category detection based on ID
  if (id.includes('arduino') || id.includes('esp') || id.includes('nano')) {
    return 'microcontrollers';
  }
  if (id.includes('breadboard')) {
    return 'boards';
  }
  if (
    id.includes('led') ||
    id.includes('resistor') ||
    id.includes('button') ||
    id.includes('capacitor')
  ) {
    return 'passive';
  }
  if (
    id.includes('buzzer') ||
    id.includes('motor') ||
    id.includes('speaker') ||
    id.includes('servo')
  ) {
    return 'Output';
  }

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
 * Get all available component categories
 */
export function getComponentCategories(): ComponentCategory[] {
  return componentCategories;
}

/**
 * Scan components from a category folder
 */
export async function scanCategoryComponents(
  category: string
): Promise<string[]> {
  // In production, this would scan the folder
  // For now, return known components
  const cat = componentCategories.find((c) => c.id === category);
  return cat?.components || [];
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
}
