# Heroes of the Click — Optional Player Accounts & Cloud Saves

Current client: v1.10.0 · Firebase project: \`game-leaderboard-17478\`

**Status:** The game UI and client logic have been committed. **Cloud reads and writes will not work until the new owner-only Firestore rule is merged and published** in the Firebase Console. This document is not a deployment and contains no credentials.

## Authentication

1. In Firebase Console → Authentication → Sign-in method, enable **Email/Password** (already used by the admin dashboard). Enable **Google** only if you want the additional Google sign-in button to work. Google may require a support email to be set.
2. Authentication → Settings → Authorized domains: verify \`clicker-heroes-lite.netlify.app\` and any other deployed hostnames you intend to use are listed. Do not add arbitrary domains.
3. Open the game → Game Config → Player Account & Cloud Saves. **Create Account** or **Sign In** with Email/Password, or **Sign In With Google** or **Link Guest to New Google Account** after enabling that provider.
4. Existing anonymous Firebase users from opted-in telemetry can *link* credentials when creating a new email account or connecting a new Google account. If a Google account already exists, Firebase may return \`credential-already-in-use\`; the user can sign in using another available provider rather than attempting to merge separate Firebase users automatically.

Player accounts are optional. Signed-out users continue using the existing local \`clickerHeroSave\`. Authentication does **not** associate an existing leaderboard display name with the UID yet, nor does it automatically grant \`balanceAdmin\`.

## Add the player-saves Firestore rules

The deployed Firestore rules were recently updated for the public leaderboard, message board, opt-in telemetry, and admin dashboard. Preserve every existing collection rule, especially the telemetry owner and \`balanceAdmin\` checks. **Insert only the following match block inside your existing** \`match /databases/{database}/documents {\` **scope** (and before the two closing braces).

Do *not* replace the entire ruleset with this block. Do not create an unrestricted \`match /{document=**}\` rule; overlapping \`allow\` grants are ORed together and a permissive wildcard defeats owner-only protection.

\`\`\`firebase
match /player_saves/{userId} {
  function isOwner() {
    return request.auth != null && request.auth.uid == userId;
  }

  function validCloudSave() {
    let doc = request.resource.data;
    return doc.keys().hasOnly([
        'ownerUid', 'schemaVersion', 'seasonId',
        'revision', 'updatedAt', 'save'
      ])
      && doc.keys().hasAll([
        'ownerUid', 'schemaVersion', 'seasonId',
        'revision', 'updatedAt', 'save'
      ])
      && doc.ownerUid == userId
      && doc.schemaVersion == 1
      && doc.seasonId == 'dynasty-ii'
      && doc.revision is int
      && doc.revision >= 1
      && doc.updatedAt == request.time
      && doc.save is map
      && doc.save.schemaVersion == 2
      && doc.save.seasonId == 'dynasty-ii';
  }

  allow get: if isOwner();
  allow list, delete: if false;
  allow create: if isOwner() && validCloudSave()
                && request.resource.data.revision == 1;
  allow update: if isOwner() && validCloudSave()
                && request.resource.data.revision == resource.data.revision + 1
                && request.resource.data.ownerUid == resource.data.ownerUid;
}
\`\`\`

Go to [Firebase Console → Firestore Database → Rules](https://console.firebase.google.com/project/game-leaderboard-17478/firestore/rules), add the match block, **Publish**, and test using the Firestore Rules Playground or Emulator:

- Owner (authenticated UID == document ID) can \`get\` its document.
- A different authenticated UID cannot read or write the first user's document.
- Anonymous clients without the corresponding UID cannot read other saves.
- The owner can \`create\` a valid revision-1 save.
- Revision-2 \`update\` is allowed only after revision 1, with the same UID, correct schema, and server timestamp.
- Client \`list\` and \`delete\` are denied.
- Existing \`scores\`, \`scores_dynasty_ii\`, \`message\`, and \`balance_telemetry_v1\` access remains as intended. The \`balanceAdmin\` claim must still be enforced server-side for admin-only telemetry reads.

This rule is **account ownership protection, not anti-cheat**. A signed-in player controls browser-side stats and could submit a modified game save. Trusted server validation is a separate future feature.

## Safe cloud-sync procedure

1. **Sign in.** The game keeps playing locally. Nothing uploads or downloads automatically.
2. Click **Check Cloud Save**. This performs a fresh server read of \`player_saves/{yourUid}\` and displays cloud progress if available. If permission is denied, your local save stays intact; verify the published rules.
3. Click **Back Up Local Save**. The local save is captured and uploaded. If a cloud save exists, **both progress summaries** are shown and an explicit confirmation is required to replace it. A Firestore transaction rejects a remote revision that changed between the check and the upload (use Check Cloud Save and decide again).
4. On a second device, **Sign In → Check Cloud Save → Restore Cloud Save**. The game checks the Season II save format and prompts before replacing current local progress. It first stores the old local save at \`clickerHeroSave_before_cloud_restore\` in that device's local storage; if the backup fails, the restore does not proceed. The page reloads only after saving the new data locally.
5. **Sign Out** does not delete local progress or cloud data. Local play and the existing Export Save remain available.

### Recovery

Game Config → Export Save can create a portable \`.chs\` backup at any time. After a cloud restore, the *previous* local save is also stored under \`clickerHeroSave_before_cloud_restore\`; do not clear browser storage if recovery may be needed. The restore backup is kept locally, not uploaded. Game Config displays **Export Pre-Restore Recovery Save** when the recovery slot exists; it downloads a compatible `.chs` file that can be loaded with **Import Save**. A subsequent cloud restore will replace the one-slot local recovery copy, so export important backups first.

**Current rollout supports guarded, opt-in automatic cloud backups, but not automatic restore or save merging.** Cloud deletion and a full account management dashboard are not yet provided. See v1.9.0 below.

## Compatibility and limitations

- Uses the existing Season II save payload and \`GAME_SCHEMA_VERSION=2\`, with a separate cloud wrapper \`schemaVersion=1\`.
- The game caps cloud-bound save JSON size and Firebase separately enforces its Firestore document size limit; unusually large/corrupt saves are rejected rather than truncated.
- The new collection is \`player_saves\`, keyed by Firebase Auth UID. It is **not** the historical leaderboard collection.
- Google popup may be blocked by embedded browsers. Email/Password remains available, and the Google provider must be enabled by the project administrator.
- This change does **not** migrate name-based leaderboard entries or secure score authority. Do not delete the existing score collections. Binding names to UIDs and validating scores server-side are separate follow-up migrations.
- Never put a Firebase service-account private key, password, or bearer token into GitHub Pages/Netlify source. The Firebase web config is a public client identifier; Firestore Rules are the security boundary.

**Google account linking note:** Use Sign In With Google for any existing Google login, even if an anonymous telemetry session is active. The separate Link Guest button attempts to retain the anonymous UID when attaching a *new* Google account. If that Google account already exists, choose the normal sign-in button instead; the game will not merge unrelated Firebase accounts automatically.

## v1.9.0 — Enable optional automatic cloud backup

After setting up the owner-only `player_saves` rules and signing in:

1. Perform **Back Up Local Save** or **Restore Cloud Save** once on the device. This binds the device to the latest known cloud revision for that signed-in UID.
2. Enable **Automatic cloud backup (opt-in)**. The game verifies that the live cloud revision still matches before enabling. Unregistered guests and first-time accounts with no confirmed revision cannot enable automatic backup.
3. While the tab is visible, the game checks every five minutes, and uploads if the meaningful saved content changed. Foreground/gameplay timestamps alone are ignored. No automatic restore occurs.
4. If a different device has updated the cloud, automatic backup pauses, protecting **both** versions. Click Check Cloud Save, review the stage/Dynasty information, then explicitly choose Back Up Local Save or Restore Cloud Save.
5. Sign-out and account switching disable automatic uploads; enable them again only when the correct player is signed in. Manual restore disables auto backup and creates a local recovery copy first.

**Cloud synchronization is deliberately conservative.** It does not merge two divergent saves or make scores authoritative. Future authenticated leaderboard integration needs separate schema/rules changes.

## v1.10.0 — Connected Accounts leaderboard

The new optional account leaderboard is **separate** from both \`scores_dynasty_ii\` and legacy \`scores\`. It uses \`scores_accounts_dynasty_ii/{Firebase Auth UID}\`. Players must sign in with Email/Password or Google and explicitly publish a current Season II score. Names are non-unique public labels, never ownership identifiers. Authentication prevents writing someone else's UID entry; it does **not** prove that the client's score is genuine.

**Merge this additional block only** inside your existing \`match /databases/{database}/documents {\` Firestore Rules scope. Do not remove \`player_saves\`, \`balance_telemetry_v1\`, legacy leaderboards, message board, or your \`balanceAdmin\` checks. No matching wildcard rule may grant broad writes to this collection.

\`\`\`firebase
match /scores_accounts_dynasty_ii/{userId} {
  function signedInAccount() {
    return request.auth != null
      && request.auth.uid == userId
      && request.auth.token.firebase.sign_in_provider != 'anonymous';
  }

  function validRanking() {
    let value = request.resource.data;
    return value.keys().hasOnly([
        'ownerUid', 'schemaVersion', 'seasonId',
        'name', 'score', 'timestamp'
      ])
      && value.keys().hasAll([
        'ownerUid', 'schemaVersion', 'seasonId',
        'name', 'score', 'timestamp'
      ])
      && value.ownerUid == userId
      && value.schemaVersion == 1
      && value.seasonId == 'dynasty-ii'
      && value.name is string
      && value.name.matches('^[A-Za-z0-9 _.-]{1,20}$')
      && value.name != ''
      && value.name != ' '
      && value.score is int
      && value.score >= 1
      && value.score <= 1000000000000
      && value.timestamp == request.time;
  }

  allow get: if true;
  allow list: if request.query.limit <= 50;
  allow create: if signedInAccount() && validRanking();
  allow update: if signedInAccount() && validRanking()
                && resource.data.ownerUid == userId
                && request.resource.data.score >= resource.data.score;
  allow delete: if false;
}
\`\`\`

The interface publishes records through a Firestore transaction: it reads its own UID document, chooses the maximum of local and existing score, and writes an updated timestamp. The rules deny attempts to change an entry's UID, decrease its score, publish an invalid name, delete an entry, or write from an anonymous user. Public top-50 reads are allowed, so guests can browse the account rankings without creating an account.

**Publish and test Rules in Firebase Console → Firestore Database → Rules** before expecting account score submissions to work. Test reading top 50 anonymously, creating as an authenticated UID, inability of a different UID to update the same document, rejection of anonymous writes, decreasing-score rejection, and preservation of the existing \`balanceAdmin\` telemetry checks. The new client feature never deploys rules automatically.

Current name-based score collections remain readable and unchanged. **Do not delete or migrate them automatically.** Two people can have the same new account leaderboard display name. Existing older name-based records cannot be securely attributed to a Firebase UID using a matching text name alone.

### Security limitation

These are **account-owned rankings**, *not anti-cheat-validated rankings*. A user who owns an account can still manipulate the score reported by their browser. A trusted server must eventually calculate or validate milestones before treating submitted scores as authoritative. There is no automatic cloud-save restore, account migration, or historical score ownership claim in this release.

## v1.10.1 — Moving progress between two devices

The game checks for a cloud save when an account signs in, when the tab resumes and periodically while visible. If a save from another device is available, a banner opens a comparison in Game Config. **Restoring is an explicit choice**, never automatic.

To transfer PC progress to phone for the first time:
1. On PC, sign in with Google → Game Config → **Back Up Local Save**. Confirm that the cloud save was written and has a revision number.
2. On phone, sign into the **same Firebase UID** (the short Account ID suffix shown on both devices should match). A cloud-save banner appears after a successful read. Choose **Compare / Restore** and review the PC stage/Dynasty against the phone stage/Dynasty; select **Restore Cloud Save**, confirm, and allow the game to reload.
3. To keep uploading PC progress, enable **Automatic cloud backup** on PC *after* its manual upload. On phone, reopening/returning to the app checks for a later revision and prompts to review/restore it.
4. Do not enable automatic backups on both devices simultaneously while actively playing different runs. The revision guard will pause uploads when the second device changes cloud progress.

If no cloud save appears, inspect **Cloud check failed** or **No cloud backup** in Game Config. Verify that the `player_saves/{uid}` rules are published and that both clients are signed into the same Firebase account. Local saves and Export Save are unaffected by cloud errors.

## v1.10.2 — restore overwrite fix

When using **Restore Cloud Save** on a phone, the old game's page-exit autosave no longer writes stale phone progress over the newly downloaded PC save. A temporary, in-memory navigation guard protects the restored `clickerHeroSave` until the new page starts. The guard clears on the new load, and normal autosaving resumes. This changes no Firebase collection, rule, or document format.
