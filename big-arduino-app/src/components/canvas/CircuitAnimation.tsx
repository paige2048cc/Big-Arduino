/**
 * CircuitAnimation
 *
 * SVG overlay that renders the power-flow animation:
 *   • Yellow glowing ball travelling from the power source along the circuit path
 *   • Yellow wire highlights and breadboard row/rail highlight rectangles
 *
 * Design mode  (isLooping=false): ball plays once, highlights stay 1 s then fade, onDone fires.
 * Simulation   (isLooping=true) : ball loops continuously, highlights stay constant.
 */

import { useEffect, useRef, useState } from 'react';
import type { CircuitAnimationPath } from '../../services/circuitPathTracer';
import './CircuitAnimation.css';

interface CircuitAnimationProps {
  path: CircuitAnimationPath;
  /** Ref to the Fabric.js viewportTransform array – updated by pan/zoom handlers */
  viewportTransformRef: React.MutableRefObject<number[]>;
  isLooping: boolean;
  /** wireId → SVG path string (scene coordinates) built during wire rendering */
  wirePathStrings: Record<string, string>;
  /** Called after a one-shot animation fully completes (including the fade-out) */
  onDone: () => void;
}

const BALL_SPEED = 300; // scene-units per second (increased from 180 for faster animation)
const HOLD_MS    = 1000; // ms to hold highlights after ball finishes (design mode)
const FADE_MS    = 800;  // ms for fade-out transition

export function CircuitAnimation({
  path,
  viewportTransformRef,
  isLooping,
  wirePathStrings,
  onDone,
}: CircuitAnimationProps) {
  const groupRef = useRef<SVGGElement>(null);
  const ballRef  = useRef<SVGCircleElement>(null);

  /** 0→1; fades to 0 at end of one-shot animation */
  const [highlightOpacity, setHighlightOpacity] = useState(1);

  // Precomputed cumulative segment lengths for fast interpolation
  const cumLengthsRef  = useRef<number[]>([]);
  const totalLengthRef = useRef(0);

  // rAF state (stored in refs to survive re-renders without resetting the loop)
  const progressRef    = useRef(0);   // scene-units elapsed
  const startTimeRef   = useRef<number | null>(null);
  const ballDoneRef    = useRef(false);
  const rafIdRef       = useRef<number | null>(null);
  const holdTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Recompute path geometry when the path prop changes ────────────────────
  useEffect(() => {
    const { waypoints } = path;
    const cumLengths: number[] = [0];
    let total = 0;
    for (let i = 1; i < waypoints.length; i++) {
      const dx = waypoints[i].x - waypoints[i - 1].x;
      const dy = waypoints[i].y - waypoints[i - 1].y;
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
    const { waypoints } = path;
    if (waypoints.length < 2) return;

    function interpolate(progress: number): { x: number; y: number } {
      const cumLengths = cumLengthsRef.current;
      const total = totalLengthRef.current;
      if (total === 0) return waypoints[0];

      const p = Math.max(0, Math.min(progress, total));

      // Binary search for segment
      let lo = 0, hi = cumLengths.length - 2;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (cumLengths[mid] <= p) lo = mid; else hi = mid - 1;
      }

      const segLen = cumLengths[lo + 1] - cumLengths[lo];
      if (segLen === 0) return waypoints[lo];
      const t = (p - cumLengths[lo]) / segLen;
      const a = waypoints[lo];
      const b = waypoints[lo + 1];
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
      // Always keep the SVG transform in sync with pan/zoom
      applyTransform();

      if (!ballDoneRef.current) {
        if (startTimeRef.current === null) startTimeRef.current = timestamp;
        const elapsed = (timestamp - startTimeRef.current) / 1000;
        progressRef.current = elapsed * BALL_SPEED;

        const total = totalLengthRef.current;

        if (!isLooping && progressRef.current >= total) {
          // One-shot complete: freeze ball at end
          progressRef.current = total;
          ballDoneRef.current = true;

          const endPos = interpolate(total);
          if (ballRef.current) {
            ballRef.current.setAttribute('cx', String(endPos.x));
            ballRef.current.setAttribute('cy', String(endPos.y));
          }

          // Hold 1 s then fade out, then notify parent
          holdTimerRef.current = setTimeout(() => {
            setHighlightOpacity(0);
            fadeTimerRef.current = setTimeout(() => onDone(), FADE_MS);
          }, HOLD_MS);
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
  // path identity change resets the whole loop via the geometry effect above;
  // isLooping change is safe because the loop reads ballDoneRef each frame
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, isLooping, viewportTransformRef, onDone]);

  // ── Render ────────────────────────────────────────────────────────────────
  const { wireIds, breadboardHighlights, waypoints } = path;

  // Initial transform (rAF will update every frame)
  const vpt0 = viewportTransformRef.current ?? [1, 0, 0, 1, 0, 0];
  const initialTransform = `matrix(${vpt0[0]},0,0,${vpt0[3]},${vpt0[4]},${vpt0[5]})`;
  const initialPos = waypoints[0] ?? { x: 0, y: 0 };

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

      {/* Everything in here is in scene coordinates; the matrix maps to screen */}
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

        {/* Breadboard row / rail highlights */}
        {breadboardHighlights.map((h, i) => (
          <rect
            key={i}
            className="circuit-anim-highlight"
            x={h.x}
            y={h.y}
            width={h.width}
            height={h.height}
            fill="#FFD700"
            rx={4}
            style={{ opacity: highlightOpacity * 0.4 }}
          />
        ))}

        {/* Animated ball */}
        <circle
          ref={ballRef}
          cx={initialPos.x}
          cy={initialPos.y}
          r={14}
          fill="url(#circuit-ball-glow)"
        />
      </g>
    </svg>
  );
}
