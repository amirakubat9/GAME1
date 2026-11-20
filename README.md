# IMBALANCE: Wrath of Olympus — 3D Fair Value Gap Arcade Game

A **God of War II** inspired 3D price-action trading game built with **Three.js**, **TypeScript**, and **Vite** for instant deployment on **Render**.

## How to Play (Simple 3-Step Rules)
1. **Watch for a Big Jump (3-Candle Gap):** When price shoots up or down fast, it leaves an empty glowing bridge called a **Fair Value Gap (FVG)**.
2. **Tap the Gold 50% Line:** Tap inside the glowing FVG bridge (aim for the dashed gold line in the middle) before price comes back to test it.
3. **Collect Dollar Orbs & Ascend Realms:** When price taps your order and bounces away, you earn **$700 to $4,500+**, unleash fiery Blades slashes and Olympus Orbs, and unlock harder *God of War II* arenas!

## Connecting Supabase for a Shared Friends Leaderboard
1. Create a free project at [supabase.com](https://supabase.com).
2. Open the **SQL Editor** in Supabase and run:
   ```sql
   create table leaderboard (
     id uuid default gen_random_uuid() primary key,
     player_name text not null,
     peak_dollars integer not null,
     best_streak integer not null,
     realm_reached text not null,
     created_at timestamp with time zone default now()
   );
   alter table leaderboard enable row level security;
   create policy "Public read" on leaderboard for select using (true);
   create policy "Public insert" on leaderboard for insert with check (true);
   ```
3. In your **Render Dashboard -> Environment**, add:
   - `VITE_SUPABASE_URL` = your Supabase Project URL
   - `VITE_SUPABASE_ANON_KEY` = your Supabase `anon` public key
4. Redeploy on Render — you and your friends will now share a live global leaderboard!
