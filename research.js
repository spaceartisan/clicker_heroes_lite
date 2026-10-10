// Royal Academy: bounded, permanent research from milestones, independent of religion.
// One Insight per first-time cleared 10th stage, plus one per five Castle levels.
// Total Insight is derived from progression, so existing saves earn retroactive credit.
const RESEARCH_BRANCHES = [
    { id: "warfare", name: "Warfare", icon: "⚔️", description: "Military doctrine and enemy-counter tactics" },
    { id: "commerce", name: "Commerce", icon: "⚖️", description: "Trade, discounts, and monster bounties" },
    { id: "governance", name: "Governance", icon: "🏰", description: "Administration, scholarship, and royal power" }
];
// Future faith/religion systems can add their own domain without touching Insight.
const RESEARCH_FUTURE_DOMAINS = ["faith"];
const RESEARCH_NODES = [
    { id:"field_manuals", branch:"warfare", name:"Field Manuals", cost:1, stage:10, castle:1, requires:[], description:"+8% mercenary DPS", bonus:"squadDamage", value:0.08 },
    { id:"beast_lore", branch:"warfare", name:"Bestiary", cost:2, stage:30, castle:1, requires:["field_manuals"], description:"+15% damage against armored and spectral enemies", bonus:"counterDamage", value:0.15 },
    { id:"siege_doctrine", branch:"warfare", name:"Siege Doctrine", cost:2, stage:50, castle:3, requires:["field_manuals"], description:"+12% damage against boss dragons", bonus:"bossDamage", value:0.12 },
    { id:"trade_routes", branch:"commerce", name:"Trade Routes", cost:1, stage:10, castle:1, requires:[], description:"+8% gold from enemies", bonus:"enemyGold", value:0.08 },
    { id:"guild_charters", branch:"commerce", name:"Guild Charters", cost:2, stage:30, castle:2, requires:["trade_routes"], description:"5% cheaper buildings and upgrades", bonus:"discount", value:0.05 },
    { id:"royal_mint", branch:"commerce", name:"Royal Mint", cost:3, stage:70, castle:4, requires:["guild_charters"], description:"+12% gold from enemies", bonus:"enemyGold", value:0.12 },
    { id:"royal_survey", branch:"governance", name:"Royal Survey", cost:1, stage:10, castle:1, requires:[], description:"8% cheaper Castle upgrades", bonus:"castleDiscount", value:0.08 },
    { id:"scribes_college", branch:"governance", name:"Scribes' College", cost:2, stage:30, castle:2, requires:["royal_survey"], description:"+10% offline gold income", bonus:"offlineGold", value:0.10 },
    { id:"royal_academy", branch:"governance", name:"Royal Academy", cost:3, stage:60, castle:4, requires:["scribes_college"], description:"+15% hero click damage", bonus:"heroDamage", value:0.15 }
];
let researchState = {};

function getResearchNode(id) {
    return RESEARCH_NODES.find(node => node.id === id) || null;
}
function getResearchBonus(type) {
    // Bounded additive bonuses from researched nodes; no exponential stacking.
    let bonus = 0;
    for (const node of RESEARCH_NODES) {
        if (node.bonus === type && researchState[node.id] === true) bonus += node.value;
    }
    return bonus;
}
function getResearchInsightEarned() {
    return Math.max(0, Math.floor((maxLevel - 1) / 10)) +
        Math.max(0, Math.floor(structures.castle.level / 5));
}
function getResearchInsightSpent() {
    return RESEARCH_NODES.reduce((sum, node) => sum + (researchState[node.id] === true ? node.cost : 0), 0);
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
    return Math.max(0.60, 1 - getResearchBonus("discount"));
}
function getStructureCostFactor(id) {
    const academyFactor = getResearchCostFactor();
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
        heading.textContent = branch.icon + " " + branch.name;
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
        root.appendChild(section);
    }
}
