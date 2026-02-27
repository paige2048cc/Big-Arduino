/**
 * Circuit Path Tracer Service
 *
 * Traces the visual current-flow path from a power source through the circuit,
 * collecting scene-coordinate waypoints for ball animation and highlights.
 */

import type { PlacedComponent, Wire, ComponentDefinition } from '../types/components';

export interface BreadboardHighlight {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CircuitAnimationPath {
  waypoints: { x: number; y: number }[];
  wireIds: string[];
  breadboardHighlights: BreadboardHighlight[];
  isComplete: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Computes a pin's position in scene (canvas) coordinates, accounting for
 * component position, rotation, and flip. Mirrors what Fabric.js's
 * calcTransformMatrix does for originX:'left', originY:'top' objects.
 */
function getPinScenePos(
  comp: PlacedComponent,
  def: ComponentDefinition,
  pinId: string
): { x: number; y: number } | null {
  const pin = def.pins.find(p => p.id === pinId);
  if (!pin) return null;

  // Component center in scene coords (comp.x/y are top-left)
  const cx = comp.x + def.width / 2;
  const cy = comp.y + def.height / 2;

  // Pin position relative to component center, with flip applied
  const rx = comp.flipX ? -(pin.x - def.width / 2) : (pin.x - def.width / 2);
  const ry = comp.flipY ? -(pin.y - def.height / 2) : (pin.y - def.height / 2);

  // Apply rotation
  const rad = (comp.rotation ?? 0) * Math.PI / 180;
  return {
    x: cx + rx * Math.cos(rad) - ry * Math.sin(rad),
    y: cy + rx * Math.sin(rad) + ry * Math.cos(rad),
  };
}

function findWiresAtPin(compId: string, pinId: string, wires: Wire[]): Wire[] {
  return wires.filter(
    w =>
      (w.startComponentId === compId && w.startPinId === pinId) ||
      (w.endComponentId === compId && w.endPinId === pinId)
  );
}

function getOtherEnd(
  wire: Wire,
  compId: string,
  pinId: string
): { componentId: string; pinId: string } {
  if (wire.startComponentId === compId && wire.startPinId === pinId) {
    return { componentId: wire.endComponentId, pinId: wire.endPinId };
  }
  return { componentId: wire.startComponentId, pinId: wire.startPinId };
}

function isGroundPin(compType: string, pinId: string, pinType: string): boolean {
  if (compType === 'arduino-uno') {
    return pinId.includes('GND') || pinType === 'ground';
  }
  return pinType === 'ground';
}

/**
 * Returns pin IDs that are internally connected to the given pin within the
 * same component (e.g. resistor terminals, LED anode→cathode for animation).
 */
function getInternalConnections(
  compType: string,
  pinId: string,
  compId?: string,
  buttonStates?: Map<string, boolean>
): string[] {
  // Resistors: two terminals are always connected
  if (
    compType.toLowerCase().includes('resistor') ||
    compType.toLowerCase().includes('registor')
  ) {
    if (pinId === 'TERM1') return ['TERM2'];
    if (pinId === 'TERM2') return ['TERM1'];
  }
  // LEDs: forward direction for animation visualisation
  if (compType.toLowerCase().includes('led')) {
    if (pinId === 'ANODE') return ['CATHODE'];
  }
  // Pushbutton: same-side pairs are always connected (A: PIN1A↔PIN2A, B: PIN1B↔PIN2B).
  // When pressed, all four pins connect.
  if (
    compType.toLowerCase().includes('pushbutton') ||
    compType.toLowerCase().includes('button')
  ) {
    const isPressed = compId && buttonStates ? (buttonStates.get(compId) ?? false) : false;
    if (isPressed) {
      return ['PIN1A', 'PIN1B', 'PIN2A', 'PIN2B'].filter(p => p !== pinId);
    }
    if (pinId === 'PIN1A') return ['PIN2A'];
    if (pinId === 'PIN2A') return ['PIN1A'];
    if (pinId === 'PIN1B') return ['PIN2B'];
    if (pinId === 'PIN2B') return ['PIN1B'];
  }
  return [];
}

function computeNetHighlight(
  comp: PlacedComponent,
  def: ComponentDefinition,
  net: string
): BreadboardHighlight {
  const netPins = def.pins.filter(p => p.net === net);
  const positions = netPins
    .map(p => getPinScenePos(comp, def, p.id))
    .filter((p): p is { x: number; y: number } => p !== null);

  if (positions.length === 0) return { x: 0, y: 0, width: 0, height: 0 };

  const xs = positions.map(p => p.x);
  const ys = positions.map(p => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const pad = 6;

  return {
    x: minX - pad,
    y: minY - pad,
    width: maxX - minX + pad * 2,
    height: maxY - minY + pad * 2,
  };
}

// ---------------------------------------------------------------------------
// DFS tracer
// ---------------------------------------------------------------------------

interface TraceResult {
  waypoints: { x: number; y: number }[];
  wireIds: string[];
  highlights: BreadboardHighlight[];
  isComplete: boolean;
}

const EMPTY: TraceResult = {
  waypoints: [],
  wireIds: [],
  highlights: [],
  isComplete: false,
};

function traceFrom(
  compId: string,
  pinId: string,
  components: PlacedComponent[],
  definitions: Map<string, ComponentDefinition>,
  wires: Wire[],
  visited: Set<string>,
  buttonStates?: Map<string, boolean>
): TraceResult {
  const key = `${compId}:${pinId}`;
  if (visited.has(key)) return EMPTY;
  visited.add(key);

  const comp = components.find(c => c.instanceId === compId);
  if (!comp) return EMPTY;

  const def = definitions.get(compId);
  if (!def) return EMPTY;

  const pin = def.pins.find(p => p.id === pinId);
  const pinType = pin?.type ?? 'terminal';
  const compType = def.id;

  const pos = getPinScenePos(comp, def, pinId);
  const myWaypoints: { x: number; y: number }[] = pos ? [pos] : [];

  // ── Ground check ──────────────────────────────────────────────────────────
  if (isGroundPin(compType, pinId, pinType)) {
    return { waypoints: myWaypoints, wireIds: [], highlights: [], isComplete: true };
  }

  // ── Internal connections (resistors, LEDs, buttons) ──────────────────────
  for (const internalPinId of getInternalConnections(compType, pinId, compId, buttonStates)) {
    const sub = traceFrom(compId, internalPinId, components, definitions, wires, visited, buttonStates);
    // Only accept sub-paths that make real progress (reach GND or include actual wires).
    // A highlights-only result means we landed on an unconnected breadboard row —
    // treating that as "progress" would cause early return and skip the correct path
    // (e.g. when a pressed button's same-side sibling pin maps to an empty row while
    // the cross-side pin is in the row containing the next component in the circuit).
    if (sub.isComplete || sub.wireIds.length > 0) {
      return { ...sub, waypoints: [...myWaypoints, ...sub.waypoints] };
    }
  }

  // ── Breadboard net group ──────────────────────────────────────────────────
  if (pin?.net) {
    const highlight = computeNetHighlight(comp, def, pin.net);
    const netPins = def.pins.filter(p => p.net === pin.net && p.id !== pinId);

    for (const netPin of netPins) {
      const netKey = `${compId}:${netPin.id}`;
      if (visited.has(netKey)) continue;
      visited.add(netKey);

      const netPinPos = getPinScenePos(comp, def, netPin.id);

      // Wires at this net-sibling pin
      for (const wire of findWiresAtPin(compId, netPin.id, wires)) {
        const otherEnd = getOtherEnd(wire, compId, netPin.id);
        const wireWaypoints =
          wire.startComponentId === compId && wire.startPinId === netPin.id
            ? [...wire.bendPoints]
            : [...wire.bendPoints].reverse();

        const sub = traceFrom(
          otherEnd.componentId,
          otherEnd.pinId,
          components,
          definitions,
          wires,
          visited,
          buttonStates
        );

        const exitWaypoints: { x: number; y: number }[] = netPinPos ? [netPinPos] : [];

        // Return the first wire path that makes progress
        return {
          waypoints: [...myWaypoints, ...exitWaypoints, ...wireWaypoints, ...sub.waypoints],
          wireIds: [wire.id, ...sub.wireIds],
          highlights: [highlight, ...sub.highlights],
          isComplete: sub.isComplete,
        };
      }

      // Inserted components at this net-sibling pin
      for (const insertedComp of components) {
        if (insertedComp.parentBreadboardId !== compId) continue;
        if (!insertedComp.insertedPins) continue;

        for (const [compPinId, bbPinId] of Object.entries(insertedComp.insertedPins)) {
          if (bbPinId !== netPin.id) continue;

          const sub = traceFrom(
            insertedComp.instanceId,
            compPinId,
            components,
            definitions,
            wires,
            visited,
            buttonStates
          );
          if (sub.isComplete || sub.wireIds.length > 0) {
            const exitWaypoints: { x: number; y: number }[] = netPinPos ? [netPinPos] : [];
            return {
              waypoints: [...myWaypoints, ...exitWaypoints, ...sub.waypoints],
              wireIds: sub.wireIds,
              highlights: [highlight, ...sub.highlights],
              isComplete: sub.isComplete,
            };
          }
        }
      }
    }

    // Net group found but no connected wires - still show highlight
    return {
      waypoints: myWaypoints,
      wireIds: [],
      highlights: [highlight],
      isComplete: false,
    };
  }

  // ── Follow wires ──────────────────────────────────────────────────────────
  for (const wire of findWiresAtPin(compId, pinId, wires)) {
    const otherEnd = getOtherEnd(wire, compId, pinId);
    const wireWaypoints =
      wire.startComponentId === compId && wire.startPinId === pinId
        ? [...wire.bendPoints]
        : [...wire.bendPoints].reverse();

    const sub = traceFrom(
      otherEnd.componentId,
      otherEnd.pinId,
      components,
      definitions,
      wires,
      visited,
      buttonStates
    );

    return {
      waypoints: [...myWaypoints, ...wireWaypoints, ...sub.waypoints],
      wireIds: [wire.id, ...sub.wireIds],
      highlights: sub.highlights,
      isComplete: sub.isComplete,
    };
  }

  // ── Component inserted into breadboard ────────────────────────────────────
  if (comp.parentBreadboardId && comp.insertedPins) {
    const bbPinId = comp.insertedPins[pinId];
    if (bbPinId) {
      const sub = traceFrom(
        comp.parentBreadboardId,
        bbPinId,
        components,
        definitions,
        wires,
        visited,
        buttonStates
      );
      if (sub.wireIds.length > 0 || sub.highlights.length > 0 || sub.isComplete) {
        return { ...sub, waypoints: [...myWaypoints, ...sub.waypoints] };
      }
    }
  }

  return { waypoints: myWaypoints, wireIds: [], highlights: [], isComplete: false };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Finds all power-source pins in the current circuit (Arduino 5V/3.3V/VIN
 * or any pin with type === 'power').
 */
export function findAllPowerPins(
  components: PlacedComponent[],
  definitions: Map<string, ComponentDefinition>
): { componentId: string; pinId: string }[] {
  const result: { componentId: string; pinId: string }[] = [];
  for (const comp of components) {
    const def = definitions.get(comp.instanceId);
    if (!def) continue;
    for (const pin of def.pins) {
      const isArduinoPower =
        def.id === 'arduino-uno' &&
        (pin.id === '5V' || pin.id === '3.3V' || pin.id === 'VIN');
      if (isArduinoPower || pin.type === 'power') {
        result.push({ componentId: comp.instanceId, pinId: pin.id });
      }
    }
  }
  return result;
}

/**
 * Traces the visual current-flow path starting from a power pin, returning
 * ordered scene-coordinate waypoints, wire IDs to highlight, breadboard
 * row/rail highlight rectangles, and whether the path reaches GND.
 */
export function tracePowerPath(
  powerComponentId: string,
  powerPinId: string,
  components: PlacedComponent[],
  definitions: Map<string, ComponentDefinition>,
  wires: Wire[],
  buttonStates?: Map<string, boolean>
): CircuitAnimationPath {
  const visited = new Set<string>();
  const result = traceFrom(
    powerComponentId,
    powerPinId,
    components,
    definitions,
    wires,
    visited,
    buttonStates
  );

  return {
    waypoints: result.waypoints,
    wireIds: [...new Set(result.wireIds)],
    breadboardHighlights: result.highlights,
    isComplete: result.isComplete,
  };
}
