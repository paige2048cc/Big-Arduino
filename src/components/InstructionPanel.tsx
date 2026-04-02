import React, { useState, useEffect } from 'react';
import { Lightbulb, PanelRightClose, PanelRightOpen, ChevronDown, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const STEPS = [
  {
    id: 1,
    text: "Pick out components from the panel to add to your workplace to duplicate the circuit shown.",
    encouragement: "Great start! Gathering your materials is the first step to success."
  },
  {
    id: 2,
    text: "Create wires connecting Arduino's 5V pin with the red (+) power rail on your breadboard, and likewise GND with the black (-) ground rail.",
    encouragement: "Power is flowing! Red for positive, Black for ground is a standard convention."
  },
  {
    id: 3,
    text: "Position your LEDs so the legs go to two different rows of the breadboard.",
    encouragement: "Nice placement! Giving components space makes debugging easier."
  },
  {
    id: 4,
    text: "Attach wires to any of the holes in the same row to make an electrical connection. Just like before, we want to connect the LED and resistor in series to pin 13 and ground.",
    encouragement: "You're making connections! Series circuits are fundamental to electronics."
  },
  {
    id: 5,
    text: "Add a few more LEDs to this circuit, along with their companion resistors. For each, connect one end to ground and the other to a different digital input pin on the Arduino board, and customize the wire color.",
    encouragement: "Scaling up! Now you're building a real light show."
  },
  {
    id: 6,
    text: "Connect the Arduino to your computer and upload the code to see your lights blink!",
    encouragement: "You did it! Testing is the final step of design."
  }
];

interface InstructionPanelProps {
  currentStep?: number;
  onStepChange?: (step: number) => void;
}

export function InstructionPanel({ currentStep: externalStep, onStepChange }: InstructionPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // State for navigation (internal fallback if not controlled, or sync with prop)
  const [internalStep, setInternalStep] = useState(1);
  
  const step = externalStep !== undefined ? externalStep : internalStep;
  
  const [showEncouragement, setShowEncouragement] = useState(false);
  const [maxStepReached, setMaxStepReached] = useState(1);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Sync internal state if prop changes (optional, but good practice)
  useEffect(() => {
    if (externalStep !== undefined) {
      setInternalStep(externalStep);
      // Reset encouragement when step changes externally
      setShowEncouragement(false); 
    }
  }, [externalStep]);

  // Derived state
  const stepData = STEPS[step - 1] || STEPS[0];
  const isLastStep = step === STEPS.length && showEncouragement;
  const isFirstPhase = step === 1 && !showEncouragement;

  const updateStep = (newStep: number) => {
    if (onStepChange) {
      onStepChange(newStep);
    } else {
      setInternalStep(newStep);
    }
    
    if (newStep > maxStepReached) {
      setMaxStepReached(newStep);
    }
  };

  const handleNext = () => {
    if (!showEncouragement) {
      setShowEncouragement(true);
    } else {
      if (step < STEPS.length) {
        updateStep(step + 1);
        setShowEncouragement(false);
      }
    }
  };

  const handlePrevious = () => {
    if (showEncouragement) {
      setShowEncouragement(false);
    } else {
      if (step > 1) {
        updateStep(step - 1);
        setShowEncouragement(true);
      }
    }
  };

  const jumpToStep = (stepId: number) => {
    if (stepId <= maxStepReached) {
      updateStep(stepId);
      setShowEncouragement(false);
      setIsDropdownOpen(false);
    }
  };

  return (
    <motion.div 
      layout
      className="absolute top-4 right-4 z-30 bg-[#CEDBE4] shadow-xl overflow-hidden rounded-[10px]"
      animate={{ 
        width: isExpanded ? 340 : 'auto' 
      }}
      transition={{ 
        duration: 0.4, 
        ease: [0.4, 0, 0.2, 1] 
      }}
    >
      <div className="flex flex-col">
        {/* Header Section */}
        <motion.button 
          layout="position"
          onClick={() => setIsExpanded(!isExpanded)}
          className={`flex items-center justify-between px-4 py-3 w-full transition-colors ${!isExpanded ? 'hover:bg-black/5' : ''}`}
        >
          <div className="flex items-center gap-3">
             <Lightbulb size={20} className="text-slate-800 shrink-0" strokeWidth={2} />
             <span className="font-medium text-[18px] text-black whitespace-nowrap">Instructions</span>
          </div>

          <div className="flex items-center">
            {/* Divider */}
            <motion.div 
              animate={{ opacity: isExpanded ? 0 : 1, width: isExpanded ? 0 : 'auto' }}
              className="overflow-hidden"
            >
               <div className="w-px h-5 bg-slate-400/50 mx-1"></div>
            </motion.div>

            {/* Icon Swap */}
            <div className="relative w-6 h-6 flex items-center justify-center">
               <AnimatePresence mode="wait" initial={false}>
                 {isExpanded ? (
                   <motion.div
                     key="close"
                     initial={{ rotate: -90, opacity: 0 }}
                     animate={{ rotate: 0, opacity: 1 }}
                     exit={{ rotate: 90, opacity: 0 }}
                     transition={{ duration: 0.2 }}
                   >
                     <PanelRightClose size={22} strokeWidth={1.5} className="text-black" />
                   </motion.div>
                 ) : (
                   <motion.div
                     key="open"
                     initial={{ rotate: 90, opacity: 0 }}
                     animate={{ rotate: 0, opacity: 1 }}
                     exit={{ rotate: -90, opacity: 0 }}
                     transition={{ duration: 0.2 }}
                   >
                     <PanelRightOpen size={20} className="text-slate-800" />
                   </motion.div>
                 )}
               </AnimatePresence>
            </div>
          </div>
        </motion.button>

        {/* Content Section */}
        <motion.div
          layout="position"
          initial={false}
          animate={{ 
             height: isExpanded ? 'auto' : 0,
             opacity: isExpanded ? 1 : 0
          }}
          transition={{ 
             duration: 0.4, 
             ease: [0.4, 0, 0.2, 1] 
          }}
          className="overflow-hidden w-[340px]"
        >
          <div className="px-6 pb-6 pt-0 flex flex-col gap-6">
            
            {/* Step Counter Dropdown */}
            <div className="relative flex justify-center z-20">
              <button 
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="bg-[#FFF7D6] px-4 py-2 rounded-[10px] font-semibold text-[14px] flex items-center gap-1 hover:bg-[#fcf0c0] transition-colors"
              >
                <span className={`leading-[20px] ${showEncouragement ? 'text-[#1A2BC3]' : 'text-[#7C7B7B]'}`}>
                  {step}
                </span>
                <span className="text-[#7C7B7B] leading-[20px]">/{STEPS.length}</span>
                <ChevronDown size={14} className={`text-[#7C7B7B] ml-1 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence>
                {isDropdownOpen && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: 'auto' }}
                    exit={{ opacity: 0, y: -10, height: 0 }}
                    className="absolute top-full mt-2 bg-white rounded-lg shadow-xl border border-slate-100 py-1 w-full max-h-[200px] overflow-y-auto z-50"
                  >
                    {STEPS.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => jumpToStep(s.id)}
                        disabled={s.id > maxStepReached}
                        className={`w-full px-4 py-2 text-left text-sm flex items-center justify-between
                          ${s.id === step ? 'bg-blue-50 text-blue-700 font-medium' : ''}
                          ${s.id > maxStepReached ? 'text-slate-300 cursor-not-allowed' : 'text-slate-700 hover:bg-slate-50 cursor-pointer'}
                        `}
                      >
                        <span>Step {s.id}</span>
                        {(s.id < step || (s.id === step && showEncouragement)) && (
                           <Check size={14} className="text-green-500" />
                        )}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Step Content */}
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-4">
                 {/* Step Indicator Icon */}
                 <div>
                   {showEncouragement ? (
                      <motion.div 
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="w-5 h-5 rounded-full bg-[#FCC049] flex items-center justify-center shrink-0"
                      >
                        <Check size={12} strokeWidth={3} className="text-black" />
                      </motion.div>
                   ) : (
                      <motion.div 
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="w-5 h-5 rounded-full bg-[#FFF7D6] flex items-center justify-center shrink-0"
                      >
                        <span className="text-xs font-normal text-black">{stepData.id}</span>
                      </motion.div>
                   )}
                 </div>

                 {/* Text Box */}
                 <div className="bg-[#F4F5F6] rounded-[10px] px-4 py-[14px] flex-1 min-h-[100px] flex flex-col justify-center transition-all">
                    <p className="text-[14px] text-black leading-[20px] whitespace-pre-wrap font-normal">
                      {stepData.text}
                    </p>
                    
                    {/* Encouragement */}
                    <AnimatePresence>
                      {showEncouragement && (
                         <motion.div 
                           initial={{ opacity: 0, height: 0, marginTop: 0 }}
                           animate={{ opacity: 1, height: 'auto', marginTop: 16 }}
                           exit={{ opacity: 0, height: 0, marginTop: 0 }}
                           className="overflow-hidden"
                         >
                           <p className="text-[14px] text-[#1A2BC3] font-normal leading-[20px]">
                             {stepData.encouragement}
                           </p>
                         </motion.div>
                      )}
                    </AnimatePresence>
                 </div>
              </div>
            </div>

            {/* Footer Navigation */}
            <div className="flex items-center justify-between gap-3 mt-auto">
               <button 
                 onClick={handlePrevious}
                 disabled={isFirstPhase}
                 className={`
                   flex-1 px-4 py-2 rounded-[10px] border-2 border-[#1A2BC3] text-[#1A2BC3] font-semibold text-[14px]
                   flex items-center justify-center transition-all
                   ${isFirstPhase ? 'opacity-50 cursor-not-allowed bg-transparent' : 'hover:bg-blue-50 bg-transparent'}
                 `}
               >
                 Previous
               </button>

               <button 
                 onClick={handleNext}
                 disabled={isLastStep}
                 className={`
                   flex-1 px-4 py-2 rounded-[10px] bg-[#1A2BC3] text-white font-semibold text-[14px]
                   flex items-center justify-center transition-all shadow-sm
                   ${isLastStep ? 'opacity-80' : 'hover:bg-blue-800'}
                 `}
               >
                 {isLastStep ? 'Finish' : 'Next Step'}
               </button>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
