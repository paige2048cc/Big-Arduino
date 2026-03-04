/**
 * InstructionsPanel - Step-by-step guided instructions
 *
 * Provides beginner-friendly instructions for circuit projects.
 * Features:
 * - Step-by-step guidance with Previous/Next navigation
 * - Step dropdown for quick navigation
 * - Auto-detect step completion
 * - Highlight required components in the library
 * - Encouraging messages on completion
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useParams } from 'react-router-dom';
import { Check, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { useCircuitStore } from '../../store/circuitStore';
import './InstructionsPanel.css';

// Step definition
export interface InstructionStep {
  id: string;
  title: string;
  description: string;
  encouragingMessage: string;
  requiredComponents?: string[]; // Component definition IDs to highlight
  checkCompletion: (state: StepCheckState) => boolean;
}

// State passed to completion checker
interface StepCheckState {
  placedComponents: Array<{
    definitionId: string;
    instanceId: string;
    parentBreadboardId?: string;
    insertedPins?: Record<string, string>; // component pin ID → breadboard pin ID
  }>;
  wires: Array<{
    id: string;
    startComponentId: string;
    startPinId: string;
    endComponentId: string;
    endPinId: string;
  }>;
  isSimulating: boolean;
}

// ─── Breadboard connectivity helpers ─────────────────────────────────────────

/**
 * Returns the net name for a breadboard pin ID.
 * Row pins: column letter (A–J) + row number, e.g. "J5" → "row-5-top"
 *   - Columns F–J → top section  → "row-N-top"
 *   - Columns A–E → bottom section → "row-N-bottom"
 * Power rails:
 *   PWR_TOP_PLUS_X     → "power-top-plus"
 *   PWR_TOP_MINUS_X    → "power-top-minus"
 *   PWR_BOTTOM_PLUS_X  → "power-bottom-plus"
 *   PWR_BOTTOM_MINUS_X → "power-bottom-minus"
 */
function getBreadboardPinNet(pinId: string): string | null {
  if (pinId.startsWith('PWR_TOP_PLUS_'))     return 'power-top-plus';
  if (pinId.startsWith('PWR_TOP_MINUS_'))    return 'power-top-minus';
  if (pinId.startsWith('PWR_BOTTOM_PLUS_'))  return 'power-bottom-plus';
  if (pinId.startsWith('PWR_BOTTOM_MINUS_')) return 'power-bottom-minus';

  const m = pinId.match(/^([A-J])(\d+)$/);
  if (m) {
    const [, col, row] = m;
    return 'FGHIJ'.includes(col) ? `row-${row}-top` : `row-${row}-bottom`;
  }
  return null;
}

const ARDUINO_POWER_PINS = new Set(['5V', '3.3V', '3V3', 'VIN']);
const POWER_POS_NETS     = new Set(['power-top-plus', 'power-bottom-plus']);
const POWER_NEG_NETS     = new Set(['power-top-minus', 'power-bottom-minus']);

/** True if the breadboard pin belongs to a positive power rail */
function isBBPowerPos(pinId: string): boolean {
  const net = getBreadboardPinNet(pinId);
  return net !== null && POWER_POS_NETS.has(net);
}

/** True if the breadboard pin belongs to a negative power rail */
function isBBPowerNeg(pinId: string): boolean {
  const net = getBreadboardPinNet(pinId);
  return net !== null && POWER_NEG_NETS.has(net);
}

/**
 * Checks if there is any wire connecting the breadboard's positive power rail
 * to an Arduino power pin (5V / 3.3V / VIN).
 */
function isPowerRailActive(state: StepCheckState): boolean {
  const bb  = state.placedComponents.find(c => c.definitionId === 'breadboard');
  const uno = state.placedComponents.find(c => c.definitionId === 'arduino-uno');
  if (!bb || !uno) return false;

  return state.wires.some(w => {
    const bbPin  = w.startComponentId === bb.instanceId  ? w.startPinId
                 : w.endComponentId   === bb.instanceId  ? w.endPinId   : null;
    const ardPin = w.startComponentId === uno.instanceId ? w.startPinId
                 : w.endComponentId   === uno.instanceId ? w.endPinId   : null;
    return bbPin !== null && ardPin !== null
        && ARDUINO_POWER_PINS.has(ardPin)
        && isBBPowerPos(bbPin);
  });
}

/**
 * Checks if there is any wire connecting the breadboard's negative power rail
 * to an Arduino GND pin.
 */
