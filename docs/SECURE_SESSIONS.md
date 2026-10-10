# Superseded: optional paid Cloud Functions prototype

**Do not deploy this guide for v1.12.0.** The current game uses [Spark Device Handoff](SPARK_DEVICE_HANDOFF.md) and requires only Firestore rules. The previous server-owned Cloud Functions design remains archived here for future backend work, and is NOT required for this release.

---

# Secure sessions — deployment and threat model (v1.11.0)

**Status: SOURCE READY, NOT DEPLOYED.** These files live in the GitHub repository, but Netlify does not deploy Firebase Cloud Functions or Firestore rules. Until the operator deploys the functions and tightens the rules, existing client-written saves and leaderboards are still modifiable by account owners. The game falls back to local-first saving if the session functions return \`not-found\`; it explicitly shows "protection not active".

## Threat model

- Client JavaScript, local storage, game save values, and manual leaderboard entries are **untrusted**. Google Authentication identifies an account but does not prove the submitted score is real.
- The backend generates a single active session *lease* per authenticated UID (120 seconds) using a random 256-bit per-tab bearer token. Only a hash of that token is stored in the server-only Firestore session record. No player name or other identifying device data is used; "Phone / tablet" or "Desktop / laptop" is only a coarse label.
- \`claimPlayerSession\` is atomic; a second device is asked to take over explicitly. A lease expires if the current device crashes or loses connectivity. \`pingPlayerSession\` renews an active lease while the page is visible. A takeover immediately invalidates the other device's token.
- \`checkpointPlayerSession\` rate-limits an account to one checkpoint per 15 seconds and atomically checks **both** the current session holder and the expected save revision before accepting a cloud save. Two competing sessions cannot silently write over each other via this endpoint. \`session_review\` stores a limited signal for unusually large stage jumps; these are **flags**, not cheating convictions, and scores remain unverified.
- The browser pauses its honest game UI after takeover/loss or when a newer cloud save must be reviewed. A malicious player can modify client-side UI code, but **cannot bypass the server-session check once direct Firestore writes have been disabled**. This is not full game-state authority.

## Deploy in this order

1. Firebase Cloud Functions (2nd gen) require a supported billing plan (typically Blaze). Review your limits and budgets before deployment. Install Node 22 and the Firebase CLI, login to the intended project and run from the repository root:

   \`\`\`sh
   cd functions
   npm install
   npm test
   cd ..
   firebase deploy --only functions:claimPlayerSession,functions:pingPlayerSession,functions:releasePlayerSession,functions:checkpointPlayerSession --project game-leaderboard-17478
   \`\`\`

2. Verify the account panel reports **This device owns the active server lease** after refreshing and signing in. On a second device, verify **Use This Device (Take Over)** appears; take over, then verify the first device reports the lease lost (within a heartbeat or on reactivation). Test a manual cloud backup and restore. **Do not tighten the save rules before verifying the callable backend**, or cloud uploads will fail.

3. Once the functions work, change the \`player_saves/{userId}\` match in Firestore **without changing its GET rule**. Keep \`allow get: if isSaveOwner();\` (or equivalent). Replace direct \`allow create\` and \`allow update\` permissions with \`allow create, update, delete, list: if false;\`. Functions use the Admin SDK to write saves and bypass client rules; only authenticated owner reads remain. If you omit this step, someone can still bypass the lease with the Firebase client SDK.

4. Add these new Firestore matches inside \`match /databases/{database}/documents {\`, preserving all original administrator, telemetry, scores, and message rules:

   \`\`\`firebase
   // Only callable backend functions can read or write leases.
   match /player_sessions/{userId} {
     allow read, write: if false;
   }
   // Owner-only admin inspection. Never expose reports to players.
   match /session_review/{reviewId} {
     allow get, list, delete: if isBalanceAdmin();
     allow create, update: if false;
   }
   \`\`\`

5. **Legacy scoreboard caveat:** \`scores_dynasty_ii\` and \`scores_accounts_dynasty_ii\` still allow direct browser score reports. They MUST continue to be marked **unverified**. To fully secure rankings, a future server-authoritative scoring system must compute progression/rewards and own a separate server-only leaderboard collection, followed by rules closing direct writes to the old score collections. Simply switching \`allow write: if false\` today would break current ranking publication without delivering verified scores.

6. Test in the Firestore Rules Playground/Emulator: (a) authenticated owner can get own cloud save, not another person's, (b) no browser (even an owner) can create/update/delete a cloud save or session document, (c) Cloud Function checkpoint still succeeds, (d) no anonymous user can claim a server lease, (e) the Balance Observatory still requires the \`balanceAdmin\` custom claim, (f) archived scores/messages behave as before.

## Diagnostics and rollback

- Functions live in \`functions/index.js\`, pure checks in \`functions/session-core.js\`, tests in \`functions/tests/session-core.test.cjs\`.
- There are no embedded administrator credentials. Firebase Functions' service account accesses Firestore through Admin SDK. Restrict IAM on that service account.
- If Functions deployment is missing, the account panel says protection is unavailable and local-first play continues. **This mode offers no device-lock or anti-cheat protection**.
- If server enforcement has already been established on an account, a temporary Functions outage pauses cloud writes rather than silently falling back to unsafe direct client writes.
- Rollback by restoring the last known-good Functions deployment and the prior *known-good* Firestore rules; never temporarily open Firestore writes to everybody. Do not delete \`player_saves\`, \`scores_dynasty_ii\`, \`balance_telemetry_v1\` or user data during rollback.
- For an already connected account, **changing browsers or clearing per-tab session storage may require an explicit Take Over**; a crashed old tab's lease expires after two minutes.
- Same-account session takeover is allowed to the signed-in user; this is not protection against somebody who has stolen the user's Google/Firebase credentials. Secure account recovery and abuse response are separate tasks.
- **No score here is server-validated.** The stage-jump anomaly is a heuristic; do not use it to auto-ban or assert cheating.

## Operational checklist

The rollout is not complete until: Functions deployed; both-device takeover and expiry verified against real Firebase; client writes to \`player_saves\` denied in Rules; server checkpoints work; unverified score labeling remains visible; admin permissions regression checked. Do not claim all these checks passed from source-only CI.
