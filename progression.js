// One-time stage rewards are separate from Royal Academy Insight and future Faith.
const ROYAL_TREASURY_STAGES = Object.freeze([20,40,60,80,100,120,140,160,180,200]);
const FRONTIER_TREASURY = Object.freeze({120:45000,140:65000,160:90000,180:115000,200:145000});
let claimedTreasury = [];
function getTreasuryReward(stage) {
    if (!ROYAL_TREASURY_STAGES.includes(stage)) return 0;
    return stage>100 ? FRONTIER_TREASURY[stage] : 5*stage*stage;
}
function getTreasuryAvailableStages() {
    const cleared = Math.max(0,Math.floor(maxLevel)-1);
    return ROYAL_TREASURY_STAGES.filter(stage=>stage<=cleared&&!claimedTreasury.includes(stage));
}
function getTreasuryAvailableGold() {
    return getTreasuryAvailableStages().reduce((sum,stage)=>sum+getTreasuryReward(stage),0);
}
function claimRoyalTreasury() {
    const stages = getTreasuryAvailableStages();
    if(!stages.length) return false;
    const reward = stages.reduce((sum,stage)=>sum+getTreasuryReward(stage),0);
    claimedTreasury.push(...stages);
    gold += reward;
    updateUI(); updateStructureUI(); saveGame();
    showPopupMessage("Royal Treasury: "+formatDigits(reward,0,0).trim()+" gold claimed!",false,2600);
    return true;
}
function updateTreasuryUI() {
    if (!document.getElementById("royal-treasury")) return;
    const cleared=Math.max(0,Math.floor(maxLevel)-1);
    const ready=getTreasuryAvailableGold();
    const next=ROYAL_TREASURY_STAGES.find(stage=>stage>cleared);
    const prev=ROYAL_TREASURY_STAGES.filter(stage=>stage<=cleared).at(-1)||0;
    const amount=next?Math.max(0,Math.min(1,(cleared-prev)/(next-prev))):1;
    const chapter=Math.min(10,Math.floor(cleared/20)+1);
    document.getElementById("treasury-chapter").textContent =
        "CHAPTER "+["I","II","III","IV","V","VI","VII","VIII","IX","X"][chapter-1];
    document.getElementById("treasury-progress-fill").style.width = Math.round(amount*100)+"%";
    document.getElementById("treasury-status").textContent = next
        ? "Highest cleared: "+cleared+" · Next: Stage "+next+" ("+
           formatDigits(getTreasuryReward(next),0,0).trim()+" gold)"
        : "Highest cleared: "+cleared+" · All ten chapter bounties unlocked";
    const button=document.getElementById("treasury-claim");
    button.disabled=!ready;
    button.textContent=ready?"Claim "+formatDigits(ready,0,0).trim()+" gold":"No unclaimed bounties";
}
// Offline progress approximates normal encounters instead of boss farming.
// 10% battle efficiency, at most one patrol battle per 40 seconds and 24 hours.
function estimateOfflineGold(seconds) {
    if(!Number.isFinite(seconds)||seconds<2)return 0;
    const elapsed=Math.max(0,Math.min(86400,seconds));
    const dps=getAutoDamage();
    if(!(dps>0)||!Number.isFinite(dps))return 0;
    const cleared=Math.max(1,Math.floor(maxLevel)-1);
    const stage=Math.max(1,Math.min(Math.floor(currentLevel),cleared));
    const health=Math.max(5,Math.floor(5*Math.pow(stage,1.5)));
    const kills=Math.min(elapsed/40,elapsed*dps/health*0.10);
    if(!(kills>0))return 0;
    const steward=passiveAbilities[2] ?
        1+0.03*Math.max(0,passiveAbilities[2].level-1):1;
    const bounty=Math.max(1,Math.floor(2*Math.pow(stage,1.4)))*
        mktUp(0)*mktUp(6)*getSquadGoldMultiplier()*steward*
        (1+getResearchBonus("enemyGold"));
    const goldReward=Math.floor(kills*bounty*mktUp(4)*(1+getResearchBonus("offlineGold")));
    return Number.isFinite(goldReward)&&goldReward>0?goldReward:0;
}
