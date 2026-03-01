/**
 * SpeechBubble Component
 *
 * A speech bubble that appears next to the AI character
 * with support for different positions and dismissal.
 */

import { X } from 'lucide-react';
import type { CharacterMood } from './BlueCharacter';
import './BlueCharacter.css';

export interface SpeechBubbleProps {
  /** The text content to display */
  content: string;
  /** Position relative to the character */
  position?: 'top' | 'bottom' | 'left' | 'right';
  /** Maximum width of the bubble */
  maxWidth?: number;
  /** Callback when dismissed */
  onDismiss?: () => void;
  /** Optional action buttons */
  actions?: Array<{
    label: string;
    onClick: () => void;
  }>;
  /** Current mood for styling */
  mood?: CharacterMood;
}

export function SpeechBubble({
  content,
  position = 'right',
  maxWidth = 280,
  onDismiss,
  actions,
  mood = 'happy',
}: SpeechBubbleProps) {
  const bubbleStyle: React.CSSProperties = {
    maxWidth,
    pointerEvents: 'auto',
  };

  return (
    <div
      className={`speech-bubble speech-bubble--${position} speech-bubble--${mood}`}
      style={bubbleStyle}
    >
      {onDismiss && (
        <button
          className="speech-bubble__close"
          onClick={onDismiss}
          aria-label="Dismiss"
          type="button"
        >
          <X size={14} />
        </button>
      )}

      <div className="speech-bubble__content">
        {content}
      </div>

      {actions && actions.length > 0 && (
        <div className="speech-bubble__actions">
          {actions.map((action, index) => (
            <button
              key={index}
              className="speech-bubble__action"
              onClick={action.onClick}
              type="button"
            >
              {action.label}
            </button>
          ))}
        </div>
      )}

      <div className="speech-bubble__arrow" />
    </div>
  );
}
