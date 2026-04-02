/**
 * ComponentItem - Shared component card
 *
 * Reusable component card used by both ComponentLibrary and chat messages.
 * Supports drag-and-drop and click-to-place functionality.
 */

import React, { useRef, useEffect, useState } from 'react';
import { useCircuitStore, useClickToPlace, useDragPreview } from '../../store/circuitStore';
import {
  useOnboardingStore,
  useIsOnboardingActive,
  useOnboardingPhase,
} from '../../store/onboardingStore';
import './ComponentItem.css';

// Pre-create transparent 1x1 image for hiding native drag preview
const EMPTY_IMG_SRC = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

// Component data structure
export interface ComponentData {
  id: string;
  name: string;
  image: string;
}

interface ComponentItemProps {
  component: ComponentData;
  category: string;
  size?: 'normal' | 'compact';
  highlighted?: boolean;
  onDragStart?: (componentId: string) => void;
}

export function ComponentItem({
  component,
  category,
  size = 'normal',
  highlighted = false,
  onDragStart,
}: ComponentItemProps) {
  const [imageError, setImageError] = useState(false);
  const clickToPlace = useClickToPlace();
  const dragPreview = useDragPreview();
  const startClickToPlace = useCircuitStore((state) => state.startClickToPlace);
  const startDragPreview = useCircuitStore((state) => state.startDragPreview);
  const endDragPreview = useCircuitStore((state) => state.endDragPreview);

  // Onboarding hooks
  const isOnboardingActive = useIsOnboardingActive();
  const onboardingPhase = useOnboardingPhase();
  const onComponentClicked = useOnboardingStore((state) => state.onComponentClicked);

  // Pre-load empty image for hiding native drag preview
  const emptyImgRef = useRef<HTMLImageElement | null>(null);
  useEffect(() => {
    const img = new Image();
    img.src = EMPTY_IMG_SRC;
    emptyImgRef.current = img;
  }, []);

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('componentId', component.id);
    e.dataTransfer.setData('category', category);
    e.dataTransfer.effectAllowed = 'copy';

    // Hide native drag preview - use pre-loaded transparent 1x1 image
    if (emptyImgRef.current) {
      e.dataTransfer.setDragImage(emptyImgRef.current, 0, 0);
    }

    // Start our custom drag preview
    startDragPreview(component.id, category);

    // Notify onboarding that component was clicked/dragged
    if (isOnboardingActive && onboardingPhase === 'initial') {
      onComponentClicked();
    }

    onDragStart?.(component.id);
  };

  const handleDragEnd = () => {
    endDragPreview();
  };

  const handleClick = () => {
    // Notify onboarding that component was clicked
    if (isOnboardingActive && onboardingPhase === 'initial') {
      onComponentClicked();
    }

    startClickToPlace(component.id, category);
  };

  const handleImageError = () => {
    setImageError(true);
  };

  const isSelected = clickToPlace.isActive && clickToPlace.componentId === component.id;
  const isDragging = dragPreview.isActive && dragPreview.componentId === component.id;

  const classNames = [
    'component-item',
    size === 'compact' && 'component-item--compact',
    isSelected && 'selected',
    isDragging && 'dragging',
    highlighted && 'highlighted',
  ].filter(Boolean).join(' ');

  return (
    <div
      className={classNames}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={handleClick}
    >
      <div className="component-thumbnail">
        {!imageError ? (
          <img
            src={`${import.meta.env.BASE_URL}components/${category}/${component.image}`}
            alt={component.name}
            onError={handleImageError}
          />
        ) : (
          <div className="component-placeholder">
            {component.name.charAt(0)}
          </div>
        )}
      </div>
      <span className="component-name">{component.name}</span>
    </div>
  );
}

export default ComponentItem;
