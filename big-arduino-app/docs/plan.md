# Big Arduino App - Development Plan

---

## Version History

| Version | Title | Status | Date |
|---------|-------|--------|------|
| v3.0 | Bug Fixes | Implemented | 2026-01-20 |
| v4.0 | Wire Drawing & Canvas Interaction | Partial (7/8 features) | 2026-01-20 |

---

# v4.0 - Wire Drawing & Canvas Interaction

**Status:** Partially Implemented (2026-01-20)

## Overview

Implement enhanced canvas interactions and a Figma-like pen tool for circuit wire drawing.

## Features to Implement

| # | Feature | Complexity | Status |
|---|---------|------------|--------|
| 1 | Pin hit area: 21×21 rectangular | Low | Done |
| 2 | Pin tooltip: short ID only, above pin | Low | Done |
| 3 | Mouse wheel zoom | Medium | Done |
| 4 | Middle mouse button pan | Medium | Done |
| 5 | Figma-like pen tool for wire drawing | High | Done |
| 6 | Wire color selection (during drawing) | Medium | Done |
| 7 | Wire styling: rounded corners, round ends, Shift constraint | Medium | Done |
| 8 | Wire editing (bend points + endpoint reconnection) | High | Pending |

## Current State Analysis

### Pin Detection (`componentService.ts`)
- Uses **circular hit detection** with `hitRadius` (8px)
- Formula: `sqrt(dx² + dy²) <= hitRadius`
- Needs: **21×21 rectangular** detection

### Pin Tooltip (`CircuitCanvas.tsx`)
- Shows **both** label AND description
- Positioned at `(canvasX + 15, canvasY - 10)` - to the right
- Needs: **Only short ID**, positioned **directly above** pin

### Canvas Navigation
- **Zoom**: Only via toolbar buttons, no wheel support
- **Pan**: Button exists but NOT implemented
- Needs: Wheel zoom + middle mouse pan

### Wire Drawing
- State management exists (`wireDrawing` in store)
- **Wires are NOT visually rendered** on canvas
- No bend/corner support
- No color selection during drawing
- Needs: Full pen tool with visual rendering

## Implementation Plan

### 1. Pin Hit Area: 21×21 Rectangular

**File:** `src/services/componentService.ts`

Change `getPinAtPosition()` from circular to rectangular:

```typescript
export function getPinAtPosition(
  definition: ComponentDefinition,
  localX: number,
  localY: number
): Pin | null {
  const hitSize = 21; // 21×21 rectangular hit area
  const halfSize = hitSize / 2;

  for (const pin of definition.pins) {
    // Rectangular hit detection
    if (
      localX >= pin.x - halfSize &&
      localX <= pin.x + halfSize &&
      localY >= pin.y - halfSize &&
      localY <= pin.y + halfSize
    ) {
      return pin;
    }
  }
  return null;
}
```

**File:** `src/components/canvas/CircuitCanvas.tsx`

Update pin highlight to be 21×21 square:
- Change `fabric.Circle` to `fabric.Rect`
- Size: 21×21 pixels

### 2. Pin Tooltip: Short ID Only, Above Pin

**File:** `src/components/canvas/CircuitCanvas.tsx`

Update tooltip rendering to show short ID (e.g., "D13", "A0", "GND"):
```tsx
{hoveredPin && (
  <div
    className="pin-tooltip pin-tooltip-minimal"
    style={{
      left: hoveredPin.canvasX,
      top: hoveredPin.canvasY - 30,  // Above the pin
      transform: 'translateX(-50%)', // Center horizontally
    }}
  >
    {hoveredPin.pin.id}
  </div>
)}
```

Note: Uses `pin.id` (short: "D13") instead of `pin.label` (long: "Digital 13 / SCK / LED")

**File:** `src/components/canvas/CircuitCanvas.css`

Add minimal tooltip style:
```css
.pin-tooltip-minimal {
  padding: 4px 8px;
  font-size: 11px;
  white-space: nowrap;
  text-align: center;
}
```

### 3. Mouse Wheel Zoom

**File:** `src/components/canvas/CircuitCanvas.tsx`

Add wheel event handler in canvas init:
```typescript
fabricCanvas.on('mouse:wheel', (opt) => {
  const delta = opt.e.deltaY;
  let newZoom = canvas.getZoom() * (delta > 0 ? 0.9 : 1.1);

  // Clamp zoom
  newZoom = Math.min(Math.max(newZoom, 0.5), 3);

  // Zoom toward mouse position
  const pointer = canvas.getPointer(opt.e);
  canvas.zoomToPoint({ x: pointer.x, y: pointer.y }, newZoom);

  setZoom(newZoom);
  opt.e.preventDefault();
  opt.e.stopPropagation();
});
```

### 4. Middle Mouse Button Pan

**File:** `src/components/canvas/CircuitCanvas.tsx`

