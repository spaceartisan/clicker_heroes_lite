// v1.13.6 — Fewer verified-owner idle reads and four-minute session heartbeats. Coordination, not cheat-proof scoring.
// Uses Firebase Auth + Firestore transactions/rules; no Cloud Functions or billing.
const HANDOFF_COLLECTION="player_sessions";
const HANDOFF_INSTALL_KEY="hotc_install_id_v1";
const HANDOFF_TAB_KEY="hotc_tab_id_v1";
const HANDOFF_ACCOUNT_MARKER="hotc_account_linked_device_v1";
const HANDOFF_PROTECTED_PREFIX="hotc_handoff_protected_v1_";
const HANDOFF_RECOVERY_PREFIX="hotc_handoff_recovery_v1_";
const HANDOFF_EXPORTED_PREFIX="hotc_recovery_exported_v1_";
// Four minutes keeps a second four-minute cushion under the eight-minute lease.
// Foreground resumes still force a fresh ownership check immediately.
const HANDOFF_POLL_MS=240000;
const HANDOFF_LEASE_MS=480000;
let sessionGuardPhase="unconfigured"; // active, occupied, review, lost, checking, unconfigured
let sessionGuardUid=null;
let sessionGuardGeneration=0;
let sessionGuardBusy=false;
let sessionGuardLastPing=0;
let sessionGuardProtected=false;
let sessionGuardUnsubscribe=null;
let sessionGuardLastMessage="";
function sessionGuardRandomHex(){
    if(!window.crypto?.getRandomValues)throw Error("A secure browser is required for device handoff.");
    const bytes=new Uint8Array(16);
    window.crypto.getRandomValues(bytes);
    return Array.from(bytes,x=>x.toString(16).padStart(2,"0")).join("");
}
function sessionGuardDeviceId(){
    let install=localStorage.getItem(HANDOFF_INSTALL_KEY);
    if(!/^[0-9a-f]{32}$/.test(install||"")){
        install=sessionGuardRandomHex();
        localStorage.setItem(HANDOFF_INSTALL_KEY,install);
    }
    let tab=sessionStorage.getItem(HANDOFF_TAB_KEY);
    if(!/^[0-9a-f]{32}$/.test(tab||"")){
        tab=sessionGuardRandomHex();
        sessionStorage.setItem(HANDOFF_TAB_KEY,tab);
    }
    return install+tab;
}
function sessionGuardCurrentUid(){
    const user=typeof accountAuth==="function"?accountAuth()?.currentUser:null;
    return user&&!user.isAnonymous?user.uid:null;
}
function sessionGuardUsesServer(){
    const uid=sessionGuardCurrentUid();
    return Boolean(uid&&uid===sessionGuardUid&&
        (sessionGuardProtected||localStorage.getItem(HANDOFF_PROTECTED_PREFIX+uid)==="1"));
}
function sessionGuardWritesBlocked(){
    return ["occupied","available","handoff","released","lost","checking"].includes(sessionGuardPhase)||
        (sessionGuardUsesServer()&&sessionGuardPhase==="unconfigured");
}
function sessionGuardCanCheckpoint(allowReview=false){
    return sessionGuardUsesServer()&&
        (sessionGuardPhase==="active"||
         (allowReview&&["review","handoff"].includes(sessionGuardPhase)));
}
function sessionGuardBlocksGameplay(){
    // While Firebase Auth is restoring a signed-in user, do not run a
    // protected account's combat before its first lease check begins.
    const uid=sessionGuardCurrentUid();
    return Boolean(uid&&uid!==sessionGuardUid)||
        ["checking","occupied","available","handoff","released","lost","review"].includes(sessionGuardPhase);
}
function sessionGuardDeviceLabel(){
    return (typeof navigator!=="undefined" &&
        (navigator.userAgentData?.mobile||/Android|iPhone|Mobile/i.test(navigator.userAgent||"")))?
        "Phone / tablet":"Computer";
}
function sessionGuardRef(uid){
    return db.collection(HANDOFF_COLLECTION).doc(uid);
}
function sessionGuardTimestamp(){
    return firebase.firestore.FieldValue.serverTimestamp();
}
function sessionGuardLeaseActive(record){
    return record&&!record.released&&record.updatedAt&&
        typeof record.updatedAt.toMillis==="function"&&
        Date.now()-record.updatedAt.toMillis()<HANDOFF_LEASE_MS;
}
function sessionGuardError(error){
    const code=String(error?.code||"");
    if(code==="permission-denied")return "Publish the free Firestore device-handoff rules to activate protection.";
    if(code==="unavailable"||code==="deadline-exceeded")return "Firestore unreachable. Local progress remains safe.";
    return String(error?.message||"Device handoff unavailable.").slice(0,180);
}
// A recovery snapshot is local-only, scoped by authenticated UID. It does
// not acquire a lease, update the cloud, or grant offline earnings.
function sessionGuardRecoveryKey(uid){
    return HANDOFF_RECOVERY_PREFIX+uid;
}
function sessionGuardRecoveryRead(uid){
    if(!uid)return null;
    try{
        const raw=localStorage.getItem(sessionGuardRecoveryKey(uid));
        if(!raw)return null;
        const entry=JSON.parse(raw);
        return entry?.schemaVersion===1&&entry.ownerUid===uid&&
            typeof entry.save==="string"&&
            typeof inspectSeasonSave==="function"&&
            typeof accountValidSave==="function"&&
            accountValidSave(inspectSeasonSave(entry.save))?entry:null;
    }catch(_){return null}
}
// A one-tab acknowledgement means only that we triggered a download; the
// user still must verify the file actually exists before clearing the copy.
function sessionGuardRecoveryExportKey(uid){
    return HANDOFF_EXPORTED_PREFIX+uid;
}
function sessionGuardRecoverySnapshotId(entry){
    if(!entry||typeof entry.save!=="string")return null;
    return entry.ownerUid+"|"+entry.savedAt+"|"+entry.save.length+"|"+
        (typeof playerSyncFingerprint==="function"?
         playerSyncFingerprint(inspectSeasonSave(entry.save))||"invalid":"unknown");
}
function sessionGuardRecoveryWasExported(uid){
    const entry=sessionGuardRecoveryRead(uid);
    if(!entry)return false;
    try{
        return sessionStorage.getItem(sessionGuardRecoveryExportKey(uid))===
            sessionGuardRecoverySnapshotId(entry);
    }catch(_){return false}
}
function sessionGuardRecoveryMarkExported(uid,entry){
    if(!uid||!entry)return false;
    try{
        const marker=sessionGuardRecoverySnapshotId(entry);
        if(!marker)return false;
        sessionStorage.setItem(sessionGuardRecoveryExportKey(uid),marker);
        sessionGuardRecoveryRefresh();
        return true;
    }catch(_){return false}
}
function sessionGuardRecoveryClear(uid){
    if(!uid||uid!==sessionGuardCurrentUid())return false;
    const entry=sessionGuardRecoveryRead(uid);
    if(!entry||!sessionGuardRecoveryWasExported(uid))return false;
    // Do not remove a different/replaced recovery copy after the
    // confirmation dialogue or a tab-state change.
    const current=sessionGuardRecoveryRead(uid);
    if(sessionGuardRecoverySnapshotId(current)!==sessionGuardRecoverySnapshotId(entry))
        return false;
    try{
        localStorage.removeItem(sessionGuardRecoveryKey(uid));
        sessionStorage.removeItem(sessionGuardRecoveryExportKey(uid));
        sessionGuardRecoveryRefresh();
        return !localStorage.getItem(sessionGuardRecoveryKey(uid));
    }catch(_){return false}
}
function sessionGuardPreserveRecovery(){
    const uid=sessionGuardCurrentUid();
    if(!uid)return false;
    try{
        if(sessionGuardRecoveryRead(uid))return true; // never clobber an earlier unsynced copy
        const currentRaw=localStorage.getItem("clickerHeroSave");
        const bootRaw=window.__hotcBootSaveRaw;
        const current=currentRaw&&typeof inspectSeasonSave==="function"?
            inspectSeasonSave(currentRaw):null;
        const boot=bootRaw&&typeof inspectSeasonSave==="function"?
            inspectSeasonSave(bootRaw):null;
        const currentValid=typeof accountValidSave==="function"&&accountValidSave(current);
        const bootValid=typeof accountValidSave==="function"&&accountValidSave(boot);
        // A browser-restarted tab may rewrite only lastSaved/lastSavedDeviceId
        // during initial UI setup. Prefer the original checkpoint in that
        // case so a recovery export retains its true originating device.
        // If actual gameplay changed after load, preserve the NEWER local
        // save instead. Nothing here decides or replays offline earnings.
        const unchangedProgress=bootValid&&currentValid&&
            typeof playerSyncFingerprint==="function"&&
            playerSyncFingerprint(boot)===playerSyncFingerprint(current);
        const raw=bootValid&&(!currentValid||unchangedProgress)?bootRaw:currentRaw;
        if(!raw||!(bootValid&&raw===bootRaw||currentValid&&raw===currentRaw))return false;
        localStorage.setItem(sessionGuardRecoveryKey(uid),
            JSON.stringify({schemaVersion:1,ownerUid:uid,savedAt:Date.now(),save:raw}));
        return true;
    }catch(error){
        console.warn("Could not preserve recovery snapshot; retain or export the current local save.",error);
        return false;
    }
}
function sessionGuardRecoveryRefresh(){
    const uid=sessionGuardCurrentUid();
    const entry=sessionGuardRecoveryRead(uid);
    const exportControl=document.getElementById("account-session-export-recovery");
    if(exportControl)exportControl.hidden=!uid||!entry;
    const clearControl=document.getElementById("account-session-clear-recovery");
    const acknowledged=Boolean(entry&&sessionGuardRecoveryWasExported(uid));
    if(clearControl){
        clearControl.hidden=!entry;
        clearControl.disabled=!acknowledged;
        clearControl.title=acknowledged?
            "Verify the downloaded CHS file, then clear this snapshot":
            "Export the recovery copy first";
    }
    const hint=document.getElementById("account-session-recovery-hint");
    if(hint){
        hint.hidden=!entry;
        if(entry){
            const date=new Date(entry.savedAt);
            const since=Number.isFinite(date.getTime())?date.toLocaleString():"an earlier interruption";
            const snapshot=inspectSeasonSave(entry.save);
            const live=inspectSeasonSave(localStorage.getItem("clickerHeroSave"));
            const savedSummary=typeof accountSaveSummary==="function"?
                accountSaveSummary(snapshot):"Saved recovery available";
            const localSummary=typeof accountSaveSummary==="function"?
                accountSaveSummary(live):"Local progress available";
            const changed=typeof playerSyncFingerprint==="function"?
                playerSyncFingerprint(snapshot)!==playerSyncFingerprint(live):true;
            hint.textContent="Interrupted recovery from "+since+
                ": "+savedSummary+"\nCurrent device: "+localSummary+
                (changed?"\nThese saves contain different progress.":"\nProgress matches the current local save.")+
                (acknowledged?"\nExport initiated. Verify your downloaded CHS file before clearing.":
                "\nExport the recovery CHS file before you can clear this copy.");
            hint.style.whiteSpace="pre-line";
        }
    }
}
function sessionGuardStatus(message,warning=false){
    sessionGuardLastMessage=message;
    const status=document.getElementById("account-session-status");
    if(status){
        status.textContent=message;
        status.classList.toggle("session-warning",warning);
    }
    const claim=document.getElementById("account-session-claim");
    if(claim){
        claim.hidden=!sessionGuardCurrentUid()||
            !["occupied","available","released","lost","unconfigured"].includes(sessionGuardPhase);
        claim.textContent=sessionGuardPhase==="occupied"?
            "Use This Device (Take Over)":
            sessionGuardPhase==="available"?"Continue on This Device":
            sessionGuardPhase==="released"?"Resume on This Device":
            "Try Connecting This Device";
    }
    const handoff=document.getElementById("account-session-handoff");
    if(handoff){
        handoff.hidden=sessionGuardPhase!=="active"||!sessionGuardUsesServer();
        handoff.disabled=sessionGuardBusy;
    }
    const review=document.getElementById("account-session-review");
    if(review)review.hidden=sessionGuardPhase!=="review";
    sessionGuardRecoveryRefresh();
}
function sessionGuardSet(phase,message){
    const previous=sessionGuardPhase;
    // Save the final in-memory frame before taking a separate safety copy.
    // A failed session must never erase an earlier unexported recovery.
    if(["lost","review"].includes(phase)&&phase!==previous){
        if(previous==="active"&&typeof saveGame==="function"&&
            window.__hotcCloudRestorePending!==true){
            try{saveGame()}catch(error){console.warn("Local save failed during disconnect.",error)}
        }
        const saved=sessionGuardPreserveRecovery();
        if(saved)message+=" Local safety copy available for export in Player Account.";
        else message+=" Keep your existing local save or use Export Save; a separate recovery could not be confirmed.";
    }
    sessionGuardPhase=phase;
    sessionGuardStatus(message,["occupied","lost","review"].includes(phase));
    const paused=sessionGuardBlocksGameplay();
    for(const id of ["hero-view","kingdom-view","army-view"]){
        const el=document.getElementById(id);
        if(el)el.inert=paused;
    }
    if(paused){
        // A startup/foreground verification is NOT a lost session.
        // Preserve deferred same-tab offline eligibility until the cloud
        // owner is checked; clear it only after a real loss or conflict.
        if(phase!=="checking"){
            window.__hotcDeferredOfflineSavedAt=null;
            window.__hotcDeferredOfflineSourceDeviceId=null;
        }
        if(typeof stopSquadAttack==="function")stopSquadAttack();
        if(typeof pauseBossClock==="function")pauseBossClock();
    }else if(!document.hidden&&typeof startSquadAttack==="function"){
        if(typeof resumeBossClock==="function")resumeBossClock();
        startSquadAttack();
    }
    if(typeof accountControlsUpdate==="function")accountControlsUpdate();
}
function sessionGuardUnwatch(){
    if(sessionGuardUnsubscribe){sessionGuardUnsubscribe();sessionGuardUnsubscribe=null}
}
function sessionGuardWatch(uid,generation){
    sessionGuardUnwatch();
    // One listener rather than frequent polling reduces Spark read usage.
    const ref=sessionGuardRef(uid);
    sessionGuardUnsubscribe=ref.onSnapshot(snapshot=>{
        if(generation!==sessionGuardGeneration||uid!==sessionGuardCurrentUid())return;
        if(!snapshot.exists||snapshot.metadata?.fromCache)return;
        const record=snapshot.data();
        if(record.ownerUid!==uid)return;
        // A waiting device listens for a clean release without taking over
        // or modifying the cloud save. Claiming remains a user action.
        if(["occupied","available"].includes(sessionGuardPhase)){
            if(record.released||!sessionGuardLeaseActive(record)){
                if(sessionGuardPhase!=="available")
                    sessionGuardSet("available",
                        "The previous device is ready. Select Continue on This Device, then review the cloud save.");
            }else if(sessionGuardPhase==="available"){
                sessionGuardSet("occupied",
                    "Another device is active. Use Take Over only after checking its cloud backup.");
            }
            return;
        }
        if(record.deviceId!==sessionGuardDeviceId()&&sessionGuardProtected){
            if(typeof playerSyncPause==="function")playerSyncPause();
            sessionGuardSet("lost","A different device has taken over this account. Your local copy is preserved.");
        }
    },error=>{
        if(generation===sessionGuardGeneration&&sessionGuardProtected)
            sessionGuardSet("lost","Cannot verify the active device: "+sessionGuardError(error));
    });
}
async function sessionGuardReview(uid,generation,allowOffline=false){
    if(generation!==sessionGuardGeneration||uid!==sessionGuardCurrentUid())return;
    try{
        const snapshot=await accountCloudRef({uid}).get({source:"server"});
        if(generation!==sessionGuardGeneration||uid!==sessionGuardCurrentUid()||
            sessionGuardPhase==="lost")return;
        // The session claim and cloud-read are separate requests. Ownership
        // can move between them (including during a slow browser restart).
        // A fresh *server* read prevents a late cloud response from unlocking
        // gameplay after another device has taken over.
        const leaseSnapshot=await sessionGuardRef(uid).get({source:"server"});
        if(generation!==sessionGuardGeneration||uid!==sessionGuardCurrentUid()||
            sessionGuardPhase==="lost")return;
        const lease=leaseSnapshot.exists?leaseSnapshot.data():null;
        if(!lease||lease.ownerUid!==uid||lease.deviceId!==sessionGuardDeviceId()||
            lease.released||!sessionGuardLeaseActive(lease)){
            if(typeof playerSyncPause==="function")playerSyncPause();
            sessionGuardSet("lost","Device ownership changed while loading the cloud save. "+
                "Your local progress is preserved. Reconnect and review the latest cloud checkpoint.");
            return;
        }
        const cloud=snapshot.exists?snapshot.data():null;
        if(cloud&&accountCloudRecordValid(cloud,{uid})){
            const anchor=playerSyncAnchor(uid);
            const local=inspectSeasonSave(localStorage.getItem("clickerHeroSave"));
            const sameRevision=anchor&&anchor.revision===cloud.revision;
            const sameProgress=sameRevision&&
                playerSyncFingerprint(local)===playerSyncFingerprint(cloud.save);
            // The returning owner may have legitimate unsynced local
            // progress after its last cloud checkpoint. When the server
            // revision has NOT changed and that save was authored by this
            // same tab, let it continue instead of locking normal play
            // behind a Restore/Overwrite prompt on every refresh.
            // A different device must still compare mismatched progress.
            const ownUnsyncedProgress=Boolean(allowOffline&&sameRevision&&
                local&&local.lastSavedDeviceId===sessionGuardDeviceId());
            if(!sameProgress&&!ownUnsyncedProgress){
                playerCloudPreview=cloud;
                accountPreviewCloud(cloud);
                playerCloudUpdateNotice(cloud);
                sessionGuardSet("review","This account has a different cloud save. Choose Compare / Restore before playing here. No offline reward will be added.");
                return;
            }
        }
        sessionGuardSet("active","This browser tab is active. Other tabs/devices must take over before uploading; scores remain unverified.");
        const savedAt=window.__hotcDeferredOfflineSavedAt;
        const savedBy=window.__hotcDeferredOfflineSourceDeviceId;
        window.__hotcDeferredOfflineSavedAt=null;
        window.__hotcDeferredOfflineSourceDeviceId=null;
        // Reacquiring the same Firestore tab ID is not enough: the saved
        // payload must ALSO originate from that tab. A restored PC save must
        // never earn offline gold again on the phone after its reload.
        if(allowOffline&&savedBy===sessionGuardDeviceId()&&
            Number.isFinite(savedAt)&&
            typeof awardOfflineGold==="function"&&typeof saveGame==="function"){
            const elapsed=Math.max(0,(Date.now()-savedAt)/1000);
            if(elapsed>2){awardOfflineGold(elapsed);saveGame()}
        }
    }catch(error){
        sessionGuardSet("review","Cloud save could not be verified: "+sessionGuardError(error)+
            " Check Cloud Save before continuing.");
    }
}
async function sessionGuardClaim(takeover=false){
    const uid=sessionGuardCurrentUid();
    if(!uid||sessionGuardBusy)return false;
    sessionGuardBusy=true;
    const generation=++sessionGuardGeneration;
    sessionGuardSet("checking","Checking which device owns the account...");
    try{
        const id=sessionGuardDeviceId();
        const ref=sessionGuardRef(uid);
        const outcome=await db.runTransaction(async tx=>{
            const snap=await tx.get(ref);
            const old=snap.exists?snap.data():null;
            if(old&&old.ownerUid!==uid)throw Error("Invalid handoff owner.");
            if(old&&old.deviceId!==id&&sessionGuardLeaseActive(old)&&!takeover)
                return {status:"occupied",deviceLabel:old.deviceLabel||"another device"};
            const sameDevice=Boolean(old&&old.deviceId===id);
            tx.set(ref,{ownerUid:uid,deviceId:id,schemaVersion:1,released:false,
                deviceLabel:sessionGuardDeviceLabel(),updatedAt:sessionGuardTimestamp()});
            return {status:"active",sameDevice};
        });
        if(generation!==sessionGuardGeneration||uid!==sessionGuardCurrentUid())return false;
        if(outcome.status==="occupied"){
            sessionGuardSet("occupied","This account is active on "+outcome.deviceLabel+
                ". Save progress there first, then use Take Over to switch here.");
            sessionGuardWatch(uid,generation);
            return false;
        }
        sessionGuardProtected=true;
        localStorage.setItem(HANDOFF_PROTECTED_PREFIX+uid,"1");
        localStorage.setItem(HANDOFF_ACCOUNT_MARKER,"1");
        sessionGuardLastPing=Date.now();
        if(!outcome.sameDevice&&typeof playerSyncPause==="function")playerSyncPause();
        sessionGuardWatch(uid,generation);
        await sessionGuardReview(uid,generation,outcome.sameDevice===true);
        return sessionGuardPhase==="active";
    }catch(error){
        if(generation!==sessionGuardGeneration)return false;
        const protectedBefore=sessionGuardUsesServer();
        if(protectedBefore){
            sessionGuardSet("lost","Session verification failed: "+sessionGuardError(error)+
                " Cloud uploads are paused.");
        }else{
            sessionGuardSet("unconfigured",sessionGuardError(error)+
                " Local play is available, but device coordination is not enforced.");
        }
        return false;
    }finally{
        sessionGuardBusy=false;
    }
}
async function sessionGuardTakeover(){
    if(!sessionGuardCurrentUid())return false;
    // A clean release is observable without stealing the session. A
    // concurrent claimant still wins transactionally if it arrives first.
    if(sessionGuardPhase!=="occupied")return sessionGuardClaim(false);
    if(!confirm("Take over this account on this device?\n\nFirst back up progress on the other device. You will be asked to review/restore the cloud save here; local saves are not merged."))return false;
    return sessionGuardClaim(true);
}
// Force a foreground lease check BEFORE game.js resumes combat. A routine
// heartbeat can run without interrupting an already-active game.
function sessionGuardVerifyForeground(){
    if(document.hidden||!["active","review"].includes(sessionGuardPhase))return false;
    if(sessionGuardBusy)return false;
    sessionGuardLastPing=0;
    sessionGuardPing(true);
    return true;
}
async function sessionGuardPing(pauseForVerification=false){
    const uid=sessionGuardCurrentUid();
    const resumePhase=sessionGuardPhase;
    const generation=sessionGuardGeneration;
    if(!uid||uid!==sessionGuardUid||sessionGuardBusy||
        document.hidden||!["active","review"].includes(resumePhase))return false;
    if(!pauseForVerification&&
        Date.now()-sessionGuardLastPing<HANDOFF_POLL_MS-3000)return true;
    sessionGuardBusy=true;
    if(pauseForVerification)sessionGuardSet("checking",
        "Verifying this device before resuming gameplay...");
    try{
        const ref=sessionGuardRef(uid);
        const result=await db.runTransaction(async tx=>{
            const snap=await tx.get(ref);
            if(!snap.exists||snap.data().deviceId!==sessionGuardDeviceId()||
                snap.data().ownerUid!==uid||snap.data().released||
                !sessionGuardLeaseActive(snap.data()))return false;
            tx.update(ref,{updatedAt:sessionGuardTimestamp()});
            return true;
        });
        if(generation!==sessionGuardGeneration||uid!==sessionGuardCurrentUid())
            return false;
        if(!result){
            if(typeof playerSyncPause==="function")playerSyncPause();
            sessionGuardSet("lost","This device no longer owns the account. Reconnect or take over before playing.");
            return false;
        }
        sessionGuardLastPing=Date.now();
        if(pauseForVerification&&sessionGuardPhase==="checking"){
            sessionGuardSet(resumePhase,resumePhase==="review"?
                "Device verified. Compare or restore the cloud save before continuing.":
                "This browser tab is active. Device ownership verified; scores remain unverified.");
        }
        return true;
    }catch(error){
        if(generation===sessionGuardGeneration&&uid===sessionGuardCurrentUid()&&
            sessionGuardUsesServer())sessionGuardSet("lost",
            "Could not verify device ownership: "+sessionGuardError(error));
        return false;
    }finally{sessionGuardBusy=false}
}
async function sessionGuardCheckpoint(save,expectedRevision,allowReview=false){
    if(!sessionGuardCanCheckpoint(allowReview))throw Error("This tab must own the account before uploading.");
    const uid=sessionGuardCurrentUid(),id=sessionGuardDeviceId();
    const saveRef=accountCloudRef({uid}),sessionRef=sessionGuardRef(uid);
    try{
        const revision=await db.runTransaction(async tx=>{
            const sessionSnap=await tx.get(sessionRef);
            const saveSnap=await tx.get(saveRef);
            const active=sessionSnap.exists?sessionSnap.data():null;
            if(!active||active.ownerUid!==uid||active.deviceId!==id||
                !sessionGuardLeaseActive(active))throw Error("Another device owns the cloud session.");
            const actual=saveSnap.exists?Number(saveSnap.data().revision):0;
            if(actual!==expectedRevision)throw Error("Cloud revision changed. Review the new save first.");
            tx.set(saveRef,{...accountCloudDocument({uid},save,actual+1),deviceId:id});
            return actual+1;
        });
        if(uid!==sessionGuardCurrentUid())throw Error("Account changed during cloud upload.");
        if(sessionGuardPhase==="review")sessionGuardSet("active",
            "You chose this device's save and now own cloud uploads.");
        return revision;
    }catch(error){
        if(uid===sessionGuardCurrentUid()&&sessionGuardUsesServer()){
            if(typeof playerSyncPause==="function")playerSyncPause();
            sessionGuardSet("lost","Cloud checkpoint failed: "+sessionGuardError(error)+
                " Check the latest cloud save before uploading again.");
        }
        throw error;
    }
}
// Save the latest local progress FIRST. Only release ownership after the
// revision-guarded cloud checkpoint is confirmed. This uses the existing
// two Firestore transactions and needs no new rules or paid Functions.
async function sessionGuardHandoff(){
    const uid=sessionGuardCurrentUid();
    if(!uid||sessionGuardPhase!=="active"||!sessionGuardCanCheckpoint()||
        sessionGuardBusy||typeof playerAccountCloudBusy!=="undefined"&&playerAccountCloudBusy||
        typeof playerSyncInFlight!=="undefined"&&playerSyncInFlight){
        sessionGuardStatus("Cannot switch yet. Finish cloud activity and confirm this device owns the session.",true);
        return false;
    }
    if(!confirm("Save your current game to Firebase and release this device?\n\nAnother device can then choose Continue on This Device and restore the latest cloud save. If saving fails, the switch will not complete."))return false;
    // Capture the last playable state before pausing local combat.
    if(typeof saveGame==="function")saveGame();
    const save=inspectSeasonSave(localStorage.getItem("clickerHeroSave"));
    if(typeof accountValidSave!=="function"||!accountValidSave(save)){
        sessionGuardStatus("Could not switch: local save is invalid. Export your save before trying again.",true);
        return false;
    }
    sessionGuardBusy=true;
    const generation=sessionGuardGeneration;
    let checkpointed=false;
    sessionGuardSet("handoff","Saving a final cloud checkpoint before releasing this device...");
    try{
        const user={uid};
        const existing=await accountCloudRef(user).get({source:"server"});
        if(generation!==sessionGuardGeneration||uid!==sessionGuardCurrentUid())
            throw new Error("Account changed during handoff.");
        const record=existing.exists?existing.data():null;
        if(record&&!accountCloudRecordValid(record,user))
            throw new Error("Existing cloud backup is invalid. Compare saves before switching.");
        const anchor=playerSyncAnchor(uid);
        if(record&&(!anchor||anchor.revision!==record.revision))
            throw new Error("Cloud revision differs from this device. Compare/Restore before switching.");
        if(!record&&anchor)
            throw new Error("Cloud backup is missing. Review your local save before switching.");
        const revision=await sessionGuardCheckpoint(save,record?record.revision:0,true);
        checkpointed=true;
        playerSyncSetAnchor(uid,revision,save);
        const sessionRef=sessionGuardRef(uid),id=sessionGuardDeviceId();
        const released=await db.runTransaction(async tx=>{
            const current=await tx.get(sessionRef);
            if(!current.exists||current.data().ownerUid!==uid||
                current.data().deviceId!==id||current.data().released)return false;
            tx.update(sessionRef,{released:true,updatedAt:sessionGuardTimestamp()});
            return true;
        });
        if(!released)throw new Error("Device ownership changed during release.");
        sessionGuardUnwatch();
        sessionGuardProtected=false;
        if(typeof playerSyncPause==="function")playerSyncPause();
        sessionGuardSet("released","Cloud save revision "+revision+
            " saved successfully. This device is paused. Continue on your other device, or choose Resume here.");
        return true;
    }catch(error){
        const detail=sessionGuardError(error);
        if(generation!==sessionGuardGeneration||uid!==sessionGuardCurrentUid())return false;
        if(/cloud revision|existing cloud|cloud backup is missing/i.test(detail)){
            if(typeof playerSyncPause==="function")playerSyncPause();
            sessionGuardSet("review","Switch not completed: "+detail+
                " Review your cloud save first. Local progress is preserved.");
        }else{
            // After an uncertain release result, don't reopen uploads
            // without a fresh ownership claim and server revision check.
            sessionGuardSet("lost","Switch not confirmed"+(checkpointed?
                " (cloud checkpoint saved)":"")+". "+
                detail+" Reconnect to check ownership. Local progress is safe.");
        }
        return false;
    }finally{
        sessionGuardBusy=false;
        sessionGuardStatus(sessionGuardLastMessage,["lost","review"].includes(sessionGuardPhase));
    }
}
async function sessionGuardRelease(){
    const uid=sessionGuardCurrentUid();
    sessionGuardUnwatch();
    if(!uid||!sessionGuardProtected)return;
    try{
        await db.runTransaction(async tx=>{
            const ref=sessionGuardRef(uid),snap=await tx.get(ref);
            if(snap.exists&&snap.data().deviceId===sessionGuardDeviceId())
                tx.update(ref,{released:true,updatedAt:sessionGuardTimestamp()});
        });
    }catch(_){/* Lease expires without a cleanup write. */}
    sessionGuardProtected=false;
    sessionGuardSet("lost","This tab released the active device session.");
}
function sessionGuardAccountChanged(user){
    const uid=user&&!user.isAnonymous?user.uid:null;
    if(uid===sessionGuardUid)return;
    sessionGuardUnwatch();
    ++sessionGuardGeneration;
    sessionGuardUid=uid;
    sessionGuardProtected=false;
    sessionGuardLastPing=0;
    if(!uid){sessionGuardSet("unconfigured","Sign in to use device handoff.");return}
    sessionGuardRecoveryRefresh();
    localStorage.setItem(HANDOFF_ACCOUNT_MARKER,"1");
    sessionGuardClaim(false);
}
document.addEventListener("visibilitychange",()=>{
    if(!document.hidden)sessionGuardVerifyForeground();
});
setInterval(sessionGuardPing,HANDOFF_POLL_MS);
