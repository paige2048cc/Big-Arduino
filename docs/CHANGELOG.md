# Changelog

All notable changes to Big Arduino App will be documented in this file.

## Versioning

- **Major versions (X.0.0)**: Significant feature updates
- **Minor versions (X.Y.0)**: Small improvements or enhancements
- **Patch versions (X.Y.Z)**: Bug fixes

---

## [6.7.0] - 2026-01-26

### Fixed
- **Button simulation not working**: Fixed button press not registering during simulation - wire drawing logic was intercepting clicks on button pins before simulation code could run
- **Button state not resetting on release**: Fixed global mouseup handler to properly call `setButtonState(false)` when button is released
- **LED not lighting with pushbutton**: Fixed 4-pin pushbutton snapping - all 4 pins now properly tracked in `insertedPins` so circuit paths through button are correctly traced

### Added
- **Insertion highlight feedback**: Green pulsing highlight now appears on breadboard holes when components snap into place
  - Shows 2 highlights for LED/resistor, up to 4 for pushbutton
  - Uses same pin position calculation as hover logic for accuracy
  - 400ms animation duration
- **Wire priority over breadboard pins**: Wires now have hover/selection priority over breadboard pins
  - When cursor is over a wire, breadboard pin hover effect is hidden
  - Clicking selects the wire instead of starting new wire drawing

### Changed
- **Breadboard hover color**: Changed connected pins highlight from purple to blue (matches other components)
- **Breadboard hover visual hierarchy**:
  - Active pin (under cursor): Full-opacity blue highlight
  - Connected pins (same net): Reduced opacity blue (background: 0.1, border: 0.25)
- **Wire drawing disabled during simulation**: Prevents accidental wire creation while interacting with buttons

### Technical Details
- Added `findBestFourPinSnap` and `findBestSinglePinSnapWithAllPins` functions in breadboardSnapping.ts
- Added `showInsertionHighlights` function and `insertionHighlights` state for visual feedback
- Added wire detection in `handleMouseMoveEvent` to check cursor proximity to wire paths
- Insertion highlights use `getPinCanvasPosition` for accurate positioning at all zoom levels

---

## [6.6.1] - 2026-01-24

### Fixed
- **Pin hover priority for all components**: Pin hover effect is now hidden for ANY component when visually covered by another component above (previously only worked for breadboard and Arduino UNO pins)

### Technical Details
- Simplified hover detection logic: cursor within any component's bounds marks all components below as covered
- Applies universally to breadboard, Arduino UNO, LEDs, resistors, and all other components

---

## [6.6.0] - 2026-01-24

### Changed
- **Property card position**: Moved card upward so top margin (16px) matches right margin
- **Property card width**: Reduced from 280px to 200px for less workspace obstruction
- **LED color selector**: Changed from button grid to dropdown menu for cleaner UI
- **Resistor value selector**: Added dropdown menu with common resistance values (100Ω to 10kΩ)

### Removed
- Category display from component property card (unnecessary information)

---

## [6.5.2] - 2026-01-24

### Fixed
- **Flip pivot point**: Breadboard and all components now flip around their visual center point using Fabric.js's native `getCenterPoint()` method
- **Child mirroring after breadboard flip**: Inserted components are now correctly mirrored around the breadboard's center axis when the breadboard is flipped

### Technical Details
- Rewrote flip handlers to use Fabric.js's native `getCenterPoint()` instead of manual center calculation
- Apply flip first, then calculate delta between old and new center positions to adjust left/top
- Child positions are mirrored by negating their offset from the breadboard center (X for horizontal flip, Y for vertical flip)

---

## [6.5.1] - 2026-01-24

### Fixed
- **Snap position calculation after rotation**: Fixed `calculateSinglePinPosition` to use correct inverse transformation formula, ensuring components snap to correct breadboard positions after being rotated
- **Breadboard flip child positioning**: Fixed flip handlers to calculate breadboard center BEFORE applying flip state, ensuring children maintain correct relative positions

