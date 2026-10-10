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

### v1.2.2 — browse historical leaderboard seasons

- Added an accessible Season selector in Leaderboard: **Season II · Dynasties** (current, `scores_dynasty_ii`) and **Season I · Legacy** (archive, `scores`). Viewing Season I is read-only and does not alter or delete any historical score.
- Name confirmation and score synchronization controls disappear while browsing an archived season. Returning to Season II restores them; uploads are still hardwired to the current season.
- Changing the selection ends the previous Firestore subscription and ignores stale snapshots; closing the popup cleans up its listener. Empty rankings and Firestore permission issues have clear messages.
- Added selector regression checks and bumped visible version and offline shell cache to v1.2.2. Corrected an existing test harness to await an event-loop turn for asynchronous synchronization callbacks.
- Firestore must allow client **read** access to the legacy `scores` collection to display historic rankings. This frontend change cannot modify server rules.

### v1.2.3 — dated message history

- The community message board now shows the **full local posting date and time** for each Firestore message, including historical messages. A compact message header places the author's name beside a semantic timestamp; message content has its own line for readability on phones.
- Timestamps are displayed in the viewer's locale and timezone, with an ISO timestamp on the HTML `time` element. Messages remain ordered newest first, and author/message fields are inserted as text, not interpreted as HTML.
- Added message-date, old-record, listener-cleanup, and untrusted-text regression checks. Bumped the visible version and offline cache to v1.2.3; no database schema, server write, or player save changes.

### v1.3.0 — boss trials, squad campaigns and permanent relics

- New first-clear Ash Dragon bosses (every tenth stage) have a **30-second trial**, with a visible countdown. Failure returns the player to the previous stage, disables auto-advance for gold farming, and exposes a **Retry Boss** button; revisited, already-cleared bosses remain untimed. The timer pauses when the document is hidden, with no offline combat punishment.
- Barracks squads can be dispatched on **20-minute patrols, 60-minute ruins expeditions, or 120-minute warlord campaigns**. Unlocks at Barracks levels 1, 3, and 6; a second simultaneous campaign at Barracks 5. A deployed squad stops contributing combat DPS until the timed mission is claimed. Outcomes and drops are fixed when dispatched and saved locally. Offline time counts towards mission completion; rewards are granted only once on claim.
- **Relic Vault** in Kingdom: three equipment slots, five bounded relic bonuses (hero, squad, boss, enemy gold, campaign success), permanent inventory across Dynasties, salvage duplicate copies for fragments, and craft a random relic from 8 fragments. Guaranteed milestone boss trophies and rare expedition drops feed the vault. Relic milestone claims persist across rebirths; live campaigns are abandoned when founding a Dynasty.
- Existing Season II saves load missing fields with safe defaults. No new Firebase collections or writes. Rewards are finite and separated from Academy Insight and Renown.
- New static and gameplay regression checks cover the boss gate, expedition resource conservation, offline claim behavior, relic persistence and duplicate protection.

### v1.4.0 — opt-in balance telemetry and clearer Army DPS

- Anonymous **per-Dynasty balance summaries** (optional, disabled by default) capture foreground time, highest cleared stage, boss attempts, clear times and failures, 30-second damage-to-HP ratios, campaign outcomes, and relic activity. Firebase writes are coalesced instead of per click. Client consent is stored separately from the game save.
- New admin-only **Balance Observatory**, available at `admin/balance.html` when hosted. Compares Season I/II leaderboard distributions, last observed run stages and rebirths, boss performance, and expedition/relic totals; supports a local sanitized JSON import/export.
- Army now distinguishes **neutral DPS** from **effective DPS against the current target** and includes research, Dynasty, market and relic multipliers used in combat. Differences across enemies and deployed squads are explained directly on the Army tab.
- Deployment requirement: configure Firebase anonymous authentication and server-enforced admin read permissions as described in [docs/BALANCE_ANALYTICS.md](docs/BALANCE_ANALYTICS.md). Firebase settings and live data are **not** modified by publishing this repository.

### v1.4.1 — expedition tactics and boss preparation

