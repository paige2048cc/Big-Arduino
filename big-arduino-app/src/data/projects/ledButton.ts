import type { Project } from '../../types';

export const ledButtonProject: Project = {
  id: 'led-button',
  title: 'Button-Powered LED',
  description: 'Build your first circuit — press a button to light up an LED. No coding required, just drag, wire, and simulate!',
  difficulty: 'beginner',
  image: '/projects/led-button.png',
  estimatedTime: '10-15 min',
  components: [
    { name: 'Arduino Uno', quantity: 1 },
    { name: 'LED (any color)', quantity: 1 },
    { name: '220Ω Resistor', quantity: 1 },
    { name: 'Push Button', quantity: 1 },
    { name: 'Breadboard', quantity: 1 },
    { name: 'Jumper Wires', quantity: 4 },
  ],
  steps: [
    {
      id: 1,
      title: 'Prepare Your Components',
      description: 'Let\'s start! Drag the following components into your workspace.',
      instructions: [
        'Arduino Uno',
        'Breadboard',
        'LED',
        'Button',
        '220\u03A9 Resistor',
      ],
    },
    {
      id: 2,
      title: 'Power the Breadboard',
      description: 'Connect the Arduino to the breadboard so it can supply power.',
      instructions: [
        'Connect a wire from the 5V pin on the Arduino to the red power rail (+) on the breadboard',
        'Connect another wire from GND on the Arduino to the blue ground rail (-) on the breadboard',
      ],
    },
    {
      id: 3,
      title: 'Place the LED',
      description: 'Insert the LED onto the breadboard.',
      instructions: [
        'The long leg (anode, +) goes into one row',
        'The short leg (cathode, -) goes into a different row',
      ],
    },
    {
      id: 4,
      title: 'Add the Resistor',
      description: 'Now insert the 220\u03A9 resistor into breadboard. The resistor helps protect your LED from too much current. Without a resistor, the LED could be damaged.',
      instructions: [
        'Rotate and then place one leg of the resistor in the same row as the LED\'s long leg (anode, +)',
      ],
      tips: [
        'If two legs share the same row, they are already connected. No extra wire is needed.',
      ],
    },
    {
      id: 5,
      title: 'Place the Button',
      description: 'Position the push button on the breadboard.',
      instructions: [
        'Place the button on to the breadboard and make sure insert one leg into the same row as the other leg of resistor',
      ],
      tips: [
        'It\'s best to place the button across the center gap of the breadboard so the two sides are separated correctly.',
      ],
    },
    {
      id: 6,
      title: 'Connect the Button to Power',
      description: 'Now connect the button so it can control the flow of electricity.',
      instructions: [
        'Connect one side of the button to the red power rail (+)',
      ],
    },
    {
      id: 7,
      title: 'Complete the Circuit',
      description: 'Finish the path so electricity can return to ground.',
      instructions: [
        'Connect the other side of the button to the resistor (if not already connected)',
        'Ensure the resistor connects to the LED\'s long leg (anode, +)',
        'Connect the LED\'s short leg (cathode, -) to the blue ground rail (-)',
      ],
      tips: [
        'If components share the same row, they are already connected. No wire needed.',
      ],
    },
    {
      id: 8,
      title: 'Time to Test!',
      description: 'Your circuit is complete. Let\'s see it in action!',
      instructions: [
        'Click "Start Simulation" in the top bar',
        'Now press the button',
        'You should see the LED light up!',
      ],
      tips: [
        'Release the button and the LED turns off. That\'s your first working circuit!',
      ],
    },
  ],
  arduinoCode: '// No code needed for this project - the Arduino is used only for power!',
};
