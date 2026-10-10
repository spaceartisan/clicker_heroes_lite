// Dedicated Firebase-connected leaderboard regression. No live credentials/network.
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const assert=require("node:assert/strict");
const root=path.join(__dirname,"..");
const records=new Map();
const nodes=new Map();
let user=null,peak=35,writes=0,swapOnRead=null,deny=false;
function element(){
 return {value:"",textContent:"",disabled:false,hidden:false,style:{display:"none"},
  classList:{toggle(){}},addEventListener(){}};
}
const document={
 getElementById(id){if(!nodes.has(id))nodes.set(id,element());return nodes.get(id)},
 addEventListener(){}
};
const auth={get currentUser(){return user}};
const firestore=()=>({});
firestore.FieldValue={serverTimestamp:()=>({__timestamp:true})};
const firebase={auth:()=>auth,firestore};
const db={
 collection(name){
  assert.equal(name,"scores_accounts_dynasty_ii");
  return {doc(uid){
   return {async get(){
    if(deny)throw {code:"permission-denied"};
    return {exists:records.has(uid),data:()=>records.get(uid)};
   }};
  }};
 },
 async runTransaction(fn){
  let pending=null,writeId=null;
  const tx={
   async get(ref){
    if(deny)throw {code:"permission-denied"};
    if(swapOnRead){user={...swapOnRead};swapOnRead=null;}
    // Collection path is carried by the record target during transaction test.
    const uid=initialTransactionUid;
    return {exists:records.has(uid),data:()=>records.get(uid)};
   },
   set(ref,value){pending=value;writeId=value.ownerUid;}
  };
  const result=await fn(tx);
  if(pending){records.set(writeId,pending);writes++;}
  return result;
 }
};
let initialTransactionUid=null;
const originalCollection=db.collection.bind(db);
db.collection=function(name){
 const collection=originalCollection(name);
 return {doc(uid){
  initialTransactionUid=uid;
  return collection.doc(uid);
 }};
};
let logs=0;
const ctx=vm.createContext({
 document,db,firebase,console,Date,
 leaderboardSelectedSeason:"dynasty-ii",
 bestSeasonStage:1,maxLevel:35
});
vm.runInContext(
 fs.readFileSync(path.join(root,"season.js"),"utf8")+"\n"+
 fs.readFileSync(path.join(root,"account-leaderboard.js"),"utf8"),
 ctx,{filename:"ranking scripts",timeout:2000}
);
let passed=0;
function check(v,label){assert.ok(v,label);passed++;console.log("PASS "+label)}
async function settle(){await Promise.resolve();await Promise.resolve();}
async function run(){
 check(ctx.getLeaderboardSeason("accounts").collection==="scores_accounts_dynasty_ii"&&
  ctx.getLeaderboardSeason("legacy").collection==="scores"&&
  ctx.getLeaderboardSeason("dynasty-ii").collection==="scores_dynasty_ii",
  "Separate account board preserves both existing seasons");
 check(ctx.accountRankingNameValid("Realm Hero")&&
  !ctx.accountRankingNameValid("")&&
  !ctx.accountRankingNameValid("Bad<script>")&&
  !ctx.accountRankingNameValid("x".repeat(21)),
  "Public display names are length and character checked");
 check(!await ctx.publishAccountRanking()&&writes===0,
  "Signed-out guests cannot publish account score");
 user={uid:"guest-uid",isAnonymous:true,email:null};
 check(!await ctx.publishAccountRanking()&&writes===0,
  "Anonymous telemetry identities cannot publish account scores");
 user={uid:"alice",isAnonymous:false,email:"alice@example.com"};
 ctx.accountRankingShowControls();await settle();
 check(!nodes.get("account-ranking-publish").disabled&&
  nodes.get("account-ranking-status").textContent.includes("No account ranking"),
  "Authenticated player can prepare a new UID-owned entry");
 nodes.get("account-ranking-name").value="<script>";
 check(!await ctx.publishAccountRanking()&&writes===0,
  "HTML injection in public nickname cannot be submitted");
 nodes.get("account-ranking-name").value="Alice Hero";
 check(await ctx.publishAccountRanking()&&writes===1&&
  records.get("alice").ownerUid==="alice"&&
  records.get("alice").score===35&&
  records.get("alice").seasonId==="dynasty-ii",
  "First publish writes one document keyed by authenticated UID");
 check(ctx.accountRankingRecordValid(records.get("alice"),"alice")&&
  !ctx.accountRankingRecordValid(records.get("alice"),"bob"),
  "Account ownership is validated independently of public names");
 peak=12;ctx.maxLevel=12;nodes.get("account-ranking-name").value="Alice Renamed";
 check(await ctx.publishAccountRanking()&&
  records.get("alice").score===35&&records.get("alice").name==="Alice Renamed",
  "Lower local progress never decreases a previously ranked score");
 peak=203;ctx.maxLevel=203;nodes.get("account-ranking-name").value="Alice Hero";
 check(await ctx.publishAccountRanking()&&records.get("alice").score===203,
  "Higher later score increases the same UID-owned record");
 user={uid:"bob",isAnonymous:false,email:"bob@example.com"};
 ctx.accountRankingAuthChanged();
 ctx.accountRankingShowControls();await settle();
 check(nodes.get("account-ranking-name").value===""&&
  records.get("alice").score===203,
  "Switching accounts clears the prior nickname without touching prior record");
 nodes.get("account-ranking-name").value="Alice Hero";
 check(await ctx.publishAccountRanking()&&records.get("bob").ownerUid==="bob"&&
  records.get("bob").name==="Alice Hero"&&records.get("alice").score===203,
  "Two different UIDs may share one display name without hijacking a record");
 user={uid:"alice",isAnonymous:false,email:"alice@example.com"};
 ctx.accountRankingAuthChanged();ctx.accountRankingShowControls();await settle();
 check(nodes.get("account-ranking-name").value==="Alice Hero",
  "Returning owner reloads previously published public name");
 records.set("alice",{...records.get("alice"),ownerUid:"forged"});
 const before=writes;
 check(!await ctx.publishAccountRanking()&&writes===before,
  "Malformed or foreign owner records are not overwritten");
 records.set("alice",{...records.get("alice"),ownerUid:"alice"});
 swapOnRead={uid:"bob",isAnonymous:false,email:"bob@example.com"};
 check(!await ctx.publishAccountRanking()&&writes===before,
  "Account switching mid-transaction cancels submission");
 user={uid:"alice",isAnonymous:false,email:"alice@example.com"};
 deny=true;
 check(!await ctx.publishAccountRanking()&&
  nodes.get("account-ranking-status").textContent.includes("rules"),
  "Rules-permission failures give actionable feedback, not fake success");
 deny=false;
 ctx.accountRankingAuthChanged();ctx.accountRankingShowControls();await settle();
 check(ctx.accountRankingCurrentScore()===203,"Publishing captures Season II's actual peak");
 peak=1e20;ctx.maxLevel=1e20;
 check(ctx.accountRankingCurrentScore()===1e12,"Extreme stage scores stay in bounded rule range");
 check(writes===4,"Only explicit valid publications wrote records");
 console.log("Connected account ranking tests: "+passed+" passed.");
}
run().catch(error=>{console.error(error);process.exitCode=1});
