# Heroes of the Click — Optional Player Accounts & Cloud Saves

Release: v1.8.0 · Firebase project: \`game-leaderboard-17478\`

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

**Current rollout intentionally has no background synchronization, conflict merging, cross-device automatic switching, cloud deletion, or account management dashboard.** This prevents a new feature from silently destroying saves. Automatic sync can be added once the owner rules and two-device behavior have been exercised.

## Compatibility and limitations

- Uses the existing Season II save payload and \`GAME_SCHEMA_VERSION=2\`, with a separate cloud wrapper \`schemaVersion=1\`.
- The game caps cloud-bound save JSON size and Firebase separately enforces its Firestore document size limit; unusually large/corrupt saves are rejected rather than truncated.
- The new collection is \`player_saves\`, keyed by Firebase Auth UID. It is **not** the historical leaderboard collection.
- Google popup may be blocked by embedded browsers. Email/Password remains available, and the Google provider must be enabled by the project administrator.
- This change does **not** migrate name-based leaderboard entries or secure score authority. Do not delete the existing score collections. Binding names to UIDs and validating scores server-side are separate follow-up migrations.
- Never put a Firebase service-account private key, password, or bearer token into GitHub Pages/Netlify source. The Firebase web config is a public client identifier; Firestore Rules are the security boundary.

**Google account linking note:** Use Sign In With Google for any existing Google login, even if an anonymous telemetry session is active. The separate Link Guest button attempts to retain the anonymous UID when attaching a *new* Google account. If that Google account already exists, choose the normal sign-in button instead; the game will not merge unrelated Firebase accounts automatically.
