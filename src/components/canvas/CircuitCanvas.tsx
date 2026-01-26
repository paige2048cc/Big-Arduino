import { useEffect, useRef, useState, useCallback } from 'react';
import * as fabric from 'fabric';
import { ZoomIn, ZoomOut, Undo2, Trash2, Move, RotateCw, FlipHorizontal, FlipVertical } from 'lucide-react';
import { useCircuitStore, useHoveredPin, useWireDrawing, useWires, useSimulationErrors, useSelectedWire } from '../../store/circuitStore';
import type { CircuitError } from '../../services/circuitSimulator';
import { loadComponentByFileName, getPinAtPosition } from '../../services/componentService';
import { calculateSnapPosition, shouldRemoveFromBreadboard } from '../../services/breadboardSnapping';
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

// Threshold distance for pin snapping (in canvas pixels)
const PIN_SNAP_THRESHOLD = 30;

interface CircuitCanvasProps {
  onComponentDrop?: (componentId: string, x: number, y: number) => void;
  onComponentSelect?: (instanceId: string | null) => void;
}

// Extended FabricObject to include our custom data
interface ComponentFabricObject extends fabric.FabricObject {
  data?: {
    type: 'component' | 'grid' | 'wire' | 'wire-outline' | 'wire-control-point' | 'pin-highlight';
    instanceId?: string;
    definitionId?: string;
    componentId?: string;
    wireId?: string;
    error?: CircuitError;
    points?: { x: number; y: number }[];
    // For wire control points
    pointIndex?: number;
    pointType?: 'start' | 'bend' | 'end';
  };
}

