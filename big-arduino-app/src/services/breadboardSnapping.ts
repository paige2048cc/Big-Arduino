/**
 * Breadboard Snapping Service
 *
 * Handles snapping components to breadboard pins for insertion.
 * Implements real breadboard behavior where:
 * - Each row has 5 pins that are internally connected
 * - Top section (rows J, I, H, G, F) and bottom section (rows E, D, C, B, A) are isolated
 * - Components should snap to valid positions within the same row section
 */

import type { PlacedComponent, ComponentDefinition, Pin } from '../types/components';

// Snap threshold in canvas pixels
export const BREADBOARD_SNAP_THRESHOLD = 25;

export interface SnapCandidate {
  breadboardInstanceId: string;
  breadboardPinId: string;
  componentPinId: string;
  distance: number;
  net: string;
  canvasPosition: { x: number; y: number };
  localPosition: { x: number; y: number }; // Position in breadboard local coords
}

export interface SnapResult {
  success: boolean;
  snappedPosition: { x: number; y: number };
  insertedPins: Record<string, string>; // componentPinId -> breadboardPinId
  breadboardInstanceId: string;
}

/**
 * Check if two net names belong to the same row section
 * Valid combinations: both row-N-top, both row-N-bottom, or both same power rail
 */
export function areSameRowSection(net1: string, net2: string): boolean {
  // Power rails - check if both are the same type
  if (net1.startsWith('power-') && net2.startsWith('power-')) {
    return net1 === net2;
  }

  // Terminal rows - check if same section (top or bottom)
  const match1 = net1.match(/^row-(\d+)-(top|bottom)$/);
  const match2 = net2.match(/^row-(\d+)-(top|bottom)$/);

  if (match1 && match2) {
    // Must be same section type (both top or both bottom)
    // But can be different row numbers (spanning columns)
    return match1[2] === match2[2];
  }

  // Mixed types (power rail + terminal) - not valid for 2-pin components
  return false;
}

/**
 * Calculate distance between two points
 */
function distance(p1: { x: number; y: number }, p2: { x: number; y: number }): number {
  return Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
}

/**
 * Transform a point from component local coordinates to canvas coordinates
 * Handles rotation and flip transformations
 *
 * This function matches Fabric.js transform behavior where:
 * - componentX, componentY is the canvas position of the local origin (top-left) after all transforms
 * - Transforms are applied in order: flip (scale) -> rotate -> translate
 * - Flip and rotation happen around the object's center
 */
