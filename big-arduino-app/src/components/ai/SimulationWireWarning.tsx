/**
 * SimulationWireWarning
 *
 * Portal-rendered yellow character that appears in the top-right corner of the
 * canvas when the user tries to draw wires during simulation mode (2+ attempts).
 *
 * Trigger:   wireAttemptsDuringSimulation >= 2
 * Dismiss:   automatically after 5 s, OR instantly when simulation stops.
 *
 * Positioning: fixed in the top-right corner of the viewport.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import characterYellow from '../../assets/character_yellow.svg';
import './SimulationWireWarning.css';

// ─── Types ────────────────────────────────────────────────────────────────────

type AnimState = 'idle' | 'visible' | 'hiding';

export interface SimulationWireWarningProps {
  /** Number of wire drawing attempts during simulation */
  wireAttemptsDuringSimulation: number;
  /** Whether simulation is currently active */
  isSimulating: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SimulationWireWarning({
  wireAttemptsDuringSimulation,
  isSimulating,
}: SimulationWireWarningProps) {
  const [animState, setAnimState] = useState<AnimState>('idle');

  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasShownRef = useRef(false);
  const animStateRef = useRef<AnimState>('idle');

  const clearDismissTimer = useCallback(() => {
    if (dismissTimerRef.current !== null) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
  }, []);

  const show = useCallback(() => {
    clearDismissTimer();
    setAnimState('visible');
    animStateRef.current = 'visible';
    dismissTimerRef.current = setTimeout(() => {
      setAnimState('hiding');
      animStateRef.current = 'hiding';
    }, 5000);
  }, [clearDismissTimer]);

  // ── Show warning when attempts >= 2 ────────────────────────────────────────
  useEffect(() => {
    if (!isSimulating) {
      // Reset when simulation stops
      hasShownRef.current = false;
      if (animStateRef.current !== 'idle') {
        setAnimState('hiding');
        animStateRef.current = 'hiding';
      }
      return;
    }

    if (wireAttemptsDuringSimulation >= 2 && !hasShownRef.current) {
      hasShownRef.current = true;
      show();
    }
  }, [wireAttemptsDuringSimulation, isSimulating, show]);

  // ── Cleanup on unmount ───────────────────────────────────────────────────
  useEffect(() => () => clearDismissTimer(), [clearDismissTimer]);

  // ── Animation end ────────────────────────────────────────────────────────
  const handleAnimationEnd = useCallback((e: React.AnimationEvent) => {
    if (e.animationName === 'sww-hide') {
      setAnimState('idle');
      animStateRef.current = 'idle';
    }
  }, []);

  // ── Render ───────────────────────────────────────────────────────────────
  if (animState === 'idle') return null;

  return createPortal(
    <div
      className={`sww-root sww-root--${animState}`}
      onAnimationEnd={handleAnimationEnd}
      data-sww-overlay="true"
    >
      {/* Speech bubble – to the left of the character, arrow points right */}
      <div className="sww-bubble">
        Stop simulation before modifying your circuit!
      </div>

      {/* Yellow character */}
      <img
        className="sww-character"
        src={characterYellow}
        alt=""
        draggable={false}
      />
    </div>,
    document.body
  );
}

export default SimulationWireWarning;
