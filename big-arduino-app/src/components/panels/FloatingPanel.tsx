/**
 * FloatingPanel - Floating window for detached panels
 *
 * Fixed-size floating window (360x400) that can be:
 * - Dragged around the viewport
 * - Closed to dock back into the sidebar
 */

import React, { useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, GripHorizontal } from 'lucide-react';
import { useDocking, type FloatingPosition } from '../../contexts/DockingContext';
import './FloatingPanel.css';

// Fixed size for floating panels
const FLOATING_WIDTH = 360;
const FLOATING_HEIGHT = 400;

interface FloatingPanelProps {
  id: string;
  title: string;
  icon?: React.ReactNode;
  position: FloatingPosition;
  children: React.ReactNode;
  zIndex?: number;
}

export function FloatingPanel({
  id,
  title,
  icon,
  position,
  children,
  zIndex = 1000,
}: FloatingPanelProps) {
  const {
    dragState,
    startDrag,
    updateDrag,
    endDrag,
    updateFloatingPosition,
    dockPanel,
  } = useDocking();
  const panelRef = useRef<HTMLDivElement>(null);
  const isDragging = dragState.isDragging && dragState.panelId === id;

  // Clamp position to viewport
  const clampedPosition = {
    x: Math.max(0, Math.min(position.x, window.innerWidth - FLOATING_WIDTH)),
    y: Math.max(0, Math.min(position.y, window.innerHeight - FLOATING_HEIGHT)),
  };

  // Handle mouse down on header to start drag
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left click

    const rect = panelRef.current?.getBoundingClientRect();
    if (!rect) return;

    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;
    startDrag(id, e.clientX, e.clientY, offsetX, offsetY, 'floating');

    e.preventDefault();
  }, [id, startDrag]);

  // Handle drag
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      updateDrag(e.clientX, e.clientY);

      const newX = Math.max(
        0,
        Math.min(e.clientX - dragState.offsetX, window.innerWidth - FLOATING_WIDTH)
      );
      const newY = Math.max(
        0,
        Math.min(e.clientY - dragState.offsetY, window.innerHeight - FLOATING_HEIGHT)
      );
      updateFloatingPosition(id, newX, newY);
    };

    const handleMouseUp = () => {
      endDrag();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        endDrag();
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isDragging, dragState.offsetX, dragState.offsetY, id, updateDrag, updateFloatingPosition, endDrag]);

  // Handle close button - dock panel back
  const handleClose = useCallback(() => {
    dockPanel(id, 'bottom');
  }, [id, dockPanel]);

  // Render via portal to body
  return createPortal(
    <div
      ref={panelRef}
      className={`floating-panel ${isDragging ? 'dragging' : ''}`}
      style={{
        left: clampedPosition.x,
        top: clampedPosition.y,
        width: FLOATING_WIDTH,
        height: FLOATING_HEIGHT,
        zIndex,
      }}
    >
      {/* Header */}
      <div
        className="floating-panel-header"
        onMouseDown={handleMouseDown}
      >
        <div className="floating-panel-title">
          {icon && <span className="floating-panel-icon">{icon}</span>}
          <span className="floating-panel-title-text">{title}</span>
        </div>
        <div className="floating-panel-actions">
          <div className="floating-panel-drag-handle">
            <GripHorizontal size={14} />
          </div>
          <button
            className="floating-panel-close"
            onClick={handleClose}
            title="Dock panel"
            aria-label="Dock panel"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="floating-panel-content">
        {children}
      </div>
    </div>,
    document.body
  );
}

export default FloatingPanel;
