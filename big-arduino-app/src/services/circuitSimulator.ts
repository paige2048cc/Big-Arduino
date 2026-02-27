/**
 * Circuit Simulator Service
 *
 * Analyzes circuit connections and validates paths from power to ground.
 * Detects errors like missing connections, wrong polarity, and missing resistors.
 */

import type { PlacedComponent, Wire, ComponentDefinition, PinType } from '../types/components';

// Circuit error types
export type CircuitErrorType =
  | 'no-ground'
  | 'no-power'
  | 'wrong-polarity'
  | 'missing-resistor'
  | 'short-circuit'
  | 'open-circuit';

// Error information for a circuit issue (may be associated with a wire, a component, or both)
export interface CircuitError {
  wireId?: string;
  errorType: CircuitErrorType;
  message: string;
  componentId?: string;
}

// Result of circuit analysis
export interface SimulationResult {
  isValid: boolean;
  errors: CircuitError[];
  activeComponents: Map<string, 'on' | 'off'>;
}

// Node in the circuit graph
interface CircuitNode {
  componentId: string;
  pinId: string;
  pinType: PinType;
  componentType: string; // e.g., 'arduino-uno', 'led-5mm', 'resistor'
}

// Path trace result
interface PathResult {
  reachesPower: boolean;
  reachesGround: boolean;
  hasResistor: boolean;
  path: CircuitNode[];
  wires: string[]; // Wire IDs in path
  lastWireId: string | null;
}

/**
 * Identifies if a pin is a power source
 */
function isPowerPin(componentType: string, pinId: string, pinType: PinType): boolean {
  // Arduino power pins
  if (componentType === 'arduino-uno') {
    if (pinId === '5V' || pinId === '3.3V' || pinId === 'VIN') {
      return true;
    }
    // Digital pins can also be power sources (when set HIGH)
    // For simplicity, we'll treat them as potential power sources
    if (pinType === 'digital' || pinType === 'pwm') {
      return true;
    }
  }
  return pinType === 'power';
}

/**
 * Identifies if a pin is a ground connection
 */
function isGroundPin(componentType: string, pinId: string, pinType: PinType): boolean {
  if (componentType === 'arduino-uno') {
    return pinId.includes('GND') || pinType === 'ground';
  }
  return pinType === 'ground';
}

/**
 * Identifies if a component is a resistor
 */
function isResistor(componentType: string): boolean {
  return componentType.toLowerCase().includes('resistor') ||
         componentType.toLowerCase().includes('registor'); // Handle typo in filename
}

/**
 * Identifies if a component is an LED
 */
function isLED(componentType: string): boolean {
  return componentType.toLowerCase().includes('led');
}

/**
 * Identifies if a component is a pushbutton
 */
function isButton(componentType: string): boolean {
  return componentType.toLowerCase().includes('button') ||
         componentType.toLowerCase().includes('pushbutton');
}

/**
 * Gets the component type from definition
 */
function getComponentType(
  componentId: string,
  definitions: Map<string, ComponentDefinition>
): string {
  const def = definitions.get(componentId);
  return def?.id || '';
}

/**
 * Finds all wires connected to a specific pin
 */
function findWiresAtPin(
  componentId: string,
  pinId: string,
  wires: Wire[]
): Wire[] {
  return wires.filter(w =>
    (w.startComponentId === componentId && w.startPinId === pinId) ||
    (w.endComponentId === componentId && w.endPinId === pinId)
  );
}

/**
 * Gets the other end of a wire from a given pin
 */
function getOtherEnd(
  wire: Wire,
  componentId: string,
  pinId: string
): { componentId: string; pinId: string } {
  if (wire.startComponentId === componentId && wire.startPinId === pinId) {
    return { componentId: wire.endComponentId, pinId: wire.endPinId };
  }
  return { componentId: wire.startComponentId, pinId: wire.startPinId };
}

/**
 * Gets internal connections within a component (e.g., button pins when pressed,
 * breadboard rows/rails via net property)
 */
