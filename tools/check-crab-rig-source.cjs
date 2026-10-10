// Load current controller and atlas into an existing native Cocos runtime; no build.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const ts=require('D:/Cocos/editors/Creator/3.8.8/resources/app.asar.unpacked/node_modules/typescript');
const {chromium}=require('C:/Users/LIN/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'assets/resources/gameplay/enemies/crab-rig'),out=path.join(root,'temp/verification/crab-rig');fs.mkdirSync(out,{recursive:true});
const prefab=JSON.parse(fs.readFileSync(path.join(root,'assets/prefabs/Enemy.prefab'),'utf8')),settings=prefab.find(o=>'attackInterval' in o&&'hurtWidth' in o);
const payload={source:ts.transpileModule(fs.readFileSync(path.join(root,'assets/scripts/EnemyController.ts'),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,experimentalDecorators:true}}).outputText,json:JSON.parse(fs.readFileSync(path.join(dir,'enemy-crab.json'),'utf8')),atlas:fs.readFileSync(path.join(dir,'enemy-crab.atlas'),'utf8'),png:'data:image/png;base64,'+fs.readFileSync(path.join(dir,'enemy-crab.png')).toString('base64'),settings};
(async()=>{const browser=await chromium.launch({headless:true,channel:'chrome'}),errors=[];try{
 const page=await browser.newPage({viewport:{width:1280,height:720}});page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.argv[2]||'http://127.0.0.1:8799');await page.waitForFunction(()=>getComputedStyle(document.getElementById('splash')).display==='none',null,{timeout:120000});
 const frame=await(await page.locator('#game').elementHandle()).contentFrame();
 const report=await frame.evaluate(async p=>{
  const cc=await System.import('cc'),world=cc.director.getScene().getChildByName('Canvas').getChildByName('World'),hero=world.getChildByName('Hero'),spawner=world.getChildByName('EnemySpawner').getComponent('EnemySpawner');cc.director.pause();
  const enemyNode=cc.instantiate(spawner.enemyPrefab);enemyNode.active=false;const e=enemyNode.getComponent('EnemyController');
  const modules={CircleBody2D:hero.getComponent('CircleBody2D').constructor,HeroHealth:hero.getComponent('HeroHealth').constructor,CoinSystem:world.getComponent('CoinSystem').constructor};
  const exports={},module={exports},decorators={ccclass:()=>c=>c,requireComponent:()=>c=>c,property:()=>()=>{}};
  const require=name=>name==='cc'?{...cc,_decorator:decorators}:name==='./SoundEffects'?{SoundEffects:{play(){}}}:name==='./SpriteTransition'?{playSpriteClip(){}}:{[name.slice(2)]:modules[name.slice(2)]};
  new Function('require','exports','module',p.source)(require,exports,module);
  for(const name of Object.getOwnPropertyNames(exports.EnemyController.prototype))if(name!=='constructor')Object.defineProperty(e,name,Object.getOwnPropertyDescriptor(exports.EnemyController.prototype,name));
  for(const [key,value] of Object.entries(p.settings))if(!key.startsWith('_')&&key!=='node'&&key!=='target'&&key!=='crabSkeleton')e[key]=value;
  const image=new Image();image.src=p.png;await image.decode();const texture=new cc.Texture2D();texture.image=new cc.ImageAsset(image);
  const data=new cc.sp.SkeletonData();data.skeletonJson=p.json;data.atlasText=p.atlas;data.textures=[texture];data.textureNames=['enemy-crab.png'];data.name='enemy-crab';e.crabSkeleton=data;e.skeleton=null;e.target=hero;
  enemyNode.setPosition(hero.position.x-250,hero.position.y,0);world.addChild(enemyNode);enemyNode.active=true;
  const s=e.skeleton,initial={animation:s.getCurrent(0).animation.name,spriteActive:enemyNode.getChildByName('Visual').getChildByName('Sprite').active,slots:s.skeletonData.skeletonJson.slots.length,scale:s.node.scale.x,durations:['Idle','Move','Attack','Death'].map(a=>s.findAnimation(a).duration),legacyClips:!!(e.walkClip||e.attackClip||e.deathClip||e.idleClip)};
  e.update(.01);s.updateAnimation(.2);const movingTime=s.getCurrent(0).trackTime;e.update(.01);const noRestart=s.getCurrent(0).trackTime===movingTime;
  const health=hero.getComponent('HeroHealth');enemyNode.setPosition(hero.position.x-70,hero.position.y,0);e.attackCooldown=0;e.update(0);
  const attack={animation:s.getCurrent(0).animation.name,hitTime:e.hitTime,duration:e.attackDuration,facing:enemyNode.scale.x};
  const hp=health.currentHealth;e.update(.279);const beforeHit=health.currentHealth;e.update(.002);const atHit=health.currentHealth;e.update(.01);const once=health.currentHealth;
  s.setAnimation(0,'Attack',false);s.updateAnimation(.28);s.updateRenderData();const claw=s.findBone('right-palm'),attackDirection={rotation:claw.rotation,worldX:claw.worldX};
  window.crabCheck={e,s,enemyNode,hero,world};
  return {initial,noRestart,attack,attackDirection,damage:{hp,beforeHit,atHit,once}};
 },payload);
 assert.equal(report.initial.animation,'Idle');assert(!report.initial.spriteActive&&!report.initial.legacyClips);assert.equal(report.initial.slots,16);assert.equal(report.initial.scale,.84);assert(report.noRestart);assert.equal(report.attack.animation,'Attack');assert.equal(report.attack.hitTime,.28);assert(Math.abs(report.attack.duration-.55)<1e-5);assert.equal(report.damage.beforeHit,report.damage.hp);assert.equal(report.damage.atHit,report.damage.hp-1);assert.equal(report.damage.once,report.damage.atHit);assert(report.attackDirection.rotation<0&&report.attackDirection.worldX>0);
 await page.screenshot({path:path.join(out,'attack.png')});
 report.recovery=await frame.evaluate(()=>{const {e,s,enemyNode,hero}=crabCheck;e.update(.3);const idle=s.getCurrent(0).animation.name;e.attackCooldown=0;enemyNode.setPosition(hero.position.x+70,hero.position.y,0);e.update(0);const facing=enemyNode.scale.x;e.cancelAttack();return {idle,facing,afterCancel:s.getCurrent(0).animation.name};});
 assert.equal(report.recovery.idle,'Idle');assert(report.recovery.facing<0);assert.equal(report.recovery.afterCancel,'Idle');
 report.death=await frame.evaluate(()=>{const {e,s,enemyNode,world}=crabCheck;const coins=world.getComponent('CoinSystem'),drop=coins.dropCoin;let drops=0;coins.dropCoin=function(...args){drops++;return drop.apply(this,args)};e.takeDamage(999);const start={animation:s.getCurrent(0).animation.name,blocking:e.body.enabled,active:enemyNode.active,ready:e.isReadyToRemove};s.updateAnimation(.2);const mid={active:enemyNode.active,drops,face:s.findSlot('dead-face').getAttachment()?.name};s.updateAnimation(.66);const end={active:enemyNode.active,ready:e.isReadyToRemove,drops};e.finishDeath();end.afterRepeat=drops;coins.dropCoin=drop;return {start,mid,end};});
 assert.equal(report.death.start.animation,'Death');assert(!report.death.start.blocking&&report.death.start.active&&!report.death.start.ready);assert.equal(report.death.mid.face,'dead-face');assert(report.death.mid.active&&report.death.mid.drops===0);assert(!report.death.end.active&&report.death.end.ready);assert.equal(report.death.end.drops,1);assert.equal(report.death.end.afterRepeat,1);assert.deepEqual(errors,[]);
 // Exercise deferred destruction too: the Spine child is disposed before its parent.
 await frame.evaluate(async()=>{const cc=await System.import('cc');crabCheck.enemyNode.destroy();cc.director.resume();});
 await page.waitForTimeout(500);
 report.destroyed=await frame.evaluate(()=>!crabCheck.enemyNode.isValid);
 assert(report.destroyed);assert.deepEqual(errors,[]);
 report.errors=errors;report.mode='Current controller and fresh atlas in existing Cocos native runtime; no build';fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
