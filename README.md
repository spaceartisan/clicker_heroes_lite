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

## Developer checks

No dependencies, bundler, or build step are required; the site is static.

```sh
node tests/smoke-test.cjs
```

The test script verifies upgrade caps, enemy archetypes, squad roles and gear, kingdom rendering, mercenary DPS scaling, background throttling, offline gold limits, legacy saves, Firestore listener cleanup, and safe text rendering.

## Community security

The leaderboard and message board use Firebase/Firestore. User-supplied content is inserted with DOM text APIs, rather than untrusted HTML.

**Important:** Firebase configuration values in client-side code are normal public identifiers, not a substitute for access control. Firestore Security Rules should independently enforce who can create/change names and scores, message length and rate limits, and prevent unauthorized writes. These server rules are **not** supplied in this repository.

## Older project notes

This project began as a small JavaScript exercise and grew into a hybrid clicker/kingdom RPG. The old monolithic `script.js` implementation was removed because the active game now uses the separate `hero.js`, `kingdom.js`, `enemy.js`, `database.js`, `ui.js`, and `game.js` modules (classic script tags, loaded in dependency order).
