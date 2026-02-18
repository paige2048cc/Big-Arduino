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
  }>;
  wires: Array<{ id: string }>;
  isSimulating: boolean;
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
      return state.wires.length >= 3;
    },
  },
  {
    id: 'step-7',
    title: 'Complete the Circuit',
    description: "Finish the path so electricity can return to ground.\n\n\u2022 Connect the other side of the button to the resistor (if not already connected).\n\u2022 Ensure the resistor connects to the LED's long leg (anode, +).\n\u2022 Connect the LED's short leg (cathode, -) to the blue ground rail (-).\n\nTip: If components share the same row, they are already connected. No wire needed.",
    encouragingMessage: 'Excellent wiring! Your circuit is complete.',
    checkCompletion: (state) => {
      return state.wires.length >= 5;
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
      return state.wires.length >= 3;
    },
  },
  {
    id: 'step-7',
    title: 'Complete the Circuit',
    description: "Finish the path so electricity can return to ground.\n\n\u2022 Connect the other side of the button to the resistor (if not already connected).\n\u2022 Ensure the resistor connects to the buzzer's anode (+).\n\u2022 Connect the buzzer's cathode (\u2013) to the blue ground rail (\u2013).\n\nTip: If components share the same row, they are already connected. No wire needed.",
    encouragingMessage: 'Excellent wiring! Your circuit is complete.',
    checkCompletion: (state) => {
      return state.wires.length >= 5;
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

  // Build state for completion checks
  const checkState: StepCheckState = useMemo(() => ({
    placedComponents: placedComponents.map(c => ({
      definitionId: c.definitionId,
      instanceId: c.instanceId,
      parentBreadboardId: c.parentBreadboardId,
    })),
    wires: wires.map(w => ({ id: w.id })),
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
