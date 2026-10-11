# Heroes of the Click — no-cost Spark device handoff (v1.12.0)

This release replaces the unused Cloud Functions client with **Firebase Authentication, Cloud Firestore transactions, and Firestore Security Rules**. No Functions deployment or billing upgrade is required. Spark Firestore usage quotas still apply.

## What it does

- A device install receives a random 128-bit ID in localStorage. Each browser tab gets a second random 128-bit ID in sessionStorage. Together they form a 64-character device/session ID. It is a coordination identifier, not a hardware fingerprint or unforgeable identity.
- Each signed-in UID has at most one active tab recorded in \`player_sessions/{uid}\`. Opening another tab/device reports the current owner and offers an explicit **Use This Device (Take Over)** action. Takeover is an atomic Firestore transaction. The previous tab sees the changed record through a real-time listener and stops honest gameplay/auto-backups.
- The new owner compares/restores the cloud save before continuing, or deliberately backs up its own local copy after comparing. **Nothing is merged automatically.** The old local copy is still preserved by the existing restore recovery slot.
- Normal time-away gold is deferred at startup for account-linked browsers. It is only awarded after *the same tab* reacquires the existing session, its local/cloud data matches, **and the saved payload carries the same originating tab ID**. Restoring a PC save on the phone does not count as a returning local session after reload. A different tab or device does not receive a fresh offline award for the same period. Background returns do not award extra time-away gold for account-linked saves until the handoff design is expanded. Saves that have never been account-linked retain the original guest offline behavior. Signing out of an already linked browser does not reset its time-away restriction (preventing a sign-out/sign-in double-dip).
- A heartbeat updates the active session every three minutes while visible. A session without a heartbeat for eight minutes can be reclaimed. There is no paid Firestore TTL feature. Browser crashes and disconnections do not permanently lock out the account.
- Cloud backup writes include \`deviceId\`, and Firestore Rules check that the server's active device ID matches the submitted ID, as well as owner UID, revision, and save format.

**Limitations:** Players can change their own device ID or browser save using developer tools; an account owner can deliberately take over their own UID. Client-reported scores and offline time calculations can be manipulated. This prevents ordinary two-device double-dipping and stale writes, **not malicious score forgery**. Connected-account scores remain marked unverified. Firebase App Check and a trusted progression service would be needed for stronger abuse defenses.

## Deploy without billing

The game client is deployed from GitHub/Netlify. **There are no Cloud Functions to deploy.** After the new game version is live, publish the two replacement Firestore rules below. Do NOT retain the previous permissive \`player_saves\` match, since Firestore combines overlapping allow rules permissively. Preserve all your other rules for \`scores\`, \`scores_dynasty_ii\`, \`scores_accounts_dynasty_ii\`, \`message\`, \`balance_telemetry_v1\`, \`balanceAdmin\`, and the final deny-all.

Inside your existing \`match /databases/{database}/documents {\`:

\`\`\`firebase
// Player-controlled handoff: the account owner may transfer their active tab.
// This is not a trusted anti-cheat token; it coordinates normal sessions.
match /player_sessions/{userId} {
  function isAccountOwner() {
    return request.auth != null
      && request.auth.uid == userId
      && request.auth.token.firebase.sign_in_provider != 'anonymous';
  }

  function validSession() {
    let s = request.resource.data;
    return s.keys().hasOnly([
        'ownerUid','deviceId','deviceLabel','schemaVersion','released','updatedAt'
      ])
      && s.keys().hasAll([
        'ownerUid','deviceId','deviceLabel','schemaVersion','released','updatedAt'
      ])
      && s.ownerUid == userId
      && s.deviceId is string
      && s.deviceId.matches('^[0-9a-f]{64}$')
      && s.deviceLabel in ['Phone / tablet', 'Computer']
      && s.schemaVersion == 1
      && s.released is bool
      && s.updatedAt == request.time;
  }

  allow get: if isAccountOwner();
  allow list, delete: if false;
  allow create, update: if isAccountOwner() && validSession();
}

// Keep private cloud reads, but only the currently registered tab may write.
// Replace the PREVIOUS player_saves match completely with this block.
match /player_saves/{userId} {
  function isSaveOwner() {
    return request.auth != null
      && request.auth.uid == userId
      && request.auth.token.firebase.sign_in_provider != 'anonymous';
  }

  function activeDevice() {
    let s = get(/databases/$(database)/documents/player_sessions/$(userId)).data;
    return s.ownerUid == userId
      && s.released == false
      && s.deviceId == request.resource.data.deviceId
      && s.updatedAt > request.time - duration.value(8, 'm');
  }

  function validCloudSave() {
    let d = request.resource.data;
    return d.keys().hasOnly([
        'ownerUid','schemaVersion','seasonId',
        'revision','updatedAt','save','deviceId'
      ])
      && d.keys().hasAll([
        'ownerUid','schemaVersion','seasonId',
        'revision','updatedAt','save','deviceId'
      ])
      && d.ownerUid == userId
      && d.schemaVersion == 1
      && d.seasonId == 'dynasty-ii'
      && d.revision is int && d.revision >= 1
      && d.updatedAt == request.time
      && d.deviceId is string && d.deviceId.matches('^[0-9a-f]{64}$')
      && d.save is map
      && d.save.schemaVersion == 2
      && d.save.seasonId == 'dynasty-ii';
  }

  allow get: if isSaveOwner();
  allow list, delete: if false;
  allow create: if isSaveOwner() && validCloudSave() && activeDevice()
                && request.resource.data.revision == 1;
  allow update: if isSaveOwner() && validCloudSave() && activeDevice()
                && resource.data.ownerUid == userId
                && resource.data.revision is int
                && request.resource.data.revision == resource.data.revision + 1;
}
\`\`\`

**IMPORTANT:** Publish both matches together. The new game client falls back to legacy local-first mode while the \`player_sessions\` rules are missing. Once the new rules are published, old cached app versions may be denied cloud uploads until refreshed; their local saves remain intact. Consider testing on your own account before asking players to update.

## Test after publishing

1. On PC, refresh the latest game, sign into Google, open **Game Config → Active device handoff**, and confirm it says this tab is active.
2. On PC, choose **Back Up Local Save**. Verify success and a positive cloud revision.
3. On phone, sign into the *same Google UID*. It should show **active on Computer** and offer **Use This Device (Take Over)**.
4. Choose Take Over, then **Compare / Restore Cloud Progress**. Compare and explicitly restore the PC save. The phone reloads with that progress and no extra cross-device offline gold.
5. Check the PC: it should detect loss of ownership and stop auto-backups. Trying to back up from the stale PC should fail; cloud progress should not be overwritten.
6. Test a normal reload in the same tab: it reclaims the same session without a takeover warning. Offline reward is only eligible if that tab was already the owner and its local and cloud progress agree.
7. In Firestore Rules Playground/Emulator, verify a different UID cannot read or write the session/save, an anonymous UID cannot claim a session, and a save write with a device ID different from \`player_sessions/{uid}.deviceId\` is denied.

Firestore free usage quotas apply to the session listener, heartbeats, and rules' cross-document reads. See [Firebase Spark pricing](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans).

## If something goes wrong

- **Device handoff rules missing:** The panel reports they need publishing. Existing local game saves are untouched.
- **Cloud backup denied:** Check that you refreshed the game, that the session is active, and that you replaced the **old** \`player_saves\` rules rather than adding a second overlapping allow.
- **Old PC progress not present on phone:** Upload on PC **before** takeover. If it was already taken over, use the PC's local Export Save and explicitly recover it after reviewing the cloud copy.
- **Account session won't clear:** Wait eight minutes for the lease to expire or choose explicit Take Over while signed in as the account owner.
- **Rollback:** Keep your existing Firestore rules in a separate backup before publishing. Restore the last-known-good rules and release together. Never delete user save documents to repair a handoff issue.

This free version **does not** require \`firebase deploy --only functions\`. The older \`functions/\` source is unused/archived; do not deploy it for this feature.

### v1.12.1 offline origin correction

The game now stores an optional `lastSavedDeviceId` in newly authored local saves. At startup it captures that origin *before* the first autosave. After restoring a PC cloud save, the phone sees the PC origin and **cannot claim its elapsed period as phone offline earnings**, even when the phone immediately reloads and reacquires its own handoff session. Older saves without an origin remain compatible but do not receive this account-linked offline bonus. This field is for honest-device coordination, **not a tamper-resistant entitlement**; the backend limitation remains.

### v1.12.2 — cross-device restore / local continuation

A restored cloud save contains the previous tab's `lastSavedDeviceId`, which is replaced during the receiving tab's first local save. The cloud progress fingerprint now ignores that metadata, preventing a restore loop after PC-to-phone transfer. The originating ID **is still validated separately** before granting offline gold. If the existing session owner refreshes with locally earned unsynced progress, it can continue when the cloud revision has not changed; a newer revision or a different-device handoff still requires comparison and an explicit decision. This changes no Firestore document schema or security rules.

### v1.13.0 — clean checkpoint-first handoff (no new rules)

When actively playing, open **Game Config → Active device handoff → Save & Switch Device**. This creates a validated local snapshot and uploads it with the latest expected revision using the existing authenticated Firestore transaction. **The session is released only after the upload succeeds.** If the cloud revision changed, the action stops and asks for a manual comparison. The other device can keep the game open: it listens to the existing session record and changes from **Use This Device (Take Over)** to **Continue on This Device** after release. Clicking Continue claims the released session, then reviews/restores the cloud save. Do not rely on an unverified guest or unprotected account for this handoff. No new collections, permissions or billing are needed.

### v1.13.1 — foreground re-verification

Returning from a hidden/background browser now pauses honest-client combat synchronously while Firestore confirms the current tab still owns an unexpired lease. A successful check resumes the previous active/review state; a failed, expired, or transferred lease stays paused until explicit reconnection. A fresh account sign-in also pauses combat while claiming its first session. Temporary checking preserves pending time-away eligibility, while actual loss/review clears it. This uses the existing transaction and session document, so **no Firestore rules update is required**.

During the foreground and sign-in verification window, cloud restore, cloud check, backup, and automatic-sync controls are temporarily disabled so they cannot conflict with an in-flight device-ownership decision. Once verification completes, normal cloud review actions become available again.

### v1.13.2 — interrupted connection recovery

When Firestore denies a checkpoint, connectivity breaks, or the session changes ownership, this game attempts to preserve a separate **local recovery snapshot**, scoped to the signed-in account, from the current saved progress. Open **Game Config → Player Account → Export Interrupted Progress** to download the CHS recovery file. Existing exports/imports remain unchanged. The snapshot is preserved independently from the live save and pre-cloud-restore backup, and is never silently merged or uploaded. Firestore errors pause protected gameplay; reconnecting must verify ownership and review any newer cloud revision before accepting uploads. If browser storage is full/blocked, no new recovery file can be promised; use the existing Export Save while the local game remains available. This is client-side data recovery, not cheat-proofing, and needs **no Firestore rule update**.

### v1.13.3 — compare, export and clear interrupted recovery

Game Config → Player Account now compares the preserved recovery snapshot with the current local Season II save. Export Interrupted Progress initiates an ordinary CHS file download. The **Clear Exported Recovery Copy** button stays disabled until that exact recovery has been exported in the current browser tab. A separate confirmation requests verification of the downloaded file. Clearing affects only the UID-scoped interrupted-recovery slot; it cannot delete the live save, cloud backup, or pre-cloud-restore recovery, and future interruptions can then preserve a new snapshot. Download initiation cannot prove the file reached disk, so players should check their downloads before confirming. No new Firebase features, billing, or Firestore rules needed.

### v1.13.4 — restart-safe recovery provenance

The first valid local save loaded after a browser/tab restart is retained in memory until account ownership has been verified. Startup autosaves can change `lastSaved` or `lastSavedDeviceId` without changing real gameplay; if the new tab encounters an account conflict, the recovery snapshot preserves the original save with its previous device origin. If the current local save has actually advanced since startup, the newer local data takes precedence. The existing recovery slot still holds its first snapshot until intentionally exported and cleared; no automatic restore, merge or offline award is performed. No Firebase billing or Firestore rules changes are necessary.

### v1.13.5 — delayed cloud-read ownership validation

A session claim is followed by a separate read of the cloud checkpoint. If another device takes ownership while that read is pending, the original tab now verifies the **current server session document again** before enabling gameplay. A stolen/expired/released lease leaves local saves and safety copies intact, disables stale cloud uploads, and requires another explicit claim/review. A PC → phone → PC (new tab) simulation verifies that each handoff saves a monotonic revision, a returning device must compare the latest cloud checkpoint, and no device silently merges saves or awards another device's time-away gold. This extra ownership read occurs at claim/review time; no new Firestore rules or Cloud Functions.

### v1.13.6 — free-tier idle-read optimization

The active owner now heartbeats about once every **four minutes** (eight-minute lease, approximately four minutes of normal scheduling headroom), and immediately rechecks ownership on foreground return. Automatic backup runs its local change detector every five minutes, but avoids a cloud read when gameplay has not changed **and** this tab has verified active Spark ownership. Changed gameplay still reads the cloud revision before a revision-guarded transaction. Routine cloud-discovery polling can also skip reads for this same active owner **only** when its previously verified cloud preview matches the local revision anchor. New devices, missing/invalid preview, pending review, lost/unprotected sessions, login, and explicit manual checks still query the server. This reduces routine reads/writes but cannot make a maliciously modified client trustworthy, and doesn't require Firestore rule changes.
