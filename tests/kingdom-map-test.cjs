// Focused Kingdom UI integration checks, no browser dependency.
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const source = fs.readFileSync(path.join(__dirname,"..","kingdom-map.js"),"utf8");
const html = fs.readFileSync(path.join(__dirname,"..","index.html"),"utf8");
const css = fs.readFileSync(path.join(__dirname,"..","style.css"),"utf8");
assert(!source.includes("kingdom-pin"),"No floating buttons over the art");
assert(source.includes("roofFromAbove(") &&
    !source.includes("const hall ="),"New landmarks are roof-first top-down sprites");
for(const roofColor of ["#716a84","#a68b56","#647d80","#826475"]){
    assert(source.includes(roofColor),"Distinct original-style roof palette "+roofColor);
}
assert(source.includes("roofless") || source.includes("ROOFLESS"),
    "Relic shrine is an open overhead courtyard");
assert(!source.includes("scrollIntoView"),"No bottom-page drawer");
assert(html.includes('id="kingdom-location-popup"') &&
       html.includes('aria-modal="true"'),"Kingdom detail uses a proper dialog");
assert(css.includes("#kingdom-location-body") &&
       !css.includes(".kingdom-map-sites"),"Modal scrolls inside popup, not beneath map");

let active = null;
const byId = new Map(), callbacks = {}, actions = [], renders = [];
function createNode(tagName="DIV") {
    const el = {
        tagName:tagName.toUpperCase(),style:{},dataset:{},children:[],
        attributes:{},hidden:false,disabled:false,scrollTop:0,
        _events:{}, classList:{add(){},remove(){}},
        append(...children){for(const child of children)this.appendChild(child);},
        appendChild(child){
            if (child.parentElement) child.parentElement.children =
                child.parentElement.children.filter(old=>old!==child);
            child.parentElement=this;this.children.push(child);return child;
        },
        prepend(child){child.parentElement=this;this.children.unshift(child);},
        before(){},
        focus(){document.activeElement=this;},
        setAttribute(key,value){this.attributes[key]=String(value);},
        addEventListener(type,handler){this._events[type]=handler;},
        querySelectorAll(){return[];},
        getBoundingClientRect(){return{left:0,top:0,width:400,height:400};},
        getContext(){return {fillRect(){},clearRect(){},strokeRect(){}};},
        getClientRects(){return[{}];},
        closest(){return null;}
    };
    return el;
}
function register(id,node=createNode()){node.id=id;byId.set(id,node);return node;}
const document = {
    activeElement:null,
    getElementById(id){return byId.get(id)||null;},
    createElement:tag=>createNode(tag),
    querySelector(selector){
        return selector==="#upgrade-buttons .kingdom-construction button" ? null : null;
    },
    addEventListener(type,handler){callbacks[type]=handler;}
};
const view=register("kingdom-view"), map=register("kingdom-box");
const canvas=register("kingdom-canvas");
canvas.width=400;canvas.height=400;
const caption=createNode("P"),legacy=createNode("DIV");
legacy.previousElementSibling=createNode("H3");
view.querySelector=selector => selector===".structure-list"?legacy:
    selector===".map-caption"?caption:null;
const modal=register("kingdom-location-popup");
modal.style.display="none";
const popupContent=createNode("DIV");
modal.querySelector=()=>popupContent;
const title=register("kingdom-location-title");
const close=register("kingdom-location-close",createNode("BUTTON"));
const body=register("kingdom-location-body");
const actionsRoot=register("upgrade-buttons");
for(const id of ["royal-treasury","relic-vault","monster-bestiary",
                 "boss-bestiary","dynasty-panel"]) register(id);
const state={castle:{level:1},tavern:{level:0},blacksmith:{level:0},
             barracks:{level:0},market:{level:0}};
const context={
    document,structures:state,gold:100000,
    openGameDialog:id=>{document.getElementById(id).style.display="flex";},
    closeGameDialog:id=>{document.getElementById(id).style.display="none";},
    showMenu:id=>actions.push("show:"+id),
    drawKingdom:()=>actions.push("draw"),
    getStructureCost:()=>500,
    structureLockReason:()=>"",
    formatDigits:n=>String(n),
    upgradeStructure:id=>{state[id].level++;actions.push("upgrade:"+id);return true;},
    openResearchTree:()=>actions.push("research"),
    renderDynastyPanel:()=>renders.push("dynasty"),
    renderRelicVault:()=>renders.push("relics"),
    renderMonsterBestiary:()=>renders.push("monsters"),
    renderBossBestiary:()=>renders.push("bosses"),
    updateTreasuryUI:()=>renders.push("treasury"),
    console
};
vm.runInNewContext(source,context,{filename:"kingdom-map.js"});
assert.equal(typeof callbacks.DOMContentLoaded,"function");
callbacks.DOMContentLoaded();
function click(x,y){canvas.onclick({clientX:x*20,clientY:y*20});}
click(10,4);
assert(actions.includes("show:castle"),"Castle itself opens existing upgrade popup");
assert(actionsRoot.children.length>0,"Castle includes construction action");
const initial = actions.length;
click(7,11); // road, not a building
assert.equal(actions.length,initial,"Road never selects the nearest landmark");
click(3,11);
assert(actions.includes("show:tavern"),"Unbuilt Tavern is clickable");
click(17,11);
assert(actions.includes("show:market"),"Unbuilt Market is clickable");
click(3,4.5);
assert(actions.includes("research"),"Academy opens original research popup");
click(10,9.5);
assert.equal(modal.style.display,"flex","Relic Vault opens centered modal");
assert.equal(title.textContent,"Relic Vault");
assert(renders.includes("relics"),"Relic content refreshes when opened");
assert(body.children.some(group=>group.children.some(el=>el.id==="relic-vault")),
    "Existing Relic Vault node moved into popup intact");
close._events.click();
assert.equal(modal.style.display,"none","Close hides modal");
assert.equal(document.activeElement,canvas,"Close restores map keyboard focus");
click(17,4.5);
assert.equal(title.textContent,"Royal Treasury");
assert(renders.includes("treasury"),"Treasury refreshes inside popup");
modal._events.keydown({key:"Escape",preventDefault(){}});
assert.equal(modal.style.display,"none","Escape dismisses location modal");
click(3,17);
assert.equal(title.textContent,"Royal Archives");
assert(renders.includes("monsters")&&renders.includes("bosses"),
    "Both archives open in same modal");
modal._events.click({target:modal});
assert.equal(modal.style.display,"none","Backdrop click closes modal");
canvas.focus();
canvas._events.keydown({key:"Home",preventDefault(){}});
assert(canvas.attributes["aria-label"].includes("Royal Academy"),"Keyboard map announces selection");
canvas._events.keydown({key:"Enter",preventDefault(){},repeat:false});
assert.equal(actions.at(-1),"research","Enter opens keyboard-selected landmark");
canvas._events.mousemove({clientX:10*20,clientY:11*20});
assert.equal(canvas.style.cursor,"default","Road has no misleading click cursor");
canvas._events.mousemove({clientX:17*20,clientY:11*20});
assert.equal(canvas.style.cursor,"pointer","Building artwork has pointer cursor");
console.log("Kingdom map regression: 19 checks passed.");