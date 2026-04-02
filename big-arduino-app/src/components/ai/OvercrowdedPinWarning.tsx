/**
 * OvercrowdedPinWarning
 *
 * Portal-rendered yellow character that pops up above the breadboard hole
 * whenever two or more component legs (or direct breadboard wire endpoints) share the same hole.
 * Wires to component pins are not double-counted with legs; instructional overlay wires are ignored.
 * In real life a single hole can only accept one leg/wire.
 *
 * Trigger:   newly-detected overcrowded holes (leading-edge only).
 * Dismiss:   automatically after 5 s, OR instantly when all conflicts clear.
 *
 * Positioning: uses the live `sceneToScreen` converter registered by CircuitCanvas,
 * so the position always reflects the *current* Fabric.js viewport (no stale
 * snapshot issues from the store).  Zooming/panning while the overlay is visible
 * also updates the position correctly.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useCircuitStore } from '../../store/circuitStore';
import { sceneToScreen } from '../../services/canvasCoordinates';
import type { PlacedComponent, Wire } from '../../types/components';
import characterYellowAngry from '../../assets/character_yellow_angry.svg';
import './OvercrowdedPinWarning.css';

// ─── Types ────────────────────────────────────────────────────────────────────

type AnimState = 'idle' | 'visible' | 'hiding';

export interface OvercrowdedPinWarningProps {
  placedComponents: PlacedComponent[];
  wires: Wire[];
}

interface ScreenPos {
  x: number;
  y: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Builds an occupancy map of "breadboardId::pinId" → count.
 * Returns the first key whose count exceeds 1, or null if none.
 */
function findFirstOvercrowdedKey(
  placedComponents: PlacedComponent[],
  wires: Wire[]
): string | null {
  const occ = new Map<string, number>();

  const inc = (bbId: string, pinId: string) => {
    const k = `${bbId}::${pinId}`;
    occ.set(k, (occ.get(k) ?? 0) + 1);
  };

  // Component legs inserted into a breadboard (skip decorative-only ghosts — they share holes with the real part)
  for (const comp of placedComponents) {
    if (comp.decorativeOnly) continue;
    if (!comp.parentBreadboardId || !comp.insertedPins) continue;
    for (const bbPinId of Object.values(comp.insertedPins)) {
      inc(comp.parentBreadboardId, bbPinId);
    }
  }

  // Build breadboard ID set for direct wire→breadboard connections
  const bbIds = new Set(
    placedComponents
      .filter(c => c.definitionId === 'breadboard')
      .map(c => c.instanceId)
  );

  for (const wire of wires) {
    // Instructional / dashed overlay wires (e.g. Frame 3 power demos) are not real hole occupancy.
    if (wire.overlayAboveComponents) continue;

    // Case A: wire endpoint IS a breadboard pin directly
    if (bbIds.has(wire.startComponentId)) inc(wire.startComponentId, wire.startPinId);
    if (bbIds.has(wire.endComponentId)) inc(wire.endComponentId, wire.endPinId);

    // Case B omitted: a wire to a component pin uses the same hole as that pin's leg — counting both
    // double-counts and triggers false "overcrowded" when a leg + wire share one hole (normal case).
  }

  for (const [key, count] of occ.entries()) {
    if (count > 1) return key;
  }
  return null;
}

/**
 * Positions the warning character above the *entire breadboard* that contains
 * the overcrowded hole, centred horizontally on it.
 *
 * Uses the live scene→screen converter (always current Fabric.js viewport).
 */
