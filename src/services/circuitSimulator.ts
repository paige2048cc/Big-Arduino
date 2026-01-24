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

// Error information for a specific wire
export interface CircuitError {
  wireId: string;
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
  // Pushbutton: when pressed, PIN1A-PIN1B and PIN2A-PIN2B are connected
  // Also PIN1x connects to PIN2x (all 4 pins connect when pressed)
  if (isButton(componentType)) {
    const isPressed = buttonStates.get(componentId) || false;
    if (isPressed) {
      // When pressed, all pins are effectively connected
      return ['PIN1A', 'PIN1B', 'PIN2A', 'PIN2B'].filter(p => p !== pinId);
    }
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
 */
function tracePath(
  startComponentId: string,
  startPinId: string,
  wires: Wire[],
  definitions: Map<string, ComponentDefinition>,
  buttonStates: Map<string, boolean>,
  components: PlacedComponent[],
  visited: Set<string> = new Set()
): PathResult {
  const result: PathResult = {
    reachesPower: false,
    reachesGround: false,
    hasResistor: false,
    path: [],
    wires: [],
    lastWireId: null,
  };

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
      new Set(visited)
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
            new Set(visited)
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
        new Set(visited)
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
      new Set(visited)
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
    const errorWire = cathodePath.wires[0] || anodePath.wires[0];
    if (errorWire) {
      errors.push({
        wireId: errorWire,
        errorType: 'wrong-polarity',
        message: 'LED connected backwards - swap anode (+) and cathode (–)',
        componentId,
      });
    }
    return { isOn: false, errors };
  }

  if (!anodeHasPower) {
    const errorWire = anodePath.lastWireId || anodePath.wires[anodePath.wires.length - 1];
    if (errorWire) {
      errors.push({
        wireId: errorWire,
        errorType: 'no-power',
        message: 'LED anode (+) must connect to power source',
        componentId,
      });
    } else {
      // No wire connected to anode at all - find any wire connected to this LED
      const ledWires = wires.filter(w =>
        w.startComponentId === componentId || w.endComponentId === componentId
      );
      if (ledWires.length > 0) {
        errors.push({
          wireId: ledWires[0].id,
          errorType: 'no-power',
          message: 'LED anode (+) must connect to power source',
          componentId,
        });
      }
    }
    return { isOn: false, errors };
  }

  if (!cathodeHasGround) {
    const errorWire = cathodePath.lastWireId || cathodePath.wires[cathodePath.wires.length - 1];
    if (errorWire) {
      errors.push({
        wireId: errorWire,
        errorType: 'no-ground',
        message: 'LED cathode (–) must connect to GND',
        componentId,
      });
    } else {
      const ledWires = wires.filter(w =>
        w.startComponentId === componentId || w.endComponentId === componentId
      );
      if (ledWires.length > 0) {
        errors.push({
          wireId: ledWires[0].id,
          errorType: 'no-ground',
          message: 'LED cathode (–) must connect to GND',
          componentId,
        });
      }
    }
    return { isOn: false, errors };
  }

  // Check for resistor (combine both paths)
  const hasResistor = anodePath.hasResistor || cathodePath.hasResistor;
  if (!hasResistor) {
    const errorWire = anodePath.wires[0] || cathodePath.wires[0];
    if (errorWire) {
      errors.push({
        wireId: errorWire,
        errorType: 'missing-resistor',
        message: 'LED needs a resistor to prevent burnout',
        componentId,
      });
    }
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
