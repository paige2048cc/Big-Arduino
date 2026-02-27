import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import * as fabric from 'fabric';
import { ZoomIn, ZoomOut, Undo2, Trash2, Move, RotateCw, FlipHorizontal, FlipVertical } from 'lucide-react';
import { useCircuitStore, useHoveredPin, useWireDrawing, useWires, useSimulationErrors, useSelectedWire, useClickToPlace, useDragPreview, useHighlightedItems, useActiveOnboarding, useButtonStates } from '../../store/circuitStore';
import {
  useOnboardingStore,
  useIsOnboardingActive,
  useOnboardingPhase,
} from '../../store/onboardingStore';
import type { CircuitError } from '../../services/circuitSimulator';
import { createComponentReference, createWireReference } from '../../types/chat';
import { loadComponentByFileName, getPinAtPosition } from '../../services/componentService';
import { calculateSnapPosition, shouldRemoveFromBreadboard } from '../../services/breadboardSnapping';
import { routeOrthogonalManhattan, type Rect as RouterRect, type Point as RouterPoint } from '../../services/routing/orthogonalRouter';
import { ComponentOnboarding, hasOnboardingImage } from './ComponentOnboarding';
import { CircuitAnimation } from './CircuitAnimation';
import { tracePowerPath, findAllPowerPins } from '../../services/circuitPathTracer';
import type { CircuitAnimationPath } from '../../services/circuitPathTracer';
import type { ComponentDefinition } from '../../types/components';
import './CircuitCanvas.css';

// Helper functions for wire path generation
function distance(p1: { x: number; y: number }, p2: { x: number; y: number }): number {
  return Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
}

// Calculate distance from a point to a line segment
function distanceToLineSegment(
  px: number, py: number,
  x1: number, y1: number,
  x2: number, y2: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) {
    // Line segment is a point
    return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
  }

  // Calculate projection parameter t
  let t = ((px - x1) * dx + (py - y1) * dy) / lengthSquared;
  t = Math.max(0, Math.min(1, t));

  // Find closest point on line segment
  const closestX = x1 + t * dx;
  const closestY = y1 + t * dy;

  return Math.sqrt((px - closestX) ** 2 + (py - closestY) ** 2);
}

function normalize(v: { x: number; y: number }): { x: number; y: number } {
  const len = Math.sqrt(v.x * v.x + v.y * v.y);
  if (len === 0) return { x: 0, y: 0 };
  return { x: v.x / len, y: v.y / len };
}

function createRoundedPath(points: { x: number; y: number }[], radius: number): string {
  if (points.length < 2) return '';

  let path = `M ${points[0].x} ${points[0].y}`;

  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];

    // Calculate vectors
    const v1 = normalize({ x: prev.x - curr.x, y: prev.y - curr.y });
    const v2 = normalize({ x: next.x - curr.x, y: next.y - curr.y });

    // Calculate corner points
    const d1 = Math.min(radius, distance(prev, curr) / 2);
    const d2 = Math.min(radius, distance(curr, next) / 2);

    const p1 = { x: curr.x + v1.x * d1, y: curr.y + v1.y * d1 };
    const p2 = { x: curr.x + v2.x * d2, y: curr.y + v2.y * d2 };

    path += ` L ${p1.x} ${p1.y}`;
    path += ` Q ${curr.x} ${curr.y} ${p2.x} ${p2.y}`;
  }

  path += ` L ${points[points.length - 1].x} ${points[points.length - 1].y}`;

  return path;
}

// Constrain point to horizontal or vertical axis from start point
function constrainToAxis(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  shiftHeld: boolean
): { x: number; y: number } {
  if (!shiftHeld) return { x: endX, y: endY };

  const dx = Math.abs(endX - startX);
  const dy = Math.abs(endY - startY);

  if (dx > dy) {
    // Horizontal constraint
    return { x: endX, y: startY };
  } else {
    // Vertical constraint
    return { x: startX, y: endY };
  }
}

function dedupeConsecutivePoints(points: { x: number; y: number }[]): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (!last || last.x !== p.x || last.y !== p.y) out.push(p);
  }
  return out;
}

function simplifyCollinearPoints(points: { x: number; y: number }[]): { x: number; y: number }[] {
  if (points.length <= 2) return points;
  const out: { x: number; y: number }[] = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const a = out[out.length - 1];
    const b = points[i];
    const c = points[i + 1];
    const collinear = (a.x === b.x && b.x === c.x) || (a.y === b.y && b.y === c.y);
    if (!collinear) out.push(b);
  }
  out.push(points[points.length - 1]);
  return out;
}

function fallbackOrthogonal(a: { x: number; y: number }, b: { x: number; y: number }): { x: number; y: number }[] {
  if (a.x === b.x || a.y === b.y) return [a, b];
  return [a, { x: b.x, y: a.y }, b];
}

function applySegmentShift(
  points: { x: number; y: number }[],
  segmentIndex: number,
  orientation: 'h' | 'v',
  newCoord: number
): { x: number; y: number }[] {
  if (points.length < 2) return points;
  if (segmentIndex < 0 || segmentIndex >= points.length - 1) return points;

  if (orientation === 'h') {
    const newY = newCoord;
    // Segment endpoints
    const i = segmentIndex;
    const j = segmentIndex + 1;

    if (i === 0) {
      const start = points[0];
      const p1 = { ...points[1], y: newY };
      const inserted = start.y === newY ? [] : [{ x: start.x, y: newY }];
      return simplifyCollinearPoints(dedupeConsecutivePoints([start, ...inserted, p1, ...points.slice(2)]));
    }
    if (j === points.length - 1) {
      const end = points[points.length - 1];
      const prev = { ...points[points.length - 2], y: newY };
      const inserted = end.y === newY ? [] : [{ x: end.x, y: newY }];
      return simplifyCollinearPoints(dedupeConsecutivePoints([...points.slice(0, -2), prev, ...inserted, end]));
    }

    const out = points.map((p) => ({ ...p }));
    out[i].y = newY;
    out[j].y = newY;
    return simplifyCollinearPoints(dedupeConsecutivePoints(out));
  }

  // Vertical segment
  const newX = newCoord;
  const i = segmentIndex;
  const j = segmentIndex + 1;

  if (i === 0) {
    const start = points[0];
    const p1 = { ...points[1], x: newX };
    const inserted = start.x === newX ? [] : [{ x: newX, y: start.y }];
    return simplifyCollinearPoints(dedupeConsecutivePoints([start, ...inserted, p1, ...points.slice(2)]));
  }
  if (j === points.length - 1) {
    const end = points[points.length - 1];
    const prev = { ...points[points.length - 2], x: newX };
    const inserted = end.x === newX ? [] : [{ x: newX, y: end.y }];
    return simplifyCollinearPoints(dedupeConsecutivePoints([...points.slice(0, -2), prev, ...inserted, end]));
  }

  const out = points.map((p) => ({ ...p }));
  out[i].x = newX;
  out[j].x = newX;
  return simplifyCollinearPoints(dedupeConsecutivePoints(out));
}

// Threshold distance for pin snapping (in canvas pixels)
const PIN_SNAP_THRESHOLD = 30;
const DEFAULT_ROUTE_GRID_SIZE = 12;
const DEFAULT_ROUTE_CLEARANCE = 28;

// Ghost preview component for click-to-place
interface GhostPreviewProps {
  image: HTMLImageElement;
  screenX: number;
  screenY: number;
  anchorOffsetX: number;  // Offset to align anchor pin with cursor
  anchorOffsetY: number;
  isOverCanvas: boolean;
  imageWidth: number;
  imageHeight: number;
}

function GhostPreview({
  image,
  screenX,
  screenY,
  anchorOffsetX,
  anchorOffsetY,
  isOverCanvas,
  imageWidth,
  imageHeight
}: GhostPreviewProps) {
  // Scale down when outside canvas for large components
  const maxDimension = Math.max(imageWidth, imageHeight);
  const shouldScaleDown = !isOverCanvas && maxDimension > 100;
  const scale = shouldScaleDown ? Math.min(1, 80 / maxDimension) : 1;

  // Adjust offset based on scale
  const adjustedOffsetX = anchorOffsetX * scale;
  const adjustedOffsetY = anchorOffsetY * scale;

  return createPortal(
    <img
      src={image.src}
      alt="Preview"
      style={{
        position: 'fixed',
        left: screenX - adjustedOffsetX,
        top: screenY - adjustedOffsetY,
        width: imageWidth * scale,
        height: imageHeight * scale,
        opacity: isOverCanvas ? 0.7 : 0.5,
        pointerEvents: 'none',
        zIndex: 10000,
        filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.3))',
        transition: 'width 0.15s ease-out, height 0.15s ease-out, opacity 0.15s ease-out',
        transformOrigin: 'top left',
      }}
    />,
    document.body
  );
}

interface CircuitCanvasProps {
  onComponentDrop?: (componentId: string, x: number, y: number) => void;
  onComponentSelect?: (instanceId: string | null) => void;
}

// Extended FabricObject to include our custom data
interface ComponentFabricObject extends fabric.FabricObject {
  data?: {
    type: 'component' | 'grid' | 'wire' | 'wire-outline' | 'wire-segment-handle' | 'pin-highlight';
    instanceId?: string;
    definitionId?: string;
    componentId?: string;
    wireId?: string;
    error?: CircuitError;
    points?: { x: number; y: number }[];
    // For wire segment handles
    segmentIndex?: number;
    segmentOrientation?: 'h' | 'v';
  };
}