### Technical Details
- Rewrote `calculateSinglePinPosition` to match inverse of `transformToCanvas`: uses `target - rotatedPinRel + rotatedOriginRel` formula
- Fixed origin offset calculation to properly account for flip state when computing component position from target pin position

---

## [6.5.0] - 2026-01-24

### Added
- **Breadboard rotation with children**: When a breadboard is rotated, all inserted components now rotate together around the breadboard's center, maintaining their relative positions and electrical connections
- **Breadboard flip with children**: When a breadboard is flipped (horizontal or vertical), all inserted components are mirrored accordingly, preserving the circuit layout

### Fixed
- **Rotation pivot point**: All components now correctly rotate around their visual center point instead of an incorrect pivot
- **Pin positions after rotation**: Fixed coordinate transformation to accurately calculate pin positions after rotation for breadboard snapping and wire connections

### Technical Details
- Added `getComponentCenterPosition` and `getLeftTopFromCenter` helper functions for consistent center calculation
- Rewrote `handleRotate` to manually calculate position changes without changing Fabric.js origin
- Updated flip handlers to transform all children when flipping a breadboard
- Rewrote `transformToCanvas` in breadboardSnapping.ts to correctly derive center position from local-top-left coordinates

---

## [6.4.0] - 2026-01-24

### Added
- **Auto re-snap after flip**: Components inserted into a breadboard automatically re-snap to valid positions after being flipped, maintaining correct pin assignments (e.g., LED anode/cathode swap positions)
- **Wire endpoint snap preview**: While drawing a wire, the floating endpoint now snaps to nearby pins as a visual preview without finalizing the connection - click to confirm
- **Shift-constrained wire point movement**: Hold Shift while dragging wire control points (endpoints or bend points) to constrain movement to horizontal or vertical directions only

### Technical Details
- Added `reSnapAfterFlip` helper function that recalculates snap position with new flip state
- Wire drawing now updates floating endpoint position to hovered pin coordinates for snap preview
- Wire control point dragging in `handleObjectMoving` now applies `constrainToAxis` when Shift is held

---

## [6.3.3] - 2026-01-24

### Fixed
- **Breadboard snapping after rotation/flip**: Fixed bug where components couldn't snap to breadboard pins correctly after being rotated or flipped - pin positions are now accurately calculated with all transformations
- **Flip state persistence**: Component flip state (flipX/flipY) is now persisted in the circuit store, enabling undo/redo support and accurate pin calculations across sessions

### Technical Details
- Added `flipX` and `flipY` properties to `PlacedComponent` interface
- Added `updateComponentFlip` store action to persist flip state when components are flipped
- Updated Fabric.js sync effect to apply stored flip state to canvas objects
- Updated `transformToCanvas` in breadboardSnapping.ts to handle flip transformations
- Updated all snap position calculation functions to account for flip state

---

## [6.3.2] - 2026-01-24

### Fixed
- **Circuit simulation through breadboard**: Fixed bug where components inserted into breadboard weren't recognized in circuit analysis - simulation now re-runs when components are inserted into or removed from a breadboard
- **Pin hover detection after flip**: Fixed bug where pin hover detection used pre-flip coordinates after component was flipped - removed redundant manual flip adjustment since inverse transform matrix already handles flip transformations

### Technical Details
- Added `runSimulation()` calls to `insertIntoBreadboard` and `removeFromBreadboard` store actions
- Ensures circuit paths through breadboard nets are detected immediately when insertion state changes
- Removed manual flip coordinate adjustment in hover detection (`handleMouseMoveEvent`) - the inverse transform matrix from `fabric.util.invertTransform()` already converts canvas coordinates back to the original local coordinate space

---

## [6.3.1] - 2026-01-24

