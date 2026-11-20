/**
 * Procedural Web Audio API sound synthesizer.
 * Requires zero external MP3/WAV assets and scales pitch dynamically with player streak.
 */
export class SynthAudioEngine {
  private ctx: AudioContext | null = null;
  public muted = false;

  private ensureContext(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private playTone(
    freq: number,
    duration: number,
    type: OscillatorType = 'sine',
    gainPeak = 0.14,
    delay = 0
  ): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(gainPeak, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  public playFvgSpawn(isBullish: boolean): void {
    const base = isBullish ? 440 : 392;
    this.playTone(base, 0.16, 'triangle', 0.09, 0);
    this.playTone(base * 1.25, 0.22, 'sine', 0.09, 0.06);
  }

  public playOrderLocked(isSniper: boolean): void {
    this.playTone(660, 0.1, 'sine', 0.12, 0);
    if (isSniper) {
      this.playTone(990, 0.18, 'triangle', 0.14, 0.05);
    }
  }

  public playMitigationWin(streak: number, isSniper: boolean): void {
    const semitoneBoost = Math.min(streak, 12);
    const ratio = Math.pow(2, semitoneBoost / 12);
    const root = 523.25 * ratio; // C5 shifted up by streak

    this.playTone(root, 0.22, 'triangle', 0.15, 0);
    this.playTone(root * 1.25, 0.25, 'sine', 0.13, 0.05);
    this.playTone(root * 1.5, 0.34, 'sine', 0.14, 0.1);
    if (isSniper) {
      this.playTone(root * 2, 0.4, 'triangle', 0.12, 0.14);
    }
  }

  public playStopOutFlip(): void {
    this.playTone(150, 0.28, 'sawtooth', 0.16, 0);
    this.playTone(95, 0.36, 'square', 0.12, 0.06);
  }

  public playLevelUp(): void {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((n, idx) => {
      this.playTone(n, 0.26, 'triangle', 0.14, idx * 0.07);
    });
  }
}
