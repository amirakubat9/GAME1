import { LeaderboardEntry } from '../types/market';

const STORAGE_KEY = 'imbalance_gow2_leaderboard_v3';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const DEFAULT_RIVALS: LeaderboardEntry[] = [
  {
    player_name: 'ZEUS_ALGO',
    peak_dollars: 29500,
    best_streak: 7,
    realm_reached: 'REALM IV · HADES',
  },
  {
    player_name: 'ATHENA_SMC',
    peak_dollars: 21750,
    best_streak: 5,
    realm_reached: 'REALM III · CREATION',
  },
  {
    player_name: 'ARES_SCALP',
    peak_dollars: 16250,
    best_streak: 3,
    realm_reached: 'REALM II · STEEDS',
  },
];

export class LeaderboardService {
  public isCloudEnabled(): boolean {
    return Boolean(
      SUPABASE_URL &&
        SUPABASE_ANON_KEY &&
        !SUPABASE_URL.includes('YOUR-PROJECT-ID')
    );
  }

  private loadLocal(): LeaderboardEntry[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_RIVALS));
        return [...DEFAULT_RIVALS];
      }
      return JSON.parse(raw) as LeaderboardEntry[];
    } catch {
      return [...DEFAULT_RIVALS];
    }
  }

  private saveLocal(entries: LeaderboardEntry[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, 15)));
    } catch {
      // Ignore storage quota issues
    }
  }

  public async fetchTopScores(): Promise<LeaderboardEntry[]> {
    if (this.isCloudEnabled()) {
      try {
        const res = await fetch(
          `${SUPABASE_URL}/rest/v1/leaderboard?select=*&order=peak_dollars.desc&limit=10`,
          {
            headers: {
              apikey: SUPABASE_ANON_KEY,
              Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            },
          }
        );
        if (res.ok) {
          const rows = (await res.json()) as LeaderboardEntry[];
          if (rows.length > 0) return rows;
        }
      } catch {
        // Fallback to local
      }
    }

    return this.loadLocal().sort((a, b) => b.peak_dollars - a.peak_dollars);
  }

  public async submitScore(entry: LeaderboardEntry): Promise<LeaderboardEntry[]> {
    const local = this.loadLocal();
    local.push(entry);
    local.sort((a, b) => b.peak_dollars - a.peak_dollars);
    this.saveLocal(local);

    if (this.isCloudEnabled()) {
      try {
        await fetch(`${SUPABASE_URL}/rest/v1/leaderboard`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            Prefer: 'return=minimal',
          },
          body: JSON.stringify({
            player_name: entry.player_name,
            peak_dollars: entry.peak_dollars,
            best_streak: entry.best_streak,
            realm_reached: entry.realm_reached,
          }),
        });
      } catch {
        // Keep local copy
      }
    }

    return this.fetchTopScores();
  }
}
