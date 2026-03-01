import { presetProjects } from '../data/projects';
import type { Project } from '../types';

export interface DetectedComponent {
  className: string;
  probability: number;
}

export interface ProjectMatch {
  project: Project;
  matchedComponents: string[];
  matchPercent: number;
}

const TM_TO_PROJECT_NAME: Record<string, string[]> = {
  'Breadboard':                       ['Breadboard'],
  'LED':                              ['LED', 'RGB LED'],
  'Button':                           ['Push Button'],
  'Buzzer':                           ['Buzzer'],
  '4 Digit 7 Segment LED Display':    ['7-Segment Display', '4 Digit 7 Segment LED Display'],
  'Joystick Module':                  ['Joystick', 'Joystick Module'],
  'Ultrasonic Distance Sensor':       ['Ultrasonic Distance Sensor', 'Ultrasonic Sensor'],
  'Vibration Motor':                  ['Vibration Motor'],
  'Hall sensor':                      ['Hall Sensor', 'Hall sensor'],
};

function normalise(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function matchProjects(detected: DetectedComponent[], threshold = 0.5): ProjectMatch[] {
  const confirmedNames = detected
    .filter(d => d.probability >= threshold)
    .map(d => d.className);

  if (confirmedNames.length === 0) return [];

  const normalisedDetected = new Set<string>();
  for (const name of confirmedNames) {
    const aliases = TM_TO_PROJECT_NAME[name] ?? [name];
    for (const alias of aliases) {
      normalisedDetected.add(normalise(alias));
    }
  }

  const results: ProjectMatch[] = [];

  for (const project of presetProjects) {
    const matched: string[] = [];
    for (const comp of project.components) {
      if (normalisedDetected.has(normalise(comp.name))) {
        matched.push(comp.name);
      }
    }
    if (matched.length > 0) {
      results.push({
        project,
        matchedComponents: matched,
        matchPercent: Math.round((matched.length / project.components.length) * 100),
      });
    }
  }

  results.sort((a, b) => b.matchPercent - a.matchPercent);
  return results;
}

export function getChipClass(className: string): string {
  const key = normalise(className);
  if (key.includes('led')) return 'chip--led';
  if (key.includes('breadboard')) return 'chip--breadboard';
  if (key.includes('button')) return 'chip--button';
  if (key.includes('buzzer')) return 'chip--buzzer';
  if (key.includes('joystick')) return 'chip--joystick';
  if (key.includes('sensor') || key.includes('ultrasonic')) return 'chip--sensor';
  if (key.includes('motor') || key.includes('vibration')) return 'chip--motor';
  if (key.includes('hall')) return 'chip--sensor';
  return 'chip--default';
}