Add state and handlers:
```typescript
const [isPanningActive, setIsPanningActive] = useState(false);
const lastPanPointRef = useRef<{ x: number; y: number } | null>(null);

// In mouse:down handler
if (mouseEvent.button === 1) { // Middle mouse button
  setIsPanningActive(true);
  lastPanPointRef.current = { x: mouseEvent.clientX, y: mouseEvent.clientY };
  mouseEvent.preventDefault();
  return;
}

// In mouse:move handler
if (isPanningActive && lastPanPointRef.current) {
  const vpt = canvas.viewportTransform;
  vpt[4] += mouseEvent.clientX - lastPanPointRef.current.x;
  vpt[5] += mouseEvent.clientY - lastPanPointRef.current.y;
  canvas.setViewportTransform(vpt);
  lastPanPointRef.current = { x: mouseEvent.clientX, y: mouseEvent.clientY };
  return;
}

// In mouse:up handler (global)
if (mouseEvent.button === 1) {
  setIsPanningActive(false);
  lastPanPointRef.current = null;
}
```

### 5. Figma-like Pen Tool for Wire Drawing

#### 5.1 Update Wire Type

**File:** `src/types/components.ts`

```typescript
export interface Wire {
  id: string;
  startComponentId: string;
  startPinId: string;
  endComponentId: string;
  endPinId: string;
  // Path points including bends (start and end are pin positions)
  bendPoints: { x: number; y: number }[];
  color: string;
}
```

#### 5.2 Update Wire Drawing State

**File:** `src/store/circuitStore.ts`

```typescript
wireDrawing: {
  isDrawing: boolean;
  startComponentId: string | null;
  startPinId: string | null;
  startX: number;
  startY: number;
  // Array of bend points added during drawing
  bendPoints: { x: number; y: number }[];
  currentX: number;
  currentY: number;
  color: string;  // Current wire color
}
```

Add new actions:
- `addWireBendPoint(x, y)` - Add bend at current position
- `setWireColor(color)` - Change wire color during drawing
- `updateSelectedWire(wireId, updates)` - Edit existing wire

#### 5.3 Wire Rendering on Canvas

**File:** `src/components/canvas/CircuitCanvas.tsx`

Create a wire rendering function:
```typescript
const renderWire = (
  startX: number,
  startY: number,
  bendPoints: { x: number; y: number }[],
  endX: number,
  endY: number,
  color: string,
  isPreview: boolean = false
) => {
  const points = [
    { x: startX, y: startY },
    ...bendPoints,
    { x: endX, y: endY }
  ];

  // Create path with rounded corners
  const pathString = createRoundedPath(points, 6); // 6px corner radius

  const path = new fabric.Path(pathString, {
    stroke: color,
    strokeWidth: 6,
    fill: 'transparent',
    strokeLineCap: 'round',
    strokeLineJoin: 'round',
    selectable: !isPreview,
    evented: !isPreview,
    data: { type: isPreview ? 'wire-preview' : 'wire' }
  });

  return path;
};
```

#### 5.4 Wire Drawing Flow

1. **Click on pin** → Start wire drawing
   - Store start pin position
   - Show preview wire following mouse

2. **Mouse move** → Update preview
   - Draw line from last point to current mouse
   - Apply Shift constraint if held

3. **Click (not on pin)** → Add bend point
   - Store current position as bend
   - Continue drawing from bend point

4. **Click on pin** → Complete wire
   - Finalize wire with all bend points
   - Add to store and render permanently

5. **Escape** → Cancel drawing

#### 5.5 Shift Key Constraint

```typescript
const constrainToAxis = (
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  shiftHeld: boolean
): { x: number; y: number } => {
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
};
```

### 6. Wire Color Selection

#### 6.1 Add Color Picker to Toolbar

**File:** `src/components/canvas/CircuitCanvas.tsx`

Add color picker in toolbar:
```tsx
const wireColors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#666666'];
const [selectedWireColor, setSelectedWireColor] = useState('#666666');

// In toolbar JSX
<div className="toolbar-group wire-colors">
  {wireColors.map(color => (
    <button
      key={color}
      className={`color-btn ${selectedWireColor === color ? 'active' : ''}`}
      style={{ backgroundColor: color }}
      onClick={() => {
        setSelectedWireColor(color);
        if (wireDrawing.isDrawing) {
          setWireColor(color);
        }
      }}
    />
  ))}
</div>
```

#### 6.2 Wire Selection and Editing

When a completed wire is clicked:
- Select the wire (show selection handles at endpoints and bend points)
- Show color picker - clicking a color updates the selected wire
- **Bend point editing:** Drag bend points to reshape wire path
- **Endpoint reconnection:** Drag endpoints to disconnect from current pin and reconnect to a different pin (highlight valid pins on hover)

**Wire editing state:**
```typescript
interface WireEditingState {
  selectedWireId: string | null;
  draggedPoint: 'start' | 'end' | number | null; // number = bend point index
  isDragging: boolean;
}
```

**Endpoint reconnection flow:**
1. Click wire to select
2. Drag endpoint handle
3. Valid pins highlight as mouse approaches
4. Drop on pin to reconnect, or drop elsewhere to cancel

### 7. Wire Styling: Rounded Corners

