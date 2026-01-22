# Changelog

All notable changes to Big Arduino App will be documented in this file.

## Versioning

- **Major versions (X.0.0)**: Significant feature updates
- **Minor versions (X.Y.0)**: Small improvements or enhancements
- **Patch versions (X.Y.Z)**: Bug fixes

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