function isGNDRailActive(state: StepCheckState): boolean {
  const bb  = state.placedComponents.find(c => c.definitionId === 'breadboard');
  const uno = state.placedComponents.find(c => c.definitionId === 'arduino-uno');
  if (!bb || !uno) return false;

  return state.wires.some(w => {
    const bbPin  = w.startComponentId === bb.instanceId  ? w.startPinId
                 : w.endComponentId   === bb.instanceId  ? w.endPinId   : null;
    const ardPin = w.startComponentId === uno.instanceId ? w.startPinId
                 : w.endComponentId   === uno.instanceId ? w.endPinId   : null;
    return bbPin !== null && ardPin !== null
        && ardPin.includes('GND')
        && isBBPowerNeg(bbPin);
  });
}

/**
 * Returns the set of breadboard row nets occupied by the given component's
 * inserted pins.  e.g. { "row-5-top", "row-8-top", "row-5-bottom", "row-8-bottom" }
 */
function getComponentRowNets(
  comp: { insertedPins?: Record<string, string> } | undefined
): Set<string> {
  const nets = new Set<string>();
  if (!comp?.insertedPins) return nets;
  for (const bbPinId of Object.values(comp.insertedPins)) {
    const net = getBreadboardPinNet(bbPinId);
    if (net && net.startsWith('row-')) nets.add(net);
  }
  return nets;
}

/**
 * Returns true if any wire connects a row in `rowNets` to the positive power
 * rail (within the breadboard), OR directly from Arduino power to that row.
 */
function isRowConnectedToPowerRail(
  rowNets: Set<string>,
  state: StepCheckState
): boolean {
  const bb  = state.placedComponents.find(c => c.definitionId === 'breadboard');
  const uno = state.placedComponents.find(c => c.definitionId === 'arduino-uno');
  if (!bb) return false;

  return state.wires.some(w => {
    // Case A: both ends on the breadboard
    if (w.startComponentId === bb.instanceId && w.endComponentId === bb.instanceId) {
      const sNet = getBreadboardPinNet(w.startPinId);
      const eNet = getBreadboardPinNet(w.endPinId);
      if (!sNet || !eNet) return false;
      return (POWER_POS_NETS.has(sNet) && rowNets.has(eNet))
          || (POWER_POS_NETS.has(eNet) && rowNets.has(sNet));
    }
    // Case B: direct wire from Arduino power pin to a row
    if (uno) {
      const bbPin  = w.startComponentId === bb.instanceId  ? w.startPinId
                   : w.endComponentId   === bb.instanceId  ? w.endPinId   : null;
      const ardPin = w.startComponentId === uno.instanceId ? w.startPinId
                   : w.endComponentId   === uno.instanceId ? w.endPinId   : null;
      if (bbPin && ardPin && ARDUINO_POWER_PINS.has(ardPin)) {
        const bbNet = getBreadboardPinNet(bbPin);
        return bbNet !== null && rowNets.has(bbNet);
      }
    }
    return false;
  });
}

/**
 * Returns true if any wire connects a specific breadboard row net to the
 * negative power rail, OR if a component pin goes directly to Arduino GND.
 *
 * @param rowNet        The net of the row that should reach GND (e.g. "row-5-bottom")
 * @param compId        Instance ID of the component whose pin should reach GND
 * @param compGNDPinId  The pin ID on that component that is the negative/cathode pin
 */
function isRowConnectedToGNDRail(
  rowNet: string,
  compId: string,
  compGNDPinId: string,
  state: StepCheckState
): boolean {
  const bb  = state.placedComponents.find(c => c.definitionId === 'breadboard');
  const uno = state.placedComponents.find(c => c.definitionId === 'arduino-uno');
  if (!bb) return false;

  return state.wires.some(w => {
    // Case A: breadboard row → negative power rail
    if (w.startComponentId === bb.instanceId && w.endComponentId === bb.instanceId) {
      const sNet = getBreadboardPinNet(w.startPinId);
      const eNet = getBreadboardPinNet(w.endPinId);
      if (!sNet || !eNet) return false;
      return (POWER_NEG_NETS.has(sNet) && eNet === rowNet)
          || (POWER_NEG_NETS.has(eNet) && sNet === rowNet);
    }
    // Case B: direct wire from component GND pin to Arduino GND
    if (uno) {
      const isCompGND = (w.startComponentId === compId && w.startPinId === compGNDPinId)
                     || (w.endComponentId   === compId && w.endPinId   === compGNDPinId);
      const ardPin = w.startComponentId === uno.instanceId ? w.startPinId
                   : w.endComponentId   === uno.instanceId ? w.endPinId   : null;
      return isCompGND && ardPin !== null && ardPin.includes('GND');
    }
    return false;
  });
}

