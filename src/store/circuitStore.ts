/**
 * Circuit Store
 *
 * Zustand store for managing circuit state, placed components, wires,
 * and simulation mode.
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { enableMapSet } from 'immer';
import type {
  PlacedComponent,
  Wire,
  ComponentDefinition,
  HoveredPinInfo,
} from '../types/components';
import { analyzeCircuit, type CircuitError } from '../services/circuitSimulator';

// Enable Immer's MapSet plugin for using Map/Set in state
enableMapSet();

interface CircuitState {
  // Placed components on the canvas
  placedComponents: PlacedComponent[];

  // Wires connecting pins
  wires: Wire[];

  // Currently selected component
  selectedComponentId: string | null;

  // Currently hovered pin info
  hoveredPin: HoveredPinInfo | null;

  // Wire drawing state
  wireDrawing: {
    isDrawing: boolean;
    startComponentId: string | null;
    startPinId: string | null;
    startX: number;
    startY: number;
    bendPoints: { x: number; y: number }[];
    currentX: number;
    currentY: number;
    color: string;
  };

  // Selected wire for editing
  selectedWireId: string | null;

  // Simulation state
  isSimulating: boolean;

  // Simulation errors (wires with issues)
  simulationErrors: CircuitError[];

  // Button states during simulation (for interactive buttons)
  buttonStates: Map<string, boolean>;

  // Component definitions cache (keyed by instanceId)
  componentDefinitions: Map<string, ComponentDefinition>;
}

interface CircuitActions {
  // Component actions
  addComponent: (
    definition: ComponentDefinition,
    x: number,
    y: number,
    properties?: Record<string, string | number>
  ) => string;
  removeComponent: (instanceId: string) => void;
  updateComponentPosition: (instanceId: string, x: number, y: number) => void;
  updateComponentRotation: (instanceId: string, rotation: number) => void;
  updateComponentState: (instanceId: string, state: 'on' | 'off', currentImage?: string) => void;
  updateComponentProperty: (
    instanceId: string,
    key: string,
    value: string | number
  ) => void;

  // Selection
  selectComponent: (instanceId: string | null) => void;
  setHoveredPin: (pinInfo: HoveredPinInfo | null) => void;

  // Wire actions
  startWireDrawing: (componentId: string, pinId: string, x: number, y: number) => void;
  updateWireDrawing: (x: number, y: number) => void;
  addWireBendPoint: (x: number, y: number) => void;
  setWireDrawingColor: (color: string) => void;
  completeWireDrawing: (endComponentId: string, endPinId: string) => void;
  cancelWireDrawing: () => void;
  addWire: (wire: Omit<Wire, 'id'>) => string;
  removeWire: (wireId: string) => void;
  updateWire: (wireId: string, updates: Partial<Pick<Wire, 'bendPoints' | 'color' | 'startComponentId' | 'startPinId' | 'endComponentId' | 'endPinId'>>) => void;
  selectWire: (wireId: string | null) => void;

  // Simulation
  startSimulation: () => void;
  stopSimulation: () => void;
  toggleSimulation: () => void;
  runSimulation: () => void;
  setButtonState: (componentId: string, pressed: boolean) => void;
  clearSimulationErrors: () => void;

  // Circuit validation
  isLEDCircuitComplete: (ledInstanceId: string) => boolean;
  getConnectedPin: (componentId: string, pinId: string) => { componentId: string; pinId: string } | null;

  // Cache management
  setComponentDefinition: (instanceId: string, definition: ComponentDefinition) => void;
  getComponentDefinition: (instanceId: string) => ComponentDefinition | undefined;

  // Reset
  clearCircuit: () => void;
}

// Generate unique IDs
let componentIdCounter = 0;
let wireIdCounter = 0;

const generateComponentId = (): string => `comp-${++componentIdCounter}-${Date.now()}`;
const generateWireId = (): string => `wire-${++wireIdCounter}-${Date.now()}`;

export const useCircuitStore = create<CircuitState & CircuitActions>()(
  immer((set, get) => ({
    // Initial state
    placedComponents: [],
    wires: [],
    selectedComponentId: null,
    hoveredPin: null,
    wireDrawing: {
      isDrawing: false,
      startComponentId: null,
      startPinId: null,
      startX: 0,
      startY: 0,
      bendPoints: [],
      currentX: 0,
      currentY: 0,
      color: '#666666',
    },
    selectedWireId: null,
    isSimulating: false,
    simulationErrors: [],
    buttonStates: new Map(),
    componentDefinitions: new Map(),

    // Component actions
    addComponent: (definition, x, y, properties = {}) => {
      const instanceId = generateComponentId();

      // Extract default property values from definition
      const defaultProperties: Record<string, string | number> = {};
      if (definition.properties) {
        for (const [key, propDef] of Object.entries(definition.properties)) {
          if (propDef.default !== undefined) {
            defaultProperties[key] = propDef.default;
          }
        }
      }

      set((state) => {
        state.placedComponents.push({
          instanceId,
          definitionId: definition.id,
          x,
          y,
          rotation: 0,
          state: 'off',
          properties: {
            ...defaultProperties,
            ...properties, // Allow override of defaults
          },
          currentImage: definition.image,
        });
        state.componentDefinitions.set(instanceId, definition);
      });

      return instanceId;
    },

    removeComponent: (instanceId) => {
      set((state) => {
        // Remove component
        state.placedComponents = state.placedComponents.filter(
          (c) => c.instanceId !== instanceId
        );
        // Remove connected wires
        state.wires = state.wires.filter(
          (w) =>
            w.startComponentId !== instanceId && w.endComponentId !== instanceId
        );
        // Clear selection if this was selected
        if (state.selectedComponentId === instanceId) {
          state.selectedComponentId = null;
        }
        // Remove from definitions cache
        state.componentDefinitions.delete(instanceId);
      });
    },

    updateComponentPosition: (instanceId, x, y) => {
      set((state) => {
        const component = state.placedComponents.find(
          (c) => c.instanceId === instanceId
        );
        if (component) {
          component.x = x;
          component.y = y;
        }
      });
    },

    updateComponentRotation: (instanceId, rotation) => {
      set((state) => {
        const component = state.placedComponents.find(
          (c) => c.instanceId === instanceId
        );
        if (component) {
          component.rotation = rotation;
        }
      });
    },

    updateComponentState: (instanceId, newState, currentImage) => {
      set((state) => {
        const component = state.placedComponents.find(
          (c) => c.instanceId === instanceId
        );
        if (component) {
          component.state = newState;
          if (currentImage !== undefined) {
            component.currentImage = currentImage;
          }
        }
      });
    },

    updateComponentProperty: (instanceId, key, value) => {
      set((state) => {
        const component = state.placedComponents.find(
          (c) => c.instanceId === instanceId
        );
        if (component) {
          component.properties[key] = value;
        }
      });
    },

    // Selection
    selectComponent: (instanceId) => {
      set((state) => {
        state.selectedComponentId = instanceId;
      });
    },

    setHoveredPin: (pinInfo) => {
      set((state) => {
        state.hoveredPin = pinInfo;
      });
    },

    // Wire drawing
    startWireDrawing: (componentId, pinId, x, y) => {
      set((state) => {
        state.wireDrawing = {
          isDrawing: true,
          startComponentId: componentId,
          startPinId: pinId,
          startX: x,
          startY: y,
          bendPoints: [],
          currentX: x,
          currentY: y,
          color: state.wireDrawing.color, // Preserve selected color
        };
      });
    },

    updateWireDrawing: (x, y) => {
      set((state) => {
        if (state.wireDrawing.isDrawing) {
          state.wireDrawing.currentX = x;
          state.wireDrawing.currentY = y;
        }
      });
    },

    addWireBendPoint: (x, y) => {
      set((state) => {
        if (state.wireDrawing.isDrawing) {
          state.wireDrawing.bendPoints.push({ x, y });
        }
      });
    },

    setWireDrawingColor: (color) => {
      set((state) => {
        state.wireDrawing.color = color;
      });
    },

    completeWireDrawing: (endComponentId, endPinId) => {
      const { wireDrawing } = get();

      if (
        !wireDrawing.isDrawing ||
        !wireDrawing.startComponentId ||
        !wireDrawing.startPinId
      ) {
        return;
      }

      // Don't connect to same component/pin
      if (
        wireDrawing.startComponentId === endComponentId &&
        wireDrawing.startPinId === endPinId
      ) {
        get().cancelWireDrawing();
        return;
      }

      // Check if wire already exists
      const { wires } = get();
      const exists = wires.some(
        (w) =>
          (w.startComponentId === wireDrawing.startComponentId &&
            w.startPinId === wireDrawing.startPinId &&
            w.endComponentId === endComponentId &&
            w.endPinId === endPinId) ||
          (w.startComponentId === endComponentId &&
            w.startPinId === endPinId &&
            w.endComponentId === wireDrawing.startComponentId &&
            w.endPinId === wireDrawing.startPinId)
      );

      if (exists) {
        get().cancelWireDrawing();
        return;
      }

      // Add wire with bendPoints and color
      get().addWire({
        startComponentId: wireDrawing.startComponentId,
        startPinId: wireDrawing.startPinId,
        endComponentId,
        endPinId,
        bendPoints: [...wireDrawing.bendPoints],
        color: wireDrawing.color,
      });

      get().cancelWireDrawing();
    },

    cancelWireDrawing: () => {
      set((state) => {
        state.wireDrawing = {
          isDrawing: false,
          startComponentId: null,
          startPinId: null,
          startX: 0,
          startY: 0,
          bendPoints: [],
          currentX: 0,
          currentY: 0,
          color: state.wireDrawing.color, // Preserve selected color
        };
      });
    },

    addWire: (wire) => {
      const id = generateWireId();

      set((state) => {
        state.wires.push({
          id,
          ...wire,
          bendPoints: wire.bendPoints || [],
          color: wire.color || '#666666',
        });
      });

      return id;
    },

    removeWire: (wireId) => {
      set((state) => {
        state.wires = state.wires.filter((w) => w.id !== wireId);
        if (state.selectedWireId === wireId) {
          state.selectedWireId = null;
        }
      });
    },

    updateWire: (wireId, updates) => {
      set((state) => {
        const wire = state.wires.find((w) => w.id === wireId);
        if (wire) {
          if (updates.bendPoints !== undefined) {
            wire.bendPoints = updates.bendPoints;
          }
          if (updates.color !== undefined) {
            wire.color = updates.color;
          }
          if (updates.startComponentId !== undefined) {
            wire.startComponentId = updates.startComponentId;
          }
          if (updates.startPinId !== undefined) {
            wire.startPinId = updates.startPinId;
          }
          if (updates.endComponentId !== undefined) {
            wire.endComponentId = updates.endComponentId;
          }
          if (updates.endPinId !== undefined) {
            wire.endPinId = updates.endPinId;
          }
        }
      });
    },

    selectWire: (wireId) => {
      set((state) => {
        state.selectedWireId = wireId;
        // Deselect component when wire is selected
        if (wireId) {
          state.selectedComponentId = null;
        }
      });
    },

    // Simulation
    startSimulation: () => {
      set((state) => {
        state.isSimulating = true;
      });
      // Run initial simulation analysis
      get().runSimulation();
    },

    stopSimulation: () => {
      set((state) => {
        state.isSimulating = false;
        state.simulationErrors = [];
        state.buttonStates.clear();
        // Reset all components to OFF state
        state.placedComponents.forEach((c) => {
          c.state = 'off';
        });
      });
    },

    toggleSimulation: () => {
      const { isSimulating } = get();
      if (isSimulating) {
        get().stopSimulation();
      } else {
        get().startSimulation();
      }
    },

    runSimulation: () => {
      const { placedComponents, wires, componentDefinitions, buttonStates, isSimulating } = get();

      if (!isSimulating) return;

      // Run circuit analysis
      const result = analyzeCircuit(
        placedComponents,
        wires,
        componentDefinitions,
        buttonStates
      );

      set((state) => {
        state.simulationErrors = result.errors;
        // Update component states based on simulation
        result.activeComponents.forEach((componentState, componentId) => {
          const component = state.placedComponents.find(c => c.instanceId === componentId);
          if (component) {
            component.state = componentState;
          }
        });
      });
    },

    setButtonState: (componentId, pressed) => {
      set((state) => {
        state.buttonStates.set(componentId, pressed);
      });
      // Re-run simulation when button state changes
      get().runSimulation();
    },

    clearSimulationErrors: () => {
      set((state) => {
        state.simulationErrors = [];
      });
    },

    // Circuit validation
    isLEDCircuitComplete: (ledInstanceId) => {
      const { wires } = get();

      // Find wires connected to LED's ANODE and CATHODE
      const anodeWire = wires.find(
        (w) =>
          (w.startComponentId === ledInstanceId && w.startPinId === 'ANODE') ||
          (w.endComponentId === ledInstanceId && w.endPinId === 'ANODE')
      );

      const cathodeWire = wires.find(
        (w) =>
          (w.startComponentId === ledInstanceId && w.startPinId === 'CATHODE') ||
          (w.endComponentId === ledInstanceId && w.endPinId === 'CATHODE')
      );

      // Basic check: both pins must be connected
      return !!anodeWire && !!cathodeWire;
    },

    getConnectedPin: (componentId, pinId) => {
      const { wires } = get();

      const wire = wires.find(
        (w) =>
          (w.startComponentId === componentId && w.startPinId === pinId) ||
          (w.endComponentId === componentId && w.endPinId === pinId)
      );

      if (!wire) return null;

      if (wire.startComponentId === componentId && wire.startPinId === pinId) {
        return { componentId: wire.endComponentId, pinId: wire.endPinId };
      }
      return { componentId: wire.startComponentId, pinId: wire.startPinId };
    },

    // Cache management
    setComponentDefinition: (instanceId, definition) => {
      set((state) => {
        state.componentDefinitions.set(instanceId, definition);
      });
    },

    getComponentDefinition: (instanceId) => {
      return get().componentDefinitions.get(instanceId);
    },

    // Reset
    clearCircuit: () => {
      set((state) => {
        state.placedComponents = [];
        state.wires = [];
        state.selectedComponentId = null;
        state.selectedWireId = null;
        state.hoveredPin = null;
        state.wireDrawing = {
          isDrawing: false,
          startComponentId: null,
          startPinId: null,
          startX: 0,
          startY: 0,
          bendPoints: [],
          currentX: 0,
          currentY: 0,
          color: '#666666',
        };
        state.isSimulating = false;
        state.simulationErrors = [];
        state.buttonStates.clear();
        state.componentDefinitions.clear();
      });
    },
  }))
);

// Selector hooks for performance
export const useSelectedComponent = () =>
  useCircuitStore((state) => {
    const id = state.selectedComponentId;
    return id ? state.placedComponents.find((c) => c.instanceId === id) : null;
  });

export const useIsSimulating = () =>
  useCircuitStore((state) => state.isSimulating);

export const useHoveredPin = () =>
  useCircuitStore((state) => state.hoveredPin);

export const useWireDrawing = () =>
  useCircuitStore((state) => state.wireDrawing);

export const useSelectedWire = () =>
  useCircuitStore((state) => {
    const id = state.selectedWireId;
    return id ? state.wires.find((w) => w.id === id) : null;
  });

export const useWires = () =>
  useCircuitStore((state) => state.wires);

export const useSimulationErrors = () =>
  useCircuitStore((state) => state.simulationErrors);

export const useButtonStates = () =>
  useCircuitStore((state) => state.buttonStates);