### Fixed
- **Duplicate component issue**: Fixed race condition where dropping a component could create duplicate Fabric.js objects due to sync effect firing before image load completed
- **Ghost breadboard during drag**: Fixed visual artifact where breadboard appeared to leave a copy at original position during drag by preventing sync effect from interfering with active drags
- **Component immovable after insertion**: Fixed coordinate synchronization so components can still be moved after being inserted into breadboard
- **Breadboard child movement**: Fixed visual update of inserted components during breadboard drag by properly marking children as dirty and updating coordinates
- **Large delta jump prevention**: Added safeguard to prevent children from jumping incorrectly when starting a new breadboard drag
- **Pin positions after flip**: Fixed bug where pin coordinates didn't follow component flip transformations - pins were double-flipped causing wire connections and hit detection to use wrong positions

### Technical Details
- Added `pendingLoadsRef` to track components currently loading, preventing duplicate Fabric object creation
- Added `isDraggingRef` flag to prevent sync effect from overwriting positions during active drags
- Added `setCoords()` calls after position updates for proper hit detection
- Reset `lastBreadboardPositionRef` when breadboard drag completes
- Removed manual flip coordinate adjustment in `getPinCanvasPosition` since Fabric.js transform matrix already includes flip transformations

---

## [6.3.0] - 2026-01-24

### Added
- **Undo system**: Full undo support with Ctrl+Z keyboard shortcut
- **Undo toolbar button**: Replaced "Reset View" button with Undo (rewind icon) in floating toolbar
- **Breadboard component insertion**: Components auto-snap to breadboard pins when dropped nearby
- **Smart two-pin snapping**: LEDs and resistors snap both pins to same row section (enforces real breadboard rules - no spanning across center gap)
- **Group movement**: Components inserted into breadboard move together when breadboard is moved
- **Circuit connectivity through breadboard**: Inserted components are electrically connected through breadboard nets - wires to any pin in a row connect to inserted component pins in that row

### New Files
- `src/services/breadboardSnapping.ts` - Snapping algorithms for breadboard insertion

### Technical Details
- History stack stores up to 50 snapshots of circuit state
- Undo restores components, wires, and component definitions
- Components track `parentBreadboardId` and `insertedPins` for insertion relationship
- Snap threshold: 25 pixels from breadboard pins
- Circuit simulator traces through breadboard nets to inserted components bidirectionally

---

## [6.2.2] - 2026-01-24

### Added
- **Wire node removal**: During wire drawing, pressing Backspace or Delete removes the last added bend point. Continuing to press removes nodes back to the first; removing the first node cancels the entire wire

### Fixed
- **Component locking during wire drawing**: Components are now locked and cannot be moved while drawing a wire, preventing accidental displacement
- **Keyboard safety during wire drawing**: Backspace/Delete no longer deletes components during wire drawing - the keys only affect wire nodes

---

## [6.2.1] - 2026-01-24

### Fixed
- **Breadboard/Uno layering**: Breadboard and Arduino Uno now always stay at the lowest layer in the workspace, even when dragged in after other components exist
- **Pin hover priority**: Component pins now take priority over breadboard pins when positions overlap - if a component is visually covering a breadboard pin, the breadboard pin hover effect will not appear

---

## [6.2.0] - 2026-01-22

### Added
- **Breadboard component integration** in the Arduino app
- New "Boards" category in Component Library with Half-Size Breadboard
- Breadboard-specific hover behavior: highlights all internally connected pins (same net) with purple color and glow effect (matching pin-generator style)
- No pin label tooltip for breadboard pins (only net highlighting)
- Circuit simulator now recognizes breadboard internal connections via `net` property
- Wires can connect through breadboard rows/rails for circuit simulation

### Changed
- `getInternalConnections()` in circuit simulator extended to use `net` property from pin definitions
- Pin hover highlighting now supports multi-pin net highlighting for breadboard
- Updated breadboard.json dimensions to match actual image size (658x424) with scaled pin positions

---

## [6.1.0] - 2026-01-22

