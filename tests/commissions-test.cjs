const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
const nodes = new Map();
function element() { return {textContent:'',children:[],disabled:false,style:{},
 append(...items){this.children.push(...items);},replaceChildren(...items){this.children=items;},
 attributes:{},events:{},classList:{toggle(){}},setAttribute(key,value){this.attributes[key]=value;},addEventListener(name,fn){this.events[name]=fn;},focus(){this.focused=true;}}; }
const context = vm.createContext({
 document:{getElementById(id){if(!nodes.has(id))nodes.set(id,element());return nodes.get(id);},createElement:element,querySelector(){return null;}},
 maxLevel:1,dynastyCount:0,playerLevel:1,playerGearLevel:0,gold:0,
 structures:{castle:{level:1},tavern:{level:0},blacksmith:{level:0},barracks:{level:0},market:{level:0}},
 hiredMercenaries:[],passiveAbilities:[{level:1}],RESEARCH_NODES:[],ACADEMY_DISCIPLINES:[],academyDisciplines:{},
 canResearchNode:()=>false,getResearchInsightAvailable:()=>0,getAcademyDisciplineCost:()=>4,
 structureLockReason:id=>id==='tavern'&&context.maxLevel<=10?'Clear stage 10':'',getStructureCost:()=>1000,
 blocked:false,sessionGuardBlocksGameplay:()=>context.blocked,
 saveGame(){if(context.failSave)throw Error('full');context.saved=run('JSON.stringify(royalCommissions)');},
 updateUI(){},drawKingdom(){},formatDigits:n=>String(n),openGameDialog(id){context.opened=id;},closeGameDialog(id){context.closed=id;},
 switchView(view){context.view=view;},openResearchTree(){context.opened='research';},showMenu(id){context.opened=id;}
});
const run = code => vm.runInContext(code,context);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../commissions.js'),'utf8'),context);
let checks=0;function check(code,label){assert.ok(run(code),label);checks++;}
run('loadRoyalCommissions(null)');
check('royalCommissions.jobs.length===3','Old saves get three requests');
check('royalCommissions.jobs.every(j=>j.goals.every(g=>g.progress===0))','No retroactive completion');
check('royalCommissions.jobs.every(j=>j.goals.every(g=>!["research","building","squad"].includes(g.type)))','Starter goals avoid locked or unavailable systems');
check('!finishCommission(royalCommissions.jobs[0].id,true)','Incomplete request cannot pay');
run('recordCommissionEvent("enemy",100,1);recordCommissionEvent("hero",3)');
check('commissionComplete(royalCommissions.jobs[0])','Multiple real objectives are required');
run('const oldId=royalCommissions.jobs[0].id; const reward=commissionReward(royalCommissions.jobs[0].stage)');
check('finishCommission(oldId,true)&&gold===reward','Claim pays the posted gold');
check('!finishCommission(oldId,true)&&gold===reward','Stale double claim cannot pay twice');
check('royalCommissions.completed===1&&royalCommissions.jobs.length===3','Claim records lifetime completion and replaces only one request');
run('loadRoyalCommissions(JSON.parse(saved))');
check('!finishCommission(oldId,true)&&royalCommissions.completed===1','Reload cannot replay the claimed ID');
run('recordCommissionEvent("enemy",4,1); const beforeReplaceGold=gold; const replacedId=royalCommissions.jobs[0].id; finishCommission(replacedId,false); const replacement=JSON.stringify(royalCommissions.jobs); loadRoyalCommissions(JSON.parse(saved))');
check('gold===beforeReplaceGold && JSON.stringify(royalCommissions.jobs)===replacement','Replacement (including duplicate brief kinds) survives reload without payout');
check('royalCommissions.jobs[0].goals.every(g=>g.progress===0)','Replacement discards its old progress');
run('maxLevel=1001; renewRoyalCommissions(); recordCommissionEvent("enemy",100,1)');
check('royalCommissions.jobs[0].stage===800&&royalCommissions.jobs[0].goals[0].progress===0','Old-stage farming cannot complete a high-stage contract');
run('recordCommissionEvent("enemy",100,800)');
check('royalCommissions.jobs[0].goals[0].progress===royalCommissions.jobs[0].goals[0].target','Current-stage kills count and are capped');
run('const frozen=JSON.stringify(royalCommissions); blocked=true; recordCommissionEvent("hero",100)');
check('!finishCommission(royalCommissions.jobs[0].id,false)&&JSON.stringify(royalCommissions)===frozen','Paused device cannot earn, replace or claim commissions');
run('blocked=false; recordCommissionEvent("hero",100); const completeState=JSON.stringify(royalCommissions); const goldBeforeFailure=gold; failSave=true');
check('!finishCommission(royalCommissions.jobs[0].id,true)&&gold===goldBeforeFailure&&JSON.stringify(royalCommissions)===completeState','Failed saving rolls back reward, completion count and replacement');
run('failSave=false; dynastyCount++; maxLevel=1; renewRoyalCommissions()');
check('royalCommissions.completed===1&&royalCommissions.jobs.every(j=>j.stage===1&&j.goals.every(g=>g.progress===0))','Rebirth renews goals/rewards but preserves lifetime completions');
run('playerLevel=110;playerGearLevel=3;loadRoyalCommissions(null)');
check('royalCommissions.jobs.every(j=>j.goals.every(g=>!["hero","gear","squad","research"].includes(g.type)))','Capped upgrades are replaced with combat goals');
run('RESEARCH_NODES=[{id:"available"}];canResearchNode=()=>true;gold=2000;loadRoyalCommissions(null)');
check('royalCommissions.jobs[2].goals.map(g=>g.type).join(",")==="building,research"','Civic commission uses construction and research when available');
run('recordCommissionEvent("building");recordCommissionEvent("research")');
check('commissionComplete(royalCommissions.jobs[2])','Building and research events complete civic work');
run('const corrupt=JSON.parse(JSON.stringify(royalCommissions));corrupt.jobs[0].goals[0].target=Infinity;corrupt.jobs[1].goals[0].progress=-50;corrupt.jobs[2].id=corrupt.jobs[1].id;loadRoyalCommissions(corrupt)');
check('new Set(royalCommissions.jobs.map(j=>j.id)).size===3&&royalCommissions.jobs.every(j=>j.goals.every(g=>g.progress>=0&&Number.isFinite(g.target)))','Malformed imports are repaired without invalid counters or duplicate IDs');
check('Number.isFinite(commissionReward(1e12))','High-stage rewards remain finite');
run('renderRoyalCommissions(); const card=commissionNodes.get(royalCommissions.jobs[0].id); recordCommissionEvent("enemy",1,1e12)');
check('commissionNodes.get(royalCommissions.jobs[0].id)===card','Progress refresh preserves existing controls and focus');
run('playerLevel=1;playerGearLevel=0;maxLevel=1;gold=0;RESEARCH_NODES=[];canResearchNode=()=>false;loadRoyalCommissions(null);const tracked=royalCommissions.jobs[0].id');
check('trackRoyalCommission(tracked)&&royalCommissions.trackedId===tracked','Tracking selects an issued request');
check('!document.getElementById("commission-tracker").hidden','Tracked request is visible above gameplay');
run('loadRoyalCommissions(JSON.parse(saved))');
check('royalCommissions.trackedId===tracked','Tracked request survives save/load');
run('const beforeShortcut=JSON.stringify(royalCommissions.jobs);const shortcutGold=gold;continueCommission(tracked)');
check('view==="hero"&&closed==="commissions-popup"&&JSON.stringify(royalCommissions.jobs)===beforeShortcut&&gold===shortcutGold','Combat shortcut opens Hero without purchases or progress changes');
run('recordCommissionEvent("enemy",100,1);continueCommission(tracked)');
check('document.getElementById("hero-level-upgrade").focused','Hero shortcut focuses the relevant upgrade');
run('recordCommissionEvent("hero",100)');
check('!document.getElementById("commission-ready-badge").hidden&&document.getElementById("commission-live-status").textContent.includes("ready to claim")','Completion is visible on navigation and announced');
run('continueTrackedCommission()');
check('opened==="commissions-popup"','Completed tracker opens the reward board');
run('finishCommission(tracked,true)');
check('royalCommissions.trackedId===royalCommissions.jobs[0].id&&royalCommissions.trackedId!==tracked','Tracking follows the replacement after claiming');
run('const keptId=royalCommissions.jobs[0].id;const kept=JSON.stringify(royalCommissions);commissionNodes.get(keptId).replace.events.click()');
check('!commissionNodes.get(keptId).confirmation.hidden&&commissionNodes.get(keptId).cancel.focused&&JSON.stringify(royalCommissions)===kept','Replace first shows inline confirmation and focuses Keep');
run('commissionNodes.get(keptId).cancel.events.click()');
check('commissionNodes.get(keptId).confirmation.hidden&&JSON.stringify(royalCommissions)===kept','Cancel preserves all request progress');
run('commissionNodes.get(keptId).confirm.events.click()');
check('JSON.stringify(royalCommissions)===kept','Hidden confirmation cannot replace a request');
run('commissionNodes.get(keptId).replace.events.click();commissionNodes.get(keptId).confirm.events.click()');
check('royalCommissions.trackedId===royalCommissions.jobs[0].id&&royalCommissions.trackedId!==keptId','Confirmed replacement preserves tracking on the new request');
run('failSave=true;const beforeTrack=royalCommissions.trackedId');
check('!trackRoyalCommission(royalCommissions.jobs[1].id)&&royalCommissions.trackedId===beforeTrack','Tracking save failure restores previous selection');
run('failSave=false;blocked=true;refreshRoyalCommissions();const paused=JSON.stringify(royalCommissions);const pausedView=view');
check('!continueCommission(royalCommissions.jobs[0].id)&&!trackRoyalCommission(royalCommissions.jobs[1].id)&&JSON.stringify(royalCommissions)===paused&&view===pausedView','Paused shortcuts cannot navigate or change tracking');
check('commissionNodes.get(royalCommissions.jobs[0].id).claim.disabled&&document.getElementById("commission-tracker-action").disabled','Paused controls reflect their blocked state');
run('blocked=false;refreshRoyalCommissions()');
check('!commissionNodes.get(royalCommissions.jobs[0].id).claim.disabled','Resume restores controls');
run('trackRoyalCommission(royalCommissions.trackedId)');
check('royalCommissions.trackedId===null&&document.getElementById("commission-tracker").hidden','Untrack hides the optional panel');
run('const badTrack=JSON.parse(JSON.stringify(royalCommissions));badTrack.trackedId=999999;loadRoyalCommissions(badTrack)');
check('royalCommissions.trackedId===null','Unknown imported tracker ID is discarded');
for(const [goal, destination] of [['squad','army'],['gear','hero'],['building','kingdom'],['research','research']]) {
 run('royalCommissions.jobs[0].goals=[commissionGoal('+JSON.stringify(goal)+',1),commissionGoal("enemy",1)];continueCommission(royalCommissions.jobs[0].id)');
 check((goal==='research'?'opened':'view')+'==='+JSON.stringify(destination),goal+' shortcut reaches its controls');
}
check('document.getElementById("castle-structure-upgrade").focused','Building shortcut reaches the construction button rather than the building management menu');
run('royalCommissions.jobs[0].goals=[commissionGoal("gear",1),commissionGoal("enemy",1)];playerGearLevel=3;continueCommission(royalCommissions.jobs[0].id)');
check('opened==="blacksmith"','Capped hero gear shortcut opens the forge');
check('commissionGoalLabel({type:"boss"},{stage:11}).includes("20+")','Boss requirement names the next actual boss stage');
console.log('Royal Commissions: '+checks+' checks passed.');
