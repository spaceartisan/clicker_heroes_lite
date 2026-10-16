const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
const nodes = new Map();
function element() { return {textContent:'',children:[],disabled:false,style:{},
 append(...items){this.children.push(...items);},replaceChildren(...items){this.children=items;},
 setAttribute(){},addEventListener(){},focus(){}}; }
const context = vm.createContext({
 document:{getElementById(id){if(!nodes.has(id))nodes.set(id,element());return nodes.get(id);},createElement:element,querySelector(){return null;}},
 maxLevel:1,dynastyCount:0,playerLevel:1,playerGearLevel:0,gold:0,
 structures:{castle:{level:1},tavern:{level:0},blacksmith:{level:0},barracks:{level:0},market:{level:0}},
 hiredMercenaries:[],passiveAbilities:[{level:1}],RESEARCH_NODES:[],ACADEMY_DISCIPLINES:[],academyDisciplines:{},
 canResearchNode:()=>false,getResearchInsightAvailable:()=>0,getAcademyDisciplineCost:()=>4,
 structureLockReason:id=>id==='tavern'&&context.maxLevel<=10?'Clear stage 10':'',getStructureCost:()=>1000,
 blocked:false,sessionGuardBlocksGameplay:()=>context.blocked,
 saveGame(){if(context.failSave)throw Error('full');context.saved=run('JSON.stringify(royalCommissions)');},
 updateUI(){},drawKingdom(){},formatDigits:n=>String(n),openGameDialog(){},closeGameDialog(){}
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
console.log('Royal Commissions: '+checks+' checks passed.');
