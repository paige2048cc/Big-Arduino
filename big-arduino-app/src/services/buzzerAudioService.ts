/**
 * Buzzer Audio Service
 *
 * Uses the Web Audio API (AudioBufferSourceNode) for sample-accurate,
 * gapless looping.  HTMLAudioElement.loop leaves a small gap between
 * iterations because of MP3 encoder delay and browser re-buffering;
 * AudioBufferSourceNode.loop works on the decoded PCM buffer directly,
 * so the loop point is seamless.
 */

const BUZZER_AUDIO_PATH = '/audio/buzzer_audio.MP3';

class BuzzerAudioService {
  private audioContext: AudioContext | null = null;
  private audioBuffer: AudioBuffer | null = null;
  private activeSources = new Map<string, AudioBufferSourceNode>();
  private gainNodes = new Map<string, GainNode>();
  private pendingPlay = new Set<string>();
  private loadPromise: Promise<void> | null = null;

  private getContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
    }
    return this.audioContext;
  }

  /**
   * Pre-load the audio buffer so playback starts instantly later.
   * Safe to call multiple times.
   */
  initialize(): void {
    if (!this.loadPromise) {
      this.loadPromise = this.loadAudioBuffer();
    }
  }

  private async loadAudioBuffer(): Promise<void> {
    if (this.audioBuffer) return;
    try {
      const ctx = this.getContext();
      const response = await fetch(BUZZER_AUDIO_PATH);
      const arrayBuffer = await response.arrayBuffer();
      this.audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    } catch (err) {
      console.error('[BuzzerAudioService] Failed to load audio:', err);
    }
  }

  /**
   * Start gapless looping for the given buzzer.
   * No-op if already playing or a play is in progress.
   */
  play(buzzerId: string): void {
    if (this.activeSources.has(buzzerId) || this.pendingPlay.has(buzzerId)) return;
    this.pendingPlay.add(buzzerId);
    this.playAsync(buzzerId).finally(() => this.pendingPlay.delete(buzzerId));
  }

  private async playAsync(buzzerId: string): Promise<void> {
    if (!this.audioBuffer) {
      if (!this.loadPromise) this.loadPromise = this.loadAudioBuffer();
      await this.loadPromise;
      if (!this.audioBuffer) return;
    }

    if (this.activeSources.has(buzzerId)) return;

    const ctx = this.getContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    const source = ctx.createBufferSource();
    source.buffer = this.audioBuffer;
    source.loop = true;

    const gain = ctx.createGain();
    gain.gain.value = 1;

    source.connect(gain);
    gain.connect(ctx.destination);
    source.start(0);

    this.activeSources.set(buzzerId, source);
    this.gainNodes.set(buzzerId, gain);
  }

  /**
   * Stop buzzer audio for a given instance.
   */
  stop(buzzerId: string): void {
    const source = this.activeSources.get(buzzerId);
    if (source) {
      try { source.stop(); } catch { /* already stopped */ }
      source.disconnect();
      this.activeSources.delete(buzzerId);
    }
    const gain = this.gainNodes.get(buzzerId);
    if (gain) {
      gain.disconnect();
      this.gainNodes.delete(buzzerId);
    }
  }

  /**
   * Stop all buzzer audio. Call when simulation ends.
   */
  stopAll(): void {
    for (const [id] of this.activeSources) {
      this.stop(id);
    }
  }

  /**
   * Release all resources including the AudioContext.
   */
  dispose(): void {
    this.stopAll();
    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
    this.audioBuffer = null;
    this.loadPromise = null;
  }
}

export const buzzerAudioService = new BuzzerAudioService();
