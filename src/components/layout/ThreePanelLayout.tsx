import { useState, useRef, useCallback } from 'react';
import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import './ThreePanelLayout.css';

interface ThreePanelLayoutProps {
  leftPanel: ReactNode;
  centerPanel: ReactNode;
  rightPanel: ReactNode;
  initialLeftWidth?: number;
  initialRightWidth?: number;
  minLeftWidth?: number;
  maxLeftWidth?: number;
  minRightWidth?: number;
  maxRightWidth?: number;
  minCenterWidth?: number;
}

export function ThreePanelLayout({
  leftPanel,
  centerPanel,
  rightPanel,
  initialLeftWidth = 280,
  initialRightWidth = 360,
  minLeftWidth = 200,
  maxLeftWidth = 400,
  minRightWidth = 280,
  maxRightWidth = 480,
  minCenterWidth = 400,
}: ThreePanelLayoutProps) {
  const [leftWidth, setLeftWidth] = useState(initialLeftWidth);
  const [rightWidth, setRightWidth] = useState(initialRightWidth);
  const [isDraggingLeft, setIsDraggingLeft] = useState(false);
  const [isDraggingRight, setIsDraggingRight] = useState(false);
  const [isLeftCollapsed, setIsLeftCollapsed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const toggleLeftPanel = useCallback(() => {
    setIsLeftCollapsed(prev => !prev);
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const containerWidth = containerRect.width;

      if (isDraggingLeft) {
        const newLeftWidth = e.clientX - containerRect.left;
        const maxAllowedLeft = containerWidth - rightWidth - minCenterWidth;
        setLeftWidth(Math.max(minLeftWidth, Math.min(maxLeftWidth, Math.min(newLeftWidth, maxAllowedLeft))));
      }

      if (isDraggingRight) {
        const newRightWidth = containerRect.right - e.clientX;
        const maxAllowedRight = containerWidth - leftWidth - minCenterWidth;
        setRightWidth(Math.max(minRightWidth, Math.min(maxRightWidth, Math.min(newRightWidth, maxAllowedRight))));
      }
    },
    [isDraggingLeft, isDraggingRight, leftWidth, rightWidth, minLeftWidth, maxLeftWidth, minRightWidth, maxRightWidth, minCenterWidth]
  );

  const handleMouseUp = useCallback(() => {
    setIsDraggingLeft(false);
    setIsDraggingRight(false);
  }, []);

  const isDragging = isDraggingLeft || isDraggingRight;

  return (
    <div
      ref={containerRef}
      className={`three-panel-layout ${isDragging ? 'dragging' : ''}`}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Left Panel */}
      <div
        className={`panel left-panel ${isLeftCollapsed ? 'collapsed' : ''}`}
        style={{ width: isLeftCollapsed ? 0 : leftWidth }}
      >
        {/* Panel Content - wrapped for overflow clipping */}
        <div className="left-panel-content">
          {leftPanel}
        </div>

        {/* Protruding Collapse/Expand Handle */}
        <button
          className="panel-collapse-btn"
          onClick={toggleLeftPanel}
          title={isLeftCollapsed ? 'Expand panel' : 'Collapse panel'}
        >
          {isLeftCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Left Resizer - hidden when collapsed */}
      {!isLeftCollapsed && (
        <div
          className={`panel-resizer left-resizer ${isDraggingLeft ? 'active' : ''}`}
          onMouseDown={() => setIsDraggingLeft(true)}
        />
      )}

      {/* Center Panel */}
      <div className="panel center-panel">
        {centerPanel}
      </div>

      {/* Right Resizer */}
      <div
        className={`panel-resizer right-resizer ${isDraggingRight ? 'active' : ''}`}
        onMouseDown={() => setIsDraggingRight(true)}
      />

      {/* Right Panel */}
      <div className="panel right-panel" style={{ width: rightWidth }}>
        {rightPanel}
      </div>
    </div>
  );
}
