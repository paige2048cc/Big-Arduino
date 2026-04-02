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
        viewBox="0 0 202 196"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="presentation"
        preserveAspectRatio="none"
      >
        <path
          d="M34.0127 168.938C20.0022 156.201 32.6245 129.001 42.5752 122.234C17.7384 120.642 -0.558467 96.7956 0.0130253 88.9377C2.00315 61.5704 44.0345 69.9602 58.4961 72.8791C48.9435 64.1225 39.7889 19.7237 58.4961 16.9375C77.2033 14.1513 92.5127 39.9376 95.5124 50.1916C96.4738 53.4778 104.583 -1.70094 120.588 0.040376C134.064 1.50659 132.685 38.6855 128.549 58.1521L139.013 50.1916C155.013 37.6916 195.013 26.9375 200.513 42.9377C204.308 53.9785 194.995 67.6942 180.013 78.4376C164.864 89.2997 145.445 96.5353 146.062 96.7606C148.455 97.6341 166.533 101.948 170.513 103.938C181.013 109.188 204.084 116.773 200.513 133.438C197.513 147.438 161.01 147.336 151.634 142.533C156.258 149.506 171.709 179.904 160.513 192.438C145.16 209.625 115.016 151.688 115.016 151.688C115.016 151.688 108.05 191.214 95.5124 186.438C82.9746 181.661 79.7241 158.587 79.9894 147.31C73.0127 162.938 48.0232 181.674 34.0127 168.938Z"
          fill="#1A2BC3"
        />
        <path
          d="M97.5127 106.663C97.9771 108.255 99.7255 110.544 101.891 110.544C104.379 110.544 104.876 107.724 105.274 106.663"
          stroke="white"
          strokeWidth="2.38815"
          strokeLinecap="round"
        />
        <ellipse cx="81.7539" cy="100.844" rx="11.3437" ry="13.3339" fill="#FDFCFC" />
        <ellipse cx="119.169" cy="95.2713" rx="11.3437" ry="13.3339" fill="#FDFCFC" />
        <ellipse cx="73.0127" cy="118.938" rx="13.5" ry="13" fill="url(#blueBlush1)" />
        <ellipse cx="133.013" cy="108.938" rx="13.5" ry="13" fill="url(#blueBlush2)" />
        <defs>
          <radialGradient id="blueBlush1" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(73.0127 118.938) rotate(90) scale(13 13.5)">
            <stop stopColor="#D74040" />
            <stop offset="1" stopColor="#D9D9D9" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="blueBlush2" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(133.013 108.938) rotate(90) scale(13 13.5)">
            <stop stopColor="#D74040" />
            <stop offset="1" stopColor="#D9D9D9" stopOpacity="0" />
          </radialGradient>
        </defs>
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
