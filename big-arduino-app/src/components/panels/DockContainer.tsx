/**
 * DockContainer - Container for docked panels
 *
 * Manages:
 * - Vertical or horizontal layout of docked panels
 * - Separate resize logic for each mode
 * - Drop zones for docking floating panels
 * - Drag preview during panel dragging
 */

import React, { useRef, useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useDocking, type DropZone } from '../../contexts/DockingContext';
import { DockablePanel } from './DockablePanel';
import { FloatingPanel } from './FloatingPanel';
import { InstructionsPanel } from './InstructionsPanel';
import { useCircuitStore } from '../../store/circuitStore';
import { MessageCircle } from 'lucide-react';
import characterIcon from '../../assets/character_blue.svg';
import characterYellowIcon from '../../assets/character_yellow.svg';
import './DockContainer.css';

/** Small sub-component so it can use hooks for hover → store */
function AIAssistantIcon() {
  const setAICharacterHovered = useCircuitStore((s) => s.setAICharacterHovered);
  const aiCharacterOut = useCircuitStore((s) => s.aiCharacterOut);
  return (
    <div
      data-debugging-anchor="true"
      style={{ display: 'flex', cursor: 'pointer' }}
      onMouseEnter={() => setAICharacterHovered(true)}
      onMouseLeave={() => setAICharacterHovered(false)}
    >
      <img
        src={characterIcon}
        alt=""
        style={{
          width: 28,
          height: 28,
          opacity: aiCharacterOut ? 0 : 1,
          transition: 'opacity 0.3s ease',
        }}
      />
    </div>
  );
}

interface DockContainerProps {
  // Render function for AI Chat panel content
  renderAIChat: () => React.ReactNode;
}