### Added
- **Pin net/group feature** for internally connected pins (e.g., breadboard rows)
- New `net` property on Pin interface to group electrically connected pins
- Pin editor UI: Net/Group field in edit panel for assigning pins to nets
- Net highlighting: hovering over a pin highlights all pins in the same net (purple)
- Net badge display in pin list showing which net a pin belongs to
- New "boards" component category for breadboards and similar
- Breadboard template (`breadboard-half`) with 400 pins and net definitions:
  - Power rails: `power-top-plus`, `power-top-minus`, `power-bottom-plus`, `power-bottom-minus`
  - Main rows: `row-{1-30}-top` and `row-{1-30}-bottom` (5 connected pins each)

### Changed
- Pin-generator template interface now supports optional `net` property
- Template matching patterns updated to recognize breadboard images

---

## [6.0.3] - 2026-01-22

### Fixed
- Wire error/hint messages not updating when circuit changes during simulation
- Added `runSimulation()` calls after wire operations (addWire, removeWire, updateWire)
- Added `runSimulation()` call after component removal to update circuit analysis

---

## [6.0.2] - 2026-01-22

### Fixed
- Component images not loading when drag-dropping onto canvas
- Fixed missing BASE_URL prefix in `loadComponentByFileName` function
- Fixed missing BASE_URL prefix in `getComponentImageUrl` function

---

## [6.0.1] - 2026-01-22

### Fixed
- Images not loading on GitHub Pages due to incorrect base path
- Updated all image and fetch URLs to use `import.meta.env.BASE_URL` prefix
- Fixed paths in ComponentLibrary, CircuitCanvas, and componentService

---

## [6.0.0] - 2026-01-22

### Changed
- Merged Instruction panel into AI Chat panel as unified view
- Instructions now display as vertical collapsible accordion
- Removed tab switching between Instructions and AI Chat

### Added
- Step accordion with three visual states: inactive (gray), active (blue), completed (green)
- Checkmark indicator for completed steps
- "Mark Complete" button on active steps
- Auto-collapse completed step and auto-expand next step on completion
- Click-to-toggle expand/collapse on any step header
- `expandedSteps` state management for accordion behavior

### Removed
- Tab switcher UI (Instructions/AI Chat tabs)
- Progress dots navigation
- Previous/Next step navigation buttons

---

## [5.5.0] - 2026-01-22

### Changed
- Arduino UNO image dimensions updated from 898x628 to 600x420
- All 28 pin positions recalculated to match new image scale (scale factor: 0.668)

---

## [5.4.1] - 2026-01-22

### Fixed
- React Router now works correctly on GitHub Pages subdirectory deployment
- Added basename configuration to BrowserRouter using Vite's BASE_URL

---

## [5.4.0] - 2026-01-22

### Added
- GitHub Pages deployment support
- GitHub Actions workflow for automatic deployment on push to main
- Vite base path configuration for GitHub Pages subdirectory hosting

---

## [5.3.0] - 2026-01-21

### Added
- Collapsible left panel with protruding handle on panel edge
- Handle is centered vertically and remains visible when collapsed
- Typography scale CSS variables for consistent text sizing

### Changed
- Component library now uses 3-column card grid layout
- Component cards display vertically with centered thumbnail and name
- Toolbar moved to floating position at bottom center of canvas
- Toolbar now has pill-shaped design with backdrop blur effect
- Component thumbnails increased to 48x48px
- Wire drawing indicator repositioned above floating toolbar
- Panel collapse button changed to protruding tab design (per Figma)

---

## [5.2.3] - 2026-01-21

### Fixed
- Wire now follows control point handles in real-time during drag
- Wire geometry updates live as you drag any control point (endpoints or bend points)
- Wire outline also updates in real-time during control point drag

---

## [5.2.2] - 2026-01-21

### Fixed
- Wire outline now stays in sync with wire: properly removed when wire is deleted, updated when wire is modified
- Wire endpoints (blue circles) are now draggable like bend points

### Changed
- Wire endpoint handles can be dragged and will snap to nearby pins (within 30px threshold)
- If no pin is found when releasing an endpoint, it snaps back to its original connected pin

---

## [5.2.1] - 2026-01-21

