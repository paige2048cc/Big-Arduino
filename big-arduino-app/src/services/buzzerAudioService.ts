/**
 * Buzzer Audio Service
 *
 * Manages audio playback for buzzer components during simulation.
 * Supports looping playback that starts/stops based on buzzer state.
 */

const BUZZER_AUDIO_PATH = '/audio/buzzer_audio.MP3';

class BuzzerAudioService {
  private audioElements: Map<string, HTMLAudioElement> = new Map();
  private isInitialized = false;

  /**
   * Pre-load the audio file so playback is instant when needed.
   * Call once on first user interaction to satisfy autoplay policies.
   */
  initialize(): void {
    if (this.isInitialized) return;
    this.isInitialized = true;
  }

  private getOrCreateAudio(buzzerId: string): HTMLAudioElement {
    let audio = this.audioElements.get(buzzerId);
    if (!audio) {
      audio = new Audio(BUZZER_AUDIO_PATH);
      audio.loop = true;
      audio.preload = 'auto';
      this.audioElements.set(buzzerId, audio);
    }
    return audio;
  }

  /**
   * Start playing buzzer audio in a loop for a given buzzer instance.
   * If already playing, this is a no-op.
   */
  play(buzzerId: string): void {
    const audio = this.getOrCreateAudio(buzzerId);
    if (audio.paused) {
      audio.currentTime = 0;
      audio.play().catch(() => {
        // Browser may block autoplay if no prior user gesture
      });
    }
  }

  /**
   * Stop playing buzzer audio for a given buzzer instance.
   */
  stop(buzzerId: string): void {
    const audio = this.audioElements.get(buzzerId);
    if (audio && !audio.paused) {
      audio.pause();
      audio.currentTime = 0;
    }
  }

  /**
   * Stop all buzzer audio and clean up resources.
   * Call when simulation ends.
   */
  stopAll(): void {
    this.audioElements.forEach((audio) => {
      audio.pause();
      audio.currentTime = 0;
    });
  }

  /**
   * Clean up all audio elements entirely.
   */
  dispose(): void {
    this.stopAll();
    this.audioElements.clear();
    this.isInitialized = false;
  }
}

export const buzzerAudioService = new BuzzerAudioService();
