# Firebase balance observatory — operations and privacy

## Collection setup

The game does not transmit telemetry unless the player explicitly enables **Share anonymous balance statistics** in Game Config. The setting defaults off and is stored locally (independent of save files). Disabling stops future reporting and deletes the queued local summaries. **It does not erase documents already uploaded to Firestore**, which the administrator can delete through Firebase Console.

The game sends only versioned, aggregated statistics: stages, active foreground seconds, grouped boss attempts/wins/timeouts/total win seconds, initial combat power-to-HP ratio, campaign start/claim/success/failure totals, and relic found/equipped counts. It does not upload user names, messages, local saves, click histories, email, hardware fingerprints or IP addresses as document fields. Firebase itself uses authentication UIDs and standard service metadata.

Each consenting Dynasty run gets a random UUID as a document ID; records may be **updates to one document** rather than per-event writes. Normal cadence is 5 minutes; milestone exceptions have a 1-minute minimum. A maximum of 3 unsent ended runs is kept locally. Foreground seconds are an approximation of playtime while visible, with long suspended gaps capped; they are *not* proof of active attention.

### Activation

1. Open Firebase Console for the existing `game-leaderboard-17478` project. Enable **Authentication → Anonymous** for consenting players, and **Email/Password** for the private admin account.
2. Merge the rule fragment below into the existing Firestore rules and deploy from Firebase Console or trusted Admin tooling. Preserve all existing rules for `scores`, `scores_dynasty_ii`, and `message`.
3. Create the administrator in Firebase Auth. From a **trusted** Firebase Admin SDK session, assign that user's UID the custom claim `{ balanceAdmin: true }`. Never place service credentials in the browser or repository. Sign out and in again to refresh token claims.
4. Verify a consenting game session can upload its run document and cannot list all run documents. Confirm the dashboard at `/admin/balance.html` can read data only while logged into the claimed admin account.
5. A JSON export (or manual JSON file) can be imported into the dashboard offline if Firebase permissions have not yet been configured. **No live database statistics have been inspected as part of this code change.**

### Firestore rules fragment

Add this *inside* `match /databases/{database}/documents` in your existing rules; do not replace the existing complete rules document:

```rules
match /balance_telemetry_v1/{runId} {
  function isBalanceAdmin() {
    return request.auth != null && request.auth.token.balanceAdmin == true;
  }
  function safeShape() {
    return request.resource.data.keys().hasOnly([
      'schemaVersion','seasonId','build','ownerUid','startedAt',
      'updatedAt','dynasty','highestStage','currentStage','activeSeconds',
      'ended','endedStage','bosses','campaigns','relics'
    ]) &&
    request.resource.data.keys().hasAll([
      'schemaVersion','seasonId','build','ownerUid','startedAt',
      'updatedAt','dynasty','highestStage','currentStage','activeSeconds',
      'ended','endedStage','bosses','campaigns','relics'
    ]) &&
    request.resource.data.schemaVersion == 1 &&
    request.resource.data.seasonId == 'dynasty-ii' &&
    request.resource.data.ownerUid == request.auth.uid &&
    request.resource.data.updatedAt == request.time &&
    request.resource.data.startedAt is number &&
    request.resource.data.highestStage is number &&
    request.resource.data.activeSeconds is number &&
    request.resource.data.ended is bool &&
    request.resource.data.bosses is map &&
    request.resource.data.bosses.keys().size() <= 25 &&
    request.resource.data.campaigns is map &&
    request.resource.data.relics is map;
  }
  allow create: if request.auth != null && safeShape();
  allow update: if request.auth != null &&
      resource.data.ownerUid == request.auth.uid && safeShape();
  allow get, list, delete: if isBalanceAdmin();
}
```

Enforce authenticated admin reads on **leaderboard collections** too if those contain sensitive fields and should not be publicly queryable; the current game needs public rank reads, so do not change them blindly. Anonymous authentication and write-shape validation limit accidental exposure but are not anti-cheat or abuse prevention. For stronger trust, use App Check and server-side aggregation; never use untrusted client telemetry to award game currency or privileges.

## Dashboard and interpretation

The public site path `admin/balance.html` contains no secrets. Server-enforced Firestore rules protect reads. It queries up to 2,000 recent opt-in run documents plus the top 2,000 ranked scores for each season, and shows:

- Progression distribution for each season's leaderboard, latest stages of active/abandoned runs, and Dynasty rebirth stages.
- Grouped timed boss success, timeout rate, mean successful fight duration, and opening 30-second DPS/HP ratio.
- Expedition launches, claims, wins and losses; relic finds and equips.
- A sanitized JSON import/export option to analyze authorized extracts offline.

A player with multiple Dynasties produces multiple **runs**. Attempts within a run are correlated and should not be treated as independent players. Consent bias, leaderboard truncation and progression differences between Seasons I and II limit historical comparisons.

Since timed bosses are already active, a 30-second *shadow comparison* is simply the fraction of observed first-clear attempts that time out and observed successful completion times. We cannot reconstruct counterfactual late victories or historical fight times from leaderboard scores.

## Manual JSON import

```json
{
  "current":[{"score":200},{"score":1500}],
  "legacy":[{"score":25000000}],
  "runs":[{"highestStage":250,"currentStage":200,"ended":true,"endedStage":200,
    "activeSeconds":7200,
    "bosses":{"b200":{"attempts":3,"wins":1,"timeouts":2,"winSeconds":26,"powerSum":2.4}},
    "campaigns":{"started":3,"claimed":2,"won":1,"lost":1},
    "relics":{"found":2,"equipped":1}
  }]
}
```

This is example data only, not a claim about actual players. The dashboard keeps only whitelisted numeric aggregate fields from imported data.
