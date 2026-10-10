// Royal Academy: bounded, permanent research from milestones, independent of religion.
// One Insight per first-time cleared 10th stage, plus one per five Castle levels.
// Total Insight is derived from progression, so existing saves earn retroactive credit.
const RESEARCH_BRANCHES = [
    { id: "warfare", name: "Warfare", icon: "army", description: "Military doctrine and enemy-counter tactics" },
    { id: "commerce", name: "Commerce", icon: "market", description: "Trade, discounts, and monster bounties" },
    { id: "governance", name: "Governance", icon: "governance", description: "Administration, scholarship, and royal power" }
];
// Future faith/religion systems can add their own domain without touching Insight.
const RESEARCH_FUTURE_DOMAINS = ["faith"];
const RESEARCH_NODES = [
    { id:"field_manuals", branch:"warfare", name:"Field Manuals", cost:1, stage:10, castle:1, requires:[], description:"+8% mercenary DPS", bonus:"squadDamage", value:0.08 },
    { id:"beast_lore", branch:"warfare", name:"Bestiary", cost:2, stage:30, castle:1, requires:["field_manuals"], description:"+15% mercenary damage against armored and spectral enemies", bonus:"counterDamage", value:0.15 },
    { id:"siege_doctrine", branch:"warfare", name:"Siege Doctrine", cost:2, stage:50, castle:3, requires:["field_manuals"], description:"+12% mercenary damage against boss dragons", bonus:"bossDamage", value:0.12 },
    { id:"trade_routes", branch:"commerce", name:"Trade Routes", cost:1, stage:10, castle:1, requires:[], description:"+8% gold from enemies", bonus:"enemyGold", value:0.08 },
    { id:"guild_charters", branch:"commerce", name:"Guild Charters", cost:2, stage:30, castle:2, requires:["trade_routes"], description:"5% cheaper buildings and upgrades", bonus:"discount", value:0.05 },
    { id:"royal_mint", branch:"commerce", name:"Royal Mint", cost:3, stage:70, castle:4, requires:["guild_charters"], description:"+12% gold from enemies", bonus:"enemyGold", value:0.12 },
    { id:"royal_survey", branch:"governance", name:"Royal Survey", cost:1, stage:10, castle:1, requires:[], description:"8% cheaper Castle upgrades", bonus:"castleDiscount", value:0.08 },
    { id:"scribes_college", branch:"governance", name:"Scribes' College", cost:2, stage:30, castle:2, requires:["royal_survey"], description:"+10% offline gold income", bonus:"offlineGold", value:0.10 },
    { id:"royal_academy", branch:"governance", name:"Royal Academy", cost:3, stage:60, castle:4, requires:["scribes_college"], description:"+15% hero click damage", bonus:"heroDamage", value:0.15 },
    { id:"veteran_drills", branch:"warfare", name:"Veteran Drills", cost:3, stage:120, castle:5, requires:["beast_lore"], description:"+18% squad damage against Veterans", bonus:"veteranDamage", value:0.18 },
    { id:"frontier_charters", branch:"commerce", name:"Frontier Charters", cost:3, stage:140, castle:5, requires:["royal_mint"], description:"+12% gold from Frontier encounters", bonus:"frontierGold", value:0.12 },
    { id:"frontier_council", branch:"governance", name:"Frontier Council", cost:3, stage:160, castle:6, requires:["royal_academy"], description:"+18% hero click damage in Frontier", bonus:"frontierHeroDamage", value:0.18 }
];
let researchState = {};
const ACADEMY_DISCIPLINES=[
 {id:"warfare",name:"Military College",effect:"squad damage",bonus:"squadDamage"},
 {id:"commerce",name:"Merchant College",effect:"monster gold",bonus:"enemyGold"},
 {id:"governance",name:"Civic College",effect:"upgrade discounts",bonus:"discount"}
];
function getAcademyDisciplineCost(id){
 const rank=academyDisciplines[id]||0;
 return 3+Math.floor(Math.pow(rank+1,1.4));
}
function getAcademyDisciplineBonus(id){
 const rank=academyDisciplines[id]||0;
 const rate=id==="governance"?0.0125:0.025;
 return Math.min(id==="governance"?0.15:0.50,rate*Math.log2(1+rank));
}
function upgradeAcademyDiscipline(id){
 if(!Object.prototype.hasOwnProperty.call(academyDisciplines,id)||
    academyDisciplines[id]>=10000)return false;
 const price=getAcademyDisciplineCost(id);
 if(getResearchInsightAvailable()<price)return false;
 academyDisciplines[id]++;
 saveGame();renderResearchTree();updateUI();
 return true;
}

