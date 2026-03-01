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
  HistorySnapshot,
} from '../types/components';
import { analyzeCircuit, type CircuitError } from '../services/circuitSimulator';
import type {
  ChatReference,
  PendingReference,
  HighlightItem,
} from '../types/chat';

// Enable Immer's MapSet plugin for using Map/Set in state
enableMapSet();

const DEFAULT_WIRE_COLOR = '#2563eb'; // blue

function suggestWireColorForPin(definition: ComponentDefinition | undefined, pinId: string): string {
  const pin = definition?.pins.find((p) => p.id === pinId);
  if (!pin) return DEFAULT_WIRE_COLOR;

  const text = `${pin.id} ${pin.label} ${pin.description}`.toLowerCase();

  // Ground first
  if (pin.type === 'ground' || text.includes('gnd') || text.includes('ground')) return '#000000';

  // Power
  if (
    pin.type === 'power' ||
    /\b(3v3|3\.3v|5v|vcc|vin)\b/i.test(text)
  ) {
    return '#dc2626'; // red
  }

  // Common signal colors (optional but helpful)
  switch (pin.type) {
    case 'analog':
      return '#16a34a'; // green
    case 'pwm':
      return '#f97316'; // orange
    case 'communication':
      return '#7c3aed'; // purple
    default:
      return DEFAULT_WIRE_COLOR;
  }
}

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

  // Click-to-place state (alternative to drag-and-drop)
  clickToPlace: {
    isActive: boolean;
    componentId: string | null;
    category: string | null;
    previewX: number;  // Scene/canvas coordinates
    previewY: number;
    screenX: number;   // Screen coordinates for global preview
    screenY: number;
    isOverCanvas: boolean;  // Whether cursor is over the canvas area
  };

  // Drag preview state (for consistent drag-and-drop preview)
  dragPreview: {
    isActive: boolean;
    componentId: string | null;
    category: string | null;
    screenX: number;
    screenY: number;
    isOverCanvas: boolean;
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

  // History for undo functionality
  history: {
    past: HistorySnapshot[];
    maxHistoryLength: number;
  };

  // Chat input state for AI references
  chatInput: {
    pendingReferences: PendingReference[];
    isInputFocused: boolean;
  };

  // Highlighted items for debugging visualization
  highlightedItems: HighlightItem[];

  // Highlighted components in toolbar (for guided instructions / AI suggestions)
  highlightedToolbarComponents: string[];

  // Component onboarding state
  shownOnboardings: Set<string>;  // Set of definitionIds that have shown onboarding
  activeOnboarding: {
    instanceId: string;
    definitionId: string;
    centerX: number;
    centerY: number;
    manual?: boolean;
  } | null;

  // AI Character state (for visual feedback on canvas)
  aiCharacter: {
    visible: boolean;
    x: number;
    y: number;
    message: string;
    mood: 'thinking' | 'happy' | 'concerned' | 'celebrating';
    targetComponentId: string | null;
    bubblePosition: 'top' | 'bottom' | 'left' | 'right';
  };
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
  updateComponentFlip: (instanceId: string, flipX: boolean, flipY: boolean) => void;
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
  removeLastWireBendPoint: () => boolean; // Returns true if a point was removed, false if wire should be canceled
  setWireDrawingColor: (color: string) => void;
  completeWireDrawing: (
    endComponentId: string,
    endPinId: string,
    bendPointsOverride?: { x: number; y: number }[]
  ) => void;
  cancelWireDrawing: () => void;
  addWire: (wire: Omit<Wire, 'id'>) => string;
  removeWire: (wireId: string) => void;
  updateWire: (wireId: string, updates: Partial<Pick<Wire, 'bendPoints' | 'color' | 'startComponentId' | 'startPinId' | 'endComponentId' | 'endPinId'>>) => void;
  selectWire: (wireId: string | null) => void;

  // Click-to-place actions
  startClickToPlace: (componentId: string, category: string) => void;
  updateClickToPlacePreview: (x: number, y: number, screenX?: number, screenY?: number, isOverCanvas?: boolean) => void;
  cancelClickToPlace: () => void;

  // Drag preview actions
  startDragPreview: (componentId: string, category: string) => void;
  updateDragPreview: (screenX: number, screenY: number, isOverCanvas: boolean) => void;
  endDragPreview: () => void;

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

  // History / Undo
  pushToHistory: () => void;
  undo: () => void;
  canUndo: () => boolean;
  clearHistory: () => void;

  // Breadboard insertion
  insertIntoBreadboard: (
    componentInstanceId: string,
    breadboardInstanceId: string,
    insertedPins: Record<string, string>
  ) => void;
  removeFromBreadboard: (componentInstanceId: string) => void;

  // Chat reference actions
  addPendingReference: (reference: ChatReference) => void;
  confirmReferences: () => void;
  removeReference: (index: number) => void;
  clearReferences: () => void;
  setInputFocused: (focused: boolean) => void;

  // Highlight actions
  setHighlights: (items: HighlightItem[]) => void;
  clearHighlights: () => void;

  // Toolbar highlight actions (for guided instructions / AI suggestions)
  setHighlightedToolbarComponents: (componentIds: string[] | null) => void;
  // Convenience: keep single-component API
  setHighlightedToolbarComponent: (componentId: string | null) => void;

  // Component onboarding actions
  showOnboarding: (instanceId: string, definitionId: string, centerX: number, centerY: number) => void;
  hideOnboarding: () => void;
  hasShownOnboarding: (definitionId: string) => boolean;
  triggerOnboardingForComponent: (instanceId: string) => void;

  // AI Character actions
  showAICharacter: (
    message: string,
    targetComponentId?: string | null,
    mood?: 'thinking' | 'happy' | 'concerned' | 'celebrating'
  ) => void;
  hideAICharacter: () => void;
  updateAICharacterMessage: (
    message: string,
    mood?: 'thinking' | 'happy' | 'concerned' | 'celebrating'
  ) => void;
  updateAICharacterPosition: (
    x: number,
    y: number,
    bubblePosition?: 'top' | 'bottom' | 'left' | 'right'
  ) => void;
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
      color: DEFAULT_WIRE_COLOR,
    },
    clickToPlace: {
      isActive: false,
      componentId: null,
      category: null,
      previewX: 0,
      previewY: 0,
      screenX: 0,
      screenY: 0,
      isOverCanvas: false,
    },
    dragPreview: {
      isActive: false,
      componentId: null,
      category: null,
      screenX: 0,
      screenY: 0,
      isOverCanvas: false,
    },
    selectedWireId: null,
    isSimulating: false,
    simulationErrors: [],
    buttonStates: new Map(),
    componentDefinitions: new Map(),
    history: {
      past: [],
      maxHistoryLength: 50,
    },
    chatInput: {
      pendingReferences: [],
      isInputFocused: false,
    },
    highlightedItems: [],
    highlightedToolbarComponents: [],
    shownOnboardings: new Set(),
    activeOnboarding: null,
    aiCharacter: {
      visible: false,
      x: 0,
      y: 0,
      message: '',
      mood: 'happy' as const,
      targetComponentId: null,
      bubblePosition: 'right' as const,
    },

    // Component actions
    addComponent: (definition, x, y, properties = {}) => {
      get().pushToHistory();
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
      get().pushToHistory();
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

      // Re-run simulation when circuit changes
      get().runSimulation();
    },

    updateComponentPosition: (instanceId, x, y) => {
      get().pushToHistory();
      set((state) => {
        const component = state.placedComponents.find(
          (c) => c.instanceId === instanceId
        );
        if (!component) return;

        // Calculate delta for moving children
        const deltaX = x - component.x;
        const deltaY = y - component.y;

        // Update the component position
        component.x = x;
        component.y = y;

        // If this is a breadboard, move all inserted children with it
        const definition = state.componentDefinitions.get(instanceId);
        if (definition?.id === 'breadboard') {
          state.placedComponents.forEach(child => {
            if (child.parentBreadboardId === instanceId) {
              child.x += deltaX;
              child.y += deltaY;
            }
          });
        }
      });
    },

    updateComponentRotation: (instanceId, rotation) => {
      get().pushToHistory();
      set((state) => {
        const component = state.placedComponents.find(
          (c) => c.instanceId === instanceId
        );
        if (component) {
          component.rotation = rotation;
        }
      });
    },

    updateComponentFlip: (instanceId, flipX, flipY) => {
      get().pushToHistory();
      set((state) => {
        const component = state.placedComponents.find(
          (c) => c.instanceId === instanceId
        );
        if (component) {
          component.flipX = flipX;
          component.flipY = flipY;
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
        const def = state.componentDefinitions.get(componentId);
        const suggested = suggestWireColorForPin(def, pinId);
        const nextColor = suggested;

        state.wireDrawing = {
          isDrawing: true,
          startComponentId: componentId,
          startPinId: pinId,
          startX: x,
          startY: y,
          bendPoints: [],
          currentX: x,
          currentY: y,
          color: nextColor,
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

    removeLastWireBendPoint: () => {
      const { wireDrawing } = get();
      if (!wireDrawing.isDrawing) return false;

      if (wireDrawing.bendPoints.length > 0) {
        // Remove the last bend point
        set((state) => {
          state.wireDrawing.bendPoints.pop();
        });
        return true;
      }
      // No bend points left - signal that wire should be canceled
      return false;
    },

    setWireDrawingColor: (color) => {
      set((state) => {
        state.wireDrawing.color = color;
      });
    },

    completeWireDrawing: (endComponentId, endPinId, bendPointsOverride) => {
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
      const bendPoints =
        bendPointsOverride !== undefined
          ? bendPointsOverride
          : [...wireDrawing.bendPoints];
      get().addWire({
        startComponentId: wireDrawing.startComponentId,
        startPinId: wireDrawing.startPinId,
        endComponentId,
        endPinId,
        bendPoints,
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
          color: state.wireDrawing.color || DEFAULT_WIRE_COLOR, // Preserve selected color
        };
      });
    },

    // Click-to-place actions
    startClickToPlace: (componentId, category) => {
      get().cancelWireDrawing();
      set((state) => {
        state.clickToPlace = {
          isActive: true,
          componentId,
          category,
          previewX: 0,
          previewY: 0,
          screenX: 0,
          screenY: 0,
          isOverCanvas: false,
        };
      });
    },

    updateClickToPlacePreview: (x, y, screenX?: number, screenY?: number, isOverCanvas?: boolean) => {
      set((state) => {
        if (state.clickToPlace.isActive) {
          state.clickToPlace.previewX = x;
          state.clickToPlace.previewY = y;
          if (screenX !== undefined) state.clickToPlace.screenX = screenX;
          if (screenY !== undefined) state.clickToPlace.screenY = screenY;
          if (isOverCanvas !== undefined) state.clickToPlace.isOverCanvas = isOverCanvas;
        }
      });
    },

    cancelClickToPlace: () => {
      set((state) => {
        state.clickToPlace = {
          isActive: false,
          componentId: null,
          category: null,
          previewX: 0,
          previewY: 0,
          screenX: 0,
          screenY: 0,
          isOverCanvas: false,
        };
      });
    },

    // Drag preview actions
    startDragPreview: (componentId, category) => {
      set((state) => {
        state.dragPreview = {
          isActive: true,
          componentId,
          category,
          screenX: 0,
          screenY: 0,
          isOverCanvas: false,
        };
      });
    },

    updateDragPreview: (screenX, screenY, isOverCanvas) => {
      set((state) => {
        if (state.dragPreview.isActive) {
          state.dragPreview.screenX = screenX;
          state.dragPreview.screenY = screenY;
          state.dragPreview.isOverCanvas = isOverCanvas;
        }
      });
    },

    endDragPreview: () => {
      set((state) => {
        state.dragPreview = {
          isActive: false,
          componentId: null,
          category: null,
          screenX: 0,
          screenY: 0,
          isOverCanvas: false,
        };
      });
    },

    addWire: (wire) => {
      get().pushToHistory();
      const id = generateWireId();

      set((state) => {
        state.wires.push({
          id,
          ...wire,
          bendPoints: wire.bendPoints || [],
          color: wire.color || DEFAULT_WIRE_COLOR,
        });
      });

      // Re-run simulation when wires change
      get().runSimulation();

      return id;
    },

    removeWire: (wireId) => {
      get().pushToHistory();
      set((state) => {
        state.wires = state.wires.filter((w) => w.id !== wireId);
        if (state.selectedWireId === wireId) {
          state.selectedWireId = null;
        }
      });

      // Re-run simulation when wires change
      get().runSimulation();
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

      // Re-run simulation when wires change (only for connection changes, not bend points)
      if (updates.startComponentId !== undefined || updates.startPinId !== undefined ||
          updates.endComponentId !== undefined || updates.endPinId !== undefined) {
        get().runSimulation();
      }
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
      get().pushToHistory();
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
        state.clickToPlace = {
          isActive: false,
          componentId: null,
          category: null,
          previewX: 0,
          previewY: 0,
          screenX: 0,
          screenY: 0,
          isOverCanvas: false,
        };
        state.dragPreview = {
          isActive: false,
          componentId: null,
          category: null,
          screenX: 0,
          screenY: 0,
          isOverCanvas: false,
        };
        state.isSimulating = false;
        state.simulationErrors = [];
        state.buttonStates.clear();
        state.componentDefinitions.clear();
      });
    },

    // History / Undo
    pushToHistory: () => {
      const state = get();
      const snapshot: HistorySnapshot = {
        placedComponents: JSON.parse(JSON.stringify(state.placedComponents)),
        wires: JSON.parse(JSON.stringify(state.wires)),
        componentDefinitions: Array.from(state.componentDefinitions.entries()),
      };

      set((draft) => {
        draft.history.past.push(snapshot);
        // Limit history size
        if (draft.history.past.length > draft.history.maxHistoryLength) {
          draft.history.past.shift();
        }
      });
    },

    undo: () => {
      const { history } = get();
      if (history.past.length === 0) return;

      set((state) => {
        const snapshot = state.history.past.pop();
        if (!snapshot) return;

        // Restore state from snapshot
        state.placedComponents = snapshot.placedComponents;
        state.wires = snapshot.wires;
        state.componentDefinitions = new Map(snapshot.componentDefinitions);

        // Clear selections (they may reference deleted items)
        state.selectedComponentId = null;
        state.selectedWireId = null;
        state.hoveredPin = null;

        // Cancel any wire drawing in progress
        state.wireDrawing = {
          isDrawing: false,
          startComponentId: null,
          startPinId: null,
          startX: 0,
          startY: 0,
          bendPoints: [],
          currentX: 0,
          currentY: 0,
          color: state.wireDrawing.color,
        };

        // Cancel click-to-place
        state.clickToPlace = {
          isActive: false,
          componentId: null,
          category: null,
          previewX: 0,
          previewY: 0,
          screenX: 0,
          screenY: 0,
          isOverCanvas: false,
        };
        // Cancel drag preview
        state.dragPreview = {
          isActive: false,
          componentId: null,
          category: null,
          screenX: 0,
          screenY: 0,
          isOverCanvas: false,
        };
      });

      // Re-run simulation if active
      get().runSimulation();
    },

    canUndo: () => {
      return get().history.past.length > 0;
    },

    clearHistory: () => {
      set((state) => {
        state.history.past = [];
      });
    },

    // Breadboard insertion
    insertIntoBreadboard: (componentInstanceId, breadboardInstanceId, insertedPins) => {
      set((state) => {
        const component = state.placedComponents.find(
          (c) => c.instanceId === componentInstanceId
        );
        if (component) {
          component.parentBreadboardId = breadboardInstanceId;
          component.insertedPins = insertedPins;
        }
      });
      // Re-run simulation to detect circuit paths through breadboard
      get().runSimulation();
    },

    removeFromBreadboard: (componentInstanceId) => {
      set((state) => {
        const component = state.placedComponents.find(
          (c) => c.instanceId === componentInstanceId
        );
        if (component) {
          component.parentBreadboardId = undefined;
          component.insertedPins = undefined;
        }
      });
      // Re-run simulation when component is removed from breadboard
      get().runSimulation();
    },

    // Chat reference actions
    addPendingReference: (reference) => {
      set((state) => {
        const { chatInput } = state;

        // Check if there are any unconfirmed (pending) references
        const hasUnconfirmed = chatInput.pendingReferences.some(r => !r.confirmed);

        if (hasUnconfirmed) {
          // Replace any existing unconfirmed references with the new one
          // Keep all confirmed references
          const confirmed = chatInput.pendingReferences.filter(r => r.confirmed);
          chatInput.pendingReferences = [
            ...confirmed,
            { reference, confirmed: false }
          ];
        } else {
          // All references are confirmed (or none exist), add new unconfirmed reference
          chatInput.pendingReferences.push({ reference, confirmed: false });
        }
      });
    },

    confirmReferences: () => {
      set((state) => {
        // Mark all pending references as confirmed
        state.chatInput.pendingReferences = state.chatInput.pendingReferences.map(r => ({
          ...r,
          confirmed: true
        }));
      });
    },

    removeReference: (index) => {
      set((state) => {
        state.chatInput.pendingReferences.splice(index, 1);
      });
    },

    clearReferences: () => {
      set((state) => {
        state.chatInput.pendingReferences = [];
      });
    },

    setInputFocused: (focused) => {
      set((state) => {
        state.chatInput.isInputFocused = focused;
        // When focusing, confirm all existing references
        if (focused) {
          state.chatInput.pendingReferences = state.chatInput.pendingReferences.map(r => ({
            ...r,
            confirmed: true
          }));
        }
      });
    },

    // Highlight actions
    setHighlights: (items) => {
      set((state) => {
        state.highlightedItems = items;
      });
    },

    clearHighlights: () => {
      set((state) => {
        state.highlightedItems = [];
      });
    },

    // Toolbar highlight actions
    setHighlightedToolbarComponents: (componentIds) => {
      set((state) => {
        state.highlightedToolbarComponents = componentIds
          ? Array.from(new Set(componentIds)).filter(Boolean)
          : [];
      });
    },
    setHighlightedToolbarComponent: (componentId) => {
      get().setHighlightedToolbarComponents(componentId ? [componentId] : null);
    },

    // Component onboarding actions
    showOnboarding: (instanceId, definitionId, centerX, centerY) => {
      set((state) => {
        state.activeOnboarding = { instanceId, definitionId, centerX, centerY };
        state.shownOnboardings.add(definitionId);
      });
    },

    hideOnboarding: () => {
      set((state) => {
        state.activeOnboarding = null;
      });
    },

    hasShownOnboarding: (definitionId) => {
      return get().shownOnboardings.has(definitionId);
    },

    triggerOnboardingForComponent: (instanceId) => {
      const state = get();
      const component = state.placedComponents.find(c => c.instanceId === instanceId);
      const definition = state.componentDefinitions.get(instanceId);

      if (component && definition) {
        // Calculate center position
        const centerX = component.x + definition.width / 2;
        const centerY = component.y + definition.height / 2;

        set((s) => {
          s.activeOnboarding = {
            instanceId,
            definitionId: definition.id,
            centerX,
            centerY,
            manual: true,
          };
        });
      }
    },

    // AI Character actions
    showAICharacter: (message, targetComponentId = null, mood = 'happy') => {
      const state = get();
      let x = 200;
      let y = 200;
      let bubblePosition: 'top' | 'bottom' | 'left' | 'right' = 'right';

      // If target component is specified, position near it
      if (targetComponentId) {
        const component = state.placedComponents.find(c => c.instanceId === targetComponentId);
        const definition = state.componentDefinitions.get(targetComponentId);

        if (component && definition) {
          // Position to the right of the component
          x = component.x + definition.width + 80;
          y = component.y + definition.height / 2;
          bubblePosition = 'left';
        }
      }

      set((s) => {
        s.aiCharacter = {
          visible: true,
          x,
          y,
          message,
          mood,
          targetComponentId,
          bubblePosition,
        };
      });
    },

    hideAICharacter: () => {
      set((s) => {
        s.aiCharacter.visible = false;
        s.aiCharacter.message = '';
        s.aiCharacter.targetComponentId = null;
      });
    },

    updateAICharacterMessage: (message, mood) => {
      set((s) => {
        s.aiCharacter.message = message;
        if (mood) {
          s.aiCharacter.mood = mood;
        }
      });
    },

    updateAICharacterPosition: (x, y, bubblePosition) => {
      set((s) => {
        s.aiCharacter.x = x;
        s.aiCharacter.y = y;
        if (bubblePosition) {
          s.aiCharacter.bubblePosition = bubblePosition;
        }
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

export const useClickToPlace = () =>
  useCircuitStore((state) => state.clickToPlace);

export const useDragPreview = () =>
  useCircuitStore((state) => state.dragPreview);

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

export const useChatInput = () =>
  useCircuitStore((state) => state.chatInput);

export const usePendingReferences = () =>
  useCircuitStore((state) => state.chatInput.pendingReferences);

export const useIsInputFocused = () =>
  useCircuitStore((state) => state.chatInput.isInputFocused);

export const useHighlightedItems = () =>
  useCircuitStore((state) => state.highlightedItems);

export const useHighlightedToolbarComponents = () =>
  useCircuitStore((state) => state.highlightedToolbarComponents);

// Backwards-compatible selector: returns first highlighted component (or null)
export const useHighlightedToolbarComponent = () =>
  useCircuitStore((state) => state.highlightedToolbarComponents[0] ?? null);

// Component onboarding selector
export const useActiveOnboarding = () =>
  useCircuitStore((state) => state.activeOnboarding);

// AI Character selector
export const useAICharacter = () =>
  useCircuitStore((state) => state.aiCharacter);