function getInternalConnections(
  componentType: string,
  pinId: string,
  buttonStates: Map<string, boolean>,
  componentId: string,
  definition?: ComponentDefinition
): string[] {
  // Pushbutton passive connections: A-side (PIN1A ↔ PIN2A) and B-side
  // (PIN1B ↔ PIN2B) are always internally connected, so a button straddling
  // the breadboard centre gap bridges the rows on each side. When pressed,
  // all four pins connect.
  if (isButton(componentType)) {
    const isPressed = buttonStates.get(componentId) || false;
    if (isPressed) {
      return ['PIN1A', 'PIN1B', 'PIN2A', 'PIN2B'].filter(p => p !== pinId);
    }
    // Not pressed: only same-side pins connect
    if (pinId === 'PIN1A') return ['PIN2A'];
    if (pinId === 'PIN2A') return ['PIN1A'];
    if (pinId === 'PIN1B') return ['PIN2B'];
    if (pinId === 'PIN2B') return ['PIN1B'];
    return [];
  }

  // Resistor: both terminals are always connected (it's just a resistance)
  if (isResistor(componentType)) {
    if (pinId === 'TERM1') return ['TERM2'];
    if (pinId === 'TERM2') return ['TERM1'];
  }

  // Net-based connections (breadboard rows, power rails, etc.)
  // Pins with the same 'net' value are internally connected
  if (definition) {
    const currentPin = definition.pins.find(p => p.id === pinId);
    if (currentPin?.net) {
      return definition.pins
        .filter(p => p.id !== pinId && p.net === currentPin.net)
        .map(p => p.id);
    }
  }

  return [];
}

/**
 * Traces a path from a starting pin to find power or ground
 * @param maxDepth - Maximum recursion depth to prevent infinite loops (default: 100)
 */
function tracePath(
  startComponentId: string,
  startPinId: string,
  wires: Wire[],
  definitions: Map<string, ComponentDefinition>,
  buttonStates: Map<string, boolean>,
  components: PlacedComponent[],
  visited: Set<string> = new Set(),
  depth: number = 0,
  maxDepth: number = 100
): PathResult {
  const result: PathResult = {
    reachesPower: false,
    reachesGround: false,
    hasResistor: false,
    path: [],
    wires: [],
    lastWireId: null,
  };

  // Prevent infinite recursion with depth limit
  if (depth >= maxDepth) {
    console.warn(`tracePath: Max depth (${maxDepth}) reached, stopping recursion`);
    return result;
  }

  const key = `${startComponentId}:${startPinId}`;
  if (visited.has(key)) {
    return result;
  }
  visited.add(key);

  const componentType = getComponentType(startComponentId, definitions);
  const def = definitions.get(startComponentId);
  const pin = def?.pins.find(p => p.id === startPinId);
  const pinType = pin?.type || 'terminal';

  // Add current node to path
  result.path.push({
    componentId: startComponentId,
    pinId: startPinId,
    pinType,
    componentType,
  });

  // Check if this is a power or ground pin
  if (isPowerPin(componentType, startPinId, pinType)) {
    result.reachesPower = true;
    return result;
  }
  if (isGroundPin(componentType, startPinId, pinType)) {
    result.reachesGround = true;
    return result;
  }

  // Check if we're going through a resistor
  if (isResistor(componentType)) {
    result.hasResistor = true;
  }

  // First, check internal connections within the component
  const internalPins = getInternalConnections(componentType, startPinId, buttonStates, startComponentId, def);
  for (const internalPinId of internalPins) {
    const internalResult = tracePath(
      startComponentId,
      internalPinId,
      wires,
      definitions,
      buttonStates,
      components,
      visited,
      depth + 1,
      maxDepth
    );

    if (internalResult.reachesPower) {
      result.reachesPower = true;
      result.hasResistor = result.hasResistor || internalResult.hasResistor;
      result.path = [...result.path, ...internalResult.path];
      result.wires = [...result.wires, ...internalResult.wires];
      return result;
    }
    if (internalResult.reachesGround) {
      result.reachesGround = true;
      result.hasResistor = result.hasResistor || internalResult.hasResistor;
      result.path = [...result.path, ...internalResult.path];
      result.wires = [...result.wires, ...internalResult.wires];
      return result;
    }
  }

  // Check for components inserted into breadboard at this pin
  // If we're at a breadboard pin, trace through any component that's inserted there
  if (componentType === 'breadboard') {
    for (const insertedComponent of components) {
      if (insertedComponent.parentBreadboardId !== startComponentId) continue;
      if (!insertedComponent.insertedPins) continue;

      // Check if any of this component's pins are inserted at our current breadboard pin
      for (const [compPinId, bbPinId] of Object.entries(insertedComponent.insertedPins)) {
        if (bbPinId === startPinId) {
          // This component's pin is at this breadboard pin - trace through it
          const insertedResult = tracePath(
            insertedComponent.instanceId,
            compPinId,
            wires,
            definitions,
            buttonStates,
            components,
            visited,
            depth + 1,
            maxDepth
          );

          if (insertedResult.reachesPower) {
            result.reachesPower = true;
            result.hasResistor = result.hasResistor || insertedResult.hasResistor;
            result.path = [...result.path, ...insertedResult.path];
            result.wires = [...result.wires, ...insertedResult.wires];
            return result;
          }
          if (insertedResult.reachesGround) {
            result.reachesGround = true;
            result.hasResistor = result.hasResistor || insertedResult.hasResistor;
            result.path = [...result.path, ...insertedResult.path];
            result.wires = [...result.wires, ...insertedResult.wires];
            return result;
          }
        }
      }
    }
  }

  // Also check if we're on a component inserted into a breadboard
  // In this case, trace to the breadboard pin we're inserted at
  const currentComponent = components.find(c => c.instanceId === startComponentId);
  if (currentComponent?.parentBreadboardId && currentComponent.insertedPins) {
    const bbPinId = currentComponent.insertedPins[startPinId];
    if (bbPinId) {
      // Trace to the breadboard pin we're inserted at
      const bbResult = tracePath(
        currentComponent.parentBreadboardId,
        bbPinId,
        wires,
        definitions,
        buttonStates,
        components,
        visited,
        depth + 1,
        maxDepth
      );

      if (bbResult.reachesPower) {
        result.reachesPower = true;
        result.hasResistor = result.hasResistor || bbResult.hasResistor;
        result.path = [...result.path, ...bbResult.path];
        result.wires = [...result.wires, ...bbResult.wires];
        return result;
      }
      if (bbResult.reachesGround) {
        result.reachesGround = true;
        result.hasResistor = result.hasResistor || bbResult.hasResistor;
        result.path = [...result.path, ...bbResult.path];
        result.wires = [...result.wires, ...bbResult.wires];
        return result;
      }
    }
  }

  // Find wires connected to this pin
  const connectedWires = findWiresAtPin(startComponentId, startPinId, wires);

  for (const wire of connectedWires) {
    result.wires.push(wire.id);
    result.lastWireId = wire.id;

    const otherEnd = getOtherEnd(wire, startComponentId, startPinId);
    const wireResult = tracePath(
      otherEnd.componentId,
      otherEnd.pinId,
      wires,
      definitions,
      buttonStates,
      components,
      visited,
      depth + 1,
      maxDepth
    );

    if (wireResult.reachesPower) {
      result.reachesPower = true;
      result.hasResistor = result.hasResistor || wireResult.hasResistor;
      result.path = [...result.path, ...wireResult.path];
      result.wires = [...result.wires, ...wireResult.wires];
      return result;
    }
    if (wireResult.reachesGround) {
      result.reachesGround = true;
      result.hasResistor = result.hasResistor || wireResult.hasResistor;
      result.path = [...result.path, ...wireResult.path];
      result.wires = [...result.wires, ...wireResult.wires];
      return result;
    }
  }

  return result;
}

