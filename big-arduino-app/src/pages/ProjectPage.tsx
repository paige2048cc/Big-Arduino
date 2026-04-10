import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Usb, Unplug, Play, Square } from 'lucide-react';
import { presetProjects } from '../data/projects';
import { useSerial } from '../hooks/useSerial';
import { ThreePanelLayout } from '../components/layout';
import { LeftPanel, RightPanel, ComponentPropertiesPanel, DockContainer, InstructionsPanel } from '../components/panels';
import { isLedButtonWorkspaceStarterComplete } from '../components/panels/InstructionsPanel';
import { CircuitCanvas } from '../components/canvas';
import { useButtonStates, useClickToPlace, useCircuitStore, useWires, useSimulationErrors } from '../store/circuitStore';
import { DockingProvider, type PanelConfig } from '../contexts/DockingContext';
import type { ChatReference } from '../types/chat';
import { sendMessage, isAIServiceConfigured, getFallbackResponse, parseAIResponse, type CircuitState, type ProjectContext, type ConversationMessage } from '../services/aiService';
// Character positioning is available for future debugging hints feature
// import { calculateCharacterPosition } from '../services/characterPositioning';
import { LedProjectTopBanner } from '../components/project/LedProjectTopBanner';
import { OnboardingOverlay } from '../components/onboarding';
import { AIDebuggingOverlay, OvercrowdedPinWarning, SimulationWireWarning } from '../components/ai';
import { useOnboardingStore } from '../store/onboardingStore';
import { useDevStore } from '../store/devStore';
import {
  isLedButtonPowerRailsWired,
  isLedButtonD19ToBottomPlusRailWired,
  isLedButtonH12ToBottomMinusRailWired,
} from '../utils/ledButtonPowerRails';
import { loadComponentByFileName } from '../services/componentService';
import { computeSnapPositionForBreadboardPins } from '../services/breadboardSnapping';
import type { PlacedComponent } from '../types/components';

// Default panel configurations for the docking system
const DEFAULT_PANELS: PanelConfig[] = [
  { id: 'instructions', title: 'Instructions', minHeight: 120, defaultHeight: 280 },
  { id: 'ai-assistant', title: 'AI Assistant', minHeight: 200, defaultHeight: 400 },
];

const AI_CHAT_PANELS: PanelConfig[] = [
  { id: 'ai-assistant', title: 'AI Assistant', minHeight: 200, defaultHeight: 400 },
];

/** Button-Powered LED: hide Instructions in the dock only; step + toolbar highlights run via headless panel. */
const LED_BUTTON_PROJECT_ID = 'led-button';
const AI_SESSION_PROJECT_ID = 'ai-session';
let lastOpenedProjectId: string | undefined;

/** Frame 2 SVG (656×162): blue “Next” pill — path bounds in viewBox space */
const LED_BANNER_FRAME2_NEXT_RECT = {
  x: 202 / 656,
  y: 81.4844 / 162,
  w: 60 / 656,
  h: (121.167 - 81.4844) / 162,
} as const;

/** Frame 5 (638×218): blue “Next” pill — path bounds in led-button-frame-5.svg (not same Y as Frame 2) */
const LED_BANNER_FRAME5_NEXT_RECT = {
  x: 386.678 / 638,
  y: 150 / 218,
  w: (446.678 - 386.678) / 638,
  h: (189.683 - 150) / 218,
} as const;

/** Frame 8 (805×208): blue “Next” pill — rounded rect fill #1A2BC3 */
const LED_BANNER_FRAME8_NEXT_RECT = {
  x: 414.218 / 805,
  y: 168 / 208,
  w: (474.218 - 414.218) / 805,
  h: (207.683 - 168) / 208,
} as const;

/** Frame 11 (903×326): blue “Next” pill — rounded rect fill #1A2BC3 */
const LED_BANNER_FRAME11_NEXT_RECT = {
  x: 510.092 / 903,
  y: 258 / 326,
  w: (570.092 - 510.092) / 903,
  h: (297.683 - 258) / 326,
} as const;

/** Frame 14 (737×274): blue “Next” pill — rounded rect fill #1A2BC3 */
const LED_BANNER_FRAME14_NEXT_RECT = {
  x: 426.175 / 737,
  y: 206 / 274,
  w: (486.175 - 426.175) / 737,
  h: (245.683 - 206) / 274,
} as const;

/** Frame 16 (722×162): blue “Next” pill — rounded rect fill #1A2BC3 */
const LED_BANNER_FRAME16_NEXT_RECT = {
  x: 237 / 722,
  y: 88.4844 / 162,
  w: 60 / 722,
  h: (128.167 - 88.4844) / 162,
} as const;

/** Frame 18 (662×194): blue “Next” pill — rounded rect fill #1A2BC3 */
const LED_BANNER_FRAME18_NEXT_RECT = {
  x: 221 / 662,
  y: 126 / 194,
  w: 60 / 662,
  h: (165.683 - 126) / 194,
} as const;

/** Breadboard tie-point id: column A–J + row (e.g. I12). */
function isBreadboardPinInColumnsGThroughJRows1To30(bbPinId: string): boolean {
  const m = bbPinId.match(/^([A-J])(\d+)$/i);
  if (!m) return false;
  const col = m[1].toUpperCase();
  const row = parseInt(m[2], 10);
  if (row < 1 || row > 30) return false;
  return 'GHIJ'.includes(col);
}

/** Non-decorative led-5mm with all legs in breadboard zone G–J, rows 1–30. */
function isUserLed5mmInGJZone(comp: PlacedComponent): boolean {
  if (comp.definitionId !== 'led-5mm' || comp.decorativeOnly || !comp.insertedPins) return false;
  const pins = Object.values(comp.insertedPins);
  if (pins.length === 0) return false;
  return pins.every((bbPin) => isBreadboardPinInColumnsGThroughJRows1To30(bbPin));
}

const RESISTOR_DEF_ID = 'registor_220ω';

function parseBreadboardPinId(bbPinId: string): { col: string; row: number } | null {
  const m = bbPinId.match(/^([A-J])(\d+)$/i);
  if (!m) return null;
  return { col: m[1].toUpperCase(), row: parseInt(m[2], 10) };
}

/** Non-decorative instance from `pushbutton.json` (`id: "pushbutton"`). */
function isUserPushbuttonPlacedComponent(c: PlacedComponent): boolean {
  if (c.decorativeOnly) return false;
  return c.definitionId === 'pushbutton' || c.definitionId.toLowerCase() === 'pushbutton';
}

/**
 * Pushbutton legs exactly on the four corners **E17, E19, F17, F19** (matches Push button.svg / overlay bbox).
 * Order of `insertedPins` values does not matter.
 */
const FRAME12_PUSHBUTTON_RECT_HOLES = new Set(['E17', 'E19', 'F17', 'F19']);

function pushbuttonInsertedPinsMatchFrame12F17To19Zone(insertedPins: Record<string, string>): boolean {
  const holes = new Set(Object.values(insertedPins).map((h) => h.toUpperCase()));
  if (holes.size !== 4) return false;
  for (const id of FRAME12_PUSHBUTTON_RECT_HOLES) {
    if (!holes.has(id)) return false;
  }
  return true;
}

