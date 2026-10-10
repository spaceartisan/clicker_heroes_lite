// Standalone account/cloud save regression: no Firebase credentials or network.
const fs=require("node:fs");
const vm=require("node:vm");
const path=require("node:path");
const assert=require("node:assert/strict");
const root=path.join(__dirname,"..");
const storage=new Map();
const nodes=new Map();
let confirmDecision=true,reloads=0,remote=null,permissionDenied=false;
let simulateConcurrentEdit=false,saveCalls=0,transactionCount=0;
let currentUser={uid:"test-user-123",email:"test@example.com",isAnonymous:false};
let signIns=0,links=0,authEvent=null;
const auth={
 get currentUser(){return currentUser},
 onAuthStateChanged(callback){authEvent=callback;callback(currentUser);return ()=>{}},
 async createUserWithEmailAndPassword(email){currentUser={uid:"new-user",email,isAnonymous:false};signIns++;return {user:currentUser}},
 async signInWithEmailAndPassword(email){currentUser={uid:"existing-user",email,isAnonymous:false};signIns++;return {user:currentUser}},
 async signInWithPopup(){currentUser={uid:"google-user",email:"google@example.com",isAnonymous:false};signIns++;return {user:currentUser}},
 async signOut(){currentUser=null;return undefined}
};
function makeNode(){
 return {textContent:"",value:"",hidden:false,disabled:false,children:[],
  classList:{toggle(){},add(){},remove(){}},
  append(){},getContext(){return null}};
}
const document={
 hidden:false,
 getElementById(id){if(!nodes.has(id))nodes.set(id,makeNode());return nodes.get(id)},
 addEventListener(){ }
};
const localStorage={
 getItem(k){return storage.has(k)?storage.get(k):null},
 setItem(k,v){storage.set(k,v)},
 removeItem(k){storage.delete(k)}
};
function firestore(){return {}}
firestore.FieldValue={serverTimestamp:()=>({__serverTimestamp:true})};
const firebase={auth:()=>auth,firestore};
firebase.auth.EmailAuthProvider={credential:(email,password)=>({email,password})};
firebase.auth.GoogleAuthProvider=class {};
const ref={async get(){
 if(permissionDenied)throw {code:"permission-denied"};
 return {exists:remote!==null,data:()=>remote};
}};
const db={
 collection(name){assert.equal(name,"player_saves");return {doc(uid){
 assert.equal(uid,currentUser.uid);return ref;
 }}},
 async runTransaction(callback){
  transactionCount++;
  let pending=null;
  const tx={
   async get(){if(simulateConcurrentEdit && remote)remote={...remote,revision:remote.revision+1};
    return {exists:remote!==null,data:()=>remote}},
   set(_doc,doc){pending=doc}
  };
  await callback(tx);
  assert.ok(pending,"A successful transaction must write its document");
  remote=pending;
 }
};
const ctx=vm.createContext({
 document,localStorage,db,firebase,
 window:{location:{reload(){reloads++}}},
 setInterval:()=>1,
 confirm:()=>confirmDecision,console,Date,
 saveGame(){saveCalls++},isCurrentSeasonSave:undefined
});
const code=fs.readFileSync(path.join(root,"season.js"),"utf8")+
 "\n"+fs.readFileSync(path.join(root,"player-account.js"),"utf8");
vm.runInContext(code,ctx,{timeout:2500,filename:"account scripts"});
const local={schemaVersion:2,seasonId:"dynasty-ii",gold:180,
 playerLevel:8,maxLevel:21,bestSeasonStage:30,dynastyCount:2,
 playerName:"Player One",lastSaved:1700000000000};
