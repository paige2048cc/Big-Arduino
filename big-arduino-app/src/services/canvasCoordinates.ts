/**
 * canvasCoordinates
 *
 * Provides a thin singleton that lets non-canvas components convert scene
 * coordinates to screen coordinates without having to reach into the
 * CircuitCanvas closure.
 *
 * CircuitCanvas registers the converter once via `registerSceneToScreenConverter`.
 * Any other component calls `sceneToScreen` and always gets the *current*
 * Fabric.js viewport (no stale snapshot issues).
 */

type ScreenPos = { x: number; y: number };
type Converter  = (sceneX: number, sceneY: number) => ScreenPos | null;

let _converter: Converter | null = null;

/** Called by CircuitCanvas when the Fabric canvas is ready. */
export function registerSceneToScreenConverter(fn: Converter): void {
  _converter = fn;
}

/** Called by any component that needs scene → screen position. */
export function sceneToScreen(sceneX: number, sceneY: number): ScreenPos | null {
  return _converter ? _converter(sceneX, sceneY) : null;
}
