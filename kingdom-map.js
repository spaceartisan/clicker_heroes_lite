// Map-first Kingdom: click illustrated buildings; details open in game-style dialogs.
// This layer never changes progression data or cloud-save formats.
(function () {
    "use strict";
    // All hit areas use the same 20x20 coordinate grid as the pixel-art canvas.
    // They enclose the actual artwork, not the roads or the space between sites.
    const locations = [
        {id:"academy", label:"Royal Academy", bounds:[2.0,3.0,5.0,6.4], description:"Royal research"},
        {id:"castle", label:"Castle", bounds:[7.4,2.0,12.8,6.9], description:"Royal Court and decrees"},
        {id:"treasury", label:"Royal Treasury", bounds:[15.0,3.1,18.3,6.6], description:"Milestones and bounties"},
        {id:"tavern", label:"Tavern", bounds:[1.5,9.35,4.5,12.5], description:"Mercenary hiring"},
        {id:"relics", label:"Relic Vault", bounds:[8.6,8.4,11.4,10.7], description:"Craft and equip relics"},
        {id:"market", label:"Market", bounds:[15.5,9.5,18.65,12.5], description:"Merchant Guild"},
        {id:"archives", label:"Royal Archives", bounds:[1.5,15.1,4.9,18.2], description:"Monster and boss field guides"},
        {id:"blacksmith", label:"Blacksmith", bounds:[5.4,13.6,8.4,16.55], description:"Forge squad equipment"},
        {id:"barracks", label:"Barracks", bounds:[11.65,13.3,14.75,16.6], description:"Train and specialize squads"},
        {id:"commissions", label:"Royal Commissions", bounds:[12.8,6.4,15.0,7.8], description:"Kingdom requests and rewards"},
        {id:"dynasty", label:"Dynasty Estate", bounds:[15.65,15.2,19.0,18.2], description:"Legacy and dynasty investments"}
    ];
    const buildingNames = {
        castle:"Castle", tavern:"Tavern", blacksmith:"Blacksmith",
        barracks:"Barracks", market:"Market"
    };
    const buildingHelp = {
        castle:"Raise the hero cap and strengthen the Royal Court.",
        tavern:"Expand mercenary hiring and your company.",
        blacksmith:"Improve equipment and forge squad kits.",
        barracks:"Train stronger mercenaries and specialize squads.",
        market:"Expand monster-gold income and merchant charters."
    };
    const modalContents = {
        treasury:["royal-treasury"],
        relics:["relic-vault"],
        archives:["monster-bestiary","boss-bestiary"],
        dynasty:["dynasty-panel"]
    };
    const originalShowMenu = showMenu;
    const originalDrawKingdom = drawKingdom;
    let keyboardIndex = -1;
    let canvas = null;
    let modal = null;
    let modalTitle = null;
    let modalClose = null;
    let modalSections = new Map();
    let activeTap = null;
    let lastTouch = null;

    function developedLocations() {
        const sites = [];
        const add = (id,label,bounds) => sites.push({id,label,bounds});
        if (structures.castle.level >= 12) {
            add("castle","Royal residence",[5.7,7.8,7.0,9.0]);
            add("castle","Royal residence",[13.0,7.8,14.3,9.0]);
        }
        if (structures.castle.level >= 20) {
            add("castle","Royal residence",[5.3,5.8,6.4,6.9]);
            add("castle","Royal residence",[13.4,5.1,14.5,6.2]);
        }
        const stage = typeof maxLevel === "number" ? maxLevel : 1;
        if (stage > 100) add("barracks","Frontier outpost",[5.4,10.2,7.3,12.1]);
        if (stage > 140) add("barracks","Frontier outpost",[13.9,11.5,15.5,13.1]);
        if (stage > 180) add("barracks","Frontier outpost",[1.1,13.0,3.0,14.6]);
        return sites;
    }

    function node(tag, className, label) {
        const el = document.createElement(tag);
        if (className) el.className = className;
        if (label) el.textContent = label;
        return el;
    }
    function locationAt(x, y, touch = false) {
        const sites = [...locations,...developedLocations()];
        const exact = sites.find(site => x >= site.bounds[0] && x <= site.bounds[2] &&
            y >= site.bounds[1] && y <= site.bounds[3]);
        if (exact || !touch) return exact || null;
        // A small finger margin, never a map-wide nearest-building selection.
        const rect = canvas.getBoundingClientRect();
        let nearest = null, distance = 9;
        for (const site of sites) {
            const [left,top,right,bottom] = site.bounds;
            const dx = Math.max(left-x,0,x-right)*rect.width/20;
            const dy = Math.max(top-y,0,y-bottom)*rect.height/20;
            const gap = Math.hypot(dx,dy);
            if (gap <= 8 && gap < distance) {nearest=site;distance=gap;}
        }
        return nearest;
    }
    function canvasPoint(event) {
        if (!canvas) return null;
        const rect = canvas.getBoundingClientRect();
        if (!rect.width || !rect.height || !Number.isFinite(event.clientX) ||
            !Number.isFinite(event.clientY)) return null;
        return {
            x:(event.clientX - rect.left) * 20 / rect.width,
            y:(event.clientY - rect.top) * 20 / rect.height
        };
    }
    function beginTap(event) {
        activeTap = {id:event.pointerId,x:event.clientX,y:event.clientY,cancelled:false};
    }
    function moveTap(event) {
        if (!activeTap || activeTap.id !== event.pointerId) return;
        if (Math.hypot(event.clientX-activeTap.x,event.clientY-activeTap.y)>10)
            activeTap.cancelled = true;
    }
    function endTap(event) {
        if (!activeTap || activeTap.id !== event.pointerId) return;
        moveTap(event);
        const cancelled = activeTap.cancelled;
        activeTap = null;
        lastTouch = {x:event.clientX,y:event.clientY,time:Date.now()};
        if (cancelled) return;
        const point = canvasPoint(event);
        const site = point && locationAt(point.x,point.y,true);
        if (!site) return;
        if (event.cancelable) event.preventDefault();
        canvas.focus({preventScroll:true});
        activate(site);
    }
    function cancelTap() {
        if (activeTap) {
            lastTouch={x:activeTap.x,y:activeTap.y,time:Date.now()};
            activeTap.cancelled=true;
        }
    }
    function locationLabel(site) {
        if (Object.prototype.hasOwnProperty.call(buildingNames,site.id)) {
            const building = structures[site.id];
            const lock = structureLockReason(site.id);
            return site.label + " · " + (lock || (building.level ?
                "Level " + building.level : "Ready to construct"));
        }
        return site.label + " · " + site.description;
    }
    function addBuildingAction(id) {
        const target = document.getElementById("upgrade-buttons");
        const structure = structures[id];
        if (!target || !structure) return;
        // The original menu clears this section on every opening.
        const locked = structureLockReason(id);
        const price = id === "tavern" && structure.level === 0 ?
            0 : getStructureCost(structure);
        const section = node("section","kingdom-construction");
        section.append(node("strong","",buildingNames[id] + " · Level " + structure.level));
        section.append(node("p","",buildingHelp[id]));
        const action = node("button","",
            locked ? "Locked · " + locked :
            (structure.level ? "Upgrade" : "Construct") + " · " +
                (price ? formatDigits(price,2,0).trim() + " gold" : "Free"));
        action.type = "button";
        action.disabled = !!locked || (!locked && gold < price);
        if (!locked && gold < price) action.title = "Not enough gold";
        action.addEventListener("click", () => {
            if (upgradeStructure(id)) {
                showMenu(id);
                const next = document.querySelector("#upgrade-buttons .kingdom-construction button");
                if (next) next.focus();
            }
        });
        section.append(action);
        target.prepend(section);
    }
    // Other systems still call showMenu directly; preserve the standard popup.
    showMenu = function (id) {
        originalShowMenu(id);
        if (Object.prototype.hasOwnProperty.call(buildingNames,id)) addBuildingAction(id);
    };
    function closeLocation() {
        if (!modal || modal.style.display === "none") return;
        closeGameDialog("kingdom-location-popup");
        modal.setAttribute("aria-hidden","true");
        if (canvas) canvas.focus();
    }
    function openLocation(id) {
        if (!modal || !modalSections.has(id)) return;
        for (const [key, section] of modalSections) section.hidden = key !== id;
        modalTitle.textContent = locations.find(site=>site.id===id).label;
        openGameDialog("kingdom-location-popup", closeLocation);
        modal.setAttribute("aria-hidden","false");
        const content = modal.querySelector(".popup-content");
        if (content) content.scrollTop = 0;
        const body = document.getElementById("kingdom-location-body");
        if (body) body.scrollTop = 0;
        if (id === "archives") {
            for (const key of modalContents.archives) {
                const details = document.getElementById(key);
                if (details) details.open = true;
            }
            if (typeof renderMonsterBestiary === "function") renderMonsterBestiary();
            if (typeof renderBossBestiary === "function") renderBossBestiary();
        } else if (id === "dynasty" && typeof renderDynastyPanel === "function") {
            renderDynastyPanel();
        } else if (id === "relics" && typeof renderRelicVault === "function") {
            renderRelicVault();
        } else if (id === "treasury" && typeof updateTreasuryUI === "function") {
            updateTreasuryUI();
        }
        if (modalClose && modalClose.isConnected) modalClose.focus();
    }
    function activate(site) {
        if (!site) return;
        if (site.id === "commissions") {
            openRoyalCommissions();
        } else if (site.id === "academy") {
            openResearchTree();
        } else if (Object.prototype.hasOwnProperty.call(buildingNames,site.id)) {
            showMenu(site.id);
        } else {
            openLocation(site.id);
        }
    }
    function focusLocation(index) {
        keyboardIndex = (index + locations.length) % locations.length;
        const site = locations[keyboardIndex];
        canvas.setAttribute("aria-label",
            "Kingdom map. " + locationLabel(site) +
            ". Use arrow keys to choose a location; Enter to open.");
        canvas.title = locationLabel(site);
        drawKingdom();
    }
    function paintLandmarks() {
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const unit = canvas.width / 20;
        // Keyboard outline remains a temporary 2px outline, never a label/card.
        if (keyboardIndex >= 0 && document.activeElement === canvas) {
            const b = locations[keyboardIndex].bounds;
            ctx.lineWidth = 2;
            ctx.strokeStyle = "#ffdc83";
            ctx.strokeRect(Math.round(b[0]*unit),Math.round(b[1]*unit),
                Math.round((b[2]-b[0])*unit),Math.round((b[3]-b[1])*unit));
        }
    }
        drawKingdom = function (...args) {
        const result = originalDrawKingdom(...args);
        paintLandmarks();
        return result;
    };
    function setupPopup() {
        modal = document.getElementById("kingdom-location-popup");
        modalTitle = document.getElementById("kingdom-location-title");
        modalClose = document.getElementById("kingdom-location-close");
        const body = document.getElementById("kingdom-location-body");
        if (!modal || !modalTitle || !modalClose || !body) return false;
        for (const [id, originalIds] of Object.entries(modalContents)) {
            const section = node("section","kingdom-modal-section");
            section.hidden = true;
            for (const originalId of originalIds) {
                const source = document.getElementById(originalId);
                if (source) section.appendChild(source); // keep listeners and save logic
            }
            body.appendChild(section);
            modalSections.set(id,section);
        }
        modalClose.addEventListener("click",closeLocation);
        modal.addEventListener("click",event => {
            if (event.target === modal) closeLocation();
        });
        modal.addEventListener("keydown",event => {
            if (event.key === "Escape") {
                event.preventDefault();
                closeLocation();
            } else if (event.key === "Tab") {
                const focusables = [...modal.querySelectorAll(
                    "button:not([disabled]),select:not([disabled]),input:not([disabled])," +
                    "a[href],[tabindex]:not([tabindex='-1'])")].filter(el =>
                        !el.closest("[hidden]") && el.getClientRects().length);
                if (!focusables.length) return;
                const first = focusables[0], last = focusables[focusables.length-1];
                if (event.shiftKey && document.activeElement === first) {
                    event.preventDefault();last.focus();
                } else if (!event.shiftKey && document.activeElement === last) {
                    event.preventDefault();first.focus();
                }
            }
        });
        return true;
    }
    function initialize() {
        const kingdom = document.getElementById("kingdom-view");
        const map = document.getElementById("kingdom-box");
        canvas = document.getElementById("kingdom-canvas");
        if (!kingdom || !map || !canvas || !setupPopup()) return;
        const heading = node("p","kingdom-map-kicker","THE ROYAL DOMAIN");
        map.before(heading);
        const legacy = kingdom.querySelector(".structure-list");
        if (legacy && legacy.previousElementSibling?.tagName === "H3")
            legacy.previousElementSibling.classList.add("kingdom-legacy-heading");
        const caption = kingdom.querySelector(".map-caption:not(#kingdom-commission-status)");
        if (caption) caption.textContent = "Tap a building or landmark to manage it. " +
            "Your Royal Academy, Treasury, relics, archives and dynasty are part of the map.";
        canvas.setAttribute("tabindex","0");
        canvas.setAttribute("role","button");
        canvas.setAttribute("aria-label",
            "Kingdom map. Use arrow keys to choose a location; Enter to open.");
        canvas.onclick = event => {
            if (lastTouch && Date.now()-lastTouch.time<800 &&
                Math.hypot(event.clientX-lastTouch.x,event.clientY-lastTouch.y)<25) return;
            const point = canvasPoint(event);
            if (point) activate(locationAt(point.x,point.y));
        };
        // Standalone mobile browsers need not synthesize a click for canvas taps.
        // Let the browser own panning; pointercancel and movement reject scrolls.
        if (typeof window !== "undefined" && window.PointerEvent) {
            canvas.addEventListener("pointerdown",event => {
                if (event.pointerType === "mouse") return;
                if (event.isPrimary === false || activeTap && !activeTap.cancelled) {
                    cancelTap();return;
                }
                beginTap(event);
            });
            canvas.addEventListener("pointermove",moveTap,{passive:true});
            canvas.addEventListener("pointerup",endTap);
            canvas.addEventListener("pointercancel",cancelTap,{passive:true});
        } else {
            // Older iOS/WebViews without Pointer Events use the same tap rules.
            canvas.addEventListener("touchstart",event => {
                if (event.touches.length !== 1) {cancelTap();return;}
                const t=event.touches[0];
                beginTap({pointerId:t.identifier,clientX:t.clientX,clientY:t.clientY});
            },{passive:true});
            canvas.addEventListener("touchmove",event => {
                if (event.touches.length !== 1) {cancelTap();return;}
                const t=event.touches[0];
                moveTap({pointerId:t.identifier,clientX:t.clientX,clientY:t.clientY});
            },{passive:true});
            canvas.addEventListener("touchend",event => {
                if (event.touches.length) {cancelTap();return;}
                for (const t of event.changedTouches) endTap({pointerId:t.identifier,
                    clientX:t.clientX,clientY:t.clientY,cancelable:event.cancelable,
                    preventDefault:()=>event.preventDefault()});
            },{passive:false});
            canvas.addEventListener("touchcancel",cancelTap,{passive:true});
        }
        canvas.addEventListener("mousemove",event => {
            if (lastTouch && Date.now()-lastTouch.time<800) return;
            const point = canvasPoint(event);
            const site = point && locationAt(point.x,point.y);
            canvas.style.cursor = site ? "pointer" : "default";
            canvas.title = site ? locationLabel(site) : "Choose a building or landmark";
        });
        canvas.addEventListener("mouseleave",() => {
            canvas.style.cursor = "default";
            canvas.title = "Choose a building or landmark";
        });
        canvas.addEventListener("keydown",event => {
            if (["ArrowRight","ArrowDown","ArrowLeft","ArrowUp","Home","End"].includes(event.key)) {
                event.preventDefault();
                const next = event.key === "Home" ? 0 :
                    event.key === "End" ? locations.length-1 :
                    keyboardIndex < 0 ? 1 : keyboardIndex +
                        (event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1);
                focusLocation(next);
            } else if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                if (!event.repeat) activate(locations[keyboardIndex >= 0 ? keyboardIndex : 1]);
            }
        });
        canvas.addEventListener("blur",() => drawKingdom());
        kingdom.classList.add("kingdom-map-ready");
        drawKingdom();
    }
    document.addEventListener("DOMContentLoaded",initialize);
})();