/**
 * Finds a wire "nearby" a component - checks direct connections first,
 * then for breadboard-inserted components checks wires on the same breadboard rows.
 * Returns wire ID or undefined if no nearby wire found.
 */
function findNearbyWire(
  componentId: string,
  wires: Wire[],
  components: PlacedComponent[],
  definitions: Map<string, ComponentDefinition>
): string | undefined {
  // First, check for wires directly connected to this component
  const directWires = wires.filter(w =>
    w.startComponentId === componentId || w.endComponentId === componentId
  );
  if (directWires.length > 0) return directWires[0].id;

  // If component is inserted into a breadboard, find wires on the same rows
  const comp = components.find(c => c.instanceId === componentId);
  if (comp?.parentBreadboardId && comp.insertedPins) {
    const bbId = comp.parentBreadboardId;
    const bbDef = definitions.get(bbId);
    if (bbDef) {
      // Collect all breadboard pins connected (via net) to the LED's insertion points
      const connectedBbPins = new Set<string>();
      for (const bbPinId of Object.values(comp.insertedPins)) {
        connectedBbPins.add(bbPinId);
        const pinDef = bbDef.pins.find(p => p.id === bbPinId);
        if (pinDef?.net) {
          bbDef.pins.filter(p => p.net === pinDef.net).forEach(p => connectedBbPins.add(p.id));
        }
      }

      // Find wires connected to any of these breadboard pins
      const bbWires = wires.filter(w =>
        (w.startComponentId === bbId && connectedBbPins.has(w.startPinId)) ||
        (w.endComponentId === bbId && connectedBbPins.has(w.endPinId))
      );
      if (bbWires.length > 0) return bbWires[0].id;
    }
  }

  return undefined;
}

/**
 * Validates an LED component
 */
