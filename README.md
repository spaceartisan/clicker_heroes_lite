# Heroes of the Click — Dynasty Season II (v1.0.0)

**Play:** https://clicker-heroes-lite.netlify.app/ · **Source:** https://github.com/spaceartisan/clicker_heroes_lite

Season II is an intentionally fresh balance season. Older v0.5.1 saves are automatically archived in the same browser under `clickerHeroSave_before_dynasties`. An on-screen prompt offers **Export old save** before playing. Old .chs imports are rejected to prevent the previous economy from bypassing the new progression. Starting Season II does **not** delete the earlier local archive, and the previous leaderboard records remain untouched.

### Long-term progression

- **Dynasties:** After clearing stage 200, the player may voluntarily found a new Dynasty for **1–50 Renown**, based on the furthest stage of the run. Rebirth restarts gold, stage, hero, mercenaries, buildings, Decrees, Market projects, and Royal Treasury, but retains Dynasty investments and Royal Academy research. The original season-best stage continues to count toward leaderboard standings and Insight.
- **Three Renown investments:** War Council improves mercenary DPS, Trade League increases gold, and Royal Administration reduces research/building costs. Each has growing cost and bounded square-root returns, so no runaway exponential stacking.
- **Academy colleges:** Military, Merchant, and Civic College add repeatable, increasingly expensive Insight choices. The original twelve named research technologies and their prerequisites remain. College benefits grow logarithmically with a 10,000-rank safety cap and bounded returns.
- **Market charters:** A new repeatable guild investment opens at Market level 4. Charter costs increase; returns scale with square roots and are capped at +60% enemy gold.
- **Endless stages:** Stage health and gold gain a moderate logarithmic modifier beyond 200. Huge stage values, highly upgraded gear, and Castle costs are capped below JavaScript infinity. Historic 20-million-stage scores are deliberately excluded from the new season ranking.

The Kingdom now displays a **Dynasty** panel for Renown choices, a rebirth button, and lifetime season-best stage. Research is carried across rebirths; the Market's old projects remain available and benefit from the new investment layer.

### Leaderboard deployment note

Season II reads and writes Firebase collection **`scores_dynasty_ii`**, leaving **`scores`** intact. This is a *logical leaderboard reset*; no user records are deleted. The Firestore project owner must verify its Security Rules grant appropriate read/write access to the new collection. Client code alone cannot modify the production Firestore Security Rules. If access is blocked, the leaderboard displays a meaningful error rather than pretending scores were submitted.

### Technical notes

The app remains static HTML/CSS/JavaScript, installable on Android/iOS/desktop with the existing PWA. No new animation loops or networking on every combat tick were introduced. The single 250-ms combat loop and background pause remain.

Run `node tests/smoke-test.cjs` to exercise combat, purchases, Dynasty state, the save transition, old-save archive, scaling at high stages, and research.

Faith/religion remains a separate future mechanic. Renown and Insight are secular resources.

**QA note:** The release includes explicit smoke checks for Season II leaderboard collection routing, legacy-save archival, Dynasty rebirth persistence, and finite numerical calculations at twenty million stages. Visual QA uses responsive layout previews; actual device performance and Firestore permissions must still be checked on deployed infrastructure.
