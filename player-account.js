// Optional Firebase player accounts and explicitly initiated cloud backups.
// Gameplay remains local-first. Nothing uploads unless a signed-in player asks.
const PLAYER_SAVE_COLLECTION = "player_saves";
const PLAYER_CLOUD_BACKUP_KEY = "clickerHeroSave_before_cloud_restore";
const PLAYER_CLOUD_MAX_CHARS = 600000;
let playerAccountBusy = false;
let playerAccountCloudBusy = false;
let playerAccountUser = null;
let playerCloudPreview = null;
let playerAccountPreviousUid = null;

function accountAuth() {
    return typeof firebase.auth === "function" ? firebase.auth() : null;
}
function playerAccountIsRegistered(user) {
    return Boolean(user && !user.isAnonymous);
}
function accountDisplayMessage(message, isError = false) {
    const target = document.getElementById("player-account-status");
    if (!target) return;
    target.textContent = message;
    target.classList.toggle("account-error", isError);
}
function accountCloudMessage(message, isError = false) {
    const target = document.getElementById("player-cloud-status");
    if (!target) return;
    target.textContent = message;
    target.classList.toggle("account-error", isError);
}
function accountErrorMessage(error) {
    const code = error && error.code || "";
    if (code === "auth/operation-not-allowed") return "This sign-in provider is not enabled in Firebase Authentication.";
    if (code === "auth/popup-blocked" || code === "auth/cancelled-popup-request")
        return "Sign-in popup was blocked or cancelled. Try again from the account panel.";
    if (code === "auth/popup-closed-by-user") return "Google sign-in was cancelled.";
    if (code === "auth/unauthorized-domain") return "Add this site's domain to Firebase Authentication authorized domains.";
    if (code === "auth/email-already-in-use" || code === "auth/credential-already-in-use")
        return "That email is already registered. Choose Sign In rather than Create Account.";
    if (code === "auth/wrong-password" || code === "auth/user-not-found" ||
        code === "auth/invalid-credential" || code === "auth/invalid-login-credentials")
        return "The email or password was not accepted.";
    if (code === "auth/weak-password") return "Choose a stronger password (at least six characters).";
    if (code === "permission-denied") return "Cloud saves are not yet authorized by Firestore rules. Your local game is safe.";
    if (code === "unavailable" || code === "auth/network-request-failed")
        return "Firebase is unreachable. Your local game remains available.";
    return error && error.message ? String(error.message).slice(0,180) : "An unexpected error occurred.";
}
function accountControlsUpdate() {
    const auth = accountAuth();
    const user = auth ? auth.currentUser : null;
    playerAccountUser = playerAccountIsRegistered(user) ? user : null;
    const signedIn = Boolean(playerAccountUser);
    const fields = document.getElementById("player-account-fields");
    const authenticated = document.getElementById("player-account-authenticated");
    if (fields) fields.hidden = signedIn;
    if (authenticated) authenticated.hidden = !signedIn;
    const identity = document.getElementById("player-account-identity");
    if (identity) identity.textContent = signedIn ?
        (playerAccountUser.email || "Google account") : "";
    const buttons = ["player-account-create","player-account-login",
        "player-account-google","player-account-google-link","player-account-logout"];
    for (const id of buttons) {
        const control=document.getElementById(id);
        if(control) control.disabled=playerAccountBusy;
    }
    for(const id of ["player-cloud-check","player-cloud-upload","player-cloud-restore"]) {
        const control=document.getElementById(id);
        if(control) control.disabled=!signedIn||playerAccountCloudBusy||playerSyncInFlight;
    }
    const actions=document.getElementById("player-cloud-controls");
    if(actions) actions.hidden=!signedIn;
    const recovery=document.getElementById("player-cloud-export-recovery");
    if(recovery)recovery.hidden=!localStorage.getItem(PLAYER_CLOUD_BACKUP_KEY);
    if(typeof playerSyncControlsUpdate==="function")playerSyncControlsUpdate();
    if(!signedIn) {
        playerCloudPreview=null;
        accountCloudMessage("Local saves work without an account. Cloud backups require signing in and owner-only Firestore rules.");
    }
}
function accountValidSave(value) {
    if (!isCurrentSeasonSave(value) ||
        !Object.prototype.hasOwnProperty.call(value,"gold") ||
        !Object.prototype.hasOwnProperty.call(value,"playerLevel") ||
        !Object.prototype.hasOwnProperty.call(value,"maxLevel") ||
        !Number.isFinite(Number(value.gold)) ||
        !Number.isFinite(Number(value.playerLevel)) ||
        !Number.isFinite(Number(value.maxLevel))) return false;
    try {
        return JSON.stringify(value).length <= PLAYER_CLOUD_MAX_CHARS;
    } catch (_) { return false; }
}
function accountSaveSummary(value) {
    if (!accountValidSave(value)) return "Invalid or incompatible Season II save.";
    const top = Math.max(1,Math.floor(Number(value.bestSeasonStage)||0),
        Math.floor(Number(value.maxLevel)||1));
    const dynasty=Math.max(0,Math.floor(Number(value.dynastyCount)||0));
    const saved=Number(value.lastSaved);
    const date=Number.isFinite(saved)&&saved>0 ?
        new Date(saved).toLocaleString() : "unknown date";
    return "Highest stage "+top.toLocaleString()+" · Dynasty "+dynasty+
        " · "+date+" · "+(value.playerName||"Unnamed Hero");
}
function accountCloudRef(user) {
    return db.collection(PLAYER_SAVE_COLLECTION).doc(user.uid);
}
function accountCurrentUser() {
    const auth = accountAuth();
    const user = auth && auth.currentUser;
    if(!playerAccountIsRegistered(user)) throw new Error("Sign into a player account first.");
    return user;
}
function accountCloudDocument(user, save, revision) {
    return {
        ownerUid:user.uid,
        schemaVersion:1,
        seasonId:GAME_SEASON_ID,
        revision,
        updatedAt:firebase.firestore.FieldValue.serverTimestamp(),
        save
    };
}
function accountCloudRecordValid(data,user) {
    return Boolean(data&&user&&data.ownerUid===user.uid&&
        data.schemaVersion===1&&data.seasonId===GAME_SEASON_ID&&
        Number.isSafeInteger(data.revision)&&data.revision>=1&&
        accountValidSave(data.save));
}
function accountPreviewCloud(data) {
    const panel=document.getElementById("player-cloud-preview");
    if(!panel)return;
    panel.textContent=accountCloudRecordValid(data,accountAuth()?.currentUser) ?
        "Cloud: "+accountSaveSummary(data.save)+" · Revision "+data.revision :
        (data ? "Cloud: unsupported or malformed save (cannot restore)." :
            "Cloud: no backup found. Your local progress is unchanged.");
}
async function accountReadCloud() {
    const user=accountCurrentUser();
    const snapshot=await accountCloudRef(user).get({source:"server"});
    if(accountCurrentUser().uid!==user.uid)
        throw new Error("Account changed during cloud lookup. Nothing was modified.");
    const data=snapshot.exists?snapshot.data():null;
    playerCloudPreview=data;
    accountPreviewCloud(data);
    return data;
}
async function playerCheckCloudSave() {
    if(playerAccountCloudBusy||playerSyncInFlight)return false;
    playerAccountCloudBusy=true;
    accountControlsUpdate();
    accountCloudMessage("Checking your private cloud save...");
    try {
        const data=await accountReadCloud();
        accountCloudMessage(data?"Cloud save found. Choose backup or restore explicitly.":
            "No cloud save yet. Use Backup Local Save to create one.");
        return true;
    }catch(error) {
        accountCloudMessage(accountErrorMessage(error),true);
        return false;
    }finally {
        playerAccountCloudBusy=false;
        accountControlsUpdate();
    }
}
// Every overwrite is explicit. The transaction rejects a remote revision that
// changed after the player examined it, avoiding races between two devices.
async function playerBackupCloudSave() {
    if(playerAccountCloudBusy||playerSyncInFlight)return false;
    playerAccountCloudBusy=true;
    accountControlsUpdate();
    try {
        const user=accountCurrentUser();
        saveGame();
        const save=inspectSeasonSave(localStorage.getItem("clickerHeroSave"));
        if(!accountValidSave(save)) throw new Error("Local save is incompatible or too large for a cloud backup.");
        const previous=await accountReadCloud();
        if(previous&&!accountCloudRecordValid(previous,user))
            throw new Error("Existing cloud save is not compatible. Refusing to overwrite it.");
        if(previous&&!confirm("Replace the cloud save with THIS device's local progress?\n\n"+
            "Local: "+accountSaveSummary(save)+"\nCloud: "+accountSaveSummary(previous.save)+
            "\n\nThis does not delete your local save.")) {
            accountCloudMessage("Cloud backup cancelled. Nothing was overwritten.");
            return false;
        }
        accountCloudMessage("Uploading your requested backup...");
        const expected=previous?Number(previous.revision):0;
        if(!Number.isSafeInteger(expected)||expected<0)
            throw new Error("Cloud revision is invalid; refusing overwrite.");
        const ref=accountCloudRef(user);
        await db.runTransaction(async transaction=>{
            const existing=await transaction.get(ref);
            const actual=existing.exists?Number(existing.data().revision):0;
            if(actual!==expected)
                throw new Error("Cloud save changed on another device. Check the cloud save again before choosing a version.");
            if(accountCurrentUser().uid!==user.uid)
                throw new Error("Account changed during backup.");
            transaction.set(ref,accountCloudDocument(user,save,expected+1));
        });
        playerCloudPreview=accountCloudDocument(user,save,expected+1);
        accountPreviewCloud(playerCloudPreview);
        playerSyncSetAnchor(user.uid,expected+1,save);
        accountCloudMessage("Cloud backup saved (revision "+(expected+1)+"). This device's save is unchanged.");
        return true;
    }catch(error){
        accountCloudMessage(accountErrorMessage(error),true);
        return false;
    }finally {
        playerAccountCloudBusy=false;
        accountControlsUpdate();
    }
}
async function playerRestoreCloudSave() {
    if(playerAccountCloudBusy||playerSyncInFlight)return false;
    playerAccountCloudBusy=true;
    accountControlsUpdate();
    try {
        const user=accountCurrentUser();
        const record=await accountReadCloud();
        if(!record) {
            accountCloudMessage("No cloud save found. This device's progress is unchanged.");
            return false;
        }
        if(!accountCloudRecordValid(record,user)) throw new Error("Cloud save is invalid or belongs to another season or account.");
        const cloudText=JSON.stringify(record.save);
        const prior=localStorage.getItem("clickerHeroSave");
        const local=inspectSeasonSave(prior);
        if(!confirm("REPLACE this device's current Season II progress with the cloud save?\n\n"+
            "On this device: "+accountSaveSummary(local)+"\nCloud: "+accountSaveSummary(record.save)+
            "\n\nA local recovery copy will be saved first. This cannot be automatically merged.")) {
            accountCloudMessage("Cloud restore cancelled. Your local game is unchanged.");
            return false;
        }
        if(accountCurrentUser().uid!==user.uid)
            throw new Error("Account changed during restore.");
        // Both storage operations may fail (private mode/quota). Never destroy
        // the original before its recovery copy has been written successfully.
        if(prior) localStorage.setItem(PLAYER_CLOUD_BACKUP_KEY,prior);
        localStorage.setItem("clickerHeroSave",cloudText);
        playerSyncSetAnchor(user.uid,Number(record.revision),record.save);
        // Restore is manual; never silently opt into future uploads.
        playerSyncPause();
        accountCloudMessage("Cloud save restored. Reloading the game...");
        window.location.reload();
        return true;
    }catch(error) {
        accountCloudMessage(accountErrorMessage(error),true);
        return false;
    }finally {
        playerAccountCloudBusy=false;
        accountControlsUpdate();
    }
}

