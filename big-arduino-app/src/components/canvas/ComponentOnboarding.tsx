/**
 * Component Onboarding Overlay
 *
 * Shows an onboarding image when a component is first placed on the canvas.
 * The image is centered on the component and fades out after 10 seconds.
 */

import { useEffect, useState, useCallback } from 'react';
import './ComponentOnboarding.css';

// Map component definition IDs to their onboarding image filenames
const ONBOARDING_IMAGES: Record<string, string> = {
  'breadboard': 'Breadboard-Onboarding.png',
  'led-5mm': 'LED-Onboarding.png',
  'buzzer': 'Buzzer-Onboarding.png',
};

interface ComponentOnboardingProps {
  instanceId: string;
  definitionId: string;
  centerX: number;  // Canvas coordinates (scene space)
  centerY: number;
  viewportTransform: number[];  // Fabric.js viewport transform [scaleX, 0, 0, scaleY, translateX, translateY]
  onComplete: () => void;
  manual?: boolean;  // If true, skip auto-hide (user toggled manually)
}

export function ComponentOnboarding({
  definitionId,
  centerX,
  centerY,
  viewportTransform,
  onComplete,
  manual = false,
}: ComponentOnboardingProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [isFading, setIsFading] = useState(false);

  // Get onboarding image for this component
  const imageFilename = ONBOARDING_IMAGES[definitionId];

  // Handle fade out
  const startFadeOut = useCallback(() => {
    setIsFading(true);
    // After fade animation completes, call onComplete
    setTimeout(() => {
      setIsVisible(false);
      onComplete();
    }, 500); // Match CSS transition duration
  }, [onComplete]);

  // Auto-hide after 10 seconds (only when not manually triggered)
  useEffect(() => {
    if (!imageFilename) {
      // No onboarding image for this component, immediately complete
      onComplete();
      return;
    }

    if (manual) return; // Manual mode: stay visible until user dismisses

    const timer = setTimeout(() => {
      startFadeOut();
    }, 10000);

    return () => clearTimeout(timer);
  }, [imageFilename, manual, startFadeOut, onComplete]);

  // If no image or not visible, don't render
  if (!imageFilename || !isVisible) {
    return null;
  }

  // Convert scene coordinates to screen coordinates
  const screenX = centerX * viewportTransform[0] + viewportTransform[4];
  const screenY = centerY * viewportTransform[3] + viewportTransform[5];

  // Get zoom scale from viewport transform
  const scale = viewportTransform[0];

  const imageUrl = `${import.meta.env.BASE_URL}Component_Onboarding/${imageFilename}`;

  return (
    <div
      className={`component-onboarding ${isFading ? 'fading' : ''}`}
      style={{
        left: screenX,
        top: screenY,
        transform: `translate(-50%, -50%) scale(${scale})`,
      }}
    >
      <img src={imageUrl} alt={`${definitionId} onboarding`} />
    </div>
  );
}

/**
 * Check if a component has an onboarding image available
 */
export function hasOnboardingImage(definitionId: string): boolean {
  return definitionId in ONBOARDING_IMAGES;
}