// Light Up an LED project instructions (8 steps)
export const LIGHT_UP_LED_STEPS: InstructionStep[] = [
  {
    id: 'step-1',
    title: 'Prepare Your Components',
    description: "Let's start! Drag the following components into your workspace.\n\u2022 Arduino Uno\n\u2022 Breadboard\n\u2022 LED\n\u2022 Button\n\u2022 220\u03A9 Resistor",
    encouragingMessage: "Great start! You've got all your parts ready.",
    requiredComponents: ['arduino-uno', 'breadboard', 'led-5mm', 'pushbutton', 'Registor_220\u03A9'],
    checkCompletion: (state) => {
      const required = ['arduino-uno', 'breadboard', 'led-5mm', 'pushbutton', 'registor_220\u03C9'];
      const placedLower = state.placedComponents.map(c => c.definitionId.toLowerCase());
      return required.every(r => placedLower.includes(r.toLowerCase()));
    },
  },
  {
    id: 'step-2',
    title: 'Power the Breadboard',
    description: "Connect the Arduino to the breadboard so it can supply power.\n\n\u2022 Connect a wire from the 5V pin on the Arduino to the red power rail (+) on the breadboard.\n\u2022 Connect another wire from GND on the Arduino to the blue ground rail (-) on the breadboard.",
    encouragingMessage: 'Perfect! Your breadboard now has power.',
    checkCompletion: (state) => {
      return state.wires.length >= 2;
    },
  },
  {
    id: 'step-3',
    title: 'Place the LED',
    description: "Insert the LED onto the breadboard.\n\n\u2022 The long leg (anode, +) goes into one row.\n\u2022 The short leg (cathode, -) goes into a different row.",
    encouragingMessage: 'Nice! The LED is on the breadboard.',
    checkCompletion: (state) => {
      return state.placedComponents.some(
        c => c.definitionId === 'led-5mm' && c.parentBreadboardId
      );
    },
  },
  {
    id: 'step-4',
    title: 'Add the Resistor',
    description: "Now insert the 220\u03A9 resistor into breadboard.\nThe resistor helps protect your LED from too much current.\nWithout a resistor, the LED could be damaged.\n\n\u2022 Rotate and then place one leg of the resistor in the same row as the LED's long leg (anode, +).\n\nTip: If two legs share the same row, they are already connected. No extra wire is needed.",
    encouragingMessage: 'Great! The resistor is protecting your LED.',
    checkCompletion: (state) => {
      return state.placedComponents.some(
        c => c.definitionId.toLowerCase() === 'registor_220\u03C9' && c.parentBreadboardId
      );
    },
  },
  {
    id: 'step-5',
    title: 'Place the Button',
    description: "\u2022 Place the button on to the breadboard and make sure insert one leg into the same row as the other leg of resistor.\n\nTip: It's best to place the button across the center gap of the breadboard so the two sides are separated correctly.",
    encouragingMessage: 'Nice! The button is in place.',
    checkCompletion: (state) => {
      return state.placedComponents.some(
        c => c.definitionId === 'pushbutton' && c.parentBreadboardId
      );
    },
  },
  {
    id: 'step-6',
    title: 'Connect the Button to Power',
    description: "Now connect the button so it can control the flow of electricity.\n\n\u2022 Connect one side of the button to the red power rail (+).",
    encouragingMessage: 'Great! Power is connected to the button.',
    checkCompletion: (state) => {
      const button = state.placedComponents.find(c => c.definitionId === 'pushbutton');
      if (!button?.insertedPins) return false;

      // The power rail must be connected to Arduino 5V/VIN (from step 2)
      if (!isPowerRailActive(state)) return false;

      // One of the button's row nets must be wired to the positive power rail
      const buttonRowNets = getComponentRowNets(button);
      return isRowConnectedToPowerRail(buttonRowNets, state);
    },
  },
  {
    id: 'step-7',
    title: 'Complete the Circuit',
    description: "Finish the path so electricity can return to ground.\n\n\u2022 Connect the other side of the button to the resistor (if not already connected).\n\u2022 Ensure the resistor connects to the LED's long leg (anode, +).\n\u2022 Connect the LED's short leg (cathode, -) to the blue ground rail (-).\n\nTip: If components share the same row, they are already connected. No wire needed.",
    encouragingMessage: 'Excellent wiring! Your circuit is complete.',
    checkCompletion: (state) => {
      const led = state.placedComponents.find(c => c.definitionId === 'led-5mm');
      if (!led?.insertedPins) return false;

      // The GND rail must be connected to Arduino GND (from step 2)
      if (!isGNDRailActive(state)) return false;

      // LED CATHODE row must connect to the negative power rail (or directly to Arduino GND)
      const cathodeBBPin = led.insertedPins['CATHODE'];
      if (!cathodeBBPin) return false;
      const cathodeNet = getBreadboardPinNet(cathodeBBPin);
      if (!cathodeNet || !cathodeNet.startsWith('row-')) return false;

      return isRowConnectedToGNDRail(cathodeNet, led.instanceId, 'CATHODE', state);
    },
  },
  {
    id: 'step-8',
    title: 'Time to Test!',
    description: "Click \"Start Simulation\" in the top bar.\nNow press the button.\n\nYou should see the LED light up!\nRelease the button and the LED turns off.\nThat's your first working circuit!",
    encouragingMessage: 'Congratulations! You built your first LED circuit!',
    checkCompletion: (state) => {
      return state.isSimulating;
    },
  },
];