// Optional guarded automatic CLOUD BACKUP (never an automatic cloud restore).
// Opt-in is per Firebase UID and may only begin from a manual backup/restore
// revision. A changed remote revision permanently pauses until manual review.
const PLAYER_SYNC_ENABLED_UID_KEY="hotc_auto_cloud_uid_v1";
const PLAYER_SYNC_ANCHOR_PREFIX="hotc_cloud_anchor_v1_";
const PLAYER_SYNC_CHECK_MS=300000;
let playerSyncLastCheck=0;
let playerSyncInFlight=false;
function playerSyncUid(){
    const auth=accountAuth();
    const user=auth&&auth.currentUser;
    return playerAccountIsRegistered(user)?user.uid:null;
}
function playerSyncEnabled(){
    const uid=playerSyncUid();
    return Boolean(uid&&localStorage.getItem(PLAYER_SYNC_ENABLED_UID_KEY)===uid);
}
function playerSyncAnchor(uid){
    if(!uid)return null;
    const raw=localStorage.getItem(PLAYER_SYNC_ANCHOR_PREFIX+uid);
    if(!raw)return null;
    try{
        const entry=JSON.parse(raw);
        return Number.isSafeInteger(entry.revision)&&entry.revision>0 &&
            typeof entry.fingerprint==="string" && /^\d+:[0-9a-f]+:[0-9a-f]+$/.test(entry.fingerprint)?
            entry:null;
    }catch(_){return null}
}
function playerSyncFingerprint(save){
    if(!accountValidSave(save))return null;
    // Ignore heartbeat / leaderboard write bookkeeping. 64 bits of
    // non-cryptographic checksums plus length are only for deduplication;
    // owner-only Firestore rules and revision checks enforce safety.
    const normalized={...save};
    delete normalized.lastSaved;
    delete normalized.lastSubmittedScore;
    const str=JSON.stringify(normalized);
    let hash1=2166136261,hash2=2246822519;
    for(let i=0;i<str.length;i++){
        const c=str.charCodeAt(i);
        hash1=Math.imul(hash1^c,16777619);
        hash2=Math.imul(hash2+c,1597334677)^hash2>>>7;
    }
    return str.length+":"+(hash1>>>0).toString(16)+":"+(hash2>>>0).toString(16);
}
function playerSyncSetAnchor(uid,revision,save){
    const fingerprint=playerSyncFingerprint(save);
    if(!uid||!fingerprint||!Number.isSafeInteger(revision)||revision<1)return false;
    localStorage.setItem(PLAYER_SYNC_ANCHOR_PREFIX+uid,
        JSON.stringify({revision,fingerprint}));
    return true;
}
function playerSyncPause(reason){
    // Pausing is also used by manual imports/sign-out; never erase the
    // revision anchor, so a future explicit backup/restore can relink.
    localStorage.removeItem(PLAYER_SYNC_ENABLED_UID_KEY);
    if(reason)accountCloudMessage(reason,true);
    playerSyncControlsUpdate();
}
function playerSyncControlsUpdate(){
    const uid=playerSyncUid();
    const checkbox=document.getElementById("player-cloud-auto");
    if(checkbox){
        checkbox.checked=playerSyncEnabled();
        checkbox.disabled=!uid||playerAccountBusy||playerAccountCloudBusy||playerSyncInFlight;
    }
    const info=document.getElementById("player-cloud-auto-status");
    if(info)info.textContent=playerSyncEnabled()?
        "On · Backups check every 5 minutes while this tab is active. "+
        "Cloud restores remain manual.":
        "Off · First perform a manual cloud backup or restore, then opt in.";
}
async function playerSetAutoCloudSync(enabled){
    if(!enabled){
        playerSyncPause();
        accountCloudMessage("Automatic cloud backup turned off. Local and cloud saves are intact.");
        return true;
    }
    if(playerAccountCloudBusy||playerSyncInFlight)return false;
    playerAccountCloudBusy=true;
    accountControlsUpdate();
    try{
        const user=accountCurrentUser();
        const anchor=playerSyncAnchor(user.uid);
        const local=inspectSeasonSave(localStorage.getItem("clickerHeroSave"));
        if(!anchor||!playerSyncFingerprint(local))
            throw new Error("To enable automatic backup, first manually back up or restore this device's save.");
        const cloud=await accountReadCloud();
        if(!accountCloudRecordValid(cloud,user)||
            cloud.revision!==anchor.revision)
            throw new Error("Cloud progress differs from this device's last confirmed backup. "+
                "Check both saves and manually back up or restore before enabling automatic backup.");
        if(accountCurrentUser().uid!==user.uid)throw new Error("Account changed.");
        localStorage.setItem(PLAYER_SYNC_ENABLED_UID_KEY,user.uid);
        playerSyncLastCheck=Date.now();
        accountCloudMessage("Automatic backups enabled. Another device's changes will pause uploads, not replace local progress.");
        return true;
    }catch(error){
        playerSyncPause(accountErrorMessage(error));
        return false;
    }finally{
        playerAccountCloudBusy=false;
        accountControlsUpdate();
    }
}
async function playerSyncCloudTick(){
    if(!playerSyncEnabled()||document.hidden||playerAccountBusy||
        playerAccountCloudBusy||playerSyncInFlight)return false;
    const now=Date.now();
    if(now-playerSyncLastCheck<PLAYER_SYNC_CHECK_MS)return false;
    playerSyncLastCheck=now;
    playerSyncInFlight=true;
    accountControlsUpdate();
    try{
        const user=accountCurrentUser();
        const anchor=playerSyncAnchor(user.uid);
        if(!anchor){
            playerSyncPause("Automatic backup paused: no confirmed cloud revision. Back up or restore manually.");
            return false;
        }
        const remote=await accountReadCloud();
        if(!accountCloudRecordValid(remote,user)||
            remote.revision!==anchor.revision){
            playerSyncPause("Another device has changed the cloud save. "+
                "Automatic backup paused. Compare saves, then back up or restore manually.");
            return false;
        }
        const local=inspectSeasonSave(localStorage.getItem("clickerHeroSave"));
        const fingerprint=playerSyncFingerprint(local);
        if(!fingerprint){
            playerSyncPause("Automatic backup paused: local save is invalid. Use Export Save to preserve a copy.");
            return false;
        }
        if(fingerprint===anchor.fingerprint)return false;
        const reference=accountCloudRef(user);
        await db.runTransaction(async transaction=>{
            const current=await transaction.get(reference);
            if(!current.exists||Number(current.data().revision)!==anchor.revision)
                throw new Error("Cloud save changed on another device during backup.");
            const currentSave=inspectSeasonSave(localStorage.getItem("clickerHeroSave"));
            if(playerSyncFingerprint(currentSave)!==fingerprint ||
                accountCurrentUser().uid!==user.uid ||
                document.hidden || !playerSyncEnabled())
                throw new Error("Local save or account changed during backup; upload cancelled.");
            transaction.set(reference,accountCloudDocument(user,local,anchor.revision+1));
        });
        playerSyncSetAnchor(user.uid,anchor.revision+1,local);
        playerCloudPreview=accountCloudDocument(user,local,anchor.revision+1);
        accountPreviewCloud(playerCloudPreview);
        accountCloudMessage("Automatic cloud backup saved · revision "+(anchor.revision+1)+".");
        return true;
    }catch(error){
        const code=error&&error.code;
        if(code==="permission-denied"||/changed on another device|Account changed/.test(error.message||""))
            playerSyncPause("Automatic backup paused: "+accountErrorMessage(error)+
                " Review both versions before restarting.");
        else accountCloudMessage("Automatic backup unavailable; local save is safe. "+
            accountErrorMessage(error),true);
        return false;
    }finally{
        playerSyncInFlight=false;
        accountControlsUpdate();
    }
}
setInterval(playerSyncCloudTick,60000);

