/**
 * OnboardingOverlay Component
 *
 * Main overlay component that renders the dim mask, coachmark card,
 * and drag guidance animation for the onboarding experience.
 *
 * Supports 5 steps with different overlay regions and card positions.
 */

import { useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  useOnboardingStore,
  useIsOnboardingActive,
  useOnboardingPhase,
  useOnboardingStep,
  useToolbarRect,
  useTargetRects,
  useIsTransitioning,
} from '../../store/onboardingStore';
import { CoachmarkCard } from './CoachmarkCard';
import { DragGuidanceAnimation } from './DragGuidanceAnimation';
import { STEP_CONFIGS } from './stepConfigs';
import type { OnboardingStep } from '../../types/onboarding';
import './OnboardingOverlay.css';

// Card positioning constants
const CARD_GAP = 24; // Gap between card and target element
const CARD_WIDTH = 320;
const CARD_WIDTH_COMPLETION = 360;

interface OverlayRegions {
  top: React.CSSProperties;
  bottom: React.CSSProperties;
  left: React.CSSProperties;
  right: React.CSSProperties;
}

// Calculate overlay regions that surround a target rect (leaving it clickable)
function calculateOverlayRegions(targetRect: DOMRect | null): OverlayRegions | null {
  if (!targetRect) return null;

  return {
    top: {
      top: 0,
      left: 0,
      width: '100%',
      height: targetRect.top,
    },
    bottom: {
      top: targetRect.bottom,
      left: 0,
      width: '100%',
      height: `calc(100vh - ${targetRect.bottom}px)`,
    },
    left: {
      top: targetRect.top,
      left: 0,
      width: targetRect.left,
      height: targetRect.height,
    },
    right: {
      top: targetRect.top,
      left: targetRect.right,
      width: `calc(100vw - ${targetRect.right}px)`,
      height: targetRect.height,
    },
  };
}

// Calculate card position based on step config and target rect
function calculateCardPosition(
  step: OnboardingStep,
  targetRect: DOMRect | null
): React.CSSProperties {
  const config = STEP_CONFIGS[step];

  // Completion step: center on screen
  if (config.cardPosition === 'center') {
    return {
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
    };
  }

  if (!targetRect) {
    // Fallback position
    return {
      top: 100,
      left: 320,
    };
  }

  const cardWidth = config.cardVariant === 'completion' ? CARD_WIDTH_COMPLETION : CARD_WIDTH;

  switch (config.cardPosition) {
    case 'right':
      return {
        top: targetRect.top + 60,
        left: targetRect.right + CARD_GAP,
      };
    case 'left':
      return {
        top: targetRect.top + 60,
        left: targetRect.left - cardWidth - CARD_GAP,
      };
    case 'above':
      return {
        top: targetRect.top - 280, // Approximate card height
        left: targetRect.left + (targetRect.width - cardWidth) / 2,
      };
    default:
      return {
        top: 100,
        left: 320,
      };
  }
}

// Get the target rect for current step
function getTargetRectForStep(
  step: OnboardingStep,
  toolbarRect: DOMRect | null,
  targetRects: Record<string, DOMRect | null>
): DOMRect | null {
  const config = STEP_CONFIGS[step];

  // Step 1 uses toolbar rect
  if (step === 'toolbar-introduction') {
    return toolbarRect;
  }

  // Completion step has no target
  if (step === 'completion') {
    return null;
  }

  // Other steps use targetRects by key
  const key = config.targetElement;
  return targetRects[key] || null;
}

