// Season II: intentionally fresh progress, with local archive of the earlier save.
// Existing Firestore records remain in their original scores collection.
const GAME_SCHEMA_VERSION=2;
const GAME_SEASON_ID="dynasty-ii";
const GAME_SCORE_COLLECTION="scores_dynasty_ii";
const GAME_LEGACY_BACKUP_KEY="clickerHeroSave_before_dynasties";
function isCurrentSeasonSave(value){
  return !!value && typeof value==="object" &&
    value.schemaVersion===GAME_SCHEMA_VERSION &&
    value.seasonId===GAME_SEASON_ID;
}
function inspectSeasonSave(raw){
  try{return JSON.parse(raw)}catch(_err){return null}
}
function archiveLegacySave(raw){
  if(!raw)return false;
  // Preserve the first legacy save; do not overwrite it during repeated launches.
  if(!localStorage.getItem(GAME_LEGACY_BACKUP_KEY))
    localStorage.setItem(GAME_LEGACY_BACKUP_KEY,raw);
  return true;
}
function prepareSeasonSave(){
  const raw=localStorage.getItem("clickerHeroSave");
  if(!raw)return false;
  if(isCurrentSeasonSave(inspectSeasonSave(raw)))return false;
  archiveLegacySave(raw); // throws if browser storage is full; no deletion then.
  localStorage.removeItem("clickerHeroSave");
  localStorage.removeItem("playerName");
  localStorage.removeItem("nameConfirm");
  const notice=document.getElementById("season-transition");
  if(notice)notice.style.display="flex";
  return true;
}
function closeSeasonTransition(){
  const el=document.getElementById("season-transition");
  if(el)el.style.display="none";
}
function exportLegacySave(){
  const raw=localStorage.getItem(GAME_LEGACY_BACKUP_KEY);
  if(!raw){alert("No previous-season backup is stored on this device.");return false;}
  const encoded=btoa(unescape(encodeURIComponent(raw)));
  const blob=new Blob([encoded],{type:"text/plain"});
  const url=URL.createObjectURL(blob);
  const link=document.createElement("a");
  link.href=url;
  link.download="heroes_of_the_click_legacy_v0_5.chs";
  link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
  return true;
}
// Kingdom Dynasties: optional reset with bounded permanent improvement.
// Each era is a choice; religious systems remain an independent, future domain.
let dynastyCount=0;
let renown=0;
let bestSeasonStage=1;
let highestCastleEver=1;
let dynastyInvestments={warfare:0,commerce:0,stewardship:0};
let academyDisciplines={warfare:0,commerce:0,governance:0};
let marketCharterRank=0;
const DYNASTY_PERKS=[
  {id:"warfare",name:"War Council",description:"Permanent mercenary strength"},
  {id:"commerce",name:"Trade League",description:"Permanent gold from defeated enemies"},
  {id:"stewardship",name:"Royal Administration",description:"Permanent building and research efficiency"}
];
function safePowerOfTwo(level){
 return Math.pow(2,Math.max(0,Math.min(300,Number(level)||0)));
}
function getDynastyBonus(id) {
  const value=dynastyInvestments[id]||0;
  return Math.min(0.9,0.12*Math.sqrt(value));
}
function getDynastyCost(id){
  const rank=dynastyInvestments[id]||0;
  return 1+Math.floor(Math.pow(rank,1.25));
}
function getDynastyReward(){
  if(maxLevel<=200)return 0;
  const stage=Math.max(200,Math.floor(maxLevel)-1);
  return Math.min(50,1+Math.floor(Math.log2(1+Math.max(0,stage-200)/180)));
}
function purchaseDynastyPerk(id){
  if(!Object.prototype.hasOwnProperty.call(dynastyInvestments,id))return false;
  const cost=getDynastyCost(id);
  if(renown<cost)return false;
  renown-=cost;
  dynastyInvestments[id]++;
  saveGame(); updateUI();renderDynastyPanel();
  return true;
}
function dynastyGoldMultiplier(){
  return 1+getDynastyBonus("commerce");
}
function dynastyDamageMultiplier(){
  return 1+getDynastyBonus("warfare");
}
function dynastyDiscountFactor(){
  return 1-getDynastyBonus("stewardship")*.35;
}
function currentDynastyPeak(){
  return Math.max(bestSeasonStage,Math.floor(maxLevel));
}
function foundNewDynasty(){
  const reward=getDynastyReward();
  if(!reward)return false;
  if(!confirm("Begin a new Dynasty? Gold, hero/mercenary levels, buildings and Market projects reset. Permanent research and Renown investments stay. Earn "+reward+" Renown?"))
    return false;
  stopSquadAttack();
  // Keep a recoverable rollback in case the player closes the app during rebirth.
  const previous=localStorage.getItem("clickerHeroSave");
  if(previous)localStorage.setItem("clickerHeroSave_before_rebirth",previous);
  bestSeasonStage=Math.max(bestSeasonStage,maxLevel);
  highestCastleEver=Math.max(highestCastleEver,structures.castle.level);
  renown+=reward;dynastyCount++;
  gold=0;playerLevel=1;playerGearLevel=0;playerUpgradeCost=10;
  playerGearCost=100;nextPlayerGearLevelReq=10;
  currentLevel=1;maxLevel=1;enemyHealth=5;
  hiredMercenaries.length=0;squadBuilds={};claimedTreasury=[];
  for(const [key,building] of Object.entries(structures))
    building.level=key==="castle"?1:0;
  for(const market of Object.values(marketUpgrades))market.level=0;
  marketCharterRank=0;
  for(const passive of passiveAbilities)passive.level=1;
  resetAbilityEffects();
  rallyActive=false;goldRushActive=false;doubleAttackReady=false;
  if(typeof resetArmySelection==="function")resetArmySelection();
  drawRandomEnemy();updateUI();updateStructureUI();drawKingdom();
  renderDynastyPanel();saveGame();
  return true;
}
function purchaseMarketCharter(){
  if(structures.market.level<4)return false;
  const cost=getMarketCharterCost();
  if(!Number.isFinite(cost)||gold<cost)return false;
  gold-=cost;
  marketCharterRank++;
  saveGame();updateUI();
  return true;
}
function getMarketCharterCost(){
  return Math.min(1e290,Math.ceil(12500*Math.pow(1.36,marketCharterRank)*
    dynastyDiscountFactor()*getResearchCostFactor()));
}
function getMarketCharterBonus(){
  return 1+Math.min(0.6,0.08*Math.sqrt(marketCharterRank));
}
function renderDynastyPanel(){
  const root=document.getElementById("dynasty-panel");
  if(!root)return;
  root.replaceChildren();
  const title=document.createElement("h3");
  title.textContent="👑 Dynasty "+(dynastyCount+1);
  const intro=document.createElement("p");
  intro.className="dynasty-help";
  intro.textContent="Highest Season II stage: "+currentDynastyPeak().toLocaleString()+
    " · Renown: "+renown+" · Next rebirth: "+getDynastyReward()+" Renown";
  root.append(title,intro);
  const grid=document.createElement("div");grid.className="dynasty-perks";
  for(const perk of DYNASTY_PERKS){
    const rank=dynastyInvestments[perk.id];
    const row=document.createElement("article");
    const info=document.createElement("div");
    const heading=document.createElement("strong");
    heading.textContent=perk.name+" · Rank "+rank;
    const desc=document.createElement("p");
    desc.textContent=perk.description+" · "+Math.round(getDynastyBonus(perk.id)*100)+"% bonus";
    info.append(heading,desc);
    const btn=document.createElement("button");
    const cost=getDynastyCost(perk.id);
    btn.textContent="Invest "+cost+" Renown";btn.disabled=renown<cost;
    btn.addEventListener("click",()=>purchaseDynastyPerk(perk.id));
    row.append(info,btn);grid.appendChild(row);
  }
  root.appendChild(grid);
  const rebirth=document.createElement("button");
  rebirth.className="dynasty-rebirth";
  rebirth.disabled=getDynastyReward()===0;
  rebirth.textContent="Found New Dynasty · +"+getDynastyReward()+" Renown";
  rebirth.addEventListener("click",()=>foundNewDynasty());
  root.appendChild(rebirth);
}
