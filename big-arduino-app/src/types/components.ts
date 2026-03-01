/**
 * Component Type Definitions
 *
 * Types for circuit components, pins, wires, and simulation state.
 */

// Pin types matching the JSON definitions
export type PinType =
  | 'digital'
  | 'pwm'
  | 'analog'
  | 'communication'
  | 'power'
  | 'ground'
  | 'terminal';

/**
 * Pin definition from component JSON
 */
export interface Pin {
  id: string;
  label: string;
  description: string;
  type: PinType;
  x: number;
  y: number;
  hitRadius: number;
  /**
   * Optional net/group identifier for internally connected pins.
   * Pins with the same `net` value are electrically connected internally
   * (e.g., breadboard rows, power rails).
   * Used for:
   * - Highlighting all connected pins on hover
   * - Circuit simulation (treating connected pins as one node)
   */
  net?: string;
}

/**
 * Variant definition for component states (ON/OFF) and colors
 */
export interface ComponentVariant {
  image: string;
}

/**
 * Property definition for editable component properties
 */
export interface PropertyDefinition {
  type: 'select' | 'number' | 'text';
  options?: string[];
  default?: string | number;
  min?: number;
  max?: number;
}

/**
 * Internal electrical connections within a component
 * Describes which pins are connected internally and under what conditions
 */
export interface InternalConnections {
  /**
   * Pins that are always connected internally (even without external power)
   * Each array is a group of pins that are connected together
   * e.g., [["TERM1", "TERM2"]] means TERM1 and TERM2 are always connected
   */
  always?: string[][];
  /**
   * Pins that are connected only when the component is activated
   * e.g., button pressed, relay energized
   */
  whenPressed?: string[][];
  whenPowered?: string[][];
  /**
   * Additional notes about internal behavior
   */
  notes?: string;
}

/**
 * Component definition loaded from JSON
 */
export interface ComponentDefinition {
  id: string;
  name: string;
  category: string;
  image: string;
  width: number;
  height: number;
  pins: Pin[];
  // Optional description for the component
  description?: string;
  // Internal electrical connections within the component
  internalConnections?: InternalConnections;
  // Variant support for different states/colors
  variants?: Record<string, ComponentVariant>;
  // Editable properties (LED color, resistor value, etc.)
  properties?: Record<string, PropertyDefinition>;
}

/**
 * A component instance placed on the canvas
 */
export interface PlacedComponent {
  instanceId: string;
  definitionId: string;
  x: number;
  y: number;
  rotation: number;
  // Flip state for horizontal/vertical mirroring
  flipX?: boolean;
  flipY?: boolean;
  state: 'on' | 'off';
  // Component-specific properties (LED color, resistor value)
  properties: Record<string, string | number>;
  // Current image being displayed (for variant switching)
  currentImage?: string;
  // Breadboard insertion tracking
  parentBreadboardId?: string;
  // Map of component pin ID -> breadboard pin ID
  insertedPins?: Record<string, string>;
}

/**
 * Wire connecting two pins
 */
export interface Wire {
  id: string;
  startComponentId: string;
  startPinId: string;
  endComponentId: string;
  endPinId: string;
  // Bend points for the wire path (between start and end pins)
  bendPoints: { x: number; y: number }[];
  // Wire color
  color: string;
}

/**
 * Pin connection info for display
 */
export interface PinConnection {
  componentId: string;
  componentName: string;
  pinId: string;
  pinLabel: string;
}

/**
 * Hovered pin info for tooltip display
 */
export interface HoveredPinInfo {
  pin: Pin;
  componentId: string;
  canvasX: number;
  canvasY: number;
}

/**
 * Variant mapping for components with multiple states
 * Maps specific component IDs to their base definition and variant key
 */
export interface VariantMapping {
  baseId: string;
  variant?: string;
  defaultState?: 'on' | 'off';
}

/**
 * Component category info
 */
export interface ComponentCategory {
  id: string;
  name: string;
  components: string[];
}

/**
 * History snapshot for undo functionality
 */
export interface HistorySnapshot {
  placedComponents: PlacedComponent[];
  wires: Wire[];
  // Maps must be serialized as arrays for JSON compatibility
  componentDefinitions: [string, ComponentDefinition][];
}
