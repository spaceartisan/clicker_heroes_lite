# Future religion system — integration notes

Status: **design-only**. The v0.4 release does not add temples, beliefs, worship, Faith currency, or religious bonuses.

## Architecture

- The Royal Academy uses the permanent **Insight** resource and a stable catalog of research node IDs. It reserves a `faith` domain only as a future expansion point; religion should be an independent system, not an invisible fourth Academy branch.
- Later, create a versioned `faithState` structure separately from `researchState`; restore missing data to defaults so current and older saves continue to load.
- Prefer a dedicated Temple / Shrine building that visibly develops on the kingdom map, rather than adding faith upgrades to the Market. The Castle may govern when worship buildings become available but should not dictate a specific belief.
- If adding fantasy pantheons/patrons, make their differences **playstyle tradeoffs**, not mandatory compounding multipliers that invalidate current military or economic progress. Consider one active blessing, a meaningful choice or cooldown, and an ordinary non-religious route of comparable power.
- Avoid time-intensive background rituals or rapid repeated effects. Keep progression event-driven and offline rewards bounded so phone thermal performance remains predictable.

## Proposed first vertical slice (not implemented)

An authored Temple or Shrine location on the Kingdom canvas; optional patron selection; earned Faith through normal play/milestones; two mutually exclusive blessings; a clear switching rule; associated achievements and stats; and save/export migration tests. Specify balancing and exact unlock levels after testing v0.4 economy with normal player saves.

## Balancing invariants

1. Keep primary progression (stages, hero, squads, Market, Castle) viable without choosing a faith.
2. Do not award Insight and Faith from the same boss event without a bounded and explicit reason.
3. Grant retroactive credit only when historical saved progression is sufficient to establish the award.
4. Keep upgrade previews and actual prices equal in the Army, building panels, and any future Temple panel.
5. Test high-stage/high-rank saves and mobile background performance whenever new economic multipliers are added.
