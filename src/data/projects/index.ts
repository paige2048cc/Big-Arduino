import type { Project } from '../../types';
import { ledButtonProject } from './ledButton';

// All preset projects
export const presetProjects: Project[] = [
  ledButtonProject,
  // Placeholder projects for MVP - will be implemented later
  {
    id: 'traffic-light',
    title: 'Traffic Light System',
    description: 'Build a realistic traffic light with timed sequences. Learn about timing and state machines.',
    difficulty: 'intermediate',
    image: '/projects/traffic-light.png',
    estimatedTime: '30-40 min',
    components: [
      { name: 'Arduino Uno', quantity: 1 },
      { name: 'Red LED', quantity: 1 },
      { name: 'Yellow LED', quantity: 1 },
      { name: 'Green LED', quantity: 1 },
      { name: '220Ω Resistor', quantity: 3 },
      { name: 'Breadboard', quantity: 1 },
      { name: 'Jumper Wires', quantity: 6 },
    ],
    steps: [],
    arduinoCode: '// Coming soon',
  },
  {
    id: 'plant-monitor',
    title: 'Smart Plant Monitor',
    description: 'Monitor soil moisture and get alerts when your plant needs water. IoT basics!',
    difficulty: 'advanced',
    image: '/projects/plant-monitor.png',
    estimatedTime: '45-60 min',
    components: [
      { name: 'Arduino Uno', quantity: 1 },
      { name: 'Soil Moisture Sensor', quantity: 1 },
      { name: 'RGB LED', quantity: 1 },
      { name: 'Buzzer', quantity: 1 },
      { name: '220Ω Resistor', quantity: 3 },
      { name: 'Breadboard', quantity: 1 },
      { name: 'Jumper Wires', quantity: 8 },
    ],
    steps: [],
    arduinoCode: '// Coming soon',
  },
];

export { ledButtonProject };
