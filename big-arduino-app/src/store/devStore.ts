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

/** User-facing: project page AI dock + chat. Separate from debug FeatureKey flags. */
interface AiAssistantUiPrefs {
  aiAssistantEnabled: boolean;
  toggleAiAssistantEnabled: () => void;
}

interface DevStore extends DevFlags, DevActions, AiAssistantUiPrefs {}

/** Right dock + chat only when explicitly true (guards bad JSON / undefined). */
export function selectAiDockEnabled(s: DevStore): boolean {
  return s.aiAssistantEnabled === true;
}

export const useDevStore = create<DevStore>()(
  persist(
    (set, get) => ({
      globalOnboarding: true,
      componentOnboarding: true,
      aiAssistantHover: true,
      autoDebugging: true,
      yellowCharacter: true,
      simulationErrorPrompts: true,
      pathHighlight: false,
      currentFlowBall: true,

      aiAssistantEnabled: false,

      toggleAiAssistantEnabled: () =>
        set((s) => ({ aiAssistantEnabled: !s.aiAssistantEnabled })),

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
      version: 2,
      migrate: (persistedState, version) => {
        const base =
          persistedState && typeof persistedState === 'object'
            ? { ...(persistedState as Record<string, unknown>) }
            : {};
        // v0→v1: unversioned blob
        if (version < 1) {
          base.aiAssistantEnabled = false;
        }
        // v1→v2: one-time reset so “default off / no right chat” matches product; user can re-enable via toggle
        if (version < 2) {
          base.aiAssistantEnabled = false;
        }
        if (typeof base.aiAssistantEnabled !== 'boolean') {
          base.aiAssistantEnabled = false;
        }
        return base as unknown as DevStore;
      },
      partialize: (state) => ({
        globalOnboarding: state.globalOnboarding,
        componentOnboarding: state.componentOnboarding,
        aiAssistantHover: state.aiAssistantHover,
        autoDebugging: state.autoDebugging,
        yellowCharacter: state.yellowCharacter,
        simulationErrorPrompts: state.simulationErrorPrompts,
        pathHighlight: state.pathHighlight,
        currentFlowBall: state.currentFlowBall,
        aiAssistantEnabled: state.aiAssistantEnabled,
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
