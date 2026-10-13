// Behavioral tests for the actual dialog controller using a small document model.
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const events = {};
class Node {
    constructor(tag='div') { this.tagName=tag.toUpperCase(); this.children=[]; this.dataset={}; this.style={}; this.attrs={}; this.inert=false; this.hidden=false; this.disabled=false; this.className=''; this.id=''; this.textContent=''; }
    get classList(){return {add:(s)=>this.className+=' '+s};}
    get firstChild(){return this.children[0];}
    get isConnected(){return this===document.body || !!this.parentElement?.isConnected;}
    append(...nodes){for(const node of nodes){node.remove();node.parentElement=this;this.children.push(node);}}
    remove(){if(this.parentElement){this.parentElement.children=this.parentElement.children.filter(n=>n!==this);this.parentElement=null;}}
    setAttribute(k,v){this.attrs[k]=String(v);}
    contains(node){return node===this || this.children.some(n=>n.contains(node));}
    getClientRects(){return !this.isConnected || this.closest('[hidden]') || this.style.display==='none' ? [] : [{}];}
    closest(selector){for(let n=this;n;n=n.parentElement)if(selector.split(',').some(s=>s==='[hidden]'?n.hidden:s==='[inert]'?n.inert:false))return n;return null;}
    focus(){document.activeElement=this;}
    querySelectorAll(selector){
        const match=n=>selector.split(',').some(s=>{
            s=s.trim();
            if(s.includes(':not')) { const tag=s.split(':')[0]; return tag==='[tabindex]'?false:n.tagName===tag.toUpperCase()&&!n.disabled; }
            if(s.startsWith('#'))return n.id===s.slice(1);
            if(s.startsWith('.'))return n.className.split(' ').includes(s.slice(1));
            return n.tagName===s.toUpperCase();
        });
        const nodes=[]; const walk=n=>{for(const child of n.children){if(match(child))nodes.push(child);walk(child);}};walk(this);return nodes;
    }
    querySelector(s){return this.querySelectorAll(s)[0]||null;}
}
const document={body:new Node('body'),activeElement:null,createElement:t=>new Node(t),addEventListener:(name,fn)=>events[name]=fn,getElementById:id=>document.body.querySelector('#'+id)};
function element(tag,id,parent){const n=new Node(tag);n.id=id;if(parent)parent.append(n);return n;}
const game=element('main','game',document.body), opener=element('button','launch',game);
const alreadyInert=element('aside','prior-inert',document.body);alreadyInert.inert=true;
function popup(id,parent=document.body){const el=element('div',id,parent);el.className='popup';el.style.display='none';const content=element('div','',el);content.className='popup-content';element('h3','',content).textContent=id;const launch=element('button',id+'-launch',content);const hidden=element('section','',content);hidden.hidden=true;element('button','hidden-control',hidden);return {el,launch,content};}
const court=popup('court',game), research=popup('research',game), stats=popup('stats');
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../dialogs.js'),'utf8')+'\nthis.dialogs=GameDialogs;', {document, get console(){return console;}, set dialogs(v){global.dialogs=v;}});
let assertions=0;const check=(condition,message)=>{assert.ok(condition,message);assertions++;};
opener.focus();document.body.style.overflow='auto';
dialogs.open('court',()=>dialogs.close('court'));
check(court.el.parentElement===document.body,'Dialog lifted out of ancestor stacking context');
check(court.el.attrs.role==='dialog' && court.el.attrs['aria-modal']==='true','Named modal semantics applied');
check(court.el.attrs['aria-labelledby']===court.content.querySelector('h3').id,'Title association preserved');
check(game.inert && document.body.style.overflow==='hidden','Background cannot receive input or scroll');
check(document.activeElement.className.includes('dialog-close'),'Initial focus goes to persistent close');
court.launch.focus();dialogs.open('research',()=>dialogs.close('research'));
check(court.el.style.display==='none' && research.el.style.display==='flex','Exactly one foreground dialog');
check(court.el.inert && !research.el.inert,'Suspended parent is inert');
let prevented=false;const key=(name,shiftKey=false)=>{prevented=false;events.keydown({key:name,shiftKey,preventDefault(){prevented=true;},stopImmediatePropagation(){}});};
const close=research.el.querySelector('.dialog-close');close.focus();key('Tab',true);
check(prevented && document.activeElement===research.launch,'Shift Tab wraps to last visible control');
key('Tab');check(prevented && document.activeElement===close,'Tab wraps back to Close and skips hidden controls');
opener.focus();events.focusin({target:opener});check(document.activeElement===close,'Programmatic background focus is recovered');
key('Escape');check(dialogs.current()==='court' && document.activeElement===court.launch,'Escape restores the parent and exact opener');
dialogs.open('court');dialogs.close('court');
check(dialogs.current()===null && document.activeElement===opener,'Redraw does not duplicate stack; close restores original opener');
check(!game.inert && alreadyInert.inert && document.body.style.overflow==='auto','Original inert and scroll states restored');
opener.focus();dialogs.open('court');court.launch.focus();dialogs.open('stats');dialogs.close('court');
check(stats.el.style.display==='none' && dialogs.current()===null,'Closing a parent removes descendant contexts');
check(document.activeElement===opener,'Parent teardown returns to external opener');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
check(html.includes('for="stone-theme-toggle"')&&!html.includes('for="dark-theme-toggle"'),'Theme label targets its real checkbox');
for(const section of ['general','account','saves','advanced'])check(html.includes('data-settings-section="'+section+'"'),'Settings section '+section+' exists');
const css=fs.readFileSync(path.join(__dirname,'../menus.css'),'utf8');
check(css.includes('overflow:hidden')&&css.includes('.dialog-body'),'Only dialog body scrolls under persistent header');
console.log('Dialog and settings regression: '+assertions+' checks passed.');