### Changed
- Wire selection highlight changed from gradient/shadow to solid blue outline
- Control point circles increased in size (endpoint: 10px, bend point: 8px radius)
- Wire corner radius increased from 6px to 12px for smoother bends

### Added
- Delete button in toolbar now works for selected wires
- Backspace key now deletes selected wire (in addition to Delete key)
- Escape key deselects wire (exits wire editing mode)
- Pin interactions disabled while wire is selected (prevents accidental wire drawing)

---

## [5.2.0] - 2026-01-21

### Added
- Wire editing mode with custom selection (no bounding box)
- Selected wires display with glow effect and thicker stroke
- Control points appear at endpoints and bend points when wire is selected
- Bend point dragging: drag white control points to reshape wire path
- Endpoint indicators: blue circles show where wire connects to pins (not draggable)
- Click on wire to select, click empty space to deselect
- Delete key removes selected wire
- Wire color can be changed via toolbar when wire is selected

### Fixed
- Wire endpoints now correctly follow component rotation and flip transformations
- Pin positions now correctly detected after component rotation or flip
- Pin detection uses Fabric.js transform matrix for accurate coordinate conversion

---

## [5.1.0] - 2026-01-21

### Added
- Wire selection: click on any wire to select it
- Wire deletion: press Delete key with wire selected
- Wire color editing: change selected wire's color via toolbar
- Visual feedback: selected wires display thicker stroke

### Fixed
- Wire endpoints now correctly follow component rotation and flip transformations
- Pin positions now correctly detected after component rotation or flip
- Pin detection uses Fabric.js transform matrix for accurate coordinate conversion

---

## [5.0.1] - 2026-01-21

### Fixed
- Pin hover highlight was being hidden behind wires after wire rendering
- Pin highlight now stays visible and on top when hovering over pins
- Added effect to ensure pin highlight is brought to front after wire updates

### Changed
- Pin label position adjusted to 40px above pin center (was 30.5px)

---

## [5.0.0] - 2026-01-21

### Added
- Circuit simulation engine with path tracing and validation
- LED circuit validation: checks power path, ground path, polarity, and resistor presence
- Button-controlled circuits: pressing button re-runs simulation in real-time
- Wire error highlighting: problematic wires shown in red with dashed lines
- Wire error tooltips: hover over error wire to see explanation message
- Component state responses: LEDs light up when circuit is correctly connected

### New Files
- `src/services/circuitSimulator.ts` - Core circuit analysis engine

### Changed
- Simulation now validates circuit connections before activating components
- Button press/release triggers simulation re-run for interactive circuits

---

## [4.1.0] - 2026-01-21

### Added
- Rotate function in toolbar (45° per click around component center)
- Flip Horizontal function in toolbar
- Flip Vertical function in toolbar
- LED polarity indicators: (+) for ANODE, (–) for CATHODE pins

### Changed
- Pin tooltip now positioned 20px above pin top edge (was covering pin)
- Pin tooltip background color changed to #1A2BC3 at 70% opacity

---

## [4.0.0] - 2026-01-20

### Added
- Pin hit area: 21×21 rectangular detection (was circular 8px radius)
- Pin tooltip: short ID only, centered above pin
- Mouse wheel zoom (zooms toward mouse position)
- Middle mouse button pan
- Figma-like pen tool for wire drawing with bend points
- Wire color selection (7 colors in toolbar)
- Wire styling: 6px stroke, rounded corners, round ends
- Shift key constraint for horizontal/vertical wire segments

### Changed
- Pin highlight changed from circle to 21×21 square

---

## [3.0.0] - 2026-01-20

### Fixed
- Pin positions misaligned with component images
- Arduino UNO board scale incorrect (updated dimensions to 898x628)
- Users could resize components (now locked)
- Delete button on properties panel not working
- Properties panel showing unwanted size/position info
- Button simulation not working (stale closure bug)

### Changed
- Moved plan.md to docs folder
- Properties panel now shows: Name, Description, Properties, Category only

---
