# Heroes of the Click

An incremental fantasy RPG and kingdom-building clicker, written with plain HTML, CSS, and JavaScript. Attack monsters, develop hero skills, hire and improve mercenary squads, and build a kingdom whose structures unlock progression and market bonuses.

**Play:** https://clicker-heroes-lite.netlify.app/  
**Source:** https://github.com/spaceartisan/clicker_heroes_lite

> This is an AI-assisted project, not wholly AI-generated. I designed and implemented the game, with ChatGPT used for programming assistance.

## Playing and installing

The game is hosted by Netlify and uses the GitHub repository for source management. This is a progressive web app (PWA): it uses a manifest, installation icons, standalone display mode, and a service worker that caches the game for offline startup.

- **Android:** Open the Netlify URL in Chrome, then use the browser menu → **Install app** or **Add to Home screen**.
- **iPhone/iPad:** Open it in Safari, then tap **Share** → **Add to Home Screen** → **Add**. iOS installation requires Safari's Home Screen flow.
- **PC/Mac:** Open the URL in Chrome or Edge and use the **Install** icon/menu if offered. In other browsers you can still play normally.

After the first fully loaded visit, the main game can start offline from its cache. The leaderboard and community message board need connectivity. Game progress is stored in the browser's localStorage, not in a cross-device cloud account, so installations on different browsers/devices do **not** automatically sync saves. Use **Game Config → Export Save / Import Save** to transfer progress.

## Controls and saving

Click/tap enemies to attack. Advance through enemy levels, unlock abilities, and spend gold on the hero, mercenaries, and kingdom. The Tavern expands recruitment, Barracks improve attack speed, Blacksmith improves gear, Castle controls many level caps, and Market offers economic bonuses.

Autosaving runs about once per minute while the game is in the foreground. The game also saves when the page is hidden or closed. The game pauses combat when backgrounded and awards bounded offline earnings upon return; this prevents extremely fast mercenary intervals from consuming power in the background.

## Kingdom and combat (v0.2.0)

The kingdom and combat now influence each other. **Each squad has an independently selectable role and a forgeable equipment kit**, on top of its existing mercenary levels, equipment tiers and attack speeds.

| Building | Unlock | Gameplay effect |
| --- | --- | --- |
| Barracks | Vanguard (default), Rangers at level 2, Mystics at 4, Raiders at 6 | Rangers counter evasive foes; Mystics counter spectral ones; Raiders sacrifice DPS for extra gold; Vanguards excel against armor. |
| Blacksmith | Forged Steel at level 1, Piercing Arms at 2, Ember Blades at 4, Runic Weapons at 6 | Steel adds general damage; piercing counters armor; ember burns regenerators and stops their healing; runic counters spectral defenses. |
| Castle | Higher building tiers and additional world details | The castle develops towers, a ward, housing, banners, and more as it levels. |
| Tavern / Market | Recruiting and economic upgrades | Higher buildings become visibly developed on the map and strengthen the corresponding progression systems. |

Open **Kingdom → Barracks** to assign a combat role to a squad. Open **Kingdom → Blacksmith** to forge a kit. A kit is purchased once for each squad; switching between owned kits is free. These controls are per squad, not per mercenary, to keep the UI usable with large armies.

Monsters now have hand-authored pixel silhouettes and six distinct combat profiles: **Mire Slime** (regeneration), **Sky Harpy** (evasion), **Iron Golem** (armor), **Moon Wraith** (spectral resistance), **Goblin Marauder** (bonus bounty), and **Ash Dragon** (a powerful armored boss every ten stages). The current enemy's trait and weakness appear below its sprite. Mercenary DPS reflects its active target's resistance and the squads' loadouts.

### Save compatibility and performance

Your older local saves are supported. Missing squad role/kit data initializes to a standard Vanguard squad, and previously earned upgrades, hired mercenaries, gold and kingdom building levels are retained. New saves include the new `squadBuilds` object; do not remove that field when manually editing saves.

The kingdom and enemy art are static Canvas rendering, performed on stage changes or menu actions rather than a continuous 60 FPS animation loop. The single 250 ms combat tick and pause-on-background behavior remain in place for battery/heat control. Performance still needs verification on representative physical Android and iOS devices.

## Army Command (v0.3.0)

Open the **⚔ Army** tab to manage every squad from one roster without reopening the Tavern, Barracks, or Blacksmith for each upgrade. The corresponding kingdom building menus also link directly to Army Command.

- **Select all, clear selection, or check particular squads** — selection works across pages.
- **Batch upgrade mercenary levels, squad gear or squad speed** by ×1, ×10, or ×100 per target. Pricing is calculated before the purchase, honors existing caps and market discounts, and only spends available gold. Partial purchases are intentionally allowed.
- **Fair distribution:** mercenary levels are purchased in round-robin order across squads, one mercenary slot per squad at a time, rather than exhausting gold on the first squad.
- **Quick squad actions:** each card has one-tap level, gear and speed upgrades; the expandable panel includes role and forged-kit controls and mercenary names.
- **Squad sorting and pagination:** sort by squad number, weakest/strongest DPS, or lowest level; the roster shows eight squads at a time to avoid slow mobile rendering.
- **Recruit up to five** additional mercenaries in one operation, up to your Tavern's capacity and budget.

