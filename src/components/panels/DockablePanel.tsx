/**
 * DockablePanel - Wrapper component with drag handle
 *
 * Wraps any panel content and provides:
 * - Draggable title bar for docking/undocking
 * - Visual feedback during drag
 * - Integration with DockingContext
 */

import React, { useRef, useCallback, useEffect } from 'react';
import { GripHorizontal } from 'lucide-react';
import { useDocking } from '../../contexts/DockingContext';
import './DockablePanel.css';

interface DockablePanelProps {
  id: string;
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function DockablePanel({
  id,
  title,
  icon,
  children,
  className = '',
}: DockablePanelProps) {
  const {
    dragState,
    startDrag,
    updateDrag,
    endDrag,
    isPanelDocked,
  } = useDocking();

  const headerRef = useRef<HTMLDivElement>(null);
  const isDragging = dragState.isDragging && dragState.panelId === id;
  const isDocked = isPanelDocked(id);

  // Handle mouse down on header to start drag
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left click

    const rect = headerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;

    startDrag(id, e.clientX, e.clientY, offsetX, offsetY, isDocked ? 'dock' : 'floating');

    e.preventDefault();
  }, [id, isDocked, startDrag]);

  // Handle global mouse move/up during drag
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      updateDrag(e.clientX, e.clientY);
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
  }, [isDragging, updateDrag, endDrag]);

  return (
    <div
      className={`dockable-panel ${isDragging ? 'dragging' : ''} ${className}`}
      data-panel-id={id}
    >
      {/* Draggable header */}
      <div
        ref={headerRef}
        className="dockable-panel-header"
        onMouseDown={handleMouseDown}
      >
        <div className="dockable-panel-title">
          {icon && <span className="dockable-panel-icon">{icon}</span>}
          <span className="dockable-panel-title-text">{title}</span>
        </div>
        <div className="dockable-panel-header-right">
          <div className="dockable-panel-header-actions" />
          <div className="dockable-panel-drag-handle">
            <GripHorizontal size={14} />
          </div>
        </div>
      </div>

      {/* Panel content */}
      <div className="dockable-panel-content">
        {children}
      </div>
    </div>
  );
}

export default DockablePanel;
