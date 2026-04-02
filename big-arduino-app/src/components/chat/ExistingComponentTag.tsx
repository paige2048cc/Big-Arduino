/**
 * ExistingComponentTag - Tag for existing canvas components
 *
 * Shows a clickable tag for components that already exist on the canvas.
 * On click, highlights and pans to the component on the canvas.
 */

import React from 'react';
import { Cpu, Lightbulb, CircleDot, Grid3X3, Zap } from 'lucide-react';
import './ExistingComponentTag.css';

interface ExistingComponentTagProps {
  instanceId: string;
  displayName: string;
  definitionId: string;
  onClick: (instanceId: string) => void;
}

/**
 * Get an icon based on the component definition ID
 */
function getComponentIcon(definitionId: string): React.ReactNode {
  const defId = definitionId.toLowerCase();

  if (defId.includes('led')) {
    return <Lightbulb size={12} />;
  }
  if (defId.includes('arduino') || defId.includes('uno')) {
    return <Cpu size={12} />;
  }
  if (defId.includes('breadboard')) {
    return <Grid3X3 size={12} />;
  }
  if (defId.includes('resistor') || defId.includes('registor')) {
    return <Zap size={12} />;
  }
  if (defId.includes('button') || defId.includes('pushbutton')) {
    return <CircleDot size={12} />;
  }

  return <CircleDot size={12} />;
}

/**
 * Get color class based on component type
 */
function getColorClass(definitionId: string): string {
  const defId = definitionId.toLowerCase();

  if (defId.includes('led')) {
    return 'existing-tag--led';
  }
  if (defId.includes('arduino') || defId.includes('uno')) {
    return 'existing-tag--arduino';
  }
  if (defId.includes('breadboard')) {
    return 'existing-tag--breadboard';
  }
  if (defId.includes('resistor') || defId.includes('registor')) {
    return 'existing-tag--resistor';
  }
  if (defId.includes('button') || defId.includes('pushbutton')) {
    return 'existing-tag--button';
  }

  return 'existing-tag--default';
}

export const ExistingComponentTag: React.FC<ExistingComponentTagProps> = ({
  instanceId,
  displayName,
  definitionId,
  onClick,
}) => {
  const icon = getComponentIcon(definitionId);
  const colorClass = getColorClass(definitionId);

  const handleClick = () => {
    onClick(instanceId);
  };

  return (
    <button
      className={`existing-component-tag ${colorClass}`}
      onClick={handleClick}
      title={`Click to highlight ${displayName} on canvas`}
    >
      <span className="existing-tag__icon">{icon}</span>
      <span className="existing-tag__name">{displayName}</span>
    </button>
  );
};

export default ExistingComponentTag;