function transformToCanvas(
  localX: number,
  localY: number,
  componentX: number,
  componentY: number,
  rotation: number = 0,
  width: number = 0,
  height: number = 0,
  flipX: boolean = false,
  flipY: boolean = false
): { x: number; y: number } {
  const centerX = width / 2;
  const centerY = height / 2;
  const rad = (rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  // Step 1: Calculate where the center is in canvas coordinates
  // The origin (local 0,0) relative to center is (-centerX, -centerY)
  // Apply flip: if flipX, x becomes positive (centerX); if flipY, y becomes positive (centerY)
  let originRelX = flipX ? centerX : -centerX;
  let originRelY = flipY ? centerY : -centerY;

  // Apply rotation to get the origin's offset from center in canvas space
  const rotatedOriginRelX = originRelX * cos - originRelY * sin;
  const rotatedOriginRelY = originRelX * sin + originRelY * cos;

  // componentX, componentY is where the origin ended up on canvas
  // So center is at: (componentX - rotatedOriginRelX, componentY - rotatedOriginRelY)
  const centerCanvasX = componentX - rotatedOriginRelX;
  const centerCanvasY = componentY - rotatedOriginRelY;

  // Step 2: Transform the pin position
  // Pin relative to center in local coords
  let pinRelX = localX - centerX;
  let pinRelY = localY - centerY;

  // Apply flip (scale) to pin position
  if (flipX) {
    pinRelX = -pinRelX;
  }
  if (flipY) {
    pinRelY = -pinRelY;
  }

  // Apply rotation
  const rotatedPinRelX = pinRelX * cos - pinRelY * sin;
  const rotatedPinRelY = pinRelX * sin + pinRelY * cos;

  // Final canvas position = center + rotated pin offset
  return {
    x: centerCanvasX + rotatedPinRelX,
    y: centerCanvasY + rotatedPinRelY,
  };
}

/**
 * Find snap candidates for a component's pins near a breadboard
 */
export function findSnapCandidates(
  component: PlacedComponent,
  componentDef: ComponentDefinition,
  breadboard: PlacedComponent,
  breadboardDef: ComponentDefinition,
  dragX: number,
  dragY: number
): Map<string, SnapCandidate[]> {
  const candidatesByPin = new Map<string, SnapCandidate[]>();

  // For each component pin
  for (const pin of componentDef.pins) {
    // Calculate where this pin would be at the drag position
    const pinCanvasPos = transformToCanvas(
      pin.x,
      pin.y,
      dragX,
      dragY,
      component.rotation,
      componentDef.width,
      componentDef.height,
      component.flipX,
      component.flipY
    );

    const candidates: SnapCandidate[] = [];

    // Check each breadboard pin
    for (const bbPin of breadboardDef.pins) {
      const bbPinCanvasPos = transformToCanvas(
        bbPin.x,
        bbPin.y,
        breadboard.x,
        breadboard.y,
        breadboard.rotation,
        breadboardDef.width,
        breadboardDef.height,
        breadboard.flipX,
        breadboard.flipY
      );

      const dist = distance(pinCanvasPos, bbPinCanvasPos);

      if (dist <= BREADBOARD_SNAP_THRESHOLD) {
        candidates.push({
          breadboardInstanceId: breadboard.instanceId,
          breadboardPinId: bbPin.id,
          componentPinId: pin.id,
          distance: dist,
          net: bbPin.net || bbPin.id,
          canvasPosition: bbPinCanvasPos,
          localPosition: { x: bbPin.x, y: bbPin.y },
        });
      }
    }

    // Sort by distance (closest first)
    candidates.sort((a, b) => a.distance - b.distance);
    candidatesByPin.set(pin.id, candidates);
  }

  return candidatesByPin;
}

/**
 * Find the best snap position for a two-pin component (LED, resistor, etc.)
 * Both pins must snap to the same row section (not across center gap)
 */
function findBestTwoPinSnap(
  candidatesByPin: Map<string, SnapCandidate[]>,
  pins: Pin[],
  componentDef: ComponentDefinition,
  componentRotation: number,
  componentFlipX: boolean = false,
  componentFlipY: boolean = false
): SnapResult | null {
  const [pin1, pin2] = pins;
  const candidates1 = candidatesByPin.get(pin1.id) || [];
  const candidates2 = candidatesByPin.get(pin2.id) || [];

  if (candidates1.length === 0 || candidates2.length === 0) {
    // At least one pin has no candidates - try single pin snap
    return findBestSinglePinSnap(candidatesByPin, pins, componentDef, componentRotation, componentFlipX, componentFlipY);
  }

  // Calculate expected pin separation
  const expectedSeparation = distance(
    { x: pin1.x, y: pin1.y },
    { x: pin2.x, y: pin2.y }
  );

  let bestResult: SnapResult | null = null;
  let bestScore = Infinity;

  for (const c1 of candidates1) {
    for (const c2 of candidates2) {
      // Must be in same row section
      if (!areSameRowSection(c1.net, c2.net)) {
        continue;
      }

      // Validate pin spacing matches breadboard hole spacing
      const actualSeparation = distance(c1.canvasPosition, c2.canvasPosition);
      const separationError = Math.abs(actualSeparation - expectedSeparation);

      // Allow some tolerance for rotation and scale
      if (separationError > 10) {
        continue;
      }

      // Score based on total distance + separation error
      const score = c1.distance + c2.distance + separationError * 0.5;

      if (score < bestScore) {
        bestScore = score;

        // Calculate component position that aligns both pins
        const snappedPosition = calculateTwoPinPosition(
          pin1, pin2,
          c1.canvasPosition, c2.canvasPosition,
          componentDef,
          componentRotation,
          componentFlipX,
          componentFlipY
        );

        bestResult = {
          success: true,
          snappedPosition,
          insertedPins: {
            [pin1.id]: c1.breadboardPinId,
            [pin2.id]: c2.breadboardPinId,
          },
          breadboardInstanceId: c1.breadboardInstanceId,
        };
      }
    }
  }

  return bestResult;
}

/**
 * Calculate component position that aligns two pins to two target positions
 * This is the inverse of transformToCanvas - given where pins should be,
 * find the component's left/top position
 */
function calculateTwoPinPosition(
  pin1: Pin,
  pin2: Pin,
  target1: { x: number; y: number },
  target2: { x: number; y: number },
  componentDef: ComponentDefinition,
  rotation: number,
  flipX: boolean = false,
  flipY: boolean = false
): { x: number; y: number } {
  // Use the midpoint approach - align the midpoint of pins to midpoint of targets
  const pinMidX = (pin1.x + pin2.x) / 2;
  const pinMidY = (pin1.y + pin2.y) / 2;
  const targetMidX = (target1.x + target2.x) / 2;
  const targetMidY = (target1.y + target2.y) / 2;

  // Use calculateSinglePinPosition with the midpoint as a virtual pin
  return calculateSinglePinPosition(
    { id: 'mid', x: pinMidX, y: pinMidY } as Pin,
    { x: targetMidX, y: targetMidY },
    componentDef,
    rotation,
    flipX,
    flipY
  );
}

/**
 * Find the best snap position for a 4-pin component (pushbutton)
 * Maps all 4 pins to breadboard holes based on two anchor pins
 */
function findBestFourPinSnap(
  candidatesByPin: Map<string, SnapCandidate[]>,
  pins: Pin[],
  componentDef: ComponentDefinition,
  componentRotation: number,
  componentFlipX: boolean = false,
  componentFlipY: boolean = false,
  breadboardDef: ComponentDefinition,
  breadboard: PlacedComponent
): SnapResult | null {
  if (pins.length !== 4) {
    return null;
  }

  // Group pins by Y position (top pair vs bottom pair)
  const sortedByY = [...pins].sort((a, b) => a.y - b.y);
  const topPins = sortedByY.slice(0, 2); // Lower Y = top of component
  const bottomPins = sortedByY.slice(2, 4); // Higher Y = bottom of component

  // Try to find two pins on the same side that can snap
  // Prefer bottom pins (PIN1A, PIN2A) as the primary anchor
  const anchorPairs = [
    [bottomPins[0], bottomPins[1]], // Try bottom pair first
    [topPins[0], topPins[1]], // Then top pair
  ];

  for (const [pin1, pin2] of anchorPairs) {
    const candidates1 = candidatesByPin.get(pin1.id) || [];
    const candidates2 = candidatesByPin.get(pin2.id) || [];

    if (candidates1.length === 0 || candidates2.length === 0) continue;

    // Calculate expected pin separation
    const expectedSeparation = distance(
      { x: pin1.x, y: pin1.y },
      { x: pin2.x, y: pin2.y }
    );

    let bestResult: SnapResult | null = null;
    let bestScore = Infinity;

    for (const c1 of candidates1) {
      for (const c2 of candidates2) {
        // Must be in same row section
        if (!areSameRowSection(c1.net, c2.net)) continue;

        // Validate pin spacing
        const actualSeparation = distance(c1.canvasPosition, c2.canvasPosition);
        const separationError = Math.abs(actualSeparation - expectedSeparation);

        if (separationError > 10) continue;

        const score = c1.distance + c2.distance + separationError * 0.5;

        if (score < bestScore) {
          bestScore = score;

          // Calculate component position based on these two anchor pins
          const snappedPosition = calculateTwoPinPosition(
            pin1, pin2,
            c1.canvasPosition, c2.canvasPosition,
            componentDef,
            componentRotation,
            componentFlipX,
            componentFlipY
          );

          // Now calculate where ALL 4 pins would be at this snapped position
          // and find the closest breadboard pin for each
          const insertedPins: Record<string, string> = {};
          let allPinsValid = true;

          for (const pin of pins) {
            const pinCanvasPos = transformToCanvas(
              pin.x, pin.y,
              snappedPosition.x, snappedPosition.y,
              componentRotation,
              componentDef.width, componentDef.height,
              componentFlipX, componentFlipY
            );

            // Find the closest breadboard pin to this position
            let closestBbPin: { id: string; distance: number } | null = null;

            for (const bbPin of breadboardDef.pins) {
              const bbPinCanvasPos = transformToCanvas(
                bbPin.x, bbPin.y,
                breadboard.x, breadboard.y,
                breadboard.rotation,
                breadboardDef.width, breadboardDef.height,
                breadboard.flipX, breadboard.flipY
              );

              const dist = distance(pinCanvasPos, bbPinCanvasPos);
              if (dist <= BREADBOARD_SNAP_THRESHOLD && (!closestBbPin || dist < closestBbPin.distance)) {
                closestBbPin = { id: bbPin.id, distance: dist };
              }
            }

            if (closestBbPin) {
              insertedPins[pin.id] = closestBbPin.id;
            } else {
              // This pin doesn't snap to any breadboard hole
              allPinsValid = false;
              break;
            }
          }

          if (allPinsValid && Object.keys(insertedPins).length === 4) {
            bestResult = {
              success: true,
              snappedPosition,
              insertedPins,
              breadboardInstanceId: c1.breadboardInstanceId,
            };
          }
        }
      }
    }

    if (bestResult) {
      return bestResult;
    }
  }

  // Fallback to single pin snap if 4-pin snap fails
  return findBestSinglePinSnapWithAllPins(
    candidatesByPin, pins, componentDef, componentRotation,
    componentFlipX, componentFlipY, breadboardDef, breadboard
  );
}

/**
 * Single pin snap that also maps other nearby pins
 */
function findBestSinglePinSnapWithAllPins(
  candidatesByPin: Map<string, SnapCandidate[]>,
  pins: Pin[],
  componentDef: ComponentDefinition,
  componentRotation: number,
  componentFlipX: boolean,
  componentFlipY: boolean,
  breadboardDef: ComponentDefinition,
  breadboard: PlacedComponent
): SnapResult | null {
  let bestCandidate: SnapCandidate | null = null;
  let bestPin: Pin | null = null;

  for (const pin of pins) {
    const candidates = candidatesByPin.get(pin.id) || [];
    if (candidates.length > 0 && (!bestCandidate || candidates[0].distance < bestCandidate.distance)) {
      bestCandidate = candidates[0];
      bestPin = pin;
    }
  }

  if (!bestCandidate || !bestPin) {
    return null;
  }

  const snappedPosition = calculateSinglePinPosition(
    bestPin,
    bestCandidate.canvasPosition,
    componentDef,
    componentRotation,
    componentFlipX,
    componentFlipY
  );

  // Map all pins that are close to breadboard holes
  const insertedPins: Record<string, string> = {};

  for (const pin of pins) {
    const pinCanvasPos = transformToCanvas(
      pin.x, pin.y,
      snappedPosition.x, snappedPosition.y,
      componentRotation,
      componentDef.width, componentDef.height,
      componentFlipX, componentFlipY
    );

    let closestBbPin: { id: string; distance: number } | null = null;

    for (const bbPin of breadboardDef.pins) {
      const bbPinCanvasPos = transformToCanvas(
        bbPin.x, bbPin.y,
        breadboard.x, breadboard.y,
        breadboard.rotation,
        breadboardDef.width, breadboardDef.height,
        breadboard.flipX, breadboard.flipY
      );

      const dist = distance(pinCanvasPos, bbPinCanvasPos);
      if (dist <= BREADBOARD_SNAP_THRESHOLD && (!closestBbPin || dist < closestBbPin.distance)) {
        closestBbPin = { id: bbPin.id, distance: dist };
      }
    }

    if (closestBbPin) {
      insertedPins[pin.id] = closestBbPin.id;
    }
  }

  return {
    success: true,
    snappedPosition,
    insertedPins,
    breadboardInstanceId: bestCandidate.breadboardInstanceId,
  };
}

/**
 * Find the best snap position when only one pin can snap (fallback)
 */
function findBestSinglePinSnap(
  candidatesByPin: Map<string, SnapCandidate[]>,
  pins: Pin[],
  componentDef: ComponentDefinition,
  componentRotation: number,
  componentFlipX: boolean = false,
  componentFlipY: boolean = false
): SnapResult | null {
  let bestCandidate: SnapCandidate | null = null;
  let bestPin: Pin | null = null;

  for (const pin of pins) {
    const candidates = candidatesByPin.get(pin.id) || [];
    if (candidates.length > 0 && (!bestCandidate || candidates[0].distance < bestCandidate.distance)) {
      bestCandidate = candidates[0];
      bestPin = pin;
    }
  }

  if (!bestCandidate || !bestPin) {
    return null;
  }

  // Calculate component position that aligns this pin to the target
  const snappedPosition = calculateSinglePinPosition(
    bestPin,
    bestCandidate.canvasPosition,
    componentDef,
    componentRotation,
    componentFlipX,
    componentFlipY
  );

  return {
    success: true,
    snappedPosition,
    insertedPins: {
      [bestPin.id]: bestCandidate.breadboardPinId,
    },
    breadboardInstanceId: bestCandidate.breadboardInstanceId,
  };
}

/**
 * Calculate component position that aligns a single pin to a target position
 * This is the inverse of transformToCanvas - given where a pin should be on canvas,
 * calculate the component's left/top position
 */
function calculateSinglePinPosition(
  pin: Pin,
  target: { x: number; y: number },
  componentDef: ComponentDefinition,
  rotation: number,
  flipX: boolean = false,
  flipY: boolean = false
): { x: number; y: number } {
  const centerX = componentDef.width / 2;
  const centerY = componentDef.height / 2;
  const rad = (rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  // Calculate pin offset relative to center (same as transformToCanvas)
  let pinRelX = pin.x - centerX;
  let pinRelY = pin.y - centerY;
  if (flipX) pinRelX = -pinRelX;
  if (flipY) pinRelY = -pinRelY;
  const rotatedPinRelX = pinRelX * cos - pinRelY * sin;
  const rotatedPinRelY = pinRelX * sin + pinRelY * cos;

  // Calculate origin offset relative to center (same as transformToCanvas)
  // When flipX, the origin is at +centerX from center; otherwise -centerX
  const originRelX = flipX ? centerX : -centerX;
  const originRelY = flipY ? centerY : -centerY;
  const rotatedOriginRelX = originRelX * cos - originRelY * sin;
  const rotatedOriginRelY = originRelX * sin + originRelY * cos;

  // Inverse: component left/top = target - rotatedPinRel + rotatedOriginRel
  return {
    x: target.x - rotatedPinRelX + rotatedOriginRelX,
    y: target.y - rotatedPinRelY + rotatedOriginRelY,
  };
}

/**
 * Main function to calculate snap position for a component
 */
export function calculateSnapPosition(
  component: PlacedComponent,
  componentDef: ComponentDefinition,
  breadboard: PlacedComponent,
  breadboardDef: ComponentDefinition,
  dragX: number,
  dragY: number
): SnapResult | null {
  // Find all snap candidates
  const candidatesByPin = findSnapCandidates(
    component,
    componentDef,
    breadboard,
    breadboardDef,
    dragX,
    dragY
  );

  // Check if any pin has candidates
  let hasAnyCandidates = false;
  candidatesByPin.forEach(candidates => {
    if (candidates.length > 0) hasAnyCandidates = true;
  });

  if (!hasAnyCandidates) {
    return null;
  }

  const pins = componentDef.pins;

  // For 2-pin components (LED, resistor, etc.), try to snap both pins
  if (pins.length === 2) {
    return findBestTwoPinSnap(candidatesByPin, pins, componentDef, component.rotation, component.flipX, component.flipY);
  }

  // For 4-pin components (pushbutton), try to snap all 4 pins
  if (pins.length === 4) {
    return findBestFourPinSnap(
      candidatesByPin, pins, componentDef, component.rotation,
      component.flipX, component.flipY, breadboardDef, breadboard
    );
  }

  // For single-pin or other multi-pin components, use single pin snap
  return findBestSinglePinSnap(candidatesByPin, pins, componentDef, component.rotation, component.flipX, component.flipY);
}

/**
 * Check if a component should be removed from breadboard (dragged away)
 */
export function shouldRemoveFromBreadboard(
  component: PlacedComponent,
  componentDef: ComponentDefinition,
  breadboard: PlacedComponent,
  breadboardDef: ComponentDefinition
): boolean {
  if (!component.parentBreadboardId || !component.insertedPins) {
    return false;
  }

  // Check if any inserted pin is still close to its breadboard pin
  for (const [componentPinId, breadboardPinId] of Object.entries(component.insertedPins)) {
    const componentPin = componentDef.pins.find(p => p.id === componentPinId);
    const breadboardPin = breadboardDef.pins.find(p => p.id === breadboardPinId);

    if (!componentPin || !breadboardPin) continue;

    const componentPinPos = transformToCanvas(
      componentPin.x,
      componentPin.y,
      component.x,
      component.y,
      component.rotation,
      componentDef.width,
      componentDef.height,
      component.flipX,
      component.flipY
    );

    const breadboardPinPos = transformToCanvas(
      breadboardPin.x,
      breadboardPin.y,
      breadboard.x,
      breadboard.y,
      breadboard.rotation,
      breadboardDef.width,
      breadboardDef.height,
      breadboard.flipX,
      breadboard.flipY
    );

    const dist = distance(componentPinPos, breadboardPinPos);

    // If any pin is still within threshold, keep it inserted
    if (dist <= BREADBOARD_SNAP_THRESHOLD * 1.5) {
      return false;
    }
  }

  // All pins are far from their original positions - remove from breadboard
  return true;
}
