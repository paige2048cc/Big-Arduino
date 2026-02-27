/**
 * ReferenceTag Component
 *
 * Displays a component or wire reference as a tag in the chat input.
 * Supports different states: pending (semi-transparent) and confirmed (opaque).
 */

import React from 'react';
import { X, Cpu, Lightbulb, CircleDot, Minus, Grid3X3, Package } from 'lucide-react';
import type { ChatReference } from '../../types/chat';
import './ReferenceTag.css';

interface ReferenceTagProps {
  reference: ChatReference;
  confirmed: boolean;
  onRemove?: () => void;
  showRemoveButton?: boolean;
}

/**
 * Get an icon for the reference type
 */
function getReferenceIcon(reference: ChatReference): React.ReactNode {
  // Use size={12} to match inline-chip icons in ChatInputField
  if (reference.type === 'wire') {
    return <Minus size={12} />;
  }

  if (reference.type === 'multi') {
    return <Package size={12} />;
  }

  // Single component - determine icon based on definitionId
  const defId = reference.definitionId.toLowerCase();

  if (defId.includes('led')) {
    return <Lightbulb size={12} />;
  }
  if (defId.includes('arduino') || defId.includes('uno')) {
    return <Cpu size={12} />;
  }
  if (defId.includes('breadboard')) {
    return <Grid3X3 size={12} />;
  }
  if (defId.includes('button') || defId.includes('pushbutton')) {
    return <CircleDot size={12} />;
  }

  // Default icon
  return <CircleDot size={12} />;
}

/**
 * Get a color class based on the reference type
 */
function getReferenceColorClass(reference: ChatReference): string {
  if (reference.type === 'wire') {
    return 'reference-tag--wire';
  }

  if (reference.type === 'multi') {
    return 'reference-tag--multi';
  }

  // Single component - determine color based on definitionId
  const defId = reference.definitionId.toLowerCase();

  if (defId.includes('led')) {
    return 'reference-tag--led';
  }
  if (defId.includes('arduino') || defId.includes('uno')) {
    return 'reference-tag--arduino';
  }
  if (defId.includes('breadboard')) {
    return 'reference-tag--breadboard';
  }
  if (defId.includes('resistor')) {
    return 'reference-tag--resistor';
  }
  if (defId.includes('button') || defId.includes('pushbutton')) {
    return 'reference-tag--button';
  }

  return 'reference-tag--default';
}

export const ReferenceTag: React.FC<ReferenceTagProps> = ({
  reference,
  confirmed,
  onRemove,
  showRemoveButton = true,
}) => {
  const icon = getReferenceIcon(reference);
  const colorClass = getReferenceColorClass(reference);

  return (
    <div
      className={`reference-tag ${colorClass} ${confirmed ? 'reference-tag--confirmed' : 'reference-tag--pending'}`}
    >
      <span className="reference-tag__icon">{icon}</span>
      <span className="reference-tag__name">{reference.displayName}</span>
      {showRemoveButton && onRemove && (
        <button
          className="reference-tag__remove"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          aria-label="Remove reference"
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
};

export default ReferenceTag;
