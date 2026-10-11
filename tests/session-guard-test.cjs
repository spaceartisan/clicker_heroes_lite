"use strict";
// Simulate Spark Firestore transactions and rule-level session checks.
// No Firebase credentials, Cloud Functions, timers, or network access.
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const assert=require("node:assert/strict");
const source=fs.readFileSync(path.join(__dirname,"../session-guard.js"),"utf8");
const uid="shared-firebase-uid",sessions=new Map(),saves=new Map(),watchers=new Map();
let permissionDenied=false,failNextCloudWrite=false,failNextRelease=false,serial=3,uploads=0;
let passed=0;const ok=(x,n)=>{assert.ok(x,n);passed++;console.log("PASS "+n)};
const serverTimestamp=()=>({__server:true});
const timestamp=()=>({toMillis:()=>Date.now()});
function snapshot(value){
  return {exists:Boolean(value),data:()=>value,metadata:{fromCache:false}};
}
function notify(key){
 for(const fn of (watchers.get(key)||[]))fn(snapshot(sessions.get(key)));
}
function firebaseDb(){
 return {
  collection(collection){
   assert.ok(["player_sessions","player_saves"].includes(collection));
   return {doc(name){
    const key=collection+"/"+name;
    return {
     __key:key,
     async get(){if(permissionDenied)throw {code:"permission-denied"};
      return snapshot(collection==="player_sessions"?sessions.get(key):saves.get(key));},
     onSnapshot(fn){const set=watchers.get(key)||new Set();set.add(fn);watchers.set(key,set);
      Promise.resolve().then(()=>fn(snapshot(sessions.get(key))));
      return ()=>set.delete(fn);
     }
    };
   }};
  },
  async runTransaction(fn){
   if(permissionDenied)throw {code:"permission-denied"};
   const actions=[],tx={
    async get(ref){return snapshot(ref.__key.startsWith("player_sessions/")?
      sessions.get(ref.__key):saves.get(ref.__key))},
    set(ref,data){actions.push({ref,data,replace:true})},
    update(ref,data){actions.push({ref,data,replace:false})}
   };
   const result=await fn(tx);
   for(const action of actions){
    const key=action.ref.__key;
    const isSession=key.startsWith("player_sessions/");
    const previous=(isSession?sessions:saves).get(key)||{};
    const normalized={...(action.replace?{}:previous),...action.data};
    if(isSession&&normalized.released===true&&failNextRelease){
      failNextRelease=false;throw {code:"unavailable"};
    }
    for(const [field,value] of Object.entries(normalized))
      if(value&&value.__server)normalized[field]=timestamp();
    if(!isSession){
      if(failNextCloudWrite){failNextCloudWrite=false;throw {code:"permission-denied"};}
      const current=sessions.get("player_sessions/"+uid);
      if(!current||current.deviceId!==normalized.deviceId||
          current.released)throw {code:"permission-denied"};
      const expected=previous.revision||0;
      if(normalized.revision!==expected+1)throw {code:"permission-denied"};
      uploads++;
    }
    (isSession?sessions:saves).set(key,normalized);
    if(isSession)notify(key);
   }
   return result;
  }
 };
}
let seed=0;
function makeDevice(mobile=false){
 const nodes=new Map(),storage=new Map(),tab=new Map(),local=new Map();
 const account={uid,isAnonymous:false,email:"test@example.com"};
 let reward=0,stops=0;
 const document={hidden:false,getElementById(id){
  if(!nodes.has(id))nodes.set(id,{hidden:false,inert:false,textContent:"",
   classList:{toggle(){}},disabled:false,style:{},title:""});
  return nodes.get(id);
 },addEventListener(){}};
 const context=vm.createContext({
  document,localStorage:{getItem:k=>local.get(k)||null,setItem:(k,v)=>local.set(k,v),
   removeItem:k=>local.delete(k)},
  sessionStorage:{getItem:k=>tab.get(k)||null,setItem:(k,v)=>tab.set(k,v),
   removeItem:k=>tab.delete(k)},
  Uint8Array,Date,console,navigator:{userAgent:mobile?"iPhone":"Desktop"},
  window:{crypto:{getRandomValues(arr){let n=++seed;for(let i=0;i<arr.length;i++)arr[i]=(i*13+n*37)%256;return arr}},
    __hotcDeferredOfflineSavedAt:null},
  firebase:{firestore:{FieldValue:{serverTimestamp}}},
  db:firebaseDb(),accountAuth:()=>({currentUser:account}),
  accountControlsUpdate(){},playerSyncPause(){},
  playerSyncAnchor(){const value=local.get("test_cloud_anchor");return value?JSON.parse(value):null},
  playerSyncSetAnchor(_userId,revision,save){
   const normalized={...save};
   delete normalized.lastSaved;delete normalized.lastSubmittedScore;
   delete normalized.lastSavedDeviceId;
   local.set("test_cloud_anchor",JSON.stringify({
     revision,fingerprint:JSON.stringify(normalized)
   }));
   return true;
  },
  accountValidSave:save=>Boolean(save&&save.schemaVersion===2&&save.seasonId==="dynasty-ii"),
  accountSaveSummary:save=>save?
    "Highest stage "+Math.max(save.maxLevel,save.bestSeasonStage)+
    " · Dynasty "+(save.dynastyCount||0):"Invalid save",
  playerSyncFingerprint:save=>{
    if(!save)return null;
    const gameplay={...save};
    delete gameplay.lastSaved;
    delete gameplay.lastSubmittedScore;
    delete gameplay.lastSavedDeviceId;
    return JSON.stringify(gameplay);
  },
  inspectSeasonSave:raw=>raw?JSON.parse(raw):null,
  accountCloudRef:({uid:id})=>firebaseDb().collection("player_saves").doc(id),
  accountCloudDocument:({uid:id},save,revision)=>({ownerUid:id,schemaVersion:1,
    seasonId:"dynasty-ii",revision,updatedAt:serverTimestamp(),save}),
  accountCloudRecordValid:(v,user)=>Boolean(v&&v.ownerUid===user.uid),
  playerCloudUpdateNotice(){},accountPreviewCloud(){},
  saveGame(){local.set("last_snapshot_call",String(Date.now()))},awardOfflineGold(){reward++},
  stopSquadAttack(){stops++},pauseBossClock(){},
  startSquadAttack(){},resumeBossClock(){},
  confirm:()=>true,setInterval(){}
 });
 vm.runInContext(source,context,{timeout:2500});
 return {context,account,nodes,storage:local,tab,
   get stops(){return stops},get reward(){return reward}};
}
const phase=device=>vm.runInContext("sessionGuardPhase",device.context);
async function settle(){for(let i=0;i<12;i++)await Promise.resolve()}
const progress={schemaVersion:2,seasonId:"dynasty-ii",playerLevel:5,gold:50,
 maxLevel:11,currentLevel:11,bestSeasonStage:11};