async function playerEmailAccount(create) {
    if(playerAccountBusy)return false;
    const auth=accountAuth();
    if(!auth){accountDisplayMessage("Firebase Authentication is unavailable.",true);return false;}
    const email=document.getElementById("player-account-email").value.trim();
    const password=document.getElementById("player-account-password").value;
    if(!email||!password){accountDisplayMessage("Enter your email address and password.",true);return false;}
    playerAccountBusy=true;
    accountControlsUpdate();
    accountDisplayMessage(create?"Creating account...":"Signing in...");
    try{
        if(create&&auth.currentUser&&auth.currentUser.isAnonymous) {
            const credential=firebase.auth.EmailAuthProvider.credential(email,password);
            await auth.currentUser.linkWithCredential(credential);
        }else if(create) await auth.createUserWithEmailAndPassword(email,password);
        else await auth.signInWithEmailAndPassword(email,password);
        document.getElementById("player-account-password").value="";
        accountDisplayMessage("Signed in. Your local progress is still on this device; choose a cloud action below.");
        return true;
    }catch(error){
        accountDisplayMessage(accountErrorMessage(error),true);
        return false;
    }finally{
        playerAccountBusy=false;
        accountControlsUpdate();
    }
}
async function playerGoogleAccount(linkAnonymous=false) {
    if(playerAccountBusy)return false;
    const auth=accountAuth();
    if(!auth){accountDisplayMessage("Firebase Authentication is unavailable.",true);return false;}
    playerAccountBusy=true;accountControlsUpdate();
    accountDisplayMessage("Opening Google sign-in...");
    try{
        const provider=new firebase.auth.GoogleAuthProvider();
        if(linkAnonymous&&auth.currentUser&&auth.currentUser.isAnonymous)
            await auth.currentUser.linkWithPopup(provider);
        else await auth.signInWithPopup(provider);
        accountDisplayMessage("Signed in with Google. Choose a cloud action to move progress.");
        return true;
    }catch(error){
        accountDisplayMessage(accountErrorMessage(error)+
            (error&&error.code==="auth/credential-already-in-use"?
                " Use Sign In With Google for an existing account.":""),
            true);
        return false;
    }finally{
        playerAccountBusy=false;
        accountControlsUpdate();
    }
}
function playerExportCloudRecovery() {
    const raw=localStorage.getItem(PLAYER_CLOUD_BACKUP_KEY);
    if(!raw){
        accountDisplayMessage("No pre-restore recovery save exists on this device.",true);
        return false;
    }
    const save=inspectSeasonSave(raw);
    if(!accountValidSave(save)){
        accountDisplayMessage("Recovery save is incompatible. The original local backup has not been changed.",true);
        return false;
    }
    // Uses the same CHS format as the existing Export Save / Import Save buttons.
    const encoded=btoa(unescape(encodeURIComponent(raw)));
    const blob=new Blob([encoded],{type:"text/plain"});
    const url=URL.createObjectURL(blob);
    const element=document.createElement("a");
    element.href=url;
    element.download="clicker_hero_pre_cloud_restore.chs";
    element.click();
    setTimeout(()=>URL.revokeObjectURL(url),100);
    accountDisplayMessage("Recovery save exported. Use Import Save to load it later.");
    return true;
}
async function playerAccountSignOut(){
    if(playerAccountBusy)return false;
    const auth=accountAuth();
    if(!auth||!playerAccountIsRegistered(auth.currentUser))return false;
    if(!confirm("Sign out of your player account? Local gameplay and the current device save remain. No cloud data will be deleted."))return false;
    playerSyncPause();
    playerAccountBusy=true;accountControlsUpdate();
    try{
        await auth.signOut();
        playerCloudPreview=null;
        accountDisplayMessage("Signed out. You can keep playing as a guest.");
        return true;
    }catch(error){
        accountDisplayMessage(accountErrorMessage(error),true);
        return false;
    }finally{
        playerAccountBusy=false;accountControlsUpdate();
    }
}
function playerAccountInit(){
    const auth=accountAuth();
    if(!auth){
        accountDisplayMessage("Firebase Authentication unavailable. Local play remains enabled.",true);
        return;
    }
    auth.onAuthStateChanged(user=>{
        const linked=playerAccountIsRegistered(user);
        const currentUid=user&&user.uid||null;
        if(currentUid!==playerAccountPreviousUid){
            // Auth user switch disarms any prior account's auto-upload.
            if(playerAccountPreviousUid!==null)
                playerSyncPause();
            playerCloudPreview=null;
            playerAccountPreviousUid=currentUid;
            accountPreviewCloud(null);
        }
        accountControlsUpdate();
        if(!linked)accountDisplayMessage("Guest · Your progress is saved on this device only.");
        else accountDisplayMessage("Connected as "+(user.email||"Google player")+
            ". Cloud saves are optional; use the controls below.");
    },error=>accountDisplayMessage(accountErrorMessage(error),true));
    accountControlsUpdate();
}
document.addEventListener("DOMContentLoaded",playerAccountInit);