function computePinScreenPos(
  overcrowdedKey: string,
  placedComponents: PlacedComponent[]
): ScreenPos | null {
  const [bbId] = overcrowdedKey.split('::');
  if (!bbId) return null;

  const bb = placedComponents.find(c => c.instanceId === bbId);
  if (!bb) return null;

  const def = useCircuitStore.getState().componentDefinitions.get(bbId);
  if (!def) return null;

  // Top-centre of the breadboard in scene coordinates
  const sceneX = bb.x + def.width  / 2;
  const sceneY = bb.y;

  const pos = sceneToScreen(sceneX, sceneY);
  if (!pos) return null;

  // Float the character above the breadboard top edge
  const ABOVE_PX = 56;
  return { x: pos.x, y: pos.y - ABOVE_PX };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function OvercrowdedPinWarning({
  placedComponents,
  wires,
}: OvercrowdedPinWarningProps) {
  // vpt from the store is used only as a change-signal so the position
  // recomputes when the user zooms / pans while the overlay is visible.
  // The actual coordinate math uses the live `sceneToScreen` converter.
  const vpt = useCircuitStore(s => s.canvasViewportTransform);

  const [animState, setAnimState] = useState<AnimState>('idle');
  const [pinPos, setPinPos] = useState<ScreenPos | null>(null);

  const dismissTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevConflictKeyRef = useRef<string | null>(null);
  // Stable ref to avoid stale closure in the vpt-tracking effect
  const animStateRef       = useRef<AnimState>('idle');

  const clearDismissTimer = useCallback(() => {
    if (dismissTimerRef.current !== null) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
  }, []);

  const show = useCallback((pos: ScreenPos) => {
    clearDismissTimer();
    setPinPos(pos);
    setAnimState('visible');
    animStateRef.current = 'visible';
    dismissTimerRef.current = setTimeout(() => {
      setAnimState('hiding');
      animStateRef.current = 'hiding';
    }, 5000);
  }, [clearDismissTimer]);

  // ── Overcrowding detection ────────────────────────────────────────────────
  useEffect(() => {
    const key = findFirstOvercrowdedKey(placedComponents, wires);

    if (key && key !== prevConflictKeyRef.current) {
      // New conflict detected — pop in
      const pos = computePinScreenPos(key, placedComponents);
      if (pos) show(pos);
    } else if (!key) {
      // Conflict resolved — hide immediately
      clearDismissTimer();
      if (animStateRef.current !== 'idle') {
        setAnimState('hiding');
        animStateRef.current = 'hiding';
      }
    }

    prevConflictKeyRef.current = key;
  }, [placedComponents, wires, show, clearDismissTimer]);

  // ── Reposition on zoom / pan ──────────────────────────────────────────────
  useEffect(() => {
    if (animStateRef.current !== 'visible') return;
    const key = prevConflictKeyRef.current;
    if (!key) return;
    const pos = computePinScreenPos(key, placedComponents);
    if (pos) setPinPos(pos);
  }, [vpt, placedComponents]);

  // ── Cleanup on unmount ───────────────────────────────────────────────────
  useEffect(() => () => clearDismissTimer(), [clearDismissTimer]);

  // ── Animation end ────────────────────────────────────────────────────────
  const handleAnimationEnd = useCallback((e: React.AnimationEvent) => {
    if (e.animationName === 'ycw-hide') {
      setAnimState('idle');
      animStateRef.current = 'idle';
      setPinPos(null);
    }
  }, []);

  // ── Render ───────────────────────────────────────────────────────────────
  if (animState === 'idle' || !pinPos) return null;

  return createPortal(
    <div
      className={`ycw-root ycw-root--${animState}`}
      style={{ left: pinPos.x, top: pinPos.y }}
      onAnimationEnd={handleAnimationEnd}
      data-ycw-overlay="true"
    >
      {/* Speech bubble – to the left of the character, arrow points right */}
      <div className="ycw-bubble">
        Whoa! Each hole fits only <strong>one</strong> wire or pin leg — just like real life!
      </div>

      {/* Yellow angry character */}
      <img
        className="ycw-character"
        src={characterYellowAngry}
        alt=""
        draggable={false}
      />
    </div>,
    document.body
  );
}

export default OvercrowdedPinWarning;
