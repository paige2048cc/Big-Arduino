/**
 * Character Positioning Service
 *
 * Calculates optimal position for the AI character on the canvas
 * near problematic or referenced components.
 */

import type { PlacedComponent, ComponentDefinition } from '../types/components';

export interface CharacterPosition {
  x: number;
  y: number;
  bubblePosition: 'top' | 'bottom' | 'left' | 'right';
}

interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

const CHARACTER_WIDTH = 106;
const CHARACTER_HEIGHT = 111;
const CHARACTER_PADDING = 20; // Minimum distance from component
const CANVAS_PADDING = 50; // Minimum distance from canvas edges

/**
 * Get the bounding box of a component
 */
function getComponentBounds(
  component: PlacedComponent,
  definition: ComponentDefinition | undefined
): BoundingBox {
  const width = definition?.width || 50;
  const height = definition?.height || 50;

  return {
    x: component.x,
    y: component.y,
    width,
    height,
  };
}

/**
 * Check if two bounding boxes overlap
 */
function boxesOverlap(a: BoundingBox, b: BoundingBox, padding = 0): boolean {
  return !(
    a.x + a.width + padding < b.x ||
    b.x + b.width + padding < a.x ||
    a.y + a.height + padding < b.y ||
    b.y + b.height + padding < a.y
  );
}

/**
 * Calculate character position near a target component
 */
export function calculateCharacterPosition(
  targetComponentId: string | null,
  placedComponents: PlacedComponent[],
  componentDefinitions: Map<string, ComponentDefinition>,
  canvasSize: { width: number; height: number } = { width: 1200, height: 800 }
): CharacterPosition {
  // Default position (center-ish of canvas)
  const defaultPosition: CharacterPosition = {
    x: canvasSize.width / 2 + 100,
    y: canvasSize.height / 2,
    bubblePosition: 'left',
  };

  if (!targetComponentId) {
    return defaultPosition;
  }

  // Find the target component
  const targetComponent = placedComponents.find(c => c.instanceId === targetComponentId);
  if (!targetComponent) {
    return defaultPosition;
  }

  const targetDefinition = componentDefinitions.get(targetComponentId);
  const targetBounds = getComponentBounds(targetComponent, targetDefinition);

  // Calculate candidate positions around the target component
  const candidates: Array<CharacterPosition & { score: number }> = [
    // Right of component
    {
      x: targetBounds.x + targetBounds.width + CHARACTER_PADDING + CHARACTER_WIDTH / 2,
      y: targetBounds.y + targetBounds.height / 2,
      bubblePosition: 'left' as const,
      score: 0,
    },
    // Left of component
    {
      x: targetBounds.x - CHARACTER_PADDING - CHARACTER_WIDTH / 2,
      y: targetBounds.y + targetBounds.height / 2,
      bubblePosition: 'right' as const,
      score: 0,
    },
    // Below component
    {
      x: targetBounds.x + targetBounds.width / 2,
      y: targetBounds.y + targetBounds.height + CHARACTER_PADDING + CHARACTER_HEIGHT / 2,
      bubblePosition: 'top' as const,
      score: 0,
    },
    // Above component
    {
      x: targetBounds.x + targetBounds.width / 2,
      y: targetBounds.y - CHARACTER_PADDING - CHARACTER_HEIGHT / 2,
      bubblePosition: 'bottom' as const,
      score: 0,
    },
  ];

  // Score each candidate position
  for (const candidate of candidates) {
    let score = 100;

    // Create bounding box for character at this position
    const characterBounds: BoundingBox = {
      x: candidate.x - CHARACTER_WIDTH / 2,
      y: candidate.y - CHARACTER_HEIGHT / 2,
      width: CHARACTER_WIDTH,
      height: CHARACTER_HEIGHT,
    };

    // Penalize if outside canvas bounds
    if (characterBounds.x < CANVAS_PADDING) {
      score -= 50;
    }
    if (characterBounds.y < CANVAS_PADDING) {
      score -= 50;
    }
    if (characterBounds.x + characterBounds.width > canvasSize.width - CANVAS_PADDING) {
      score -= 50;
    }
    if (characterBounds.y + characterBounds.height > canvasSize.height - CANVAS_PADDING) {
      score -= 50;
    }

    // Penalize overlap with other components
    for (const component of placedComponents) {
      if (component.instanceId === targetComponentId) continue;

      const compDefinition = componentDefinitions.get(component.instanceId);
      const compBounds = getComponentBounds(component, compDefinition);

      if (boxesOverlap(characterBounds, compBounds, 10)) {
        score -= 30;
      }
    }

    // Slight preference for right position (most readable for LTR text)
    if (candidate.bubblePosition === 'left') {
      score += 5;
    }

    candidate.score = score;
  }

  // Sort by score and return the best position
  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];

  return {
    x: best.x,
    y: best.y,
    bubblePosition: best.bubblePosition,
  };
}

/**
 * Calculate center position for multiple highlighted items
 */
export function calculateCenterPosition(
  highlightedComponentIds: string[],
  placedComponents: PlacedComponent[],
  componentDefinitions: Map<string, ComponentDefinition>
): { x: number; y: number } {
  if (highlightedComponentIds.length === 0) {
    return { x: 400, y: 300 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const id of highlightedComponentIds) {
    const component = placedComponents.find(c => c.instanceId === id);
    if (!component) continue;

    const definition = componentDefinitions.get(id);
    const bounds = getComponentBounds(component, definition);

    minX = Math.min(minX, bounds.x);
    minY = Math.min(minY, bounds.y);
    maxX = Math.max(maxX, bounds.x + bounds.width);
    maxY = Math.max(maxY, bounds.y + bounds.height);
  }

  if (minX === Infinity) {
    return { x: 400, y: 300 };
  }

  return {
    x: (minX + maxX) / 2,
    y: (minY + maxY) / 2,
  };
}

/**
 * Get a default position when no target is specified
 */
export function getDefaultCharacterPosition(
  canvasSize: { width: number; height: number } = { width: 1200, height: 800 }
): CharacterPosition {
  return {
    x: canvasSize.width - 150,
    y: canvasSize.height - 150,
    bubblePosition: 'left',
  };
}
