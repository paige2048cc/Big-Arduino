/**
 * BlueCharacter Component
 *
 * A reusable AI assistant character that appears on the canvas
 * with interactive eye tracking and speech bubble support.
 */

import { useEffect, useRef, useCallback } from 'react';
import { SpeechBubble } from './SpeechBubble';
import './BlueCharacter.css';

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export type CharacterMood = 'thinking' | 'happy' | 'concerned' | 'celebrating';

export interface BlueCharacterProps {
  /** X position on canvas (scene coordinates) */
  x: number;
  /** Y position on canvas (scene coordinates) */
  y: number;
  /** Speech bubble content */
  message?: string;
  /** Visibility control */
  visible: boolean;
  /** Animation state / mood */
  mood?: CharacterMood;
  /** Size variant */
  size?: 'small' | 'medium' | 'large';
  /** Callback when speech bubble is dismissed */
  onDismiss?: () => void;
  /** Optional: specific point for eyes to look at */
  lookAt?: { x: number; y: number } | null;
  /** Speech bubble position relative to character */
  bubblePosition?: 'top' | 'bottom' | 'left' | 'right';
}

const SIZE_SCALES = {
  small: 0.5,
  medium: 1,
  large: 1.5,
};

export function BlueCharacter({
  x,
  y,
  message,
  visible,
  mood = 'happy',
  size = 'medium',
  onDismiss,
  lookAt,
  bubblePosition = 'right',
}: BlueCharacterProps) {
  const eye1SocketRef = useRef<HTMLDivElement>(null);
  const eye1PupilRef = useRef<HTMLDivElement>(null);
  const eye2SocketRef = useRef<HTMLDivElement>(null);
  const eye2PupilRef = useRef<HTMLDivElement>(null);

  const rafIdRef = useRef<number | null>(null);
  const lastMouseRef = useRef({ x: 0, y: 0 });

  const scale = SIZE_SCALES[size];
  const baseWidth = 106;
  const baseHeight = 111;

  const updateEyes = useCallback((targetX: number, targetY: number) => {
    const eyes = [
      { socket: eye1SocketRef, pupil: eye1PupilRef },
      { socket: eye2SocketRef, pupil: eye2PupilRef },
    ];

    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;

    for (const eye of eyes) {
      const socketEl = eye.socket.current;
      const pupilEl = eye.pupil.current;
      if (!socketEl || !pupilEl) continue;

      const rect = socketEl.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = targetX - cx;
      const dy = targetY - cy;
      const dist = Math.hypot(dx, dy);

      const pupilSize = Math.min(rect.width, rect.height) * 0.45;
      const maxOffset = Math.max(0, (Math.min(rect.width, rect.height) - pupilSize) / 2 - 1);
      const move = prefersReducedMotion ? 0 : clamp(dist * 0.04, 0, maxOffset);
      const angle = Math.atan2(dy, dx);

      const ox = Math.cos(angle) * move;
      const oy = Math.sin(angle) * move;

      pupilEl.style.transform = `translate(${ox.toFixed(2)}px, ${oy.toFixed(2)}px)`;
    }
  }, []);

  const resetEyes = useCallback(() => {
    if (rafIdRef.current != null) {
      window.cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    const pupils = [eye1PupilRef.current, eye2PupilRef.current];
    for (const pupilEl of pupils) {
      if (pupilEl) {
        pupilEl.style.transform = 'translate(0px, 0px)';
      }
    }
  }, []);

  // Eye tracking effect
  useEffect(() => {
    if (!visible) {
      resetEyes();
      return;
    }

    // If lookAt is provided, use that position
    if (lookAt) {
      updateEyes(lookAt.x, lookAt.y);
      return;
    }

    // Otherwise, follow mouse
    const onMouseMove = (e: MouseEvent) => {
      lastMouseRef.current = { x: e.clientX, y: e.clientY };
      if (rafIdRef.current != null) return;
      rafIdRef.current = window.requestAnimationFrame(() => {
        rafIdRef.current = null;
        updateEyes(lastMouseRef.current.x, lastMouseRef.current.y);
      });
    };

    window.addEventListener('mousemove', onMouseMove, { passive: true });
    window.addEventListener('blur', resetEyes);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('blur', resetEyes);
      if (rafIdRef.current != null) {
        window.cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [visible, lookAt, updateEyes, resetEyes]);

  if (!visible) {
    return null;
  }

  const characterStyle: React.CSSProperties = {
    position: 'absolute',
    left: x,
    top: y,
    width: baseWidth * scale,
    height: baseHeight * scale,
    transform: 'translate(-50%, -50%)', // Center on position
    pointerEvents: 'none',
  };

  return (
    <div
      className={`blue-character blue-character--${mood} blue-character--${size}`}
      style={characterStyle}
    >
      <svg
        className="blue-character__blob"
        viewBox="0 0 106 111"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="presentation"
      >
        <path
          d="M12.4812 95.4703C4.04302 87.7992 13.9195 77.731 19.9125 73.6558C4.954 72.6969 -0.328517 63.0463 0.0156772 58.3137C1.21428 41.8311 20.7914 42.1726 29.5012 43.9305C23.7479 38.6567 18.2344 1.73981 29.5012 0.0617645C38.9798 -1.34995 49.4765 21.8397 51.5705 28.5226C51.9803 21.9041 58.4883 -0.853159 66.8975 0.0617645C75.0138 0.944824 74.1832 23.3367 71.6919 35.0609L75.048 31.4651C82.3195 25.7118 97.3965 16.9778 103.335 25.7118C110.979 36.9545 81.5004 58.0439 82.2396 58.3137C83.6808 58.8398 88.9517 60.7109 91.3489 61.9095C96.0634 64.946 106.615 73.287 105.972 82.2857C105.308 91.568 91.2426 88.7737 85.5957 85.8815L85.5985 85.8857C88.3852 90.0885 95.6924 101.109 88.9517 108.655C79.7054 119.006 63.5414 91.3951 63.5414 91.3951C63.5414 91.3951 56.7094 111.532 49.1582 108.655C41.6071 105.778 42.2863 95.5502 42.4461 88.7581C35.9737 94.1918 20.9193 103.141 12.4812 95.4703Z"
          fill="#1A2BC3"
        />
        <ellipse cx="43.5088" cy="55.4955" rx="6.83202" ry="8.03061" fill="#FDFCFC" />
        <ellipse cx="66.043" cy="52.139" rx="6.83202" ry="8.03061" fill="#FDFCFC" />
        <path
          d="M53.2178 56.9336C53.4974 57.8925 54.5505 59.2709 55.8547 59.2709C57.3529 59.2709 57.6526 57.5728 57.8923 56.9336"
          stroke="white"
          strokeWidth="1.43832"
          strokeLinecap="round"
        />
      </svg>

      {/* Eyes with pupils that track movement */}
      <div className="blue-character__eye blue-character__eye--1" ref={eye1SocketRef}>
        <div className="blue-character__pupil" ref={eye1PupilRef} />
      </div>
      <div className="blue-character__eye blue-character__eye--2" ref={eye2SocketRef}>
        <div className="blue-character__pupil" ref={eye2PupilRef} />
      </div>

      {/* Speech bubble */}
      {message && (
        <SpeechBubble
          content={message}
          position={bubblePosition}
          onDismiss={onDismiss}
          mood={mood}
        />
      )}
    </div>
  );
}
