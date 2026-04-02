/**
 * useBuzzerAudio Hook
 *
 * Watches buzzer component states during simulation and controls
 * audio playback accordingly:
 *
 * - Buzzer ON  → start looping audio
 * - Buzzer OFF → stop audio
 * - Simulation stops → stop all audio
 */

import { useEffect, useRef } from 'react';
import { useCircuitStore } from '../store/circuitStore';
import { buzzerAudioService } from '../services/buzzerAudioService';

export function useBuzzerAudio(): void {
  const isSimulating = useCircuitStore((s) => s.isSimulating);
  const placedComponents = useCircuitStore((s) => s.placedComponents);
  const componentDefinitions = useCircuitStore((s) => s.componentDefinitions);

  const prevBuzzerStatesRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    if (!isSimulating) {
      buzzerAudioService.stopAll();
      prevBuzzerStatesRef.current.clear();
      return;
    }

    const currentBuzzerStates = new Map<string, string>();

    for (const comp of placedComponents) {
      const def = componentDefinitions.get(comp.instanceId);
      if (!def || !def.id.toLowerCase().includes('buzzer')) continue;

      currentBuzzerStates.set(comp.instanceId, comp.state);

      if (comp.state === 'on') {
        buzzerAudioService.play(comp.instanceId);
      } else {
        buzzerAudioService.stop(comp.instanceId);
      }
    }

    // Stop audio for buzzers that were removed from the circuit
    for (const [prevId] of prevBuzzerStatesRef.current) {
      if (!currentBuzzerStates.has(prevId)) {
        buzzerAudioService.stop(prevId);
      }
    }

    prevBuzzerStatesRef.current = currentBuzzerStates;
  }, [isSimulating, placedComponents, componentDefinitions]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      buzzerAudioService.dispose();
    };
  }, []);
}
