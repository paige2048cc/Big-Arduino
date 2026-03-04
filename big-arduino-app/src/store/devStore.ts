/**
 * Developer Feature Flags Store
 *
 * Zustand store for toggling features on/off at runtime.
 * Persisted to localStorage so settings survive page reloads.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const STORAGE_KEY = 'big-arduino-dev-flags';

export type FeatureKey =
  | 'globalOnboarding'
  | 'componentOnboarding'
  | 'aiAssistantHover'
  | 'autoDebugging'
  | 'yellowCharacter'
  | 'simulationErrorPrompts'
  | 'pathHighlight'
  | 'currentFlowBall';

const ALL_KEYS: FeatureKey[] = [
  'globalOnboarding',
  'componentOnboarding',
  'aiAssistantHover',
  'autoDebugging',
  'yellowCharacter',
  'simulationErrorPrompts',
  'pathHighlight',
  'currentFlowBall',
];

interface DevFlags {
  globalOnboarding: boolean;
  componentOnboarding: boolean;
  aiAssistantHover: boolean;
  autoDebugging: boolean;
  yellowCharacter: boolean;
  simulationErrorPrompts: boolean;
  pathHighlight: boolean;
  currentFlowBall: boolean;
}

interface DevActions {
  toggleFeature: (key: FeatureKey) => void;
  setFeature: (key: FeatureKey, value: boolean) => void;
  toggleAll: () => void;
  allEnabled: () => boolean;
}

interface DevStore extends DevFlags, DevActions {}

export const useDevStore = create<DevStore>()(
  persist(
    (set, get) => ({
      globalOnboarding: true,
      componentOnboarding: true,
      aiAssistantHover: true,
      autoDebugging: true,
      yellowCharacter: true,
      simulationErrorPrompts: true,
      pathHighlight: true,
      currentFlowBall: true,

      toggleFeature: (key) => set((s) => ({ [key]: !s[key] })),

      setFeature: (key, value) => set({ [key]: value }),

      toggleAll: () => {
        const allOn = get().allEnabled();
        const next: Partial<DevFlags> = {};
        for (const k of ALL_KEYS) next[k] = !allOn;
        set(next);
      },

      allEnabled: () => ALL_KEYS.every((k) => get()[k]),
    }),
    {
      name: STORAGE_KEY,
      partialize: (state) => ({
        globalOnboarding: state.globalOnboarding,
        componentOnboarding: state.componentOnboarding,
        aiAssistantHover: state.aiAssistantHover,
        autoDebugging: state.autoDebugging,
        yellowCharacter: state.yellowCharacter,
        simulationErrorPrompts: state.simulationErrorPrompts,
        pathHighlight: state.pathHighlight,
        currentFlowBall: state.currentFlowBall,
      }),
    }
  )
);

export const FEATURE_LABELS: Record<FeatureKey, string> = {
  globalOnboarding: 'Global Onboarding',
  componentOnboarding: 'Component Onboarding',
  aiAssistantHover: 'AI Assistant Hover',
  autoDebugging: 'Auto Debugging',
  yellowCharacter: 'Yellow Character',
  simulationErrorPrompts: 'Simulation Error Prompts',
  pathHighlight: 'Path Highlight',
  currentFlowBall: 'Current Flow Ball',
};

export { ALL_KEYS };
