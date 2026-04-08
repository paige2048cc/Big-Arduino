import type { Project } from '../../types';
import { ledButtonProject } from './ledButton';
import { buzzerButtonProject } from './buzzerButton';

/** Shown on the home page “Featured Projects” row. Scope: Button-Powered LED only. */
export const homeFeaturedProjectIds: readonly string[] = ['led-button'];

// All preset projects (other IDs remain for deep links / future use)
export const presetProjects: Project[] = [
  ledButtonProject,
  buzzerButtonProject,
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

export function getHomeFeaturedProjects(): Project[] {
  return homeFeaturedProjectIds
    .map((id) => presetProjects.find((p) => p.id === id))
    .filter((p): p is Project => p != null);
}

export { ledButtonProject, buzzerButtonProject };