// Buzzer Button project instructions (8 steps)
export const BUZZER_BUTTON_STEPS: InstructionStep[] = [
  {
    id: 'step-1',
    title: 'Prepare Your Components',
    description: "Let's start! Drag the following components into your workspace.\n\u2022 Arduino Uno\n\u2022 Breadboard\n\u2022 Buzzer\n\u2022 Button\n\u2022 100\u03A9 Resistor",
    encouragingMessage: "Great start! You've got all your parts ready.",
    requiredComponents: ['arduino-uno', 'breadboard', 'buzzer', 'pushbutton', 'Registor_220\u03A9'],
    checkCompletion: (state) => {
      const required = ['arduino-uno', 'breadboard', 'buzzer', 'pushbutton', 'registor_220\u03C9'];
      const placedLower = state.placedComponents.map(c => c.definitionId.toLowerCase());
      return required.every(r => placedLower.includes(r.toLowerCase()));
    },
  },
  {
    id: 'step-2',
    title: 'Power the Breadboard',
    description: "Connect the Arduino to the breadboard so it can supply power.\n\n\u2022 Connect a wire from the 5V pin on the Arduino to the red power rail (+) on the breadboard.\n\u2022 Connect another wire from GND on the Arduino to the blue ground rail (-) on the breadboard.",
    encouragingMessage: 'Perfect! Your breadboard now has power.',
    checkCompletion: (state) => {
      return state.wires.length >= 2;
    },
  },
  {
    id: 'step-3',
    title: 'Place the Buzzer',
    description: "Insert the buzzer onto the breadboard.\n\n\u2022 The anode leg (+) goes into one row.\n\u2022 The cathode leg (-) goes into a different row.",
    encouragingMessage: 'Nice! The buzzer is on the breadboard.',
    checkCompletion: (state) => {
      return state.placedComponents.some(
        c => c.definitionId === 'buzzer' && c.parentBreadboardId
      );
    },
  },
  {
    id: 'step-4',
    title: 'Add the Resistor',
    description: "Now insert the 100\u03A9 resistor into breadboard.\nThe resistor helps limit the electrical flow to keep the Arduino safe.\n\n\u2022 Place one leg of the resistor in the same row as the buzzer's anode (+).\n\nTip: If two legs share the same row, they are already connected. No extra wire is needed.",
    encouragingMessage: 'Great! The resistor is in place.',
    checkCompletion: (state) => {
      return state.placedComponents.some(
        c => c.definitionId.toLowerCase() === 'registor_220\u03C9' && c.parentBreadboardId
      );
    },
  },
  {
    id: 'step-5',
    title: 'Place the Button',
    description: "\u2022 Place the button on to the breadboard and make sure insert one leg into the same row as the other leg of resistor.\n\nTip: It's best to place the button across the center gap of the breadboard so the two sides are separated correctly.",
    encouragingMessage: 'Nice! The button is in place.',
    checkCompletion: (state) => {
      return state.placedComponents.some(
        c => c.definitionId === 'pushbutton' && c.parentBreadboardId
      );
    },
  },
  {
    id: 'step-6',
    title: 'Connect the Button to Power',
    description: "Now connect the button so it can control the flow of electricity.\n\n\u2022 Connect one side of the button to the red power rail (+).",
    encouragingMessage: 'Great! Power is connected to the button.',
    checkCompletion: (state) => {
      const button = state.placedComponents.find(c => c.definitionId === 'pushbutton');
      if (!button?.insertedPins) return false;

      // The power rail must be connected to Arduino 5V/VIN (from step 2)
      if (!isPowerRailActive(state)) return false;

      // One of the button's row nets must be wired to the positive power rail
      const buttonRowNets = getComponentRowNets(button);
      return isRowConnectedToPowerRail(buttonRowNets, state);
    },
  },
  {
    id: 'step-7',
    title: 'Complete the Circuit',
    description: "Finish the path so electricity can return to ground.\n\n\u2022 Connect the other side of the button to the resistor (if not already connected).\n\u2022 Ensure the resistor connects to the buzzer's anode (+).\n\u2022 Connect the buzzer's cathode (\u2013) to the blue ground rail (\u2013).\n\nTip: If components share the same row, they are already connected. No wire needed.",
    encouragingMessage: 'Excellent wiring! Your circuit is complete.',
    checkCompletion: (state) => {
      const buzzer = state.placedComponents.find(c => c.definitionId === 'buzzer');
      if (!buzzer?.insertedPins) return false;

      // The GND rail must be connected to Arduino GND (from step 2)
      if (!isGNDRailActive(state)) return false;

      // Buzzer NEGATIVE row must connect to the negative power rail (or directly to Arduino GND)
      const negativeBBPin = buzzer.insertedPins['NEGATIVE'];
      if (!negativeBBPin) return false;
      const negativeNet = getBreadboardPinNet(negativeBBPin);
      if (!negativeNet || !negativeNet.startsWith('row-')) return false;

      return isRowConnectedToGNDRail(negativeNet, buzzer.instanceId, 'NEGATIVE', state);
    },
  },
  {
    id: 'step-8',
    title: 'Time to Test!',
    description: "Click \"Start Simulation\" in the top bar.\nNow press the button.\n\nYou should hear a soft buzzing sound.\nThat sound is normal!\nBecause there is no code controlling the tone, the buzzer is simply receiving raw electrical signals instead of playing a defined note.",
    encouragingMessage: 'Congratulations! You built your first buzzer circuit!',
    checkCompletion: (state) => {
      return state.isSimulating;
    },
  },
];

