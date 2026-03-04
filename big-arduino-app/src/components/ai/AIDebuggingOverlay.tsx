/**
 * AIDebuggingOverlay
 *
 * Portal-rendered overlay that animates the AI character out of its panel
 * to proactively offer debugging help in four scenarios:
 *   1. User hovers over the character icon (manual hover trigger)
 *   2. User reaches the last instruction step (last-step trigger) — positive message
 *   3. Simulation starts with errors (simulation-error trigger)
 *   4. User appears stuck: inactive 2 min OR went back 3+ steps (stuck trigger)
 *
 * Animation state machine:
 *   idle → jumping  (trigger fires)
 *   jumping → hovering  (animationend)
 *   hovering → idle  (mouse leaves safe zone [trigger 1], or 8 s timer [triggers 2/4])
 *   hovering → spinning  (button click OR sim-error auto-trigger)
 *   spinning → thinking  (animationend after 360° spin)
 *   thinking → retracting  (API response received)
 *   retracting → idle  (animationend)
 */

import { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { Wrench } from 'lucide-react';
import { useCircuitStore } from '../../store/circuitStore';
import {
  sendMessage,
  parseAIResponse,
  type CircuitState,
  type ProjectContext,
} from '../../services/aiService';
import type { PlacedComponent, Wire } from '../../types/components';
import type { HighlightItem } from '../../types/chat';
import characterBlue from '../../assets/character_blue.svg';
import './AIDebuggingOverlay.css';

// ─── Types ────────────────────────────────────────────────────────────────────

type AnimState = 'idle' | 'jumping' | 'hovering' | 'spinning' | 'thinking' | 'retracting';

interface AnchorRect {
  left: number;
  top: number;
  height: number;
}

export interface AIDebuggingOverlayProps {
  placedComponents: PlacedComponent[];
  wires: Wire[];
  breadboardPins: Record<string, Array<{ pinId: string; net: string }>>;
  isSimulating: boolean;
  simulationErrors: Array<{
    componentId?: string;
    wireId?: string;
    message: string;
    severity: 'error';
  }>;
  project?: {
    title: string;
    description?: string;
    goal?: string;
    learningObjectives?: string[];
  };
  onAddChatMessage: (role: 'user' | 'assistant', content: string) => void;
  onSetHighlights: (highlights: HighlightItem[]) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getAnchorRect(): AnchorRect | null {
  const el = document.querySelector('[data-debugging-anchor]');
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, height: r.height };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AIDebuggingOverlay({
  placedComponents,
  wires,
  breadboardPins,
  isSimulating,
  simulationErrors,
  project,
  onAddChatMessage,
  onSetHighlights,
}: AIDebuggingOverlayProps) {
  // DEBUG: Log props on every render
  console.log('[AIDebuggingOverlay RENDER] placedComponents.length:', placedComponents.length);
  // ── Store reads ──────────────────────────────────────────────────────────
  const aiCharacterHovered = useCircuitStore((s) => s.aiCharacterHovered);
  const currentInstructionStep = useCircuitStore((s) => s.currentInstructionStep);
  const totalInstructionSteps = useCircuitStore((s) => s.totalInstructionSteps);
  const setAICharacterOut = useCircuitStore((s) => s.setAICharacterOut);

  // ── Local state ──────────────────────────────────────────────────────────
  const [animState, setAnimState] = useState<AnimState>('idle');
  const [anchorRect, setAnchorRect] = useState<AnchorRect | null>(null);
  const [speechBubbleText, setSpeechBubbleText] = useState<string | null>(null);

  // ── Refs ─────────────────────────────────────────────────────────────────
  const retractTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasShownLastStepRef = useRef(false);
  const prevIsSimulatingRef = useRef(false);
  const simErrorAutoTriggeredRef = useRef(false);
  // Tracks whether current animation was started by manual hover (trigger 1)
  const hoverTriggeredRef = useRef(false);

  // Refs for trigger 4 (stuck detection) — avoid stale closures in async callbacks
  const animStateRef = useRef<AnimState>('idle');
  const currentStepRef = useRef(0);
  const hasShownStuckRef = useRef(false);
  // Step-nav history: timestamps of prev/next clicks within a rolling time window
  const stepNavHistoryRef = useRef<Array<{ dir: 'prev' | 'next'; time: number }>>([]);
  const prevStepRef = useRef(0);
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep animStateRef fresh
  useEffect(() => { animStateRef.current = animState; }, [animState]);
  // Keep currentStepRef fresh
  useEffect(() => { currentStepRef.current = currentInstructionStep; }, [currentInstructionStep]);

  // ── Sync aiCharacterOut to store ──────────────────────────────────────────
  useEffect(() => {
    setAICharacterOut(animState !== 'idle');
  }, [animState, setAICharacterOut]);

  // ── Anchor positioning ───────────────────────────────────────────────────
  useLayoutEffect(() => {
    const refresh = () => setAnchorRect(getAnchorRect());
    refresh();
    window.addEventListener('resize', refresh);
    return () => window.removeEventListener('resize', refresh);
  }, []);

  useEffect(() => {
    setAnchorRect(getAnchorRect());
  }, [animState]);

  // ── Timer helpers ─────────────────────────────────────────────────────────
  const clearRetractTimer = useCallback(() => {
    if (retractTimerRef.current !== null) {
      clearTimeout(retractTimerRef.current);
      retractTimerRef.current = null;
    }
  }, []);

  const startRetractTimer = useCallback(() => {
    clearRetractTimer();
    retractTimerRef.current = setTimeout(() => {
      setAnimState('retracting');
      setSpeechBubbleText(null);
    }, 8000);
  }, [clearRetractTimer]);

  // ── Jump out helper ───────────────────────────────────────────────────────
  // autoRetract=false for hover trigger (mouse-based retract instead of timer)
  const jumpOut = useCallback((bubble: string | null = null, autoRetract = true) => {
    setAnchorRect(getAnchorRect());
    setSpeechBubbleText(bubble);
    setAnimState('jumping');
    if (autoRetract) startRetractTimer();
  }, [startRetractTimer]);

  // ── Trigger 1: Hover ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!aiCharacterHovered) return;
    if (animState !== 'idle') return;
    hoverTriggeredRef.current = true;
    jumpOut(null, false);
  }, [aiCharacterHovered, animState, jumpOut]);

  // ── Mouse-based retract (trigger 1 only) ──────────────────────────────────
  useEffect(() => {
    if (animState !== 'hovering') return;
    if (!hoverTriggeredRef.current) return;

    const checkSafeZone = (x: number, y: number): boolean => {
      const anchorEl = document.querySelector('[data-debugging-anchor]');
      const overlayEls = document.querySelectorAll('[data-debug-overlay]');
      const inEl = (el: Element) => {
        const r = el.getBoundingClientRect();
        return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
      };
      if (anchorEl && inEl(anchorEl)) return true;
      return Array.from(overlayEls).some((el) => inEl(el));
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!checkSafeZone(e.clientX, e.clientY)) {
        setAnimState('retracting');
        setSpeechBubbleText(null);
      }
    };

    document.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => document.removeEventListener('mousemove', handleMouseMove);
  }, [animState]);

  // ── Trigger 2: Last step ──────────────────────────────────────────────────
  useEffect(() => {
    if (hasShownLastStepRef.current) return;
    if (totalInstructionSteps === 0) return;
    if (currentInstructionStep !== totalInstructionSteps - 1) return;
    if (animState !== 'idle') return;

    hasShownLastStepRef.current = true;
    hoverTriggeredRef.current = false;
    jumpOut("Almost there! 🎉 Want me to check your circuit or give you a hint?", true);
  }, [currentInstructionStep, totalInstructionSteps, animState, jumpOut]);

  // ── Trigger 4: Stuck (inactivity OR repeated step-back) ───────────────────
  const fireStuckTrigger = useCallback(() => {
    if (animStateRef.current !== 'idle') return;
    if (hasShownStuckRef.current) return;
    if (currentStepRef.current === 0) return;
    if (totalInstructionSteps === 0) return;
    hasShownStuckRef.current = true;
    hoverTriggeredRef.current = false;
    jumpOut("Stuck? I can help you debug or give you a hint!", true);
  }, [jumpOut, totalInstructionSteps]);

  // Inactivity detection: fire trigger 4 after 2 min of no user activity
  useEffect(() => {
    if (totalInstructionSteps === 0) return;
    const INACTIVITY_MS = 120_000;

    const schedule = () => {
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = setTimeout(fireStuckTrigger, INACTIVITY_MS);
    };

    const onActivity = () => schedule();
    schedule(); // start on mount

    window.addEventListener('mousemove', onActivity, { passive: true });
    window.addEventListener('keydown', onActivity, { passive: true });
    window.addEventListener('click', onActivity, { passive: true });
    return () => {
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      window.removeEventListener('mousemove', onActivity);
      window.removeEventListener('keydown', onActivity);
      window.removeEventListener('click', onActivity);
    };
  }, [totalInstructionSteps, fireStuckTrigger]);

  // Step-nav detection: fire trigger 4 when within a 3-minute rolling window
  // both prev and next are clicked, total > 5 AND prev clicks >= 3.
  useEffect(() => {
    if (totalInstructionSteps === 0) return;

    const now = Date.now();
    const WINDOW_MS = 3 * 60_000; // 3-minute rolling window
    const dir = currentInstructionStep < prevStepRef.current ? 'prev' : 'next';

    if (currentInstructionStep !== prevStepRef.current) {
      // Record this nav action
      stepNavHistoryRef.current.push({ dir, time: now });
      // Trim entries outside the time window
      stepNavHistoryRef.current = stepNavHistoryRef.current.filter(
        (e) => now - e.time <= WINDOW_MS
      );

      const recent = stepNavHistoryRef.current;
      const prevCount = recent.filter((e) => e.dir === 'prev').length;
      const total = recent.length;

      if (total > 5 && prevCount >= 3) fireStuckTrigger();
    }

    prevStepRef.current = currentInstructionStep;
  }, [currentInstructionStep, totalInstructionSteps, fireStuckTrigger]);

  // ── Trigger 3: Simulation start with errors ───────────────────────────────
  useEffect(() => {
    const wasSimulating = prevIsSimulatingRef.current;
    prevIsSimulatingRef.current = isSimulating;

    if (!wasSimulating && isSimulating && simulationErrors.length > 0) {
      simErrorAutoTriggeredRef.current = true;
      hoverTriggeredRef.current = false;
      clearRetractTimer();
      setAnchorRect(getAnchorRect());
      setSpeechBubbleText(null);
      setAnimState('spinning');
    }
  }, [isSimulating, simulationErrors, clearRetractTimer]);

  // ── Cleanup timer on unmount ──────────────────────────────────────────────
  useEffect(() => {
    return () => clearRetractTimer();
  }, [clearRetractTimer]);

  // ── Debugging analysis (defined before handleAnimationEnd to avoid stale closure) ──
  const runDebuggingAnalysis = useCallback(async () => {
    // Read fresh data from store to avoid stale closure issues
    const storeState = useCircuitStore.getState();
    const freshPlacedComponents = storeState.placedComponents;
    const freshWires = storeState.wires;
    const componentDefinitions = storeState.componentDefinitions;

    console.log('[AIDebuggingOverlay DEBUG] runDebuggingAnalysis called');
    console.log('[AIDebuggingOverlay DEBUG] Fresh placedComponents.length:', freshPlacedComponents.length);
    console.log('[AIDebuggingOverlay DEBUG] Fresh wires.length:', freshWires.length);

    const circuitState: CircuitState = {
      placedComponents: freshPlacedComponents.map((c) => {
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
      wires: freshWires.map((w) => ({
        id: w.id,
        startComponentId: w.startComponentId,
        startPinId: w.startPinId,
        endComponentId: w.endComponentId,
        endPinId: w.endPinId,
        color: w.color,
      })),
      isSimulating,
      simulationErrors: simulationErrors.map((e) => ({
        componentId: e.componentId,
        wireId: e.wireId,
        message: e.message,
        severity: 'error' as const,
      })),
      breadboardPins,
    };

    const projectContext: ProjectContext | undefined = project
      ? {
          title: project.title,
          description: project.description,
          goal: project.goal,
          learningObjectives: project.learningObjectives ?? [],
          currentStepIndex: storeState.currentInstructionStep,
          totalSteps: storeState.totalInstructionSteps,
        }
      : undefined;

    const debugPrompt = simulationErrors.length > 0
      ? `I started simulation and there are ${simulationErrors.length} error(s). Please analyze my circuit and explain what's wrong and how to fix it. Errors: ${simulationErrors.map((e) => e.message).join('; ')}`
      : `Please analyze my circuit and give me debugging tips or a hint about what to do next.`;

    try {
      const response = await sendMessage(
        debugPrompt,
        [],
        circuitState,
        projectContext,
        []
      );

      const parsed = parseAIResponse(response.content);

      if (parsed.highlights && parsed.highlights.length > 0) {
        onSetHighlights(parsed.highlights);
      }

      onAddChatMessage('assistant', parsed.content);

      setAnimState('retracting');
      setSpeechBubbleText(null);
    } catch (err) {
      console.error('[AIDebuggingOverlay] Analysis failed:', err);
      onAddChatMessage('assistant', 'Sorry, I had trouble analyzing the circuit. Please try again.');
      setAnimState('retracting');
      setSpeechBubbleText(null);
    }
  }, [breadboardPins, isSimulating, simulationErrors, project, onAddChatMessage, onSetHighlights]);

  // ── Animation event handlers ──────────────────────────────────────────────
  const handleAnimationEnd = useCallback((e: React.AnimationEvent) => {
    const name = e.animationName;

    if (name === 'debug-jump-out') {
      setAnimState('hovering');
    } else if (name === 'debug-spin-once') {
      setAnimState('thinking');
      setSpeechBubbleText('Let me think...');
      runDebuggingAnalysis();
    } else if (name === 'debug-retract') {
      setAnimState('idle');
      setSpeechBubbleText(null);
      hoverTriggeredRef.current = false;
    }
  }, [runDebuggingAnalysis]);

  // ── Button click ──────────────────────────────────────────────────────────
  const handleButtonClick = useCallback(() => {
    clearRetractTimer();
    setSpeechBubbleText(null);
    setAnimState('spinning');
  }, [clearRetractTimer]);

  // ── Render ────────────────────────────────────────────────────────────────
  if (animState === 'idle') return null;

  // Compute positions (fall back to right-side viewport if anchor missing)
  const charLeft = anchorRect ? anchorRect.left - 40 : window.innerWidth - 120;
  const charTop = anchorRect ? anchorRect.top + anchorRect.height / 2 : 80;
  // Button (no bubble): clearly to the left of the character
  const btnLeft = anchorRect ? anchorRect.left - 240 : window.innerWidth - 390;
  const btnTop = charTop;
  // Bubble layout: bubble to the left of character at same vertical level,
  // arrow points right toward character. Right edge kept ≥15px away from character left edge.
  // charLeft - 45 = character left edge; bubble max-width 160px → left = charLeft - 220
  const bubbleBtnLeft = charLeft - 220;

  const showButton = animState === 'hovering' || animState === 'jumping';
  const showBubble = speechBubbleText !== null;

  return createPortal(
    <>
      {/* Character */}
      <div
        className={`debug-overlay-character debug-overlay-character--${animState}`}
        style={{ left: charLeft, top: charTop }}
        onAnimationEnd={handleAnimationEnd}
        data-debug-overlay="true"
      >
        <img
          src={characterBlue}
          alt=""
          style={{ width: '100%', height: '100%', objectFit: 'fill' }}
          draggable={false}
        />
      </div>

      {/* "Tips & Debugging" button */}
      {showButton && !showBubble && (
        <button
          className="debug-overlay-button"
          style={{ left: btnLeft, top: btnTop }}
          onClick={handleButtonClick}
          type="button"
          data-debug-overlay="true"
        >
          <Wrench size={14} />
          Tips &amp; Debugging
        </button>
      )}

      {/* Last-step hint bubble + button */}
      {showBubble && (speechBubbleText !== 'Let me think...') && showButton && (
        <>
          {/* Bubble sits to the left of character at same vertical center;
              the CSS right-arrow points toward the character naturally */}
          <div
            className="debug-overlay-bubble"
            style={{ left: bubbleBtnLeft, top: charTop, maxWidth: '160px' }}
            data-debug-overlay="true"
          >
            {speechBubbleText}
          </div>
          <button
            className="debug-overlay-button"
            style={{ left: bubbleBtnLeft, top: charTop + 105 }}
            onClick={handleButtonClick}
            type="button"
            data-debug-overlay="true"
          >
            <Wrench size={14} />
            Tips &amp; Debugging
          </button>
        </>
      )}

      {/* "Let me think..." bubble during thinking state */}
      {showBubble && speechBubbleText === 'Let me think...' && (
        <div
          className="debug-overlay-bubble"
          style={{ left: btnLeft, top: btnTop }}
          data-debug-overlay="true"
        >
          {speechBubbleText}
        </div>
      )}
    </>,
    document.body
  );
}

export default AIDebuggingOverlay;
