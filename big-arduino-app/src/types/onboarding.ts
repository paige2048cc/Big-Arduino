/**
 * Onboarding System Type Definitions
 */

export type OnboardingStep =
  | 'toolbar-introduction'    // Step 1: Left component toolbar
  | 'instructions-panel'      // Step 2: Instructions panel
  | 'ai-chat'                 // Step 3: AI Chat panel
  | 'workspace-toolbar'       // Step 4: Bottom workspace toolbar
  | 'completion';             // Step 5: Completion screen

export type OnboardingPhase =
  | 'initial'           // Overlay visible, card shows instructions
  | 'component-clicked' // Overlay hidden, animation playing (Step 1 only)
  | 'component-dropped' // Animation stops, overlay returns with congratulations (Step 1 only)
  | 'completed';        // Step finished, onboarding dismissed

export type CardVariant = 'full' | 'no-media' | 'completion';

export type CardPosition = 'right' | 'left' | 'above' | 'center';

export interface OnboardingState {
  isActive: boolean;
  currentStep: OnboardingStep | null;
  phase: OnboardingPhase;
  hasCompletedOnboarding: boolean;
  toolbarRect: DOMRect | null;
  targetRects: Record<string, DOMRect | null>;
  isTransitioning: boolean;
}

export interface OnboardingStepConfig {
  id: OnboardingStep;
  title: string;
  mediaPlaceholder?: boolean;
  subtitle?: string;
  body?: string;
  stepNumber: number;
  totalSteps: number;
  congratsTitle?: string;
  congratsBody?: string;
  cardVariant: CardVariant;
  targetElement: string;
  cardPosition: CardPosition;
  primaryButtonText: string;
  showSkip: boolean;
}

export interface OnboardingActions {
  initOnboarding: () => void;
  startOnboarding: () => void;
  onComponentClicked: () => void;
  onComponentDropped: () => void;
  completeStep: () => void;
  skipOnboarding: () => void;
  updateToolbarRect: (rect: DOMRect | null) => void;
  updateTargetRect: (key: string, rect: DOMRect | null) => void;
  goToNextStep: () => void;
  goToStep: (step: OnboardingStep) => void;
  replayOnboarding: () => void;
  resetOnboarding: () => void;
}
