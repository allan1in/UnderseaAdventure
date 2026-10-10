// Exercise current source and fresh rig in a Cocos runtime, without rebuilding.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const ts=require('D:/Cocos/editors/Creator/3.8.8/resources/app.asar.unpacked/node_modules/typescript');
const {chromium}=require('C:/Users/LIN/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'assets/resources/gameplay/hero/stage04-rig');
const source=ts.transpileModule(fs.readFileSync(path.join(root,'assets/scripts/HeroEvolution.ts'),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,experimentalDecorators:true}}).outputText;
const payload={source,json:JSON.parse(fs.readFileSync(path.join(dir,'hero-stage-04.json'),'utf8')),atlas:fs.readFileSync(path.join(dir,'hero-stage-04.atlas'),'utf8'),png:'data:image/png;base64,'+fs.readFileSync(path.join(dir,'hero-stage-04.png')).toString('base64')};
const out=path.join(root,'temp/verification/hero-stage04-rig');fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({headless:true,channel:'chrome'}),errors=[];
try{
 const page=await browser.newPage({viewport:{width:1280,height:720}});page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.argv[2]||'http://127.0.0.1:8799');await page.waitForFunction(()=>getComputedStyle(document.getElementById('splash')).display==='none',null,{timeout:120000});
 const frame=await(await page.locator('#game').elementHandle()).contentFrame();
 const report=await frame.evaluate(async p=>{
  const cc=await System.import('cc'),world=cc.director.getScene().getChildByName('Canvas').getChildByName('World'),node=world.getChildByName('Hero');
  const e=node.getComponent('HeroEvolution'),h=node.getComponent('HeroController'),v=node.getComponent('HeroVisual'),health=node.getComponent('HeroHealth');
  const exports={},module={exports},decorators={ccclass:()=>c=>c,executionOrder:()=>c=>c,property:()=>()=>{}};
  const require=name=>name==='cc'?{...cc,_decorator:decorators}:name==='./SoundEffects'?{SoundEffects:{play(){}}}:{[name.slice(2)]:node.getComponent(name.slice(2)).constructor};
  new Function('require','exports','module',p.source)(require,exports,module);
  for(const name of Object.getOwnPropertyNames(exports.HeroEvolution.prototype))if(name!=='constructor'&&typeof Object.getOwnPropertyDescriptor(exports.HeroEvolution.prototype,name).value==='function')e[name]=exports.HeroEvolution.prototype[name];
  const image=new Image();image.src=p.png;await image.decode();const asset=new cc.ImageAsset(image),texture=new cc.Texture2D();texture.image=asset;
  const data=new cc.sp.SkeletonData();data.skeletonJson=p.json;data.atlasText=p.atlas;data.textures=[texture];data.textureNames=['hero-stage-04.png'];data.name='hero-stage-04';e.stageFourSkeleton=data;
  cc.director.pause();e.loadingThemeClips=false;health.currentHealth=30;e.evolve();e.evolve();e.evolve();
  const s=v.skeleton,initial={stage:e.stageIndex,spine:v.usesSpine,sprite:v.picture.active,health:health.currentHealth,data:s.skeletonData.name,slots:p.json.slots.length,scale:s.node.scale.x,frameAttack:!!h.attackClip,hitTime:h.hitTime,durations:['Idle','Move','Attack'].map(a=>s.findAnimation(a).duration)};
  h.move(1,0,0);s.updateAnimation(.2);const time=s.getCurrent(0).trackTime;h.move(1,0,0);const noRestart=s.getCurrent(0).trackTime===time;
  s.setAnimation(0,'Move',true);s.updateAnimation(.2);const capeA=s.findBone('cape').rotation;s.updateAnimation(.6);const capeMotion={parent:s.findBone('cape').parent.data.name,change:Math.abs(s.findBone('cape').rotation-capeA)};
  h.startAttack();const before=node.position.x;h.move(1,0,12);const movingAttack={animation:s.getCurrent(0).animation.name,moved:node.position.x-before,duration:h.attackDuration};
  const angles=[0,.08,.15,.205,.32,.48].map(t=>{s.setAnimation(0,'Attack',false);s.updateAnimation(t);s.updateRenderData();const b=s.findBone('sword');return {time:t,heading:Math.atan2(b.c,b.a)*180/Math.PI+90,parent:b.parent.data.name,attached:!!s.findSlot('sword').getAttachment()};});
  s.setAnimation(0,'Attack',false);s.updateAnimation(.205);s.updateRenderData();
  window.stageFourCheck={e,h,v,s};return {initial,noRestart,movingAttack,angles,capeMotion};
 },payload);
 assert.equal(report.initial.stage,3);assert(report.initial.spine&&!report.initial.sprite&&!report.initial.frameAttack);assert.equal(report.initial.health,100);assert.equal(report.initial.slots,17);assert.equal(report.initial.hitTime,.205);assert(report.noRestart);assert.equal(report.movingAttack.animation,'Attack');assert.equal(report.movingAttack.moved,12);assert(Math.abs(report.movingAttack.duration-.48)<1e-5);
 [5,105,60,5,20,5].forEach((a,i)=>{assert(Math.abs(report.angles[i].heading-a)<2);assert(report.angles[i].attached&&report.angles[i].parent==='near-hand');});
 await page.screenshot({path:path.join(out,'attack.png')});
 report.recovery=await frame.evaluate(()=>{const {e,h,v}=stageFourCheck;h.finishAttack();h.stopMoving();const idle=v.skeleton.getCurrent(0).animation.name;h.move(-1,0,0);const facing=v.pivot.scale.x;e.evolve();return {idle,facing,stage:e.stageIndex,spine:v.usesSpine,sprite:v.picture.active,health:e.getComponent('HeroHealth').currentHealth};});
 assert.equal(report.recovery.idle,'Idle');assert.equal(report.recovery.facing,-1);assert.equal(report.recovery.stage,3);assert(report.recovery.spine&&!report.recovery.sprite);assert(report.capeMotion.parent==='body'&&report.capeMotion.change>1);assert.deepEqual(errors,[]);
 report.errors=errors;report.mode='Current source and fresh atlas loaded into existing Cocos runtime; no build';fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
