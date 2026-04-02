import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface TutorialOverlayProps {
  onComplete: () => void;
}

export function TutorialOverlay({ onComplete }: TutorialOverlayProps) {
  const [step, setStep] = useState(0);

  const steps = [
    {
      title: "To Start",
      description: "Drag an LED component from the sidebar into your workspace.",
      animation: (
        <div className="relative w-full h-full bg-[#F0F4F8] flex items-center justify-center overflow-hidden">
           {/* Grid Background */}
           <div className="absolute inset-0 grid grid-cols-[repeat(auto-fill,20px)] grid-rows-[repeat(auto-fill,20px)] opacity-10">
              {[...Array(100)].map((_, i) => <div key={i} className="border-[0.5px] border-slate-400" />)}
           </div>

           {/* Sidebar Representation */}
           <div className="absolute left-0 top-0 bottom-0 w-16 bg-white border-r border-slate-200 shadow-sm z-10 flex flex-col items-center pt-4 gap-2">
              <div className="w-8 h-8 rounded bg-slate-100" />
              <div className="w-8 h-8 rounded bg-slate-100" />
              <div className="w-8 h-8 rounded bg-slate-100" />
           </div>

           {/* LED Component */}
           <motion.div
             initial={{ x: 20, y: 30, opacity: 1, scale: 0.8 }}
             animate={{ x: 120, y: 80, scale: 1.2 }}
             transition={{ duration: 1.5, ease: "easeInOut", repeat: Infinity, repeatDelay: 1 }}
             className="z-20 relative"
           >
              {/* LED SVG */}
              <svg width="40" height="60" viewBox="0 0 40 60" fill="none">
                 <path d="M12 35 L12 55" stroke="#94A3B8" strokeWidth="4" strokeLinecap="round"/>
                 <path d="M28 35 L28 50" stroke="#94A3B8" strokeWidth="4" strokeLinecap="round"/>
                 <path d="M10 35 L30 35 L30 15 C30 5 10 5 10 15 Z" fill="#EF4444" stroke="#B91C1C" strokeWidth="2"/>
              </svg>
              
              {/* Cursor Hand */}
              <motion.div 
                 className="absolute -bottom-2 -right-2 pointer-events-none"
                 animate={{ scale: [1, 0.9, 1] }}
                 transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 1 }}
              >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                     <path d="M7 2L19 14L14 15L17 22L13 23L10 16L4 16L7 2Z" fill="black" stroke="white" strokeWidth="2"/>
                  </svg>
              </motion.div>
           </motion.div>
        </div>
      )
    },
    {
      title: "Connect",
      description: "Click and drag from the LED's leg to a hole on the breadboard to create a wire connection.",
      animation: (
        <div className="relative w-full h-full bg-[#F0F4F8] flex items-center justify-center overflow-hidden">
            {/* Breadboard Holes */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-48 h-24 bg-white rounded border border-slate-300 grid grid-cols-10 grid-rows-5 gap-1 p-2 shadow-sm">
                {[...Array(50)].map((_, i) => (
                    <div key={i} className="bg-slate-200 rounded-full w-full h-full shadow-inner" />
                ))}
            </div>

            {/* LED Fixed Position */}
            <div className="absolute top-8 left-1/2 -translate-x-1/2 z-10">
                <svg width="40" height="60" viewBox="0 0 40 60" fill="none">
                    <path d="M12 35 L12 55" stroke="#94A3B8" strokeWidth="4" strokeLinecap="round"/>
                    <path d="M28 35 L28 45" stroke="#94A3B8" strokeWidth="4" strokeLinecap="round" id="right-leg-start"/>
                    <path d="M10 35 L30 35 L30 15 C30 5 10 5 10 15 Z" fill="#EF4444" stroke="#B91C1C" strokeWidth="2"/>
                </svg>
            </div>

            {/* Wire Animation */}
            <svg className="absolute inset-0 pointer-events-none z-20">
               <motion.path 
                 d="M 200 80 Q 200 120 220 140" /* Coordinates need to be relative to container */
                 /* This is tricky with responsive/relative SVG. Let's fake it with absolute positioning for the 'wire' line */
                 fill="none"
                 stroke="#22C55E"
                 strokeWidth="3"
                 initial={{ pathLength: 0 }}
                 animate={{ pathLength: 1 }}
                 transition={{ duration: 1, delay: 0.5, repeat: Infinity, repeatDelay: 2 }}
                 className="drop-shadow-sm"
               />
               <circle cx="200" cy="80" r="4" fill="#22C55E" /> {/* LED leg point (approx) */}
            </svg>
            
            {/* Cursor Animation */}
            <motion.div
               className="absolute z-30"
               initial={{ top: 80, left: 195, opacity: 0 }} /* Adjusted based on approx center 370px width */
               animate={{ 
                  top: [80, 140], 
                  left: [195, 220],
                  opacity: [1, 1, 0]
               }}
               transition={{ duration: 1, delay: 0.5, repeat: Infinity, repeatDelay: 2 }}
            >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M7 2L19 14L14 15L17 22L13 23L10 16L4 16L7 2Z" fill="black" stroke="white" strokeWidth="2"/>
                </svg>
            </motion.div>
        </div>
      )
    },
    {
      title: "Instructions",
      description: "Follow the step-by-step guide to build your circuit. Click the lightbulb icon to toggle.",
      animation: (
        <div className="relative w-full h-full bg-[#E2E8F0] flex flex-col overflow-hidden">
             {/* Fake Navbar */}
             <div className="h-8 bg-white border-b border-slate-200 w-full flex justify-end px-4 items-center gap-2">
                 <div className="w-20 h-3 bg-slate-100 rounded" />
                 <motion.div 
                   className="w-6 h-6 bg-yellow-100 rounded flex items-center justify-center text-yellow-600"
                   animate={{ scale: [1, 1.2, 1] }}
                   transition={{ repeat: Infinity, duration: 1.5 }}
                 >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                       <path d="M9 18h6" />
                       <path d="M10 22h4" />
                       <path d="M12 2v1" />
                       <path d="M12 14c-2.4 0-4.3-2-4.3-4.4 0-2.4 2-4.4 4.3-4.4s4.3 2 4.3 4.4c0 2.4-1.9 4.4-4.3 4.4z" />
                    </svg>
                 </motion.div>
             </div>

             {/* Fake Content & Panel */}
             <div className="flex-1 relative p-4">
                 <div className="w-1/2 h-20 bg-white rounded shadow-sm p-2 mb-2">
                    <div className="w-full h-2 bg-slate-100 mb-1" />
                    <div className="w-2/3 h-2 bg-slate-100" />
                 </div>
                 
                 {/* Expanding Panel Animation */}
                 <motion.div 
                    className="absolute top-0 right-0 bottom-0 bg-white border-l border-slate-200 shadow-lg p-3"
                    initial={{ width: 0 }}
                    animate={{ width: 140 }}
                    transition={{ duration: 1, repeat: Infinity, repeatDelay: 1, ease: "easeInOut" }}
                 >
                     <div className="w-full h-4 bg-slate-100 rounded mb-2" />
                     <div className="space-y-2">
                        {[1,2,3].map(i => (
                           <div key={i} className="flex gap-2">
                              <div className="w-4 h-4 rounded-full bg-slate-100 shrink-0" />
                              <div className="flex-1 h-12 bg-slate-50 rounded" />
                           </div>
                        ))}
                     </div>
                 </motion.div>
             </div>
        </div>
      )
    },
    {
        title: "Library",
        description: "Double-click any component in the library or workspace to see detailed usage instructions.",
        animation: (
          <div className="relative w-full h-full bg-[#F0F4F8] flex items-center justify-center">
             <div className="grid grid-cols-2 gap-4 w-3/4">
                {/* Component Card */}
                <motion.div 
                  className="bg-white p-2 rounded-lg shadow-sm border border-slate-200 flex flex-col items-center gap-2"
                  whileHover={{ scale: 1.05 }}
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                   <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
                      <span className="font-bold text-xs">UNO</span>
                   </div>
                   <div className="w-16 h-2 bg-slate-100 rounded" />
                </motion.div>
                
                {/* Documentation overlay appearing */}
                <motion.div 
                   className="absolute inset-0 bg-white/90 backdrop-blur-sm z-10 rounded-lg flex flex-col p-4 shadow-lg border border-slate-200"
                   initial={{ opacity: 0, scale: 0.9 }}
                   animate={{ opacity: [0, 1, 1, 0], scale: [0.9, 1, 1, 0.9] }}
                   transition={{ duration: 3, repeat: Infinity, times: [0, 0.2, 0.8, 1] }}
                >
                   <div className="flex items-center gap-2 mb-3 border-b pb-2">
                      <div className="w-6 h-6 bg-blue-500 rounded text-white flex items-center justify-center text-[10px]">?</div>
                      <div className="w-20 h-3 bg-slate-200 rounded" />
                   </div>
                   <div className="space-y-2">
                      <div className="w-full h-2 bg-slate-100 rounded" />
                      <div className="w-full h-2 bg-slate-100 rounded" />
                      <div className="w-2/3 h-2 bg-slate-100 rounded" />
                   </div>
                </motion.div>
             </div>
          </div>
        )
      },
      {
        title: "AI Co-create",
        description: "Chat with our AI assistant to help you build, debug, and understand your circuits.",
        animation: (
          <div className="relative w-full h-full flex flex-col bg-slate-50 rounded-lg overflow-hidden">
              <div className="flex-1 p-3 space-y-3 flex flex-col justify-end pb-4">
                  <motion.div 
                     initial={{ opacity: 0, y: 10, scale: 0.9 }}
                     animate={{ opacity: 1, y: 0, scale: 1 }}
                     transition={{ duration: 0.5 }}
                     className="self-end bg-[#1A2BC3] text-white p-2 rounded-2xl rounded-tr-sm text-[10px] max-w-[70%] shadow-sm"
                  >
                     How do I blink an LED?
                  </motion.div>
                  <motion.div 
                     initial={{ opacity: 0, y: 10, scale: 0.9 }}
                     animate={{ opacity: 1, y: 0, scale: 1 }}
                     transition={{ delay: 0.8, duration: 0.5 }}
                     className="self-start bg-white border border-slate-200 text-slate-700 p-2 rounded-2xl rounded-tl-sm text-[10px] max-w-[80%] shadow-sm flex gap-2 items-center"
                  >
                     <div className="w-4 h-4 bg-purple-100 rounded-full flex items-center justify-center shrink-0">
                        <span className="text-[8px]">✨</span>
                     </div>
                     Connect the LED to pin 13...
                  </motion.div>
              </div>
          </div>
        )
      }
  ];

  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      onComplete();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-[1px]">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative"
      >
        {/* Yellow Card Container */}
        <div className="bg-[#FFC85B] w-[370px] rounded-[20px] p-6 shadow-2xl relative overflow-hidden">
          
          {/* Header */}
          <h2 className="text-[20px] font-medium text-slate-900 mb-4">
            Welcome to Big Arduino
          </h2>

          {/* White Content/Animation Box */}
          <div className="bg-white rounded-xl h-[180px] w-full mb-6 overflow-hidden shadow-inner relative">
             <AnimatePresence mode="wait">
                <motion.div 
                  key={step}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="w-full h-full"
                >
                   {steps[step].animation}
                </motion.div>
             </AnimatePresence>
          </div>

          {/* Step Info */}
          <div className="space-y-2 mb-8 h-[80px]">
             <AnimatePresence mode="wait">
                 <motion.div
                   key={step}
                   initial={{ opacity: 0, x: 20 }}
                   animate={{ opacity: 1, x: 0 }}
                   exit={{ opacity: 0, x: -20 }}
                   transition={{ duration: 0.3 }}
                 >
                    <h3 className="text-[20px] font-medium text-slate-900">
                      {steps[step].title}
                    </h3>
                    <p className="text-[14px] text-slate-800 leading-normal mt-1">
                      {steps[step].description}
                    </p>
                 </motion.div>
             </AnimatePresence>
          </div>

          {/* Footer: Counter & Buttons */}
          <div className="flex items-center justify-between">
            <span className="text-[16px] text-slate-800 font-medium">
              {step + 1}/{steps.length}
            </span>
            
            <div className="flex gap-3">
              <button 
                onClick={onComplete}
                className="bg-[#4C4D52] hover:bg-slate-700 text-white text-[14px] font-semibold px-4 py-2 rounded-lg transition-colors"
              >
                Skip
              </button>
              <button 
                onClick={handleNext}
                className="bg-[#1A2BC3] hover:bg-blue-800 text-white text-[14px] font-semibold px-4 py-2 rounded-lg transition-colors shadow-lg shadow-blue-900/20"
              >
                {step === steps.length - 1 ? 'Get Started' : 'Next'}
              </button>
            </div>
          </div>

        </div>
      </motion.div>
    </div>
  );
}
