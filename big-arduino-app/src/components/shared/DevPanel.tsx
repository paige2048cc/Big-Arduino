import { useState } from 'react';
import { Wrench } from 'lucide-react';
import { useDevStore, ALL_KEYS, FEATURE_LABELS, type FeatureKey } from '../../store/devStore';
import './DevPanel.css';

export function DevPanel() {
  const [open, setOpen] = useState(false);

  const store = useDevStore();
  const allOn = ALL_KEYS.every((k) => store[k]);

  return (
    <>
      {/* Fab toggle */}
      <button
        className={`dev-panel-toggle${open ? ' active' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-label="Toggle developer panel"
        type="button"
      >
        <Wrench size={16} />
      </button>

      {/* Floating panel */}
      {open && (
        <div className="dev-panel">
          <div className="dev-panel-header">
            <Wrench size={14} />
            Developer Tools
          </div>

          <div className="dev-panel-rows">
            {/* Master toggle */}
            <div className="dev-panel-row master">
              <span className="dev-panel-row-label">Enable All</span>
              <button
                className="dev-switch"
                role="switch"
                aria-checked={allOn}
                onClick={() => store.toggleAll()}
                type="button"
              />
            </div>

            <div className="dev-panel-divider" />

            {/* Individual feature toggles */}
            {ALL_KEYS.map((key: FeatureKey) => (
              <div className="dev-panel-row" key={key}>
                <span className="dev-panel-row-label">{FEATURE_LABELS[key]}</span>
                <button
                  className="dev-switch"
                  role="switch"
                  aria-checked={store[key]}
                  onClick={() => store.toggleFeature(key)}
                  type="button"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
