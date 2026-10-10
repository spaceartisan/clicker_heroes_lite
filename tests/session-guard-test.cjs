"use strict";
// Simulate Spark Firestore transactions and rule-level session checks.
// No Firebase credentials, Cloud Functions, timers, or network access.
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const assert=require("node:assert/strict");
const source=fs.readFileSync(path.join(__dirname,"../session-guard.js"),"utf8");
const uid="shared-firebase-uid",sessions=new Map(),saves=new Map(),watchers=new Map();
let permissionDenied=false,serial=3,uploads=0;
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
    for(const [field,value] of Object.entries(normalized))
      if(value&&value.__server)normalized[field]=timestamp();
    if(!isSession){
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
   classList:{toggle(){}},disabled:false});
  return nodes.get(id);
 },addEventListener(){}};
 const context=vm.createContext({
  document,localStorage:{getItem:k=>local.get(k)||null,setItem:(k,v)=>local.set(k,v),
   removeItem:k=>local.delete(k)},
  sessionStorage:{getItem:k=>tab.get(k)||null,setItem:(k,v)=>tab.set(k,v)},
  Uint8Array,Date,console,navigator:{userAgent:mobile?"iPhone":"Desktop"},
  window:{crypto:{getRandomValues(arr){let n=++seed;for(let i=0;i<arr.length;i++)arr[i]=(i*13+n*37)%256;return arr}},
    __hotcDeferredOfflineSavedAt:null},
  firebase:{firestore:{FieldValue:{serverTimestamp}}},
  db:firebaseDb(),accountAuth:()=>({currentUser:account}),
  accountControlsUpdate(){},playerSyncPause(){},
  playerSyncAnchor(){const value=local.get("test_cloud_anchor");return value?JSON.parse(value):null},
  playerSyncFingerprint:save=>save?JSON.stringify(save):null,
  inspectSeasonSave:raw=>raw?JSON.parse(raw):null,
  accountCloudRef:({uid:id})=>firebaseDb().collection("player_saves").doc(id),
  accountCloudDocument:({uid:id},save,revision)=>({ownerUid:id,schemaVersion:1,
    seasonId:"dynasty-ii",revision,updatedAt:serverTimestamp(),save}),
  accountCloudRecordValid:(v,user)=>Boolean(v&&v.ownerUid===user.uid),
  playerCloudUpdateNotice(){},accountPreviewCloud(){},
  saveGame(){},awardOfflineGold(){reward++},
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
 pc.context.sessionGuardAccountChanged(pc.account);await settle();
 ok(phase(pc)==="active","First PC owns Firestore session");
 ok(pc.storage.get("hotc_account_linked_device_v1")==="1"&&
    pc.context.sessionGuardCanCheckpoint(),"Cloud-account marker and active writer");
 const owner1=sessions.get("player_sessions/"+uid).deviceId;
 ok(owner1.length===64,"Stable install plus per-tab random identifier");
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
 phone.storage.set("clickerHeroSave",JSON.stringify(phoneProgress));
 phone.storage.set("test_cloud_anchor",JSON.stringify({
   revision:2,fingerprint:JSON.stringify(phoneProgress)
 }));
 phone.context.window.__hotcDeferredOfflineSavedAt=Date.now()-3600000;
 phone.context.window.__hotcDeferredOfflineSourceDeviceId=owner1;
 await phone.context.sessionGuardClaim(false);await settle();
 ok(phase(phone)==="active"&&phone.reward===0,
   "Phone reload with imported PC provenance never duplicates offline gold");
 ok(phone.context.window.__hotcDeferredOfflineSavedAt===null&&
    phone.context.window.__hotcDeferredOfflineSourceDeviceId===null,
    "Imported offline entitlement is discarded after the handoff review");
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
 phone.context.sessionGuardRelease();await settle();
 await another.context.sessionGuardTakeover();await settle();
 ok(phase(another)==="review"&&phase(phone)!=="active","Released lease permits new owner");
 const noRules=makeDevice();
 permissionDenied=true;noRules.context.sessionGuardAccountChanged(noRules.account);await settle();
 ok(phase(noRules)==="unconfigured","Missing Firestore rules clearly shows inactive protection");
 ok(!noRules.context.sessionGuardUsesServer(),"Missing rules does not pretend enforcement exists");
 permissionDenied=false;
 const pcIdAgain=pc.context.sessionGuardDeviceId();
 ok(pcIdAgain===owner1,"Device ID remains stable through reload within the same tab");
 ok(uploads===2,"Only expected checkpoint writes were accepted");
 console.log("Spark handoff tests: "+passed+" passed.");
}
run().catch(error=>{console.error(error);process.exitCode=1});