Create SVG path with rounded corners:

```typescript
function createRoundedPath(
  points: { x: number; y: number }[],
  radius: number
): string {
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
```

## File Changes Summary

| File | Changes |
|------|---------|
| `src/services/componentService.ts` | Change pin hit detection to 21×21 rectangular |
| `src/components/canvas/CircuitCanvas.tsx` | Pin highlight square, tooltip above pin, wheel zoom, middle mouse pan, wire rendering, color picker |
| `src/components/canvas/CircuitCanvas.css` | Minimal tooltip style, color picker styles, wire preview styles |
| `src/store/circuitStore.ts` | Wire drawing state with bendPoints and color, new actions |
| `src/types/components.ts` | Update Wire type with bendPoints |

## Implementation Order

1. **Pin interactions** (hit area + tooltip) - Quick wins
2. **Canvas navigation** (wheel zoom + pan) - Independent feature
3. **Wire data structures** (types + store) - Foundation for wire tool
4. **Wire rendering** (display existing wires) - Visual feedback
5. **Wire drawing flow** (pen tool behavior) - Core interaction
6. **Wire color & editing** - Enhancement
7. **Rounded corners + Shift constraint** - Polish

## Verification Plan

1. **Pin Hit Area:**
   - Hover near pin corners - should detect at 10.5px distance
   - Hover 11px away - should NOT detect

2. **Pin Tooltip:**
   - Shows only short pin ID (e.g., "D13")
   - Positioned centered above the pin

3. **Wheel Zoom:**
   - Scroll up/down on canvas to zoom in/out
   - Zoom centers on mouse position

4. **Middle Mouse Pan:**
   - Hold middle button and drag to pan canvas
   - Release to stop panning

5. **Wire Drawing:**
   - Click pin to start wire
   - Wire follows mouse (with Shift constraint if held)
   - Click empty space to add bend
   - Click another pin to complete
   - Wire renders with selected color

6. **Wire Editing:**
   - Click completed wire to select (shows handles at endpoints and bends)
   - Change color from toolbar - wire updates immediately
   - Drag bend points to reshape wire
   - Drag endpoints to reconnect to different pins
   - Wire has rounded corners at bends
   - Wire ends are round (strokeLineCap: 'round')

---

# v3.0 - Bug Fixes

**Status:** Implemented (2026-01-20)

## Overview

Fix 7 bugs related to component rendering, pin alignment, and UI issues.

## Issues Fixed

| # | Issue | Root Cause | Status |
|---|-------|------------|--------|
| 1 | Pin positions misaligned with images | Coordinate scaling mismatch in CircuitCanvas | Fixed |
| 2 | Arduino UNO board scale incorrect | Hardcoded 0.3 scale + wrong dimensions in JSON | Fixed |
| 3 | Users can resize components (unwanted) | Fabric.js default allows scaling controls | Fixed |
| 4 | Delete button on properties panel doesn't work | Only removes from store, not from Fabric canvas | Fixed |
| 5 | Properties panel should show name, description, properties | Missing description, has unwanted size/position | Fixed |
| 6 | Move plan to docs folder | Plan in wrong location | Fixed |
| 7 | Button simulation not working | Stale closure - event handlers don't update | Fixed |

## Changes Made

### 1. Arduino UNO JSON (`public/components/microcontrollers/arduino-uno.json`)
- Updated dimensions from 640x453 to actual image size: **898x628**
- Recalculated all 28 pin coordinates proportionally:
  - X scale: 898/640 = 1.403125
  - Y scale: 628/453 = 1.386313

### 2. CircuitCanvas.tsx (`src/components/canvas/CircuitCanvas.tsx`)
- **Removed hardcoded scale logic** - components now render at native size
- **Added lockScaling properties** to prevent user resizing:
  ```typescript
  hasControls: false,
  lockScalingX: true,
  lockScalingY: true,
  hasBorders: true,
  ```
- **Added store sync useEffect** - syncs store deletions with Fabric canvas
- **Fixed stale closure bug** - uses refs for event handlers to ensure they always reference latest callbacks

### 3. ComponentPropertiesPanel.tsx
- Added description section (shows if `definition.description` exists)
- Removed Size and Position info rows
- Kept only Category info

### 4. ComponentPropertiesPanel.css
- Added `.component-description` style

## Verification Checklist

1. **Pin Alignment:** Hover over Arduino UNO pins - highlight circles align with visual pin positions
2. **Component Size:** Arduino UNO renders at native 898x628 size
3. **No Scaling:** Click component - no resize handles visible
4. **Delete Button:** Properties panel delete button removes component from canvas
5. **Properties Panel:** Shows Name, Description (if exists), Properties, Category only
6. **Button Simulation:** During simulation, click+hold pushbutton switches to ON image, release switches back to OFF

## Technical Notes

- Pin coordinates are in image pixel coordinates (not canvas coordinates)
- Fabric.js images render at natural dimensions unless explicitly scaled
- Event handler refs pattern prevents stale closure issues in React with Fabric.js events