function validateLED(
  componentId: string,
  wires: Wire[],
  definitions: Map<string, ComponentDefinition>,
  buttonStates: Map<string, boolean>,
  components: PlacedComponent[]
): { isOn: boolean; errors: CircuitError[] } {
  const errors: CircuitError[] = [];

  // Trace from ANODE (positive) to find power
  const anodePath = tracePath(componentId, 'ANODE', wires, definitions, buttonStates, components);

  // Trace from CATHODE (negative) to find ground
  const cathodePath = tracePath(componentId, 'CATHODE', wires, definitions, buttonStates, components);

  // Check for correct connections
  const anodeHasPower = anodePath.reachesPower;
  const cathodeHasGround = cathodePath.reachesGround;

  // Check for reversed polarity
  const anodeHasGround = anodePath.reachesGround;
  const cathodeHasPower = cathodePath.reachesPower;

  if (cathodeHasPower && anodeHasGround) {
    // Wrong polarity
    const errorWire = cathodePath.wires[0] || anodePath.wires[0]
      || findNearbyWire(componentId, wires, components, definitions);
    errors.push({
      wireId: errorWire,
      errorType: 'wrong-polarity',
      message: 'LED connected backwards - swap anode (+) and cathode (–)',
      componentId,
    });
    return { isOn: false, errors };
  }

  if (!anodeHasPower) {
    const errorWire = anodePath.lastWireId || anodePath.wires[anodePath.wires.length - 1]
      || findNearbyWire(componentId, wires, components, definitions);
    errors.push({
      wireId: errorWire,
      errorType: 'no-power',
      message: 'LED anode (+) must connect to power source',
      componentId,
    });
    return { isOn: false, errors };
  }

  if (!cathodeHasGround) {
    const errorWire = cathodePath.lastWireId || cathodePath.wires[cathodePath.wires.length - 1]
      || findNearbyWire(componentId, wires, components, definitions);
    errors.push({
      wireId: errorWire,
      errorType: 'no-ground',
      message: 'LED cathode (–) must connect to GND',
      componentId,
    });
    return { isOn: false, errors };
  }

  // Check for resistor (combine both paths)
  const hasResistor = anodePath.hasResistor || cathodePath.hasResistor;
  if (!hasResistor) {
    const errorWire = anodePath.wires[0] || cathodePath.wires[0]
      || findNearbyWire(componentId, wires, components, definitions);
    errors.push({
      wireId: errorWire,
      errorType: 'missing-resistor',
      message: 'LED needs a resistor to prevent burnout',
      componentId,
    });
    // Still turn on but with warning
    return { isOn: true, errors };
  }

  // LED is properly connected
  return { isOn: true, errors: [] };
}

/**
 * Main circuit analysis function
 */
export function analyzeCircuit(
  components: PlacedComponent[],
  wires: Wire[],
  definitions: Map<string, ComponentDefinition>,
  buttonStates: Map<string, boolean>
): SimulationResult {
  const errors: CircuitError[] = [];
  const activeComponents = new Map<string, 'on' | 'off'>();

  // Initialize all components to off
  for (const component of components) {
    activeComponents.set(component.instanceId, 'off');
  }

  // Analyze each component
  for (const component of components) {
    const def = definitions.get(component.instanceId);
    if (!def) continue;

    const componentType = def.id;

    // Validate LEDs
    if (isLED(componentType)) {
      const result = validateLED(component.instanceId, wires, definitions, buttonStates, components);
      errors.push(...result.errors);
      activeComponents.set(component.instanceId, result.isOn ? 'on' : 'off');
    }

    // Validate buttons (just check if they're in a circuit)
    if (isButton(componentType)) {
      const isPressed = buttonStates.get(component.instanceId) || false;
      activeComponents.set(component.instanceId, isPressed ? 'on' : 'off');
    }

    // TODO: Add buzzer validation similar to LED
  }

  return {
    isValid: errors.length === 0,
    errors,
    activeComponents,
  };
}

/**
 * Diagnostic issue for AI troubleshooting
 */
export interface DiagnosticIssue {
  id: string;
  severity: 'error' | 'warning';
  type: CircuitErrorType;
  title: string;
  description: string;
  fix: string;
  affectedComponentIds: string[];
  affectedWireIds: string[];
}

/**
 * Suggestion for circuit improvement
 */
export interface CircuitSuggestion {
  id: string;
  type: 'add-component' | 'rewire' | 'safety';
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
}

/**
 * Detailed diagnostics for AI troubleshooting
 */
