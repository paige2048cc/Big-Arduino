/**
 * DockingContext - Manages dockable panel state
 *
 * Provides Photoshop-like docking functionality for panels:
 * - Panels can be reordered within a container (vertical or horizontal)
 * - Panels can be dragged out to become floating windows
 * - Panels can be docked back into containers
 * - Supports vertical and horizontal layouts
 */

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';

// Panel configuration
export interface PanelConfig {
  id: string;
  title: string;
  icon?: React.ReactNode;
  minHeight?: number;
  defaultHeight?: number;
}

// Position of a floating panel (fixed size: 360x400)
export interface FloatingPosition {
  x: number;
  y: number;
}

// Docked panel state
export interface DockedPanel {
  id: string;
}

// Layout mode for the dock container
export type DockLayoutMode = 'vertical' | 'horizontal';

// Drop zone types
export type DropZonePosition = 'top' | 'bottom' | 'left' | 'right' | 'center';

// Drop zone information
export interface DropZone {
  containerId: string;
  position: DropZonePosition;
  targetPanelId?: string;
}

// Drag state
export interface DragState {
  isDragging: boolean;
  panelId: string | null;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  offsetX: number;
  offsetY: number;
  sourceContainer: string | null;
  activeDropZone: DropZone | null;
}

// Context state
interface DockingState {
  // Panels docked in the container (by order)
  dockedPanels: DockedPanel[];

  // Floating panels (detached from container)
  floatingPanels: Map<string, FloatingPosition>;

  // Layout mode for the dock container
  layoutMode: DockLayoutMode;

  // Divider position (0-1 ratio for split between panels)
  dividerPosition: number;

  // Drag state
  dragState: DragState;

  // Panel registry (all available panels)
  panelRegistry: Map<string, PanelConfig>;
}

// Context actions
interface DockingActions {
  // Register a panel
  registerPanel: (config: PanelConfig) => void;

  // Dock a panel at a specific position
  dockPanel: (panelId: string, position?: DropZonePosition, targetPanelId?: string) => void;

  // Undock a panel (make it floating)
  undockPanel: (panelId: string, x: number, y: number) => void;

  // Reorder panels within dock
  reorderPanels: (fromIndex: number, toIndex: number) => void;

  // Update floating panel position
  updateFloatingPosition: (panelId: string, x: number, y: number) => void;

  // Set layout mode
  setLayoutMode: (mode: DockLayoutMode) => void;

  // Update divider position
  setDividerPosition: (position: number) => void;

  // Drag actions
  startDrag: (panelId: string, x: number, y: number, offsetX: number, offsetY: number, sourceContainer: string) => void;
  updateDrag: (x: number, y: number) => void;
  setActiveDropZone: (dropZone: DropZone | null) => void;
  endDrag: () => void;
  cancelDrag: () => void;

  // Check if panel is docked
  isPanelDocked: (panelId: string) => boolean;

  // Check if panel is floating
  isPanelFloating: (panelId: string) => boolean;

  // Get panel config
  getPanelConfig: (panelId: string) => PanelConfig | undefined;

  // Get docked panel index
  getDockedPanelIndex: (panelId: string) => number;
}

type DockingContextValue = DockingState & DockingActions;

const DockingContext = createContext<DockingContextValue | null>(null);

// Initial drag state
const initialDragState: DragState = {
  isDragging: false,
  panelId: null,
  startX: 0,
  startY: 0,
  currentX: 0,
  currentY: 0,
  offsetX: 0,
  offsetY: 0,
  sourceContainer: null,
  activeDropZone: null,
};

interface DockingProviderProps {
  children: React.ReactNode;
  initialPanelOrder?: string[];
  defaultPanels?: PanelConfig[];
}

