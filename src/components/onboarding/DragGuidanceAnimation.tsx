/**
 * DragGuidanceAnimation Component
 *
 * Renders an animated SVG path with a flowing line and hand icon
 * to guide users on how to drag components to the workspace.
 */

import { createPortal } from 'react-dom';
import './DragGuidanceAnimation.css';

interface DragGuidanceAnimationProps {
  startPoint: { x: number; y: number };
  endPoint: { x: number; y: number };
  isPlaying: boolean;
}

export function DragGuidanceAnimation({
  startPoint,
  endPoint,
  isPlaying,
}: DragGuidanceAnimationProps) {
  if (!isPlaying) return null;

  // Generate curved path using quadratic bezier
  // Control point creates an arc above the straight line
  const midX = (startPoint.x + endPoint.x) / 2;
  const midY = Math.min(startPoint.y, endPoint.y) - 60;

  const pathD = `M ${startPoint.x} ${startPoint.y} Q ${midX} ${midY} ${endPoint.x} ${endPoint.y}`;

  return createPortal(
    <div className="drag-guidance-animation" aria-hidden="true">
      <svg
        className="drag-guidance-svg"
        viewBox={`0 0 ${window.innerWidth} ${window.innerHeight}`}
        preserveAspectRatio="xMidYMid slice"
      >
        {/* Dashed flowing line */}
        <path
          d={pathD}
          className="guidance-path"
          fill="none"
          stroke="#FFC425"
          strokeWidth="3"
          strokeDasharray="12 8"
          strokeLinecap="round"
        />

        {/* Animated dot following path */}
        <circle r="8" fill="#FFC425" className="guidance-dot">
          <animateMotion dur="2s" repeatCount="indefinite" path={pathD} />
        </circle>

        {/* Hand icon following path */}
        <g className="guidance-hand">
          <animateMotion dur="2s" repeatCount="indefinite" path={pathD} />
          {/* Hand pointing icon */}
          <g transform="translate(-16, -16)">
            <circle cx="16" cy="16" r="16" fill="white" />
            <path
              d="M16 8c-1.1 0-2 .9-2 2v6h-2.5c-.83 0-1.5.67-1.5 1.5v.5c0 2.21 1.79 4 4 4h4c2.21 0 4-1.79 4-4v-6c0-1.1-.9-2-2-2h-1v-2c0-1.1-.9-2-2-2zm0 2h1v2h-1v-2zm-4 6h6v4h-4c-1.1 0-2-.9-2-2v-2zm8 0v4c0 1.1-.9 2-2 2v-4h2z"
              fill="#202124"
              transform="translate(4, 4) scale(0.8)"
            />
          </g>
        </g>
      </svg>

      {/* Target indicator at end point */}
      <div
        className="guidance-target"
        style={{
          left: endPoint.x,
          top: endPoint.y,
        }}
      >
        <div className="guidance-target-ring" />
        <div className="guidance-target-ring guidance-target-ring--delayed" />
      </div>
    </div>,
    document.body
  );
}