- **Recall deployed squads** for combat before an expedition completes, explicitly forfeiting all rewards. The Hero boss panel includes a squad-only clear-time estimate and a consolidated recall option when squads are away.
- **Mission previews** show success probabilities, role/kit advantages, and the squad's neutral DPS committed. Readiness scales mildly with levels and gear, capped at 97% success. The outcome is determined at dispatch and survives offline progress and save/load.
- **Claim all ready** collects completed patrols/campaigns in one action. The one-second clock now updates only status elements, rather than recreating squad selection controls mid-interaction.
- Deployed Raider squads no longer grant combat gold bonuses, and deployed Ember Blade squads no longer suppress combat regeneration. Active DPS was already removed.
- Existing Season II saves and previously dispatched campaigns remain compatible. No new Firebase fields or permissions are necessary.

### v1.5.0 — four rotating boss encounters

- Every tenth stage remains a first-clear 30-second boss trial; boss types repeat every 40 stages: **Ash Dragon** (armored), **Storm Wyvern** (evasive), **Grave Wyrm** (spectral), **Cinder Hydra** (regenerating).
- Three additional pixel silhouettes and a live tactical dossier describe enemy identity, phase and counters. Armored opening guard is bypassed by Vanguards/Piercing Arms; Rangers lower Wyvern click-dodge; Mystics/Runic Weapons break Grave Wyrm healing; Ember Blades stop Hydra regrowth. Non-boss enemies remain unchanged.
- **Boss healing is evaluated during the existing 1-second trial clock**, including manual-only play, and pauses in hidden tabs; it never runs twice through the mercenary damage timer. All mechanics are bounded and apply only to a new timed boss (revisited bosses remain farmable).
- Boss Market bounties, boss research, boss relics, victories and telemetry now recognize **every** boss, not just the Ash Dragon. Army DPS and combat damage use matching armor modifiers, and displayed hero damage includes the same modifiers as actual clicks.
- No save schema changes, new network calls, or new Firebase permissions required. First boss at stage 10 remains Ash Dragon. Recorded high-stage progression is preserved.

### v1.6.0 — Boss Bestiary and signature rewards

- A collapsed Kingdom **Boss Bestiary** displays encountered boss portraits, weaknesses, recorded wins, highest defeated stage, fastest timed victory, and five permanent mastery ranks. Prior progress reveals encountered species without fabricating kill statistics.
- Clearing a higher-numbered first-clear stage of that boss species grants one rank (maximum five), permanently adding **+3% damage against the species** and **two relic fragments**. At rank three, the boss guarantees a signature relic: Ash Dragon / Ember Crest, Storm Wyvern / Pathfinder's Compass, Grave Wyrm / Runestone Ward, Cinder Hydra / Banner of Valor.
- Each species remembers its highest rewarded stage across Dynasty resets; repeating a prior stage cannot farm more ranks, shards or signature relics. Past milestone-boss rewards still work as before.
- The save adds a bounded bossCodex of four entries. Earlier saves load with empty new records, retaining old progress, achievements and relic inventories. Mastery affects hero clicks, active squad DPS and Army effective DPS (not neutral DPS). Boss victories save immediately.

### v1.7.0 — monster variety and Field Guide

- Seven individually pixel-authored regular enemies join the classic five: Dusk Wisp, Bog Leech, Copper Kobold, Fang Mantis, Wind Stalker, Granite Scarab, and Spore Hulker. Stage 1–9 lineup stays intact, new enemies first appear at 11–17, and all twelve cycle deterministically between ten-stage boss encounters. Existing enemy resistance, dodge, regeneration, role and kit counters remain the source of combat behavior.
- A collapsible, responsive **Monster Field Guide** in Kingdom shows seen/unknown silhouettes, species counter hints, actual recorded defeats and highest defeated stage. Includes All, Encountered, Recorded and Undiscovered filters. Previously available species can be revealed from historical stage progress, but new species are not falsely marked as encountered in older saves.
- Each species awards exactly **one relic fragment on its first recorded defeat**, capped to twelve total discoveries, regardless of repeat kills, Dynasties or extreme-stage farming. These rewards do not change underlying level health scaling, base XP, Market prices, or boss frequency.
- New `monsterCodex` state contains only twelve bounded per-species entries. Older Season II saves load safely with empty new records. First recorded specimen is saved immediately; routine defeat counts follow the existing autosave cadence. No new Firebase fields or permissions.

### v1.8.0 — optional player accounts and cloud-save foundation