function getResearchNode(id) {
    return RESEARCH_NODES.find(node => node.id === id) || null;
}
function getResearchBonus(type) {
    // Bounded additive bonuses from researched nodes; no exponential stacking.
    let bonus = 0;
    for (const node of RESEARCH_NODES) {
        if (node.bonus === type && researchState[node.id] === true) bonus += node.value;
    }
    for(const college of ACADEMY_DISCIPLINES)
        if(college.bonus===type)bonus+=getAcademyDisciplineBonus(college.id);
    return bonus;
}
function getResearchInsightEarned() {
    const highest=Math.max(maxLevel,bestSeasonStage);
    const highestCastle=Math.max(structures.castle.level,highestCastleEver);
    return Math.max(0,Math.floor((highest-1)/10))+
        Math.max(0,Math.floor(highestCastle/5));
}
// Each College uses the same increasing per-rank cost. Cache the cumulative
// costs once so rendering every research card is constant-time at high ranks.
const academyInsightCostPrefix = [0];
function getAcademyTotalSpent(rank) {
    const safeRank = Math.min(10000, Math.max(0, Math.floor(Number(rank) || 0)));
    while (academyInsightCostPrefix.length <= safeRank) {
        const nextRank = academyInsightCostPrefix.length;
        const price = 3 + Math.floor(Math.pow(nextRank, 1.4));
        academyInsightCostPrefix.push(academyInsightCostPrefix[nextRank - 1] + price);
    }
    return academyInsightCostPrefix[safeRank];
}
function getResearchInsightSpent() {
    const fixed = RESEARCH_NODES.reduce((sum, node) =>
        sum + (researchState[node.id] === true ? node.cost : 0), 0);
    return fixed + ACADEMY_DISCIPLINES.reduce((sum, college) =>
        sum + getAcademyTotalSpent(academyDisciplines[college.id]), 0);
}
function getResearchInsightAvailable() {
    return Math.max(0, getResearchInsightEarned() - getResearchInsightSpent());
}
function getResearchRequirements(node) {
    const reasons = [];
    if (maxLevel <= node.stage) reasons.push("Clear stage " + node.stage);
    if (structures.castle.level < node.castle) reasons.push("Castle Lv " + node.castle);
    for (const req of node.requires) {
        if (researchState[req] !== true) {
            const previous = getResearchNode(req);
            reasons.push(previous ? previous.name : req);
        }
    }
    if (getResearchInsightAvailable() < node.cost) reasons.push(node.cost + " Insight");
    return reasons;
}
function canResearchNode(id) {
    const node = getResearchNode(id);
    return !!node && researchState[id] !== true && getResearchRequirements(node).length === 0;
}
function buyResearchNode(id) {
    if (!canResearchNode(id)) return false;
    researchState[id] = true;
    updateUI();
    if (typeof renderResearchTree === "function") renderResearchTree();
    if (typeof renderArmyView === "function") {
        const army = document.getElementById("army-view");
        if (army && army.style.display !== "none") renderArmyView();
    }
    saveGame();
    return true;
}
function getResearchCostFactor() {
    return Math.max(0.55,(1-getResearchBonus("discount"))*dynastyDiscountFactor());
}
function getStructureCostFactor(id) {
    const academyFactor = getResearchCostFactor() * mktUp(1);
    return id === "castle" ? academyFactor * (1 - getResearchBonus("castleDiscount")) : academyFactor;
}
function openResearchTree() {
    const popup = document.getElementById("research-popup");
    if (!popup) return;
    popup.style.display = "flex";
    renderResearchTree();
}
function closeResearchTree() {
    const popup = document.getElementById("research-popup");
    if (popup) popup.style.display = "none";
    updateStructureUI();
    if (typeof activeKingdomMenu !== "undefined" &&
        ["castle", "market"].includes(activeKingdomMenu)) {
        showMenu(activeKingdomMenu);
    }
}
function renderResearchTree() {
    const root = document.getElementById("research-branches");
    if (!root) return;
    root.replaceChildren();
    const available = getResearchInsightAvailable();
    document.getElementById("research-points").textContent = available + " Insight available · " +
        getResearchInsightEarned() + " earned · " + getResearchInsightSpent() + " spent";
    for (const branch of RESEARCH_BRANCHES) {
        const section = document.createElement("section");
        section.className = "research-branch";
        const heading = document.createElement("h4");
        setIconLabel(heading, branch.id === "warfare" ? "army" : branch.id === "commerce" ? "market" : "governance", branch.name);
        section.appendChild(heading);
        const desc = document.createElement("p");
        desc.className = "research-branch-desc";
        desc.textContent = branch.description;
        section.appendChild(desc);
        const nodes = document.createElement("div");
        nodes.className = "research-node-list";
        for (const node of RESEARCH_NODES.filter(entry => entry.branch === branch.id)) {
            const owned = researchState[node.id] === true;
            const card = document.createElement("article");
            card.className = "research-node" + (owned ? " researched" : "");
            const header = document.createElement("div");
            header.className = "research-node-head";
            const name = document.createElement("strong");
            name.textContent = node.name;
            const price = document.createElement("small");
            price.textContent = owned ? "Researched" : node.cost + " Insight";
            header.append(name,price);
            const description = document.createElement("p");
            description.textContent = node.description;
            const button = document.createElement("button");
            button.type = "button";
            const reasons = owned ? [] : getResearchRequirements(node);
            button.disabled = owned || reasons.length > 0;
            button.textContent = owned ? "✓ Complete" : reasons.length ? "Locked" : "Research";
            button.addEventListener("click", () => buyResearchNode(node.id));
            card.append(header,description);
            if (!owned && reasons.length) {
                const requires = document.createElement("small");
                requires.className = "research-prerequisites";
                requires.textContent = "Requires: " + reasons.join(" · ");
                card.appendChild(requires);
            }
            card.appendChild(button);
            nodes.appendChild(card);
        }
        section.appendChild(nodes);
        const college=ACADEMY_DISCIPLINES.find(d=>d.id===branch.id);
        if(college){
            const card=document.createElement("article");
            card.className="research-node research-college";
            const name=document.createElement("strong");
            name.textContent=college.name+" · Rank "+academyDisciplines[college.id];
            const desc=document.createElement("p");
            desc.textContent="Repeatable "+college.effect+" · "+
                Math.round(getAcademyDisciplineBonus(college.id)*100)+"% so far";
            const btn=document.createElement("button");
            const cost=getAcademyDisciplineCost(college.id);
            const maxed = academyDisciplines[college.id] >= 10000;
            btn.textContent = maxed ? "Maximum rank" : "Advance · " + cost + " Insight";
            btn.disabled = maxed || available < cost;
            btn.addEventListener("click",()=>upgradeAcademyDiscipline(college.id));
            card.append(name,desc,btn);
            section.appendChild(card);
        }
        root.appendChild(section);
    }
}
