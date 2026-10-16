(() => {
 const passed=[],ok=(value,label)=>{if(!value)throw Error(label);passed.push(label);};
 gold=1e12;maxLevel=101;currentLevel=100;playerLevel=1;playerGearLevel=0;
 structures.castle.level=10;structures.tavern.level=1;structures.blacksmith.level=2;
 hiredMercenaries.length=0;upgradeMultiplier=1;underfillEnabled=false;
 loadRoyalCommissions(null);
 function track(type,target=1,stage=1){royalCommissions.jobs=[{id:999,kind:'roads',stage,goals:[{type,target,progress:0},{type:'enemy',target:100,progress:0}]}];}
 track('hero');levelUpPlayer();ok(royalCommissions.jobs[0].goals[0].progress===1,'Actual hero purchase advances commission');
 track('gear');gearUpPlayer();ok(royalCommissions.jobs[0].goals[0].progress===1,'Actual hero gear purchase advances commission');
 hireMercenary();track('squad');levelUpMercenary(0);ok(royalCommissions.jobs[0].goals[0].progress===1,'Legacy mercenary training advances commission');
 track('gear');upgradeMercGear(1);ok(royalCommissions.jobs[0].goals[0].progress===1,'Legacy squad gear advances commission once per purchased rank');
 track('squad',10);applyArmyUpgradePlan(planArmyUpgrade([1],'level',10));ok(royalCommissions.jobs[0].goals[0].progress===10,'Army bulk purchase counts actual paid operations');
 track('building');upgradeStructure('castle');ok(royalCommissions.jobs[0].goals[0].progress===1,'Successful building purchase advances commission');
 track('research');researchState={};buyResearchNode('field_manuals');ok(royalCommissions.jobs[0].goals[0].progress===1,'Actual research purchase advances commission');
 track('research');maxLevel=1001;bestSeasonStage=1001;academyDisciplines.warfare=0;upgradeAcademyDiscipline('warfare');ok(royalCommissions.jobs[0].goals[0].progress===1,'College ranks also count as research');
 track('boss',1,100);currentLevel=100;enemyType=getEnemyType(100);deathCooldown=false;handleEnemyDefeat();ok(royalCommissions.jobs[0].goals.every(g=>g.progress===1),'Actual boss victory credits boss and enemy objectives');
 renewRoyalCommissions();recordCommissionEvent('enemy',7,1000);saveGame();
 const checkpoint=JSON.parse(localStorage.getItem('clickerHeroSave')),board=JSON.stringify(checkpoint.royalCommissions);
 royalCommissions=null;loadGame();ok(JSON.stringify(royalCommissions)===board,'Full game save/load preserves issued goals and partial progress');
 delete checkpoint.royalCommissions;localStorage.setItem('clickerHeroSave',JSON.stringify(checkpoint));loadGame();
 ok(royalCommissions.jobs.length===3&&researchState.field_manuals===true&&playerLevel===checkpoint.playerLevel,'Pre-feature save migrates without losing hero or research');
 const lifetime=royalCommissions.completed=5;foundNewDynasty();
 ok(royalCommissions.completed===lifetime&&royalCommissions.dynasty===dynastyCount&&royalCommissions.jobs.every(j=>j.stage===1),'Real Dynasty rebirth resets contracts safely and retains completion count');
 return passed;
})()
