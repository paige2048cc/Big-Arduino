import React from 'react';
import { ArrowLeft, BookOpen } from 'lucide-react';

// Import assets provided by the user
import imgArduinoDiagram from "figma:asset/6395b96188d8104e4a2d84b4e8613d438b88c3b7.png";

interface LibraryViewProps {
  componentId: string;
  onBack: () => void;
}

export function LibraryView({ componentId, onBack }: LibraryViewProps) {
  // Mock data for the library content - focusing on Arduino Uno R3 as requested
  const libraryData = {
    arduino: {
      title: "Arduino Uno R3",
      intro: "In this chapter, we will learn about the different components on the Arduino board. We will study the Arduino UNO board because it is the most popular board in the Arduino board family. In addition, it is the best board to get started with electronics and coding.",
      image: imgArduinoDiagram,
      points: [
        { id: 1, title: "Power USB", desc: "Arduino board can be powered by using the USB cable from your computer. All you need to do is connect the USB cable to the USB connection (1)." },
        { id: 2, title: "Power (Barrel Jack)", desc: "Arduino boards can be powered directly from the AC mains power supply by connecting it to the Barrel Jack (2)." },
        { id: 3, title: "Voltage Regulator", desc: "The function of the voltage regulator is to control the voltage given to the Arduino board and stabilize the DC voltages used by the processor and other elements." },
        { id: 4, title: "Crystal Oscillator", desc: "The crystal oscillator helps Arduino in dealing with time issues. How does Arduino calculate time? The answer is, by using the crystal oscillator. The number printed on top of the Arduino crystal is 16.000H9H. It tells us that the frequency is 16,000,000 Hertz or 16 MHz." },
        { id: 5, title: "Arduino Reset", desc: "You can reset your Arduino board, i.e., start your program from the beginning. You can reset the UNO board in two ways. First, by using the reset button (17) on the board. Second, you can connect an external reset button to the Arduino pin labelled RESET (5)." },
        { id: 6, title: "3.3V", desc: "Supply 3.3 output volt" },
        { id: 7, title: "5V", desc: "Supply 5 output volt" },
        { id: 8, title: "GND", desc: "Ground pins. There are several GND pins on the Arduino, any of which can be used to ground your circuit." },
        { id: 9, title: "Vin", desc: "This pin also can be used to power the Arduino board from an external power source, like AC mains power supply." },
        { id: 10, title: "Analog Pins", desc: "The Arduino UNO board has six analog input pins A0 through A5. These pins can read the signal from an analog sensor like the humidity sensor or temperature sensor and convert it into a digital value that can be read by the microprocessor." },
        { id: 11, title: "Main Microcontroller", desc: "Each Arduino board has its own microcontroller (11). You can assume it as the brain of your board. The main IC (integrated circuit) on the Arduino is slightly different from board to board. The microcontrollers are usually of the ATMEL Company." },
        { id: 12, title: "ICSP Pin", desc: "Mostly, ICSP (12) is an AVR, a tiny programming header for the Arduino consisting of MOSI, MISO, SCK, RESET, VCC, and GND. It is often referred to as an SPI (Serial Peripheral Interface)." },
        { id: 13, title: "Power LED Indicator", desc: "This LED should light up when you plug your Arduino into a power source to indicate that your board is powered up correctly. If this light does not turn on, then there is something wrong with the connection." },
        { id: 14, title: "TX and RX LEDs", desc: "On your board, you will find two labels: TX (transmit) and RX (receive). They appear in two places on the Arduino UNO board. First, at the digital pins 0 and 1, to indicate the pins responsible for serial communication. Second, the TX and RX led (13). The TX led flashes with different speed while sending the serial data." },
        { id: 15, title: "Digital I/O", desc: "The Arduino UNO board has 14 digital I/O pins (15) (of which 6 provide PWM output). These pins can be configured to work as input digital pins to read logic values (0 or 1) or as digital output pins to drive different modules like LEDs, relays, etc." },
        { id: 16, title: "AREF", desc: "AREF stands for Analog Reference. It is sometimes, used to set an external reference voltage (between 0 and 5 Volts) as the upper limit for the analog input pins." },
        { id: 17, title: "Reset Button", desc: "Used to reset the board (see point 5)." }
      ]
    }
  };

  // Fallback for other components not yet fully implemented
  const data = libraryData[componentId as keyof typeof libraryData] || {
    title: "Component Library",
    intro: "Select the Arduino Uno to see detailed documentation.",
    image: null,
    points: []
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center gap-3 shrink-0">
         <button 
           onClick={onBack}
           className="p-2 hover:bg-slate-100 rounded-full mr-2 text-slate-500 hover:text-slate-800 transition-colors"
           title="Back to Workspace"
         >
            <ArrowLeft size={20} />
         </button>
         <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
            <BookOpen size={24} />
         </div>
         <div>
            <h2 className="text-xl font-bold text-slate-800">{data.title}</h2>
            <p className="text-sm text-slate-500">Component Documentation</p>
         </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8">
         <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            
            {/* Intro Section */}
            <div className="p-8 border-b border-slate-100">
               <p className="text-slate-700 leading-relaxed text-lg">
                  {data.intro}
               </p>
            </div>

            {/* Diagram Section */}
            {data.image && (
              <div className="p-8 bg-slate-50 flex justify-center border-b border-slate-100">
                 <img 
                   src={data.image} 
                   alt="Component Diagram" 
                   className="max-w-full h-auto shadow-lg rounded-lg border border-slate-200" 
                 />
              </div>
            )}

            {/* Points List */}
            <div className="divide-y divide-slate-100">
               {data.points.map((point) => (
                  <div key={point.id} className="p-6 flex gap-6 hover:bg-slate-50 transition-colors">
                      {/* Number Badge */}
                      <div className="shrink-0">
                         <div className="w-10 h-10 rounded-full bg-[#CD0404] text-white flex items-center justify-center font-bold text-lg shadow-sm ring-4 ring-red-50">
                            {point.id}
                         </div>
                      </div>
                      
                      {/* Text Content */}
                      <div className="space-y-1">
                         <h3 className="font-bold text-slate-900 text-lg">{point.title}</h3>
                         <p className="text-slate-600 leading-relaxed">
                            {point.desc}
                         </p>
                      </div>
                  </div>
               ))}
            </div>

            {!data.image && (
               <div className="p-12 text-center text-slate-400">
                  <p>Detailed documentation for this component is coming soon.</p>
               </div>
            )}
         </div>
      </div>
    </div>
  );
}