function editLocal(data){localStorage.setItem("clickerHeroSave",JSON.stringify(data))}
function freshUser(uid){currentUser={uid,email:uid+"@example.com",isAnonymous:false}}
let passed=0;
function ok(value,label){assert.ok(value,label);console.log("PASS "+label);passed++}
async function run(){
 editLocal(local);
 const valid=ctx.accountValidSave;
 ok(valid(local),"Valid Season II save accepted");
 ok(!valid({...local,seasonId:"legacy"}) && !valid({...local,gold:Infinity}) &&
    !valid({...local,maxLevel:null===null?Infinity:0}),
    "Invalid and cross-season save rejected");
 ok(!valid({...local,playerName:"X".repeat(700000)}),"Oversized cloud save refused");
 ok(ctx.accountSaveSummary(local).includes("30") &&
    ctx.accountSaveSummary(local).includes("Player One"),"Human-readable progress comparison");
 ok(ctx.accountCloudDocument(currentUser,local,1).ownerUid==="test-user-123" &&
    ctx.accountCloudDocument(currentUser,local,1).revision===1,
    "Cloud envelope uses owner UID and revision");
 ok(await ctx.playerCheckCloudSave(),"No-cloud lookup succeeds for signed-in account");
 ok(remote===null,"Read-only lookup makes no writes");
 ok(await ctx.playerBackupCloudSave()&&remote.revision===1 &&
    remote.ownerUid===currentUser.uid && remote.save.gold===180,
    "First explicit backup saves a private revision-1 document");
 ok(transactionCount===1 && saveCalls===1,"One transaction per requested backup");
 editLocal({...local,gold:390,maxLevel:40});
 confirmDecision=false;
 ok(!await ctx.playerBackupCloudSave()&&remote.revision===1&&remote.save.gold===180,
    "Reject overwrite prompt leaves cloud save unchanged");
 confirmDecision=true;
 simulateConcurrentEdit=true;
 ok(!await ctx.playerBackupCloudSave()&&remote.save.gold===180,
    "Concurrent change forces revision conflict without overwriting remote save");
 simulateConcurrentEdit=false;
 ok(await ctx.playerBackupCloudSave()&&remote.revision===3&&remote.save.gold===390,
    "Accepted overwrite advances revision and copies chosen save");
 ok(reloads===0,"Cloud upload never reloads or overwrites local play");
 const newerLocal={...local,gold:999,maxLevel:120};
 editLocal(newerLocal);
 confirmDecision=false;
 ok(!await ctx.playerRestoreCloudSave()&&reloads===0 &&
    JSON.parse(localStorage.getItem("clickerHeroSave")).gold===999,
    "Rejecting restore leaves current local game unchanged");
 confirmDecision=true;
 ok(await ctx.playerRestoreCloudSave()&&reloads===1 &&
    JSON.parse(localStorage.getItem("clickerHeroSave")).gold===390 &&
    JSON.parse(localStorage.getItem("clickerHeroSave_before_cloud_restore")).gold===999,
    "Restore writes recovery copy before replacing local save and reloading");
 ok(ctx.accountValidSave(JSON.parse(localStorage.getItem("clickerHeroSave_before_cloud_restore"))) &&
    ctx.playerExportCloudRecovery !== undefined,
    "Recovery export is available without Firebase or a developer console");
 editLocal(newerLocal);
 permissionDenied=true;
 ok(!await ctx.playerCheckCloudSave() && !await ctx.playerBackupCloudSave() &&
    JSON.parse(localStorage.getItem("clickerHeroSave")).gold===999 &&
    nodes.get("player-cloud-status").textContent.includes("Firestore rules"),
    "Firestore permission errors never erase local save");
 permissionDenied=false;
 remote={...remote,save:{...local,seasonId:"legacy"}};
 ok(!await ctx.playerRestoreCloudSave() && reloads===1,
    "Incompatible cloud season cannot restore");
 remote=null;currentUser={uid:"temporary-anon",isAnonymous:true};
 ok(!await ctx.playerBackupCloudSave()&&remote===null,
    "Anonymous user cannot upload a player save from UI");
 freshUser("email-linked");
 document.getElementById("player-account-email").value="new@example.com";
 document.getElementById("player-account-password").value="newpassword123";
 currentUser={uid:"anonymous-to-link",isAnonymous:true,
  async linkWithCredential(credential){
   links++;currentUser={uid:"anonymous-to-link",email:credential.email,isAnonymous:false};
   return {user:currentUser};
  }};
 ok(await ctx.playerEmailAccount(true) && links===1 && currentUser.uid==="anonymous-to-link" &&
    document.getElementById("player-account-password").value==="",
    "Email registration links existing anonymous identity and clears password");
 document.getElementById("player-account-password").value="password123";
 ok(await ctx.playerEmailAccount(false)&&signIns===1&&currentUser.uid==="existing-user",
    "Existing email player signs in without creating a second account");
 ok(await ctx.playerGoogleAccount(false)&&currentUser.uid==="google-user",
    "Existing Google account sign-in works");
 currentUser={uid:"anon-google-uid",isAnonymous:true,
  async linkWithPopup(){
   links++;currentUser={uid:"anon-google-uid",email:"newgoogle@example.com",isAnonymous:false};
   return {user:currentUser};
  }};
 ok(await ctx.playerGoogleAccount(true) && currentUser.uid==="anon-google-uid",
    "New Google account links anonymous identity without changing UID");
 confirmDecision=true;
 ok(await ctx.playerAccountSignOut()&&currentUser===null &&
    JSON.parse(localStorage.getItem("clickerHeroSave")).gold===999,
    "Sign out leaves local progress untouched");

 // Guarded background cloud backup may start only from a trusted manual revision.
 freshUser("auto-uid");
 remote=null;
 editLocal({...local,gold:1000});
 ok(!await ctx.playerSetAutoCloudSync(true),
    "Automatic cloud backup cannot enable before manual sync establishes a revision");
 ok(await ctx.playerBackupCloudSave()&&remote.revision===1,
    "Manual backup establishes revision and local content anchor");
 ok(await ctx.playerSetAutoCloudSync(true)&&ctx.playerSyncEnabled(),
    "Opt-in enables guarded automatic uploads after verifying remote revision");
 const writesBefore=transactionCount;
 editLocal({...local,gold:1000,lastSaved:Date.now()+10000,lastSubmittedScore:421});
 vm.runInContext("playerSyncLastCheck=Date.now()-PLAYER_SYNC_CHECK_MS-10",ctx);
 ok(!await ctx.playerSyncCloudTick()&&transactionCount===writesBefore,
    "Heartbeat and leaderboard bookkeeping alone do not upload again");
 editLocal({...local,gold:1500,maxLevel:45,lastSaved:Date.now()});
 vm.runInContext("playerSyncLastCheck=Date.now()-PLAYER_SYNC_CHECK_MS-10",ctx);
 ok(await ctx.playerSyncCloudTick()&&remote.revision===2&&remote.save.gold===1500,
    "Changed local progress automatically uploads against known revision");
 document.hidden=true;
 editLocal({...local,gold:1800,maxLevel:50});
 vm.runInContext("playerSyncLastCheck=Date.now()-PLAYER_SYNC_CHECK_MS-10",ctx);
 ok(!await ctx.playerSyncCloudTick()&&remote.revision===2,
    "Background tab cannot perform automatic cloud backups");
 document.hidden=false;
 remote={...remote,revision:3,save:{...local,gold:9999,maxLevel:90}};
 vm.runInContext("playerSyncLastCheck=Date.now()-PLAYER_SYNC_CHECK_MS-10",ctx);
 ok(!await ctx.playerSyncCloudTick()&&!ctx.playerSyncEnabled()&&
    remote.save.gold===9999&&
    JSON.parse(localStorage.getItem("clickerHeroSave")).gold===1800,
    "Remote revision change pauses automatic upload without losing either save");
 ok(!await ctx.playerSyncCloudTick()&&remote.save.gold===9999,
    "Paused uploader does not retry or overwrite other device's progress");
 ok(!await ctx.playerSetAutoCloudSync(true)&&!ctx.playerSyncEnabled(),
    "Cannot re-enable against a newer remote revision without explicit manual decision");
 remote=null;
 ok(await ctx.playerBackupCloudSave()&&remote.revision===1,
    "After explicit review, manual cloud backup can establish a new confirmed revision");
 ok(await ctx.playerSetAutoCloudSync(true)&&ctx.playerSyncEnabled(),
    "Manual resynchronization can deliberately re-enable uploads");
 vm.runInContext("playerSyncInFlight=true",ctx);
 ok(!await ctx.playerBackupCloudSave() &&
    !await ctx.playerRestoreCloudSave() &&
    !await ctx.playerCheckCloudSave(),
    "Manual cloud actions cannot race with automatic backup");
 vm.runInContext("playerSyncInFlight=false",ctx);
 ok(await ctx.playerSetAutoCloudSync(false)&&!ctx.playerSyncEnabled(),
    "Disabling automatic backup leaves local and cloud saves intact");

 // A second signed-in device detects but never silently loads the PC save.
 freshUser("phone-uid");
 const pcProgress={...local,gold:8200,maxLevel:125,bestSeasonStage:126};
 remote={ownerUid:"phone-uid",schemaVersion:1,seasonId:"dynasty-ii",
   revision:4,updatedAt:{__serverTimestamp:true},save:pcProgress};
 editLocal({...local,gold:300,maxLevel:12,bestSeasonStage:12});
 const beforeDiscovery=JSON.parse(localStorage.getItem("clickerHeroSave")).gold;
 ok(await ctx.playerCloudDiscover(true) &&
    !document.getElementById("cloud-sync-notice").hidden &&
    document.getElementById("cloud-sync-notice-text").textContent.includes("125")===false &&
    document.getElementById("cloud-sync-notice-text").textContent.includes("126") &&
    JSON.parse(localStorage.getItem("clickerHeroSave")).gold===beforeDiscovery,
    "Phone detects newer PC cloud save without replacing its local progress");
 const comparison=document.getElementById("player-cloud-preview").textContent;
 ok(comparison.includes("This device:")&&comparison.includes("Cloud:")&&
    comparison.includes("Revision 4")&&comparison.includes("12")&&comparison.includes("126"),
    "Cloud review compares distinct local and remote stage records");
 ctx.playerCloudDismissNotice();
 ok(document.getElementById("cloud-sync-notice").hidden &&
    await ctx.playerCloudDiscover(true) &&
    document.getElementById("cloud-sync-notice").hidden,
    "Dismissing a known cloud revision does not repeatedly nag");
 remote={...remote,revision:5,save:{...pcProgress,gold:9900,maxLevel:170,bestSeasonStage:171}};
 ok(await ctx.playerCloudDiscover(true) &&
    !document.getElementById("cloud-sync-notice").hidden,
    "A newly uploaded cloud revision resurfaces a dismissed notice");
 const localBeforeRestore=localStorage.getItem("clickerHeroSave");
 const reloadsBefore=reloads;
 confirmDecision=false;
 ok(!await ctx.playerRestoreCloudSave()&&
    localStorage.getItem("clickerHeroSave")===localBeforeRestore,
    "Declined cross-device restore cannot erase phone progress");
 confirmDecision=true;
 ok(await ctx.playerRestoreCloudSave()&&reloads===reloadsBefore+1&&
    JSON.parse(localStorage.getItem("clickerHeroSave")).gold===9900&&
    localStorage.getItem("clickerHeroSave_before_cloud_restore")===localBeforeRestore,
    "Accepted PC-to-phone restore preserves a recovery copy and reloads");
 remote=null;
 ok(await ctx.playerCloudDiscover(true)&&
    document.getElementById("cloud-sync-notice").hidden&&
    document.getElementById("player-cloud-discovery-status").textContent.includes("No cloud backup"),
    "Missing cloud backup is explained rather than presented as synced");
 permissionDenied=true;
 ok(!await ctx.playerCloudDiscover(true)&&
    document.getElementById("player-cloud-discovery-status").textContent.includes("Firestore rules")&&
    !document.getElementById("cloud-sync-notice").hidden,
    "Firestore read errors show a discoverable error without changing local saves");
 permissionDenied=false;
 console.log("Player Account regression: "+passed+" passed.");
}
run().catch(error=>{console.error(error);process.exitCode=1});