// Map project IDs to their instruction steps
const PROJECT_STEPS: Record<string, InstructionStep[]> = {
  'led-button': LIGHT_UP_LED_STEPS,
  'buzzer-button': BUZZER_BUTTON_STEPS,
};

interface InstructionsPanelProps {
  steps?: InstructionStep[];
}

export function InstructionsPanel({
  steps: stepsProp,
}: InstructionsPanelProps) {
  const { projectId } = useParams<{ projectId: string }>();
  const steps = stepsProp || (projectId && PROJECT_STEPS[projectId]) || LIGHT_UP_LED_STEPS;
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [headerActionsEl, setHeaderActionsEl] = useState<HTMLElement | null>(null);

  // Get circuit state for completion checking
  const placedComponents = useCircuitStore((state) => state.placedComponents);
  const wires = useCircuitStore((state) => state.wires);
  const isSimulating = useCircuitStore((state) => state.isSimulating);
  const setHighlightedToolbarComponents = useCircuitStore((state) => state.setHighlightedToolbarComponents);
  const setInstructionStep = useCircuitStore((state) => state.setInstructionStep);

  // Build state for completion checks
  const checkState: StepCheckState = useMemo(() => ({
    placedComponents: placedComponents.map(c => ({
      definitionId: c.definitionId,
      instanceId: c.instanceId,
      parentBreadboardId: c.parentBreadboardId,
      insertedPins: c.insertedPins,
    })),
    wires: wires.map(w => ({
      id: w.id,
      startComponentId: w.startComponentId,
      startPinId: w.startPinId,
      endComponentId: w.endComponentId,
      endPinId: w.endPinId,
    })),
    isSimulating,
  }), [placedComponents, wires, isSimulating]);

  // Calculate completed steps
  const stepCompletion = useMemo(() => {
    return steps.map(step => step.checkCompletion(checkState));
  }, [steps, checkState]);

  // Current step
  const currentStep = steps[currentStepIndex];
  const isCurrentStepComplete = stepCompletion[currentStepIndex];
  const [justCompleted, setJustCompleted] = useState(false);

  // Sync instruction step to store for AI debugging overlay
  useEffect(() => {
    setInstructionStep(currentStepIndex, steps.length);
  }, [currentStepIndex, steps.length, setInstructionStep]);

  // Trigger checkmark animation on completion
  useEffect(() => {
    if (isCurrentStepComplete) {
      setJustCompleted(true);
    } else {
      setJustCompleted(false);
    }
  }, [isCurrentStepComplete]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };

    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [dropdownOpen]);

  // Highlight required components for current step
  useEffect(() => {
    if (!currentStep || isCurrentStepComplete) {
      setHighlightedToolbarComponents(null);
      return;
    }

    const requiredComponents = currentStep.requiredComponents || [];
    if (requiredComponents.length === 0) {
      setHighlightedToolbarComponents(null);
      return;
    }

    // Get components that haven't been placed yet (case-insensitive to handle ID mismatches)
    const placedLower = placedComponents.map(c => c.definitionId.toLowerCase());
    const missingComponents = requiredComponents.filter(id => !placedLower.includes(id.toLowerCase()));

    if (missingComponents.length === 0) {
      setHighlightedToolbarComponents(null);
      return;
    }

    // Highlight all missing components at once (no cycling)
    setHighlightedToolbarComponents(missingComponents);

    return () => {
      setHighlightedToolbarComponents(null);
    };
  }, [currentStepIndex, isCurrentStepComplete, currentStep, placedComponents, setHighlightedToolbarComponents]);

  // Navigation handlers
  const goToPreviousStep = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  };

  const goToNextStep = () => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    }
  };

  const goToStep = (index: number) => {
    setCurrentStepIndex(index);
    setDropdownOpen(false);
  };

  const toggleDropdown = () => {
    setDropdownOpen(!dropdownOpen);
  };

  // Mount the step indicator into the dockable panel header (right side).
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const panelEl = root.closest('.dockable-panel');
    const actions = panelEl?.querySelector('.dockable-panel-header-actions') as HTMLElement | null;
    setHeaderActionsEl(actions ?? null);

    return () => {
      setHeaderActionsEl(null);
    };
  }, []);

  const stepIndicator = (
    <div className="step-indicator" ref={dropdownRef}>
      <button
        className="step-indicator-button"
        onClick={toggleDropdown}
        aria-expanded={dropdownOpen}
        aria-haspopup="listbox"
        type="button"
      >
        <span className="step-count">
          {currentStepIndex + 1}/{steps.length}
        </span>
        <ChevronDown size={14} className={`dropdown-chevron ${dropdownOpen ? 'open' : ''}`} />
      </button>

      {/* Dropdown menu */}
      {dropdownOpen && (
        <div className="step-dropdown" role="listbox">
          {steps.map((step, index) => (
            <button
              key={step.id}
              className={`step-dropdown-item ${index === currentStepIndex ? 'active' : ''} ${stepCompletion[index] ? 'completed' : ''}`}
              onClick={() => goToStep(index)}
              role="option"
              aria-selected={index === currentStepIndex}
              type="button"
            >
              <span className="step-dropdown-number">{index + 1}.</span>
              <span className="step-dropdown-title">{step.title}</span>
              {stepCompletion[index] && (
                <Check size={14} className="step-dropdown-check" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="instructions-panel" ref={rootRef}>
      {headerActionsEl ? createPortal(stepIndicator, headerActionsEl) : null}

      {/* Checkmark for completed step */}
      {isCurrentStepComplete && (
        <div className={`step-checkmark ${justCompleted ? 'step-checkmark--animate' : ''}`}>
          <Check size={16} />
        </div>
      )}

      {/* Step title */}
      <h3 className="step-title">{currentStep.title}</h3>

      {/* Step description */}
      <p className="step-description">{currentStep.description}</p>

      {/* Encouraging message (shown when step is complete) */}
      {isCurrentStepComplete && (
        <p className="step-encouraging-message">{currentStep.encouragingMessage}</p>
      )}

      {/* Navigation buttons */}
      <div className="step-navigation">
        <button
          className="step-nav-button step-nav-previous"
          onClick={goToPreviousStep}
          disabled={currentStepIndex === 0}
          type="button"
        >
          <ChevronLeft size={16} />
          Previous
        </button>
        <button
          className="step-nav-button step-nav-next"
          onClick={goToNextStep}
          disabled={currentStepIndex === steps.length - 1}
          type="button"
        >
          Next Step
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

export default InstructionsPanel;
