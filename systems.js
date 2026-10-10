// Kingdom expeditions, permanent relics, and milestone boss challenges.
// All progression state is stored with the existing local Season II save.
// No network writes or continuous battle-side rendering are required.
const BOSS_CHALLENGE_MS = 30000;
let bossClockStage = 0;
let bossClockDeadline = 0;
let bossClockPausedMs = 0;
let bossRetryStage = 0;
let bossAttemptsThisRun = 0;
let bossFailuresThisRun = 0;

const CAMPAIGN_DEFINITIONS = Object.freeze([
    { id:"patrol", name:"Borderland Patrol", minutes:20, barracks:1, favored:"ranger",
      danger:"Low", goldFactor:8, fragments:1, relicChance:0.03,
      description:"Scout the border roads. Steady gold, a chance of an old relic." },
    { id:"ruins", name:"Ruins Expedition", minutes:60, barracks:3, favored:"mystic",
      danger:"Medium", goldFactor:18, fragments:2, relicChance:0.08,
      description:"Search forgotten halls for relic fragments and hidden caches." },
    { id:"siege", name:"Warlord Campaign", minutes:120, barracks:6, favored:"vanguard",
      danger:"High", goldFactor:38, fragments:3, relicChance:0.14,
      description:"Fight a distant warlord for a larger bounty and rare relics." }
]);
const RELIC_DEFINITIONS = Object.freeze([
    {id:"ember",name:"Ember Crest",effect:"boss",value:0.12,description:"+12% damage against bosses"},
    {id:"banner",name:"Banner of Valor",effect:"squad",value:0.10,description:"+10% mercenary damage"},
    {id:"crown",name:"Merchant's Crown",effect:"gold",value:0.10,description:"+10% enemy gold"},
    {id:"ward",name:"Runestone Ward",effect:"hero",value:0.10,description:"+10% hero damage"},
    {id:"compass",name:"Pathfinder's Compass",effect:"campaign",value:0.10,description:"+10% campaign success chance"}
]);
// Fixed, logarithmically spaced milestone list avoids unbounded boss records
// for players who have already reached millions of stages.
const RELIC_BOSS_MILESTONES = Object.freeze([
    10,30,50,100,200,500,1000,2000,5000,10000,20000,
    50000,100000,200000,500000,1000000,2000000,5000000,10000000
]);
let activeCampaigns = [];
let campaignSerial = 0;
let relicInventory = {};
let relicSlots = [null,null,null];
let relicFragments = 0;
let relicBossClaims = [];
const campaignTimerNodes = new Map();

