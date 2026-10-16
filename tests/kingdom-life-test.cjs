const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
let serial=0,draws=0;const timers=new Map(),listeners={},motion={matches:false,addEventListener(n,fn){this.change=fn;}},view={style:{display:'none'}};
const state={document:{hidden:false,getElementById:id=>id==='kingdom-view'?view:{width:400,getContext:()=>({})},addEventListener:(n,f)=>listeners[n]=f},
 window:{matchMedia:()=>motion},structures:{castle:{level:1}},batterySaverEnabled:false,
 drawKingdom(){draws++;},KingdomArt:{drawLife(){}},GameDialogs:{current:()=>state.modal},
 setTimeout(fn,delay){const id=++serial;timers.set(id,{fn,delay});return id;},clearTimeout(id){timers.delete(id);}};
vm.createContext(state);vm.runInContext(fs.readFileSync(path.join(__dirname,'../kingdom-life.js'),'utf8'),state);
const run=code=>vm.runInContext(code,state);let checks=0;const check=(condition,label)=>{assert.ok(condition,label);checks++;};
function tick(){const [id,timer]=[...timers][0];timers.delete(id);timer.fn();}
run('refreshKingdomLife()');check(!timers.size,'Hidden Kingdom has no timer');
view.style.display='block';run('refreshKingdomLife();refreshKingdomLife()');check(timers.size===1,'Repeated navigation cannot duplicate timer');
tick();check(draws===1&&timers.size===1,'Visible map redraws and schedules one next frame');
state.modal='court';run('refreshKingdomLife()');check(!timers.size,'Opening a dialog stops animation');
state.modal=null;state.batterySaverEnabled=true;run('refreshKingdomLife()');check([...timers.values()][0].delay===600,'Battery Saver lowers update frequency');
run('notifyKingdomUpgrade("castle")');tick();check(run('kingdomLifeUpgrade.elapsed')===600,'Upgrade feedback runs when map is visible');
state.document.hidden=true;listeners.visibilitychange();check(!timers.size,'Background tab stops animation');
state.document.hidden=false;listeners.visibilitychange();tick();tick();tick();check(run('kingdomLifeUpgrade')===null,'Construction effect expires after brief display');
motion.matches=true;motion.change();check(!timers.size,'Reduced motion disables animation');
// Drawing remains on-grid and within the map at every sampled frame.
const artContext={};vm.createContext(artContext);vm.runInContext(fs.readFileSync(path.join(__dirname,'../kingdom-art.js'),'utf8')+';this.art=KingdomArt;',artContext);
for(const time of [0,180,600,1200,24000,47800]) {
 const progress={time,levels:{market:1,blacksmith:1},upgrade:{id:'castle',elapsed:1200}};
 const before=JSON.stringify(progress),commands=[];
 artContext.art.drawLife({fillRect(...args){commands.push(args);}},progress,400);
 check(commands.every(([x,y,w,h])=>[x,y,w,h].every(Number.isInteger)&&x>=0&&y>=0&&x+w<=400&&y+h<=400),'Life sprites remain crisp and bounded at '+time);
 check(JSON.stringify(progress)===before,'Animation never mutates game state');
}
console.log('Kingdom life: '+checks+' checks passed.');
