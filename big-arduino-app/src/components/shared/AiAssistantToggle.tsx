import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useDevStore, selectAiDockEnabled } from '../../store/devStore';
import './AiAssistantToggle.css';

export function AiAssistantToggle() {
  const enabled = useDevStore(selectAiDockEnabled);
  const toggle = useDevStore((s) => s.toggleAiAssistantEnabled);
  const [body, setBody] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setBody(document.body);
  }, []);

  if (!body) return null;

  return createPortal(
    <div
      className="ai-assistant-toggle"
      title={enabled ? 'Turn off AI Assistant' : 'Turn on AI Assistant (chat & AI tools)'}
    >
      <span className="ai-assistant-toggle__label">AI</span>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={enabled ? 'Disable AI Assistant' : 'Enable AI Assistant'}
        className={`ai-assistant-toggle__switch ${enabled ? 'is-on' : ''}`}
        onClick={() => toggle()}
      >
        <span className="ai-assistant-toggle__thumb" aria-hidden />
      </button>
    </div>,
    body
  );
}
