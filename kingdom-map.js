// Kingdom map hub: presentation only. Existing upgrade and save rules stay authoritative.
(function () {
    "use strict";
    const destinations = [
        {id:"academy", label:"Academy", icon:"research", x:18, y:23, hint:"Royal research and discoveries"},
        {id:"castle", label:"Castle", icon:"kingdom", x:50, y:23, hint:"Royal court and decrees"},
        {id:"treasury", label:"Treasury", icon:"treasury", x:82, y:23, hint:"Claim earned royal bounties"},
        {id:"tavern", label:"Tavern", icon:"hero", x:16, y:56, hint:"Hire and train mercenaries"},
        {id:"relics", label:"Relic Vault", icon:"shield", x:50, y:49, hint:"Craft and equip relics"},
        {id:"market", label:"Market", icon:"market", x:85, y:56, hint:"Guild projects and commerce"},
        {id:"archives", label:"Archives", icon:"battle", x:15, y:86, hint:"Field guides and boss records"},
        {id:"blacksmith", label:"Forge", icon:"shield", x:35, y:75, hint:"Squad equipment and upgrades"},
        {id:"barracks", label:"Barracks", icon:"army", x:65, y:75, hint:"Squad roles and training"},
        {id:"dynasty", label:"Dynasty", icon:"dynasty", x:85, y:86, hint:"Legacy and season investments"}
    ];
    const structureNames = {
        castle:"Castle", tavern:"Tavern", blacksmith:"Blacksmith",
        barracks:"Barracks", market:"Market"
    };
    const structureHelp = {
        castle:"Raise the hero cap and royal power.",
        tavern:"Expand mercenary hiring and your company.",
        blacksmith:"Improve equipment and forge squad kits.",
        barracks:"Train stronger mercenaries and specialize squads.",
        market:"Expand monster-gold income and merchant charters."
    };
    let pins = new Map();
    let drawer = null;
    let selected = "";
    let lastSelectedButton = null;
    const oldShowMenu = showMenu;
    const oldDrawKingdom = drawKingdom;
    const oldUpdateStructureUI = updateStructureUI;

    function element(tag, cls, text) {
        const node = document.createElement(tag);
        if (cls) node.className = cls;
        if (text) node.textContent = text;
        return node;
    }
    function visit(id, button) {
        if (id === "academy") {
            openResearchTree();
            return;
        }
        if (Object.prototype.hasOwnProperty.call(structureNames, id)) {
            oldShowMenu(id);
            addBuildingAction(id);
            return;
        }
        if (!drawer) return;
        selected = id;
        lastSelectedButton = button || pins.get(id) || null;
        for (const panel of drawer.querySelectorAll(".kingdom-location")) {
            panel.hidden = panel.dataset.location !== id;
        }
        drawer.hidden = false;
        pins.forEach((pin, key) => {
            pin.classList.toggle("is-selected", key === id);
            pin.setAttribute("aria-pressed", String(key === id));
        });
        if (id === "archives") {
            for (const details of drawer.querySelectorAll("#monster-bestiary,#boss-bestiary")) {
                details.open = true;
            }
            if (typeof renderMonsterBestiary === "function") renderMonsterBestiary();
            if (typeof renderBossBestiary === "function") renderBossBestiary();
        }
        if (id === "dynasty" && typeof renderDynastyPanel === "function") renderDynastyPanel();
        if (id === "relics" && typeof renderRelicVault === "function") renderRelicVault();
        if (id === "treasury" && typeof updateTreasuryUI === "function") updateTreasuryUI();
        drawer.scrollIntoView({block:"nearest", behavior:"auto"});
    }
    function dismissDetails() {
        if (!drawer) return;
        drawer.hidden = true;
        selected = "";
        pins.forEach(pin => {
            pin.classList.remove("is-selected");
            pin.setAttribute("aria-pressed", "false");
        });
        if (lastSelectedButton) lastSelectedButton.focus();
    }
    function addBuildingAction(id) {
        const actions = document.getElementById("upgrade-buttons");
        if (!actions || !structures[id]) return;
        const current = structures[id];
        const locked = structureLockReason(id);
        const price = id === "tavern" && current.level === 0
            ? 0 : getStructureCost(current);
        const panel = element("section", "kingdom-construction");
        const head = element("div", "kingdom-construction-head");
        head.append(element("strong", "", structureNames[id] + " · Lv " + current.level));
        const text = element("p", "", structureHelp[id]);
        const button = element("button", "", locked
            ? "Locked · " + locked
            : (current.level ? "Upgrade" : "Construct") + (price ? " · " +
                formatDigits(price, 2, 0).trim() + " gold" : " · Free"));
        button.type = "button";
        button.disabled = !!locked;
        button.addEventListener("click", () => {
            if (upgradeStructure(id)) {
                oldShowMenu(id);
                addBuildingAction(id);
                const next = actions.querySelector(".kingdom-construction button");
                if (next) next.focus();
            }
        });
        panel.append(head, text, button);
        actions.prepend(panel);
    }
    // Preserve existing function signatures for all legacy callers.
    showMenu = function (id) {
        oldShowMenu(id);
        if (Object.prototype.hasOwnProperty.call(structureNames, id)) addBuildingAction(id);
    };
    function refreshPins() {
        for (const site of destinations) {
            const pin = pins.get(site.id);
            if (!pin) continue;
            const status = pin.querySelector(".kingdom-pin-status");
            if (!status) continue;
            if (structures[site.id]) {
                const level = structures[site.id].level;
                const lock = structureLockReason(site.id);
                status.textContent = lock || (level ? "Lv " + level : "Build");
                pin.classList.toggle("is-unbuilt", level === 0);
                pin.classList.toggle("is-locked", !!lock);
                pin.setAttribute("aria-label", site.label + ": " +
                    (lock || (level ? "level " + level : "ready to build")) +
                    ". " + site.hint);
            } else {
                status.textContent = site.id === "treasury" &&
                    document.getElementById("treasury-claim")?.disabled === false
                    ? "Reward ready" : "Visit";
                pin.setAttribute("aria-label", site.label + ". " + site.hint);
            }
        }
    }
    updateStructureUI = function (...args) {
        const value = oldUpdateStructureUI(...args);
        refreshPins();
        return value;
    };
    function drawLandmarks() {
        const canvas = document.getElementById("kingdom-canvas");
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const u = canvas.width / 20;
        const tile = (x,y,w,h,c) => {
            ctx.fillStyle=c;
            ctx.fillRect(Math.round(x*u),Math.round(y*u),
                Math.round(w*u),Math.round(h*u));
        };
        const hall = (x,y,roof,light) => {
            tile(x-.25,y+.1,2.7,2.15,"#27282b");
            tile(x,y+.3,2.2,1.7,"#a2977e");
            tile(x-.18,y-.1,2.56,.62,roof);
            tile(x+.25,y+.55,.3,.5,light);
            tile(x+1.58,y+.55,.3,.5,light);
            tile(x+.86,y+1.14,.48,.85,"#373130");
        };
        hall(2.2,3.6,"#68527e","#d8c6ee"); // Royal Academy
        tile(3.02,3.1,.55,.65,"#e5c8f1");
        hall(15.3,3.6,"#ab8646","#ffe4a2"); // Treasury
        tile(16.05,3.12,.72,.65,"#d8bb67");
        hall(1.9,15.65,"#657c79","#afd0cb"); // Archive
        tile(2.78,15.2,.38,.48,"#c3d4cc");
        hall(16.05,15.65,"#74536e","#eac1d3"); // Dynasty estate
        tile(16.95,15.14,.24,.59,"#edc16b");
        // Relic shrine beside the main road.
        tile(9.18,8.7,1.65,1.55,"#3d4247");
        tile(9.35,8.85,1.31,1.18,"#939997");
        tile(9.77,8.94,.48,.63,"#67c6ab");
        tile(9.88,8.72,.26,.25,"#baf1db");
        tile(9.43,9.82,1.1,.12,"#dad6b8");
    }
    drawKingdom = function (...args) {
        const value = oldDrawKingdom(...args);
        drawLandmarks();
        refreshPins();
        return value;
    };
    function setupDrawer(hub) {
        drawer = element("section", "kingdom-detail");
        drawer.id = "kingdom-location-panel";
        drawer.hidden = true;
        drawer.setAttribute("aria-label", "Selected Kingdom location");
        const heading = element("div","kingdom-detail-head");
        const title = element("h3", "", "Kingdom ledger");
        const close = element("button", "", "Return to map");
        close.type = "button";
        close.addEventListener("click", dismissDetails);
        heading.append(title, close);
        drawer.append(heading);
        const groups = [
            ["treasury", ["royal-treasury"]],
            ["relics", ["relic-vault"]],
            ["archives", ["monster-bestiary","boss-bestiary"]],
            ["dynasty", ["dynasty-panel"]]
        ];
        for (const [key, ids] of groups) {
            const section = element("div","kingdom-location");
            section.dataset.location = key;
            section.hidden = true;
            for (const id of ids) {
                const existing = document.getElementById(id);
                if (existing) section.append(existing);
            }
            drawer.append(section);
        }
        hub.after(drawer);
        const titleLabels = {
            treasury:"Royal Treasury", relics:"Relic Vault",
            archives:"Royal Archives", dynasty:"Dynasty Estate"
        };
        const originalVisit = visit;
        // Keep the heading synchronized without moving any game-state data.
        for (const site of destinations) {
            const pin = pins.get(site.id);
            if (!pin) continue;
            pin.addEventListener("click", () => {
                if (titleLabels[site.id]) title.textContent = titleLabels[site.id];
                originalVisit(site.id, pin);
            });
        }
    }
    function initialize() {
        const view = document.getElementById("kingdom-view");
        const box = document.getElementById("kingdom-box");
        const canvas = document.getElementById("kingdom-canvas");
        if (!view || !box || !canvas) return;
        const heading = element("p","kingdom-map-kicker","THE ROYAL DOMAIN");
        heading.id = "kingdom-map-label";
        box.before(heading);
        const mapLayer = element("div","kingdom-map-sites");
        for (const site of destinations) {
            const button = element("button","kingdom-pin");
            button.type = "button";
            button.style.left = site.x + "%";
            button.style.top = site.y + "%";
            button.title = site.hint;
            button.dataset.site = site.id;
            button.setAttribute("aria-pressed","false");
            const mark = element("span","ui-icon ui-icon-" + site.icon);
            mark.setAttribute("aria-hidden","true");
            const label = element("span","kingdom-pin-label",site.label);
            const status = element("small","kingdom-pin-status","Visit");
            button.append(mark,label,status);
            mapLayer.append(button);
            pins.set(site.id,button);
        }
        box.append(mapLayer);
        setupDrawer(box);
        const legacy = view.querySelector(".structure-list");
        if (legacy?.previousElementSibling?.tagName === "H3") {
            legacy.previousElementSibling.classList.add("kingdom-legacy-heading");
        }
        const caption = view.querySelector(".map-caption");
        if (caption) caption.textContent =
            "Select a building to construct or upgrade it. Visit landmarks for research, relics, archives, treasury rewards, and dynasty legacy.";
        canvas.setAttribute("aria-hidden","true");
        canvas.onclick = function (event) {
            const rect = canvas.getBoundingClientRect();
            if (!rect.width || !rect.height) return;
            const x = (event.clientX - rect.left) * 100 / rect.width;
            const y = (event.clientY - rect.top) * 100 / rect.height;
            let best = null;
            let distance = Infinity;
            for (const site of destinations) {
                const dx = x - site.x, dy = y - site.y;
                const d = Math.sqrt(dx*dx + dy*dy);
                if (d < distance) { distance=d; best=site; }
            }
            if (best && distance < 10) pins.get(best.id).click();
        };
        view.classList.add("kingdom-map-ready");
        drawKingdom();
        refreshPins();
    }
    document.addEventListener("DOMContentLoaded", initialize);
})();