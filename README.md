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

### v1.0.1 — stabilization and mobile efficiency

- Season II leaderboard uploads are **coalesced** while one is pending, with a two-minute normal upload cadence and a five-minute automatic backoff after failures. The uploaded snapshot stage is the only stage marked as synchronized; newly earned stages cannot silently be treated as sent.
- Name registration is only confirmed after the Firestore write succeeds. Permission errors provide actionable feedback and leave the name field usable for a retry. Players can manually retry score synchronization from the leaderboard.
- The **Export Previous-Season Save** button remains available in Game Config whenever a pre-Season-II backup exists, even after the transition dialog is closed.
- Royal Academy Insight spending uses a memoized cumulative cost table. This avoids repeatedly recomputing thousands of ranks whenever research cards refresh.
- No changes to Dynasty benefits, the Season II save schema, active combat timers, or the deferred religion system.

**Deployment:** Firestore rules for `scores_dynasty_ii` still need to be verified by the project owner. Automated checks validate routing and failure handling, but cannot authorize backend access or measure thermal behavior on a physical phone.

### v1.1.0 — achievements and active ability status

- Locked hero abilities **do not appear on the HUD**. Buttons appear upon reaching their hero-level requirement, show a cooldown countdown, and show **ACTIVE** with remaining duration while an effect is running. Double Attack displays a prepared-charge indicator until consumed. A compact status line summarizes active effects. A single ability status timer runs only while effects/cooldowns are pending, avoiding multiple permanent timers on phones.
- Skill timers and active flags are reset upon Dynasty rebirth or loading a saved game. Active durations are deliberately session-only; previously earned ability-use achievements remain persistent.
- Achievements now include Dynasty, Royal Academy, College, Castle and Frontier milestones. Explorer progress uses the highest cleared stage, not whichever older stage is selected. Gold achievements explicitly require **holding** the gold simultaneously.
- The Achievements menu now shows overall completion and progress toward unfinished targets, with Completed / In Progress filters. Achievement notifications are consolidated when several unlock at once; saved achievements survive Dynasty resets. No Season II save format migration is needed.
- The stage 200+ pacing was reviewed at representative stages through 20 million. This pass does not change reward curves or the Dynasty reset cost; it concentrates on fixing the player-facing skill and milestone experience.

### Post-200 pacing review

The stage scaling was checked at stages 200, 500, 1,000, 10,000, and 20 million. For comparable boss encounters before multipliers, boss HP rises roughly 13× between 200 and 1,000, while base gold rises roughly 10×. Renown earned per reset goes from 1 (stage 200), to 2 (stage 500), 3 (stage 1,000), and 6 (stage 10,000), with gradual diminishing returns. There is no change to the economy formula in v1.1.0; empirical time-to-clear and device temperature should be measured during subsequent player tests.

### v1.1.1 — phone battery and run pacing

Battery Saver defaults **on for coarse-pointer/touch devices** and **off for desktop pointers**, and can be changed in Game Config. The combat tick remains at 250ms in both modes to preserve fast one-shot stage clearing. In battery mode only the combat HUD is throttled to at most two refreshes per second (normally four), eliminating duplicate damage and squad-summary recomputations without reducing attack rate or theoretical DPS. Manual attacks and hero skills remain immediate, and hidden tabs continue to pause combat. Battery Saver is saved per Season II game and requires no new network activity or timer.

The Dynasty panel now displays **this run's enemies defeated, active mercenary combat minutes, and gold earned from enemy kills**. These simple local counters survive saves and are reset with each new Dynasty. They do not count offline patrols as foreground combat and do not create background telemetry.

This is a CPU/DOM workload reduction, **not a claim of verified lower device temperature**. Test on physical iPhones and Android phones, particularly during extended sessions.

### v1.1.2 — UI and CSS consolidation

- Grouped the three main navigation tabs with an active-tab state, and aligned the Leaderboard / Message / Config actions into a responsive button row.
- Rebuilt the five Kingdom structure controls as consistent upgrade cards, preserving all existing cost IDs and upgrade callbacks. Hero leveling and gear upgrades now form a balanced two-column control group.
- Standardized minimum touch targets, focus-visible outlines, padding, disabled appearance, and narrow-screen layout for popups, army commands, and forms.
- Reorganized Game Config's save/import actions into a two-column grid, without changing the save system, Battery Saver, or the export of pre-Season-II files.
- Removed redundant early hero-ability styling and duplicate achievement scrolling rules. The achievement cards retain their dedicated internal scroll container and visible Close button.
- No gameplay/economic changes or additional animation loops. The stylesheet retains the existing medieval brown-and-gold identity.

### v1.1.3 — Fixed-width enemy card

The enemy encounter row is now a three-track CSS grid with fixed-width Previous/Next controls and a bounded center card. Enemy names and trait text wrap **inside** that card without shifting the stage arrows. The arrows are anchored to the sprite position instead of vertically centering on variable text, and long names (including Veteran and Frontier modifiers) are supported at phone and desktop widths. The enemy-name label is now authored in the HTML rather than appended at runtime, keeping the sprite, health, stage, name, and trait in a predictable order. Sprite rendering and attack mechanics are unchanged; no new timers or redraws are introduced.

### v1.2.0 — cohesive UI art and selectable Dark Theme

- Replaced device-rendered emoji icons in navigation, game actions, Kingdom/Army, Academy branches, achievements, currencies, save actions and stats with **24 authored SVG icons**. These are local assets and are included in the service-worker offline cache; a new local SVG crown emblem replaces the external emoji favicon.
- Refreshed the backdrop with lightweight CSS gradients and a restrained pattern, replacing remote texture dependencies. The existing warm medieval style is the default; **Dark Theme** uses charcoal-blue surfaces and brass accents across the game, enemy card, menus, form controls, and fixed HUD.
- Game Config includes a Dark Theme checkbox. Theme choice is stored independently under `heroes-of-click-theme` in device-local storage, restored before stylesheet painting, and synchronized whenever Game Config opens. It is intentionally not part of Dynasty/save resets. Browser theme-color updates to match the chosen theme.
- The PWA manifest advertises an SVG emblem and keeps existing PNG home-screen icons for compatibility. The service worker precaches the new icons and theme script with a v1.2.0 cache version. No additional combat loops, animation timers, or backend changes were introduced.
- Validated with dependency-free smoke tests and responsive layout previews at 320px, 390px, and desktop widths. The visual previews are representations of the updated palette and icon language rather than captures of the live Netlify deployment.

### v1.2.1 — Brick backdrop restored and Stone theme completed

- Restored the original dark-brick wall texture behind the game in Classic mode. The clean, fixed-width enemy encounter card stays untouched. Stone uses the same masonry texture with restrained slate-colored block joints and stone-like lighting.
- Renamed Dark Theme to **Stone Theme** in Game Config. Existing `heroes-of-click-theme=dark` preferences still load as Stone; save data and Dynasty state are unchanged.
- Audited themed buttons throughout Hero, Army, Castle, Market, Research, popups, and settings. Stone now overrides legacy hard-coded colors while retaining distinct selected, locked, disabled, cooling, and active-ability states.
- Bumped the offline shell cache to v1.2.1 so installed PWAs pick up the updated stylesheet, controller, and tests. The restored original brick texture is hosted externally, so the underlying solid-color fallback remains available offline.