export function DockContainer({ renderAIChat }: DockContainerProps) {
  const {
    dockedPanels,
    floatingPanels,
    layoutMode,
    dragState,
    setActiveDropZone,
    getPanelConfig,
    getPanelDimensions,
    setPanelHeight,
    setPanelWidth,
  } = useDocking();

  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredDropZone, setHoveredDropZone] = useState<DropZone | null>(null);

  // ==================== VERTICAL MODE RESIZE ====================
  const [isResizingVertical, setIsResizingVertical] = useState(false);

  const handleVerticalDividerMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsResizingVertical(true);
    e.preventDefault();
  }, []);

  useEffect(() => {
    if (!isResizingVertical || layoutMode !== 'vertical') return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current || dockedPanels.length < 2) return;

      const rect = containerRef.current.getBoundingClientRect();
      const mouseY = e.clientY - rect.top;
      const dividerHeight = 4;
      const minHeight = 100; // minimum panel height in pixels
      const totalHeight = rect.height - dividerHeight;

      // Panel 1 height = mouse position (clamped)
      const panel1Height = Math.max(minHeight, Math.min(totalHeight - minHeight, mouseY));
      // Panel 2 height = remaining space
      const panel2Height = totalHeight - panel1Height;

      const [panel1, panel2] = dockedPanels;
      setPanelHeight(panel1.id, panel1Height);
      setPanelHeight(panel2.id, panel2Height);
    };

    const handleMouseUp = () => {
      setIsResizingVertical(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingVertical, layoutMode, dockedPanels, setPanelHeight]);

  // ==================== HORIZONTAL MODE RESIZE ====================
  const [resizingPanelId, setResizingPanelId] = useState<string | null>(null);
  const resizeStartX = useRef<number>(0);
  const resizeStartWidth = useRef<number>(0);

  const handlePanelResizeStart = useCallback((panelId: string, e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setResizingPanelId(panelId);
    resizeStartX.current = e.clientX;
    resizeStartWidth.current = getPanelDimensions(panelId).width;
    e.preventDefault();
  }, [getPanelDimensions]);

  useEffect(() => {
    if (!resizingPanelId || layoutMode !== 'horizontal') return;

    const handleMouseMove = (e: MouseEvent) => {
      // Calculate minWidth dynamically in JS
      const minWidth = window.innerWidth * 0.12;

      // Dragging left = increase width, dragging right = decrease width
      const deltaX = resizeStartX.current - e.clientX;
      const newWidth = Math.max(minWidth, resizeStartWidth.current + deltaX);

      // ONLY affects this panel's width
      setPanelWidth(resizingPanelId, newWidth);
    };

    const handleMouseUp = () => {
      setResizingPanelId(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizingPanelId, layoutMode, setPanelWidth]);

  // ==================== WINDOW RESIZE HANDLING ====================
  useEffect(() => {
    if (layoutMode !== 'horizontal') return;

    const handleWindowResize = () => {
      const minWidth = window.innerWidth * 0.12;

      // Auto-correct if current width < new minWidth
      dockedPanels.forEach(panel => {
        const dims = getPanelDimensions(panel.id);
        if (dims.width < minWidth) {
          setPanelWidth(panel.id, minWidth);
        }
      });
    };

    window.addEventListener('resize', handleWindowResize);
    return () => window.removeEventListener('resize', handleWindowResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutMode, dockedPanels.length]);

  // ==================== INITIALIZE PANEL HEIGHTS ====================
  // Track if heights have been initialized for current panel configuration
  const heightsInitializedRef = useRef<string>('');

  useEffect(() => {
    if (layoutMode !== 'vertical' || !containerRef.current || dockedPanels.length < 2) return;

    // Create a key for current panel configuration
    const panelKey = dockedPanels.map(p => p.id).join(',');

    // Skip if already initialized for this configuration
    if (heightsInitializedRef.current === panelKey) return;

    const rect = containerRef.current.getBoundingClientRect();
    if (rect.height === 0) return; // Container not yet rendered

    const dividerHeight = 4;
    const totalHeight = rect.height - dividerHeight;

    const [panel1, panel2] = dockedPanels;
    const dims1 = getPanelDimensions(panel1.id);
    const dims2 = getPanelDimensions(panel2.id);

    // If heights are default values (300), initialize them to split container equally
    if (dims1.height === 300 && dims2.height === 300) {
      const halfHeight = totalHeight / 2;
      setPanelHeight(panel1.id, halfHeight);
      setPanelHeight(panel2.id, halfHeight);
    }

    // Mark as initialized
    heightsInitializedRef.current = panelKey;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutMode, dockedPanels]);

  // ==================== DROP ZONE DETECTION ====================
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

  // ==================== RENDER HELPERS ====================
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

  const getPanelIcon = (panelId: string) => {
    switch (panelId) {
      case 'instructions':
        return <img src={characterYellowIcon} alt="" style={{ width: 28, height: 28 }} />;
      case 'ai-assistant':
        return <AIAssistantIcon />;
      default:
        return <MessageCircle size={16} />;
    }
  };

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

  // ==================== GET PANEL STYLE ====================
  const getPanelStyle = (panelId: string): React.CSSProperties => {
    const dims = getPanelDimensions(panelId);

    if (dockedPanels.length === 1) {
      // Single panel fills container
      return layoutMode === 'vertical' ? { flex: 1 } : { width: dims.width };
    }

    if (layoutMode === 'vertical') {
      // Vertical: explicit height in pixels
      return { height: dims.height, flexShrink: 0 };
    } else {
      // Horizontal: explicit width in pixels
      return { width: dims.width, flexShrink: 0 };
    }
  };

  // ==================== CALCULATE CONTAINER WIDTH (HORIZONTAL MODE) ====================
  const getContainerStyle = (): React.CSSProperties | undefined => {
    if (layoutMode !== 'horizontal' || dockedPanels.length === 0) {
      return undefined;
    }

    // Container width = sum of all panel widths
    const totalWidth = dockedPanels.reduce(
      (sum, panel) => sum + getPanelDimensions(panel.id).width,
      0
    );

    return { width: totalWidth };
  };

  const isResizing = isResizingVertical || resizingPanelId !== null;

  return (
    <>
      <div
        ref={containerRef}
        className={`dock-container ${layoutMode} ${isResizing ? 'resizing' : ''} ${dragState.isDragging ? 'panel-dragging' : ''}`}
        style={getContainerStyle()}
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
            <div className="dock-panel-wrapper" style={getPanelStyle(panel.id)}>
              {/* Horizontal mode: individual resize handle on left edge */}
              {layoutMode === 'horizontal' && (
                <div
                  className={`panel-resize-handle ${resizingPanelId === panel.id ? 'active' : ''}`}
                  onMouseDown={(e) => handlePanelResizeStart(panel.id, e)}
                />
              )}

              <DockablePanel
                id={panel.id}
                title={getPanelTitle(panel.id)}
                icon={getPanelIcon(panel.id)}
              >
                {renderPanelContent(panel.id)}
              </DockablePanel>
            </div>

            {/* Vertical mode only: divider between panels */}
            {layoutMode === 'vertical' && index < dockedPanels.length - 1 && (
              <div
                className="dock-divider vertical"
                onMouseDown={handleVerticalDividerMouseDown}
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
