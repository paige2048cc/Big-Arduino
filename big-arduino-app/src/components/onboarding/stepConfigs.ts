/**
 * Onboarding Step Configurations
 */

import type { OnboardingStep, OnboardingStepConfig } from '../../types/onboarding';

export const STEP_CONFIGS: Record<OnboardingStep, OnboardingStepConfig> = {
  'toolbar-introduction': {
    id: 'toolbar-introduction',
    title: 'Welcome to Big Arduino',
    mediaPlaceholder: true,
    subtitle: 'To Start',
    body: 'Drag component in to work space',
    stepNumber: 1,
    totalSteps: 5,
    congratsTitle: 'Congratulations!',
    congratsBody: 'You successfully placed your first component.',
    cardVariant: 'full',
    targetElement: '.left-panel--floating',
    cardPosition: 'right',
    primaryButtonText: 'I got',
    showSkip: true,
  },
  'instructions-panel': {
    id: 'instructions-panel',
    title: 'Follow the Instructions',
    mediaPlaceholder: true,
    subtitle: 'Step by Step',
    body: 'The Instructions panel provides detailed steps to guide you through building your circuit project.',
    stepNumber: 2,
    totalSteps: 5,
    cardVariant: 'full',
    targetElement: '[data-panel-id="instructions"]',
    cardPosition: 'left',
    primaryButtonText: 'I got',
    showSkip: true,
  },
  'ai-chat': {
    id: 'ai-chat',
    title: 'AI Co-creation',
    mediaPlaceholder: true,
    subtitle: '',
    body: 'Chat with our AI to help you build your ideals and understand your circuits.',
    stepNumber: 3,
    totalSteps: 5,
    cardVariant: 'full',
    targetElement: '[data-panel-id="ai-assistant"]',
    cardPosition: 'left',
    primaryButtonText: 'I got',
    showSkip: true,
  },
  'workspace-toolbar': {
    id: 'workspace-toolbar',
    title: 'Toolbar',
    body: 'Use these tools to zoom, undo, rotate components, and control your workspace.',
    stepNumber: 4,
    totalSteps: 5,
    cardVariant: 'no-media',
    targetElement: '.canvas-toolbar',
    cardPosition: 'above',
    primaryButtonText: 'I got',
    showSkip: true,
  },
  'completion': {
    id: 'completion',
    title: 'Enjoy Your Arduino Journey!',
    stepNumber: 5,
    totalSteps: 5,
    cardVariant: 'completion',
    targetElement: '',
    cardPosition: 'center',
    primaryButtonText: 'Done',
    showSkip: false,
  },
};

// Step order for navigation
export const STEP_ORDER: OnboardingStep[] = [
  'toolbar-introduction',
  'instructions-panel',
  'ai-chat',
  'workspace-toolbar',
  'completion',
];

// Get next step in sequence
export function getNextStep(currentStep: OnboardingStep): OnboardingStep | null {
  const currentIndex = STEP_ORDER.indexOf(currentStep);
  if (currentIndex === -1 || currentIndex >= STEP_ORDER.length - 1) {
    return null;
  }
  return STEP_ORDER[currentIndex + 1];
}