export function CircuitCanvas({ onComponentDrop, onComponentSelect }: CircuitCanvasProps) {
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<fabric.Canvas | null>(null);
  const [zoom, setZoom] = useState(1);
  const [isDragOver, setIsDragOver] = useState(false);
  const [ghostPreviewImage, setGhostPreviewImage] = useState<HTMLImageElement | null>(null);
  const [ghostPreviewAnchor, setGhostPreviewAnchor] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [ghostPreviewDimensions, setGhostPreviewDimensions] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  // Drag preview state (shared anchor/dimensions calculation)
  const [dragPreviewImage, setDragPreviewImage] = useState<HTMLImageElement | null>(null);
  const [dragPreviewAnchor, setDragPreviewAnchor] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [dragPreviewDimensions, setDragPreviewDimensions] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [selectedObject, setSelectedObject] = useState<fabric.FabricObject | null>(null);
  const [, setViewportVersion] = useState(0); // Triggers re-render on viewport change

  // Zustand store
  const {
    placedComponents,
    addComponent,
    removeComponent,
    updateComponentPosition,
    selectComponent,
    setHoveredPin,
    isSimulating,
    updateComponentState,
    startWireDrawing,
    updateWireDrawing,
    addWireBendPoint,
    removeLastWireBendPoint,
    setWireDrawingColor,
    completeWireDrawing,
    cancelWireDrawing,
    setComponentDefinition,
    getComponentDefinition,
    setButtonState,
    selectWire,
    removeWire,
    updateWire,
    selectedWireId,
    undo,
    canUndo,
    insertIntoBreadboard,
    removeFromBreadboard,
    cancelClickToPlace,
    updateClickToPlacePreview,
    updateDragPreview,
    endDragPreview,
    addPendingReference,
    showOnboarding,
    hideOnboarding,
    hasShownOnboarding,
  } = useCircuitStore();

  const hoveredPin = useHoveredPin();
  const clickToPlace = useClickToPlace();
  const dragPreview = useDragPreview();
  const wireDrawing = useWireDrawing();
  const wires = useWires();
  const simulationErrors = useSimulationErrors();
  const selectedWire = useSelectedWire();
  const highlightedItems = useHighlightedItems();
  const activeOnboarding = useActiveOnboarding();

  // Onboarding hooks
  const isOnboardingActive = useIsOnboardingActive();
  const onboardingPhase = useOnboardingPhase();
  const onComponentDropped = useOnboardingStore((state) => state.onComponentDropped);

  // Highlight objects ref for cleanup
  const highlightObjectsRef = useRef<fabric.FabricObject[]>([]);

  // Track whether we're in the middle of dropping a component from the library
  // (to skip adding references during drop)
  const isDroppingFromLibraryRef = useRef(false);

  // Hovered wire error for tooltip
  const [hoveredWireError, setHoveredWireError] = useState<CircuitError | null>(null);
  const [wireErrorPosition, setWireErrorPosition] = useState<{ x: number; y: number } | null>(null);

  // Map instanceId to Fabric object
  const instanceToFabricMap = useRef<Map<string, fabric.FabricObject>>(new Map());

  // Map wireId to Fabric path object
  const wireToFabricMap = useRef<Map<string, fabric.Path>>(new Map());

  // Wire segment handles (draggable) when wire is selected
  const wireControlPointsRef = useRef<fabric.FabricObject[]>([]);

  // Wire preview path during drawing
  const wirePreviewRef = useRef<fabric.Path | null>(null);
  // Route context cache during wire drawing (components are locked while drawing)
  const routeContextRef = useRef<{
    componentRects: Map<string, RouterRect>;
    obstacles: RouterRect[];
    startRect?: RouterRect;
  } | null>(null);
  // Cache latest preview result so click-to-complete matches what user saw
  const previewRoutedPointsRef = useRef<{ points: RouterPoint[]; bendPoints: RouterPoint[] } | null>(null);
  const routeRafRef = useRef<number | null>(null);

  // Image cache for component variants (to avoid reloading same images)
  const imageCache = useRef<Map<string, HTMLImageElement>>(new Map());

  // Track pending component loads to prevent duplicate Fabric object creation
  const pendingLoadsRef = useRef<Set<string>>(new Set());

  // Track pressed button during simulation
  const pressedButtonRef = useRef<string | null>(null);

  // Middle mouse button panning
  const isMiddleMousePanningRef = useRef(false);
  const lastPanPointRef = useRef<{ x: number; y: number } | null>(null);

  // Shift key state for axis constraint
  const isShiftHeldRef = useRef(false);

  // Track if any object is currently being dragged
  // Used to prevent sync effect from interfering during drag
  const isDraggingRef = useRef(false);

  // ── Circuit power-flow animation ───────────────────────────────────────────
  // Ref pointing directly at Fabric's viewportTransform array (mutated in-place
  // during pan; replaced after zoom – we update the ref in both cases).
  const viewportTransformRef = useRef<number[]>([1, 0, 0, 1, 0, 0]);
  // Wire SVG path strings (scene coords) cached during the wire render loop.
  const wirePathStringsRef = useRef<Record<string, string>>({});
  // Current animation path and loop mode.
  const [animPath, setAnimPath] = useState<CircuitAnimationPath | null>(null);
  const [animLooping, setAnimLooping] = useState(false);
  // Stable callback so the rAF loop in CircuitAnimation doesn't restart on re-renders.
  const handleAnimDone = useCallback(() => setAnimPath(null), []);
  // Button states – used to retrace the circuit when a button is pressed in simulation.
  const buttonStates = useButtonStates();

  // Track insertion highlight pins (for visual feedback when components snap to breadboard)
  // Store breadboard instance ID and pin IDs, positions calculated at render time using getPinCanvasPosition
  const [insertionHighlights, setInsertionHighlights] = useState<Array<{
    breadboardInstanceId: string;
    pinId: string;
  }>>([]);
  const insertionHighlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Refs for event handlers to avoid stale closures
  const handleMouseMoveRef = useRef<typeof handleMouseMoveEvent>(null!);
  const handleMouseDownRef = useRef<typeof handleMouseDownEvent>(null!);
  const handleMouseUpRef = useRef<typeof handleMouseUpEvent>(null!);
  const handleObjectMovingRef = useRef<(obj: ComponentFabricObject) => void>(null!);
  const handleObjectModifiedRef = useRef<(obj: ComponentFabricObject) => void>(null!);

  // Map instanceId → ComponentDefinition, rebuilt whenever components change.
  // Used by the path tracer (which runs in pure JS without Fabric access).
  const definitionsMap = useMemo(() => {
    const map = new Map<string, ComponentDefinition>();
    for (const comp of placedComponents) {
      const def = getComponentDefinition(comp.instanceId);
      if (def) map.set(comp.instanceId, def);
    }
    return map;
  }, [placedComponents, getComponentDefinition]);

  // Update component image when state changes (for LEDs and buttons during simulation)
  const updateComponentImage = useCallback((instanceId: string, state: 'on' | 'off') => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const fabricObj = instanceToFabricMap.current.get(instanceId);
    if (!fabricObj) return;

    const definition = getComponentDefinition(instanceId);
    if (!definition?.variants) return;

    // Get the placed component to access its properties (like color)
    const component = placedComponents.find(c => c.instanceId === instanceId);
    const color = component?.properties?.color as string | undefined;

    // Build variant key: try color-state first (e.g., 'red-on'), then just state (e.g., 'on')
    let variant = null;

    if (color) {
      const colorVariantKey = `${color}-${state}`;
      if (definition.variants[colorVariantKey]) {
        variant = definition.variants[colorVariantKey];
      }
    }

    // Fall back to just state key if color variant not found
    if (!variant) {
      variant = definition.variants[state];
    }

    if (!variant?.image) return;

    // Build the image URL
    const imageUrl = `${import.meta.env.BASE_URL}components/${definition.category}/${variant.image}`;

    // Skip if already showing this image
    if (component?.currentImage === imageUrl) return;

    // Check cache first
    const cachedImg = imageCache.current.get(imageUrl);

    const applyImage = (img: HTMLImageElement) => {
      if (fabricObj instanceof fabric.FabricImage) {
        fabricObj.setElement(img);
        canvas.renderAll();
      }
    };

    if (cachedImg) {
      // Use cached image immediately
      applyImage(cachedImg);
      // Update the component state and currentImage in the store
      updateComponentState(instanceId, state, imageUrl);
    } else {
      // Load new image and cache it
      const img = new Image();
      img.onload = () => {
        imageCache.current.set(imageUrl, img);
        applyImage(img);
        // Update the component state and currentImage in the store
        updateComponentState(instanceId, state, imageUrl);
      };
      img.src = imageUrl;
    }
  }, [getComponentDefinition, updateComponentState, placedComponents]);

  // Show insertion highlights on breadboard pins when a component is inserted
  const showInsertionHighlights = useCallback((
    breadboardInstanceId: string,
    insertedPins: Record<string, string> // componentPinId -> breadboardPinId
  ) => {
    // Clear any existing timeout
    if (insertionHighlightTimeoutRef.current) {
      clearTimeout(insertionHighlightTimeoutRef.current);
    }

    // Store breadboard and pin IDs - positions will be calculated at render time
    const highlights: Array<{ breadboardInstanceId: string; pinId: string }> = [];

    for (const [, bbPinId] of Object.entries(insertedPins)) {
      highlights.push({
        breadboardInstanceId,
        pinId: bbPinId,
      });
    }

    setInsertionHighlights(highlights);

    // Clear highlights after animation completes (400ms matches CSS animation duration)
    insertionHighlightTimeoutRef.current = setTimeout(() => {
      setInsertionHighlights([]);
    }, 400);
  }, []);

  // Initialize Fabric.js canvas
  useEffect(() => {
    const container = canvasContainerRef.current;
    const canvasEl = canvasRef.current;
    if (!container || !canvasEl) return;

    const rect = container.getBoundingClientRect();

    const fabricCanvas = new fabric.Canvas(canvasEl, {
      width: rect.width,
      height: rect.height,
      backgroundColor: '#e8eaed',
      selection: true,
      preserveObjectStacking: true,
      targetFindTolerance: 8,  // Increase hit tolerance for easier wire selection
    });

    fabricCanvasRef.current = fabricCanvas;
    // Initialise viewport transform ref so animation overlay starts correct
    viewportTransformRef.current = fabricCanvas.viewportTransform as number[];

    // Selection handlers (for components - wires use custom selection)
    fabricCanvas.on('selection:created', (e) => {
      const selected = e.selected?.[0] as ComponentFabricObject;
      setSelectedObject(selected || null);
      if (selected?.data?.instanceId) {
        // Component selected
        selectComponent(selected.data.instanceId);
        selectWire(null);
        onComponentSelect?.(selected.data.instanceId);

        // Create a reference tag for the chat input
        // Skip if we're dropping a component from the library (not clicking in workspace)
        if (selected.data.definitionId && !isDroppingFromLibraryRef.current) {
          const definition = getComponentDefinition(selected.data.definitionId);
          const displayName = definition?.name || selected.data.definitionId;
          const reference = createComponentReference(
            selected.data.instanceId,
            selected.data.definitionId,
            displayName
          );
          addPendingReference(reference);
        }
      }
    });

    fabricCanvas.on('selection:updated', (e) => {
      const selected = e.selected?.[0] as ComponentFabricObject;
      setSelectedObject(selected || null);
      if (selected?.data?.instanceId) {
        // Component selected
        selectComponent(selected.data.instanceId);
        selectWire(null);
        onComponentSelect?.(selected.data.instanceId);

        // Create a reference tag for the chat input
        // Skip if we're dropping a component from the library (not clicking in workspace)
        if (selected.data.definitionId && !isDroppingFromLibraryRef.current) {
          const definition = getComponentDefinition(selected.data.definitionId);
          const displayName = definition?.name || selected.data.definitionId;
          const reference = createComponentReference(
            selected.data.instanceId,
            selected.data.definitionId,
            displayName
          );
          addPendingReference(reference);
        }
      }
    });

    fabricCanvas.on('selection:cleared', () => {
      setSelectedObject(null);
      selectComponent(null);
      // Don't clear wire selection here - we handle it manually
      onComponentSelect?.(null);
    });

    // Handle clicking on already-selected component (selection events don't fire in this case)
    fabricCanvas.on('mouse:down', (e) => {
      if (!e.target) return;

      const target = e.target as ComponentFabricObject;
      const activeObject = fabricCanvas.getActiveObject();

      // Check if we clicked on the already-selected object
      if (target === activeObject && target.data?.instanceId && target.data?.definitionId) {
        // Skip if dropping from library
        if (isDroppingFromLibraryRef.current) return;

        // Add reference for the clicked component
        const definition = getComponentDefinition(target.data.definitionId);
        const displayName = definition?.name || target.data.definitionId;
        const reference = createComponentReference(
          target.data.instanceId,
          target.data.definitionId,
          displayName
        );
        addPendingReference(reference);
      }
    });

    // Object moving handler (real-time updates during drag) - using ref to avoid stale closure
    fabricCanvas.on('object:moving', (e) => {
      isDraggingRef.current = true; // Mark that a drag is in progress
      const obj = e.target as ComponentFabricObject;
      handleObjectMovingRef.current?.(obj);
    });

    // Object modified handler (includes moved, scaled, rotated) - using ref to avoid stale closure
    fabricCanvas.on('object:modified', (e) => {
      isDraggingRef.current = false; // Drag has ended
      const obj = e.target as ComponentFabricObject;
      handleObjectModifiedRef.current?.(obj);
    });

    // Mouse move for pin detection (using ref to avoid stale closure)
    fabricCanvas.on('mouse:move', (e) => {
      // Always use getScenePoint() for accurate coordinates after zoom/pan
      const scenePoint = fabricCanvas.getScenePoint(e.e);
      handleMouseMoveRef.current?.(fabricCanvas, e.e as MouseEvent, scenePoint);
    });

    // Mouse down for wire drawing and button press (using ref to avoid stale closure)
    fabricCanvas.on('mouse:down', (e) => {
      // Always use getScenePoint() for accurate coordinates after zoom/pan
      const scenePoint = fabricCanvas.getScenePoint(e.e);
      handleMouseDownRef.current?.(fabricCanvas, e.e as MouseEvent, scenePoint);
    });

    // Mouse up for button release and pan stop (using ref to avoid stale closure)
    fabricCanvas.on('mouse:up', (e) => {
      handleMouseUpRef.current?.(fabricCanvas, e.e as MouseEvent);
    });

    // Mouse over for wire error tooltips
    fabricCanvas.on('mouse:over', (e) => {
      const target = e.target as ComponentFabricObject;
      if (target?.data?.type === 'wire' && target.data.error) {
        const mouseEvent = e.e as MouseEvent;
        const rect = container.getBoundingClientRect();
        setHoveredWireError(target.data.error);
        setWireErrorPosition({
          x: mouseEvent.clientX - rect.left,
          y: mouseEvent.clientY - rect.top,
        });
      }
    });

    // Mouse out for hiding wire error tooltips
    fabricCanvas.on('mouse:out', (e) => {
      const target = e.target as ComponentFabricObject;
      if (target?.data?.type === 'wire') {
        setHoveredWireError(null);
        setWireErrorPosition(null);
      }
    });

    // Mouse wheel for zooming
    fabricCanvas.on('mouse:wheel', (opt) => {
      const e = opt.e as WheelEvent;
      const delta = e.deltaY;
      let newZoom = fabricCanvas.getZoom() * (delta > 0 ? 0.9 : 1.1);

      // Clamp zoom between 0.5 and 3
      newZoom = Math.min(Math.max(newZoom, 0.5), 3);

      // Zoom toward mouse position
      const pointer = fabricCanvas.getScenePoint(e);
      fabricCanvas.zoomToPoint(pointer, newZoom);
      // zoomToPoint may create a new transform array – keep ref in sync
      viewportTransformRef.current = fabricCanvas.viewportTransform as number[];

      setZoom(newZoom);
      setViewportVersion(v => v + 1);
      e.preventDefault();
      e.stopPropagation();
    });

    // Handle resize
    const handleResize = () => {
      const newRect = container.getBoundingClientRect();
      fabricCanvas.setDimensions({ width: newRect.width, height: newRect.height });
      fabricCanvas.renderAll();
    };

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      fabricCanvas.dispose();
    };
  }, []);

  // Lock components during wire drawing to prevent accidental movement
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    // Build routing context when entering wire drawing mode.
    // While drawing, components are locked so rects remain stable.
    if (wireDrawing.isDrawing) {
      const componentRects = new Map<string, RouterRect>();
      const obstacles: RouterRect[] = [];

      for (const comp of placedComponents) {
        const def = getComponentDefinition(comp.instanceId);
        if (!def) continue;

        const obj = instanceToFabricMap.current.get(comp.instanceId);
        if (!obj) continue;

        const r = obj.getBoundingRect();
        const rect: RouterRect = {
          left: r.left,
          top: r.top,
          right: r.left + r.width,
          bottom: r.top + r.height,
        };

        componentRects.set(comp.instanceId, rect);

        // Only treat Arduino UNO as an obstacle for wire routing.
        // Breadboard is the wiring surface, and small components (LEDs, resistors, etc.)
        // don't need to be avoided - wires can pass over/around them naturally.
        if (def.id === 'arduino-uno') {
          obstacles.push(rect);
        }
      }

      // Only use startRect for obstacle components (Arduino UNO) to compute exit points.
      // For other components, wires can start directly from the pin without detours.
      let startRect: RouterRect | undefined;
      if (wireDrawing.startComponentId) {
        const startDef = getComponentDefinition(wireDrawing.startComponentId);
        if (startDef?.id === 'arduino-uno') {
          startRect = componentRects.get(wireDrawing.startComponentId);
        }
      }

      routeContextRef.current = { componentRects, obstacles, startRect };
    } else {
      routeContextRef.current = null;
      previewRoutedPointsRef.current = null;
    }

    const objects = canvas.getObjects();
    objects.forEach(obj => {
      const data = (obj as ComponentFabricObject).data;
      if (data?.type === 'component') {
        if (wireDrawing.isDrawing) {
          // Lock movement and disable selection during wire drawing
          obj.selectable = false;
          obj.evented = false;
        } else {
          // Restore interactivity when not drawing
          obj.selectable = true;
          obj.evented = true;
        }
      }
    });

    // Also disable canvas selection during wire drawing
    canvas.selection = !wireDrawing.isDrawing;
    canvas.renderAll();
  }, [wireDrawing.isDrawing, wireDrawing.startComponentId, placedComponents, getComponentDefinition]);

  // Helper to get pin canvas coordinates (handles rotation, flip, and scale)
  const getPinCanvasPosition = useCallback((componentId: string, pinId: string): { x: number; y: number } | null => {
    const definition = getComponentDefinition(componentId);
    if (!definition) return null;

    const pin = definition.pins.find(p => p.id === pinId);
    if (!pin) return null;

    const fabricObj = instanceToFabricMap.current.get(componentId);
    if (!fabricObj) return null;

    // Pin position in component's local coordinate system (relative to top-left of definition)
    const localX = pin.x;
    const localY = pin.y;

    // Use Fabric.js transform matrix to convert local coords to canvas coords
    // This accounts for position, rotation, scale, flip, and origin
    // Note: The transform matrix already includes flipX/flipY transformations,
    // so we should NOT manually adjust coordinates for flip here.
    const transformMatrix = fabricObj.calcTransformMatrix();

    // In Fabric.js, local coordinates are relative to the object's center when transforming
    const centerOffsetX = definition.width / 2;
    const centerOffsetY = definition.height / 2;

    // Position relative to center
    const relativePoint = new fabric.Point(localX - centerOffsetX, localY - centerOffsetY);

    // Apply transform matrix to get canvas coordinates
    // The matrix handles position, rotation, scale, and flip automatically
    const canvasPoint = fabric.util.transformPoint(relativePoint, transformMatrix);

    return {
      x: canvasPoint.x,
      y: canvasPoint.y,
    };
  }, [getComponentDefinition]);

  // Find the nearest pin to a given canvas position (for endpoint snapping)
  const findNearestPin = useCallback((
    canvasX: number,
    canvasY: number,
    excludeComponentId?: string,
    excludePinId?: string
  ): { componentId: string; pinId: string; distance: number } | null => {
    let nearestPin: { componentId: string; pinId: string; distance: number } | null = null;

    for (const component of placedComponents) {
      const definition = getComponentDefinition(component.instanceId);
      if (!definition) continue;

      for (const pin of definition.pins) {
        // Skip the pin we're dragging from (to avoid connecting to itself)
        if (component.instanceId === excludeComponentId && pin.id === excludePinId) {
          continue;
        }

        const pinPos = getPinCanvasPosition(component.instanceId, pin.id);
        if (!pinPos) continue;

        const dist = Math.sqrt((canvasX - pinPos.x) ** 2 + (canvasY - pinPos.y) ** 2);

        if (dist <= PIN_SNAP_THRESHOLD && (!nearestPin || dist < nearestPin.distance)) {
          nearestPin = {
            componentId: component.instanceId,
            pinId: pin.id,
            distance: dist,
          };
        }
      }
    }

    return nearestPin;
  }, [placedComponents, getComponentDefinition, getPinCanvasPosition]);

  // Handle mouse move for pin detection
  const handleMouseMoveEvent = useCallback((
    canvas: fabric.Canvas,
    mouseEvent: MouseEvent,
    scenePoint: fabric.Point
  ) => {
    // Handle middle mouse button panning
    if (isMiddleMousePanningRef.current && lastPanPointRef.current) {
      const vpt = canvas.viewportTransform;
      if (vpt) {
        vpt[4] += mouseEvent.clientX - lastPanPointRef.current.x;
        vpt[5] += mouseEvent.clientY - lastPanPointRef.current.y;
        canvas.setViewportTransform(vpt);
        lastPanPointRef.current = { x: mouseEvent.clientX, y: mouseEvent.clientY };
        // Trigger re-render for onboarding overlay
        setViewportVersion(v => v + 1);
      }
      return;
    }

    const pointer = scenePoint;

    // Update click-to-place preview position
    if (clickToPlace.isActive) {
      updateClickToPlacePreview(pointer.x, pointer.y);
    }

    // Find all component objects (not just selected ones)
    const objects = canvas.getObjects().filter(obj => {
      const data = (obj as ComponentFabricObject).data;
      return data?.type === 'component' && data?.instanceId;
    });

    // Track if cursor is covered by a component above in z-order
    // Used to prevent pins from showing hover when visually covered by another component
    let isCoveredByComponentAbove = false;

    // Check if cursor is over a wire - if so, don't show breadboard pin hover
    // This ensures wires have priority over breadboard pins for selection
    let isCursorOverWire = false;
    const wireObjects = canvas.getObjects().filter(obj => {
      const data = (obj as ComponentFabricObject).data;
      return data?.type === 'wire';
    });

    for (const wireObj of wireObjects) {
      const wireData = (wireObj as ComponentFabricObject).data as { points?: { x: number; y: number }[] };
      if (!wireData?.points) continue;

      for (let j = 0; j < wireData.points.length - 1; j++) {
        const p1 = wireData.points[j];
        const p2 = wireData.points[j + 1];
        const dist = distanceToLineSegment(pointer.x, pointer.y, p1.x, p1.y, p2.x, p2.y);
        if (dist < 10) {
          isCursorOverWire = true;
          break;
        }
      }
      if (isCursorOverWire) break;
    }

    // Check each component for pin hit (in reverse order so topmost is checked first)
    for (let i = objects.length - 1; i >= 0; i--) {
      const target = objects[i] as ComponentFabricObject;
      if (!target.data?.instanceId) continue;

      const definition = getComponentDefinition(target.data.instanceId);
      if (!definition) continue;

      // Get the inverse transform matrix to convert canvas coords to local coords
      const transformMatrix = target.calcTransformMatrix();
      const invertedMatrix = fabric.util.invertTransform(transformMatrix);

      // Convert pointer to local component coordinates using inverse transform
      const localPoint = fabric.util.transformPoint(
        new fabric.Point(pointer.x, pointer.y),
        invertedMatrix
      );

      // Adjust for center-based transform (Fabric uses center as origin for transforms)
      // Note: The inverse transform matrix already handles flipX/flipY, converting
      // canvas coordinates back to the original (un-flipped) local coordinate space.
      // No manual flip adjustment is needed here.
      const localX = localPoint.x + definition.width / 2;
      const localY = localPoint.y + definition.height / 2;

      // Check if within component bounds (using original definition size)
      if (localX < 0 || localX > definition.width || localY < 0 || localY > definition.height) {
        continue;
      }

      // Skip this component's pins if covered by a component above
      // This applies to ALL components (breadboard, UNO, LEDs, resistors, etc.)
      if (isCoveredByComponentAbove) {
        continue;
      }

      // Skip breadboard pin hover if cursor is over a wire
      // Wires have priority over breadboard pins for selection
      const isBreadboard = definition.id === 'breadboard';
      if (isBreadboard && isCursorOverWire) {
        continue;
      }

      // Check for pin hit
      const pin = getPinAtPosition(definition, localX, localY);

      if (pin) {
        // Use getPinCanvasPosition to get properly transformed pin coordinates
        const pinPos = getPinCanvasPosition(target.data.instanceId, pin.id);
        if (!pinPos) continue;

        setHoveredPin({
          pin,
          componentId: target.data.instanceId,
          canvasX: pinPos.x,
          canvasY: pinPos.y,
        });

        // If drawing a wire, snap floating endpoint to the hovered pin position (preview only)
        if (wireDrawing.isDrawing) {
          updateWireDrawing(pinPos.x, pinPos.y);
        }
        return;
      }

      // Cursor is within this component's bounds but not on a pin
      // Mark as covered so components below won't show their pins
      isCoveredByComponentAbove = true;
    }

    // No pin hovered
    setHoveredPin(null);

    // Update wire drawing position if active (no pin nearby, use cursor position)
    if (wireDrawing.isDrawing) {
      // Get the last anchor point (either start or last bend point)
      const lastPoint = wireDrawing.bendPoints.length > 0
        ? wireDrawing.bendPoints[wireDrawing.bendPoints.length - 1]
        : { x: wireDrawing.startX, y: wireDrawing.startY };

      // Apply Shift constraint if held
      const constrained = constrainToAxis(
        lastPoint.x,
        lastPoint.y,
        pointer.x,
        pointer.y,
        isShiftHeldRef.current
      );

      updateWireDrawing(constrained.x, constrained.y);
    }
  }, [getComponentDefinition, setHoveredPin, wireDrawing.isDrawing, wireDrawing.bendPoints, wireDrawing.startX, wireDrawing.startY, updateWireDrawing, getPinCanvasPosition]);

  // Handle mouse down for wire drawing and button press
  const handleMouseDownEvent = useCallback((canvas: fabric.Canvas, mouseEvent: MouseEvent, scenePoint: fabric.Point) => {
    // Handle click-to-place completion
    if (clickToPlace.isActive && clickToPlace.componentId && clickToPlace.category && mouseEvent.button === 0) {
      // Offset placement so anchor pin is at cursor position
      const placementX = scenePoint.x - ghostPreviewAnchor.x;
      const placementY = scenePoint.y - ghostPreviewAnchor.y;
      // Mark that we're placing from library (to skip adding chat references)
      isDroppingFromLibraryRef.current = true;
      createComponentWithImage(
        clickToPlace.componentId,
        clickToPlace.category,
        placementX,
        placementY
      );

      // Notify onboarding that component was dropped/placed
      if (isOnboardingActive && onboardingPhase === 'component-clicked') {
        onComponentDropped();
      }

      // Clear the flag after a short delay to allow selection events to fire
      setTimeout(() => {
        isDroppingFromLibraryRef.current = false;
      }, 100);
      cancelClickToPlace();
      mouseEvent.preventDefault();
      mouseEvent.stopPropagation();
      return;
    }

    // Handle middle mouse button for panning
    if (mouseEvent.button === 1) {
      isMiddleMousePanningRef.current = true;
      lastPanPointRef.current = { x: mouseEvent.clientX, y: mouseEvent.clientY };
      canvas.selection = false;
      canvas.defaultCursor = 'grabbing';
      canvas.setCursor('grabbing');
      mouseEvent.preventDefault();
      return;
    }

    // Handle pin/wire interaction - disabled when a wire is selected or during simulation
    if (hoveredPin && !selectedWireId && !isSimulating) {
      if (!wireDrawing.isDrawing) {
        // Start wire drawing
        startWireDrawing(
          hoveredPin.componentId,
          hoveredPin.pin.id,
          hoveredPin.canvasX,
          hoveredPin.canvasY
        );
        mouseEvent.preventDefault();
        mouseEvent.stopPropagation();
        return;
      } else {
        // Complete wire drawing.
        // Use the same routed bend points that the preview is showing.
        const override = previewRoutedPointsRef.current?.bendPoints;
        completeWireDrawing(hoveredPin.componentId, hoveredPin.pin.id, override);
        return;
      }
    }

    // Handle click on empty canvas during wire drawing - add bend point (disabled during simulation)
    if (wireDrawing.isDrawing && mouseEvent.button === 0 && !isSimulating) {
      // Get the last anchor point (either start or last bend point)
      const lastPoint = wireDrawing.bendPoints.length > 0
        ? wireDrawing.bendPoints[wireDrawing.bendPoints.length - 1]
        : { x: wireDrawing.startX, y: wireDrawing.startY };

      // Apply Shift constraint if held
      const constrained = constrainToAxis(
        lastPoint.x,
        lastPoint.y,
        scenePoint.x,
        scenePoint.y,
        isShiftHeldRef.current
      );

      // Add a bend point at constrained position
      addWireBendPoint(constrained.x, constrained.y);
      mouseEvent.preventDefault();
      return;
    }

    // Handle wire control point click (for dragging bend points)
    const controlPointObjects = canvas.getObjects().filter(obj => {
      const data = (obj as ComponentFabricObject).data;
      return data?.type === 'wire-segment-handle';
    });

    for (let i = controlPointObjects.length - 1; i >= 0; i--) {
      const target = controlPointObjects[i] as ComponentFabricObject;
      if (!target.data?.wireId) continue;

      // Check if click is on this segment handle
      if (target.containsPoint(scenePoint)) {
        // Handle clicked - Fabric will handle the drag
        return;
      }
    }

    // Handle wire click for selection
    const wireObjects = canvas.getObjects().filter(obj => {
      const data = (obj as ComponentFabricObject).data;
      return data?.type === 'wire';
    });

    for (let i = wireObjects.length - 1; i >= 0; i--) {
      const target = wireObjects[i] as ComponentFabricObject;
      if (!target.data?.wireId) continue;

      // Check if click is near this wire path
      // Use containsPoint with a tolerance for paths
      const wirePath = target as fabric.Path;
      const boundingRect = wirePath.getBoundingRect();

      // First check bounding rect (fast check)
      if (scenePoint.x >= boundingRect.left - 10 &&
          scenePoint.x <= boundingRect.left + boundingRect.width + 10 &&
          scenePoint.y >= boundingRect.top - 10 &&
          scenePoint.y <= boundingRect.top + boundingRect.height + 10) {
        // Now check if point is close to the wire path
        // Use distance to path approximation
        const wireData = target.data as { points?: { x: number; y: number }[] };
        if (wireData.points) {
          for (let j = 0; j < wireData.points.length - 1; j++) {
            const p1 = wireData.points[j];
            const p2 = wireData.points[j + 1];
            const dist = distanceToLineSegment(scenePoint.x, scenePoint.y, p1.x, p1.y, p2.x, p2.y);
            if (dist < 10) {
              // Wire clicked - select it
              selectWire(target.data.wireId);

              // Create a wire reference tag for the chat input
              const wireData = wires.find(w => w.id === target.data?.wireId);
              if (wireData) {
                const wireRef = createWireReference(
                  wireData.id,
                  wireData.startComponentId,
                  wireData.startPinId,
                  wireData.endComponentId,
                  wireData.endPinId
                );
                addPendingReference(wireRef);
              }

              mouseEvent.preventDefault();
              return;
            }
          }
        }
      }
    }

    // Click on empty canvas - deselect wire if one is selected
    if (selectedWireId && mouseEvent.button === 0) {
      // Check if clicking on a component
      const componentAtPoint = canvas.getObjects().find(obj => {
        const data = (obj as ComponentFabricObject).data;
        return data?.type === 'component' && obj.containsPoint(scenePoint);
      });

      if (!componentAtPoint) {
        // Clicking on empty space - deselect wire
        selectWire(null);
      }
    }

    // Handle button press during simulation
    if (isSimulating) {
      const pointer = scenePoint;
      const objects = canvas.getObjects().filter(obj => {
        const data = (obj as ComponentFabricObject).data;
        return data?.type === 'component' && data?.instanceId;
      });

      for (let i = objects.length - 1; i >= 0; i--) {
        const target = objects[i] as ComponentFabricObject;
        if (!target.data?.instanceId) continue;

        const definition = getComponentDefinition(target.data.instanceId);
        if (!definition) continue;

        // Check if this is a pushbutton component
        if (definition.id !== 'pushbutton') continue;

        // Check if click is within component bounds
        const compLeft = target.left || 0;
        const compTop = target.top || 0;
        const scaleX = target.scaleX || 1;
        const scaleY = target.scaleY || 1;

        const localX = (pointer.x - compLeft) / scaleX;
        const localY = (pointer.y - compTop) / scaleY;

        if (localX >= 0 && localX <= definition.width && localY >= 0 && localY <= definition.height) {
          // Button pressed - switch to ON state and re-run simulation
          pressedButtonRef.current = target.data.instanceId;
          setButtonState(target.data.instanceId, true);
          updateComponentImage(target.data.instanceId, 'on');
          mouseEvent.preventDefault();
          return;
        }
      }
    }
  }, [hoveredPin, wireDrawing.isDrawing, wireDrawing.bendPoints, wireDrawing.startX, wireDrawing.startY, startWireDrawing, addWireBendPoint, completeWireDrawing, isSimulating, getComponentDefinition, updateComponentImage, setButtonState, selectWire, selectedWireId, wires, addPendingReference]);

  // Handle mouse up for button release and panning stop
  const handleMouseUpEvent = useCallback((canvas?: fabric.Canvas, mouseEvent?: MouseEvent) => {
    // Stop middle mouse button panning
    if (mouseEvent?.button === 1 || isMiddleMousePanningRef.current) {
      isMiddleMousePanningRef.current = false;
      lastPanPointRef.current = null;
      if (canvas) {
        canvas.selection = true;
        canvas.defaultCursor = 'default';
        canvas.setCursor('default');
      }
    }

    // Release button during simulation
    if (pressedButtonRef.current && isSimulating) {
      setButtonState(pressedButtonRef.current, false);
      updateComponentImage(pressedButtonRef.current, 'off');
      pressedButtonRef.current = null;
    }
  }, [isSimulating, updateComponentImage, setButtonState]);

  // Handle object modified (component movement, wire control point movement)
  const handleObjectModified = useCallback((obj: ComponentFabricObject) => {
    // Handle component movement
    if (obj?.data?.instanceId && obj?.data?.type === 'component') {
      const instanceId = obj.data.instanceId;
      const newX = obj.left || 0;
      const newY = obj.top || 0;

      const componentDef = getComponentDefinition(instanceId);
      const component = placedComponents.find(c => c.instanceId === instanceId);

      // Don't try to snap breadboards or Arduino Uno
      const isBaseComponent = componentDef?.id === 'breadboard' || componentDef?.id === 'arduino-uno';

      if (componentDef && component && !isBaseComponent) {
        // Find breadboards on the canvas
        const breadboards = placedComponents.filter(c => {
          const def = getComponentDefinition(c.instanceId);
          return def?.id === 'breadboard';
        });

        let snapped = false;

        // Try to snap to each breadboard
        for (const breadboard of breadboards) {
          const breadboardDef = getComponentDefinition(breadboard.instanceId);
          if (!breadboardDef) continue;

          const snapResult = calculateSnapPosition(
            { ...component, x: newX, y: newY },
            componentDef,
            breadboard,
            breadboardDef,
            newX,
            newY
          );

          if (snapResult?.success) {
            // Apply snapped position
            updateComponentPosition(instanceId, snapResult.snappedPosition.x, snapResult.snappedPosition.y);

            // Update Fabric object position and refresh coordinates for proper hit detection
            obj.set({
              left: snapResult.snappedPosition.x,
              top: snapResult.snappedPosition.y,
            });
            obj.setCoords();

            // Insert into breadboard and show visual feedback
            insertIntoBreadboard(instanceId, snapResult.breadboardInstanceId, snapResult.insertedPins);
            showInsertionHighlights(snapResult.breadboardInstanceId, snapResult.insertedPins);
            snapped = true;
            break;
          }
        }

        if (!snapped) {
          // No snap - update to drag position
          updateComponentPosition(instanceId, newX, newY);

          // Check if should remove from breadboard
          if (component.parentBreadboardId) {
            const parentBreadboard = placedComponents.find(c => c.instanceId === component.parentBreadboardId);
            const parentBreadboardDef = parentBreadboard ? getComponentDefinition(parentBreadboard.instanceId) : undefined;

            if (parentBreadboard && parentBreadboardDef) {
              if (shouldRemoveFromBreadboard(
                { ...component, x: newX, y: newY },
                componentDef,
                parentBreadboard,
                parentBreadboardDef
              )) {
                removeFromBreadboard(instanceId);
              }
            }
          }
        }
      } else {
        // Base component or no definition - just update position
        updateComponentPosition(instanceId, newX, newY);

        // If this is a breadboard, also update children's Fabric coordinates
        // (their store positions were updated by updateComponentPosition)
        if (isBaseComponent && componentDef?.id === 'breadboard') {
          placedComponents.forEach(child => {
            if (child.parentBreadboardId === instanceId) {
              const childFabric = instanceToFabricMap.current.get(child.instanceId);
              if (childFabric) {
                childFabric.setCoords();
              }
            }
          });
          // Reset breadboard position tracking for next drag
          lastBreadboardPositionRef.current = null;
        }
      }

      // Update the moved object's coordinates for proper hit detection
      obj.setCoords();

      // Re-render to update positions
      fabricCanvasRef.current?.renderAll();
    }

    // Handle wire segment handle movement (commit on drag end)
    if (obj?.data?.type === 'wire-segment-handle') {
      const { wireId, segmentIndex, segmentOrientation } = obj.data;
      if (!wireId || segmentIndex === undefined || !segmentOrientation) return;

      const wire = useCircuitStore.getState().wires.find((w) => w.id === wireId);
      if (!wire) return;

      const startPos = getPinCanvasPosition(wire.startComponentId, wire.startPinId);
      const endPos = getPinCanvasPosition(wire.endComponentId, wire.endPinId);
      if (!startPos || !endPos) return;

      const points = [startPos, ...wire.bendPoints, endPos];
      const newCoord = segmentOrientation === 'h' ? (obj.top || 0) : (obj.left || 0);
      const newPoints = applySegmentShift(points, segmentIndex, segmentOrientation, newCoord);
      const newBendPoints = newPoints.slice(1, -1);

      useCircuitStore.getState().updateWire(wireId, { bendPoints: newBendPoints });
    }
  }, [updateComponentPosition, findNearestPin, getComponentDefinition, placedComponents, insertIntoBreadboard, removeFromBreadboard, showInsertionHighlights, getPinCanvasPosition]);

  // Track last position for delta calculation during breadboard drag
  const lastBreadboardPositionRef = useRef<{ id: string; x: number; y: number } | null>(null);

  // Handle object moving (real-time updates during drag)
  const handleObjectMoving = useCallback((obj: ComponentFabricObject) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    // Handle breadboard movement - move children in real-time
    if (obj?.data?.type === 'component' && obj?.data?.instanceId) {
      const definition = getComponentDefinition(obj.data.instanceId);
      if (definition?.id === 'breadboard') {
        const currentX = obj.left || 0;
        const currentY = obj.top || 0;

        // Get last position or use current if first move
        const last = lastBreadboardPositionRef.current;
        if (last && last.id === obj.data.instanceId) {
          const deltaX = currentX - last.x;
          const deltaY = currentY - last.y;

          // Skip if delta is too large (likely a new drag started, not a continuation)
          // This prevents jumps when starting a new drag from a different position
          if (Math.abs(deltaX) > 100 || Math.abs(deltaY) > 100) {
            lastBreadboardPositionRef.current = { id: obj.data.instanceId, x: currentX, y: currentY };
            return;
          }

          // Move all children visually
          placedComponents.forEach(child => {
            if (child.parentBreadboardId === obj.data?.instanceId) {
              const childFabric = instanceToFabricMap.current.get(child.instanceId);
              if (childFabric) {
                childFabric.set({
                  left: (childFabric.left || 0) + deltaX,
                  top: (childFabric.top || 0) + deltaY,
                });
                // Mark as dirty to ensure proper rendering
                childFabric.setCoords();
              }
            }
          });
        }

        // Update last position
        lastBreadboardPositionRef.current = { id: obj.data.instanceId, x: currentX, y: currentY };
      }
    }

    // Handle wire segment handles (real-time path preview during drag)
    if (obj?.data?.type !== 'wire-segment-handle') return;

    const { wireId, segmentIndex, segmentOrientation } = obj.data;
    if (!wireId || segmentIndex === undefined || !segmentOrientation) return;

    // canvas already defined at the start of this function
    if (!canvas) return;

    const wire = useCircuitStore.getState().wires.find(w => w.id === wireId);
    if (!wire) return;

    // Get current positions for start and end from pins
    const startPos = getPinCanvasPosition(wire.startComponentId, wire.startPinId);
    const endPos = getPinCanvasPosition(wire.endComponentId, wire.endPinId);
    if (!startPos || !endPos) return;

    const basePoints = [startPos, ...wire.bendPoints, endPos];
    const newCoord = segmentOrientation === 'h' ? (obj.top || 0) : (obj.left || 0);
    const points = applySegmentShift(basePoints, segmentIndex, segmentOrientation, newCoord);

    // Create new path string
    const pathString = points.length > 2
      ? createRoundedPath(points, 12)
      : `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;

    // Update the wire path directly on canvas
    const wirePath = wireToFabricMap.current.get(wireId);
    if (wirePath) {
      // Remove old path and create new one (Fabric path updates are problematic)
      canvas.remove(wirePath);

      const newPath = new fabric.Path(pathString, {
        stroke: wire.color,
        strokeWidth: 6,
        fill: 'transparent',
        strokeLineCap: 'round',
        strokeLineJoin: 'round',
        selectable: false,
        evented: true,
        hasControls: false,
        hasBorders: false,
        data: { type: 'wire', wireId: wire.id, points },
      });

      canvas.add(newPath);
      wireToFabricMap.current.set(wireId, newPath);
    }

    // Update the wire outline if selected
    if (selectedWireId === wireId) {
      // Remove old outline
      const outlines = canvas.getObjects().filter(o => {
        const data = (o as ComponentFabricObject).data;
        return data?.type === 'wire-outline' && data?.wireId === wireId;
      });
      outlines.forEach(o => canvas.remove(o));

      // Create new outline
      const outlinePath = new fabric.Path(pathString, {
        stroke: '#1a73e8',
        strokeWidth: 14,
        fill: 'transparent',
        strokeLineCap: 'round',
        strokeLineJoin: 'round',
        selectable: false,
        evented: false,
        hasControls: false,
        hasBorders: false,
        data: { type: 'wire-outline', wireId },
      });
      canvas.add(outlinePath);
      canvas.sendObjectToBack(outlinePath);
    }

    // Bring control points to front
    wireControlPointsRef.current.forEach(cp => {
      canvas.bringObjectToFront(cp);
    });

    canvas.renderAll();
  }, [getPinCanvasPosition, selectedWireId, getComponentDefinition, placedComponents]);

  // Keep handler refs updated to avoid stale closures
  useEffect(() => {
    handleMouseMoveRef.current = handleMouseMoveEvent;
  }, [handleMouseMoveEvent]);

  useEffect(() => {
    handleMouseDownRef.current = handleMouseDownEvent;
  }, [handleMouseDownEvent]);

  useEffect(() => {
    handleMouseUpRef.current = handleMouseUpEvent;
  }, [handleMouseUpEvent]);

  useEffect(() => {
    handleObjectMovingRef.current = handleObjectMoving;
  }, [handleObjectMoving]);

  useEffect(() => {
    handleObjectModifiedRef.current = handleObjectModified;
  }, [handleObjectModified]);

  // Sync store with canvas (handles deletions and undo/restore of components)
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const storeInstanceIds = new Set(placedComponents.map(c => c.instanceId));
    const canvasInstanceIds = new Set(instanceToFabricMap.current.keys());

    // Find Fabric objects that no longer exist in store and remove them
    instanceToFabricMap.current.forEach((fabricObj, instanceId) => {
      if (!storeInstanceIds.has(instanceId)) {
        canvas.remove(fabricObj);
        instanceToFabricMap.current.delete(instanceId);
      }
    });

    // Find components in store that don't have Fabric objects (for undo/restore)
    placedComponents.forEach(component => {
      if (!canvasInstanceIds.has(component.instanceId)) {
        // Skip if this component is currently being loaded by createComponentWithImage
        // This prevents duplicate Fabric objects from being created
        if (pendingLoadsRef.current.has(component.instanceId)) {
          return;
        }

        const definition = getComponentDefinition(component.instanceId);
        if (!definition) return;

        // Mark as pending to prevent concurrent loads
        pendingLoadsRef.current.add(component.instanceId);

        // Load and create the Fabric object
        const imageUrl = `${import.meta.env.BASE_URL}components/${definition.category}/${component.currentImage || definition.image}`;
        const img = new Image();
        img.crossOrigin = 'anonymous';

        img.onload = () => {
          // Remove from pending loads
          pendingLoadsRef.current.delete(component.instanceId);

          // Double-check we haven't created this object in the meantime
          if (instanceToFabricMap.current.has(component.instanceId)) {
            return;
          }

          const fabricImg = new fabric.FabricImage(img, {
            left: component.x,
            top: component.y,
            originX: 'left',
            originY: 'top',
            hasControls: false,
            lockScalingX: true,
            lockScalingY: true,
            hasBorders: true,
            angle: component.rotation,
            flipX: component.flipX || false,
            flipY: component.flipY || false,
          });

          (fabricImg as ComponentFabricObject).data = {
            type: 'component',
            instanceId: component.instanceId,
            definitionId: definition.id,
          };

          // Breadboard and Arduino Uno should always stay at the lowest layer
          const isBaseComponent = definition.id === 'breadboard' || definition.id === 'arduino-uno';

          canvas.add(fabricImg);
          if (isBaseComponent) {
            canvas.sendObjectToBack(fabricImg);
          }

          instanceToFabricMap.current.set(component.instanceId, fabricImg);
          canvas.renderAll();
        };

        img.onerror = () => {
          // Remove from pending loads on error
          pendingLoadsRef.current.delete(component.instanceId);
        };

        img.src = imageUrl;
      } else {
        // Update position of existing Fabric objects to match store (for undo position changes)
        // Skip during active drag to prevent interference with Fabric.js's built-in drag handling
        if (!isDraggingRef.current) {
          const fabricObj = instanceToFabricMap.current.get(component.instanceId);
          if (fabricObj) {
            fabricObj.set({
              left: component.x,
              top: component.y,
              angle: component.rotation,
              flipX: component.flipX || false,
              flipY: component.flipY || false,
            });
          }
        }
      }
    });

    // Only render if not dragging (drag rendering is handled by Fabric.js)
    if (!isDraggingRef.current) {
      canvas.renderAll();
    }
  }, [placedComponents, getComponentDefinition]);

  // Render wires from store
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const storeWireIds = new Set(wires.map(w => w.id));

    // Remove ALL existing wire outlines first (they will be recreated if needed)
    // This ensures outlines stay in sync when wires are deleted or updated
    const outlines = canvas.getObjects().filter(obj => {
      const data = (obj as ComponentFabricObject).data;
      return data?.type === 'wire-outline';
    });
    outlines.forEach(outline => canvas.remove(outline));

    // Remove wires that no longer exist in store
    wireToFabricMap.current.forEach((fabricPath, wireId) => {
      if (!storeWireIds.has(wireId)) {
        canvas.remove(fabricPath);
        wireToFabricMap.current.delete(wireId);
        delete wirePathStringsRef.current[wireId];
      }
    });

    // Add or update wires
    wires.forEach(wire => {
      const startPos = getPinCanvasPosition(wire.startComponentId, wire.startPinId);
      const endPos = getPinCanvasPosition(wire.endComponentId, wire.endPinId);

      if (!startPos || !endPos) return;

      // Build points array: start -> bendPoints -> end
      const points = [
        startPos,
        ...wire.bendPoints,
        endPos,
      ];

      // Create path string
      const pathString = points.length > 2
        ? createRoundedPath(points, 12)
        : `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;

      // Cache path string for the animation overlay (scene coordinates)
      wirePathStringsRef.current[wire.id] = pathString;

      const existingPath = wireToFabricMap.current.get(wire.id);

      // Always remove and recreate path (Fabric.js path updates can be problematic)
      if (existingPath) {
        canvas.remove(existingPath);
      }

      // Check if this wire has an error during simulation
      const wireError = isSimulating
        ? simulationErrors.find(e => e.wireId === wire.id)
        : null;
      const hasError = !!wireError;

      // Check if this wire is selected
      const isSelected = selectedWireId === wire.id;

      // If selected, add a highlight outline underneath
      if (isSelected) {
        const outlinePath = new fabric.Path(pathString, {
          stroke: '#1a73e8',  // Blue selection outline
          strokeWidth: 14,    // Wider than the wire
          fill: 'transparent',
          strokeLineCap: 'round',
          strokeLineJoin: 'round',
          selectable: false,
          evented: false,
          hasControls: false,
          hasBorders: false,
          data: { type: 'wire-outline', wireId: wire.id },
        });
        canvas.add(outlinePath);
      }

      // Create the main wire path
      const path = new fabric.Path(pathString, {
        stroke: hasError ? '#ef4444' : wire.color,  // Red if error
        strokeWidth: hasError ? 8 : 6,
        fill: 'transparent',
        strokeLineCap: 'round',
        strokeLineJoin: 'round',
        strokeDashArray: hasError ? [10, 5] : undefined,  // Dashed if error, solid otherwise
        // Custom selection - don't use Fabric's native selection UI
        selectable: false,  // We handle selection manually
        evented: true,      // But still receive mouse events
        hasControls: false,
        hasBorders: false,
        data: { type: 'wire', wireId: wire.id, error: wireError, points },
      });

      canvas.add(path);
      wireToFabricMap.current.set(wire.id, path);
    });

    canvas.renderAll();
  }, [wires, placedComponents, getPinCanvasPosition, isSimulating, simulationErrors, selectedWireId]);

  // ── Design-mode animation trigger ─────────────────────────────────────────
  // Fires when wires are added / removed (not during simulation).
  // Uses placedComponents / wires / definitionsMap from the current render closure.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (isSimulating) return;
    const powerPins = findAllPowerPins(placedComponents, definitionsMap);
    for (const pp of powerPins) {
      const hasWire = wires.some(
        w =>
          (w.startComponentId === pp.componentId && w.startPinId === pp.pinId) ||
          (w.endComponentId === pp.componentId && w.endPinId === pp.pinId)
      );
      if (!hasWire) continue;
      const path = tracePowerPath(
        pp.componentId,
        pp.pinId,
        placedComponents,
        definitionsMap,
        wires
      );
      if (path.wireIds.length > 0) {
        setAnimPath(path);
        setAnimLooping(false);
        break;
      }
    }
  }, [wires.length]); // intentionally omit other deps – we want to trigger only on wire count change

  // ── Simulation-mode animation trigger ─────────────────────────────────────
  // Reruns whenever simulation starts/stops OR a button is pressed/released.
  // buttonStates is a new Map reference on every press (immer), so it works as dep.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!isSimulating) {
      setAnimPath(null);
      return;
    }
    const powerPins = findAllPowerPins(placedComponents, definitionsMap);
    for (const pp of powerPins) {
      const path = tracePowerPath(
        pp.componentId,
        pp.pinId,
        placedComponents,
        definitionsMap,
        wires,
        buttonStates
      );
      if (path.wireIds.length > 0) {
        setAnimPath(path);
        setAnimLooping(true);
        break;
      }
    }
  }, [isSimulating, buttonStates]); // buttonStates dep re-traces when button pressed

  // Render wire segment handles when a wire is selected
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    // Remove existing handles
    wireControlPointsRef.current.forEach(obj => canvas.remove(obj));
    wireControlPointsRef.current = [];

    // If no wire is selected, we're done
    if (!selectedWireId) {
      canvas.renderAll();
      return;
    }

    // Find the selected wire
    const selectedWire = wires.find(w => w.id === selectedWireId);
    if (!selectedWire) {
      canvas.renderAll();
      return;
    }

    // Get the wire points
    const startPos = getPinCanvasPosition(selectedWire.startComponentId, selectedWire.startPinId);
    const endPos = getPinCanvasPosition(selectedWire.endComponentId, selectedWire.endPinId);

    if (!startPos || !endPos) {
      canvas.renderAll();
      return;
    }

    const allPoints = [startPos, ...selectedWire.bendPoints, endPos];

    // Create draggable handles for each axis-aligned segment.
    // Horizontal segment -> can drag vertically (Y).
    // Vertical segment -> can drag horizontally (X).
    for (let i = 0; i < allPoints.length - 1; i++) {
      const a = allPoints[i];
      const b = allPoints[i + 1];
      const isH = Math.abs(a.y - b.y) < 0.001;
      const isV = Math.abs(a.x - b.x) < 0.001;
      if (!isH && !isV) continue;

      const midX = (a.x + b.x) / 2;
      const midY = (a.y + b.y) / 2;
      const size = 10;

      const handle = new fabric.Rect({
        left: midX,
        top: midY,
        width: size,
        height: size,
        rx: 3,
        ry: 3,
        fill: '#ffffff',
        stroke: '#1a73e8',
        strokeWidth: 2,
        originX: 'center',
        originY: 'center',
        selectable: true,
        evented: true,
        hasControls: false,
        hasBorders: false,
        lockMovementX: isH, // horizontal segment -> lock X, allow Y
        lockMovementY: isV, // vertical segment -> lock Y, allow X
        hoverCursor: isH ? 'ns-resize' : 'ew-resize',
        data: {
          type: 'wire-segment-handle',
          wireId: selectedWireId,
          segmentIndex: i,
          segmentOrientation: isH ? 'h' : 'v',
        },
      });

      canvas.add(handle);
      canvas.bringObjectToFront(handle);
      wireControlPointsRef.current.push(handle);
    }

    canvas.renderAll();
  }, [selectedWireId, wires, getPinCanvasPosition]);

  // Render wire preview during drawing
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    if (wireDrawing.isDrawing) {
      // Throttle route computations to animation frames (A* can be non-trivial).
      if (routeRafRef.current) {
        cancelAnimationFrame(routeRafRef.current);
      }

      routeRafRef.current = requestAnimationFrame(() => {
        routeRafRef.current = null;

        const start: RouterPoint = { x: wireDrawing.startX, y: wireDrawing.startY };
        const end: RouterPoint = { x: wireDrawing.currentX, y: wireDrawing.currentY };
        const anchors: RouterPoint[] = [start, ...wireDrawing.bendPoints, end];

        const ctx = routeContextRef.current;
        // Only use endRect for obstacle components (Arduino UNO) to compute exit points.
        // For other components, wires can end directly at the pin without detours.
        let endRect: RouterRect | undefined;
        if (hoveredPin?.componentId) {
          const endDef = getComponentDefinition(hoveredPin.componentId);
          if (endDef?.id === 'arduino-uno') {
            endRect = ctx?.componentRects.get(hoveredPin.componentId);
          }
        }
        const startRect = ctx?.startRect;
        const obstacles = ctx?.obstacles ?? [];

        const routedPoints: RouterPoint[] = [];
        for (let i = 0; i < anchors.length - 1; i++) {
          const segStart = anchors[i];
          const segEnd = anchors[i + 1];
          const segment =
            routeOrthogonalManhattan({
              start: segStart,
              end: segEnd,
              obstacles,
              startRect: i === 0 ? startRect : undefined,
              endRect: i === anchors.length - 2 ? endRect : undefined,
              gridSize: DEFAULT_ROUTE_GRID_SIZE,
              clearance: DEFAULT_ROUTE_CLEARANCE,
            }) ?? fallbackOrthogonal(segStart, segEnd);

          if (i === 0) routedPoints.push(...segment);
          else routedPoints.push(...segment.slice(1));
        }

        const points = simplifyCollinearPoints(dedupeConsecutivePoints(routedPoints));
        const bendPoints = points.slice(1, -1);
        previewRoutedPointsRef.current = { points, bendPoints };

        const pathString =
          points.length > 2
            ? createRoundedPath(points, 12)
            : `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;

        // Remove old preview and create new one (Fabric.js path updates can be problematic)
        if (wirePreviewRef.current) {
          canvas.remove(wirePreviewRef.current);
        }

        // Create new preview path
        const previewPath = new fabric.Path(pathString, {
          stroke: wireDrawing.color,
          strokeWidth: 6,
          fill: 'transparent',
          strokeLineCap: 'round',
          strokeLineJoin: 'round',
          selectable: false,
          evented: false,
          data: { type: 'wire-preview', points },
        });

        canvas.add(previewPath);
        canvas.bringObjectToFront(previewPath);
        wirePreviewRef.current = previewPath;
        canvas.renderAll();
      });
    } else {
      // Remove preview when not drawing
      if (wirePreviewRef.current) {
        canvas.remove(wirePreviewRef.current);
        wirePreviewRef.current = null;
        previewRoutedPointsRef.current = null;
        canvas.renderAll();
      }
    }
  }, [wireDrawing, hoveredPin?.componentId]);

  // Render highlight overlays for AI-identified issues
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    // Remove existing highlight objects
    highlightObjectsRef.current.forEach(obj => {
      canvas.remove(obj);
    });
    highlightObjectsRef.current = [];

    if (!highlightedItems || highlightedItems.length === 0) {
      canvas.renderAll();
      return;
    }

    // Color mapping based on severity
    const severityColors: Record<string, { stroke: string; fill: string }> = {
      error: { stroke: '#ef4444', fill: 'rgba(239, 68, 68, 0.15)' },
      warning: { stroke: '#f59e0b', fill: 'rgba(245, 158, 11, 0.15)' },
      suggestion: { stroke: '#22c55e', fill: 'rgba(34, 197, 94, 0.15)' },
      info: { stroke: '#3b82f6', fill: 'rgba(59, 130, 246, 0.15)' },
    };

    for (const item of highlightedItems) {
      const colors = severityColors[item.severity] || severityColors.info;

      if (item.type === 'component') {
        // Find the component's Fabric object
        const fabricObj = instanceToFabricMap.current.get(item.id);
        if (fabricObj) {
          const bounds = fabricObj.getBoundingRect();
          const padding = 8;

          // Create highlight rectangle around component
          const highlight = new fabric.Rect({
            left: bounds.left - padding,
            top: bounds.top - padding,
            width: bounds.width + padding * 2,
            height: bounds.height + padding * 2,
            fill: colors.fill,
            stroke: colors.stroke,
            strokeWidth: 3,
            strokeDashArray: [8, 4],
            rx: 8,
            ry: 8,
            selectable: false,
            evented: false,
            data: { type: 'highlight', itemId: item.id },
          });

          canvas.add(highlight);
          canvas.sendObjectToBack(highlight);
          highlightObjectsRef.current.push(highlight);
        }
      } else if (item.type === 'wire') {
        // Find the wire's Fabric path
        const wirePath = wireToFabricMap.current.get(item.id);
        if (wirePath) {
          // Get the wire's path data
          const wireData = (wirePath as ComponentFabricObject).data;
          if (wireData?.points) {
            const points = wireData.points as { x: number; y: number }[];
            const pathString = points.length > 2
              ? createRoundedPath(points, 12)
              : `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;

            // Create glow/highlight effect behind wire
            const highlightPath = new fabric.Path(pathString, {
              stroke: colors.stroke,
              strokeWidth: 16,
              fill: 'transparent',
              strokeLineCap: 'round',
              strokeLineJoin: 'round',
              opacity: 0.4,
              selectable: false,
              evented: false,
              data: { type: 'highlight', itemId: item.id },
            });

            canvas.add(highlightPath);
            canvas.sendObjectToBack(highlightPath);
            highlightObjectsRef.current.push(highlightPath);
          }
        }
      }
    }

    canvas.renderAll();
  }, [highlightedItems]);

  // Load ghost preview image when click-to-place mode starts
  useEffect(() => {
    if (!clickToPlace.isActive || !clickToPlace.componentId || !clickToPlace.category) {
      setGhostPreviewImage(null);
      setGhostPreviewAnchor({ x: 0, y: 0 });
      setGhostPreviewDimensions({ width: 0, height: 0 });
      return;
    }

    const loadPreview = async () => {
      const definition = await loadComponentByFileName(
        clickToPlace.componentId!,
        clickToPlace.category!
      );
      if (!definition) return;

      // Calculate anchor offset based on pin positions
      // Find the "anchor pin" - the left-most pin that is also near the top, or just the left pin
      let anchorX = definition.width / 2;  // Default to center
      let anchorY = definition.height / 2;

      if (definition.pins && definition.pins.length > 0) {
        // Sort pins by Y position to find the top row, then by X to find left-most
        const sortedPins = [...definition.pins].sort((a, b) => {
          // Group pins that are within 20px of each other vertically
          const yDiff = Math.abs(a.y - b.y);
          if (yDiff < 20) {
            return a.x - b.x;  // Same row, sort by X (left-most first)
          }
          return a.y - b.y;  // Different rows, sort by Y (top-most first)
        });

        // For components like LED where all pins are at the bottom,
        // just use the left-most pin as anchor
        const leftMostPin = definition.pins.reduce((left, pin) =>
          pin.x < left.x ? pin : left, definition.pins[0]);

        // Check if pins are mostly at the bottom (like LED)
        const avgPinY = definition.pins.reduce((sum, p) => sum + p.y, 0) / definition.pins.length;
        const pinsAtBottom = avgPinY > definition.height * 0.6;

        if (pinsAtBottom) {
          // Use left-most pin as anchor (good for LED-like components)
          anchorX = leftMostPin.x;
          anchorY = leftMostPin.y;
        } else {
          // Use top-left pin as anchor (good for ICs, breadboard-spanning components)
          anchorX = sortedPins[0].x;
          anchorY = sortedPins[0].y;
        }
      }

      setGhostPreviewAnchor({ x: anchorX, y: anchorY });
      setGhostPreviewDimensions({ width: definition.width, height: definition.height });

      const imageUrl = `${import.meta.env.BASE_URL}components/${clickToPlace.category}/${definition.image}`;

      // Check cache first
      const cached = imageCache.current.get(imageUrl);
      if (cached) {
        setGhostPreviewImage(cached);
        return;
      }

      // Load new image
      const img = new Image();
      img.onload = () => {
        imageCache.current.set(imageUrl, img);
        setGhostPreviewImage(img);
      };
      img.src = imageUrl;
    };

    loadPreview();
  }, [clickToPlace.isActive, clickToPlace.componentId, clickToPlace.category]);

  // Global mouse listener for click-to-place preview (shows preview everywhere, not just over canvas)
  useEffect(() => {
    if (!clickToPlace.isActive) return;

    const handleGlobalMouseMove = (e: MouseEvent) => {
      // Check if cursor is over the canvas container
      const canvasContainer = canvasContainerRef.current;
      let isOverCanvas = false;
      let sceneX = 0;
      let sceneY = 0;

      if (canvasContainer) {
        const rect = canvasContainer.getBoundingClientRect();
        isOverCanvas = (
          e.clientX >= rect.left &&
          e.clientX <= rect.right &&
          e.clientY >= rect.top &&
          e.clientY <= rect.bottom
        );

        // If over canvas, calculate scene coordinates
        if (isOverCanvas && fabricCanvasRef.current) {
          const canvas = fabricCanvasRef.current;
          const vpt = canvas.viewportTransform || [1, 0, 0, 1, 0, 0];
          // Convert screen to scene coordinates
          sceneX = (e.clientX - rect.left - vpt[4]) / vpt[0];
          sceneY = (e.clientY - rect.top - vpt[5]) / vpt[3];
        }
      }

      // Update preview position with both screen and scene coordinates
      updateClickToPlacePreview(sceneX, sceneY, e.clientX, e.clientY, isOverCanvas);
    };

    // Add listener to document for global tracking
    document.addEventListener('mousemove', handleGlobalMouseMove);
    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
    };
  }, [clickToPlace.isActive, updateClickToPlacePreview]);

  // Load drag preview image when drag starts
  useEffect(() => {
    if (!dragPreview.isActive || !dragPreview.componentId || !dragPreview.category) {
      setDragPreviewImage(null);
      setDragPreviewAnchor({ x: 0, y: 0 });
      setDragPreviewDimensions({ width: 0, height: 0 });
      return;
    }

    const loadPreview = async () => {
      const definition = await loadComponentByFileName(
        dragPreview.componentId!,
        dragPreview.category!
      );
      if (!definition) return;

      // Calculate anchor offset (same logic as click-to-place)
      let anchorX = definition.width / 2;
      let anchorY = definition.height / 2;

      if (definition.pins && definition.pins.length > 0) {
        const sortedPins = [...definition.pins].sort((a, b) => {
          const yDiff = Math.abs(a.y - b.y);
          if (yDiff < 20) {
            return a.x - b.x;
          }
          return a.y - b.y;
        });

        const leftMostPin = definition.pins.reduce((left, pin) =>
          pin.x < left.x ? pin : left, definition.pins[0]);

        const avgPinY = definition.pins.reduce((sum, p) => sum + p.y, 0) / definition.pins.length;
        const pinsAtBottom = avgPinY > definition.height * 0.6;

        if (pinsAtBottom) {
          anchorX = leftMostPin.x;
          anchorY = leftMostPin.y;
        } else {
          anchorX = sortedPins[0].x;
          anchorY = sortedPins[0].y;
        }
      }

      setDragPreviewAnchor({ x: anchorX, y: anchorY });
      setDragPreviewDimensions({ width: definition.width, height: definition.height });

      const imageUrl = `${import.meta.env.BASE_URL}components/${dragPreview.category}/${definition.image}`;

      const cached = imageCache.current.get(imageUrl);
      if (cached) {
        setDragPreviewImage(cached);
        return;
      }

      const img = new Image();
      img.onload = () => {
        imageCache.current.set(imageUrl, img);
        setDragPreviewImage(img);
      };
      img.src = imageUrl;
    };

    loadPreview();
  }, [dragPreview.isActive, dragPreview.componentId, dragPreview.category]);

  // Global drag listener for drag preview position
  useEffect(() => {
    if (!dragPreview.isActive) return;

    const handleGlobalDrag = (e: DragEvent) => {
      const canvasContainer = canvasContainerRef.current;
      let isOverCanvas = false;

      if (canvasContainer) {
        const rect = canvasContainer.getBoundingClientRect();
        isOverCanvas = (
          e.clientX >= rect.left &&
          e.clientX <= rect.right &&
          e.clientY >= rect.top &&
          e.clientY <= rect.bottom
        );
      }

      updateDragPreview(e.clientX, e.clientY, isOverCanvas);
    };

    // Use drag event on document
    document.addEventListener('drag', handleGlobalDrag);
    document.addEventListener('dragover', handleGlobalDrag);
    return () => {
      document.removeEventListener('drag', handleGlobalDrag);
      document.removeEventListener('dragover', handleGlobalDrag);
    };
  }, [dragPreview.isActive, updateDragPreview]);

  // Create component with actual image
  const createComponentWithImage = useCallback(async (
    componentId: string,
    category: string,
    x: number,
    y: number
  ) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) {
      console.error('Canvas not initialized');
      return;
    }

    console.log(`Creating component: ${componentId} in category: ${category}`);

    // Load component definition
    const definition = await loadComponentByFileName(componentId, category);
    if (!definition) {
      console.error(`Failed to load component definition: ${componentId}`);
      // Create fallback with store entry
      const instanceId = addComponent({
        id: componentId,
        name: componentId,
        category: category,
        image: '',
        width: 60,
        height: 60,
        pins: [],
      }, x, y);
      createFallbackComponent(canvas, componentId, x, y, instanceId);
      return;
    }

    console.log(`Loaded definition:`, definition);

    // Get image URL - browsers handle special characters in src attributes
    const imageUrl = `${import.meta.env.BASE_URL}components/${category}/${definition.image}`;
    console.log(`Loading image from: ${imageUrl}`);

    // Add component to store first to get instance ID
    const instanceId = addComponent(definition, x, y);

    // Mark this component as pending load to prevent sync effect from creating duplicate
    pendingLoadsRef.current.add(instanceId);

    // Load the image
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      console.log(`Image loaded successfully: ${imageUrl}`);

      const fabricImg = new fabric.FabricImage(img, {
        left: x,
        top: y,
        originX: 'left',
        originY: 'top',
        hasControls: false,     // No resize handles
        lockScalingX: true,     // Prevent X scaling
        lockScalingY: true,     // Prevent Y scaling
        hasBorders: true,       // Keep selection border visible
      });

      // Set custom data
      (fabricImg as ComponentFabricObject).data = {
        type: 'component',
        instanceId,
        definitionId: definition.id,
      };

      // Components render at native size (no scaling)

      canvas.add(fabricImg);

      // Breadboard and Arduino Uno should always stay at the lowest layer
      const isBaseComponent = definition.id === 'breadboard' || definition.id === 'arduino-uno';
      if (isBaseComponent) {
        canvas.sendObjectToBack(fabricImg);
      }

      canvas.setActiveObject(fabricImg);
      canvas.renderAll();

      // Store mapping
      instanceToFabricMap.current.set(instanceId, fabricImg);
      setComponentDefinition(instanceId, definition);

      // Auto-snap to breadboard if placed near one
      if (!isBaseComponent) {
        const breadboards = placedComponents.filter(c => {
          const def = getComponentDefinition(c.instanceId);
          return def?.id === 'breadboard';
        });

        for (const breadboard of breadboards) {
          const breadboardDef = getComponentDefinition(breadboard.instanceId);
          if (!breadboardDef) continue;

          const tempComponent = {
            instanceId,
            definitionId: definition.id,
            x,
            y,
            rotation: 0,
            state: 'off' as const,
            properties: {},
          };

          const snapResult = calculateSnapPosition(
            tempComponent,
            definition,
            breadboard,
            breadboardDef,
            x,
            y
          );

          if (snapResult?.success) {
            // Apply snapped position
            updateComponentPosition(instanceId, snapResult.snappedPosition.x, snapResult.snappedPosition.y);

            // Update Fabric object position
            fabricImg.set({
              left: snapResult.snappedPosition.x,
              top: snapResult.snappedPosition.y,
            });
            fabricImg.setCoords();

            // Insert into breadboard and show visual feedback
            insertIntoBreadboard(instanceId, snapResult.breadboardInstanceId, snapResult.insertedPins);
            showInsertionHighlights(snapResult.breadboardInstanceId, snapResult.insertedPins);

            canvas.renderAll();
            break;
          }
        }
      }

      // Remove from pending loads
      pendingLoadsRef.current.delete(instanceId);

      // Trigger onboarding for first-time placement of this component type
      if (hasOnboardingImage(definition.id) && !hasShownOnboarding(definition.id)) {
        // Get final position (may have been snapped)
        const finalX = fabricImg.left ?? x;
        const finalY = fabricImg.top ?? y;
        const centerX = finalX + definition.width / 2;
        const centerY = finalY + definition.height / 2;
        showOnboarding(instanceId, definition.id, centerX, centerY);
      }

      onComponentDrop?.(componentId, x, y);
    };

    img.onerror = (err) => {
      console.error(`Failed to load image: ${imageUrl}`, err);
      // Create fallback visual
      createFallbackComponent(canvas, componentId, x, y, instanceId);
      setComponentDefinition(instanceId, definition);
      // Remove from pending loads
      pendingLoadsRef.current.delete(instanceId);
    };

    img.src = imageUrl;
  }, [addComponent, setComponentDefinition, onComponentDrop, placedComponents, getComponentDefinition, updateComponentPosition, insertIntoBreadboard, showInsertionHighlights, hasShownOnboarding, showOnboarding]);

  // Fallback component when image fails to load
  const createFallbackComponent = (
    canvas: fabric.Canvas,
    componentId: string,
    x: number,
    y: number,
    instanceId?: string
  ) => {
    const rect = new fabric.Rect({
      left: x,
      top: y,
      width: 60,
      height: 60,
      fill: '#ddd',
      stroke: '#999',
      strokeWidth: 2,
      rx: 5,
      ry: 5,
    });

    // Set custom data
    (rect as ComponentFabricObject).data = {
      type: 'component',
      componentId,
      instanceId,
    };

    canvas.add(rect);
    canvas.setActiveObject(rect);
    canvas.renderAll();

    if (instanceId) {
      instanceToFabricMap.current.set(instanceId, rect);
    }
  };

  // Handle zoom
  const handleZoomIn = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const newZoom = Math.min(zoom + 0.25, 3);
    canvas.setZoom(newZoom);
    viewportTransformRef.current = canvas.viewportTransform as number[];
    setZoom(newZoom);
    setViewportVersion(v => v + 1);
    canvas.renderAll();
  };

  const handleZoomOut = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const newZoom = Math.max(zoom - 0.25, 0.5);
    canvas.setZoom(newZoom);
    viewportTransformRef.current = canvas.viewportTransform as number[];
    setZoom(newZoom);
    setViewportVersion(v => v + 1);
    canvas.renderAll();
  };

  // Handle delete (component or wire)
  const handleDelete = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    // First check for selected wire (custom selection)
    if (selectedWireId) {
      removeWire(selectedWireId);
      return;
    }

    // Then check for selected component (Fabric selection)
    if (!selectedObject) return;

    const obj = selectedObject as ComponentFabricObject;

    // Check if it's a component
    if (obj.data?.instanceId) {
      removeComponent(obj.data.instanceId);
      instanceToFabricMap.current.delete(obj.data.instanceId);
    }

    canvas.remove(selectedObject);
    setSelectedObject(null);
    canvas.renderAll();
  };

  // Helper to calculate center position of a component on canvas
  const getComponentCenterPosition = useCallback((
    left: number,
    top: number,
    width: number,
    height: number,
    angle: number,
    flipX: boolean,
    flipY: boolean
  ): { x: number; y: number } => {
    let centerOffsetX = width / 2;
    let centerOffsetY = height / 2;
    if (flipX) centerOffsetX = -centerOffsetX;
    if (flipY) centerOffsetY = -centerOffsetY;

    const rad = (angle * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const rotatedOffsetX = centerOffsetX * cos - centerOffsetY * sin;
    const rotatedOffsetY = centerOffsetX * sin + centerOffsetY * cos;

    return {
      x: left + rotatedOffsetX,
      y: top + rotatedOffsetY,
    };
  }, []);

  // Helper to calculate left/top position from center position
  const getLeftTopFromCenter = useCallback((
    centerX: number,
    centerY: number,
    width: number,
    height: number,
    angle: number,
    flipX: boolean,
    flipY: boolean
  ): { left: number; top: number } => {
    let centerOffsetX = width / 2;
    let centerOffsetY = height / 2;
    if (flipX) centerOffsetX = -centerOffsetX;
    if (flipY) centerOffsetY = -centerOffsetY;

    const rad = (angle * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const rotatedOffsetX = centerOffsetX * cos - centerOffsetY * sin;
    const rotatedOffsetY = centerOffsetX * sin + centerOffsetY * cos;

    return {
      left: centerX - rotatedOffsetX,
      top: centerY - rotatedOffsetY,
    };
  }, []);

  // Handle rotate (45 degrees clockwise around component center)
  const handleRotate = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || !selectedObject) return;

    const obj = selectedObject;
    const compObj = obj as ComponentFabricObject;
    if (!compObj.data?.instanceId) return;

    const instanceId = compObj.data.instanceId;
    const definition = getComponentDefinition(instanceId);
    if (!definition) return;

    const currentAngle = obj.angle || 0;
    const deltaAngle = 45;
    const newAngle = (currentAngle + deltaAngle) % 360;
    const currentLeft = obj.left || 0;
    const currentTop = obj.top || 0;
    const flipX = obj.flipX || false;
    const flipY = obj.flipY || false;

    // Calculate center position before rotation
    const center = getComponentCenterPosition(
      currentLeft, currentTop,
      definition.width, definition.height,
      currentAngle, flipX, flipY
    );

    // Calculate new left/top after rotation to keep center in place
    const newPos = getLeftTopFromCenter(
      center.x, center.y,
      definition.width, definition.height,
      newAngle, flipX, flipY
    );

    // Apply changes to Fabric object
    obj.set({
      angle: newAngle,
      left: newPos.left,
      top: newPos.top,
    });
    obj.setCoords();

    // Update store
    const state = useCircuitStore.getState();
    state.updateComponentRotation(instanceId, newAngle);
    state.updateComponentPosition(instanceId, newPos.left, newPos.top);

    // If this is a breadboard, also rotate all inserted children
    if (definition.id === 'breadboard') {
      const children = state.placedComponents.filter(c => c.parentBreadboardId === instanceId);
      const deltaRad = (deltaAngle * Math.PI) / 180;
      const deltaCos = Math.cos(deltaRad);
      const deltaSin = Math.sin(deltaRad);

      for (const child of children) {
        const childDef = getComponentDefinition(child.instanceId);
        if (!childDef) continue;

        const childFabric = instanceToFabricMap.current.get(child.instanceId);
        if (!childFabric) continue;

        // Get child's current center position
        const childCenter = getComponentCenterPosition(
          child.x, child.y,
          childDef.width, childDef.height,
          child.rotation, child.flipX || false, child.flipY || false
        );

        // Calculate child's position relative to breadboard center (before rotation)
        const relX = childCenter.x - center.x;
        const relY = childCenter.y - center.y;

        // Rotate relative position by delta angle
        const newRelX = relX * deltaCos - relY * deltaSin;
        const newRelY = relX * deltaSin + relY * deltaCos;

        // New child center position
        const newChildCenterX = center.x + newRelX;
        const newChildCenterY = center.y + newRelY;

        // New child rotation = old rotation + delta
        const newChildAngle = (child.rotation + deltaAngle) % 360;

        // Calculate new left/top for child
        const newChildPos = getLeftTopFromCenter(
          newChildCenterX, newChildCenterY,
          childDef.width, childDef.height,
          newChildAngle, child.flipX || false, child.flipY || false
        );

        // Update child Fabric object
        childFabric.set({
          angle: newChildAngle,
          left: newChildPos.left,
          top: newChildPos.top,
        });
        childFabric.setCoords();

        // Update child in store
        state.updateComponentRotation(child.instanceId, newChildAngle);
        state.updateComponentPosition(child.instanceId, newChildPos.left, newChildPos.top);
      }
    }

    // Re-snap if component is inserted in a breadboard (not applicable to breadboard itself)
    const component = state.placedComponents.find(c => c.instanceId === instanceId);
    if (component?.parentBreadboardId) {
      const componentDef = getComponentDefinition(instanceId);
      const breadboard = state.placedComponents.find(c => c.instanceId === component.parentBreadboardId);
      const breadboardDef = breadboard ? getComponentDefinition(breadboard.instanceId) : undefined;

      if (componentDef && breadboard && breadboardDef) {
        const tempComponent = {
          ...component,
          x: newPos.left,
          y: newPos.top,
          rotation: newAngle,
        };

        const snapResult = calculateSnapPosition(
          tempComponent,
          componentDef,
          breadboard,
          breadboardDef,
          newPos.left,
          newPos.top
        );

        if (snapResult?.success) {
          obj.set({
            left: snapResult.snappedPosition.x,
            top: snapResult.snappedPosition.y,
          });
          obj.setCoords();
          state.updateComponentPosition(instanceId, snapResult.snappedPosition.x, snapResult.snappedPosition.y);
          state.insertIntoBreadboard(instanceId, snapResult.breadboardInstanceId, snapResult.insertedPins);
        }
      }
    }

    canvas.renderAll();
  };

  // Helper to re-snap component to breadboard after flip
  const reSnapAfterFlip = useCallback((
    instanceId: string,
    obj: ComponentFabricObject,
    newFlipX: boolean,
    newFlipY: boolean
  ) => {
    const component = placedComponents.find(c => c.instanceId === instanceId);
    if (!component?.parentBreadboardId) return; // Not inserted in breadboard

    const componentDef = getComponentDefinition(instanceId);
    const breadboard = placedComponents.find(c => c.instanceId === component.parentBreadboardId);
    const breadboardDef = breadboard ? getComponentDefinition(breadboard.instanceId) : undefined;

    if (!componentDef || !breadboard || !breadboardDef) return;

    // Create a temporary component state with new flip values for snap calculation
    const tempComponent = {
      ...component,
      flipX: newFlipX,
      flipY: newFlipY,
    };

    // Try to snap at current position with new flip state
    const snapResult = calculateSnapPosition(
      tempComponent,
      componentDef,
      breadboard,
      breadboardDef,
      component.x,
      component.y
    );

    if (snapResult?.success) {
      // Update position to snapped position
      obj.set({
        left: snapResult.snappedPosition.x,
        top: snapResult.snappedPosition.y,
      });
      obj.setCoords();

      // Update store with new position and re-insert into breadboard
      updateComponentPosition(instanceId, snapResult.snappedPosition.x, snapResult.snappedPosition.y);
      insertIntoBreadboard(instanceId, snapResult.breadboardInstanceId, snapResult.insertedPins);
      showInsertionHighlights(snapResult.breadboardInstanceId, snapResult.insertedPins);
    }
  }, [placedComponents, getComponentDefinition, updateComponentPosition, insertIntoBreadboard, showInsertionHighlights]);

  // Handle horizontal flip
  const handleFlipHorizontal = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || !selectedObject) return;

    const obj = selectedObject as ComponentFabricObject;
    if (!obj.data?.instanceId) return;

    const instanceId = obj.data.instanceId;
    const definition = getComponentDefinition(instanceId);
    if (!definition) return;

    const flipY = obj.flipY || false;
    const newFlipX = !(obj.flipX || false);

    // Get the visual center using Fabric.js's native method BEFORE flip
    const centerBefore = obj.getCenterPoint();

    // Apply the flip
    obj.set({ flipX: newFlipX });

    // Get center AFTER flip (it will have moved because flip is around origin)
    const centerAfter = obj.getCenterPoint();

    // Calculate delta and adjust position to keep center in place
    const deltaX = centerBefore.x - centerAfter.x;
    const deltaY = centerBefore.y - centerAfter.y;
    const newLeft = (obj.left || 0) + deltaX;
    const newTop = (obj.top || 0) + deltaY;

    obj.set({ left: newLeft, top: newTop });
    obj.setCoords();

    // Persist to store
    const state = useCircuitStore.getState();
    state.updateComponentFlip(instanceId, newFlipX, flipY);
    state.updateComponentPosition(instanceId, newLeft, newTop);

    // If this is a breadboard, also flip all inserted children
    if (definition.id === 'breadboard') {
      const children = state.placedComponents.filter(c => c.parentBreadboardId === instanceId);
      // Use the original center (which is now restored) as the mirror axis
      const breadboardCenter = centerBefore;

      for (const child of children) {
        const childDef = getComponentDefinition(child.instanceId);
        if (!childDef) continue;

        const childFabric = instanceToFabricMap.current.get(child.instanceId);
        if (!childFabric) continue;

        // Get child's current center using Fabric.js
        const childCenterBefore = childFabric.getCenterPoint();

        // Mirror child's center position relative to breadboard center (horizontal = negate X offset)
        const relX = childCenterBefore.x - breadboardCenter.x;
        const relY = childCenterBefore.y - breadboardCenter.y;
        const newChildCenterX = breadboardCenter.x - relX; // Mirror horizontally
        const newChildCenterY = breadboardCenter.y + relY;

        // Toggle child's flipX
        const newChildFlipX = !(childFabric.flipX || false);

        // Apply flip to child
        childFabric.set({ flipX: newChildFlipX });

        // Get center after flip
        const childCenterAfterFlip = childFabric.getCenterPoint();

        // Calculate where the child needs to move to reach the mirrored position
        const childDeltaX = newChildCenterX - childCenterAfterFlip.x;
        const childDeltaY = newChildCenterY - childCenterAfterFlip.y;
        const newChildLeft = (childFabric.left || 0) + childDeltaX;
        const newChildTop = (childFabric.top || 0) + childDeltaY;

        childFabric.set({ left: newChildLeft, top: newChildTop });
        childFabric.setCoords();

        // Update child in store
        state.updateComponentFlip(child.instanceId, newChildFlipX, child.flipY || false);
        state.updateComponentPosition(child.instanceId, newChildLeft, newChildTop);
      }
    } else {
      // Re-snap if inserted in breadboard (for non-breadboard components)
      reSnapAfterFlip(instanceId, obj, newFlipX, flipY);
    }

    canvas.renderAll();
  };

  // Handle vertical flip
  const handleFlipVertical = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || !selectedObject) return;

    const obj = selectedObject as ComponentFabricObject;
    if (!obj.data?.instanceId) return;

    const instanceId = obj.data.instanceId;
    const definition = getComponentDefinition(instanceId);
    if (!definition) return;

    const flipX = obj.flipX || false;
    const newFlipY = !(obj.flipY || false);

    // Get the visual center using Fabric.js's native method BEFORE flip
    const centerBefore = obj.getCenterPoint();

    // Apply the flip
    obj.set({ flipY: newFlipY });

    // Get center AFTER flip (it will have moved because flip is around origin)
    const centerAfter = obj.getCenterPoint();

    // Calculate delta and adjust position to keep center in place
    const deltaX = centerBefore.x - centerAfter.x;
    const deltaY = centerBefore.y - centerAfter.y;
    const newLeft = (obj.left || 0) + deltaX;
    const newTop = (obj.top || 0) + deltaY;

    obj.set({ left: newLeft, top: newTop });
    obj.setCoords();

    // Persist to store
    const state = useCircuitStore.getState();
    state.updateComponentFlip(instanceId, flipX, newFlipY);
    state.updateComponentPosition(instanceId, newLeft, newTop);

    // If this is a breadboard, also flip all inserted children
    if (definition.id === 'breadboard') {
      const children = state.placedComponents.filter(c => c.parentBreadboardId === instanceId);
      // Use the original center (which is now restored) as the mirror axis
      const breadboardCenter = centerBefore;

      for (const child of children) {
        const childDef = getComponentDefinition(child.instanceId);
        if (!childDef) continue;

        const childFabric = instanceToFabricMap.current.get(child.instanceId);
        if (!childFabric) continue;

        // Get child's current center using Fabric.js
        const childCenterBefore = childFabric.getCenterPoint();

        // Mirror child's center position relative to breadboard center (vertical = negate Y offset)
        const relX = childCenterBefore.x - breadboardCenter.x;
        const relY = childCenterBefore.y - breadboardCenter.y;
        const newChildCenterX = breadboardCenter.x + relX;
        const newChildCenterY = breadboardCenter.y - relY; // Mirror vertically

        // Toggle child's flipY
        const newChildFlipY = !(childFabric.flipY || false);

        // Apply flip to child
        childFabric.set({ flipY: newChildFlipY });

        // Get center after flip
        const childCenterAfterFlip = childFabric.getCenterPoint();

        // Calculate where the child needs to move to reach the mirrored position
        const childDeltaX = newChildCenterX - childCenterAfterFlip.x;
        const childDeltaY = newChildCenterY - childCenterAfterFlip.y;
        const newChildLeft = (childFabric.left || 0) + childDeltaX;
        const newChildTop = (childFabric.top || 0) + childDeltaY;

        childFabric.set({ left: newChildLeft, top: newChildTop });
        childFabric.setCoords();

        // Update child in store
        state.updateComponentFlip(child.instanceId, childFabric.flipX || false, newChildFlipY);
        state.updateComponentPosition(child.instanceId, newChildLeft, newChildTop);
      }
    } else {
      // Re-snap if inserted in breadboard (for non-breadboard components)
      reSnapAfterFlip(instanceId, obj, flipX, newFlipY);
    }

    canvas.renderAll();
  };

  // Handle drag and drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const componentId = e.dataTransfer.getData('componentId');
    const category = e.dataTransfer.getData('category') || 'passive';

    console.log('[handleDrop] componentId:', componentId, 'category:', category);

    // End drag preview
    endDragPreview();

    if (!componentId) {
      console.error('[handleDrop] No componentId in drag data');
      return;
    }

    if (!canvasContainerRef.current) {
      console.error('[handleDrop] Canvas container ref is null');
      return;
    }

    const canvas = fabricCanvasRef.current;
    if (!canvas) {
      console.error('[handleDrop] Canvas not initialized');
      return;
    }

    // Get container position
    const rect = canvasContainerRef.current.getBoundingClientRect();

    // Convert screen coordinates to canvas coordinates
    // Account for both zoom and pan (viewport transform)
    const vpt = canvas.viewportTransform || [1, 0, 0, 1, 0, 0];
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    // Apply inverse viewport transform to get scene coordinates
    const cursorX = (screenX - vpt[4]) / vpt[0];
    const cursorY = (screenY - vpt[5]) / vpt[3];

    // Apply anchor offset so the anchor pin is at cursor position
    const x = cursorX - dragPreviewAnchor.x;
    const y = cursorY - dragPreviewAnchor.y;

    console.log('[handleDrop] Dropping at position:', x, y, 'with anchor offset:', dragPreviewAnchor);

    // Mark that we're dropping from library (to skip adding chat references)
    isDroppingFromLibraryRef.current = true;
    createComponentWithImage(componentId, category, x, y);

    // Notify onboarding that component was dropped
    if (isOnboardingActive && onboardingPhase === 'component-clicked') {
      onComponentDropped();
    }

    // Clear the flag after a short delay to allow selection events to fire
    setTimeout(() => {
      isDroppingFromLibraryRef.current = false;
    }, 100);
  };

  // Handle escape to cancel wire drawing
  // Handle global mouseup for button release and pan stop (in case mouse leaves canvas)
  useEffect(() => {
    const handleGlobalMouseUp = (e: MouseEvent) => {
      // Stop middle mouse panning
      if (e.button === 1 || isMiddleMousePanningRef.current) {
        isMiddleMousePanningRef.current = false;
        lastPanPointRef.current = null;
        const canvas = fabricCanvasRef.current;
        if (canvas) {
          canvas.selection = true;
          canvas.defaultCursor = 'default';
          canvas.setCursor('default');
        }
      }

      // Release button during simulation
      if (pressedButtonRef.current) {
        setButtonState(pressedButtonRef.current, false);
        updateComponentImage(pressedButtonRef.current, 'off');
        pressedButtonRef.current = null;
      }
    };

    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [updateComponentImage, setButtonState]);

  // Reset buttons when simulation stops
  useEffect(() => {
    if (!isSimulating && pressedButtonRef.current) {
      // Simulation stopped while button was pressed - reset it
      updateComponentImage(pressedButtonRef.current, 'off');
      pressedButtonRef.current = null;
    }
  }, [isSimulating, updateComponentImage]);

  // Update component images based on simulation state
  useEffect(() => {
    // Update all component images based on their state
    placedComponents.forEach(component => {
      const definition = getComponentDefinition(component.instanceId);
      if (!definition?.variants) return;

      // When simulation is running, use the component's current state
      // When simulation stops, reset all to 'off'
      const targetState = isSimulating ? component.state : 'off';
      updateComponentImage(component.instanceId, targetState);
    });
  }, [isSimulating, placedComponents, getComponentDefinition, updateComponentImage]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        isShiftHeldRef.current = true;
      }

      // Escape key: cancel click-to-place, wire drawing, or deselect wire
      if (e.key === 'Escape') {
        if (clickToPlace.isActive) {
          cancelClickToPlace();
          e.preventDefault();
          return;
        }
        if (wireDrawing.isDrawing) {
          cancelWireDrawing();
        } else if (selectedWireId) {
          selectWire(null);
        }
      }

      // Delete or Backspace: during wire drawing, remove last node; otherwise delete selected wire/component
      // Skip if chat input is focused (let the chat input handle these keys)
      if (e.key === 'Delete' || e.key === 'Backspace') {
        // Check if chat input is focused - get fresh value from store
        const chatInputFocused = useCircuitStore.getState().chatInput.isInputFocused;
        if (chatInputFocused) {
          // Let the chat input handle backspace/delete
          return;
        }

        // During wire drawing, remove the last bend point or cancel the wire
        if (wireDrawing.isDrawing) {
          e.preventDefault();
          const hadPoints = removeLastWireBendPoint();
          if (!hadPoints) {
            // No bend points left, cancel the entire wire
            cancelWireDrawing();
          }
          return;
        }

        // First check for selected wire
        if (selectedWireId) {
          removeWire(selectedWireId);
          e.preventDefault();
          return;
        }
        // Then check for selected component
        if (selectedObject) {
          handleDelete();
        }
      }

      // Ctrl+Z: Undo
      if (e.key === 'z' && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
        e.preventDefault();
        if (canUndo()) {
          undo();
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        isShiftHeldRef.current = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [wireDrawing.isDrawing, cancelWireDrawing, removeLastWireBendPoint, selectedObject, selectedWireId, selectWire, removeWire, undo, canUndo, clickToPlace.isActive, cancelClickToPlace]);

  return (
    <div className="circuit-canvas-container">
      {/* Canvas Area */}
      <div
        ref={canvasContainerRef}
        className={`canvas-area ${isDragOver ? 'drag-over' : ''} ${wireDrawing.isDrawing ? 'wire-drawing' : ''} ${clickToPlace.isActive ? 'click-to-place' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <canvas ref={canvasRef} />

        {/* Floating Toolbar */}
        <div className="canvas-toolbar">
          <div className="toolbar-group">
            <button onClick={handleZoomOut} title="Zoom Out">
              <ZoomOut size={18} />
            </button>
            <span className="zoom-level">{Math.round(zoom * 100)}%</span>
            <button onClick={handleZoomIn} title="Zoom In">
              <ZoomIn size={18} />
            </button>
            <button
              onClick={() => canUndo() && undo()}
              disabled={!canUndo()}
              title="Undo (Ctrl+Z)"
              className={!canUndo() ? 'disabled' : ''}
            >
              <Undo2 size={18} />
            </button>
          </div>
          <div className="toolbar-divider" />
          <div className="toolbar-group">
            <button
              onClick={() => setIsPanning(!isPanning)}
              className={isPanning ? 'active' : ''}
              title="Pan Mode"
            >
              <Move size={18} />
            </button>
          </div>
          <div className="toolbar-divider" />
          <div className="toolbar-group wire-colors">
            <span className="toolbar-label-text">Wire:</span>
            {['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#666666'].map(color => {
              // Show selected wire's color as active, or drawing color if no wire selected
              const isActive = selectedWire ? selectedWire.color === color : wireDrawing.color === color;
              return (
                <button
                  key={color}
                  className={`color-btn ${isActive ? 'active' : ''}`}
                  style={{ backgroundColor: color }}
                  onClick={() => {
                    // If a wire is selected, update its color
                    if (selectedWireId) {
                      updateWire(selectedWireId, { color });
                    }
                    // Always set the drawing color for future wires
                    setWireDrawingColor(color);
                  }}
                  title={selectedWireId ? `Change wire color to ${color}` : `Wire color: ${color}`}
                />
              );
            })}
          </div>
          <div className="toolbar-divider" />
          <div className="toolbar-group">
            <button
              onClick={handleRotate}
              title="Rotate 45°"
              disabled={!selectedObject}
            >
              <RotateCw size={18} />
            </button>
            <button
              onClick={handleFlipHorizontal}
              title="Flip Horizontal"
              disabled={!selectedObject}
            >
              <FlipHorizontal size={18} />
            </button>
            <button
              onClick={handleFlipVertical}
              title="Flip Vertical"
              disabled={!selectedObject}
            >
              <FlipVertical size={18} />
            </button>
          </div>
          <div className="toolbar-divider" />
          <div className="toolbar-group">
            <button
              onClick={handleDelete}
              title="Delete Selected"
              disabled={!selectedObject && !selectedWireId}
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>

        {/* Pin Highlight Square and Tooltip - hidden when wire is selected */}
        {hoveredPin && !selectedWireId && (() => {
          // Convert scene coordinates to screen coordinates
          const canvas = fabricCanvasRef.current;
          const vpt = canvas?.viewportTransform || [1, 0, 0, 1, 0, 0];
          const screenX = hoveredPin.canvasX * vpt[0] + vpt[4];
          const screenY = hoveredPin.canvasY * vpt[3] + vpt[5];
          // Highlight size scales with zoom
          const highlightSize = 20 * vpt[0];
          // Position label 20px above the highlight square (scaled with zoom)
          const labelOffsetY = (10 + 20) * vpt[0]; // half highlight + spacing

          // Check if this is an LED component for polarity indicators
          const definition = getComponentDefinition(hoveredPin.componentId);
          const isLED = definition?.id?.toLowerCase().includes('led') ||
                        definition?.category?.toLowerCase() === 'leds';

          // Check if this is a breadboard component
          const isBreadboard = definition?.id === 'breadboard';

          // Get all net-connected pins (for breadboard internal connections)
          const netConnectedPins = (hoveredPin.pin.net && definition)
            ? definition.pins.filter(p => p.net === hoveredPin.pin.net)
            : [hoveredPin.pin];

          // Build label with optional polarity indicator
          let pinLabel = hoveredPin.pin.id;
          if (isLED) {
            if (hoveredPin.pin.id.toUpperCase() === 'ANODE' || hoveredPin.pin.type === 'power') {
              pinLabel = `${hoveredPin.pin.id} (+)`;
            } else if (hoveredPin.pin.id.toUpperCase() === 'CATHODE' || hoveredPin.pin.type === 'ground') {
              pinLabel = `${hoveredPin.pin.id} (–)`;
            }
          }

          return (
            <>
              {/* Render highlights for all net-connected pins */}
              {netConnectedPins.map(pin => {
                const pinPos = getPinCanvasPosition(hoveredPin.componentId, pin.id);
                if (!pinPos) return null;

                const pinScreenX = pinPos.x * vpt[0] + vpt[4];
                const pinScreenY = pinPos.y * vpt[3] + vpt[5];

                // The actively hovered pin uses full-opacity blue style
                // Other connected pins (same net) use reduced opacity for visual hierarchy
                const isActivePin = pin.id === hoveredPin.pin.id;
                const useNetStyle = isBreadboard && !isActivePin;

                return (
                  <div
                    key={pin.id}
                    className={`pin-highlight ${useNetStyle ? 'pin-highlight-net' : ''}`}
                    style={{
                      left: pinScreenX,
                      top: pinScreenY,
                      width: highlightSize,
                      height: highlightSize,
                      transform: 'translate(-50%, -50%)',
                    }}
                  />
                );
              })}
              {/* Pin Label - hidden for breadboard components */}
              {!isBreadboard && (
                <div
                  className="pin-tooltip pin-tooltip-minimal"
                  style={{
                    left: screenX,
                    top: screenY - labelOffsetY,
                    transform: 'translate(-50%, -100%)',
                  }}
                >
                  {pinLabel}
                </div>
              )}
            </>
          );
        })()}

        {/* Wire Error Tooltip */}
        {hoveredWireError && wireErrorPosition && (
          <div
            className="wire-error-tooltip"
            style={{
              left: wireErrorPosition.x,
              top: wireErrorPosition.y - 40,
              transform: 'translateX(-50%)',
            }}
          >
            {hoveredWireError.message}
          </div>
        )}

        {/* Wire Drawing Indicator */}
        {wireDrawing.isDrawing && (
          <div className="wire-drawing-indicator">
            Click another pin to complete the wire, or press Escape to cancel
          </div>
        )}

        {/* Insertion Highlights - shown briefly when components snap to breadboard */}
        {insertionHighlights.length > 0 && (() => {
          const canvas = fabricCanvasRef.current;
          if (!canvas) return null;
          const vpt = canvas.viewportTransform || [1, 0, 0, 1, 0, 0];
          // Use same highlight size as hover highlight: 20 * zoom
          const highlightSize = 20 * vpt[0];

          return insertionHighlights.map(highlight => {
            // Use getPinCanvasPosition to get accurate pin coordinates (same as hover logic)
            const pinPos = getPinCanvasPosition(highlight.breadboardInstanceId, highlight.pinId);
            if (!pinPos) return null;

            const screenX = pinPos.x * vpt[0] + vpt[4];
            const screenY = pinPos.y * vpt[3] + vpt[5];

            return (
              <div
                key={`${highlight.breadboardInstanceId}-${highlight.pinId}`}
                className="pin-highlight pin-highlight-insertion"
                style={{
                  left: screenX,
                  top: screenY,
                  width: highlightSize,
                  height: highlightSize,
                  transform: 'translate(-50%, -50%)',
                }}
              />
            );
          });
        })()}

        {isDragOver && (
          <div className="drop-indicator">
            <span>Drop component here</span>
          </div>
        )}

        {/* Ghost preview for click-to-place - rendered via portal at document body */}
        {clickToPlace.isActive && ghostPreviewImage && clickToPlace.screenX > 0 && (
          <GhostPreview
            image={ghostPreviewImage}
            screenX={clickToPlace.screenX}
            screenY={clickToPlace.screenY}
            anchorOffsetX={ghostPreviewAnchor.x}
            anchorOffsetY={ghostPreviewAnchor.y}
            isOverCanvas={clickToPlace.isOverCanvas}
            imageWidth={ghostPreviewDimensions.width}
            imageHeight={ghostPreviewDimensions.height}
          />
        )}

        {/* Ghost preview for drag-and-drop - rendered via portal at document body */}
        {dragPreview.isActive && dragPreviewImage && dragPreview.screenX > 0 && (
          <GhostPreview
            image={dragPreviewImage}
            screenX={dragPreview.screenX}
            screenY={dragPreview.screenY}
            anchorOffsetX={dragPreviewAnchor.x}
            anchorOffsetY={dragPreviewAnchor.y}
            isOverCanvas={dragPreview.isOverCanvas}
            imageWidth={dragPreviewDimensions.width}
            imageHeight={dragPreviewDimensions.height}
          />
        )}

        {/* Click-to-place indicator */}
        {clickToPlace.isActive && (
          <div className="click-to-place-indicator">
            Click to place | ESC to cancel
          </div>
        )}

        {/* Component Onboarding Overlay */}
        {activeOnboarding && (() => {
          const canvas = fabricCanvasRef.current;
          const vpt = canvas?.viewportTransform || [1, 0, 0, 1, 0, 0];

          // Get real-time component position from store
          const component = placedComponents.find(c => c.instanceId === activeOnboarding.instanceId);
          const definition = getComponentDefinition(activeOnboarding.instanceId);

          if (!component || !definition) return null;

          // Calculate current center position
          const centerX = component.x + definition.width / 2;
          const centerY = component.y + definition.height / 2;

          return (
            <ComponentOnboarding
              instanceId={activeOnboarding.instanceId}
              definitionId={activeOnboarding.definitionId}
              centerX={centerX}
              centerY={centerY}
              viewportTransform={vpt}
              onComplete={hideOnboarding}
              manual={activeOnboarding.manual}
            />
          );
        })()}

        {placedComponents.length === 0 && !isDragOver && (
          <div className="canvas-placeholder">
            <p>Drag components from the left panel to build your circuit</p>
          </div>
        )}

        {/* Power-flow animation overlay */}
        {animPath && (
          <CircuitAnimation
            path={animPath}
            viewportTransformRef={viewportTransformRef}
            isLooping={animLooping}
            wirePathStrings={wirePathStringsRef.current}
            onDone={handleAnimDone}
          />
        )}
      </div>
    </div>
  );
}