/** Breadboard columns E–I, rows 1–30 (Frame 10 gate). */
function isBreadboardPinInColumnsEThroughIRows1To30(bbPinId: string): boolean {
  const p = parseBreadboardPinId(bbPinId);
  if (!p || p.row < 1 || p.row > 30) return false;
  return 'EFGHI'.includes(p.col);
}

/** User 220Ω resistor fully in E–I × 1–30, overlapping decorative resistor holes OR sharing a column with any user LED pin. */
function shouldAdvanceLedBannerToFrame10(
  placed: PlacedComponent[],
  decorativeResistorInstanceId: string | null
): boolean {
  const decorative = decorativeResistorInstanceId
    ? placed.find((c) => c.instanceId === decorativeResistorInstanceId)
    : placed.find((c) => c.definitionId === RESISTOR_DEF_ID && c.decorativeOnly);
  if (!decorative?.insertedPins) return false;

  const userLed = placed.find(
    (c) => c.definitionId === 'led-5mm' && !c.decorativeOnly && c.insertedPins
  );
  if (!userLed?.insertedPins) return false;

  const ledCols = new Set(
    Object.values(userLed.insertedPins)
      .map(parseBreadboardPinId)
      .filter(Boolean)
      .map((p) => p!.col)
  );
  const decorativeHoles = new Set(Object.values(decorative.insertedPins));

  const userResistors = placed.filter(
    (c) => c.definitionId === RESISTOR_DEF_ID && !c.decorativeOnly && c.insertedPins
  );
  for (const res of userResistors) {
    const holes = Object.values(res.insertedPins!);
    if (holes.length === 0) continue;
    if (!holes.every(isBreadboardPinInColumnsEThroughIRows1To30)) continue;

    for (const h of holes) {
      if (decorativeHoles.has(h)) return true;
    }
    const resCols = holes
      .map(parseBreadboardPinId)
      .filter(Boolean)
      .map((p) => p!.col);
    if (resCols.some((col) => ledCols.has(col))) return true;
  }
  return false;
}

interface AIChatLocationState {
  fromAIChat?: boolean;
  initialChatMessages?: Array<{ role: 'user' | 'assistant'; content: string }>;
  projectTitle?: string;
  projectComponentIds?: string[];
  projectComponentSummary?: string;
}