async function run(){
 const pc=makeDevice(),phone=makeDevice(true);
 pc.context.window.__hotcDeferredOfflineSavedAt=Date.now()-120000;
 pc.context.window.__hotcDeferredOfflineSourceDeviceId="0".repeat(64);
 pc.context.sessionGuardAccountChanged(pc.account);
 ok(phase(pc)==="checking"&&pc.nodes.get("hero-view").inert&&
    pc.context.window.__hotcDeferredOfflineSavedAt!==null,
    "Cold sign-in pauses combat but preserves deferred offline state while checking");
 await settle();
 ok(phase(pc)==="active","First PC owns Firestore session");
 ok(pc.storage.get("hotc_account_linked_device_v1")==="1"&&
    pc.context.sessionGuardCanCheckpoint(),"Cloud-account marker and active writer");
 const owner1=sessions.get("player_sessions/"+uid).deviceId;
 ok(owner1.length===64,"Stable install plus per-tab random identifier");
 // A browser restart may rewrite only the lastSaved and tab origin
 // before auth completes. The recovery must retain the original checkpoint.
 const bootPc={...progress,gold:713,maxLevel:15,currentLevel:15,
   bestSeasonStage:15,lastSavedDeviceId:"a".repeat(64),lastSaved:1234567};
 const unsyncedPc={...bootPc,lastSavedDeviceId:owner1,lastSaved:Date.now()};
 pc.context.window.__hotcBootSaveRaw=JSON.stringify(bootPc);
 pc.storage.set("clickerHeroSave",JSON.stringify(unsyncedPc));
 ok(await pc.context.sessionGuardCheckpoint(progress,0)===1&&
    saves.get("player_saves/"+uid).deviceId===owner1,"Initial checkpoint tagged with owner device");
 phone.context.sessionGuardAccountChanged(phone.account);await settle();
 ok(phase(phone)==="occupied"&&phone.nodes.get("hero-view").inert,
    "Phone cannot play while PC owns active lease");
 ok(phone.nodes.get("account-session-claim").hidden===false,
    "Explicit Take Over offered on phone");
 await phone.context.sessionGuardTakeover();await settle();
 ok(phase(phone)==="review"&&phone.nodes.get("account-session-review").hidden===false,
    "Takeover requires reviewing PC cloud save");
 ok(phase(pc)==="lost"&&pc.stops>0,"Realtime notification pauses old PC");
 const copyKey="hotc_handoff_recovery_v1_"+uid;
 const recovery=JSON.parse(pc.storage.get(copyKey));
 ok(recovery.ownerUid===uid&&
    JSON.parse(recovery.save).gold===713 &&
    JSON.parse(recovery.save).lastSavedDeviceId===bootPc.lastSavedDeviceId &&
    JSON.parse(recovery.save).lastSaved===bootPc.lastSaved,
    "Lost restart session preserves original save provenance before startup rewrites");
 ok(saves.get("player_saves/"+uid).save.gold===50,
    "Recoverable local snapshot does not overwrite cloud progress");
 pc.storage.set("clickerHeroSave",JSON.stringify({...progress,gold:3}));
 ok(pc.context.sessionGuardPreserveRecovery()&&
    JSON.parse(JSON.parse(pc.storage.get(copyKey)).save).gold===713,
    "Repeated disconnects cannot overwrite the first recovery snapshot");
 pc.context.sessionGuardRecoveryRefresh();
 ok(pc.nodes.get("account-session-recovery-hint").textContent.includes("Highest stage 15")&&
    pc.nodes.get("account-session-recovery-hint").textContent.includes("Current device:")&&
    pc.nodes.get("account-session-recovery-hint").textContent.includes("different progress"),
    "Recovery panel compares the first snapshot against the current device");
 ok(!pc.context.sessionGuardRecoveryClear(uid)&&pc.storage.get(copyKey)!==null &&
    pc.nodes.get("account-session-clear-recovery").disabled,
    "Unexported recovery cannot be deleted even through a direct function call");
 ok(!pc.context.sessionGuardRecoveryClear("another-user")&&pc.storage.get(copyKey)!==null,
    "Another user ID cannot clear this recovery copy");
 ok(pc.context.sessionGuardRecoveryMarkExported(uid,recovery)&&
    pc.context.sessionGuardRecoveryWasExported(uid)&&
    !pc.nodes.get("account-session-clear-recovery").disabled,
    "Only export of the current recovery unlocks explicit clear control");
 const cloudBeforeClear=saves.get("player_saves/"+uid);
 const localBeforeClear=pc.storage.get("clickerHeroSave");
 ok(pc.context.sessionGuardRecoveryClear(uid)&&pc.storage.get(copyKey)===undefined &&
    saves.get("player_saves/"+uid)===cloudBeforeClear&&
    pc.storage.get("clickerHeroSave")===localBeforeClear,
    "Clearing exported recovery leaves local gameplay and cloud revision untouched");
 pc.storage.set("clickerHeroSave",JSON.stringify({...unsyncedPc,gold:1001}));
 ok(pc.context.sessionGuardPreserveRecovery()&&
    JSON.parse(JSON.parse(pc.storage.get(copyKey)).save).gold===1001 &&
    !pc.context.sessionGuardRecoveryWasExported(uid)&&
    pc.nodes.get("account-session-clear-recovery").disabled,
    "Gameplay changed since startup: recovery uses the newer live save and requires fresh export");
 const owner2=sessions.get("player_sessions/"+uid).deviceId;
 ok(owner2!==owner1,"Phone writes a different device identifier");
 let denied=false;
 try{await pc.context.sessionGuardCheckpoint(progress,1)}catch(_){denied=true}
 ok(denied&&uploads===1,"Old device cannot overwrite after takeover");
 ok(!phone.context.sessionGuardCanCheckpoint()&&
    phone.context.sessionGuardCanCheckpoint(true),"Automatic uploads paused pending explicit review");
 const phoneProgress={...progress,gold:75,maxLevel:14,bestSeasonStage:14,currentLevel:14};
 ok(await phone.context.sessionGuardCheckpoint(phoneProgress,1,true)===2&&
    phase(phone)==="active"&&uploads===2,"Explicit keep-local choice checkpoints new owner");
 // Simulate refreshing the phone immediately after restoring the PC save.
 // The phone owns the session and the revision matches, but the payload
 // originated on the PC, so its old offline interval must NOT pay again.
 phone.storage.set("clickerHeroSave",JSON.stringify({
   ...phoneProgress,lastSaved:Date.now(),lastSavedDeviceId:owner2
 }));
 phone.storage.set("test_cloud_anchor",JSON.stringify({
   revision:2,fingerprint:phone.context.playerSyncFingerprint(phoneProgress)
 }));
 phone.context.window.__hotcDeferredOfflineSavedAt=Date.now()-3600000;
 phone.context.window.__hotcDeferredOfflineSourceDeviceId=owner1;
 await phone.context.sessionGuardClaim(false);await settle();
 ok(phase(phone)==="active"&&phone.reward===0,
   "Phone reload with imported PC provenance never duplicates offline gold");
 ok(phone.context.window.__hotcDeferredOfflineSavedAt===null&&
    phone.context.window.__hotcDeferredOfflineSourceDeviceId===null,
    "Imported offline entitlement is discarded after the handoff review");
 // Unsynced progress on the SAME returning tab is safe if the cloud revision
 // hasn't changed and the local save identifies this tab as its origin.
 const unsyncedPhone={...phoneProgress,gold:825,maxLevel:20,currentLevel:20,
   bestSeasonStage:20,lastSavedDeviceId:owner2};
 phone.storage.set("clickerHeroSave",JSON.stringify(unsyncedPhone));
 await phone.context.sessionGuardClaim(false);await settle();
 ok(phase(phone)==="active"&&
    JSON.parse(phone.storage.get("clickerHeroSave")).gold===825,
    "Returning session can continue legitimately earned unsynced local progress");
 // A newer cloud revision is never considered equivalent, even if locally
 // authored on the same tab. It must be reviewed before gameplay.
 const checkpoint=saves.get("player_saves/"+uid);
 saves.set("player_saves/"+uid,{...checkpoint,revision:3,
   save:{...phoneProgress,gold:999,maxLevel:21,bestSeasonStage:21,currentLevel:21}});
 await phone.context.sessionGuardClaim(false);await settle();
 ok(phase(phone)==="review"&&phone.nodes.get("hero-view").inert,
    "Newer cloud revision blocks even the original tab until reviewed");
 saves.set("player_saves/"+uid,checkpoint);
 await phone.context.sessionGuardClaim(false);await settle();
 ok(phase(phone)==="active","Original tab resumes after the cloud revision conflict is cleared");
 // A later refresh of the original tab's OWN saved checkpoint can still
 // receive the normal time-away reward exactly once.
 phone.context.window.__hotcDeferredOfflineSavedAt=Date.now()-3600000;
 phone.context.window.__hotcDeferredOfflineSourceDeviceId=owner2;
 await phone.context.sessionGuardClaim(false);await settle();
 ok(phone.reward===1&&
    phone.context.window.__hotcDeferredOfflineSavedAt===null,
    "Only a same-tab authored checkpoint may earn its offline reward once");
 await phone.context.sessionGuardClaim(false);await settle();
 ok(phone.reward===1,"Repeated claim cannot replay a consumed offline interval");
 const another=makeDevice();
 another.context.sessionGuardAccountChanged(another.account);await settle();
 ok(phase(another)==="occupied","Different tab also treated as another session");
 // Failed cloud checkpoint must NOT release the active owner or modify the
 // accepted cloud revision. It should require ownership verification again.
 failNextCloudWrite=true;
 const beforeFailedTransfer=uploads;
 ok(!await phone.context.sessionGuardHandoff()&&uploads===beforeFailedTransfer&&
    !sessions.get("player_sessions/"+uid).released&&
    saves.get("player_saves/"+uid).revision===2,
    "Rejected handoff checkpoint cannot release ownership or overwrite progress");
 ok(phase(phone)==="lost"&&
    phone.context.sessionGuardRecoveryRead(uid)!==null,
    "Cloud write rejection fails closed and preserves an account safety copy");
 await phone.context.sessionGuardClaim(false);await settle();
 ok(phase(phone)==="active","Owner can recover after an interrupted handoff");
 // The active device has unsynced local progress; saving it for the next
 // device is a deliberate, revision-guarded checkpoint, not a merge.
 ok(await phone.context.sessionGuardHandoff()&&
    saves.get("player_saves/"+uid).revision===3&&
    saves.get("player_saves/"+uid).save.gold===825&&uploads===3,
    "Save & Switch uploads latest unsynced gameplay before releasing ownership");
 await settle();
 ok(phase(phone)==="released"&&sessions.get("player_sessions/"+uid).released&&
    phone.nodes.get("hero-view").inert,
    "Source session is paused only after successful cloud checkpoint");
 ok(phase(another)==="available"&&
    another.nodes.get("account-session-claim").textContent==="Continue on This Device",
    "Waiting device sees a clean handoff without polling or stealing");
 ok(saves.get("player_saves/"+uid).save.gold===825,
    "Waiting device does not automatically merge or overwrite the cloud save");
 await another.context.sessionGuardTakeover();await settle();
 ok(phase(another)==="review"&&phase(phone)==="released",
    "Continue reclaims the released session and requires explicit cloud review");
 // A release can fail after the cloud checkpoint has succeeded. It must
 // not report a completed handoff or unlock stale gameplay as though safe.
 const newOwnerId=sessions.get("player_sessions/"+uid).deviceId;
 const tabletSave={...progress,gold:973,maxLevel:25,currentLevel:25,
    bestSeasonStage:25,lastSavedDeviceId:newOwnerId};
 another.storage.set("clickerHeroSave",JSON.stringify(tabletSave));
 another.context.playerSyncSetAnchor(uid,3,tabletSave);
 ok(await another.context.sessionGuardCheckpoint(tabletSave,3,true)===4&&
    phase(another)==="active","Review choice unlocks explicit owner checkpoint");
 another.context.playerSyncSetAnchor(uid,4,tabletSave);
 failNextRelease=true;
 ok(!await another.context.sessionGuardHandoff()&&
    saves.get("player_saves/"+uid).revision===5&&
    !sessions.get("player_sessions/"+uid).released,
    "Failed release retains cloud checkpoint but does not claim a clean handoff");
 ok(phase(another)==="lost"&&another.nodes.get("hero-view").inert,
    "Uncertain release pauses gameplay until ownership is reverified");
 await another.context.sessionGuardClaim(false);await settle();
 ok(phase(another)==="active","Owner can reclaim after a release failure");
 // Mobile resumes can fire game.js visibilitychange before the Firestore
 // listener notices that ownership was transferred while backgrounded.
 // The check must block combat synchronously until a live read completes.
 const deferredAt=Date.now()-60000;
 another.context.window.__hotcDeferredOfflineSavedAt=deferredAt;
 another.context.window.__hotcDeferredOfflineSourceDeviceId=newOwnerId;
 const resumed=another.context.sessionGuardVerifyForeground();
 ok(resumed&&phase(another)==="checking"&&
    another.nodes.get("hero-view").inert,
    "Foreground return blocks combat before the network verification finishes");
 ok(another.context.window.__hotcDeferredOfflineSavedAt===deferredAt,
    "Temporary foreground checks do not discard pending offline eligibility");
 await settle();
 ok(phase(another)==="active"&&!another.nodes.get("hero-view").inert,
    "Valid foreground lease restores combat after confirmed ownership");
 // The foreground verifier does not award time-away gold on its own.
 ok(another.reward===0&&
    another.context.window.__hotcDeferredOfflineSavedAt===deferredAt,
    "Foreground verification cannot replay or consume the deferred time-away reward");
 another.context.window.__hotcDeferredOfflineSavedAt=null;
 another.context.window.__hotcDeferredOfflineSourceDeviceId=null;
 // The session may have expired while offline without an observable
 // realtime event. Reaching the foreground cannot keep stale ownership.
 const expired={...sessions.get("player_sessions/"+uid),
   updatedAt:{toMillis:()=>Date.now()-480001}};
 sessions.set("player_sessions/"+uid,expired);
 another.context.sessionGuardVerifyForeground();
 ok(phase(another)==="checking"&&another.nodes.get("hero-view").inert,
    "Expired foreground lease stays paused while checking");
 await settle();
 ok(phase(another)==="lost"&&another.nodes.get("hero-view").inert,
    "Expired lease is rejected before gameplay resumes");
 await another.context.sessionGuardClaim(false);await settle();
 ok(phase(another)==="active","Same tab can reclaim an expired session deliberately");
 // Mimic a background takeover that Firestore's realtime watcher hasn't
 // delivered yet. The foreground transaction independently catches it.
 const changed=sessions.get("player_sessions/"+uid);
 sessions.set("player_sessions/"+uid,{...changed,deviceId:"f".repeat(64)});
 another.context.sessionGuardVerifyForeground();
 ok(phase(another)==="checking","Unseen takeover triggers recheck before combat");
 await settle();
 ok(phase(another)==="lost"&&another.nodes.get("hero-view").inert,
    "Server-side device change is rejected even without a watcher notification");
 const noRules=makeDevice();
 permissionDenied=true;noRules.context.sessionGuardAccountChanged(noRules.account);await settle();
 ok(phase(noRules)==="unconfigured","Missing Firestore rules clearly shows inactive protection");
 ok(!noRules.context.sessionGuardUsesServer(),"Missing rules does not pretend enforcement exists");
 ok(noRules.context.sessionGuardRecoveryRead("different-uid")===null,
    "Recovery copies are scoped to the authenticated account UID");
 permissionDenied=false;
 const pcIdAgain=pc.context.sessionGuardDeviceId();
 ok(pcIdAgain===owner1,"Device ID remains stable through reload within the same tab");
 ok(uploads===5,"Only expected checkpoint writes were accepted");
 console.log("Spark handoff tests: "+passed+" passed.");
}
run().catch(error=>{console.error(error);process.exitCode=1});