export function DockingProvider({
  children,
  initialPanelOrder,
  defaultPanels = []
}: DockingProviderProps) {
  // Panel registry
  const panelRegistry = useRef<Map<string, PanelConfig>>(
    new Map(defaultPanels.map(p => [p.id, p]))
  );

  // Docked panels (order matters)
  const [dockedPanels, setDockedPanels] = useState<DockedPanel[]>(() => {
    const order = initialPanelOrder || defaultPanels.map(p => p.id);
    return order.map(id => ({ id }));
  });

  // Floating panels
  const [floatingPanels, setFloatingPanels] = useState<Map<string, FloatingPosition>>(new Map());

  // Layout mode
  const [layoutMode, setLayoutMode] = useState<DockLayoutMode>('vertical');

  // Divider position (0.4 = 40% for first panel, 60% for second)
  const [dividerPosition, setDividerPosition] = useState(0.4);

  // Drag state
  const [dragState, setDragState] = useState<DragState>(initialDragState);

  // Register a panel
  const registerPanel = useCallback((config: PanelConfig) => {
    panelRegistry.current.set(config.id, config);
  }, []);

  // Get docked panel index
  const getDockedPanelIndex = useCallback((panelId: string) => {
    return dockedPanels.findIndex(p => p.id === panelId);
  }, [dockedPanels]);

  // Dock a panel
  const dockPanel = useCallback((
    panelId: string,
    position: DropZonePosition = 'bottom',
    targetPanelId?: string
  ) => {
    // Remove from floating if present
    setFloatingPanels(prev => {
      const next = new Map(prev);
      next.delete(panelId);
      return next;
    });

    setDockedPanels(prev => {
      // Remove if already docked
      const filtered = prev.filter(p => p.id !== panelId);
      const newPanel: DockedPanel = { id: panelId };

      // Handle horizontal layout switch
      if (position === 'left' || position === 'right') {
        setLayoutMode('horizontal');
        if (position === 'left') {
          return [newPanel, ...filtered];
        } else {
          return [...filtered, newPanel];
        }
      }

      // Vertical layout
      setLayoutMode('vertical');

      if (position === 'top') {
        return [newPanel, ...filtered];
      }

      if (targetPanelId) {
        const targetIndex = filtered.findIndex(p => p.id === targetPanelId);
        if (targetIndex !== -1) {
          const insertIndex = position === 'bottom' ? targetIndex + 1 : targetIndex;
          const result = [...filtered];
          result.splice(insertIndex, 0, newPanel);
          return result;
        }
      }

      return [...filtered, newPanel];
    });
  }, []);

  // Undock a panel (make floating)
  const undockPanel = useCallback((panelId: string, x: number, y: number) => {
    // Remove from docked
    setDockedPanels(prev => prev.filter(p => p.id !== panelId));

    // Add to floating
    setFloatingPanels(prev => {
      const next = new Map(prev);
      next.set(panelId, { x, y });
      return next;
    });
  }, []);

  // Reorder panels
  const reorderPanels = useCallback((fromIndex: number, toIndex: number) => {
    setDockedPanels(prev => {
      if (fromIndex === toIndex) return prev;
      const next = [...prev];
      const [removed] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, removed);
      return next;
    });
  }, []);

  // Update floating position
  const updateFloatingPosition = useCallback((panelId: string, x: number, y: number) => {
    setFloatingPanels(prev => {
      if (!prev.has(panelId)) return prev;
      const next = new Map(prev);
      next.set(panelId, { x, y });
      return next;
    });
  }, []);

  // Drag actions
  const startDrag = useCallback((
    panelId: string,
    x: number,
    y: number,
    offsetX: number,
    offsetY: number,
    sourceContainer: string
  ) => {
    setDragState({
      isDragging: true,
      panelId,
      startX: x,
      startY: y,
      currentX: x,
      currentY: y,
      offsetX,
      offsetY,
      sourceContainer,
      activeDropZone: null,
    });

    // Add dragging class to body
    document.body.classList.add('panel-dragging');
  }, []);

  const updateDrag = useCallback((x: number, y: number) => {
    setDragState(prev => ({
      ...prev,
      currentX: x,
      currentY: y,
    }));
  }, []);

  const setActiveDropZone = useCallback((dropZone: DropZone | null) => {
    setDragState(prev => ({
      ...prev,
      activeDropZone: dropZone,
    }));
  }, []);

  const endDrag = useCallback(() => {
    const { panelId, activeDropZone, currentX, currentY, startX, startY, offsetX, offsetY } = dragState;

    if (!panelId) {
      setDragState(initialDragState);
      document.body.classList.remove('panel-dragging');
      return;
    }

    // Calculate drag distance
    const dragDistance = Math.sqrt(
      Math.pow(currentX - startX, 2) + Math.pow(currentY - startY, 2)
    );

    // If dropped on a valid drop zone
    if (activeDropZone) {
      dockPanel(panelId, activeDropZone.position, activeDropZone.targetPanelId);
    } else if (dragDistance > 50) {
      // Make floating if dragged far enough
      undockPanel(panelId, currentX - offsetX, currentY - offsetY);
    }

    setDragState(initialDragState);
    document.body.classList.remove('panel-dragging');
  }, [dragState, dockPanel, undockPanel]);

  const cancelDrag = useCallback(() => {
    setDragState(initialDragState);
    document.body.classList.remove('panel-dragging');
  }, []);

  // Check if panel is docked
  const isPanelDocked = useCallback((panelId: string) => {
    return dockedPanels.some(p => p.id === panelId);
  }, [dockedPanels]);

  // Check if panel is floating
  const isPanelFloating = useCallback((panelId: string) => {
    return floatingPanels.has(panelId);
  }, [floatingPanels]);

  // Get panel config
  const getPanelConfig = useCallback((panelId: string) => {
    return panelRegistry.current.get(panelId);
  }, []);

  const value: DockingContextValue = {
    dockedPanels,
    floatingPanels,
    layoutMode,
    dividerPosition,
    dragState,
    panelRegistry: panelRegistry.current,
    registerPanel,
    dockPanel,
    undockPanel,
    reorderPanels,
    updateFloatingPosition,
    setLayoutMode,
    setDividerPosition,
    startDrag,
    updateDrag,
    setActiveDropZone,
    endDrag,
    cancelDrag,
    isPanelDocked,
    isPanelFloating,
    getPanelConfig,
    getDockedPanelIndex,
  };

  return (
    <DockingContext.Provider value={value}>
      {children}
      {/* Drag overlay */}
      {dragState.isDragging && createPortal(
        <div className="dock-drag-overlay" />,
        document.body
      )}
    </DockingContext.Provider>
  );
}

// Hook to use docking context
export function useDocking() {
  const context = useContext(DockingContext);
  if (!context) {
    throw new Error('useDocking must be used within a DockingProvider');
  }
  return context;
}

// Hook to get specific panel state
export function usePanelState(panelId: string) {
  const context = useDocking();

  const isDocked = context.isPanelDocked(panelId);
  const isFloating = context.isPanelFloating(panelId);
  const floatingPosition = context.floatingPanels.get(panelId);
  const config = context.getPanelConfig(panelId);
  const dockedIndex = context.getDockedPanelIndex(panelId);

  return {
    isDocked,
    isFloating,
    floatingPosition,
    config,
    dockedIndex,
  };
}

export default DockingContext;