export interface DetailedDiagnostics {
  issues: DiagnosticIssue[];
  suggestions: CircuitSuggestion[];
  componentStatus: Map<string, {
    isConnected: boolean;
    hasPower: boolean;
    hasGround: boolean;
    isActive: boolean;
  }>;
}

/**
 * Get detailed diagnostics for AI troubleshooting
 */
export function getDetailedDiagnostics(
  components: PlacedComponent[],
  wires: Wire[],
  definitions: Map<string, ComponentDefinition>,
  buttonStates: Map<string, boolean>
): DetailedDiagnostics {
  const issues: DiagnosticIssue[] = [];
  const suggestions: CircuitSuggestion[] = [];
  const componentStatus = new Map<string, {
    isConnected: boolean;
    hasPower: boolean;
    hasGround: boolean;
    isActive: boolean;
  }>();

  // Get basic simulation results
  const simResult = analyzeCircuit(components, wires, definitions, buttonStates);

  // Analyze each component
  for (const component of components) {
    const def = definitions.get(component.instanceId);
    if (!def) continue;

    const componentType = def.id;

    // Check if component has any wires connected
    const componentWires = wires.filter(
      w => w.startComponentId === component.instanceId || w.endComponentId === component.instanceId
    );
    const isConnected = componentWires.length > 0;

    // Trace power and ground paths
    let hasPower = false;
    let hasGround = false;

    if (isConnected) {
      // Check each pin for power/ground connection
      for (const wire of componentWires) {
        const pinId = wire.startComponentId === component.instanceId
          ? wire.startPinId
          : wire.endPinId;

        const path = tracePath(component.instanceId, pinId, wires, definitions, buttonStates, components);
        if (path.reachesPower) hasPower = true;
        if (path.reachesGround) hasGround = true;
      }
    }

    const isActive = simResult.activeComponents.get(component.instanceId) === 'on';

    componentStatus.set(component.instanceId, {
      isConnected,
      hasPower,
      hasGround,
      isActive
    });

    // Generate component-specific issues
    if (isLED(componentType) && isConnected) {
      // Check for missing resistor
      const anodePath = tracePath(component.instanceId, 'ANODE', wires, definitions, buttonStates, components);
      if (!anodePath.hasResistor && anodePath.reachesPower) {
        suggestions.push({
          id: `suggest-resistor-${component.instanceId}`,
          type: 'add-component',
          title: 'Add current-limiting resistor',
          description: `LED "${component.instanceId}" is connected without a current-limiting resistor. This may damage the LED.`,
          priority: 'high'
        });
      }
    }

    // Check for unconnected components
    if (!isConnected) {
      issues.push({
        id: `unconnected-${component.instanceId}`,
        severity: 'warning',
        type: 'open-circuit',
        title: `Unconnected ${def.name || componentType}`,
        description: `Component "${component.instanceId}" has no wire connections.`,
        fix: 'Connect the component to the circuit using wires.',
        affectedComponentIds: [component.instanceId],
        affectedWireIds: []
      });
    }
  }

  // Convert simulation errors to diagnostic issues
  for (const error of simResult.errors) {
    let title: string;
    let fix: string;

    switch (error.errorType) {
      case 'no-ground':
        title = 'Missing ground connection';
        fix = 'Connect the cathode (-) to a GND pin on the Arduino.';
        break;
      case 'no-power':
        title = 'Missing power connection';
        fix = 'Connect the anode (+) to a power source (5V, 3.3V, or a digital pin set HIGH).';
        break;
      case 'wrong-polarity':
        title = 'Wrong polarity';
        fix = 'Swap the anode (+) and cathode (-) connections. The longer leg (anode) goes to power.';
        break;
      case 'missing-resistor':
        title = 'Missing current-limiting resistor';
        fix = 'Add a 220-330 ohm resistor in series with the LED to prevent damage.';
        break;
      case 'short-circuit':
        title = 'Short circuit detected';
        fix = 'Check for wires directly connecting power to ground without any load.';
        break;
      case 'open-circuit':
        title = 'Open circuit';
        fix = 'Ensure all components are properly connected to complete the circuit.';
        break;
      default:
        title = 'Circuit issue';
        fix = 'Check the circuit connections.';
    }

    issues.push({
      id: `error-${error.wireId || error.componentId || 'unknown'}-${error.errorType}`,
      severity: 'error',
      type: error.errorType,
      title,
      description: error.message,
      fix,
      affectedComponentIds: error.componentId ? [error.componentId] : [],
      affectedWireIds: error.wireId ? [error.wireId] : []
    });
  }

  return {
    issues,
    suggestions,
    componentStatus
  };
}
