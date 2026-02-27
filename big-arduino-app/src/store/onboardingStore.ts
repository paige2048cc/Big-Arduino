/**
 * Onboarding Store
 *
 * Zustand store for managing first-time user onboarding state.
 * Uses persist middleware to store completion status in localStorage.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  OnboardingState,
  OnboardingActions,
  OnboardingPhase,
  OnboardingStep,
} from '../types/onboarding';
import { getNextStep, STEP_ORDER } from '../components/onboarding/stepConfigs';

const STORAGE_KEY = 'big-arduino-onboarding';
const TRANSITION_DURATION = 400; // ms

interface OnboardingStore extends OnboardingState, OnboardingActions {}

export const useOnboardingStore = create<OnboardingStore>()(
  persist(
    (set, get) => ({
      // Initial state
      isActive: false,
      currentStep: null,
      phase: 'initial' as OnboardingPhase,
      hasCompletedOnboarding: false,
      toolbarRect: null,
      targetRects: {},
      isTransitioning: false,

      // Initialize onboarding on page load
      initOnboarding: () => {
        const { hasCompletedOnboarding } = get();
        if (!hasCompletedOnboarding) {
          set({
            isActive: true,
            currentStep: 'toolbar-introduction' as OnboardingStep,
            phase: 'initial',
          });
        }
      },

      // Start onboarding manually (for testing/reset)
      startOnboarding: () => {
        set({
          isActive: true,
          currentStep: 'toolbar-introduction' as OnboardingStep,
          phase: 'initial',
          isTransitioning: false,
        });
      },

      // Called when user clicks/drags a component from toolbar
      onComponentClicked: () => {
        const { isActive, phase, currentStep } = get();
        if (isActive && phase === 'initial' && currentStep === 'toolbar-introduction') {
          set({ phase: 'component-clicked' });
        }
      },

      // Called when user drops a component on the canvas
      onComponentDropped: () => {
        const { isActive, phase, currentStep } = get();
        if (isActive && phase === 'component-clicked' && currentStep === 'toolbar-introduction') {
          set({ phase: 'component-dropped' });
        }
      },

      // Go to next step
      goToNextStep: () => {
        const { currentStep } = get();
        if (!currentStep) return;

        const nextStep = getNextStep(currentStep);
        if (nextStep) {
          // Start transition - keep current phase to preserve card content
          set({ isTransitioning: true });

          // After transition, move to next step
          setTimeout(() => {
            set({
              currentStep: nextStep,
              phase: 'initial',
              isTransitioning: false,
            });
          }, TRANSITION_DURATION);
        } else {
          // No more steps, complete onboarding
          set({
            isActive: false,
            currentStep: null,
            phase: 'completed',
            hasCompletedOnboarding: true,
          });
        }
      },

      // Jump to specific step
      goToStep: (step: OnboardingStep) => {
        // Keep current phase during transition to preserve card content
        set({ isTransitioning: true });

        setTimeout(() => {
          set({
            currentStep: step,
            phase: 'initial',
            isTransitioning: false,
          });
        }, TRANSITION_DURATION);
      },

      // Called when user clicks primary button (I got / Next / Done)
      completeStep: () => {
        const { currentStep } = get();

        // For completion step, finish onboarding
        if (currentStep === 'completion') {
          set({
            isActive: false,
            currentStep: null,
            phase: 'completed',
            hasCompletedOnboarding: true,
          });
          return;
        }

        // For all other steps (including step 1), go to next step
        // Step 1: clicking "I got" or "Next" (after congrats) both go to Step 2
        get().goToNextStep();
      },

      // Called when user clicks Skip or presses ESC - jump to completion step
      skipOnboarding: () => {
        const { currentStep } = get();

        // If already on completion step, just finish
        if (currentStep === 'completion') {
          set({
            isActive: false,
            currentStep: null,
            phase: 'completed',
            hasCompletedOnboarding: true,
          });
          return;
        }

        // Jump to completion step - keep current phase during transition
        set({ isTransitioning: true });

        setTimeout(() => {
          set({
            currentStep: 'completion',
            phase: 'initial',
            isTransitioning: false,
          });
        }, TRANSITION_DURATION);
      },

      // Replay onboarding from beginning
      replayOnboarding: () => {
        // Keep current phase during transition to preserve card content
        set({ isTransitioning: true });

        setTimeout(() => {
          set({
            currentStep: STEP_ORDER[0],
            phase: 'initial',
            isTransitioning: false,
          });
        }, TRANSITION_DURATION);
      },

      // Update toolbar rect for overlay positioning
      updateToolbarRect: (rect: DOMRect | null) => {
        set({ toolbarRect: rect });
      },

      // Update target rect for specific panel
      updateTargetRect: (key: string, rect: DOMRect | null) => {
        set((state) => ({
          targetRects: {
            ...state.targetRects,
            [key]: rect,
          },
        }));
      },

      // Reset onboarding (for testing)
      resetOnboarding: () => {
        set({
          isActive: false,
          currentStep: null,
          phase: 'initial',
          hasCompletedOnboarding: false,
          toolbarRect: null,
          targetRects: {},
          isTransitioning: false,
        });
      },
    }),
    {
      name: STORAGE_KEY,
      // Only persist the completion flag
      partialize: (state) => ({
        hasCompletedOnboarding: state.hasCompletedOnboarding,
      }),
    }
  )
);

// Selector hooks for performance
export const useIsOnboardingActive = () =>
  useOnboardingStore((state) => state.isActive);

export const useOnboardingPhase = () =>
  useOnboardingStore((state) => state.phase);

export const useOnboardingStep = () =>
  useOnboardingStore((state) => state.currentStep);

export const useToolbarRect = () =>
  useOnboardingStore((state) => state.toolbarRect);

export const useTargetRects = () =>
  useOnboardingStore((state) => state.targetRects);

export const useIsTransitioning = () =>
  useOnboardingStore((state) => state.isTransitioning);