export function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const locationState = (location.state as AIChatLocationState | null);
  const isAIChatMode = locationState?.fromAIChat === true;

  // Find the project
  const project = presetProjects.find(p => p.id === projectId);

  // State
  const [currentStep] = useState(0);
  const [chatMessages, setChatMessages] = useState<Array<{role: 'user' | 'assistant', content: string, references?: ChatReference[]}>>(() => {
    if (isAIChatMode && locationState?.initialChatMessages && locationState.initialChatMessages.length > 0) {
      return locationState.initialChatMessages;
    }
    return [{ role: 'assistant', content: 'Hi! I\'m here to help you with this project. Ask me anything!' }];
  });

  // Serial connection
  const { isConnected, isSupported, connect, disconnect } = useSerial();

  // Circuit store
  const {
    selectedComponentId,
    selectComponent,
    isSimulating,
    toggleSimulation,
    placedComponents,
    setHighlights,
    wireAttemptsDuringSimulation,
    clearCircuit,
    clearHistory,
  } = useCircuitStore();

  // Keep each project's workspace isolated even when returning through Home.
  useEffect(() => {
    if (
      projectId &&
      lastOpenedProjectId !== undefined &&
      lastOpenedProjectId !== projectId
    ) {
      clearCircuit();
      clearHistory();
    }
    if (projectId) {
      lastOpenedProjectId = projectId;
    }
  }, [projectId, clearCircuit, clearHistory]);
  const wires = useWires();
  const simulationErrors = useSimulationErrors();
  const buttonStates = useButtonStates();
  const clickToPlace = useClickToPlace();

  const [collapseLeftSignal, setCollapseLeftSignal] = useState(0);
  const [ledBannerToFrame3, setLedBannerToFrame3] = useState(false);
  /** After Frame 3: user wired 5V→+ rail and GND→− rail on breadboard → show Frame 4 */
  const [ledBannerToFrame4, setLedBannerToFrame4] = useState(false);
  /** Frame 4 shows 4s then auto-advance to Frame 5 */
  const [ledBannerToFrame5, setLedBannerToFrame5] = useState(false);
  /** Frame 5 “Next” → Frame 6 */
  const [ledBannerToFrame6, setLedBannerToFrame6] = useState(false);
  /** Frame 8 “Next” → Frame 9 art; workspace 100%, LED guide off, decorative resistor at H13–H14 */
  const [ledBannerToFrame9, setLedBannerToFrame9] = useState(false);
  /** Frame 9: user resistor overlaps decorative or shares column with user LED (E–I, 1–30) → Frame 10 art */
  const [ledBannerToFrame10, setLedBannerToFrame10] = useState(false);
  /** Frame 10 shows 3s then auto-advance to Frame 11 art */
  const [ledBannerToFrame11, setLedBannerToFrame11] = useState(false);
  /** Frame 11 “Next” → Frame 12 art */
  const [ledBannerToFrame12, setLedBannerToFrame12] = useState(false);
  /** Frame 12: user pushbutton on **E17, E19, F17, F19** → Frame 13 art */
  const [ledBannerToFrame13, setLedBannerToFrame13] = useState(false);
  /** After 2s on Frame 13 → Frame 14 art */
  const [ledBannerToFrame14, setLedBannerToFrame14] = useState(false);
  /** Frame 14 blue “Next” → Frame 15 art (`Project one Pictures/Frame 15.svg`) */
  const [ledBannerToFrame15, setLedBannerToFrame15] = useState(false);
  /** Frame 15: user wires D19 → bottom (+) rail → Frame 16 art (`Project one Pictures/Frame 16.svg`) */
  const [ledBannerToFrame16, setLedBannerToFrame16] = useState(false);
  /** Frame 16 blue “Next” → Frame 17 art (`Project one Pictures/Frame 17.svg`) */
  const [ledBannerToFrame17, setLedBannerToFrame17] = useState(false);
  /** Frame 17: user wires H12 → bottom (−) rail → Frame 18 art (`Project one Pictures/Frame 18.svg`) */
  const [ledBannerToFrame18, setLedBannerToFrame18] = useState(false);
  /** Frame 18 blue “Next” → Simulation art (`Project one Pictures/Frame Simulation.svg`) */
  const [ledBannerToSimulation, setLedBannerToSimulation] = useState(false);
  /** Simulation success celebration after Start Simulation + button press lights LED. */
  const [showLedSimulationCongrats, setShowLedSimulationCongrats] = useState(false);
  const autoCollapseLeftDoneRef = useRef(false);
  const frame6InstructionalLedRef = useRef<string | null>(null);
  const frame9InstructionalResistorRef = useRef<string | null>(null);
  const frame9ResistorPlacementStartedRef = useRef(false);
  /** Dedupe Frame 12 auto-onboarding for the user’s pushbutton on the breadboard. */
  const frame12PushbuttonGuideInstanceRef = useRef<string | null>(null);
  /** Dedupe Frame 14 auto-open Guide for the user’s pushbutton. */
  const frame14PushbuttonGuideInstanceRef = useRef<string | null>(null);

  const ledButtonStarterOnCanvas = useMemo(() => {
    if (projectId !== LED_BUTTON_PROJECT_ID) return false;
    return isLedButtonWorkspaceStarterComplete({ placedComponents });
  }, [projectId, placedComponents]);

  /** After Frame 6: user placed a real LED on breadboard columns G–J, rows 1–30 → Frame 8 art (`Project one Pictures/Frame 8.svg`) */
  const ledBannerToFrame7 = useMemo(
    () =>
      projectId === LED_BUTTON_PROJECT_ID &&
      ledBannerToFrame6 &&
      placedComponents.some(isUserLed5mmInGJZone),
    [projectId, ledBannerToFrame6, placedComponents]
  );

  /** Real user LED in G–J zone (Frame 8): canvas dims workspace except this instance. */
  const ledButtonFrame8TargetInstanceId = useMemo(() => {
    if (projectId !== LED_BUTTON_PROJECT_ID || !ledBannerToFrame7) return null;
    const userLed = placedComponents.find(isUserLed5mmInGJZone);
    return userLed?.instanceId ?? null;
  }, [projectId, ledBannerToFrame7, placedComponents]);

  /** Frame 14: dim canvas except this user pushbutton. */
  const ledButtonFrame14PushbuttonInstanceId = useMemo(() => {
    if (projectId !== LED_BUTTON_PROJECT_ID || !ledBannerToFrame14) return null;
    const btn = placedComponents.find(isUserPushbuttonPlacedComponent);
    return btn?.instanceId ?? null;
  }, [projectId, ledBannerToFrame14, placedComponents]);

  /** Frame 8: reopen the real LED’s canvas Guide (manual) so it stays visible at full opacity with workspace dim. */
  useEffect(() => {
    if (
      projectId !== LED_BUTTON_PROJECT_ID ||
      !ledBannerToFrame7 ||
      ledBannerToFrame9 ||
      !ledButtonFrame8TargetInstanceId
    ) {
      return;
    }
    useCircuitStore.getState().triggerOnboardingForComponent(ledButtonFrame8TargetInstanceId);
  }, [projectId, ledBannerToFrame7, ledBannerToFrame9, ledButtonFrame8TargetInstanceId]);

  const handleLedFrame8NextToFrame9 = useCallback(() => {
    const targetId = ledButtonFrame8TargetInstanceId;
    if (targetId) {
      useCircuitStore.getState().hideOnboarding(targetId);
    }
    setLedBannerToFrame9(true);
  }, [ledButtonFrame8TargetInstanceId]);

  /** Frame 9: decorative 220Ω, 90°, 60% opacity; left leg at H13 (row 13), right leg H17 (~standard pitch on same row). */
  useEffect(() => {
    if (projectId !== LED_BUTTON_PROJECT_ID || !ledBannerToFrame9) return;
    if (frame9ResistorPlacementStartedRef.current) return;
    frame9ResistorPlacementStartedRef.current = true;

    let cancelled = false;
    const resetPlacementFlag = () => {
      frame9ResistorPlacementStartedRef.current = false;
    };

    void (async () => {
      const def = await loadComponentByFileName('Registor_220Ω', 'passive');
      if (!def || cancelled) {
        resetPlacementFlag();
        return;
      }
      const { placedComponents: comps } = useCircuitStore.getState();
      const bb = comps.find((c) => c.definitionId === 'breadboard');
      if (!bb) {
        resetPlacementFlag();
        return;
      }
      const bbDef = useCircuitStore.getState().componentDefinitions.get(bb.instanceId);
      if (!bbDef) {
        resetPlacementFlag();
        return;
      }

      const pins = { TERM1: 'H13', TERM2: 'H17' } as const;
      const snap = computeSnapPositionForBreadboardPins(def, bb, bbDef, pins, 90, false, false);
      if (!snap?.success) {
        resetPlacementFlag();
        return;
      }

      const instanceId = useCircuitStore.getState().addComponent(
        def,
        snap.snappedPosition.x,
        snap.snappedPosition.y,
        { opacity: 0.6 },
        true
      );
      useCircuitStore.getState().updateComponentRotation(instanceId, 90);
      useCircuitStore.getState().insertIntoBreadboard(
        instanceId,
        snap.breadboardInstanceId,
        snap.insertedPins
      );
      frame9InstructionalResistorRef.current = instanceId;
    })();

    return () => {
      cancelled = true;
    };
  }, [projectId, ledBannerToFrame9]);

  useEffect(() => {
    if (!ledBannerToFrame9 || ledBannerToFrame10) return;
    if (
      shouldAdvanceLedBannerToFrame10(
        placedComponents,
        frame9InstructionalResistorRef.current
      )
    ) {
      setLedBannerToFrame10(true);
    }
  }, [placedComponents, ledBannerToFrame9, ledBannerToFrame10]);

  useEffect(() => {
    if (projectId !== LED_BUTTON_PROJECT_ID) return;
    if (!ledBannerToFrame10 || ledBannerToFrame11) return;
    const id = window.setTimeout(() => {
      setLedBannerToFrame11(true);
    }, 3000);
    return () => clearTimeout(id);
  }, [projectId, ledBannerToFrame10, ledBannerToFrame11]);

  useEffect(() => {
    autoCollapseLeftDoneRef.current = false;
    setCollapseLeftSignal(0);
    setLedBannerToFrame3(false);
    setLedBannerToFrame4(false);
    setLedBannerToFrame5(false);
    setLedBannerToFrame6(false);
    setLedBannerToFrame9(false);
    setLedBannerToFrame10(false);
    setLedBannerToFrame11(false);
    setLedBannerToFrame12(false);
    setLedBannerToFrame13(false);
    setLedBannerToFrame14(false);
    setLedBannerToFrame15(false);
    setLedBannerToFrame16(false);
    setLedBannerToFrame17(false);
    setLedBannerToFrame18(false);
    setLedBannerToSimulation(false);
    frame6InstructionalLedRef.current = null;
    frame9InstructionalResistorRef.current = null;
    frame9ResistorPlacementStartedRef.current = false;
    frame12PushbuttonGuideInstanceRef.current = null;
    frame14PushbuttonGuideInstanceRef.current = null;
  }, [projectId]);

  useEffect(() => {
    if (!ledButtonStarterOnCanvas) {
      autoCollapseLeftDoneRef.current = false;
    }
  }, [ledButtonStarterOnCanvas]);

  useEffect(() => {
    if (!ledButtonStarterOnCanvas || autoCollapseLeftDoneRef.current) return;
    autoCollapseLeftDoneRef.current = true;
    setCollapseLeftSignal((n) => n + 1);
  }, [ledButtonStarterOnCanvas]);

  useEffect(() => {
    if (projectId !== LED_BUTTON_PROJECT_ID) return;
    if (!ledBannerToFrame3) {
      setLedBannerToFrame4(false);
      setLedBannerToFrame5(false);
      setLedBannerToFrame6(false);
      return;
    }
    const getDef = (instanceId: string) =>
      useCircuitStore.getState().componentDefinitions.get(instanceId);
    setLedBannerToFrame4(
      isLedButtonPowerRailsWired(wires, placedComponents, (id) => getDef(id))
    );
  }, [projectId, ledBannerToFrame3, wires, placedComponents]);

  useEffect(() => {
    if (projectId !== LED_BUTTON_PROJECT_ID) return;
    if (!ledBannerToFrame4) {
      setLedBannerToFrame5(false);
      setLedBannerToFrame6(false);
      return;
    }
    if (ledBannerToFrame5) return;
    const id = window.setTimeout(() => {
      setLedBannerToFrame5(true);
    }, 4000);
    return () => clearTimeout(id);
  }, [projectId, ledBannerToFrame4, ledBannerToFrame5]);

  useEffect(() => {
    if (
      projectId !== LED_BUTTON_PROJECT_ID ||
      !ledBannerToFrame6 ||
      ledBannerToFrame9
    ) {
      const id = frame6InstructionalLedRef.current;
      if (id) {
        useCircuitStore.getState().removeComponent(id);
        frame6InstructionalLedRef.current = null;
      }
      return;
    }
    if (frame6InstructionalLedRef.current) return;

    let cancelled = false;
    void (async () => {
      const def = await loadComponentByFileName('led-5mm', 'passive');
      if (!def || cancelled) return;
      const { placedComponents: comps } = useCircuitStore.getState();
      const bb = comps.find((c) => c.definitionId === 'breadboard');
      if (!bb) return;
      const bbDef = useCircuitStore.getState().componentDefinitions.get(bb.instanceId);
      if (!bbDef) return;
      const snap = computeSnapPositionForBreadboardPins(def, bb, bbDef, {
        ANODE: 'I13',
        CATHODE: 'I12',
      });
      if (!snap?.success) return;
      const instanceId = useCircuitStore.getState().addComponent(
        def,
        snap.snappedPosition.x,
        snap.snappedPosition.y,
        { opacity: 0.5 },
        true
      );
      useCircuitStore.getState().insertIntoBreadboard(
        instanceId,
        snap.breadboardInstanceId,
        snap.insertedPins
      );
      frame6InstructionalLedRef.current = instanceId;
    })();

    return () => {
      cancelled = true;
    };
  }, [projectId, ledBannerToFrame6, ledBannerToFrame9]);

  /** After Frame 10 (auto-advance to Frame 11): remove decorative 60% resistor. */
  useEffect(() => {
    if (!ledBannerToFrame11) return;
    const id = frame9InstructionalResistorRef.current;
    if (!id) return;
    useCircuitStore.getState().removeComponent(id);
    frame9InstructionalResistorRef.current = null;
  }, [ledBannerToFrame11]);

  /**
   * Frame 12 banner: auto-open pushbutton component guide on the user’s real pushbutton as soon as it appears
   * (canvas or breadboard — no need to insert into breadboard first).
   */
  useEffect(() => {
    if (projectId !== LED_BUTTON_PROJECT_ID || !ledBannerToFrame12) {
      frame12PushbuttonGuideInstanceRef.current = null;
      return;
    }

    const btn = placedComponents.find(isUserPushbuttonPlacedComponent);
    if (btn) {
      // Product tweak: keep the translucent breadboard hint, but suppress the solid guide.
      useCircuitStore.getState().hideOnboarding(btn.instanceId);
    }
    frame12PushbuttonGuideInstanceRef.current = null;
  }, [projectId, ledBannerToFrame12, placedComponents]);

  /**
   * Frame 12 → 13 → 14: user’s pushbutton on **E17, E19, F17, F19** → Frame 13; 2s later Frame 14.
   */
  useEffect(() => {
    if (projectId !== LED_BUTTON_PROJECT_ID) return;
    if (!ledBannerToFrame12 || ledBannerToFrame13) return;

    const userOnSvgHint = placedComponents.some(
      (c) =>
        isUserPushbuttonPlacedComponent(c) &&
        !!c.insertedPins &&
        pushbuttonInsertedPinsMatchFrame12F17To19Zone(c.insertedPins)
    );

    if (!userOnSvgHint) return;

    setLedBannerToFrame12(false);
    setLedBannerToFrame13(true);
  }, [projectId, ledBannerToFrame12, ledBannerToFrame13, placedComponents]);

  useEffect(() => {
    if (projectId !== LED_BUTTON_PROJECT_ID) return;
    if (!ledBannerToFrame13 || ledBannerToFrame14) return;
    const id = window.setTimeout(() => {
      setLedBannerToFrame13(false);
      setLedBannerToFrame14(true);
    }, 2000);
    return () => clearTimeout(id);
  }, [projectId, ledBannerToFrame13, ledBannerToFrame14]);

  /**
   * Frame 14: workspace dim except pushbutton — auto-open component Guide on the user’s pushbutton.
   */
  useEffect(() => {
    if (projectId !== LED_BUTTON_PROJECT_ID || !ledBannerToFrame14) {
      frame14PushbuttonGuideInstanceRef.current = null;
      return;
    }

    const btn = placedComponents.find(isUserPushbuttonPlacedComponent);
    if (!btn) return;
    if (frame14PushbuttonGuideInstanceRef.current === btn.instanceId) return;
    frame14PushbuttonGuideInstanceRef.current = btn.instanceId;

    const openGuide = () => {
      useCircuitStore.getState().triggerOnboardingForComponent(btn.instanceId);
    };
    requestAnimationFrame(() => {
      requestAnimationFrame(openGuide);
    });
  }, [projectId, ledBannerToFrame14, placedComponents]);

  /** Frame 15: close pushbutton component guide; workspace opacity handled on canvas. */
  useEffect(() => {
    if (projectId !== LED_BUTTON_PROJECT_ID || !ledBannerToFrame15) return;
    const btn = placedComponents.find(isUserPushbuttonPlacedComponent);
    if (btn) {
      useCircuitStore.getState().hideOnboarding(btn.instanceId);
    }
    frame14PushbuttonGuideInstanceRef.current = null;
  }, [projectId, ledBannerToFrame15, placedComponents]);

  /** Frame 15 → 16: detect D19 ↔ bottom (+) rail wire. */
  useEffect(() => {
    if (projectId !== LED_BUTTON_PROJECT_ID) return;
    if (!ledBannerToFrame15 || ledBannerToFrame16) return;
    if (isLedButtonD19ToBottomPlusRailWired(wires, placedComponents)) {
      setLedBannerToFrame16(true);
    }
  }, [projectId, ledBannerToFrame15, ledBannerToFrame16, wires, placedComponents]);

  /** Frame 17 → 18: detect H12 ↔ bottom (−) rail wire. */
  useEffect(() => {
    if (projectId !== LED_BUTTON_PROJECT_ID) return;
    if (!ledBannerToFrame17 || ledBannerToFrame18) return;
    if (isLedButtonH12ToBottomMinusRailWired(wires, placedComponents)) {
      setLedBannerToFrame18(true);
    }
  }, [projectId, ledBannerToFrame17, ledBannerToFrame18, wires, placedComponents]);

  const ledButtonBannerSrc = useMemo(() => {
    const base = `${import.meta.env.BASE_URL}projects/`;
    if (collapseLeftSignal === 0) return `${base}led-button-frame-1.svg`;
    if (ledBannerToSimulation) return `${base}led-button-frame-simulation.svg`;
    if (ledBannerToFrame18) return `${base}led-button-frame-18.svg`;
    if (ledBannerToFrame17) return `${base}led-button-frame-17.svg`;
    if (ledBannerToFrame16) return `${base}led-button-frame-16.svg`;
    if (ledBannerToFrame15) return `${base}led-button-frame-15.svg`;
    if (ledBannerToFrame14) return `${base}led-button-frame-14.svg`;
    if (ledBannerToFrame13) return `${base}led-button-frame-13.svg`;
    if (ledBannerToFrame12) return `${base}led-button-frame-12.svg`;
    if (ledBannerToFrame11) return `${base}led-button-frame-11.svg`;
    if (ledBannerToFrame10) return `${base}led-button-frame-10.svg`;
    if (ledBannerToFrame9) return `${base}led-button-frame-9.svg`;
    if (ledBannerToFrame7) return `${base}led-button-frame-8.svg`;
    if (ledBannerToFrame6) return `${base}led-button-frame-6.svg`;
    if (ledBannerToFrame5) return `${base}led-button-frame-5.svg`;
    if (ledBannerToFrame4) return `${base}led-button-frame-4.svg`;
    if (ledBannerToFrame3) return `${base}led-button-frame-3.svg`;
    return `${base}led-button-frame-2.svg`;
  }, [
    collapseLeftSignal,
    ledBannerToFrame3,
    ledBannerToFrame4,
    ledBannerToFrame5,
    ledBannerToFrame6,
    ledBannerToFrame7,
    ledBannerToFrame9,
    ledBannerToFrame10,
    ledBannerToFrame11,
    ledBannerToFrame12,
    ledBannerToFrame13,
    ledBannerToFrame14,
    ledBannerToFrame15,
    ledBannerToFrame16,
    ledBannerToFrame17,
    ledBannerToFrame18,
    ledBannerToSimulation,
  ]);

  const ledButtonBannerIntrinsic = useMemo(() => {
    if (collapseLeftSignal === 0) return { w: 602, h: 227 };
    if (ledBannerToSimulation) return { w: 656, h: 162 };
    if (ledBannerToFrame18) return { w: 662, h: 194 };
    if (ledBannerToFrame17) return { w: 639, h: 166 };
    if (ledBannerToFrame16) return { w: 722, h: 162 };
    if (ledBannerToFrame15) return { w: 634, h: 166 };
    if (ledBannerToFrame14) return { w: 737, h: 274 };
    if (ledBannerToFrame13) return { w: 546, h: 162 };
    if (ledBannerToFrame12) return { w: 634, h: 188 };
    if (ledBannerToFrame11) return { w: 903, h: 326 };
    if (ledBannerToFrame10) return { w: 644, h: 162 };
    if (ledBannerToFrame9) return { w: 634, h: 210 };
    if (ledBannerToFrame7) return { w: 805, h: 208 };
    if (ledBannerToFrame6) return { w: 634, h: 166 };
    if (ledBannerToFrame5) return { w: 638, h: 218 };
    if (ledBannerToFrame4) return { w: 645, h: 162 };
    if (ledBannerToFrame3) return { w: 638, h: 232 };
    return { w: 656, h: 162 };
  }, [
    collapseLeftSignal,
    ledBannerToFrame3,
    ledBannerToFrame4,
    ledBannerToFrame5,
    ledBannerToFrame6,
    ledBannerToFrame7,
    ledBannerToFrame9,
    ledBannerToFrame10,
    ledBannerToFrame11,
    ledBannerToFrame12,
    ledBannerToFrame13,
    ledBannerToFrame14,
    ledBannerToFrame15,
    ledBannerToFrame16,
    ledBannerToFrame17,
    ledBannerToFrame18,
    ledBannerToSimulation,
  ]);

  const ledButtonBannerHotspots = useMemo(() => {
    if (collapseLeftSignal === 0) return undefined;
    if (ledBannerToFrame7 && !ledBannerToFrame9) {
      return [
        {
          rect: LED_BANNER_FRAME8_NEXT_RECT,
          ariaLabel: 'Next',
          onClick: handleLedFrame8NextToFrame9,
        },
      ];
    }
    if (
      ledBannerToFrame11 &&
      !ledBannerToFrame12 &&
      !ledBannerToFrame13 &&
      !ledBannerToFrame14 &&
      !ledBannerToFrame15 &&
      !ledBannerToFrame16 &&
      !ledBannerToFrame17 &&
      !ledBannerToFrame18 &&
      !ledBannerToSimulation
    ) {
      return [
        {
          rect: LED_BANNER_FRAME11_NEXT_RECT,
          ariaLabel: 'Next',
          onClick: () => {
            setLedBannerToFrame12(true);
          },
        },
      ];
    }
    if (ledBannerToFrame18 && !ledBannerToSimulation) {
      return [
        {
          rect: LED_BANNER_FRAME18_NEXT_RECT,
          ariaLabel: 'Next',
          onClick: () => {
            setLedBannerToSimulation(true);
          },
        },
      ];
    }
    if (ledBannerToFrame16 && !ledBannerToFrame17) {
      return [
        {
          rect: LED_BANNER_FRAME16_NEXT_RECT,
          ariaLabel: 'Next',
          onClick: () => {
            setLedBannerToFrame17(true);
          },
        },
      ];
    }
    if (ledBannerToFrame14 && !ledBannerToFrame15) {
      return [
        {
          rect: LED_BANNER_FRAME14_NEXT_RECT,
          ariaLabel: 'Next',
          onClick: () => {
            setLedBannerToFrame14(false);
            setLedBannerToFrame15(true);
          },
        },
      ];
    }
    if (ledBannerToFrame5 && !ledBannerToFrame6) {
      return [
        {
          rect: LED_BANNER_FRAME5_NEXT_RECT,
          ariaLabel: 'Next',
          onClick: () => {
            setLedBannerToFrame6(true);
          },
        },
      ];
    }
    if (
      ledBannerToFrame3 ||
      ledBannerToFrame4 ||
      ledBannerToFrame5 ||
      ledBannerToFrame6 ||
      ledBannerToFrame9 ||
      ledBannerToFrame10 ||
      ledBannerToFrame12 ||
      ledBannerToFrame13 ||
      ledBannerToFrame15 ||
      ledBannerToFrame16 ||
      ledBannerToFrame17 ||
      ledBannerToFrame18 ||
      ledBannerToSimulation
    ) {
      return undefined;
    }
    return [
      {
        rect: LED_BANNER_FRAME2_NEXT_RECT,
        ariaLabel: 'Next',
        onClick: () => {
          setLedBannerToFrame3(true);
        },
      },
    ];
  }, [
    collapseLeftSignal,
    ledBannerToFrame3,
    ledBannerToFrame4,
    ledBannerToFrame5,
    ledBannerToFrame6,
    ledBannerToFrame7,
    ledBannerToFrame9,
    ledBannerToFrame10,
    ledBannerToFrame11,
    ledBannerToFrame12,
    ledBannerToFrame13,
    ledBannerToFrame14,
    ledBannerToFrame15,
    ledBannerToFrame16,
    ledBannerToFrame17,
    ledBannerToFrame18,
    ledBannerToSimulation,
    handleLedFrame8NextToFrame9,
  ]);

  // AI loading state
  const [isAILoading, setIsAILoading] = useState(false);

  // Build breadboardPins for AI context (shared between handleChatSubmit and AIDebuggingOverlay)
  const breadboardPins = useMemo(() => {
    const pins: Record<string, Array<{ pinId: string; net: string }>> = {};
    const componentDefinitions = useCircuitStore.getState().componentDefinitions;
    for (const comp of placedComponents) {
      if (comp.definitionId.includes('breadboard')) {
        const def = componentDefinitions.get(comp.instanceId);
        if (def && def.pins) {
          const pinsWithNet = def.pins.filter((p) => p.net);
          pins[comp.instanceId] = pinsWithNet.map((p) => ({ pinId: p.id, net: p.net! }));
        }
      }
    }
    return pins;
  }, [placedComponents]);

  // Callback for AIDebuggingOverlay to add messages to chat
  const handleAddChatMessage = useCallback((role: 'user' | 'assistant', content: string) => {
    setChatMessages((prev) => [...prev, { role, content }]);
  }, []);

  // Dev feature flags
  const devGlobalOnboarding = useDevStore((s) => s.globalOnboarding);
  const devYellowCharacter = useDevStore((s) => s.yellowCharacter);
  /** Button-Powered LED + legacy ai-session route: no AI dock, chat, or canvas AI UI. */
  const isLedButtonProject = projectId === LED_BUTTON_PROJECT_ID;
  const isAiSessionProject = projectId === AI_SESSION_PROJECT_ID;
  const projectAiUiEnabled = !(isLedButtonProject || isAiSessionProject);
  const effectiveAIChatMode = isAIChatMode;

  // Onboarding
  const initOnboarding = useOnboardingStore((state) => state.initOnboarding);
  const updateToolbarRect = useOnboardingStore((state) => state.updateToolbarRect);
  const updateTargetRect = useOnboardingStore((state) => state.updateTargetRect);

  // Initialize onboarding on mount (respects dev flag)
  useEffect(() => {
    if (devGlobalOnboarding) initOnboarding();
  }, [initOnboarding, devGlobalOnboarding]);

  // Drop AI-chat navigation state only on projects without AI UI (LED)
  useEffect(() => {
    if (!isAIChatMode || !projectId) return;
    if (projectId !== LED_BUTTON_PROJECT_ID) return;
    navigate(`/project/${projectId}`, { replace: true, state: null });
  }, [isAIChatMode, projectId, navigate]);

  // Legacy AI session route should only fall back when opened without AI chat state.
  useEffect(() => {
    if (projectId !== AI_SESSION_PROJECT_ID) return;
    if (isAIChatMode) return;
    navigate(`/project/${LED_BUTTON_PROJECT_ID}`, { replace: true, state: null });
  }, [projectId, navigate, isAIChatMode]);

  // Skip onboarding step that targets the hidden AI panel
  useEffect(() => {
    if (projectId !== LED_BUTTON_PROJECT_ID) return;
    const st = useOnboardingStore.getState();
    if (st.isActive && st.currentStep === 'ai-chat') {
      st.goToNextStep();
    }
  }, [projectId]);

  // Track all target rects for onboarding overlay positioning
  useEffect(() => {
    const updateAllRects = () => {
      // Left toolbar (Step 1)
      const leftPanel = document.querySelector('.left-panel--floating');
      if (leftPanel) {
        updateToolbarRect(leftPanel.getBoundingClientRect());
      }

      // Instructions panel (Step 2)
      const instructionsPanel = document.querySelector('[data-panel-id="instructions"]');
      if (instructionsPanel) {
        updateTargetRect('[data-panel-id="instructions"]', instructionsPanel.getBoundingClientRect());
      }

      // AI Chat panel (Step 3) — only when the panel exists
      if (projectAiUiEnabled) {
        const aiPanel = document.querySelector('[data-panel-id="ai-assistant"]');
        if (aiPanel) {
          updateTargetRect('[data-panel-id="ai-assistant"]', aiPanel.getBoundingClientRect());
        }
      }

      // Bottom toolbar (Step 4)
      const canvasToolbar = document.querySelector('.canvas-toolbar');
      if (canvasToolbar) {
        updateTargetRect('.canvas-toolbar', canvasToolbar.getBoundingClientRect());
      }
    };

    // Initial update (with delay to ensure DOM is ready)
    const initialTimeout = setTimeout(updateAllRects, 100);

    // Update on resize
    window.addEventListener('resize', updateAllRects);

    // Use ResizeObserver for panel resize changes
    const observers: ResizeObserver[] = [];
    const selectors = [
      '.left-panel--floating',
      '[data-panel-id="instructions"]',
      '[data-panel-id="ai-assistant"]',
      '.canvas-toolbar',
    ];

    selectors.forEach(selector => {
      const element = document.querySelector(selector);
      if (element) {
        const observer = new ResizeObserver(updateAllRects);
        observer.observe(element);
        observers.push(observer);
      }
    });

    // Use MutationObserver to detect when panels are added/removed
    const mutationObserver = new MutationObserver(() => {
      // Re-check for elements after DOM changes
      setTimeout(updateAllRects, 50);
    });
    mutationObserver.observe(document.body, { childList: true, subtree: true });

    return () => {
      clearTimeout(initialTimeout);
      window.removeEventListener('resize', updateAllRects);
      observers.forEach(obs => obs.disconnect());
      mutationObserver.disconnect();
    };
  }, [updateToolbarRect, updateTargetRect, projectAiUiEnabled]);

  const step = project?.steps[currentStep];

  const handleChatSubmit = useCallback(async (message: string, references?: ChatReference[]) => {
    if (!projectAiUiEnabled) return;

    // Add user message with references stored separately
    setChatMessages(prev => [...prev, {
      role: 'user',
      content: message,
      references: references && references.length > 0 ? references : undefined
    }]);

    // Check if AI service is configured
    if (!isAIServiceConfigured()) {
      // Use fallback response
      setTimeout(() => {
        setChatMessages(prev => [...prev, {
          role: 'assistant',
          content: getFallbackResponse(message, references || [])
        }]);
      }, 500);
      return;
    }

    // breadboardPins is computed via useMemo above (shared with AIDebuggingOverlay)

    // Build circuit state for AI
    const componentDefinitions = useCircuitStore.getState().componentDefinitions;
    const circuitState: CircuitState = {
      placedComponents: placedComponents.map(c => {
        // Get internal connections from component definition
        const def = componentDefinitions.get(c.instanceId);
        return {
          instanceId: c.instanceId,
          definitionId: c.definitionId,
          x: c.x,
          y: c.y,
          rotation: c.rotation,
          parentBreadboardId: c.parentBreadboardId,
          insertedPins: c.insertedPins,
          internalConnections: def?.internalConnections,
        };
      }),
      wires: wires.map(w => ({
        id: w.id,
        startComponentId: w.startComponentId,
        startPinId: w.startPinId,
        endComponentId: w.endComponentId,
        endPinId: w.endPinId,
        color: w.color
      })),
      isSimulating,
      simulationErrors: simulationErrors.map(e => ({
        componentId: e.componentId,
        wireId: e.wireId,
        message: e.message,
        severity: 'error' as const
      })),
      breadboardPins,
    };

    setIsAILoading(true);

    // Build project context so AI knows what project and step we're on
    const projectContext: ProjectContext | undefined = project ? {
      title: project.title,
      description: project.description,
      goal: project.goal,
      learningObjectives: project.learningObjectives,
      currentStepIndex: currentStep,
      totalSteps: project.steps.length,
      currentStepTitle: step?.title,
      currentStepInstructions: step?.instructions,
    } : undefined;

    // Build conversation history from previous messages
    const conversationHistory: ConversationMessage[] = chatMessages.map(msg => ({
      role: msg.role,
      content: msg.content,
    }));

    try {
      const response = await sendMessage(message, references || [], circuitState, projectContext, conversationHistory);

      // Parse the AI response to extract mood, target component, and cleaned content
      const parsed = parseAIResponse(response.content);

      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: parsed.content
      }]);

      // Apply highlights if any (character will only appear for explicit debugging hints, not regular chat)
      if (parsed.highlights && parsed.highlights.length > 0) {
        setHighlights(parsed.highlights);
      }

      // Trigger component onboarding if AI suggests it
      if (parsed.onboardingDefinitionIds && parsed.onboardingDefinitionIds.length > 0) {
        const storeState = useCircuitStore.getState();
        for (const defId of parsed.onboardingDefinitionIds) {
          const matchingComponent = storeState.placedComponents.find(
            c => c.definitionId === defId || c.definitionId.includes(defId)
          );
          if (matchingComponent) {
            storeState.triggerOnboardingForComponent(matchingComponent.instanceId);
          }
        }
      }
    } catch (error) {
      console.error('AI service error:', error);
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I encountered an error processing your request. Please try again.'
      }]);
    } finally {
      setIsAILoading(false);
    }
  }, [placedComponents, wires, isSimulating, simulationErrors, breadboardPins, setHighlights, project, currentStep, step, chatMessages, projectAiUiEnabled]);

  // If project not found and not in AI chat mode
  if (!project && !effectiveAIChatMode) {
    return (
      <div className="project-not-found">
        <h2>Project not found</h2>
        <button onClick={() => navigate('/')}>Go Home</button>
      </div>
    );
  }

  // Display title: use AI chat title if in AI chat mode, otherwise use project title
  const displayTitle = effectiveAIChatMode
    ? (locationState?.projectTitle || 'AI Project')
    : (project?.title || '');

  const handleComponentDrop = (componentId: string, x: number, y: number) => {
    console.log(`Dropped component ${componentId} at (${x}, ${y})`);
  };

  const handleComponentSelect = (instanceId: string | null) => {
    selectComponent(instanceId);
  };

  const handleCloseProperties = () => {
    selectComponent(null);
  };

  // Get current step code for left panel
  const currentCode = step?.code || '';

  // Render function for AI Chat panel content
  const renderAIChat = useCallback(() => (
    <RightPanel
      chatMessages={chatMessages}
      onSendMessage={handleChatSubmit}
      isLoading={isAILoading}
    />
  ), [chatMessages, handleChatSubmit, isAILoading]);

  /** LED: always headless instructions (no AI dock). */
  const hideInstructionsDock = projectId === LED_BUTTON_PROJECT_ID;

  const { dockPanels, dockPanelOrder } = useMemo(() => {
    if (isAIChatMode) {
      return {
        dockPanels: AI_CHAT_PANELS,
        dockPanelOrder: ['ai-assistant'] as string[],
      };
    }
    if (hideInstructionsDock && projectAiUiEnabled) {
      return {
        dockPanels: AI_CHAT_PANELS,
        dockPanelOrder: ['ai-assistant'],
      };
    }
    return {
      dockPanels: DEFAULT_PANELS,
      dockPanelOrder: ['instructions', 'ai-assistant'],
    };
  }, [isAIChatMode, projectAiUiEnabled, hideInstructionsDock]);

  const showFloatingInstructions =
    !projectAiUiEnabled &&
    !!project &&
    project.steps.length > 0 &&
    projectId !== LED_BUTTON_PROJECT_ID;
  const showLedSimulationStartHighlight =
    projectId === LED_BUTTON_PROJECT_ID &&
    ledBannerToSimulation &&
    !isSimulating;
  const yellowCharactorUrl = useMemo(() => {
    const base = import.meta.env.BASE_URL ?? '/';
    const normalized = base.endsWith('/') ? base : `${base}/`;
    return `${normalized}projects/yellow-charactor.svg`;
  }, []);

  const isAnyUserPushbuttonPressed = useMemo(() => {
    if (projectId !== LED_BUTTON_PROJECT_ID) return false;
    const userPushbuttonIds = placedComponents
      .filter(isUserPushbuttonPlacedComponent)
      .map((c) => c.instanceId);
    if (userPushbuttonIds.length === 0) return false;
    return userPushbuttonIds.some((id) => buttonStates.get(id) === true);
  }, [projectId, placedComponents, buttonStates]);

  const isAnyUserLedOn = useMemo(() => {
    if (projectId !== LED_BUTTON_PROJECT_ID) return false;
    return placedComponents.some(
      (c) =>
        c.definitionId === 'led-5mm' &&
        !c.decorativeOnly &&
        c.state === 'on'
    );
  }, [projectId, placedComponents]);

  useEffect(() => {
    if (projectId !== LED_BUTTON_PROJECT_ID || !ledBannerToSimulation || !isSimulating) {
      setShowLedSimulationCongrats(false);
      return;
    }
    if (isAnyUserPushbuttonPressed && isAnyUserLedOn) {
      setShowLedSimulationCongrats(true);
    }
  }, [
    projectId,
    ledBannerToSimulation,
    isSimulating,
    isAnyUserPushbuttonPressed,
    isAnyUserLedOn,
  ]);

  const projectPageInner = (
    <>
        {/* Top Bar */}
        <header className="project-header">
          <button className="back-button" onClick={() => navigate('/')}>
            <ArrowLeft size={20} />
            <span>Back</span>
          </button>
          <h1>{displayTitle}</h1>
          <div className="header-actions">
            {/* Simulate Button */}
            <button
              className={`simulate-button ${isSimulating ? 'simulating' : ''} ${showLedSimulationStartHighlight ? 'simulate-button--led-highlight' : ''}`}
              onClick={toggleSimulation}
            >
              {isSimulating ? <Square size={18} /> : <Play size={18} />}
              <span>{isSimulating ? 'Stop Simulation' : 'Start Simulation'}</span>
            </button>
            {/* Connection Status */}
            <div className="connection-status">
              {isConnected ? (
                <button className="connected" onClick={disconnect}>
                  <Usb size={18} />
                  <span>Connected</span>
                </button>
              ) : (
                <button className="disconnected" onClick={connect}>
                  <Unplug size={18} />
                  <span>{isSupported ? 'Connect Arduino' : 'Use Chrome/Edge'}</span>
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Three Panel Layout */}
        <main className="project-main">
          <ThreePanelLayout
            initialLeftWidth={320}
            initialRightWidth={320}
            collapseLeftSignal={collapseLeftSignal}
            hideRightPanel={!projectAiUiEnabled}
            leftPanel={
              <LeftPanel
                code={currentCode}
                onCodeChange={(code) => console.log('Code changed:', code)}
                allowedComponentIds={locationState?.projectComponentIds}
                componentLibraryTitle={locationState?.projectComponentIds?.length ? 'For this project' : undefined}
                componentLibraryDescription={locationState?.projectComponentSummary}
              />
            }
            centerPanel={
              <div className="project-center-wrap">
                {projectId === LED_BUTTON_PROJECT_ID && (
                  !(
                    ledBannerToSimulation &&
                    showLedSimulationCongrats
                  ) && (
                    <LedProjectTopBanner
                      key={projectId}
                      className="project-led-top-banner"
                      src={ledButtonBannerSrc}
                      suppressBounce={clickToPlace.isActive}
                      intrinsicWidth={ledButtonBannerIntrinsic.w}
                      intrinsicHeight={ledButtonBannerIntrinsic.h}
                      hotspots={ledButtonBannerHotspots}
                    />
                  )
                )}
                {projectId === LED_BUTTON_PROJECT_ID &&
                  ledBannerToSimulation &&
                  showLedSimulationCongrats && (
                    <div className="project-led-sim-congrats" aria-live="polite">
                      <img
                        src={yellowCharactorUrl}
                        alt=""
                        draggable={false}
                        className="project-led-sim-congrats__mascot"
                      />
                      <p className="project-led-sim-congrats__text">Congratulations!</p>
                    </div>
                  )}
                <CircuitCanvas
                  onComponentDrop={handleComponentDrop}
                  onComponentSelect={handleComponentSelect}
                  aiUiEnabled={projectAiUiEnabled}
                  ledButtonFrame3PowerDemo={
                    projectId === LED_BUTTON_PROJECT_ID &&
                    ledBannerToFrame3 &&
                    !ledBannerToFrame4 &&
                    !ledBannerToFrame5 &&
                    !ledBannerToFrame6 &&
                    !ledBannerToFrame7
                  }
                  ledButtonFrame8DimWorkspace={
                    projectId === LED_BUTTON_PROJECT_ID &&
                    ledBannerToFrame7 &&
                    !ledBannerToFrame9
                  }
                  ledButtonFrame8TargetInstanceId={ledButtonFrame8TargetInstanceId}
                  ledButtonFrame11DimWorkspace={
                    projectId === LED_BUTTON_PROJECT_ID &&
                    ledBannerToFrame11 &&
                    !ledBannerToFrame12 &&
                    !ledBannerToFrame13 &&
                    !ledBannerToFrame14 &&
                    !ledBannerToFrame15 &&
                    !ledBannerToFrame16 &&
                    !ledBannerToFrame17 &&
                    !ledBannerToFrame18
                  }
                  ledButtonFrame12Active={
                    projectId === LED_BUTTON_PROJECT_ID &&
                    (ledBannerToFrame12 ||
                      ledBannerToFrame13 ||
                      ledBannerToFrame14)
                  }
                  ledButtonFrame14DimWorkspace={
                    projectId === LED_BUTTON_PROJECT_ID && ledBannerToFrame14
                  }
                  ledButtonFrame14PushbuttonInstanceId={ledButtonFrame14PushbuttonInstanceId}
                  ledButtonFrame15RestoreWorkspaceOpacity={
                    projectId === LED_BUTTON_PROJECT_ID && ledBannerToFrame15
                  }
                  ledButtonFrame15BottomRailHighlight={
                    projectId === LED_BUTTON_PROJECT_ID &&
                    ledBannerToFrame15 &&
                    !ledBannerToFrame16 &&
                    !ledBannerToFrame17 &&
                    !ledBannerToFrame18
                  }
                  ledButtonFrame17BottomMinusHighlight={
                    projectId === LED_BUTTON_PROJECT_ID &&
                    ledBannerToFrame17 &&
                    !ledBannerToFrame18
                  }
                  ledButtonFrame12PushHintOverlay={
                    projectId === LED_BUTTON_PROJECT_ID &&
                    ledBannerToFrame12 &&
                    !ledBannerToFrame13 &&
                    !ledBannerToFrame14 &&
                    !ledBannerToFrame15 &&
                    !ledBannerToFrame16 &&
                    !ledBannerToFrame17 &&
                    !ledBannerToFrame18
                  }
                />
                {selectedComponentId && (
                  <ComponentPropertiesPanel
                    onClose={handleCloseProperties}
                  />
                )}
              </div>
            }
            rightPanel={
              projectAiUiEnabled ? (
                <DockContainer renderAIChat={renderAIChat} />
              ) : null
            }
          />
        </main>

        {hideInstructionsDock && (
          <InstructionsPanel headless key={`instruction-sync-${projectId}`} />
        )}

        {showFloatingInstructions && (
          <div className="project-floating-instructions">
            <InstructionsPanel key={`instruction-float-${projectId}`} />
          </div>
        )}

        {/* Onboarding overlay */}
        {devGlobalOnboarding && <OnboardingOverlay />}

        {/* AI Debugging Overlay — hidden when AI Assistant is off */}
        {projectAiUiEnabled && (
          <AIDebuggingOverlay
            placedComponents={placedComponents}
            wires={wires}
            breadboardPins={breadboardPins}
            isSimulating={isSimulating}
            simulationErrors={simulationErrors.map((e) => ({
              componentId: e.componentId,
              wireId: e.wireId,
              message: e.message,
              severity: 'error' as const,
            }))}
            project={project ? {
              title: project.title,
              description: project.description ?? '',
              goal: project.goal,
              learningObjectives: project.learningObjectives,
            } : undefined}
            onAddChatMessage={handleAddChatMessage}
            onSetHighlights={setHighlights}
          />
        )}

        {/* Overcrowded breadboard pin warning */}
        {devYellowCharacter && (
          <OvercrowdedPinWarning
            placedComponents={placedComponents}
            wires={wires}
          />
        )}

        {/* Simulation wire warning - shows when user tries to wire during simulation */}
        {devYellowCharacter && (
          <SimulationWireWarning
            wireAttemptsDuringSimulation={wireAttemptsDuringSimulation}
            isSimulating={isSimulating}
          />
        )}
    </>
  );

  return projectAiUiEnabled ? (
    <DockingProvider
      key={`${projectId ?? 'project'}-${effectiveAIChatMode}`}
      defaultPanels={dockPanels}
      initialPanelOrder={dockPanelOrder}
    >
      <div className="project-page">{projectPageInner}</div>
    </DockingProvider>
  ) : (
    <div className="project-page">{projectPageInner}</div>
  );
}
