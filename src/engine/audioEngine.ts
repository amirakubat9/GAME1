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
    osc.frequency.setValueAtTime(130, now);
    osc.frequency.exponentialRampToValueAtTime(42, now + 0.34);

    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.36);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.38);
  }

  public playJump(): void {
    this.playTone(240, 0.14, 'triangle', 0.11, 0);
    this.playTone(380, 0.16, 'sine', 0.09, 0.04);
  }

  public playOrbPickup(combo: number): void {
    const pitch = 587.33 * Math.pow(2, Math.min(combo, 12) / 12);
    this.playTone(pitch, 0.14, 'sine', 0.12, 0);
    this.playTone(pitch * 1.5, 0.18, 'triangle', 0.09, 0.04);
  }

  public playBladeSlash(): void {
    this.playTone(920, 0.12, 'sawtooth', 0.12, 0);
    this.playTone(460, 0.16, 'sawtooth', 0.1, 0.03);
  }

  public playFvgExecution(streak: number): void {
    this.playWarDrum();
    const ratio = Math.pow(2, Math.min(streak, 12) / 12);
    const root = 440 * ratio;
    this.playTone(root, 0.28, 'sawtooth', 0.09, 0.02);
    this.playTone(root * 1.5, 0.34, 'triangle', 0.13, 0.07);
    this.playTone(root * 2, 0.45, 'triangle', 0.15, 0.12);
  }

  public playDamageHit(): void {
    this.playWarDrum();
    this.playTone(125, 0.35, 'sawtooth', 0.18, 0);
    this.playTone(78, 0.42, 'square', 0.14, 0.07);
  }

  public playRealmAscension(): void {
    this.playWarDrum();
    [293.66, 440, 587.33, 739.99, 880].forEach((n, idx) => {
      this.playTone(n, 0.34, 'sawtooth', 0.09, idx * 0.07);
    });
  }
}
