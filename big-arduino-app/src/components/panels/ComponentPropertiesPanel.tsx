/**
 * Component Properties Panel
 *
 * Floating panel that shows when a component is selected.
 * Displays component info and editable properties.
 */

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useCircuitStore, useSelectedComponent, useActiveOnboarding } from '../../store/circuitStore';
import { hasOnboardingImage } from '../canvas/ComponentOnboarding';
import type { ComponentDefinition } from '../../types/components';
import './ComponentPropertiesPanel.css';

interface ComponentPropertiesPanelProps {
  onClose?: () => void;
}

export function ComponentPropertiesPanel({ onClose }: ComponentPropertiesPanelProps) {
  const selectedComponent = useSelectedComponent();
  const {
    getComponentDefinition,
    updateComponentProperty,
    triggerOnboardingForComponent,
    hideOnboarding,
  } = useCircuitStore();
  const activeOnboarding = useActiveOnboarding();

  const [definition, setDefinition] = useState<ComponentDefinition | null>(null);

  // Load definition when component changes
  useEffect(() => {
    if (selectedComponent) {
      const def = getComponentDefinition(selectedComponent.instanceId);
      setDefinition(def || null);
    } else {
      setDefinition(null);
    }
  }, [selectedComponent, getComponentDefinition]);

  if (!selectedComponent || !definition) {
    return null;
  }

  // Handle property change
  const handlePropertyChange = (key: string, value: string | number) => {
    updateComponentProperty(selectedComponent.instanceId, key, value);
  };

  const isOnboardingActive = activeOnboarding?.instanceId === selectedComponent.instanceId;

  const handleHelpToggle = () => {
    if (isOnboardingActive) {
      hideOnboarding();
    } else {
      triggerOnboardingForComponent(selectedComponent.instanceId);
    }
  };

  return (
    <div className="properties-panel">
      {/* Header */}
      <div className="properties-header">
        <div className="properties-title-row">
          <h3>{definition.name}</h3>
          <button className="close-btn" onClick={onClose} title="Close">
            <X size={18} />
          </button>
        </div>
        {hasOnboardingImage(definition.id) && (
          <div className="properties-guide-row">
            <span className="guide-label">Guide</span>
            <button
              className={`help-switch${isOnboardingActive ? ' on' : ''}`}
              onClick={handleHelpToggle}
              title={isOnboardingActive ? 'Hide Guide' : 'Show Guide'}
            >
              <span className="help-switch-track">
                <span className="help-switch-thumb" />
              </span>
              <span className="help-switch-label">{isOnboardingActive ? 'ON' : 'OFF'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Description Section */}
      {definition.description && (
        <div className="properties-section">
          <p className="component-description">{definition.description}</p>
        </div>
      )}

      {/* Properties Section */}
      {definition.properties && Object.keys(definition.properties).length > 0 && (
        <div className="properties-section">
          <h4>Properties</h4>
          <div className="properties-list">
            {Object.entries(definition.properties).map(([key, propDef]) => (
              <div key={key} className="property-item">
                <label>{key.charAt(0).toUpperCase() + key.slice(1)}</label>
                {propDef.type === 'select' && propDef.options && (
                  <select
                    value={selectedComponent.properties[key] ?? propDef.default ?? ''}
                    onChange={(e) => handlePropertyChange(key, e.target.value)}
                  >
                    {propDef.options.map((option) => (
                      <option key={option} value={option}>
                        {option.charAt(0).toUpperCase() + option.slice(1)}
                      </option>
                    ))}
                  </select>
                )}
                {propDef.type === 'number' && (
                  <input
                    type="number"
                    value={selectedComponent.properties[key] ?? propDef.default ?? ''}
                    min={propDef.min}
                    max={propDef.max}
                    onChange={(e) => handlePropertyChange(key, Number(e.target.value))}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
