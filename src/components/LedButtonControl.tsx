import React, { useState, useRef, useEffect, useCallback } from 'react';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { 
  ArrowLeft, Search, ChevronDown, HelpCircle, 
  Code, Play, 
  Copy, Clipboard, Trash2, RotateCw, Undo, Redo, 
  Type, MessageSquare, 
  Send, Sparkles, User, Bot, Circle, Minus,
  MoreHorizontal, GripVertical, Plus, MousePointer2, ArrowUp, BookOpen, X
} from 'lucide-react';
import { motion } from 'motion/react';

import { InstructionPanel } from './InstructionPanel';
import { TutorialOverlay } from './TutorialOverlay';
import { LibraryView } from './LibraryView';

// Imports from Desktop12/13
import imgResistor from "figma:asset/cb73e3a73a073112ba81bf775053faf071e1319d.png";
import imgLed from "figma:asset/3f9ca6dbcc0f11483e9e066d59b2dcd60ce576b5.png";
import imgArduino from "figma:asset/30c9e9abf26a16b527690af5849a32dd74d4a777.png";
import imgMicrobit from "figma:asset/718c8d9713f4f9a4afa7bafdf9977d6d1445e820.png";
import imgPushbutton from "figma:asset/9d0e18220dc92c3e144303b03648e2ba3e5e04e6.png";
import imgCapacitor1 from "figma:asset/c00ebf3147922f0584c01e5dd9303e938e97fee4.png";
import imgCapacitor2 from "figma:asset/2eaf117ce543f6acfc6ab775e1acf86f57da698e.png";
import imgSlideswitch from "figma:asset/282f065fd5de23b6c67c8dc6caa8f4c3748ecb86.png";
import img9vBattery from "figma:asset/22da7c32e5140febae221148b6cb46d14526c726.png";
import imgCoinCell from "figma:asset/19754ae50452015c0b99f5d9fa088a08059467a5.png";
import img15vBattery from "figma:asset/f36791488aaccd961708081d45941c8a119a2059.png";
import imgBreadboard from "figma:asset/c2855cee87af2beb4bd5c1097b882a1609ee2a7c.png";
import imgMainCanvas from "figma:asset/d115998c36acff6df9161f43e4b094b24f3163d8.png";

interface DraggableSidebarItemProps {
  id: string;
  name: string;
  img: string;
  isCollapsed: boolean;
  isHighlighted?: boolean;
  onLibraryClick: (e: React.MouseEvent) => void;
}

const DraggableSidebarItem = ({ id, name, img, isCollapsed, isHighlighted, onLibraryClick }: DraggableSidebarItemProps) => {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'component',
    item: { id, type: 'component', name, img },
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging(),
    }),
  }));

  return (
    <div 
      ref={drag}
      className={`
        rounded-xl shadow-sm border p-2 flex flex-col items-center justify-center gap-2 cursor-grab hover:shadow-md transition-all group relative 
        ${isDragging ? 'opacity-50' : ''}
        ${isCollapsed ? 'aspect-square' : 'h-28 w-full'} 
        ${isHighlighted 
           ? 'bg-[#FFF7D6] border-[#FCD34D] shadow-md scale-105 z-10' 
           : 'bg-white border-slate-100 hover:border-blue-200'
        }
      `}
    >
        <img src={img} alt={name} className="w-10 h-10 object-contain" />
        {!isCollapsed && (
          <span className="text-[11px] font-medium text-slate-600 text-center leading-tight line-clamp-2">{name}</span>
        )}
        <button 
           onClick={onLibraryClick}
           className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-blue-600 transition-all flex items-center gap-1 bg-white/80 backdrop-blur-sm rounded-full pl-2 pr-1 py-0.5 shadow-sm hover:shadow-md -mr-1 hover:mr-0"
        >
            <span className="text-[10px] font-bold hidden group-hover:inline-block">Library</span>
            <HelpCircle size={14} />
        </button>
    </div>
  );
};


interface LedButtonControlProps {
  onBack: () => void;
}

interface CanvasComponent {
  id: string;
  componentId: string;
  name: string;
  img: string;
  x: number;
  y: number;
}

export function LedButtonControl(props: LedButtonControlProps) {
  return (
    <DndProvider backend={HTML5Backend}>
      <LedButtonControlContent {...props} />
    </DndProvider>
  );
}

