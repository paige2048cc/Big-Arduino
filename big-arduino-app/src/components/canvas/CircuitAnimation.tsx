/**
 * CircuitAnimation
 *
 * SVG overlay that renders the power-flow animation:
 *   - Yellow glowing ball travelling from the power source along the circuit path
 *   - Yellow wire highlight paths
 *
 * Breadboard row/rail highlights are rendered as Fabric.js objects in
 * CircuitCanvas for correct z-ordering (above breadboard, below components).
 *
 * Modes:
 *   hideBall=true              : wire highlights only (design mode)
 *   parkPosition set           : ball parked at a fixed position (button-blocked)
 *   persistOnComplete=true     : one-shot ball stays visible at end (simulation)
 *   persistOnComplete=false    : one-shot ball fades out then fires onDone (legacy)
 */

import { useEffect, useRef, useState } from 'react';
import type { CircuitAnimationPath } from '../../services/circuitPathTracer';
import './CircuitAnimation.css';

interface CircuitAnimationProps {
  path: CircuitAnimationPath;
  viewportTransformRef: React.MutableRefObject<number[]>;
  isLooping: boolean;
  wirePathStrings: Record<string, string>;
  onDone: () => void;
  /** Don't render or animate the ball (design-mode static highlights) */
  hideBall?: boolean;
  /** Fixed scene-coordinate position to park the ball (overrides path animation) */
  parkPosition?: { x: number; y: number } | null;
  /** When true, one-shot ball stays visible at the end instead of fading */
  persistOnComplete?: boolean;
}

const BALL_SPEED = 500;
const HOLD_MS    = 1000;
const FADE_MS    = 800;

