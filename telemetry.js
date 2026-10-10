// Anonymous opt-in balance analytics. No gameplay writes happen here.
// Network transport is separate from the save, score and message collections.
const BALANCE_SCHEMA_VERSION=1;
const BALANCE_COLLECTION="balance_telemetry_v1";
const BALANCE_CONSENT_KEY="hotc_balance_optin_v1";
const BALANCE_RUN_KEY="hotc_balance_run_v1";
const BALANCE_PENDING_KEY="hotc_balance_pending_v1";
const BALANCE_BUCKETS=Object.freeze([10,20,30,50,100,200,500,1000,2000,5000,10000,20000,
    50000,100000,200000,500000,1000000,2000000,5000000,10000000,
    20000000,50000000,100000000,1000000000]);
let balanceRun=null;
let balancePending=[];
let balanceLastWrite=0;
let balanceLastTick=Date.now();
let balanceLastLocalSave=0;
let balanceWriteBusy=false;
let balanceAuthTask=null;

function balanceEnabled(){
    return localStorage.getItem(BALANCE_CONSENT_KEY)==="yes";
}
function balanceClamp(value,max=1e12){
    const number=Number(value);
    return Number.isFinite(number)?Math.min(max,Math.max(0,number)):0;
}
function balanceBucket(stage){
    return String(BALANCE_BUCKETS.find(value=>balanceClamp(stage)<=value)||1000000000000);
}
function balanceRandomId(){
    return typeof crypto!=="undefined"&&typeof crypto.randomUUID==="function"
        ?crypto.randomUUID():null;
}
function balanceNewRun(nextDynasty=false){
    const id=balanceRandomId();
    if(!id)return null;
    return {schemaVersion:1,runId:id,seasonId:GAME_SEASON_ID,
        build:"1.11.0",dynasty:balanceClamp(dynastyCount+(nextDynasty?1:0),100000),
        startedAt:Date.now(),highestStage:balanceClamp(maxLevel-1),
        currentStage:balanceClamp(currentLevel),activeSeconds:0,
        bosses:{},campaigns:{started:0,claimed:0,won:0,lost:0},
        relics:{found:0,equipped:0},ended:false,endedStage:0};
}
function balanceValid(record){
    return record&&typeof record==="object"&&
        /^[0-9a-f-]{36}$/.test(record.runId||"")&&
        record.schemaVersion===1&&record.seasonId===GAME_SEASON_ID&&
        record.bosses&&typeof record.bosses==="object"&&
        record.campaigns&&typeof record.campaigns==="object"&&
        record.relics&&typeof record.relics==="object";
}
function balanceStore(){
    if(!balanceEnabled())return;
    try{
        if(balanceRun)localStorage.setItem(BALANCE_RUN_KEY,JSON.stringify(balanceRun));
        localStorage.setItem(BALANCE_PENDING_KEY,JSON.stringify(balancePending.slice(-3)));
    }catch(_error){/* Telemetry never blocks gameplay or autosaves. */}
}
function balanceRestore(){
    if(!balanceEnabled())return;
    try{
        const old=JSON.parse(localStorage.getItem(BALANCE_RUN_KEY)||"null");
        balanceRun=balanceValid(old)&&!old.ended?old:balanceNewRun();
        const pending=JSON.parse(localStorage.getItem(BALANCE_PENDING_KEY)||"[]");
        balancePending=Array.isArray(pending)?pending.filter(balanceValid).slice(-3):[];
    }catch(_error){balanceRun=balanceNewRun();balancePending=[];}
    balanceLastTick=Date.now();
    balanceStore();
}
function balanceStatus(message){
    const node=document.getElementById("balance-telemetry-status");
    if(node)node.textContent=message;
}
function balanceConsentChanged(allow){
    localStorage.setItem(BALANCE_CONSENT_KEY,allow?"yes":"no");
    if(allow){
        balanceRestore();
        balanceStatus("Enabled; collecting low-frequency run summaries.");
        balanceFlush(true);
    }else{
        balanceRun=null;
        balancePending=[];
        localStorage.removeItem(BALANCE_RUN_KEY);
        localStorage.removeItem(BALANCE_PENDING_KEY);
        balanceStatus("Disabled. Local telemetry deleted; previously uploaded data is not deleted.");
    }
}
function balanceForegroundTick(){
    const now=Date.now();
    const elapsed=Math.min(2,Math.max(0,(now-balanceLastTick)/1000));
    balanceLastTick=now;
    if(!balanceEnabled()||!balanceRun)return;
    if(!document.hidden)balanceRun.activeSeconds+=elapsed;
    if(now-balanceLastLocalSave>=30000){
        balanceLastLocalSave=now;
        balanceStore();
        balanceFlush(false);
    }
}
function balanceStageCleared(stage){
    if(!balanceEnabled()||!balanceRun)return;
    balanceRun.highestStage=Math.max(balanceRun.highestStage,balanceClamp(stage));
    balanceRun.currentStage=balanceClamp(currentLevel);
    balanceStore();
    if(BALANCE_BUCKETS.includes(stage))balanceFlush(true);
}
function balanceBossAttempt(stage,powerRatio){
    if(!balanceEnabled()||!balanceRun)return;
    const key="b"+balanceBucket(stage);
    const stats=balanceRun.bosses[key]||{attempts:0,wins:0,timeouts:0,
        winSeconds:0,powerSum:0};
    stats.attempts++;
    stats.powerSum+=balanceClamp(powerRatio,1e6);
    balanceRun.bosses[key]=stats;
    balanceStore();
}
function balanceBossResult(stage,cleared,seconds){
    if(!balanceEnabled()||!balanceRun)return;
    const stats=balanceRun.bosses["b"+balanceBucket(stage)];
    if(!stats)return;
    if(cleared){stats.wins++;stats.winSeconds+=balanceClamp(seconds,30);}
    else stats.timeouts++;
    balanceStore();
    balanceFlush(false);
}
function balanceCampaignStarted(){
    if(!balanceEnabled()||!balanceRun)return;
    balanceRun.campaigns.started++;
    balanceStore();
}
function balanceCampaignClaimed(success){
    if(!balanceEnabled()||!balanceRun)return;
    balanceRun.campaigns.claimed++;
    balanceRun.campaigns[success?"won":"lost"]++;
    balanceStore();balanceFlush(false);
}
function balanceRelicFound(){
    if(!balanceEnabled()||!balanceRun)return;
    balanceRun.relics.found++;balanceStore();
}
function balanceRelicEquipped(){
    if(!balanceEnabled()||!balanceRun)return;
    balanceRun.relics.equipped++;balanceStore();
}
function balanceDynastyEnded(stage){
    if(!balanceEnabled()||!balanceRun)return;
    balanceRun.ended=true;
    balanceRun.endedStage=balanceClamp(stage);
    balanceRun.highestStage=Math.max(balanceRun.highestStage,balanceRun.endedStage);
    balancePending.push(balanceRun);
    balancePending=balancePending.slice(-3);
    balanceRun=balanceNewRun(true);
    balanceStore();
    balanceFlush(true);
}
function balanceAuth(){
    if(typeof firebase.auth!=="function")
        return Promise.reject(new Error("Firebase Authentication SDK is unavailable"));
    const auth=firebase.auth();
    // Re-read currentUser first: the player may have linked their anonymous
    // telemetry identity to a real account or signed in as a different UID.
    if(auth.currentUser)return Promise.resolve(auth.currentUser);
    if(balanceAuthTask)return balanceAuthTask;
    balanceAuthTask=auth.signInAnonymously()
        .then(result=>result.user||auth.currentUser)
        .finally(()=>{balanceAuthTask=null;});
    return balanceAuthTask;
}
function balancePayload(run,uid){
    const bosses={};
    for(const [key,stat] of Object.entries(run.bosses||{}).slice(0,25)){
        if(!/^b[0-9]{1,13}$/.test(key))continue;
        bosses[key]={attempts:balanceClamp(stat.attempts,1e7),
            wins:balanceClamp(stat.wins,1e7),timeouts:balanceClamp(stat.timeouts,1e7),
            winSeconds:balanceClamp(stat.winSeconds,1e9),
            powerSum:balanceClamp(stat.powerSum,1e12)};
    }
    const c=run.campaigns||{},r=run.relics||{};
    return {
        schemaVersion:1,seasonId:GAME_SEASON_ID,build:"1.11.0",
        ownerUid:uid,startedAt:balanceClamp(run.startedAt,1e14),
        updatedAt:firebase.firestore.FieldValue.serverTimestamp(),
        dynasty:balanceClamp(run.dynasty,100000),
        highestStage:balanceClamp(run.highestStage),
        currentStage:balanceClamp(run.currentStage),
        activeSeconds:Math.floor(balanceClamp(run.activeSeconds,1e8)),
        ended:Boolean(run.ended),endedStage:balanceClamp(run.endedStage),
        bosses,campaigns:{
            started:balanceClamp(c.started,1e6),claimed:balanceClamp(c.claimed,1e6),
            won:balanceClamp(c.won,1e6),lost:balanceClamp(c.lost,1e6)
        },relics:{found:balanceClamp(r.found,1e6),equipped:balanceClamp(r.equipped,1e6)}
    };
}
function balanceFlush(priority=false){
    if(!balanceEnabled()||!balanceRun||balanceWriteBusy||document.hidden)return;
    const now=Date.now();
    const minimum=priority?60000:300000;
    if(now-balanceLastWrite<minimum&&balancePending.length===0)return;
    const record=balancePending[0]||balanceRun;
    balanceLastWrite=now;
    balanceWriteBusy=true;
    balanceAuth().then(user=>
        firebase.firestore().collection(BALANCE_COLLECTION)
            .doc(record.runId).set(balancePayload(record,user.uid))
    ).then(()=>{
        if(balancePending[0]===record)balancePending.shift();
        balanceStore();
        balanceStatus("Anonymous balancing data synchronized.");
    }).catch(error=>{
        balanceStatus("Balance sync unavailable; summary retained locally. Check Firebase setup.");
        console.warn("Balance telemetry upload failed:",error.code||error.message);
    }).finally(()=>{balanceWriteBusy=false;});
}
function balanceInit(){
    const input=document.getElementById("balance-telemetry-optin");
    if(!input)return;
    input.checked=balanceEnabled();
    if(balanceEnabled()){
        balanceRestore();
        balanceStatus("Enabled; anonymized data uploads periodically.");
    }
    input.addEventListener("change",()=>balanceConsentChanged(input.checked));
}
document.addEventListener("DOMContentLoaded",balanceInit);
setInterval(balanceForegroundTick,1000);