export function CircuitCanvas({ onComponentDrop, onComponentSelect }: CircuitCanvasProps) {
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<fabric.Canvas | null>(null);
  const [zoom, setZoom] = useState(1);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [selectedObject, setSelectedObject] = useState<fabric.FabricObject | null>(null);

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
  } = useCircuitStore();

  const hoveredPin = useHoveredPin();
  const wireDrawing = useWireDrawing();
  const wires = useWires();
  const simulationErrors = useSimulationErrors();
  const selectedWire = useSelectedWire();

  // Hovered wire error for tooltip
  const [hoveredWireError, setHoveredWireError] = useState<CircuitError | null>(null);
  const [wireErrorPosition, setWireErrorPosition] = useState<{ x: number; y: number } | null>(null);

  // Map instanceId to Fabric object
  const instanceToFabricMap = useRef<Map<string, fabric.FabricObject>>(new Map());

  // Map wireId to Fabric path object
  const wireToFabricMap = useRef<Map<string, fabric.Path>>(new Map());

  // Wire control points (circles at endpoints and bends) when wire is selected
  const wireControlPointsRef = useRef<fabric.Circle[]>([]);

  // Wire preview path during drawing
  const wirePreviewRef = useRef<fabric.Path | null>(null);

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

  // Track drag start position for wire control points (for Shift constraint)
  const wireControlPointDragStartRef = useRef<{ x: number; y: number } | null>(null);

  // Track if any object is currently being dragged
  // Used to prevent sync effect from interfering during drag
  const isDraggingRef = useRef(false);

  // Track insertion highlight pins (for visual feedback when components snap to breadboard)
  // Store breadboard instance ID and pin IDs, positions calculated at render time using getPinCanvasPosition
  const [insertionHighlights, setInsertionHighlights] = useState<Array<{
    breadboardInstanceId: string;
    pinId: string;
  }>>([]);
  const insertionHighlightTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Refs for event handlers to avoid stale closures
  const handleMouseMoveRef = useRef<typeof handleMouseMoveEvent>(null!);
  const handleMouseDownRef = useRef<typeof handleMouseDownEvent>(null!);
  const handleMouseUpRef = useRef<typeof handleMouseUpEvent>(null!);
  const handleObjectMovingRef = useRef<(obj: ComponentFabricObject) => void>(null!);
  const handleObjectModifiedRef = useRef<(obj: ComponentFabricObject) => void>(null!);

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

    // Selection handlers (for components - wires use custom selection)
    fabricCanvas.on('selection:created', (e) => {
      const selected = e.selected?.[0] as ComponentFabricObject;
      setSelectedObject(selected || null);
      if (selected?.data?.instanceId) {
        // Component selected
        selectComponent(selected.data.instanceId);
        selectWire(null);
        onComponentSelect?.(selected.data.instanceId);
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
      }
    });

    fabricCanvas.on('selection:cleared', () => {
      setSelectedObject(null);
      selectComponent(null);
      // Don't clear wire selection here - we handle it manually
      onComponentSelect?.(null);
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

      setZoom(newZoom);
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
  }, [wireDrawing.isDrawing]);

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
      }
      return;
    }

    const pointer = scenePoint;

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
        // Complete wire drawing
        completeWireDrawing(hoveredPin.componentId, hoveredPin.pin.id);
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
      return data?.type === 'wire-control-point';
    });

    for (let i = controlPointObjects.length - 1; i >= 0; i--) {
      const target = controlPointObjects[i] as ComponentFabricObject;
      if (!target.data?.wireId) continue;

      // Check if click is on this control point
      if (target.containsPoint(scenePoint)) {
        // Control point clicked - Fabric will handle the drag
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
  }, [hoveredPin, wireDrawing.isDrawing, wireDrawing.bendPoints, wireDrawing.startX, wireDrawing.startY, startWireDrawing, addWireBendPoint, completeWireDrawing, isSimulating, getComponentDefinition, updateComponentImage, setButtonState, selectWire, selectedWireId]);

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

    // Handle wire control point movement
    if (obj?.data?.type === 'wire-control-point') {
      const { wireId, pointIndex, pointType } = obj.data;
      if (!wireId || pointIndex === undefined) return;

      const wire = useCircuitStore.getState().wires.find(w => w.id === wireId);
      if (!wire) return;

      const newX = obj.left || 0;
      const newY = obj.top || 0;

      if (pointType === 'bend') {
        // Handle bend point movement
        // pointIndex 0 is start, 1...n are bend points, last is end
        // So bend point at pointIndex maps to bendPoints[pointIndex - 1]
        const bendPointIndex = pointIndex - 1;
        if (bendPointIndex >= 0 && bendPointIndex < wire.bendPoints.length) {
          const newBendPoints = [...wire.bendPoints];
          newBendPoints[bendPointIndex] = { x: newX, y: newY };
          useCircuitStore.getState().updateWire(wireId, { bendPoints: newBendPoints });
        }
      } else if (pointType === 'start' || pointType === 'end') {
        // Handle endpoint movement - find nearest pin to snap to
        // Exclude the current connected pin from search
        const excludeComponentId = pointType === 'start' ? wire.startComponentId : wire.endComponentId;
        const excludePinId = pointType === 'start' ? wire.startPinId : wire.endPinId;

        const nearestPin = findNearestPin(newX, newY, excludeComponentId, excludePinId);

        if (nearestPin) {
          // Found a pin to snap to - update the wire connection
          if (pointType === 'start') {
            useCircuitStore.getState().updateWire(wireId, {
              startComponentId: nearestPin.componentId,
              startPinId: nearestPin.pinId,
            });
          } else {
            useCircuitStore.getState().updateWire(wireId, {
              endComponentId: nearestPin.componentId,
              endPinId: nearestPin.pinId,
            });
          }
        }
        // If no pin found, the control point will snap back to the original pin position
        // when the wire is re-rendered (since we don't update the connection)
      }

      // Clear drag start position after drag ends
      wireControlPointDragStartRef.current = null;
    }
  }, [updateComponentPosition, findNearestPin, getComponentDefinition, placedComponents, insertIntoBreadboard, removeFromBreadboard, showInsertionHighlights]);

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

    // Handle wire control points
    if (obj?.data?.type !== 'wire-control-point') return;

    const { wireId, pointIndex, pointType } = obj.data;
    if (!wireId || pointIndex === undefined) return;

    // canvas already defined at the start of this function
    if (!canvas) return;

    const wire = useCircuitStore.getState().wires.find(w => w.id === wireId);
    if (!wire) return;

    // Get current positions for start and end from pins
    const startPos = getPinCanvasPosition(wire.startComponentId, wire.startPinId);
    const endPos = getPinCanvasPosition(wire.endComponentId, wire.endPinId);
    if (!startPos || !endPos) return;

    // Build points array with the dragged position
    let dragX = obj.left || 0;
    let dragY = obj.top || 0;

    // Capture drag start position on first move (for Shift constraint)
    if (!wireControlPointDragStartRef.current) {
      // Get the original position of this point before dragging
      if (pointType === 'start') {
        wireControlPointDragStartRef.current = { ...startPos };
      } else if (pointType === 'end') {
        wireControlPointDragStartRef.current = { ...endPos };
      } else {
        const bendIdx = pointIndex - 1;
        if (bendIdx >= 0 && bendIdx < wire.bendPoints.length) {
          wireControlPointDragStartRef.current = { ...wire.bendPoints[bendIdx] };
        }
      }
    }

    // Apply Shift constraint if held - constrain to horizontal/vertical relative to drag start position
    if (isShiftHeldRef.current && wireControlPointDragStartRef.current) {
      const constrained = constrainToAxis(
        wireControlPointDragStartRef.current.x,
        wireControlPointDragStartRef.current.y,
        dragX,
        dragY,
        true
      );
      dragX = constrained.x;
      dragY = constrained.y;
      // Update the control point visual position to match constraint
      obj.set({ left: dragX, top: dragY });
    }

    const points: { x: number; y: number }[] = [];

    // Start point
    if (pointType === 'start') {
      points.push({ x: dragX, y: dragY });
    } else {
      points.push(startPos);
    }

    // Bend points
    wire.bendPoints.forEach((bp, i) => {
      const bendPointIndex = i + 1; // bend points start at index 1
      if (pointIndex === bendPointIndex) {
        points.push({ x: dragX, y: dragY });
      } else {
        points.push(bp);
      }
    });

    // End point
    if (pointType === 'end') {
      points.push({ x: dragX, y: dragY });
    } else {
      points.push(endPos);
    }

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

  // Render wire control points when a wire is selected
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    // Remove existing control points
    wireControlPointsRef.current.forEach(circle => {
      canvas.remove(circle);
    });
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

    // Create control point circles for each point
    allPoints.forEach((point, index) => {
      const isEndpoint = index === 0 || index === allPoints.length - 1;
      const pointType = index === 0 ? 'start' : (index === allPoints.length - 1 ? 'end' : 'bend');

      const circle = new fabric.Circle({
        left: point.x,
        top: point.y,
        radius: isEndpoint ? 10 : 8,
        fill: isEndpoint ? '#1a73e8' : '#ffffff',
        stroke: '#1a73e8',
        strokeWidth: 2,
        originX: 'center',
        originY: 'center',
        // All control points (endpoints and bend points) are draggable
        selectable: true,
        evented: true,
        hasControls: false,
        hasBorders: false,
        lockMovementX: false,
        lockMovementY: false,
        hoverCursor: 'move',
        data: {
          type: 'wire-control-point',
          wireId: selectedWireId,
          pointIndex: index,
          pointType,
        },
      });

      canvas.add(circle);
      canvas.bringObjectToFront(circle);
      wireControlPointsRef.current.push(circle);
    });

    canvas.renderAll();
  }, [selectedWireId, wires, getPinCanvasPosition]);

  // Render wire preview during drawing
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    if (wireDrawing.isDrawing) {
      // Build points: start -> bendPoints -> current mouse position
      const points = [
        { x: wireDrawing.startX, y: wireDrawing.startY },
        ...wireDrawing.bendPoints,
        { x: wireDrawing.currentX, y: wireDrawing.currentY },
      ];

      const pathString = points.length > 2
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
        strokeDashArray: [10, 5],
        selectable: false,
        evented: false,
        data: { type: 'wire-preview' },
      });

      canvas.add(previewPath);
      canvas.bringObjectToFront(previewPath);
      wirePreviewRef.current = previewPath;
      canvas.renderAll();
    } else {
      // Remove preview when not drawing
      if (wirePreviewRef.current) {
        canvas.remove(wirePreviewRef.current);
        wirePreviewRef.current = null;
        canvas.renderAll();
      }
    }
  }, [wireDrawing]);

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

      // Remove from pending loads
      pendingLoadsRef.current.delete(instanceId);

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
  }, [addComponent, setComponentDefinition, onComponentDrop]);

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
    setZoom(newZoom);
    canvas.renderAll();
  };

  const handleZoomOut = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const newZoom = Math.max(zoom - 0.25, 0.5);
    canvas.setZoom(newZoom);
    setZoom(newZoom);
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
    const x = (screenX - vpt[4]) / vpt[0];
    const y = (screenY - vpt[5]) / vpt[3];

    console.log('[handleDrop] Dropping at position:', x, y);

    createComponentWithImage(componentId, category, x, y);
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

      // Escape key: cancel wire drawing or deselect wire
      if (e.key === 'Escape') {
        if (wireDrawing.isDrawing) {
          cancelWireDrawing();
        } else if (selectedWireId) {
          selectWire(null);
        }
      }

      // Delete or Backspace: during wire drawing, remove last node; otherwise delete selected wire/component
      if (e.key === 'Delete' || e.key === 'Backspace') {
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
  }, [wireDrawing.isDrawing, cancelWireDrawing, removeLastWireBendPoint, selectedObject, selectedWireId, selectWire, removeWire, undo, canUndo]);

  return (
    <div className="circuit-canvas-container">
      {/* Canvas Area */}
      <div
        ref={canvasContainerRef}
        className={`canvas-area ${isDragOver ? 'drag-over' : ''} ${wireDrawing.isDrawing ? 'wire-drawing' : ''}`}
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

        {placedComponents.length === 0 && !isDragOver && (
          <div className="canvas-placeholder">
            <p>Drag components from the left panel to build your circuit</p>
          </div>
        )}
      </div>
    </div>
  );
}
