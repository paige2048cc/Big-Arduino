/**
 * Component Properties Panel
 *
 * Floating panel that shows when a component is selected.
 * Displays component info and editable properties.
 */

import { useEffect, useState } from 'react';
import { X, Trash2 } from 'lucide-react';
import { useCircuitStore, useSelectedComponent } from '../../store/circuitStore';
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
    removeComponent,
    selectComponent,
  } = useCircuitStore();

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

  // Handle delete - remove component from store and close panel
  const handleDelete = () => {
    const instanceId = selectedComponent.instanceId;
    selectComponent(null); // Deselect first
    removeComponent(instanceId); // Then remove
    onClose?.();
  };

  return (
    <div className="properties-panel">
      {/* Header */}
      <div className="properties-header">
        <h3>{definition.name}</h3>
        <div className="properties-actions">
          <button className="delete-btn" onClick={handleDelete} title="Delete Component">
            <Trash2 size={16} />
          </button>
          <button className="close-btn" onClick={onClose} title="Close">
            <X size={18} />
          </button>
        </div>
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