function isTimedBossStage() {
    return currentLevel > 0 && currentLevel % 10 === 0 && currentLevel === maxLevel;
}
function resetBossClockForSpawn() {
    bossClockStage = 0;
    bossClockDeadline = 0;
    bossClockPausedMs = 0;
    if (isTimedBossStage()) {
        bossClockStage = currentLevel;
        bossClockPausedMs = BOSS_CHALLENGE_MS;
        if (!document.hidden) bossClockDeadline = Date.now() + BOSS_CHALLENGE_MS;
        bossAttemptsThisRun++;
        const estimatedPower=getAutoDamage()+getPlayerClickDamage();
        balanceBossAttempt(currentLevel,Math.min(1000000,
            estimatedPower*30/Math.max(1,getEnemyHealth())));
    }
    renderBossChallenge();
}
function bossRemainingMs() {
    if (!bossClockStage) return 0;
    return Math.max(0, bossClockDeadline ? bossClockDeadline - Date.now() : bossClockPausedMs);
}
function pauseBossClock() {
    if (bossClockStage && bossClockDeadline) {
        bossClockPausedMs = bossRemainingMs();
        bossClockDeadline = 0;
    }
}
function resumeBossClock() {
    if (bossClockStage && !bossClockDeadline && !document.hidden)
        bossClockDeadline = Date.now() + bossClockPausedMs;
}
function tickBossChallenge() {
    if (!bossClockStage || document.hidden || deathCooldown) return;
    if (bossClockStage !== currentLevel) { bossClockStage=0; renderBossChallenge(); return; }
    if (bossClockDeadline && bossRemainingMs() <= 0) failBossChallenge();
    else renderBossChallenge();
}
function failBossChallenge() {
    if (!bossClockStage || bossClockStage !== currentLevel || deathCooldown) return false;
    balanceBossResult(bossClockStage,false,
        (BOSS_CHALLENGE_MS-bossRemainingMs())/1000);
    bossRetryStage = bossClockStage;
    bossClockStage = 0;
    bossClockDeadline = 0;
    bossClockPausedMs = 0;
    bossFailuresThisRun++;
    autoAdvance = false;
    const toggle = document.getElementById("auto-next-toggle");
    if (toggle) toggle.checked = false;
    currentLevel = Math.max(1, bossRetryStage - 1);
    drawRandomEnemy();
    updateUI();
    saveGame();
    return true;
}
function retryBossChallenge() {
    if (!bossRetryStage || maxLevel !== bossRetryStage) return false;
    currentLevel = bossRetryStage;
    autoAdvance = true;
    const toggle = document.getElementById("auto-next-toggle");
    if (toggle) toggle.checked = true;
    drawRandomEnemy();
    updateUI();
    saveGame();
    return true;
}
function renderBossChallenge() {
    const panel = document.getElementById("boss-challenge");
    if (!panel) return;
    const clock = document.getElementById("boss-clock");
    const track = document.getElementById("boss-clock-fill");
    const note = document.getElementById("boss-challenge-note");
    const retry = document.getElementById("boss-retry");
    const readiness = document.getElementById("boss-readiness");
    const recall = document.getElementById("boss-recall-all");
    const away=activeCampaigns.filter(m=>m.endsAt>Date.now()).length;
    recall.hidden=away===0;
    if (bossClockStage === currentLevel) {
        const squadDps=getAutoDamage();
        const estimate=squadDps>0?getEnemyHealth()/squadDps:Infinity;
        const duration=estimate>9999?"over 9,999s":estimate.toFixed(1)+"s";
        readiness.textContent="Squad-only clear estimate: "+duration+
            " · Hero clicks and abilities not included."+
            (away?" "+away+" squad"+(away===1?" away.":"s away."):"");
        const remaining = bossRemainingMs();
        panel.hidden = false;
        clock.textContent = (remaining / 1000).toFixed(1) + "s";
        track.style.width = Math.min(100,Math.max(0,remaining / BOSS_CHALLENGE_MS * 100)) + "%";
        note.textContent = "Defeat this new boss within 30 seconds.";
        retry.hidden = true;
    } else if (bossRetryStage === maxLevel && currentLevel < bossRetryStage) {
        panel.hidden = false;
        clock.textContent = "Farming";
        track.style.width = "0%";
        note.textContent = "Boss failed at stage " + bossRetryStage + ". Farm gold and upgrade, then retry.";
        readiness.textContent=away?away+" squad"+(away===1?" is":"s are")+
            " on expedition. Recall to restore combat DPS.":
            "Strengthen your mercenaries, equip counter weapons, and retry.";
        retry.hidden = false;
    } else {
        panel.hidden = true;
    }
}
function recordBossVictory(stage, firstClear) {
    if (bossClockStage === stage) {
        balanceBossResult(stage,true,(BOSS_CHALLENGE_MS-bossRemainingMs())/1000);
        bossClockStage = 0;
        bossClockDeadline = 0;
        bossClockPausedMs = 0;
    }
    if (bossRetryStage === stage) bossRetryStage = 0;
    if (firstClear && stage % 10 === 0) {
        const index = RELIC_BOSS_MILESTONES.indexOf(stage);
        if (index >= 0 && !relicBossClaims.includes(stage)) {
            relicBossClaims.push(stage);
            grantRelic(RELIC_DEFINITIONS[index % RELIC_DEFINITIONS.length].id);
            showPopupMessage("Boss trophy: a new relic was added to your vault!", false, 3000);
        }
    }
}
function relicDefinition(id) {
    return RELIC_DEFINITIONS.find(item => item.id === id) || null;
}
function getRelicBonus(effect) {
    return Math.min(0.35, relicSlots.reduce((sum,id) => {
        const relic = relicDefinition(id);
        return sum + (relic && relic.effect === effect && relicInventory[id] > 0 ? relic.value : 0);
    },0));
}
function grantRelic(id) {
    if (!relicDefinition(id)) return false;
    if ((relicInventory[id]||0) >= 99) relicFragments = Math.min(9999,relicFragments + 2);
    else relicInventory[id] = (relicInventory[id] || 0) + 1;
    balanceRelicFound();
    renderRelicVault();
    return true;
}
function equipRelic(id, slotIndex) {
    const slot = Math.floor(Number(slotIndex));
    if (!Number.isFinite(slot) || slot < 0 || slot >= 3) return false;
    if (id !== null && (!relicDefinition(id) || !relicInventory[id])) return false;
    if (id && relicSlots.some((equipped,index) => index !== slot && equipped === id)) return false;
    relicSlots[slot] = id;
    if(id)balanceRelicEquipped();
    renderRelicVault();
    updateUI();
    saveGame();
    return true;
}
function recycleRelic(id) {
    if (!relicDefinition(id) || (relicInventory[id]||0) <= (relicSlots.includes(id)?1:0))
        return false;
    relicInventory[id]--;
    relicFragments = Math.min(9999,relicFragments+2);
    renderRelicVault();
    saveGame();
    return true;
}
function craftRelic() {
    if (relicFragments < 8) return false;
    relicFragments -= 8;
    const relic = RELIC_DEFINITIONS[Math.floor(Math.random()*RELIC_DEFINITIONS.length)];
    grantRelic(relic.id);
    renderRelicVault();
    saveGame();
    return true;
}
function createSystemButton(text, callback, disabled) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = text;
    button.disabled = Boolean(disabled);
    button.addEventListener("click",callback);
    return button;
}
function renderRelicVault() {
    const panel = document.getElementById("relic-vault");
    if (!panel) return;
    const slots = document.getElementById("relic-slots");
    const list = document.getElementById("relic-list");
    const help = document.getElementById("relic-summary");
    help.textContent = "Permanent across Dynasties · " + relicFragments +
        " fragments · 8 fragments craft a relic. Only equipped bonuses apply.";
    const slotFragment = document.createDocumentFragment();
    for (let i=0;i<3;i++) {
        const row=document.createElement("div");
        row.className="relic-slot";
        const relic=relicDefinition(relicSlots[i]);
        const label=document.createElement("span");
        label.textContent="Slot "+(i+1)+": "+(relic?relic.name:"Empty");
        row.appendChild(label);
        row.appendChild(createSystemButton("Unequip",()=>equipRelic(null,i),!relic));
        slotFragment.appendChild(row);
    }
    slots.replaceChildren(slotFragment);
    const fragment = document.createDocumentFragment();
    for (const relic of RELIC_DEFINITIONS) {
        const owned = relicInventory[relic.id] || 0;
        if (!owned) continue;
        const card=document.createElement("article");
        card.className="relic-entry";
        const copy=document.createElement("div");
        const heading=document.createElement("strong");
        heading.textContent=relic.name+" · "+owned+" owned";
        const detail=document.createElement("p");
        detail.textContent=relic.description;
        copy.append(heading,detail);
        card.appendChild(copy);
        const controls=document.createElement("div");
        controls.className="relic-entry-actions";
        const equippedIndex=relicSlots.indexOf(relic.id);
        const firstFree=relicSlots.indexOf(null);
        controls.appendChild(createSystemButton(
            equippedIndex>=0?"Equipped":"Equip",
            ()=>equipRelic(relic.id,firstFree>=0?firstFree:0),
            equippedIndex>=0));
        controls.appendChild(createSystemButton("Recycle +2 fragments",
            ()=>recycleRelic(relic.id),owned<=(equippedIndex>=0?1:0)));
        card.appendChild(controls);
        fragment.appendChild(card);
    }
    list.replaceChildren(fragment);
    if (!Object.values(relicInventory).some(count=>count>0))
        list.textContent="Defeat milestone bosses or complete expeditions to find relics.";
    const craft = document.getElementById("relic-craft");
    craft.disabled = relicFragments<8;
    craft.textContent = "Craft relic · 8 fragments";
}
function isSquadOnCampaign(squadId) {
    return activeCampaigns.some(m=>m.squadId===Number(squadId));
}
function getCampaignSlots() {
    return structures.barracks.level>=5?2:1;
}
// Level and equipment add capped readiness; roles, kits and relics also matter.
function getCampaignSuccessChance(mission, squadId) {
    const group=getArmySquads().find(g=>g.id===Number(squadId));
    if(!mission||!group)return 0;
    const members=group.indices.map(i=>hiredMercenaries[i]);
    if(!members.length)return 0;
    const build=getSquadBuild(group.id);
    const level=members.reduce((a,m)=>a+Math.max(1,Number(m.level)||1),0)/members.length;
    const gear=members.reduce((a,m)=>a+Math.max(0,Number(m.gearLevel)||0),0)/members.length;
    return Math.min(.97,.66+(build.role===mission.favored?.12:0)+
        (build.kit!=="basic"?.06:0)+
        Math.min(.08,.018*Math.log2(1+level))+
        Math.min(.04,.01*Math.log2(1+gear))+getRelicBonus("campaign"));
}
function startSquadCampaign(campaignId, squadId) {
    const mission=CAMPAIGN_DEFINITIONS.find(m=>m.id===campaignId);
    const squad=getArmySquads().find(g=>g.id===Number(squadId));
    if(!mission||!squad||structures.barracks.level<mission.barracks||
       isSquadOnCampaign(squad.id)||activeCampaigns.length>=getCampaignSlots())return false;
    const members=squad.indices.map(i=>hiredMercenaries[i]);
    const average=members.reduce((a,m)=>a+(Number(m.level)||1),0)/members.length;
    const chance=getCampaignSuccessChance(mission,squad.id);
    const success=Math.random()<chance;
    const stage=Math.min(1e12,Math.max(1,Math.floor(maxLevel)-1));
    const bounty=Math.min(1e290,Math.floor(2*Math.pow(stage,1.4)*mission.goldFactor*
        (1+Math.min(2,Math.log2(1+average)*.2))));
    const startedAt=Date.now();
    activeCampaigns.push({
        id:++campaignSerial,kind:mission.id,squadId:squad.id,
        startedAt,endsAt:startedAt+mission.minutes*60000,success,chance,
        reward:{
            gold:Math.max(10,Math.floor(bounty*(success?1:.25))),
            fragments:success?mission.fragments:0,
            relic:success&&Math.random()<mission.relicChance?
                RELIC_DEFINITIONS[Math.floor(Math.random()*RELIC_DEFINITIONS.length)].id:null
        }
    });
    balanceCampaignStarted();
    saveGame();updateUI();renderArmyView();
    return true;
}
function awardSquadCampaign(mission) {
    const reward=mission.reward;
    gold=Math.min(1e300,gold+reward.gold);
    runGoldEarned=Math.min(1e300,runGoldEarned+reward.gold);
    relicFragments=Math.min(9999,relicFragments+reward.fragments);
    if(reward.relic)grantRelic(reward.relic);
    balanceCampaignClaimed(mission.success);
}
function refreshCampaignUi() {
    saveGame();updateUI();renderRelicVault();renderArmyView();
}
function claimSquadCampaign(serial) {
    const index=activeCampaigns.findIndex(m=>m.id===Number(serial));
    if(index<0||Date.now()<activeCampaigns[index].endsAt)return false;
    const mission=activeCampaigns.splice(index,1)[0];
    awardSquadCampaign(mission);
    refreshCampaignUi();
    showPopupMessage((mission.success?"Campaign succeeded: ":"Campaign returned: ")+
        formatDigits(mission.reward.gold,1,0).trim()+" gold and "+
        mission.reward.fragments+" fragments.",false,3300);
    return true;
}
function claimReadyCampaigns() {
    const ready=activeCampaigns.filter(m=>Date.now()>=m.endsAt);
    if(!ready.length)return false;
    const ids=new Set(ready.map(m=>m.id));
    activeCampaigns=activeCampaigns.filter(m=>!ids.has(m.id));
    for(const mission of ready)awardSquadCampaign(mission);
    refreshCampaignUi();
    showPopupMessage(ready.length+" completed expedition"+(ready.length===1?"":"s")+
        " claimed. Squads are available again.",false,3000);
    return true;
}
function recallSquadCampaign(serial) {
    const index=activeCampaigns.findIndex(m=>m.id===Number(serial));
    if(index<0||Date.now()>=activeCampaigns[index].endsAt)return false;
    if(!confirm("Recall Squad "+activeCampaigns[index].squadId+
        " now? All expedition rewards will be forfeited."))return false;
    activeCampaigns.splice(index,1);
    saveGame();updateUI();renderArmyView();renderBossChallenge();
    showPopupMessage("Squad recalled; expedition loot forfeited.",false,2800);
    return true;
}
function recallAllSquadsForBoss() {
    const ongoing=activeCampaigns.filter(m=>m.endsAt>Date.now());
    if(!ongoing.length)return false;
    if(!confirm("Recall "+ongoing.length+" squad"+(ongoing.length===1?"":"s")+
        " for the boss? Every unfinished expedition reward will be lost."))return false;
    const ids=new Set(ongoing.map(m=>m.id));
    activeCampaigns=activeCampaigns.filter(m=>!ids.has(m.id));
    saveGame();updateUI();renderArmyView();renderBossChallenge();
    showPopupMessage("Expedition squads recalled for combat.",false,2800);
    return true;
}
// Update only countdowns, never recreate dropdowns while the player selects a squad.
function updateCampaignTimers() {
    const now=Date.now();
    const ready=activeCampaigns.filter(m=>m.endsAt<=now).length;
    const summary=document.getElementById("campaign-summary");
    if(summary)summary.textContent=activeCampaigns.length+"/"+getCampaignSlots()+
        " in the field · "+ready+" ready to claim. Away squads provide no combat bonuses.";
    const all=document.getElementById("campaign-claim-ready");
    if(all){all.disabled=!ready;all.textContent=ready?"Claim "+ready+" ready":"No rewards ready";}
    for(const mission of activeCampaigns) {
        const ui=campaignTimerNodes.get(mission.id);
        if(!ui)continue;
        const seconds=Math.max(0,Math.ceil((mission.endsAt-now)/1000));
        ui.status.textContent=seconds?Math.ceil(seconds/60)+" min remaining":"Ready to claim";
        ui.claim.disabled=seconds>0;
        ui.claim.textContent=seconds?"In progress":"Claim rewards";
        ui.recall.hidden=seconds===0;
    }
}
function renderSquadCampaigns() {
    const target=document.getElementById("campaign-list");
    if(!target)return;
    const fragment=document.createDocumentFragment();
    const squads=getArmySquads();
    campaignTimerNodes.clear();
    for(const mission of activeCampaigns) {
        const type=CAMPAIGN_DEFINITIONS.find(m=>m.id===mission.kind);
        const card=document.createElement("article");
        card.className="campaign-card campaign-deployed";
        const title=document.createElement("strong");
        title.textContent="Squad "+mission.squadId+" · "+(type?type.name:"Expedition");
        const chance=document.createElement("p");
        chance.textContent="Success chance at dispatch: "+
            (Number.isFinite(mission.chance)?Math.round(mission.chance*100)+"%":"not recorded")+
            " · Loot hidden until claim";
        const status=document.createElement("p");
        status.className="campaign-progress";
        const actions=document.createElement("div");
        actions.className="campaign-actions";
        const claim=createSystemButton("In progress",()=>claimSquadCampaign(mission.id),true);
        const recall=createSystemButton("Recall · forfeit loot",()=>recallSquadCampaign(mission.id),false);
        recall.className="campaign-recall";
        actions.append(claim,recall);
        card.append(title,chance,status,actions);
        campaignTimerNodes.set(mission.id,{status,claim,recall});
        fragment.appendChild(card);
    }
    for(const type of CAMPAIGN_DEFINITIONS) {
        const card=document.createElement("article");
        card.className="campaign-card";
        const title=document.createElement("strong");
        title.textContent=type.name+" · "+type.minutes+" min · "+type.danger+" risk";
        const info=document.createElement("p");
        info.textContent=type.description+" Favored: "+findSquadRole(type.favored).name+".";
        const select=document.createElement("select");
        select.setAttribute("aria-label","Squad for "+type.name);
        const available=squads.filter(g=>!isSquadOnCampaign(g.id));
        for(const group of available) {
            const opt=document.createElement("option");
            opt.value=String(group.id);opt.textContent="Squad "+group.id;
            select.appendChild(opt);
        }
        const preview=document.createElement("p");
        preview.className="campaign-preview";
        function updatePreview(){
            const group=available.find(g=>g.id===Number(select.value))||available[0];
            if(!group){preview.textContent="No available squads. Claim or recall one first.";return;}
            const build=getSquadBuild(group.id);
            preview.textContent=Math.round(getCampaignSuccessChance(type,group.id)*100)+
                "% success chance"+(build.role===type.favored?" · Favored role":"")+
                (build.kit!=="basic"?" · Forged kit":"")+
                " · "+formatDigits(getArmySquadDps(group,true),1,0).trim()+
                " neutral DPS committed";
        }
        if(available.length)select.value=String(available[0].id);
        select.addEventListener("change",updatePreview);
        updatePreview();
        const actions=document.createElement("div");
        actions.className="campaign-actions";
        actions.append(select,createSystemButton(
            structures.barracks.level<type.barracks?
                "Requires Barracks "+type.barracks:"Dispatch",
            ()=>startSquadCampaign(type.id,select.value),
            structures.barracks.level<type.barracks||!available.length||
                activeCampaigns.length>=getCampaignSlots()));
        card.append(title,info,preview,actions);
        fragment.appendChild(card);
    }
    target.replaceChildren(fragment);
    updateCampaignTimers();
}
function loadCampaignRelicState(data) {
    relicInventory={};
    if (data.relicInventory && typeof data.relicInventory==="object") {
        for (const relic of RELIC_DEFINITIONS)
            relicInventory[relic.id]=Math.min(99,Math.max(0,Math.floor(Number(data.relicInventory[relic.id])||0)));
    }
    relicSlots=Array.isArray(data.relicSlots)?data.relicSlots.slice(0,3)
        .map(id=>relicDefinition(id)&&relicInventory[id]?id:null):[null,null,null];
    while(relicSlots.length<3) relicSlots.push(null);
    const used=new Set();
    relicSlots=relicSlots.map(id=>{if (!id||used.has(id))return null;used.add(id);return id});
    relicFragments=Math.min(9999,Math.max(0,Math.floor(Number(data.relicFragments)||0)));
    relicBossClaims=Array.isArray(data.relicBossClaims)?
        [...new Set(data.relicBossClaims.filter(stage=>RELIC_BOSS_MILESTONES.includes(stage)))]:[];
    campaignSerial=Math.max(0,Math.min(1e9,Math.floor(Number(data.campaignSerial)||0)));
    activeCampaigns=[];
    const records=Array.isArray(data.activeCampaigns)?data.activeCampaigns:[];
    const usedSquads=new Set();
    for(const item of records.slice(0,2)) {
        if (!item || !CAMPAIGN_DEFINITIONS.some(c=>c.id===item.kind) ||
            !getArmySquads().some(s=>s.id===item.squadId) ||
            usedSquads.has(item.squadId) || !Number.isFinite(item.endsAt) ||
            !Number.isFinite(item.startedAt) || item.endsAt<item.startedAt ||
            item.endsAt-item.startedAt>7200000 ||
            !item.reward || !Number.isFinite(item.reward.gold)) continue;
        usedSquads.add(item.squadId);
        const definition=CAMPAIGN_DEFINITIONS.find(c=>c.id===item.kind);
        activeCampaigns.push({
            id:Math.floor(Number(item.id)||++campaignSerial),kind:item.kind,squadId:item.squadId,
            startedAt:item.startedAt,endsAt:item.endsAt,success:Boolean(item.success),
            chance:Number.isFinite(item.chance)?Math.min(.97,Math.max(0,item.chance)):null,
            reward:{
                gold:Math.min(1e290,Math.max(0,Math.floor(item.reward.gold))),
                fragments:Math.min(definition.fragments,Math.max(0,Math.floor(Number(item.reward.fragments)||0))),
                relic:relicDefinition(item.reward.relic)?item.reward.relic:null
            }
        });
    }
    campaignSerial=Math.max(campaignSerial,...activeCampaigns.map(m=>m.id),0);
    bossRetryStage=Number.isFinite(data.bossRetryStage)&&data.bossRetryStage===maxLevel?
        data.bossRetryStage:0;
    bossClockStage=0;bossClockDeadline=0;bossClockPausedMs=0;
    renderRelicVault();
}
function resetCampaignsForDynasty() {
    // Incomplete campaigns return with no rewards. Relics and shards persist.
    activeCampaigns=[];
    bossRetryStage=0;bossClockStage=0;bossClockDeadline=0;bossClockPausedMs=0;
    renderRelicVault();
    renderSquadCampaigns();
}
document.addEventListener("DOMContentLoaded",()=>{
    renderRelicVault();
    renderSquadCampaigns();
    renderBossChallenge();
});
setInterval(()=>{
    if (document.hidden) return;
    tickBossChallenge();
    if (document.getElementById("army-view")?.style.display!=="none")
        updateCampaignTimers();
},1000);
