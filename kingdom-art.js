// One overhead pixel-art language for the entire royal domain.
// Authored on a 200px grid, rendered at integer edges on the game canvas.
// Pure drawing: no DOM, random values, saved state, timers, or network access.
const KingdomArt = (() => {
    const palette = {
        ink:'#293b35', shadow:'#344b37', grass:'#52734a', grassLight:'#5a7b4e',
        grassDark:'#4b6b43', leafDark:'#304f3d', leaf:'#446b43', leafLight:'#68864d',
        leafSun:'#879956', stoneDark:'#666b60', stone:'#9b9b83', stoneLight:'#c7bda0',
        mortar:'#7c806b', pathEdge:'#81795b', path:'#b5a17a', pathLight:'#c8b58b',
        wood:'#6e523e', woodLight:'#a88657', gold:'#d4b165', cream:'#e7d5a0',
        waterDark:'#37585d', water:'#47747b', waterLight:'#699195',
        slate:['#465661','#637b83','#849a9b','#b0b9aa'],
        clay:['#704b41','#a26950','#be8760','#dab080'],
        violet:['#554d61','#796c83','#9a879b','#bdacb6'],
        teal:['#405e59','#608177','#83a093','#b2bba2'],
        ochre:['#756044','#a38957','#c1a46c','#deca91']
    };
    function draw(ctx, state, size = 400) {
        const p = palette;
        const scale = size / 200;
        const r = (x,y,w,h,c) => {
            if (w <= 0 || h <= 0) return;
            ctx.fillStyle = c;
            const left=Math.round(x*scale), top=Math.round(y*scale);
            ctx.fillRect(left,top,Math.round((x+w)*scale)-left,Math.round((y+h)*scale)-top);
        };
        ctx.clearRect(0,0,size,size);
        ctx.imageSmoothingEnabled=false;
        const levels=state.levels;
        // All shadows fall southeast; outlines are one logical pixel.
        const slab=(x,y,w,h) => {
            r(x+2,y+3,w,h,p.shadow); r(x,y,w,h,p.ink);
            r(x+1,y+1,w-2,h-3,p.stone); r(x+1,y+1,w-2,1,p.stoneLight);
            r(x+1,y+h-2,w-2,1,p.stoneDark);
        };
        const roof=(x,y,w,h,colors) => {
            slab(x,y,w,h+2);
            r(x,y,w,h,colors[0]);
            const mid=Math.floor(h/2);
            // Stepped hipped slopes; broad roof planes dominate every building.
            for(let row=1;row<h-1;row++) {
                r(x+1,y+row,w-2,1,row<mid?colors[1]:colors[0]);
                const inset=Math.min(5,Math.min(row,h-1-row));
                r(x+inset,y+row,w-inset*2,1,row<mid?colors[2]:colors[1]);
                if(row%3===0) {
                    r(x+inset+1,y+row,w-inset*2-2,1,row<mid?colors[1]:colors[0]);
                    for(let tx=x+inset+3+(row%2)*2;tx<x+w-inset-1;tx+=6)
                        r(tx,y+row-1,1,1,row<mid?colors[3]:colors[2]);
                }
            }
            r(x+5,y+mid,w-10,2,colors[0]);
            r(x+5,y+mid,w-10,1,colors[3]);
            r(x+2,y+1,w-4,1,colors[3]);
        };
        const chimney=(x,y,lit=false) => {
            r(x+1,y+1,5,5,p.ink); r(x,y,5,4,p.stoneLight);
            r(x+1,y+1,3,2,p.stoneDark); r(x+2,y+1,1,1,lit?'#dca15b':p.ink);
        };
        const skylight=(x,y) => {
            r(x,y,5,5,p.ink); r(x+1,y+1,3,3,p.waterLight);
            r(x+1,y+1,2,1,p.cream); r(x+2,y+3,2,1,p.water);
        };
        const barrel=(x,y) => {
            r(x+1,y,4,5,p.ink); r(x,y+1,6,3,p.ink);
            r(x+1,y+1,4,3,p.woodLight); r(x+1,y+2,4,1,p.wood);
            r(x+2,y+1,1,1,p.cream);
        };
        const flag=(x,y,color) => {
            r(x,y,1,8,p.ink); r(x+1,y,1,8,p.cream);
            r(x+2,y,5,3,color); r(x+2,y,5,1,p.cream); r(x+2,y+3,3,1,color);
        };
        const tree=(x,y) => {
            r(x+2,y+5,11,7,p.shadow);
            r(x+2,y,7,1,p.leafDark); r(x,y+2,11,6,p.leafDark);
            r(x+1,y+1,9,8,p.leafDark); r(x+3,y+9,5,1,p.leafDark);
            r(x+2,y+2,7,6,p.leaf); r(x+1,y+3,8,3,p.leaf);
            r(x+2,y+1,5,3,p.leafLight); r(x+1,y+3,3,2,p.leafLight);
            r(x+3,y+1,3,1,p.leafSun); r(x+7,y+5,2,2,p.leafLight);
            r(x+3,y+7,3,1,p.leafDark);
        };
        const path=(x,y,w,h) => {
            r(x,y,w,h,p.pathEdge); r(x+1,y+1,w-2,h-2,p.path);
            if(w>h) for(let xx=x+3;xx<x+w-3;xx+=7) r(xx,y+2,3,1,p.pathLight);
            else for(let yy=y+3;yy<y+h-3;yy+=7) r(x+2,yy,2,1,p.pathLight);
        };
        r(0,0,200,200,p.grass);
        for(let y=1;y<198;y+=5) for(let x=1;x<198;x+=5) {
            const n=(x*31+y*17+x*y)%23;
            if(n<7) r(x,y,3,2,n<3?p.grassDark:p.grassLight);
            if(n===12) {r(x,y,1,2,p.grassLight);r(x+2,y+1,1,1,p.leafLight);}
        }
        // A stepped riverbank and small reed clusters, all on the same grid.
        for(let y=0;y<58;y++) {
            const bank=15+(y<12?3:y<32?1:y<46?2:0);
            r(0,y,bank+3,1,p.shadow);r(0,y,bank+1,1,p.pathEdge);
            r(0,y,bank,1,p.waterDark);r(0,y,bank-3,1,p.water);
        }
        for(let y=3;y<57;y+=9) {r(2+(y%3),y,6,1,p.waterLight);r(8,y+3,4,1,p.waterDark);}
        for(const [x,y] of [[18,7],[17,25],[16,47]]) {
            r(x,y,1,4,p.leafSun);r(x+2,y+2,1,3,p.leafDark);
        }
        path(95,62,14,138);
        path(34,69,132,7);path(33,54,7,20);path(160,54,7,20);
        path(30,113,137,7);path(64,152,71,7);
        path(33,178,141,7);path(32,173,7,10);path(168,173,7,10);
        // Trees share rounded, stepped overhead canopies; no side-view trunks.
        for(const [x,y] of [[24,12],[43,10],[135,14],[180,13],[186,69],[20,77],
            [172,76],[7,89],[6,148],[2,175],[184,187],[47,186],[119,181],[79,171]]) tree(x,y);
        // Small flower beds, stones and grass borders frame the paths.
        for(const [x,y] of [[46,64],[145,62],[87,126],[115,128],[41,174],[158,180]]) {
            r(x,y,5,3,p.grassDark);r(x+1,y,1,1,p.cream);r(x+3,y+2,1,1,p.gold);
        }
        for(const [x,y] of [[7,126],[182,139],[136,87]]) {
            r(x+1,y+1,5,3,p.shadow);r(x,y,5,3,p.stoneDark);r(x+1,y,3,1,p.stone);
        }
        // Royal Court: open ward, roofed keep, stone curtain and four turrets.
        slab(76,22,50,43);
        r(79,25,44,35,p.mortar);r(80,26,42,33,p.path);
        for(let y=28;y<60;y+=5) for(let x=81+(y%2)*2;x<120;x+=7) r(x,y,4,1,p.pathLight);
        r(79,25,44,3,p.stoneLight);r(79,25,3,34,p.stoneLight);
        r(120,25,3,34,p.stoneDark);r(79,59,44,3,p.stoneDark);
        roof(87,31,28,22,p.slate);
        r(98,53,7,10,p.stoneDark);r(99,53,5,13,p.pathLight);
        const tower=(x,y) => {
            slab(x,y,9,9);r(x+2,y+2,5,4,p.stoneDark);r(x+3,y+3,3,2,p.mortar);
            for(const [dx,dy] of [[0,0],[6,0],[0,6],[6,6]]) r(x+dx,y+dy,3,2,p.stoneLight);
        };
        for(const [x,y] of [[76,21],[117,21],[76,57],[117,57]]) tower(x,y);
        flag(111,24,p.gold);
        if(levels.castle>=2) {skylight(92,35);skylight(105,35);}
        if(levels.castle>=4) {roof(82,39,8,14,p.slate);roof(113,39,8,14,p.slate);}
        if(levels.castle>=8) {flag(78,49,p.clay[2]);flag(119,49,p.clay[2]);}
        if(levels.castle>=12) {
            for(let x=87;x<116;x+=6) r(x,24,3,2,p.stoneLight);
            roof(57,78,13,10,p.clay);roof(130,78,13,10,p.clay);
        }
        if(levels.castle>=20) {roof(53,58,11,9,p.clay);roof(134,51,11,9,p.clay);}
        // A low wooden posting desk beside the Court, seen from above.
        slab(129,65,20,11);r(130,66,18,8,p.wood);r(130,66,18,1,p.woodLight);
        r(132,68,5,5,p.cream);r(139,68,6,5,p.pathLight);
        r(133,69,3,1,p.woodLight);r(140,69,4,1,p.wood);
        r(133,71,2,1,p.woodLight);r(140,71,3,1,p.woodLight);
        r(146,68,2,4,state.ready ? p.gold : p.clay[1]);
        // Academy: cruciform violet roof with two skylights and a study wing.
        roof(29,32,13,28,p.violet);roof(22,38,26,18,p.violet);
        skylight(26,41);skylight(39,41);chimney(31,32);
        r(32,58,7,2,p.cream);
        // Treasury: a compact fortified counting house, with brass roof bands.
        roof(153,36,25,23,p.ochre);
        for(const x of [154,173]) {slab(x,34,5,5);r(x+1,35,3,2,p.gold);}
        r(157,46,17,1,p.gold);r(163,53,5,3,p.ochre[0]);r(164,53,3,2,p.cream);
        // Roofless relic sanctuary: recessed paving, four columns, faceted gem.
        slab(90,85,20,20);r(93,88,14,14,p.stoneDark);r(94,89,12,12,p.teal[1]);
        for(const [x,y] of [[91,86],[105,86],[91,100],[105,100]]) {
            r(x,y,4,4,p.ink);r(x,y,3,3,p.stoneLight);r(x+1,y+1,2,2,p.stone);
        }
        r(97,94,7,6,p.ink);r(99,91,3,9,p.waterDark);r(98,93,5,5,p.teal[2]);
        r(99,92,2,7,'#80c4ad');r(100,92,1,4,p.cream);r(101,96,2,2,p.teal[0]);
        // Archives: long green slate hall, repeated glazed roof lights.
        roof(18,157,28,21,p.teal);chimney(20,155);
        for(const x of [23,31,39]) skylight(x,160);
        r(29,178,8,2,p.stoneLight);
        // Dynasty manor: a U-shaped plan and a small formal courtyard.
        slab(159,156,29,23);r(164,165,18,11,p.path);
        roof(160,154,27,12,p.violet);roof(159,164,9,13,p.violet);roof(179,164,9,13,p.violet);
        r(171,169,5,5,p.leafDark);r(172,169,3,3,p.leafLight);r(173,170,1,1,p.gold);
        flag(182,152,p.clay[2]);
        const foundation=(x,y,w,h) => {
            slab(x,y,w,h);r(x+2,y+2,w-4,h-5,p.grassDark);
            r(x+3,y+3,w-6,1,p.woodLight);r(x+3,y+h-5,w-6,1,p.wood);
            for(const xx of [x+3,x+w-5]) {r(xx,y+3,2,h-7,p.wood);r(xx,y+3,2,2,p.cream);}
            r(x+7,y+8,8,2,p.woodLight);r(x+8,y+11,8,2,p.wood);
        };
        // Tavern, forge, barracks and market all use the same roof/foundation system.
        if(!levels.tavern) foundation(19,98,24,24);
        else {
            roof(18,98,25,20,p.clay);chimney(21,97);barrel(20,119);barrel(28,119);
            if(levels.tavern>=3) {r(36,120,6,3,p.wood);r(36,120,6,1,p.cream);}
            if(levels.tavern>=6) roof(19,95,11,7,p.clay);
        }
        if(!levels.blacksmith) foundation(57,139,25,23);
        else {
            roof(57,140,25,18,p.slate);chimney(73,137,true);
            slab(58,156,10,7);r(60,157,6,4,p.ink);r(61,157,4,3,p.clay[2]);r(62,157,2,1,p.gold);
            r(74,160,6,3,p.ink);r(73,160,8,1,p.stoneLight);r(76,158,2,2,p.stone);
            if(levels.blacksmith>=4) {barrel(55,149);r(69,161,3,2,p.stoneLight);}
            if(levels.blacksmith>=6) flag(77,136,p.violet[2]);
        }
        if(!levels.barracks) foundation(120,138,25,24);
        else {
            roof(120,138,25,19,p.slate);flag(140,134,p.slate[2]);
            r(123,159,18,3,p.path);r(124,158,1,4,p.wood);r(139,158,1,4,p.wood);
            if(levels.barracks>=2) {r(122,160,20,1,p.woodLight);r(130,157,1,5,p.woodLight);}
            const roleColors={vanguard:p.clay[2],ranger:p.leafSun,mystic:p.violet[2],raider:p.gold};
            (state.roles||[]).slice(0,6).forEach((role,i)=>{
                r(120+i*4,163,3,2,p.ink);r(120+i*4,162,2,2,roleColors[role]||p.cream);
            });
            if(levels.barracks>=6) flag(119,134,p.gold);
        }
        if(!levels.market) foundation(158,98,25,24);
        else {
            // Overhead canvas pavilion with striped slopes and produce baskets.
            roof(158,98,25,19,p.ochre);
            for(let x=161;x<179;x+=6) {r(x,100,2,6,p.cream);r(x,108,2,6,p.ochre[3]);}
            for(const [x,c] of [[159,p.clay[2]],[166,p.gold],[173,p.leafSun]]) {
                r(x,119,6,4,p.wood);r(x+1,119,4,3,c);r(x+1,119,2,1,p.cream);
            }
            if(levels.market>=2) {barrel(181,115);}
            if(levels.market>=5) {r(157,96,28,1,p.woodLight);flag(179,96,p.clay[2]);}
        }
        for(const [id,x,y] of [['tavern',19,98],['blacksmith',57,140],['barracks',120,138],['market',158,98]]) {
            if(levels[id]>=10) {r(x,y,2,2,p.gold);r(x+22,y,2,2,p.gold);}
        }
        // Frontier and town growth remain visible without spilling onto landmarks.
        if(state.stage>100) {roof(54,106,17,13,p.clay);flag(66,102,p.gold);}
        if(state.stage>140) {roof(139,119,14,10,p.slate);flag(149,115,p.violet[2]);}
        if(state.stage>180) {roof(11,134,15,10,p.clay);flag(23,130,p.gold);}
    }
    // Sparse foreground sprites; caller restores the cached static scene first.
    function drawLife(ctx, state, size = 400) {
        const p=palette, scale=size/200, time=state.time || 0;
        const r=(x,y,w,h,c)=>{
            ctx.fillStyle=c;
            const left=Math.round(x*scale), top=Math.round(y*scale);
            ctx.fillRect(left,top,Math.round((x+w)*scale)-left,Math.round((y+h)*scale)-top);
        };
        const villager=(x,y,color,step)=>{
            x=Math.round(x);y=Math.round(y);
            r(x+1,y+3,4,2,p.shadow);r(x,y,3,4,p.ink);
            r(x,y,2,2,p.cream);r(x,y+2,3,2,color);
            r(x+(step%2),y+4,1,1,p.ink);r(x+2-(step%2),y+4,1,1,p.ink);
        };
        const walk=(start,end,offset)=>{
            const phase=((time/24000+offset)%2);
            return start+(end-start)*(phase<1?phase:2-phase);
        };
        const step=Math.floor(time/450);
        villager(walk(43,153,0),71,p.clay[2],step);
        villager(100,walk(123,148,.6),p.slate[2],step+1);
        if(state.levels.market) villager(walk(45,150,1.1),115,p.gold,step);
        // Banner cloth moves a pixel; poles stay anchored to their roof.
        for(const [x,y,c] of [[113,24,p.gold],[184,152,p.clay[2]]]) {
            r(x,y,5,4,c);r(x,y,5,1,p.cream);
            r(x+4,y+2+(step%2),1,1,p.woodLight);
        }
        if(state.levels.blacksmith) {
            for(let i=0;i<3;i++) {
                const rise=(Math.floor(time/450)+i*3)%10;
                r(74+(rise%3)-1,135-rise,2+(i%2),2,rise<5?p.stoneDark:p.stone);
            }
        }
        if(state.upgrade) {
            const bounds={castle:[76,22,126,65],tavern:[18,98,43,120],blacksmith:[57,137,82,162],
                barracks:[120,138,145,162],market:[158,98,183,122]}[state.upgrade.id];
            if(bounds) {
                const [l,t,right,bottom]=bounds, rise=Math.floor(state.upgrade.elapsed/250);
                for(const [x,y] of [[l-2,t+4],[right+1,t+9],[l+5,bottom-1],[right-4,bottom+2]]) {
                    r(x,y-rise,1,3,p.gold);r(x-1,y+1-rise,3,1,p.cream);
                }
            }
        }
    }
    return {draw,drawLife};
})();
