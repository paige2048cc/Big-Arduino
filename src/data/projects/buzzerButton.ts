import type { Project } from '../../types';

export const buzzerButtonProject: Project = {
  id: 'buzzer-button',
  title: 'Press to Buzz!',
  description: 'Build a simple interactive circuit where pressing a button triggers a buzzer.',
  difficulty: 'beginner',
  image: '/projects/buzzer-button.png',
  estimatedTime: '10-15 min',
  components: [
    { name: 'Arduino Uno', quantity: 1 },
    { name: 'Piezo Buzzer', quantity: 1 },
    { name: '100\u03A9 Resistor', quantity: 1 },
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
        'Buzzer',
        'Button',
        '100\u03A9 Resistor',
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
      title: 'Place the Buzzer',
      description: 'Insert the buzzer onto the breadboard.',
      instructions: [
        'The anode leg (+) goes into one row',
        'The cathode leg (-) goes into a different row',
      ],
    },
    {
      id: 4,
      title: 'Add the Resistor',
      description: 'Now insert the 100\u03A9 resistor into breadboard. The resistor helps limit the electrical flow to keep the Arduino safe.',
      instructions: [
        'Place one leg of the resistor in the same row as the buzzer\'s anode (+)',
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
        'Ensure the resistor connects to the buzzer\'s anode (+)',
        'Connect the buzzer\'s cathode (\u2013) to the blue ground rail (\u2013)',
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
        'You should hear a soft buzzing sound',
      ],
      tips: [
        'That sound is normal! Because there is no code controlling the tone, the buzzer is simply receiving raw electrical signals instead of playing a defined note.',
      ],
    },
  ],
  arduinoCode: '// No code needed for this project - the Arduino is used only for power!',
};
