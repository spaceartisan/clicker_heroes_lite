// Monster Field Guide: twelve bounded species records, saved locally with Season II.
// No per-stage logs, network writes, runtime-generated combat artwork or passive power creep.
const MONSTER_GUIDE_REWARD = 1;
let monsterCodex = {};
function getMonsterCodexEntry(monsterId) {
    if (!MONSTER_ENCOUNTERS.some(monster => monster.id === monsterId)) return null;
    if (!monsterCodex[monsterId]) monsterCodex[monsterId] = {
        seen:false, defeats:0, highestStage:0, firstDefeatStage:0, trophyClaimed:false
    };
    return monsterCodex[monsterId];
}
function loadMonsterCodexState(data) {
    monsterCodex = {};
    const raw = data && data.monsterCodex &&
        typeof data.monsterCodex === "object" && !Array.isArray(data.monsterCodex)
            ? data.monsterCodex : {};
    for (const monster of MONSTER_ENCOUNTERS) {
        const source = raw[monster.id] && typeof raw[monster.id] === "object" &&
            !Array.isArray(raw[monster.id]) ? raw[monster.id] : {};
        const entry = getMonsterCodexEntry(monster.id);
        entry.seen = source.seen === true;
        entry.defeats = boundedBossStat(source.defeats, 1e9);
        entry.highestStage = boundedBossStat(source.highestStage, 1e12);
        entry.firstDefeatStage = boundedBossStat(source.firstDefeatStage, 1e12);
        entry.trophyClaimed = source.trophyClaimed === true;
        if (entry.defeats > 0) entry.seen = true;
    }
    renderMonsterBestiary();
}
function isMonsterKnown(monster) {
    const entry = getMonsterCodexEntry(monster.id);
    const classic = ENEMY_TYPES.slice(0,5).some(type=>type.id===monster.id);
    // Legacy saves reveal only species that existed in earlier versions.
    return entry.seen || entry.defeats > 0 ||
        (classic && Math.max(bestSeasonStage,maxLevel)-1 >= monsterFirstStage(monster));
}
function recordMonsterSeen(stage,monster) {
    if (!monster || isBossEnemy(monster)) return false;
    const entry = getMonsterCodexEntry(monster.id);
    if (!entry || entry.seen) return false;
    entry.seen = true;
    renderMonsterBestiary();
    return true;
}
function recordMonsterDefeat(stage,monster) {
    if (!monster || isBossEnemy(monster) || !Number.isFinite(stage)) return false;
    const entry = getMonsterCodexEntry(monster.id);
    if (!entry) return false;
    entry.seen = true;
    entry.defeats = Math.min(1e9,entry.defeats+1);
    entry.highestStage = Math.max(entry.highestStage,Math.floor(stage));
    if (!entry.firstDefeatStage) entry.firstDefeatStage = Math.floor(stage);
    if (entry.trophyClaimed) {
        const panel=document.getElementById("monster-bestiary");
        if (panel && panel.open) renderMonsterBestiary();
        return false;
    }
    entry.trophyClaimed = true;
    relicFragments = Math.min(9999,relicFragments+MONSTER_GUIDE_REWARD);
    renderRelicVault();
    renderMonsterBestiary();
    showPopupMessage("Monster recorded: "+monster.name+
        " · +1 relic fragment (first defeat).",false,2600);
    return true;
}
function renderMonsterBestiary() {
    const root=document.getElementById("monster-bestiary-grid");
    if (!root) return;
    const filter=document.getElementById("monster-bestiary-filter");
    const selected=filter ? filter.value : "all";
    const fragment=document.createDocumentFragment();
    let known=0,recorded=0;
    for (const monster of MONSTER_ENCOUNTERS) {
        const entry=getMonsterCodexEntry(monster.id);
        const discovered=isMonsterKnown(monster);
        if (discovered) known++;
        if (entry.trophyClaimed) recorded++;
        if ((selected==="known"&&!discovered) ||
            (selected==="unknown"&&discovered) ||
            (selected==="recorded"&&!entry.trophyClaimed)) continue;
        const card=document.createElement("article");
        card.className="monster-card"+(discovered?"":" monster-card-locked");
        const row=document.createElement("div");
        row.className="monster-card-heading";
        const portrait=document.createElement(discovered?"canvas":"div");
        portrait.className="monster-portrait"+(discovered?"":" monster-portrait-unknown");
        portrait.setAttribute("aria-hidden","true");
        if (discovered) {
            portrait.width=64;
            portrait.height=64;
            const pen=portrait.getContext("2d");
            if (pen) for (let y=0;y<16;y++) for (let x=0;x<16;x++) {
                const pixel=monster.sprite[y][x];
                if (pixel===".") continue;
                pen.fillStyle=monster.palette[Number(pixel)]||monster.palette[2];
                pen.fillRect(x*4,y*4,4,4);
            }
        } else portrait.textContent="?";
        const identity=document.createElement("div");
        const title=document.createElement("strong");
        title.textContent=discovered?monster.name:"Unknown creature";
        const subtitle=document.createElement("small");
        subtitle.textContent=discovered?monster.trait:
            "First appears at stage "+monsterFirstStage(monster);
        identity.append(title,subtitle);
        row.append(portrait,identity);
        card.appendChild(row);
        if (discovered) {
            const tip=document.createElement("p");
            tip.textContent=monster.summary;
            card.appendChild(tip);
            const stats=document.createElement("p");
            stats.className="monster-record";
            stats.textContent="Recorded defeats: "+entry.defeats+
                " · Highest defeated stage: "+(entry.highestStage||"—")+
                (entry.firstDefeatStage?" · First recorded: "+entry.firstDefeatStage:"");
            card.appendChild(stats);
        }
        const reward=document.createElement("p");
        reward.className="monster-trophy";
        reward.textContent=entry.trophyClaimed?"Field specimen recorded · +1 fragment claimed":
            discovered?"Defeat this species once to earn +1 relic fragment":
            "Identity and rewards revealed on encounter";
        card.appendChild(reward);
        fragment.appendChild(card);
    }
    root.replaceChildren(fragment);
    const summary=document.getElementById("monster-bestiary-summary");
    if (summary) summary.textContent=known+"/"+MONSTER_ENCOUNTERS.length+
        " species encountered · "+recorded+"/"+MONSTER_ENCOUNTERS.length+
        " first-defeat specimens recorded. Each species awards one relic fragment"+
        " on its first recorded defeat; replaying stages never repeats that reward."+
        " Boss mastery remains in the Boss Bestiary below.";
    const badge=document.getElementById("monster-bestiary-progress");
    if (badge) badge.textContent=known+"/"+MONSTER_ENCOUNTERS.length+
        " seen · "+recorded+" recorded";
}
document.addEventListener("DOMContentLoaded",()=>{
    const filter=document.getElementById("monster-bestiary-filter");
    if (filter) filter.addEventListener("change",renderMonsterBestiary);
    renderMonsterBestiary();
});
