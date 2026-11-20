# IMBALANCE — 3D Fair Value Gap (FVG) Price-Action Arcade Game

A fast-paced, mobile-friendly 3D browser arcade game built for price-action traders and gamers using **Three.js**, **TypeScript**, and **Vite**. Spot 3-candle **Fair Value Gaps (FVGs)** as institutional displacement rips open, arm limit orders near the **50% Consequent Encroachment (CE)** midpoint, and ride the bounce before a stop-hunt flips the gap into an **Inverse FVG (IFVG)**.

---

## Core Gameplay & ICT / SMC Mechanics

* **3-Candle FVG Detection (`src/engine/fvgEngine.ts`):**
  * **Bullish FVG (BISI):** Triggers when Candle 3's low stays above Candle 1's high after a bullish displacement Candle 2 (`c3.low > c1.high`).
  * **Bearish FVG (SIBI):** Triggers when Candle 3's high stays below Candle 1's low after a bearish displacement Candle 2 (`c3.high < c1.low`).
* **Consequent Encroachment (50% CE) Sniper Scoring:**
  * Tap or click inside any glowing FVG bridge to lock a limit order.
  * Placing your order within the inner **24% band around the 50% CE midpoint** awards a **3.0x R:R SNIPER FILL** with a 0.25s hitstop slow-motion impact and camera zoom-punch.
* **Inverse FVG (IFVG) Polarity Flip:**
  * If price slices through the distal edge of an FVG without rejecting, the gap violently barrel-rolls 180° and turns crimson (`INVALIDATED_IFVG`).

---

## Level Progression

| Level | Session | Key Mechanic & Visual Juice |
| :--- | :--- | :--- |
| **Lvl 1** | **4H Swing** | Clean Bullish & Bearish FVGs with hydraulic candle growth |
| **Lvl 2** | **London Open** | Liquidity Sweeps of equal highs/lows before displacement |
| **Lvl 3** | **NY Overlap** | Order Block + FVG Confluence zones (1.5x payout bonus) |
| **Lvl 4** | **FOMC / CPI News** | High-impact news candles, camera shake & rapid IFVG flips |
| **Lvl 5+** | **5s Scalper Overdrive** | Maximum tick speed; streak combos pitch up the Web Audio synth |

---

## Local Development

```bash
npm install
npm run dev
```

Open `http://localhost:5173` on desktop or your phone on the same Wi-Fi network.

---

## Deploy to Render (Static Site)

1. Push this repository to **GitHub**.
2. In the [Render Dashboard](https://dashboard.render.com/), click **New + -> Static Site** (or use **New + -> Blueprint** to auto-import `render.yaml`).
3. Connect your GitHub repository and confirm these settings:
   * **Build Command:** `npm install && npm run build`
   * **Publish Directory:** `dist`
4. Click **Create Static Site** — Render will build and serve your 3D game globally with free TLS and automatic deploys on every `git push`.