export function OnboardingOverlay() {
  const isActive = useIsOnboardingActive();
  const phase = useOnboardingPhase();
  const currentStep = useOnboardingStep();
  const toolbarRect = useToolbarRect();
  const targetRects = useTargetRects();
  const isTransitioning = useIsTransitioning();

  const skipOnboarding = useOnboardingStore((state) => state.skipOnboarding);
  const completeStep = useOnboardingStore((state) => state.completeStep);
  const replayOnboarding = useOnboardingStore((state) => state.replayOnboarding);

  const overlayRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Focus management
  useEffect(() => {
    if (isActive && (phase === 'initial' || phase === 'component-dropped')) {
      previousActiveElement.current = document.activeElement as HTMLElement;
      setTimeout(() => {
        overlayRef.current?.focus();
      }, 100);
    } else if (!isActive && previousActiveElement.current) {
      previousActiveElement.current.focus();
    }
  }, [isActive, phase]);

  // ESC key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isActive) {
        e.preventDefault();
        skipOnboarding();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isActive, skipOnboarding]);

  // Prevent clicks on dimmed area
  const handleMaskClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
  }, []);

  // Calculate current target rect
  const currentTargetRect = useMemo(() => {
    if (!currentStep) return null;
    return getTargetRectForStep(currentStep, toolbarRect, targetRects);
  }, [currentStep, toolbarRect, targetRects]);

  // Calculate overlay regions
  const overlayRegions = useMemo(() => {
    if (!currentStep || currentStep === 'completion') return null;
    return calculateOverlayRegions(currentTargetRect);
  }, [currentStep, currentTargetRect]);

  // Calculate card position
  const cardStyle = useMemo(() => {
    if (!currentStep) return {};
    return calculateCardPosition(currentStep, currentTargetRect);
  }, [currentStep, currentTargetRect]);

  if (!isActive || !currentStep) return null;

  const stepConfig = STEP_CONFIGS[currentStep];
  const showOverlay = phase === 'initial' || phase === 'component-dropped' || isTransitioning;
  const showAnimation = phase === 'component-clicked' && currentStep === 'toolbar-introduction';
  const isCompletionStep = currentStep === 'completion';

  // Calculate animation endpoints (only for step 1)
  const animationStart = toolbarRect
    ? { x: toolbarRect.left + toolbarRect.width / 2, y: toolbarRect.top + 200 }
    : { x: 200, y: 300 };

  const animationEnd = {
    x: window.innerWidth / 2 + 100,
    y: window.innerHeight / 2,
  };

  return createPortal(
    <div
      ref={overlayRef}
      className={`onboarding-overlay ${!showOverlay ? 'onboarding-overlay--hidden' : ''} ${isTransitioning ? 'onboarding-overlay--transitioning' : ''}`}
      role="dialog"
      aria-modal={showOverlay}
      aria-labelledby="coachmark-title"
      tabIndex={-1}
    >
      {/* Full overlay for completion step */}
      {showOverlay && isCompletionStep && (
        <div
          className="onboarding-mask-full"
          onClick={handleMaskClick}
          aria-hidden="true"
        />
      )}

      {/* Overlay regions surrounding the target (target remains clickable) */}
      {showOverlay && !isCompletionStep && overlayRegions && (
        <>
          <div
            className="onboarding-mask-region"
            style={overlayRegions.top}
            onClick={handleMaskClick}
            aria-hidden="true"
          />
          <div
            className="onboarding-mask-region"
            style={overlayRegions.bottom}
            onClick={handleMaskClick}
            aria-hidden="true"
          />
          <div
            className="onboarding-mask-region"
            style={overlayRegions.left}
            onClick={handleMaskClick}
            aria-hidden="true"
          />
          <div
            className="onboarding-mask-region"
            style={overlayRegions.right}
            onClick={handleMaskClick}
            aria-hidden="true"
          />
        </>
      )}

      {/* Fallback mask when target rect is not available */}
      {showOverlay && !isCompletionStep && !overlayRegions && (
        <div
          className="onboarding-mask-fallback"
          onClick={handleMaskClick}
          aria-hidden="true"
        />
      )}

      {/* Coachmark card */}
      {showOverlay && (
        <CoachmarkCard
          config={stepConfig}
          phase={phase}
          onSkip={skipOnboarding}
          onComplete={completeStep}
          onReplay={replayOnboarding}
          style={cardStyle}
          isTransitioning={isTransitioning}
        />
      )}

      {/* Drag guidance animation (Step 1 only) */}
      <DragGuidanceAnimation
        startPoint={animationStart}
        endPoint={animationEnd}
        isPlaying={showAnimation}
      />
    </div>,
    document.body
  );
}
