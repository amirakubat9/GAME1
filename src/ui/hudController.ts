import { LevelConfig, TradeOutcome } from '../types/market';

export class HudController {
  private sessionBadge = document.getElementById('session-badge')!;
  private scoreValue = document.getElementById('score-value')!;
  private streakValue = document.getElementById('streak-value')!;
  private livesValue = document.getElementById('lives-value')!;
  private progressBar = document.getElementById('level-progress-bar')!;
  private calloutBanner = document.getElementById('callout-banner')!;
  private calloutTitle = document.getElementById('callout-title')!;
  private calloutSub = document.getElementById('callout-sub')!;
  private quickSnipeBtn = document.getElementById(
    'quick-snipe-btn'
  ) as HTMLButtonElement;
  private overlayScreen = document.getElementById('overlay-screen')!;
  private overlayTitle = document.getElementById('overlay-title')!;
  private overlayDesc = document.getElementById('overlay-desc')!;
  private startBtn = document.getElementById('start-btn') as HTMLButtonElement;

  private calloutTimer: number | null = null;

  public updateStats(
    score: number,
    streak: number,
    lives: number,
    level: LevelConfig,
    prevTarget: number
  ): void {
    this.sessionBadge.textContent = level.sessionLabel;
    this.sessionBadge.style.color = level.themeAccent;
    this.scoreValue.textContent = score.toLocaleString();
    this.streakValue.textContent = `${streak}x`;
    this.livesValue.textContent = '■'.repeat(Math.max(0, lives)) + '□'.repeat(Math.max(0, 3 - lives));
    this.livesValue.style.color = lives <= 1 ? '#f43f5e' : '#00f5a0';

    const span = Math.max(1, level.targetScore - prevTarget);
    const pct = Math.min(100, Math.max(0, ((score - prevTarget) / span) * 100));
    this.progressBar.style.width = `${pct}%`;
  }

  public setQuickSnipeAvailable(available: boolean): void {
    this.quickSnipeBtn.disabled = !available;
  }

  public showCallout(
    headline: string,
    subtext: string,
    isDanger = false
  ): void {
    this.calloutTitle.textContent = headline;
    this.calloutSub.textContent = subtext;
    this.calloutBanner.classList.toggle('danger', isDanger);
    this.calloutBanner.classList.remove('hidden');

    if (this.calloutTimer !== null) {
      window.clearTimeout(this.calloutTimer);
    }
    this.calloutTimer = window.setTimeout(() => {
      this.calloutBanner.classList.add('hidden');
    }, 2200);
  }

  public showOutcome(outcome: TradeOutcome): void {
    this.showCallout(outcome.headline, outcome.subtext, !outcome.won);
  }

  public hideOverlay(): void {
    this.overlayScreen.classList.add('hidden');
  }

  public showStopOutOverlay(finalScore: number, maxStreak: number): void {
    this.overlayTitle.textContent = 'ACCOUNT BLOWN';
    this.overlayDesc.innerHTML = `Drawdown limit hit! Final P&amp;L Score: <strong>${finalScore.toLocaleString()}</strong> · Best Streak: <strong>${maxStreak}x</strong>. Ready to re-enter the next session?`;
    this.startBtn.textContent = 'TAP TO RE-ENTER MARKET';
    this.overlayScreen.classList.remove('hidden');
  }
}
