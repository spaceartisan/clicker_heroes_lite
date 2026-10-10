"use strict";
// Client integration contract: two devices, one server lease, safe handoff.
// Local emulator doubles: no credentials, no Firebase billable calls.
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const root=path.join(__dirname,"..");
const source=fs.readFileSync(path.join(root,"session-guard.js"),"utf8");
const owner=new Map();
let cloud=null,functionsAvailable=true,now=Date.now();
let uid="same-google-uid";
const snapshots=[];
let tokenSeed=1;
let passed=0;function ok(value,label){assert.ok(value,label);passed++;console.log("PASS "+label)}
function mockServer(name,data) {
 if(!functionsAvailable)throw Object.assign(Error("not found"),{code:"functions/not-found"});
 const active=owner.get(uid);
 if(name==="claimPlayerSession"){
  if(active&&active.token!==data.token&&active.expires>now&&!data.takeover)
   return {status:"occupied",deviceLabel:active.label,expiresInMs:active.expires-now};
  const epoch=active&&active.token===data.token?active.epoch:(active?.epoch||0)+1;
  owner.set(uid,{token:data.token,epoch,label:data.label,expires:now+120000});
  return {status:"active",epoch,leaseMs:120000};
 }
 if(name==="pingPlayerSession"){
  if(!active||active.token!==data.token||active.expires<=now)
   return {status:"lost",reason:"other_device"};
  active.expires=now+120000;
  return {status:"active",epoch:active.epoch,leaseMs:120000};
 }
 if(name==="releasePlayerSession"){
  if(active?.token===data.token)active.expires=0;
  return {status:"released"};
 }
 if(name==="checkpointPlayerSession"){
  if(!active||active.token!==data.token||active.expires<=now)
   throw Object.assign(Error("Another device owns the session"),{code:"functions/failed-precondition"});
  const previous=cloud?.revision||0;
  if(previous!==data.expectedRevision)throw Object.assign(Error("Cloud revision changed"),{code:"functions/aborted"});
  cloud={ownerUid:uid,revision:previous+1,save:data.save};
  return {status:"saved",revision:cloud.revision,scoreVerified:false};
 }
 throw Error("Unknown callable "+name);
}
function device(label){
 const nodes=new Map(),storage=new Map(),persist=new Map();
 const account={uid,isAnonymous:false,email:"user@example.com"};
 let pauses=0,restarts=0;
 const document={hidden:false,
  getElementById(id){
   if(!nodes.has(id))nodes.set(id,{
    hidden:false,inert:false,textContent:"",classList:{toggle(){}},style:{},disabled:false
   });
   return nodes.get(id);
  },
  addEventListener(){}};
 const localStorage={
  getItem:k=>persist.get(k)||null,
  setItem:(k,v)=>persist.set(k,v),removeItem:k=>persist.delete(k)
 };
 const sessionStorage={
  getItem:k=>storage.get(k)||null,
  setItem:(k,v)=>storage.set(k,v)
 };
 const userAgent=label==="Phone"?"Mozilla/5.0 iPhone":"Desktop";
 const context=vm.createContext({
  localStorage,sessionStorage,document,
  Uint8Array,Date,console,
  window:{crypto:{getRandomValues(bytes){
   const seed=tokenSeed++;
   for(let i=0;i<bytes.length;i++)bytes[i]=(seed*43+i*17)%256;
   return bytes;
 }}},
  navigator:{userAgent},
  firebase:{
   functions(){return {}},
   app(){return {functions(){return {httpsCallable(fn){
     return async data=>({data:mockServer(fn,data)});
   }}}}}
  },
  accountAuth:()=>({currentUser:account}),
  accountControlsUpdate(){},
  playerSyncPause(){},
  playerSyncAnchor(){return null},
  playerSyncFingerprint(save){return save?JSON.stringify(save):null},
  inspectSeasonSave(raw){try{return JSON.parse(raw)}catch(_){return null}},
  accountCloudRef(){return {async get(){return {exists:Boolean(cloud),data:()=>cloud}}}},
  accountCloudRecordValid(data,u){return !!(data&&data.ownerUid===u.uid)},
  playerCloudUpdateNotice(){},
  stopSquadAttack(){pauses++},
  pauseBossClock(){},
  startSquadAttack(){restarts++},
  resumeBossClock(){},
  confirm:()=>true,
  setInterval(){}
 });
 vm.runInContext(source,context,{timeout:3000});
 return {context,nodes,storage,persist,document,account,
  get pauses(){return pauses},get restarts(){return restarts}};
}
async function flush(){for(let i=0;i<12;i++)await Promise.resolve()}
function phase(device){return vm.runInContext("sessionGuardPhase",device.context)}
async function run(){
 const pc=device("Desktop"),phone=device("Phone");
 pc.context.sessionGuardAccountChanged(pc.account);
 await flush();
 ok(phase(pc)==="active","First device obtains server lease");
 ok(pc.context.sessionGuardCanCheckpoint(),"Owner may request session checkpoint");
 phone.context.sessionGuardAccountChanged(phone.account);
 await flush();
 ok(phase(phone)==="occupied","Second device cannot silently acquire occupied lease");
 ok(phone.nodes.get("hero-view").inert===true&&phone.pauses>0,
  "Occupied phone gameplay is paused in UI");
 ok(phone.nodes.get("account-session-claim").hidden===false,
  "Take-over control is visible");
 ok(await phone.context.sessionGuardTakeover() &&
  phase(phone)==="active","Confirmed takeover transfers lease to phone");
 vm.runInContext('sessionGuardLastPing=0',pc.context);
 ok(!await pc.context.sessionGuardPing()&&phase(pc)==="lost"&&
    pc.nodes.get("hero-view").inert===true,"Old desktop loses lease at heartbeat");
 const save={schemaVersion:2,seasonId:"dynasty-ii",gold:100,
   playerLevel:1,maxLevel:2,currentLevel:2};
 let rejected=false;
 try{await pc.context.sessionGuardCheckpoint(save,0)}catch(_){rejected=true}
 ok(rejected,"Old owner cannot checkpoint");
 ok(await phone.context.sessionGuardCheckpoint(save,0)===1&&cloud.revision===1,
  "New owner checkpoints cloud atomically");
 const second={...save,maxLevel:20};
 rejected=false;
 try{await phone.context.sessionGuardCheckpoint(second,0)}catch(_){rejected=true}
 ok(rejected&&cloud.save.maxLevel===2,"Outdated expected revision rejected without overwriting");
 const tablet=device("Phone");
 tablet.context.sessionGuardAccountChanged(tablet.account);
 await flush();
 ok(phase(tablet)==="occupied","Third device cannot steal active session");
 await phone.context.sessionGuardRelease();
 now+=120001;
 await tablet.context.sessionGuardTakeover();
 await flush();
 ok(phase(tablet)==="review"&&tablet.nodes.get("hero-view").inert,
  "New device must review an existing cloud save before progressing");
 ok(!tablet.context.sessionGuardCanCheckpoint()&&
    tablet.context.sessionGuardCanCheckpoint(true),
  "Manual decision can checkpoint while automatic writes are blocked");
 const newSave={...save,maxLevel:32};
 ok(await tablet.context.sessionGuardCheckpoint(newSave,1,true)===2&&
    phase(tablet)==="active"&&cloud.save.maxLevel===32,
    "Explicit keep-local choice promotes reviewed device to active owner");
 // Missing server: new users continue local-first, not falsely labeled secure.
 owner.clear();cloud=null;functionsAvailable=false;
 const offline=device("Desktop");
 offline.context.sessionGuardAccountChanged(offline.account);
 await flush();
 ok(phase(offline)==="unconfigured"&&
    !offline.context.sessionGuardUsesServer(),"Absent functions never claim false server protection");
 ok(offline.nodes.get("account-session-status").textContent.includes("not active"),
   "Missing backend is visibly labelled unsecured");
 console.log("Client session-guard checks: "+passed+" passed.");
}
run().catch(error=>{console.error(error);process.exitCode=1});
