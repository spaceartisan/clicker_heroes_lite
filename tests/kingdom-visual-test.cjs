const assert=require("node:assert/strict");
const fs=require("node:fs"), path=require("node:path");
const art=fs.readFileSync(path.join(__dirname,"..","kingdom.js"),"utf8");
const map=fs.readFileSync(path.join(__dirname,"..","kingdom-map.js"),"utf8");
function overlap(a,b){return a[0]<b[2]&&a[2]>b[0]&&a[1]<b[3]&&a[3]>b[1];}
const landmarkBounds={
 academy:[1.95,3.37,4.86,5.90],treasury:[15.10,3.37,17.96,5.90],
 archives:[1.75,15.43,4.63,17.92],dynasty:[15.80,15.40,18.60,17.94],
 relics:[8.94,8.43,11.10,10.57]
};
const outposts=[[5.35,10.65,7.15,11.95],[13.85,11.69,15.40,12.99],[1.05,13.10,2.80,14.50]];
for(const outpost of outposts){
 for(const [key,building] of Object.entries(landmarkBounds))
  assert(!overlap(outpost,building),"Frontier outpost clips "+key);
}
const treeMatch=art.match(/for \(const tree of (\[\[.*?\]\])\)/);
assert(treeMatch,"Tree coordinates are authored and reviewable");
for(const [x,y] of JSON.parse(treeMatch[1])){
 for(const [key,building] of Object.entries(landmarkBounds))
  assert(!overlap([x,y-.06,x+1,y+.90],building),"Tree clips "+key);
}
for(const pathSegment of ["footpath(3.29,5.53","footpath(16.11,5.53","footpath(3.46,18.03","footpath(10.78,18.03"])
 assert(art.includes(pathSegment),"Missing connected royal footpath "+pathSegment);
assert(map.includes("roofFromAbove(")&&!map.includes("const hall ="),"Roof-first overhead structures remain");
assert(!map.includes("kingdom-pin")&&!map.includes("scrollIntoView"),"No opaque map overlays or bottom drawer");
console.log("Kingdom overhead-art geometry checks passed.");