The Army Command selection is temporary UI state; your mercenary levels, roles, equipment purchases and other progression continue to use the existing save format. It requires no account or migration. Only the currently visible roster page is rendered and nothing in Army Command runs in the combat timer.

## Royal Court, Market & Royal Academy (v0.4.0)

The Castle now provides a small direct hero-click bonus (+1.5% per additional Castle level, capped at +60%) in addition to its existing hero-level cap, unlocks further buildings, and hosts the **Royal Academy**. The Castle offers three paid decrees: **Leadership** (mercenary level cap), **Royal Guard** (+4% hero click damage per additional rank), and **Crown Steward** (+3% gold from enemies per rank). Unlocks are enforced during purchases, not only visually.

The Market gains **Bounty Contracts** (boss rewards), **Caravan Logistics** (normal-monster income), and **War Supplies** (mercenary DPS) alongside its five previous projects. Project unlock levels and building-level caps are enforced in the purchase function. Previous market research levels carry over.

The Academy has a **three-branch dependency tree**: Warfare, Commerce, and Governance. Clear each tenth stage for the first time to earn one Insight; every fifth Castle level grants another. This is computed from all-time progression, meaning returning players are credited for past milestones. Insight is limited and permanent research has prerequisite nodes, stage and Castle gates. The Academy can be opened from the Kingdom or Castle/Market building menus. Research and purchased decrees persist in exported and local saves.

### Balance adjustments

- Market can first be built after clearing stage **20**, without the former Castle Lv 3 requirement. Blacksmith and Barracks first open after stage 25 and Castle Lv 2. Later building upgrades still need higher Castle levels.
- Castle base cost is now **30,000** (previously 50,000) with **1.35×** growth instead of 1.5×; other buildings use **1.45×** growth.
- Market research costs grow at **1.65× per rank** rather than doubling; level caps and unlock requirements remain in force. Merchant discounts and the Guild Charters research apply to purchases.
- Mercenary gear-upgrade prices now grow as **(next rank)^6** instead of the previous eighth power, and attack-speed upgrades as **(next rank)^4**. The weaker marginal return from speed is thus priced more reasonably. Army Command and individual upgrades use identical formulas, including Market and research discounts.
- Castle decrees also receive applicable upgrade-cost discounts.
- Monster gold per defeat grows approximately with stage^1.4, versus stage^1.5 for monster HP. Research and Market benefits use bounded additive or modest multiplicative improvements; existing specialized squad counters remain important.
- The previous description of Blacksmith's Touch was misleading: it boosts damage, not physical gear-upgrade cost efficiency.
- The existing offline income limit (24 hours at a fraction of foreground mercenary DPS), fixed-rate combat loop, and no-constant-redraw approach remain intact.

**Future religion system:** The Academy reserves a separate `faith` domain for a future progression layer but does not award Faith, add worship buildings, or choose a religion yet. Insight and Faith should remain distinct resources so future theology, patrons, blessings, and worship choices do not invalidate existing saves.

## Stage 20–100 economy pass (v0.4.1)

**Royal Treasury** in the Kingdom offers one-time milestone rewards: stage 20 (2,000g), 40 (8,000g), 60 (18,000g), 80 (32,000g) and 100 (50,000g), totaling 110,000g. Clear the stage, then claim in the Kingdom. Replaying an old boss cannot earn the bounty again. Existing saves can claim eligible unclaimed stages retroactively, while `claimedTreasury` persists with normal saves. This is separate from Academy Insight and the planned Faith economy.

Offline gold now simulates 10%-efficiency encounters against ordinary enemies, bounded to one kill per 40 seconds and a maximum of 24 hours. Boss multipliers do not apply; Market, Raider, Steward, and research rewards still contribute. Without hired mercenaries no offline patrol income accrues. The foreground 250ms combat loop and background pause remain unchanged.

**Projection:** clearing stages 21–100 once generates about 75,000g of base monster rewards. The 110,000g of Treasury milestones spreads additional capital across the midgame instead of increasing repeatable farming drops. Bounties stop at stage 100 until the next progression design pass.

## Developer checks

No dependencies, bundler, or build step are required; the site is static.

```sh
node tests/smoke-test.cjs
```

The test script verifies upgrade caps, enemy archetypes, squad roles, Castle and Market purchases, Royal Academy prerequisites and Insight, save migration, army progression, background throttling, and Firestore content safety.

## Community security

The leaderboard and message board use Firebase/Firestore. User-supplied content is inserted with DOM text APIs, rather than untrusted HTML.

**Important:** Firebase configuration values in client-side code are normal public identifiers, not a substitute for access control. Firestore Security Rules should independently enforce who can create/change names and scores, message length and rate limits, and prevent unauthorized writes. These server rules are **not** supplied in this repository.

## Older project notes

This project began as a small JavaScript exercise and grew into a hybrid clicker/kingdom RPG. The old monolithic `script.js` implementation was removed because the active game now uses the separate `hero.js`, `kingdom.js`, `enemy.js`, `database.js`, `ui.js`, and `game.js` modules (classic script tags, loaded in dependency order).