- Game Config now supports optional **Email/Password** registration and login, plus **Google sign-in** once the provider is enabled in Firebase Console. Anonymous gameplay and local saves remain the default. Creating an email account links the existing anonymous Firebase identity, when present.
- Signed-in players may manually **check, back up, or restore** their private Season II save at `player_saves/{Firebase UID}`. There are **no automatic cloud uploads or overwrites** in this first rollout. Sign-in never overwrites a local save. Backup displays both versions and requires explicit confirmation if cloud data exists; an atomic Firestore transaction rejects saves changed on another device.
- Cloud restore validates season and schema, prompts with local/cloud summaries, writes an independent recovery copy to `clickerHeroSave_before_cloud_restore` and reloads. Network/rules failures leave local play unaffected. Sign-out leaves the local game in place. Existing save data, Dynasty progression, leaderboard documents and administrator account are untouched.
- The Firebase Authentication/Firestore setup and secure owner-only rules are documented in [docs/PLAYER_ACCOUNTS.md](docs/PLAYER_ACCOUNTS.md). **The rules must be merged into the existing deployed rules separately**; a public repository commit does not deploy them. Google sign-in also requires enabling the provider and authorized domain. Current name-based leaderboard submissions remain separate and are not made cheat-resistant by this release.
- Opt-in telemetry now checks the current Firebase user before reusing a cached anonymous sign-in, avoiding stale owner UIDs after account linking.

### v1.9.0 — guarded opt-in automatic cloud backup

- Account settings gain an opt-in **Automatic cloud backup** control, off by default. To enable it, the player first manually backs up or restores a Season II save, establishing a trusted Firebase UID and cloud revision for that device. The game checks every five minutes in the foreground, sending only changed game data (heartbeat timestamps and leaderboard bookkeeping are ignored).
- Each automatic upload re-reads the cloud from the server and uses a Firestore transaction that compares exact expected revisions. If another device changes the cloud, the feature **pauses without writing anything** and tells the player to compare and choose a version with manual backup/restore. Temporary offline/network failures keep local progress safe, without silent cloud restore. Sign-out/account switch disables automatic backup.
- Automatic sync is **backup-only** and intentionally never automatically loads cloud progress on a device. This protects saves on computers/phones with different local progress. No database schema or rule changes beyond the v1.8.0 owner-only player-saves rules are needed; rules still need to be published separately.

### v1.10.0 — Connected Account leaderboard (optional)

- New selectable **Season II · Connected Accounts** leaderboard uses `scores_accounts_dynasty_ii/{Firebase UID}`, separate from the unchanged name-based Season II and historical Season I leaderboards. Existing scores are not auto-claimed or migrated.
- Signed-in non-anonymous players can explicitly **Publish / Update My Account Score**, choosing a public display name. A Firestore transaction prevents account score decreases and binds each entry to the current authenticated UID. Display names are not unique; the (You) highlight is based solely on matching Firebase UIDs.
- Authentication establishes ownership, **not server-verified scores**. The new collection requires additional owner-only Firestore rules from `docs/PLAYER_ACCOUNTS.md`, which must be published separately. Existing guest scores, player saves, telemetry and admin access remain unaffected.

### v1.10.1 — cross-device cloud discovery

- On Google/Email sign-in the game now checks the account-owned Firestore save and detects a different or newer cloud revision. A compact in-game banner can open **Compare / Restore**, where the player's current local and cloud progress are shown side-by-side with stage, Dynasty and save date. No automatic overwrite is performed.
- Cloud discovery also runs when the tab is re-opened and while active (throttled to one read every three minutes), with meaningful permission/network errors instead of a misleading "synced" label. The account panel shows a short UID suffix to help confirm both devices use the same Firebase identity.
- A new device without a cloud anchor detects an available cloud save. The original **Back Up Local Save** and **Restore Cloud Save** protections remain; restoring always saves a local recovery copy and requires player confirmation.
- Automatic cloud backup remains opt-in, backup-only, guarded by revision checks. The banner surfaces concurrent-device progress instead of silently erasing it. No new Firestore collections or rules beyond the already-documented `player_saves` rule.

### v1.10.2 — cloud restore lifecycle fix

- Fixed a mobile/cloud-restore race: the outgoing page's `pagehide`, `visibilitychange`, or autosave callback could overwrite the restored PC save with stale in-memory phone progress just before reload. Saves are now guarded while a validated cloud restore navigates; after reload the guard resets with the new page.
- The pre-restore local recovery copy remains available, Google account/cloud permissions are unchanged, and a failed restore releases the temporary guard. Cross-device restore now has a regression covering the actual page-exit autosave event.
