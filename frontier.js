// Five authored Frontier regions. No running timers; spawn- and menu-driven UI.
const FRONTIER_REGIONS=Object.freeze([
{id:"ashen",start:101,end:120,name:"Ashen Marches",trait:"regenerating",color:"#aa7351",hp:1.22,resist:0.95,gold:1.12,counter:"Ember Blades",note:"Regenerators heal faster."},
{id:"iron",start:121,end:140,name:"Iron Frontier",trait:"armored",color:"#8ca0a8",hp:1.28,resist:0.90,gold:1.12,counter:"Vanguards / Piercing Arms",note:"Armored enemies have reinforced plating."},
{id:"wisp",start:141,end:160,name:"Wisp Fen",trait:"spectral",color:"#a796cc",hp:1.26,resist:0.90,gold:1.13,counter:"Mystics / Runic Weapons",note:"Spectral enemies resist ordinary steel."},
{id:"storm",start:161,end:180,name:"Storm Pass",trait:"evasive",color:"#86bcc8",hp:1.20,resist:0.96,gold:1.14,counter:"Rangers",note:"Evasive enemies gain extra dodge."},
{id:"crown",start:181,end:200,name:"Dragon Crown",trait:"armored",color:"#d2a167",hp:1.35,resist:0.93,gold:1.16,counter:"Vanguards / Piercing Arms",note:"Dragons and armored guardians grow stronger."}
]);
function getFrontierRegion(stage=currentLevel){
 const lvl=Math.floor(Number(stage));
 return FRONTIER_REGIONS.find(reg=>lvl>=reg.start&&lvl<=reg.end)||null;
}
function enhanceFrontierEnemy(base,stage){
 const reg=getFrontierRegion(stage);
 if(!reg)return base;
 const veteran=stage%5===0&&stage%10!==0;
 const strong=base.trait===reg.trait;
 const hp=base.hp*(strong?reg.hp:1.06)*(veteran?1.45:1);
 return {...base,name:(veteran?"Veteran ":"")+base.name,
  hp:Number(hp.toFixed(4)),
  resistance:Number((base.resistance*(strong?reg.resist:1)).toFixed(4)),
  regen:strong&&base.regen?Math.min(.09,base.regen+.015):base.regen,
  dodge:strong&&base.dodge?Math.min(.32,base.dodge+.08):base.dodge,
  gold:Number((base.gold*reg.gold*(veteran?1.6:1)).toFixed(4)),
  champion:veteran,frontier:true,regionId:reg.id,
  summary:base.summary+" · "+reg.name+(strong?" · Counter: "+reg.counter:"")+
    (veteran?" · Veteran rewards +60%":"")};
}
function updateFrontierUI(stage=currentLevel){
 const region=getFrontierRegion(stage);
 const hero=document.getElementById("frontier-hero");
 const kingdom=document.getElementById("frontier-kingdom");
 const cleared=Math.max(0,Math.floor(maxLevel)-1);
 if(hero){
   hero.hidden=!region;
   if(region){hero.textContent="⚑ "+region.name+" · "+region.start+"–"+region.end+
      " · Counter: "+region.counter;hero.style.borderColor=region.color;}
 }
 if(kingdom){
   kingdom.hidden=cleared<100;
   if(cleared>=100){
     const active=getFrontierRegion(Math.min(cleared,200))||FRONTIER_REGIONS[0];
     kingdom.textContent="⚑ "+active.name+" · Highest cleared "+cleared+
       " · "+active.note+" Recommended: "+active.counter;
     kingdom.style.borderColor=active.color;
   }
 }
}
