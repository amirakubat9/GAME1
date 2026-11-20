import { STARTING_DOLLARS } from '../engine/fvgEngine';
import { LeaderboardEntry, LevelConfig } from '../types/market';

export class HudController {
  private sessionBadge = document.getElementById('session-badge')!;
  private scoreValue = document.getElementById('score-value')!;
  private streakValue = document.getElementById('streak-value')!;
  private livesValue = document.getElementById('lives-value')!;
  private progressBar = document.getElementById('level-progress-bar')!;
  private rageBar = document.getElementById('rage-progress-bar')!;
  private rageLabel = document.getElementById('rage-label')!;
  private calloutBanner = document.getElementById('callout-banner')!;
  private calloutTitle = document.getElementById('callout-title')!;
  private calloutSub = document.getElementById('callout-sub')!;
  private skipDemoBtn = document.getElementById(
    'skip-demo-btn'
  ) as HTMLButtonElement;
  private demoBanner = document.getElementById('demo-banner')!;
  private demoTimer = document.getElementById('demo-timer')!;
  private demoStepTitle = document.getElementById('demo-step-title')!;
  private demoStepDesc = document.getElementById('demo-step-desc')!;
  private overlayScreen = document.getElementById('overlay-screen')!;
  private overlayTitle = document.getElementById('overlay-title')!;
  private overlaySubtitle = document.getElementById('overlay-subtitle')!;
  private overlayDesc = document.getElementById('overlay-desc')!;
  private playBtn = document.getElementById('play-btn') as HTMLButtonElement;
  private leaderboardList = document.getElementById('leaderboard-list')!;
  private lbSyncBadge = document.getElementById('lb-sync-badge')!;
  private floatingPopups = document.getElementById('floating-popups')!;

  private calloutTimer: number | null = null;

  public updateStats(
    dollars: number,
    streak: number,
    shields: number,
    ragePct: number,
    isRageActive: boolean,
    level: LevelConfig,
    prevTarget: number
  ): void {
    this.sessionBadge.textContent = level.sessionLabel;
    this.sessionBadge.style.color = level.themeAccent;
    this.scoreValue.textContent = `$${dollars.toLocaleString()}`;
    this.streakValue.textContent = `${streak}x`;
    this.livesValue.textContent =
      '⚔️'.repeat(Math.max(0, shields)) + '💀'.repeat(Math.max(0, 3 - shields));

    const span = Math.max(1, level.targetBalance - prevTarget);
    const pct = Math.min(
      100,
      Math.max(0, ((dollars - prevTarget) / span) * 100)
    );
    this.progressBar.style.width = `${pct}%`;

    const clampedRage = Math.min(100, Math.max(0, Math.round(ragePct)));
    this.rageBar.style.width = `${clampedRage}%`;
    this.rageLabel.textContent = isRageActive
      ? '🔥 SPARTAN RAGE ACTIVE (2X $)!'
      : `SPARTAN RAGE ${clampedRage}%`;
  }

  public spawnDollarPopup(
    screenX: number,
    screenY: number,
    dollarDelta: number
  ): void {
    const el = document.createElement('div');
    const isLoss = dollarDelta < 0;
    el.className = `float-dollar ${isLoss ? 'loss' : ''}`;
    el.textContent = isLoss
      ? `-$${Math.abs(dollarDelta).toLocaleString()}`
      : `+$${dollarDelta.toLocaleString()}`;
    el.style.left = `${Math.min(window.innerWidth - 65, Math.max(65, screenX))}px`;
    el.style.top = `${Math.min(window.innerHeight - 95, Math.max(115, screenY))}px`;
    this.floatingPopups.appendChild(el);
    window.setTimeout(() => el.remove(), 1300);
  }

  public setDemoModeUI(
    isDemo: boolean,
    allowSkip: boolean,
    remainingSec = 60
  ): void {
    this.demoBanner.classList.toggle('hidden', !isDemo);
    this.skipDemoBtn.classList.toggle('hidden', !(isDemo && allowSkip));
    if (isDemo) {
      const secs = Math.max(0, Math.ceil(remainingSec));
      const mm = String(Math.floor(secs / 60)).padStart(2, '0');
      const ss = String(secs % 60).padStart(2, '0');
      this.demoTimer.textContent = `${mm}:${ss}`;
    }
  }

  public updateDemoPrompt(title: string, desc: string): void {
    this.demoStepTitle.textContent = title;
    this.demoStepDesc.textContent = desc;
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
    }, 2100);
  }

  public hideOverlay(): void {
    this.overlayScreen.classList.add('hidden');
  }

  public showSessionEndOverlay(
    peakDollars: number,
    maxStreak: number,
    realmName: string
  ): void {
    const netProfit = peakDollars - STARTING_DOLLARS;
    const profitText =
      netProfit >= 0
        ? `+$${netProfit.toLocaleString()} net gain`
        : `-$${Math.abs(netProfit).toLocaleString()} drawdown`;

    this.overlayTitle.textContent = 'FALLEN IN BATTLE';
    this.overlaySubtitle.textContent = 'MARGIN CALL · SESSION COMPLETE';
    this.overlayDesc.innerHTML = `Peak Equity: <strong>$${peakDollars.toLocaleString()}</strong> (${profitText}) · Best Combo: <strong>${maxStreak}x</strong> · Reached <strong>${realmName}</strong>.`;
    this.playBtn.textContent = '⚔️ PLAY AGAIN';
    this.overlayScreen.classList.remove('hidden');
  }

  public renderLeaderboard(
    entries: LeaderboardEntry[],
    currentPlayer: string,
    isCloud: boolean
  ): void {
    this.lbSyncBadge.textContent = isCloud ? 'SUPABASE LIVE' : 'LOCAL ARENA';
    this.lbSyncBadge.classList.toggle('cloud', isCloud);

    this.leaderboardList.innerHTML = entries
      .slice(0, 5)
      .map((item, idx) => {
        const isMe =
          item.player_name.toUpperCase() === currentPlayer.toUpperCase();
        return `
          <div class="lb-row ${isMe ? 'me' : ''}">
            <div class="lb-left">
              <span class="lb-rank">#${idx + 1}</span>
              <div>
                <div class="lb-name">${item.player_name}</div>
                <div class="lb-meta">${item.realm_reached} · ${item.best_streak}x Combo</div>
              </div>
            </div>
            <div class="lb-dollars">$${item.peak_dollars.toLocaleString()}</div>
          </div>
        `;
      })
      .join('');
  }
}
