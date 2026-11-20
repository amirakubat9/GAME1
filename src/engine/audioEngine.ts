/**
 * Epic War-Drum & Brass/Choir Synth Audio Engine (Web Audio API)
 * Zero external MP3s required.
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

  public playWarDrum(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(125, now);
    osc.frequency.exponentialRampToValueAtTime(42, now + 0.35);

    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.38);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.4);
  }

  public playFvgSpawn(isBullish: boolean): void {
    const base = isBullish ? 330 : 293.66;
    this.playTone(base, 0.2, 'sawtooth', 0.07, 0);
    this.playTone(base * 1.5, 0.26, 'triangle', 0.09, 0.06);
  }

  public playBladeStrike(isSniper: boolean): void {
    this.playTone(880, 0.11, 'sawtooth', 0.12, 0);
    if (isSniper) {
      this.playTone(1320, 0.2, 'triangle', 0.14, 0.04);
    }
  }

  public playMitigationWin(streak: number, isSniper: boolean): void {
    this.playWarDrum();
    const semitoneBoost = Math.min(streak, 12);
    const ratio = Math.pow(2, semitoneBoost / 12);
    const root = 440 * ratio;

    // Heroic Spartan fifth + octave fanfare
    this.playTone(root, 0.28, 'sawtooth', 0.09, 0.02);
    this.playTone(root * 1.5, 0.34, 'triangle', 0.13, 0.07);
    this.playTone(root * 2, 0.45, 'triangle', 0.15, 0.13);
    if (isSniper) {
      this.playTone(root * 2.5, 0.5, 'sine', 0.12, 0.18);
    }
  }

  public playStopOutFlip(): void {
    this.playWarDrum();
    this.playTone(130, 0.35, 'sawtooth', 0.18, 0);
    this.playTone(82, 0.45, 'square', 0.14, 0.08);
  }

  public playRealmAscension(): void {
    this.playWarDrum();
    const notes = [293.66, 440, 587.33, 739.99, 880];
    notes.forEach((n, idx) => {
      this.playTone(n, 0.35, 'sawtooth', 0.09, idx * 0.08);
    });
  }
}
