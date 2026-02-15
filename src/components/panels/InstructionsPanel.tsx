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

// Light Up an LED project instructions (6 steps)
export const LIGHT_UP_LED_STEPS: InstructionStep[] = [
  {
    id: 'step-1',
    title: 'Gather Your Components',
    description: "Let's start! Drag these components from the left panel into your workspace: Arduino Uno, Breadboard, LED, and a 220\u03A9 Resistor.",
    encouragingMessage: "Great start! You've got all your parts ready.",
    requiredComponents: ['arduino-uno', 'breadboard', 'led-5mm', 'Registor_220\u03A9'],
    checkCompletion: (state) => {
      const required = ['arduino-uno', 'breadboard', 'led-5mm', 'Registor_220\u03A9'];
      const placed = state.placedComponents.map(c => c.definitionId);
      return required.every(r => placed.includes(r));
    },
  },
  {
    id: 'step-2',
    title: 'Place Components on Breadboard',
    description: 'Now let\'s organize! Drag the LED and Resistor onto the breadboard. The breadboard makes it easy to connect things together.',
    encouragingMessage: 'Nice work! Your breadboard is taking shape.',
    checkCompletion: (state) => {
      const ledOnBreadboard = state.placedComponents.some(
        c => c.definitionId === 'led-5mm' && c.parentBreadboardId
      );
      const resistorOnBreadboard = state.placedComponents.some(
        c => c.definitionId === 'Registor_220\u03A9' && c.parentBreadboardId
      );
      return ledOnBreadboard && resistorOnBreadboard;
    },
  },
  {
    id: 'step-3',
    title: 'Connect Arduino to Power Rails',
    description: "Time to power up! Connect a wire from Arduino's 5V pin to the red (+) rail. Then connect GND to the blue (-) rail.",
    encouragingMessage: 'Perfect! Your breadboard now has power.',
    checkCompletion: (state) => {
      return state.wires.length >= 2;
    },
  },
  {
    id: 'step-4',
    title: 'Connect Power to Resistor',
    description: "Let's start the circuit! Connect a wire from the red power rail (+) to one leg of the resistor. This brings electricity to your circuit.",
    encouragingMessage: 'Great! Power is flowing to the resistor.',
    checkCompletion: (state) => {
      return state.wires.length >= 3;
    },
  },
  {
    id: 'step-5',
    title: 'Complete the LED Circuit',
    description: "Almost done! The resistor's other leg should connect to the LED's long leg (anode, +). Then connect the LED's short leg (cathode, -) to the blue ground rail (-).",
    encouragingMessage: 'Excellent wiring! Your circuit is complete.',
    checkCompletion: (state) => {
      return state.wires.length >= 4;
    },
  },
  {
    id: 'step-6',
    title: 'Light It Up!',
    description: "Time for the magic! Click 'Start Simulation' in the top bar and watch your LED light up!",
    encouragingMessage: 'Congratulations! You built your first LED circuit!',
    checkCompletion: (state) => {
      return state.isSimulating;
    },
  },
];

interface InstructionsPanelProps {
  steps?: InstructionStep[];
}

export function InstructionsPanel({
  steps = LIGHT_UP_LED_STEPS,
}: InstructionsPanelProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

    // Get components that haven't been placed yet
    const placedIds = placedComponents.map(c => c.definitionId);
    const missingComponents = requiredComponents.filter(id => !placedIds.includes(id));

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

  return (
    <div className="instructions-panel">
      {/* Step content card */}
      <div className="step-card">
        {/* Step indicator with dropdown */}
        <div className="step-card-top">
          <div className="step-indicator" ref={dropdownRef}>
            <button
              className="step-indicator-button"
              onClick={toggleDropdown}
              aria-expanded={dropdownOpen}
              aria-haspopup="listbox"
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
        </div>

        {/* Checkmark for completed step */}
        {isCurrentStepComplete && (
          <div className="step-checkmark">
            <Check size={16} />
          </div>
        )}

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
          >
            <ChevronLeft size={16} />
            Previous
          </button>
          <button
            className="step-nav-button step-nav-next"
            onClick={goToNextStep}
            disabled={currentStepIndex === steps.length - 1}
          >
            Next Step
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default InstructionsPanel;
