"use strict";
// Read-only balance report: Firebase rules, not browser controls, enforce admin access.
firebase.initializeApp(firebaseConfig);
const balanceAdminAuth=firebase.auth(),balanceAdminDB=firebase.firestore();
const el=id=>document.getElementById(id);
let report={runs:[],current:[],legacy:[]};
function safe(v,max=1e12){const n=Number(v);return Number.isFinite(n)?Math.min(max,Math.max(0,n)):0;}
function fmt(v){return Math.round(safe(v,1e15)).toLocaleString();}
function setStatus(text){el("status").textContent=text;}
function sum(rows,key){return rows.reduce((n,r)=>n+safe(r[key]),0);}
function percent(n,total){return total?(100*n/total).toFixed(1)+"%":"—";}
function stat(parent,label,value){
 const card=document.createElement("article");card.className="metric";
 const big=document.createElement("strong"),small=document.createElement("span");
 big.textContent=String(value);small.textContent=label;card.append(big,small);parent.appendChild(card);
}
function stageBucket(stage){
 const n=safe(stage);
 for(const upper of [10,50,100,200,500,1000,5000,10000,100000,1000000,10000000,100000000]){
  if(n<=upper)return "≤ "+fmt(upper);
 }return ">100M";
}
function histogram(id,items,key){
 const root=el(id);root.replaceChildren();
 if(!items.length){root.textContent="No records.";return;}
 const order=["≤ 10","≤ 50","≤ 100","≤ 200","≤ 500","≤ 1,000","≤ 5,000",
 "≤ 10,000","≤ 100,000","≤ 1,000,000","≤ 10,000,000","≤ 100,000,000",">100M"];
 const buckets=new Map();
 for(const item of items){
  const label=stageBucket(item[key]);
  buckets.set(label,(buckets.get(label)||0)+1);
 }
 const max=Math.max(...buckets.values());
 for(const label of order){
  const n=buckets.get(label);if(!n)continue;
  const row=document.createElement("div");row.className="hist-row";
  const title=document.createElement("span");title.textContent=label;
  const back=document.createElement("div");back.className="bar-back";
  const fill=document.createElement("div");fill.className="bar-fill";
  fill.style.width=(100*n/max).toFixed(1)+"%";back.appendChild(fill);
  const number=document.createElement("span");number.className="hist-count";number.textContent=n;
  row.append(title,back,number);root.appendChild(row);
 }
}
function clean(input){
 if(!input||typeof input!=="object")throw Error("Expected an object with runs, current, and legacy arrays.");
 const array=(value)=>Array.isArray(value)?value.slice(0,3000):[];
 return {
  runs:array(input.runs).map(r=>({
   highestStage:safe(r.highestStage),currentStage:safe(r.currentStage),
   endedStage:safe(r.endedStage),ended:r.ended===true,activeSeconds:safe(r.activeSeconds,1e8),
   bosses:Object.fromEntries(Object.entries(r.bosses||{}).filter(([k])=>/^b[0-9]{1,13}$/.test(k)).slice(0,25)
     .map(([k,s])=>[k,Object.fromEntries(["attempts","wins","timeouts","winSeconds","powerSum"]
       .map(field=>[field,safe(s[field])]))])),
   campaigns:Object.fromEntries(["started","claimed","won","lost"].map(k=>[k,safe(r.campaigns?.[k])])),
   relics:Object.fromEntries(["found","equipped"].map(k=>[k,safe(r.relics?.[k])]))
  })),
  current:array(input.current).map(r=>({score:safe(r.score)})),
  legacy:array(input.legacy).map(r=>({score:safe(r.score)}))
 };
}
function display(){
 const overview=el("overview"),feature=el("feature-summary"),tbody=el("boss-results");
 overview.replaceChildren();feature.replaceChildren();tbody.replaceChildren();
 const runs=report.runs,finished=runs.filter(r=>r.ended);
 stat(overview,"Opt-in Dynasty runs",fmt(runs.length));
 stat(overview,"Rebirths recorded",fmt(finished.length));
 stat(overview,"Season II leaderboard entries",fmt(report.current.length));
 stat(overview,"Legacy leaderboard entries",fmt(report.legacy.length));
 stat(overview,"Foreground hours",(sum(runs,"activeSeconds")/3600).toFixed(1));
 stat(overview,"Highest observed run stage",fmt(Math.max(0,...runs.map(r=>r.highestStage))));
 histogram("season-current",report.current,"score");
 histogram("season-legacy",report.legacy,"score");
 histogram("run-stages",runs,"currentStage");
 histogram("rebirth-stages",finished,"endedStage");
 const bosses=new Map();
 for(const run of runs)for(const [bucket,stats] of Object.entries(run.bosses)){
  if(!/^b[0-9]{1,13}$/.test(bucket))continue;
  if(!bosses.has(bucket))bosses.set(bucket,{attempts:0,wins:0,timeouts:0,winSeconds:0,powerSum:0});
  const combined=bosses.get(bucket);
  for(const key of Object.keys(combined))combined[key]+=safe(stats[key]);
 }
 if(!bosses.size){
  const row=document.createElement("tr"),cell=document.createElement("td");
  cell.colSpan=7;cell.textContent="No boss timing records yet.";row.appendChild(cell);tbody.appendChild(row);
 }
 for(const [bucket,s] of [...bosses].sort((a,b)=>Number(a[0].slice(1))-Number(b[0].slice(1)))){
  const row=document.createElement("tr");
  for(const value of [bucket.slice(1),fmt(s.attempts),fmt(s.wins),fmt(s.timeouts),
   percent(s.timeouts,s.attempts),s.wins?(s.winSeconds/s.wins).toFixed(1)+"s":"—",
   s.attempts?(s.powerSum/s.attempts).toFixed(2)+"×":"—"]){
    const cell=document.createElement("td");cell.textContent=value;row.appendChild(cell);
  }tbody.appendChild(row);
 }
 const campaigns=runs.map(r=>r.campaigns),relics=runs.map(r=>r.relics);
 stat(feature,"Campaigns launched",fmt(sum(campaigns,"started")));
 stat(feature,"Campaigns claimed",fmt(sum(campaigns,"claimed")));
 stat(feature,"Campaign successes",fmt(sum(campaigns,"won")));
 stat(feature,"Campaign failures",fmt(sum(campaigns,"lost")));
 stat(feature,"Relics found",fmt(sum(relics,"found")));
 stat(feature,"Relic equipment changes",fmt(sum(relics,"equipped")));
}
async function loadScores(collection){
 const snap=await balanceAdminDB.collection(collection).orderBy("score","desc").limit(2000).get();
 return snap.docs.map(d=>({score:safe(d.data().score)}));
}
async function loadLive(){
 el("load-live").disabled=true;
 setStatus("Checking admin privileges and querying Firebase...");
 try{
  const user=balanceAdminAuth.currentUser;
  if(!user)throw Error("Sign in with an administrator account.");
  const claim=await user.getIdTokenResult(true);
  if(claim.claims.balanceAdmin!==true)throw Error("Account is missing balanceAdmin custom claim.");
  const [telemetry,current,legacy]=await Promise.all([
   balanceAdminDB.collection("balance_telemetry_v1").orderBy("updatedAt","desc").limit(2000).get(),
   loadScores("scores_dynasty_ii"),loadScores("scores")]);
  report=clean({runs:telemetry.docs.map(d=>d.data()),current,legacy});
  display();el("export-data").disabled=false;
  setStatus("Live data loaded. Up to 2,000 runs and top 2,000 scores per season.");
 }catch(error){setStatus("Live data unavailable: "+error.message);}
 finally{el("load-live").disabled=!balanceAdminAuth.currentUser;}
}
el("login").addEventListener("submit",async event=>{
 event.preventDefault();const input=new FormData(event.currentTarget);
 try{
  await balanceAdminAuth.signInWithEmailAndPassword(String(input.get("email")),String(input.get("password")));
  el("login").querySelector('[name="password"]').value="";
  await loadLive();
 }catch(error){setStatus("Sign-in failed: "+error.message);}
});
el("load-live").addEventListener("click",loadLive);
el("logout").addEventListener("click",async()=>{await balanceAdminAuth.signOut();setStatus("Signed out.");});
balanceAdminAuth.onAuthStateChanged(user=>{
 el("login").hidden=Boolean(user);el("load-live").disabled=!user;el("logout").disabled=!user;
});
el("import-data").addEventListener("change",async event=>{
 const file=event.target.files?.[0];if(!file)return;
 try{
  if(file.size>4000000)throw Error("Import file exceeds 4 MB.");
  report=clean(JSON.parse(await file.text()));
  display();el("export-data").disabled=false;
  setStatus("Local report loaded: "+report.runs.length+" run records.");
 }catch(error){setStatus("Import failed: "+error.message);}
});
el("export-data").addEventListener("click",()=>{
 const blob=new Blob([JSON.stringify(report,null,2)],{type:"application/json"});
 const url=URL.createObjectURL(blob),a=document.createElement("a");
 a.href=url;a.download="hotc-balance-report.json";a.click();URL.revokeObjectURL(url);
});
display();