export function CircuitAnimation({
  path,
  viewportTransformRef,
  isLooping,
  wirePathStrings,
  onDone,
  hideBall = false,
  parkPosition = null,
  persistOnComplete = false,
}: CircuitAnimationProps) {
  const groupRef = useRef<SVGGElement>(null);
  const ballRef  = useRef<SVGCircleElement>(null);

  const [highlightOpacity, setHighlightOpacity] = useState(1);

  const cumLengthsRef  = useRef<number[]>([]);
  const totalLengthRef = useRef(0);

  const progressRef    = useRef(0);
  const startTimeRef   = useRef<number | null>(null);
  const ballDoneRef    = useRef(false);
  const rafIdRef       = useRef<number | null>(null);
  const holdTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Immediately snap ball to park position via DOM ref ──────────────────
  useEffect(() => {
    if (parkPosition && ballRef.current) {
      ballRef.current.setAttribute('cx', String(parkPosition.x));
      ballRef.current.setAttribute('cy', String(parkPosition.y));
    }
  }, [parkPosition]);

  // ── Recompute path geometry when the path prop changes ────────────────────
  useEffect(() => {
    const validWaypoints = path.waypoints.filter(
      (wp): wp is { x: number; y: number } =>
        wp != null && typeof wp.x === 'number' && typeof wp.y === 'number'
    );
    const cumLengths: number[] = [0];
    let total = 0;
    for (let i = 1; i < validWaypoints.length; i++) {
      const dx = validWaypoints[i].x - validWaypoints[i - 1].x;
      const dy = validWaypoints[i].y - validWaypoints[i - 1].y;
      total += Math.sqrt(dx * dx + dy * dy);
      cumLengths.push(total);
    }
    cumLengthsRef.current  = cumLengths;
    totalLengthRef.current = total;
    progressRef.current    = 0;
    startTimeRef.current   = null;
    ballDoneRef.current    = false;
    setHighlightOpacity(1);
  }, [path]);

  // ── rAF animation loop ────────────────────────────────────────────────────
  useEffect(() => {
    const waypoints = path.waypoints.filter(
      (wp): wp is { x: number; y: number } =>
        wp != null && typeof wp.x === 'number' && typeof wp.y === 'number'
    );

    const needsAnimation = !hideBall && !parkPosition && waypoints.length >= 2;

    function interpolate(progress: number): { x: number; y: number } {
      const cumLengths = cumLengthsRef.current;
      const total = totalLengthRef.current;
      if (total === 0) return waypoints[0] ?? { x: 0, y: 0 };

      const p = Math.max(0, Math.min(progress, total));
      let lo = 0, hi = cumLengths.length - 2;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (cumLengths[mid] <= p) lo = mid; else hi = mid - 1;
      }
      const segLen = cumLengths[lo + 1] - cumLengths[lo];
      if (segLen === 0) return waypoints[lo] ?? { x: 0, y: 0 };
      const t = (p - cumLengths[lo]) / segLen;
      const a = waypoints[lo];
      const b = waypoints[lo + 1];
      if (!a || !b) return { x: 0, y: 0 };
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }

    function applyTransform() {
      const vpt = viewportTransformRef.current;
      if (groupRef.current && vpt) {
        groupRef.current.setAttribute(
          'transform',
          `matrix(${vpt[0]},0,0,${vpt[3]},${vpt[4]},${vpt[5]})`
        );
      }
    }

    function tick(timestamp: number) {
      applyTransform();

      if (needsAnimation && !ballDoneRef.current) {
        if (startTimeRef.current === null) startTimeRef.current = timestamp;
        const elapsed = (timestamp - startTimeRef.current) / 1000;
        progressRef.current = elapsed * BALL_SPEED;

        const total = totalLengthRef.current;

        if (!isLooping && progressRef.current >= total) {
          progressRef.current = total;
          ballDoneRef.current = true;

          const endPos = interpolate(total);
          if (ballRef.current) {
            ballRef.current.setAttribute('cx', String(endPos.x));
            ballRef.current.setAttribute('cy', String(endPos.y));
          }

          if (persistOnComplete) {
            // Ball stays at the end position — no fade, no onDone
          } else {
            holdTimerRef.current = setTimeout(() => {
              setHighlightOpacity(0);
              fadeTimerRef.current = setTimeout(() => onDone(), FADE_MS);
            }, HOLD_MS);
          }
        } else {
          if (isLooping && progressRef.current >= total) {
            startTimeRef.current = timestamp;
            progressRef.current  = 0;
          }
          const pos = interpolate(progressRef.current);
          if (ballRef.current) {
            ballRef.current.setAttribute('cx', String(pos.x));
            ballRef.current.setAttribute('cy', String(pos.y));
          }
        }
      }

      rafIdRef.current = requestAnimationFrame(tick);
    }

    rafIdRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafIdRef.current !== null)   cancelAnimationFrame(rafIdRef.current);
      if (holdTimerRef.current !== null) clearTimeout(holdTimerRef.current);
      if (fadeTimerRef.current !== null) clearTimeout(fadeTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, isLooping, viewportTransformRef, onDone, hideBall, parkPosition, persistOnComplete]);

  // ── Render ────────────────────────────────────────────────────────────────
  const { wireIds } = path;

  const vpt0 = viewportTransformRef.current ?? [1, 0, 0, 1, 0, 0];
  const initialTransform = `matrix(${vpt0[0]},0,0,${vpt0[3]},${vpt0[4]},${vpt0[5]})`;

  const ballPos = parkPosition ?? path.waypoints[0] ?? { x: 0, y: 0 };

  return (
    <svg
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      <defs>
        <radialGradient id="circuit-ball-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#FFD700" stopOpacity="1" />
          <stop offset="50%"  stopColor="#FFD700" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#FFD700" stopOpacity="0" />
        </radialGradient>
      </defs>

      <g ref={groupRef} transform={initialTransform}>
        {/* Wire highlights */}
        {wireIds.map(id =>
          wirePathStrings[id] ? (
            <path
              key={id}
              className="circuit-anim-highlight"
              d={wirePathStrings[id]}
              stroke="#FFD700"
              strokeWidth={10}
              strokeLinecap="round"
              fill="none"
              style={{ opacity: highlightOpacity * 0.5 }}
            />
          ) : null
        )}

        {/* Animated / parked ball (hidden in design mode) */}
        {!hideBall && (
          <circle
            ref={ballRef}
            cx={ballPos.x}
            cy={ballPos.y}
            r={14}
            fill="url(#circuit-ball-glow)"
          />
        )}
      </g>
    </svg>
  );
}
