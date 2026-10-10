// v1.11.0 — opportunistic server-backed device session.
// Cloud Functions are not present until the project owner deploys them.
// Unconfigured projects retain existing local-first play (NOT secure ranked mode).
const SESSION_TOKEN_PREFIX="hotc_session_secret_";
const SESSION_ENFORCED_PREFIX="hotc_session_enforced_v1_";
const SESSION_PING_MS=45000;
let sessionGuardPhase="unconfigured"; // active, occupied, review, lost, checking, unconfigured
let sessionGuardUid=null;
let sessionGuardEpoch=0;
let sessionGuardGeneration=0;
let sessionGuardBusy=false;
let sessionGuardLastPing=0;
let sessionGuardDetail="";
let sessionGuardEverActive=false;
function sessionGuardToken(uid) {
    if(!uid||typeof sessionStorage==="undefined")throw Error("Session storage unavailable.");
    const key=SESSION_TOKEN_PREFIX+uid;
    let token=sessionStorage.getItem(key);
    if(!/^[0-9a-f]{64}$/.test(token||"")){
        const bytes=new Uint8Array(32);
        if(!window.crypto?.getRandomValues)throw Error("Secure random tokens unavailable.");
        window.crypto.getRandomValues(bytes);
        token=Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("");
        sessionStorage.setItem(key,token);
    }
    return token;
}
function sessionGuardCurrentUid(){
    const user=typeof accountAuth==="function"?accountAuth()?.currentUser:null;
    return user&&!user.isAnonymous?user.uid:null;
}
function sessionGuardUsesServer(){
    const uid=sessionGuardCurrentUid();
    return Boolean(uid&&sessionGuardUid===uid&&
        (sessionGuardEverActive || localStorage.getItem(SESSION_ENFORCED_PREFIX+uid)==="1"));
}
function sessionGuardWritesBlocked(){
    // Explicit manual backup from "review" is permitted after its overwrite
    // confirmation. Automatic backups still require strictly active phase.
    return ["occupied","lost","checking"].includes(sessionGuardPhase)||
        (sessionGuardUsesServer()&&sessionGuardPhase==="unconfigured");
}
function sessionGuardCanCheckpoint(allowReview=false){
    return sessionGuardUsesServer()&&
        (sessionGuardPhase==="active"||(allowReview&&sessionGuardPhase==="review"));
}
function sessionGuardCall(name,data){
    if(typeof firebase.functions!=="function")
        throw Object.assign(Error("Firebase Functions client is not loaded."),{code:"functions/not-found"});
    return firebase.app().functions("us-central1").httpsCallable(name)(data)
        .then(result=>result.data);
}
function sessionGuardNotice(text,warning=false){
    sessionGuardDetail=text;
    const status=document.getElementById("account-session-status");
    if(status){
        status.textContent=text;
        status.classList.toggle("session-warning",warning);
    }
    const take=document.getElementById("account-session-claim");
    if(take){
        take.hidden=!sessionGuardCurrentUid()||
            !["occupied","lost","unconfigured"].includes(sessionGuardPhase);
        take.textContent=sessionGuardPhase==="occupied"?
            "Use This Device (Take Over)":"Retry / Claim Session";
    }
}
function sessionGuardBlocksGameplay(){
    return ["occupied","lost","review"].includes(sessionGuardPhase);
}
function sessionGuardPauseGameplay(paused){
    // This is the honest-client UX. Server rejects stale tokens regardless of UI.
    for(const id of ["hero-view","kingdom-view","army-view"]){
        const node=document.getElementById(id);
        if(node)node.inert=paused;
    }
    if(paused){
        if(typeof stopSquadAttack==="function")stopSquadAttack();
        if(typeof pauseBossClock==="function")pauseBossClock();
    }else if(!document.hidden && typeof startSquadAttack==="function"){
        if(typeof resumeBossClock==="function")resumeBossClock();
        startSquadAttack();
    }
}
function sessionGuardSet(phase,message){
    sessionGuardPhase=phase;
    sessionGuardNotice(message,["occupied","lost","review"].includes(phase));
    sessionGuardPauseGameplay(["occupied","lost","review"].includes(phase));
    if(typeof accountControlsUpdate==="function")accountControlsUpdate();
}
function sessionGuardFriendlyError(error){
    const code=String(error?.code||"");
    if(code.includes("not-found")||code.includes("unimplemented"))return "Session service not deployed. Local play remains available, but competitive device-lock protection is not active.";
    if(code.includes("unauthenticated"))return "Session requires a registered Firebase login.";
    if(code.includes("failed-precondition"))return "Session belongs to another device. Take over to resume cloud saves.";
    if(code.includes("aborted"))return "Cloud save changed on another device. Review it before writing.";
    if(code.includes("unavailable")||code.includes("deadline-exceeded"))return "Session server unavailable. Local progress remains saved on this device.";
    return String(error?.message||"Session check failed.").slice(0,180);
}
function sessionGuardDeviceLabel(){
    return (typeof navigator!=="undefined" &&
        (navigator.userAgentData?.mobile||/Android|iPhone|Mobile/i.test(navigator.userAgent||"")))?
        "Phone / tablet":"Desktop / laptop";
}
async function sessionGuardAfterClaim(uid,generation){
    if(uid!==sessionGuardCurrentUid()||generation!==sessionGuardGeneration)return;
    try{
        const snapshot=await accountCloudRef({uid}).get({source:"server"});
        if(uid!==sessionGuardCurrentUid()||generation!==sessionGuardGeneration)return;
        const record=snapshot.exists?snapshot.data():null;
        if(record && accountCloudRecordValid(record,{uid})){
            const anchor=playerSyncAnchor(uid);
            const local=inspectSeasonSave(localStorage.getItem("clickerHeroSave"));
            // A device must review when revision OR actual local progress
            // differs. This also catches unuploaded local changes.
            if(!anchor||anchor.revision!==record.revision||
                playerSyncFingerprint(local)!==playerSyncFingerprint(record.save)){
                sessionGuardSet("review","Session acquired. Review/restore the latest cloud save before playing or uploading. This device's local progress is safe.");
                if(typeof playerCloudUpdateNotice==="function")playerCloudUpdateNotice(record);
                return;
            }
        }
        sessionGuardSet("active","This device owns the active server lease. Cloud checkpoints are session-protected (ranked scores remain unverified).");
    }catch(error){
        // Do not allow checkpoints until the baseline revision can be read.
        sessionGuardSet("review","Session acquired, but latest cloud save could not be checked: "+
            sessionGuardFriendlyError(error)+". Check Cloud Save before continuing.");
    }
}
async function sessionGuardClaim(takeover=false){
    if(sessionGuardBusy)return false;
    const uid=sessionGuardCurrentUid();
    if(!uid)return false;
    const generation=++sessionGuardGeneration;
    sessionGuardBusy=true;
    sessionGuardPhase="checking";
    sessionGuardNotice("Checking whether another device owns this account...");
    try{
        const result=await sessionGuardCall("claimPlayerSession",{
            token:sessionGuardToken(uid),
            label:sessionGuardDeviceLabel(),takeover
        });
        if(generation!==sessionGuardGeneration||uid!==sessionGuardCurrentUid())return false;
        if(result.status==="occupied"){
            sessionGuardSet("occupied","Account in use on "+(result.deviceLabel||"another device")+
                ". Choose Use This Device to take over. Unsaved progress on the other device may be lost.");
            return false;
        }
        if(result.status!=="active")throw Error("Unrecognized session response.");
        sessionGuardEverActive=true;
        localStorage.setItem(SESSION_ENFORCED_PREFIX+uid,"1");
        sessionGuardEpoch=result.epoch;
        sessionGuardLastPing=Date.now();
        if(typeof playerSyncPause==="function")playerSyncPause();
        await sessionGuardAfterClaim(uid,generation);
        return sessionGuardPhase==="active";
    }catch(error){
        if(generation!==sessionGuardGeneration)return false;
        if(!sessionGuardUsesServer() &&
            /not-found|unimplemented|unavailable|deadline-exceeded|internal/.test(error?.code||"")){
            sessionGuardSet("unconfigured",sessionGuardFriendlyError(error));
        }else{
            sessionGuardSet("lost",sessionGuardFriendlyError(error)+
                " Cloud/ranked writes are paused; no progress was erased.");
        }
        return false;
    }finally{
        sessionGuardBusy=false;
    }
}
async function sessionGuardTakeover(){
    if(!sessionGuardCurrentUid())return false;
    if(sessionGuardPhase!=="occupied")return sessionGuardClaim(false);
    if(!confirm("Take over this account on this device?\n\nThe other device will lose its server session. Unsaved progress there will not be merged. You must review the cloud save before proceeding."))return false;
    return sessionGuardClaim(true);
}
async function sessionGuardPing(){
    if(sessionGuardBusy||sessionGuardPhase!=="active"||document.hidden)return false;
    if(Date.now()-sessionGuardLastPing<SESSION_PING_MS-3000)return true;
    const uid=sessionGuardCurrentUid();
    if(!uid||uid!==sessionGuardUid)return false;
    sessionGuardBusy=true;
    try{
        const response=await sessionGuardCall("pingPlayerSession",{token:sessionGuardToken(uid)});
        if(uid!==sessionGuardCurrentUid())return false;
        if(response.status!=="active"){
            if(typeof playerSyncPause==="function")playerSyncPause();
            sessionGuardSet("lost","Another device took over or your lease expired. Local progress is safe; take over here to resume.");
            return false;
        }
        sessionGuardLastPing=Date.now();
        return true;
    }catch(error){
        if(uid===sessionGuardCurrentUid()){
            if(typeof playerSyncPause==="function")playerSyncPause();
            sessionGuardSet("lost",sessionGuardFriendlyError(error)+
                " Cloud checkpoints are paused to prevent stale writes.");
        }
        return false;
    }finally{
        sessionGuardBusy=false;
    }
}
async function sessionGuardCheckpoint(save,expectedRevision,allowReview=false){
    if(!sessionGuardCanCheckpoint(allowReview))throw Error("Server session is not active on this device.");
    const uid=sessionGuardCurrentUid();
    try{
        const response=await sessionGuardCall("checkpointPlayerSession",{
            token:sessionGuardToken(uid),expectedRevision,save
        });
        if(uid!==sessionGuardCurrentUid())throw Error("Account changed during checkpoint.");
        if(response.status!=="saved")throw Error("Server did not confirm the checkpoint.");
        sessionGuardLastPing=Date.now();
        if(sessionGuardPhase==="review")sessionGuardSet("active",
            "This device's local save was explicitly chosen. Session checkpoints are active.");
        return response.revision;
    }catch(error){
        if(uid===sessionGuardCurrentUid()){
            if(/failed-precondition/.test(error?.code||"")){
                if(typeof playerSyncPause==="function")playerSyncPause();
                sessionGuardSet("lost","Cloud checkpoint rejected: another device owns this session.");
            }else if(/aborted/.test(error?.code||"")){
                if(typeof playerSyncPause==="function")playerSyncPause();
                sessionGuardSet("review","Cloud revision changed. Review/restore the latest backup before continuing.");
            }
        }
        throw error;
    }
}
async function sessionGuardRelease(){
    const uid=sessionGuardCurrentUid();
    if(!uid||!sessionGuardUsesServer())return;
    try{await sessionGuardCall("releasePlayerSession",{token:sessionGuardToken(uid)})}
    catch(error){console.warn("Session lease expires automatically if release fails.",error)}
    sessionGuardEverActive=false;
}
function sessionGuardAccountChanged(user){
    const uid=user&&!user.isAnonymous?user.uid:null;
    if(uid===sessionGuardUid)return;
    ++sessionGuardGeneration;
    sessionGuardUid=uid;
    sessionGuardEverActive=false;
    sessionGuardLastPing=0;
    if(!uid){
        sessionGuardSet("unconfigured","Sign in to establish a device session.");
        return;
    }
    sessionGuardClaim(false);
}
document.addEventListener("visibilitychange",()=>{
    if(!document.hidden && sessionGuardPhase==="active")sessionGuardPing();
});
setInterval(sessionGuardPing,SESSION_PING_MS);
