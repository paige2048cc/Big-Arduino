/**
 * DockContainer - Container for docked panels
 *
 * Manages:
 * - Vertical or horizontal layout of docked panels
 * - Resizable divider between panels
 * - Drop zones for docking floating panels
 * - Drag preview during panel dragging
 */

import React, { useRef, useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useDocking, type DropZone } from '../../contexts/DockingContext';
import { DockablePanel } from './DockablePanel';
import { FloatingPanel } from './FloatingPanel';
import { InstructionsPanel } from './InstructionsPanel';
import { Lightbulb, MessageCircle } from 'lucide-react';
import characterIcon from '../../assets/character.svg';
import './DockContainer.css';

interface DockContainerProps {
  // Render function for AI Chat panel content
  renderAIChat: () => React.ReactNode;
}

export function DockContainer({ renderAIChat }: DockContainerProps) {
  const {
    dockedPanels,
    floatingPanels,
    layoutMode,
    dividerPosition,
    setDividerPosition,
    dragState,
    setActiveDropZone,
    getPanelConfig,
  } = useDocking();

  const containerRef = useRef<HTMLDivElement>(null);
  const [isDraggingDivider, setIsDraggingDivider] = useState(false);
  const [hoveredDropZone, setHoveredDropZone] = useState<DropZone | null>(null);

  // Handle divider drag
  const handleDividerMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDraggingDivider(true);
    e.preventDefault();
  }, []);

  useEffect(() => {
    if (!isDraggingDivider) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();

      if (layoutMode === 'vertical') {
        const newPosition = (e.clientY - rect.top) / rect.height;
        setDividerPosition(Math.max(0.2, Math.min(0.8, newPosition)));
      } else {
        const newPosition = (e.clientX - rect.left) / rect.width;
        // Allow a wider range so 2-column layouts can breathe
        setDividerPosition(Math.max(0.15, Math.min(0.85, newPosition)));
      }
    };

    const handleMouseUp = () => {
      setIsDraggingDivider(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingDivider, layoutMode, setDividerPosition]);

  // Handle drop zone detection during panel drag
  useEffect(() => {
    if (!dragState.isDragging || !containerRef.current) {
      setHoveredDropZone(null);
      return;
    }

    const container = containerRef.current;
    const rect = container.getBoundingClientRect();
    const { currentX, currentY } = dragState;

    // Check if cursor is within container
    if (
      currentX < rect.left ||
      currentX > rect.right ||
      currentY < rect.top ||
      currentY > rect.bottom
    ) {
      setHoveredDropZone(null);
      setActiveDropZone(null);
      return;
    }

    // Determine drop zone based on cursor position
    const relX = (currentX - rect.left) / rect.width;
    const relY = (currentY - rect.top) / rect.height;

    let dropZone: DropZone | null = null;

    if (layoutMode === 'vertical') {
      // Check for top/bottom drop zones
      if (relY < 0.2) {
        dropZone = { containerId: 'dock', position: 'top' };
      } else if (relY > 0.8) {
        dropZone = { containerId: 'dock', position: 'bottom' };
      } else if (relX < 0.15) {
        dropZone = { containerId: 'dock', position: 'left' };
      } else if (relX > 0.85) {
        dropZone = { containerId: 'dock', position: 'right' };
      }
    } else {
      // Horizontal layout
      if (relX < 0.2) {
        dropZone = { containerId: 'dock', position: 'left' };
      } else if (relX > 0.8) {
        dropZone = { containerId: 'dock', position: 'right' };
      } else if (relY < 0.15) {
        dropZone = { containerId: 'dock', position: 'top' };
      } else if (relY > 0.85) {
        dropZone = { containerId: 'dock', position: 'bottom' };
      }
    }

    setHoveredDropZone(dropZone);
    setActiveDropZone(dropZone);
  }, [dragState, layoutMode, setActiveDropZone]);

  // Render panel content based on ID
  const renderPanelContent = (panelId: string) => {
    switch (panelId) {
      case 'instructions':
        return <InstructionsPanel />;
      case 'ai-assistant':
        return renderAIChat();
      default:
        return <div>Unknown panel: {panelId}</div>;
    }
  };

  // Get panel icon
  const getPanelIcon = (panelId: string) => {
    switch (panelId) {
      case 'instructions':
        return <Lightbulb size={20} style={{ color: '#F5A623' }} />;
      case 'ai-assistant':
        return <img src={characterIcon} alt="" style={{ width: 28, height: 28 }} />;
      default:
        return <MessageCircle size={16} />;
    }
  };

  // Get panel title
  const getPanelTitle = (panelId: string) => {
    const config = getPanelConfig(panelId);
    if (config) return config.title;

    switch (panelId) {
      case 'instructions':
        return 'Instructions';
      case 'ai-assistant':
        return 'AI Assistant';
      default:
        return panelId;
    }
  };

  // Calculate panel sizes
  const getPanelStyle = (index: number): React.CSSProperties => {
    if (dockedPanels.length === 1) {
      return { flex: 1 };
    }

    if (layoutMode === 'vertical') {
      if (index === 0) {
        return { height: `${dividerPosition * 100}%`, flexShrink: 0 };
      }
      return { flex: 1 };
    } else {
      if (index === 0) {
        return { width: `${dividerPosition * 100}%`, flexShrink: 0 };
      }
      return { flex: 1 };
    }
  };

  return (
    <>
      <div
        ref={containerRef}
        className={`dock-container ${layoutMode} ${isDraggingDivider ? 'resizing' : ''} ${dragState.isDragging ? 'panel-dragging' : ''}`}
      >
        {/* Drop zone indicators */}
        {dragState.isDragging && (
          <>
            <div className={`drop-zone drop-zone-top ${hoveredDropZone?.position === 'top' ? 'active' : ''}`} />
            <div className={`drop-zone drop-zone-bottom ${hoveredDropZone?.position === 'bottom' ? 'active' : ''}`} />
            <div className={`drop-zone drop-zone-left ${hoveredDropZone?.position === 'left' ? 'active' : ''}`} />
            <div className={`drop-zone drop-zone-right ${hoveredDropZone?.position === 'right' ? 'active' : ''}`} />
          </>
        )}

        {/* Docked panels */}
        {dockedPanels.map((panel, index) => (
          <React.Fragment key={panel.id}>
            <div className="dock-panel-wrapper" style={getPanelStyle(index)}>
              <DockablePanel
                id={panel.id}
                title={getPanelTitle(panel.id)}
                icon={getPanelIcon(panel.id)}
              >
                {renderPanelContent(panel.id)}
              </DockablePanel>
            </div>

            {/* Divider between panels */}
            {index < dockedPanels.length - 1 && (
              <div
                className={`dock-divider ${layoutMode}`}
                onMouseDown={handleDividerMouseDown}
              >
                <div className="dock-divider-handle" />
              </div>
            )}
          </React.Fragment>
        ))}

        {/* Empty state */}
        {dockedPanels.length === 0 && (
          <div className="dock-empty-state">
            <p>No panels docked</p>
          </div>
        )}
      </div>

      {/* Floating panels */}
      {Array.from(floatingPanels.entries()).map(([panelId, position], index) => (
        <FloatingPanel
          key={panelId}
          id={panelId}
          title={getPanelTitle(panelId)}
          icon={getPanelIcon(panelId)}
          position={position}
          zIndex={1000 + index}
        >
          {renderPanelContent(panelId)}
        </FloatingPanel>
      ))}

      {/* Drag preview */}
      {dragState.isDragging && dragState.panelId && dragState.sourceContainer === 'dock' && createPortal(
        <div
          className="dock-drag-preview"
          style={{
            left: dragState.currentX - dragState.offsetX,
            top: dragState.currentY - dragState.offsetY,
          }}
        >
          <div className="dock-drag-preview-header">
            {getPanelIcon(dragState.panelId)}
            <span>{getPanelTitle(dragState.panelId)}</span>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

export default DockContainer;
