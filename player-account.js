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
        if(control) control.disabled=!signedIn||playerAccountCloudBusy;
    }
    const actions=document.getElementById("player-cloud-controls");
    if(actions) actions.hidden=!signedIn;
    const recovery=document.getElementById("player-cloud-export-recovery");
    if(recovery)recovery.hidden=!localStorage.getItem(PLAYER_CLOUD_BACKUP_KEY);
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
function accountPreviewCloud(data) {
    const panel=document.getElementById("player-cloud-preview");
    if(!panel)return;
    panel.textContent=data&&accountValidSave(data.save) ?
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
    if(playerAccountCloudBusy)return false;
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
    if(playerAccountCloudBusy)return false;
    playerAccountCloudBusy=true;
    accountControlsUpdate();
    try {
        const user=accountCurrentUser();
        saveGame();
        const save=inspectSeasonSave(localStorage.getItem("clickerHeroSave"));
        if(!accountValidSave(save)) throw new Error("Local save is incompatible or too large for a cloud backup.");
        const previous=await accountReadCloud();
        if(previous&&!accountValidSave(previous.save))
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
    if(playerAccountCloudBusy)return false;
    playerAccountCloudBusy=true;
    accountControlsUpdate();
    try {
        const user=accountCurrentUser();
        const record=await accountReadCloud();
        if(!record) {
            accountCloudMessage("No cloud save found. This device's progress is unchanged.");
            return false;
        }
        if(!accountValidSave(record.save)) throw new Error("Cloud save is invalid or belongs to another season.");
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