function LedButtonControlContent({ onBack }: LedButtonControlProps) {
  const [showTutorial, setShowTutorial] = useState(true);
  const [chatMessage, setChatMessage] = useState('');
  
  // Instruction State
  const [currentStep, setCurrentStep] = useState(1);

  // Library State
  const [viewMode, setViewMode] = useState<'workspace' | 'library'>('workspace');
  const [selectedLibraryComponent, setSelectedLibraryComponent] = useState<string | null>(null);

  // Workspace State
  const [canvasComponents, setCanvasComponents] = useState<CanvasComponent[]>([]);

  // Resizable Sidebar State
  const [sidebarWidth, setSidebarWidth] = useState(300);
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  const startResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
  }, []);

  const resize = useCallback(
    (mouseMoveEvent: MouseEvent) => {
      if (isResizing) {
        const newWidth = Math.max(80, Math.min(500, mouseMoveEvent.clientX));
        setSidebarWidth(newWidth);
      }
    },
    [isResizing]
  );

  useEffect(() => {
    window.addEventListener("mousemove", resize);
    window.addEventListener("mouseup", stopResizing);
    return () => {
      window.removeEventListener("mousemove", resize);
      window.removeEventListener("mouseup", stopResizing);
    };
  }, [resize, stopResizing]);

  const [, drop] = useDrop(() => ({
    accept: 'component',
    drop: (item: { id: string; name: string; img: string }, monitor) => {
      const offset = monitor.getClientOffset();
      const newId = `${item.id}-${Date.now()}`;
      
      // Calculate position relative to container is tricky without ref, 
      // but assuming standard full screen minus sidebar:
      const x = offset ? offset.x - sidebarWidth : 100;
      const y = offset ? offset.y : 100;

      setCanvasComponents((prev) => [
        ...prev, 
        { 
          id: newId, 
          componentId: item.id,
          name: item.name, 
          img: item.img, 
          x: Math.max(0, x),
          y: Math.max(0, y)
        }
      ]);
    },
  }));

  const isCollapsed = sidebarWidth < 200;
  
  const componentList = [
    { id: 'resistor', name: 'Resistor', img: imgResistor },
    { id: 'led', name: 'LED', img: imgLed },
    { id: 'pushbutton', name: 'Pushbutton', img: imgPushbutton },
    { id: 'cap1', name: 'Capacitor', img: imgCapacitor1 },
    { id: 'cap2', name: 'Capacitor', img: imgCapacitor2 },
    { id: 'switch', name: 'Slideswitch', img: imgSlideswitch },
    { id: '9v', name: '9V Battery', img: img9vBattery },
    { id: 'coincell', name: 'Coin Cell 3V Battery', img: imgCoinCell },
    { id: '1.5v', name: '1.5V Battery', img: img15vBattery },
    { id: 'breadboard', name: 'Breadboard', img: imgBreadboard },
    { id: 'arduino', name: 'Arduino Uno R3', img: imgArduino },
    { id: 'microbit', name: 'micro:bit', img: imgMicrobit },
  ];

  const chatHistory = [
    { role: 'ai', text: 'Hi there! I can help you with your circuit. What are you building today?' },
    { role: 'user', text: 'I want to control an LED with a button.' },
    { role: 'ai', text: 'Great! You\'ll need an LED, a resistor (220Ω), a pushbutton, and your Arduino. Connect the LED anode to pin 13 and the button to pin 2.' },
  ];

  // Logic to determine which components to highlight in Sidebar
  // Step 1: Breadboard, Uno, Resistor, LED
  const highlightIds = currentStep === 1 ? ['breadboard', 'arduino', 'resistor', 'led'] : [];

  return (
    <div className="flex h-screen bg-[#F4F5F6] overflow-hidden text-slate-900 font-sans select-none">
      
      {/* Left Sidebar */}
      <aside 
        ref={sidebarRef}
        style={{ width: sidebarWidth }}
        className="bg-white border-r border-slate-200 flex flex-col shrink-0 z-20 relative group/sidebar"
      >
        <div className={`p-4 flex items-center gap-3 ${isCollapsed ? 'justify-center' : ''}`}>
             <button onClick={onBack} className="text-slate-500 hover:text-blue-800 transition-colors shrink-0">
                 <ArrowLeft size={24} />
             </button>
             {!isCollapsed && (
               <h1 className="text-xl font-bold text-[#1A2BC3] truncate">LED Button Control</h1>
             )}
        </div>

        <div className="px-4 mb-4 flex gap-2">
             <button className="flex-1 bg-[#1A2BC3] text-white px-0 py-2.5 rounded-lg shadow-sm flex items-center justify-center gap-2 font-semibold text-sm hover:bg-blue-800 transition-colors">
                 <Code size={18} className="shrink-0" />
                 {!isCollapsed && <span>Code</span>}
             </button>
             <button 
                onClick={() => {
                    setViewMode('library');
                    setSelectedLibraryComponent('arduino');
                }}
                className={`flex-1 bg-white text-slate-700 border border-slate-200 px-0 py-2.5 rounded-lg shadow-sm flex items-center justify-center gap-2 font-semibold text-sm hover:bg-slate-50 hover:border-blue-300 transition-colors ${viewMode === 'library' ? 'ring-2 ring-blue-100 border-blue-400' : ''}`} 
             >
                 <BookOpen size={18} className="shrink-0" />
                 {!isCollapsed && <span>Library</span>}
             </button>
        </div>

        <div className="px-4 mb-4">
             <div className={`bg-white rounded-lg border border-slate-200 shadow-sm flex items-center py-3 hover:border-blue-300 transition-colors focus-within:ring-2 focus-within:ring-blue-100 ${isCollapsed ? 'justify-center px-0' : 'px-3'}`}>
                 <Search size={18} className={`text-slate-400 ${isCollapsed ? '' : 'mr-3'} shrink-0`} />
                 {!isCollapsed && (
                   <input 
                      type="text" 
                      placeholder="Search components" 
                      className="flex-1 bg-transparent border-none outline-none text-base text-slate-700 placeholder:text-slate-400 w-full min-w-0"
                   />
                 )}
             </div>
        </div>

        {!isCollapsed && (
          <div className="px-4 flex items-center justify-between mb-2">
               <h2 className="text-base text-slate-500 font-medium truncate">Components</h2>
               <button className="flex items-center gap-1 text-[#1A2BC3] font-semibold text-sm hover:underline shrink-0">
                   Basic <ChevronDown size={16} />
               </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-4 pb-4 overflow-x-hidden">
             <div className={`grid gap-3 ${isCollapsed ? 'grid-cols-1' : 'grid-cols-3'}`}>
                 {componentList.map((comp) => (
                    <DraggableSidebarItem
                      key={comp.id}
                      id={comp.id}
                      name={comp.name}
                      img={comp.img}
                      isCollapsed={isCollapsed}
                      isHighlighted={highlightIds.includes(comp.id)}
                      onLibraryClick={(e) => {
                          e.stopPropagation();
                          setViewMode('library');
                          setSelectedLibraryComponent(comp.id);
                      }}
                    />
                 ))}
             </div>
        </div>

        <div 
          className="absolute top-0 right-0 w-1 h-full cursor-ew-resize hover:bg-blue-400 transition-colors z-50 flex items-center justify-center opacity-0 hover:opacity-100 active:opacity-100 active:bg-blue-600"
          onMouseDown={startResizing}
        >
        </div>
      </aside>

      {/* Main Workspace */}
      <main className="flex-1 relative bg-[#F4F5F6] overflow-hidden flex flex-col">
        
        {viewMode === 'library' && selectedLibraryComponent ? (
           <LibraryView 
              componentId={selectedLibraryComponent} 
              onBack={() => {
                  setViewMode('workspace');
                  setSelectedLibraryComponent(null);
              }} 
           />
        ) : (
           <>
            <div 
               ref={drop}
               className="flex-1 relative flex items-center justify-center p-8 bg-[#F4F5F6] overflow-hidden"
            >
               {/* Guides Layer - Using absolute SVG overlay */}
               <svg className="absolute inset-0 w-full h-full pointer-events-none z-10 overflow-visible">
                  <defs>
                     <filter id="glow">
                        <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
                        <feMerge>
                           <feMergeNode in="coloredBlur"/>
                           <feMergeNode in="SourceGraphic"/>
                        </feMerge>
                     </filter>
                  </defs>

                  {/* Step 2: 5V/GND Lines */}
                  {currentStep === 2 && (
                    <>
                      {/* Red 5V Wire Guide */}
                      <motion.path
                        d="M 500 550 C 500 500 200 500 200 350" // Adjusted simplified coordinates based on assumed center layout
                        fill="none"
                        stroke="#EF4444"
                        strokeWidth="2"
                        strokeDasharray="10 10"
                        animate={{ strokeDashoffset: [0, -20] }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="drop-shadow-sm"
                        filter="url(#glow)"
                      />
                      {/* Black GND Wire Guide */}
                      <motion.path
                        d="M 520 550 C 520 520 220 520 220 350"
                        fill="none"
                        stroke="#1F2937"
                        strokeWidth="2"
                        strokeDasharray="10 10"
                        animate={{ strokeDashoffset: [0, -20] }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="drop-shadow-sm"
                        filter="url(#glow)"
                      />
                    </>
                  )}

                  {/* Step 3: LED Placement Highlights */}
                  {currentStep === 3 && (
                    <>
                       <motion.rect 
                         x="300" y="200" width="100" height="20" rx="4"
                         fill="none" stroke="#EAB308" strokeWidth="2"
                         strokeDasharray="5 5"
                         animate={{ opacity: [0.5, 1, 0.5] }}
                         transition={{ duration: 2, repeat: Infinity }}
                       />
                       <motion.rect 
                         x="300" y="230" width="100" height="20" rx="4"
                         fill="none" stroke="#EAB308" strokeWidth="2"
                         strokeDasharray="5 5"
                         animate={{ opacity: [0.5, 1, 0.5] }}
                         transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
                       />
                    </>
                  )}

                  {/* Step 4 & 5: Component Connections */}
                  {(currentStep === 4 || currentStep === 5) && (
                     <>
                        <motion.path
                           d="M 350 220 C 350 300 550 400 550 500" // LED to Pin 13 approx
                           fill="none"
                           stroke="#22C55E"
                           strokeWidth="2"
                           strokeDasharray="10 10"
                           animate={{ strokeDashoffset: [0, -20] }}
                           transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                           filter="url(#glow)"
                        />
                     </>
                  )}
                  
                  {/* Step 6: USB Upload */}
                  {currentStep === 6 && (
                     <motion.circle 
                        cx="350" cy="550" r="30" // Approx USB port location on Uno image
                        fill="none" stroke="#3B82F6" strokeWidth="3"
                        animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                        transition={{ duration: 2, repeat: Infinity }}
                     />
                  )}
               </svg>

               {canvasComponents.length === 0 && (
                   <div className="text-slate-400 text-sm pointer-events-none select-none">
                       Drag components here to build your circuit
                   </div>
               )}
               
               {canvasComponents.map((comp) => (
                   <div 
                      key={comp.id}
                      className="absolute cursor-grab active:cursor-grabbing hover:ring-2 ring-blue-400 rounded-lg p-1 z-20"
                      style={{ 
                          left: comp.x, 
                          top: comp.y,
                          transform: 'translate(-50%, -50%)' 
                      }}
                   >
                       <img 
                          src={comp.img} 
                          alt={comp.name} 
                          className={`
                            ${comp.componentId === 'breadboard' ? 'w-[600px]' : ''}
                            ${comp.componentId === 'arduino' ? 'w-[300px]' : ''}
                            ${comp.componentId !== 'breadboard' && comp.componentId !== 'arduino' ? 'w-16' : ''}
                            object-contain drop-shadow-lg
                          `} 
                          style={{ pointerEvents: 'none' }} 
                       />
                   </div>
               ))}
            
            {/* Instruction Panel */}
            <InstructionPanel 
              currentStep={currentStep}
              onStepChange={setCurrentStep}
            />
        </div>

        {/* Floating Bottom Toolbar */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-[#CEDBE4] px-4 py-2 rounded-xl shadow-xl flex items-center gap-4 z-30 border border-white/20">
            <div className="flex items-center gap-3">
                <button className="text-slate-700 hover:text-blue-700 transition-colors p-1" title="Copy">
                    <Copy size={20} strokeWidth={2} />
                </button>
                <button className="text-slate-700 hover:text-blue-700 transition-colors p-1" title="Paste">
                    <Clipboard size={20} strokeWidth={2} />
                </button>
            </div>

            <div className="w-px h-6 bg-slate-400/40"></div>

            <div className="flex items-center gap-3">
                <button className="bg-[#E8F1F8] p-1.5 rounded-lg group hover:bg-red-50 transition-colors" title="Delete">
                    <div className="bg-[#CD0404] w-6 h-6 rounded flex items-center justify-center">
                         <Trash2 size={14} className="text-white" strokeWidth={2.5} />
                    </div>
                </button>
                <button className="text-slate-700 hover:text-blue-700 transition-colors p-1" title="Rotate">
                    <RotateCw size={20} strokeWidth={2} />
                </button>
                <div className="flex gap-1">
                    <button className="text-slate-700 hover:text-blue-700 transition-colors p-1" title="Undo">
                        <Undo size={20} strokeWidth={2} />
                    </button>
                    <button className="text-slate-700 hover:text-blue-700 transition-colors p-1" title="Redo">
                        <Redo size={20} strokeWidth={2} />
                    </button>
                </div>
            </div>

             <div className="w-px h-6 bg-slate-400/40"></div>

            <div className="flex items-center gap-4">
                <button className="w-6 h-6 rounded-full bg-[#CD0404] border-2 border-white shadow-sm ring-1 ring-slate-300 hover:scale-110 transition-transform"></button>
                
                <button className="bg-white rounded-lg px-2 py-1 flex items-center gap-1 shadow-sm border border-slate-200">
                    <div className="w-6 h-0.5 bg-[#CD0404] rounded-full"></div>
                    <ChevronDown size={12} className="text-slate-400" />
                </button>

                <button className="text-slate-700 hover:text-blue-700 transition-colors p-1" title="Text">
                    <Type size={20} strokeWidth={2} />
                </button>
                 <button className="text-slate-700 hover:text-blue-700 transition-colors p-1" title="Comment">
                    <MessageSquare size={20} strokeWidth={2} />
                </button>
            </div>
        </div>
           </>
        )}
      </main>

      {/* Right Sidebar: AI Assistant */}
      <aside className="w-[320px] bg-white border-l border-slate-200 flex flex-col shrink-0 z-20">
         <div className="p-4 border-b border-slate-100 flex flex-col gap-4 bg-slate-50/50">
             <button className="w-full bg-[#1A2BC3] text-white px-4 py-2.5 rounded-lg shadow-sm flex items-center justify-center gap-2 font-semibold text-sm hover:bg-blue-800 transition-colors">
                 <Play size={18} fill="currentColor" />
                 Start Simulation
             </button>
         </div>

         <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-[#FAFAFA]">
             {chatHistory.map((msg, idx) => (
                 <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                     <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border border-slate-200 ${msg.role === 'ai' ? 'bg-blue-50 text-blue-600' : 'bg-slate-200 text-slate-600'}`}>
                         {msg.role === 'ai' ? <Bot size={18} /> : <User size={18} />}
                     </div>
                     <div className={`p-4 rounded-2xl text-sm leading-relaxed shadow-sm max-w-[85%] ${
                         msg.role === 'ai' 
                            ? 'bg-white border border-slate-100 text-slate-700 rounded-tl-none' 
                            : 'bg-[#186BF9] text-white rounded-tr-none'
                     }`}>
                         {msg.text}
                     </div>
                 </div>
             ))}
         </div>

         <div className="p-4 border-t border-slate-100 bg-white">
             <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col gap-2 focus-within:ring-2 focus-within:ring-blue-100 focus-within:border-blue-300 transition-all shadow-sm">
                 <div className="flex items-center gap-2">
                     <div className="bg-slate-200/80 text-slate-600 text-[11px] font-medium px-1.5 py-0.5 rounded flex items-center gap-1">
                         <span className="text-slate-400">#</span> div <button className="hover:text-slate-900"><X size={10} /></button>
                     </div>
                 </div>

                 <textarea 
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    placeholder="Ask for changes..." 
                    className="w-full bg-transparent border-none outline-none text-sm text-slate-700 placeholder:text-slate-400 resize-none h-[48px] py-1"
                 />
                 
                 <div className="flex items-center justify-between pt-1">
                     <div className="flex items-center gap-1">
                         <button className="text-slate-400 hover:text-blue-600 transition-colors p-1.5 hover:bg-slate-200 rounded-lg" title="Add content">
                             <Plus size={18} />
                         </button>
                         <button className="text-slate-400 hover:text-blue-600 transition-colors p-1.5 hover:bg-slate-200 rounded-lg" title="Library">
                             <BookOpen size={18} />
                         </button>
                         <button className="bg-[#7C3AED] text-white p-1.5 rounded-lg hover:bg-[#6D28D9] transition-colors shadow-sm" title="Point to edit">
                             <MousePointer2 size={16} />
                         </button>
                     </div>
                     <button className="w-8 h-8 bg-[#186BF9] text-white rounded-full hover:bg-blue-700 transition-colors shadow-sm flex items-center justify-center">
                         <ArrowUp size={18} strokeWidth={2.5} />
                     </button>
                 </div>
             </div>

             <div className="flex items-center justify-between mt-2 px-1">
                 <p className="text-[10px] text-slate-300">
                     AI can make mistakes. Verify component values.
                 </p>
                 <button className="w-5 h-5 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center text-[10px] font-bold hover:bg-slate-200">
                     ?
                 </button>
             </div>
         </div>
      </aside>

      {/* Tutorial Overlay */}
      {showTutorial && <TutorialOverlay onComplete={() => setShowTutorial(false)} />}

    </div>
  );
}
