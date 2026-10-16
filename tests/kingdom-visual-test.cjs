const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..');
const context={};vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root,'kingdom-art.js'),'utf8')+';this.art=KingdomArt;',context);
const map=fs.readFileSync(path.join(root,'kingdom-map.js'),'utf8');
const locations=JSON.parse(map.match(/const locations = (\[[\s\S]*?\n    \]);/)[1].replace(/(\w+):/g,'"$1":'));
const render=(state,size)=>{
 const commands=[];
 const ctx={clearRect(){},fillRect(x,y,w,h){commands.push([x,y,w,h,this.fillStyle]);}};
 context.art.draw(ctx,state,size);
 assert.equal(ctx.imageSmoothingEnabled,false);
 for(const [x,y,w,h] of commands){
  assert([x,y,w,h].every(Number.isInteger),'Crisp integer pixel edges');
  assert(w>0&&h>0,'No reversed/empty drawing rectangles');
  assert(x>=0&&y>=0&&x+w<=size&&y+h<=size,'Artwork fits map canvas: '+[x,y,w,h]);
 }
 return commands;
};
const signatures=[];
for(const level of [0,1,2,4,6,8,12,20]) {
 const state={levels:{castle:Math.max(1,level),tavern:level,blacksmith:level,barracks:level,market:level},stage:level?200:1,roles:['vanguard','ranger','mystic','raider']};
 const saved=JSON.stringify(state),pixels=render(state,400);
 assert.equal(JSON.stringify(state),saved,'Rendering cannot mutate progress');
 assert.deepEqual(render(state,400),pixels,'Art is deterministic across redraws');
 assert.deepEqual(pixels.map(([x,y,w,h,c])=>[x/2,y/2,w/2,h/2,c]),render(state,200),'Entire scene shares one 200px art grid');
 for(const site of locations){
  const [l,t,r,b]=site.bounds.map(n=>n*20);
  const cx=(l+r)/2,cy=(t+b)/2;
  const center=pixels.findLast(([x,y,w,h])=>cx>=x&&cy>=y&&cx<x+w&&cy<y+h);
  assert(center&&!['#52734a','#5a7b4e','#4b6b43'].includes(center[4]),site.id+' has artwork at its clickable center');
 }
 signatures.push(JSON.stringify(pixels));
}
assert.equal(new Set(signatures).size,8,'Construction and upgrade milestones remain visually distinct');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
assert(html.indexOf('src="kingdom-art.js"')<html.indexOf('src="kingdom.js"'),'Renderer loads before game integration');
assert(fs.readFileSync(path.join(root,'sw.js'),'utf8').includes('"./kingdom-art.js"'),'Renderer available offline');
assert(!map.includes('roofFromAbove')&&!map.includes('kingdom-pin'),'No competing drawing style or floating cards');
console.log('Kingdom art: 8 development states, 11 clickable sites, grid/extent/state/offline checks passed.');
