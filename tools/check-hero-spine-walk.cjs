const fs=require('fs'),path=require('path');
const {chromium}=require('C:/Users/LIN/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{const browser=await chromium.launch({headless:true,channel:'chrome'}),messages=[],out=path.resolve(__dirname,'../temp/hero-spine-walk');fs.mkdirSync(out,{recursive:true});
try{const page=await browser.newPage({viewport:{width:1280,height:760}});page.on('pageerror',e=>messages.push(e.message));page.on('console',m=>{if(m.type()==='error')messages.push(m.text())});await page.goto('http://localhost:7456');
await page.waitForFunction(()=>{const h=window.cc?.director?.getScene()?.getChildByName('Canvas')?.getChildByName('World')?.getChildByName('Hero');return h?.getComponent('HeroVisual')?.hasWalkSpine && h?.getComponent('HeroEvolution')?.themeWalkSkeletons?.filter(Boolean).length===4 && !h.getComponent('HeroEvolution').loadingThemeClips},null,{timeout:25000}).catch(async e=>{console.log(JSON.stringify({messages,state:await page.evaluate(()=>{const h=window.cc?.director?.getScene()?.getChildByName('Canvas')?.getChildByName('World')?.getChildByName('Hero'),v=h?.getComponent('HeroVisual'),e=h?.getComponent('HeroEvolution');return {scene:window.cc?.director?.getScene()?.name,hero:!!h,method:!!v?.configureWalkSpine,walks:e?.themeWalkSkeletons?.map(x=>x?.name),settings:e?.forms?.[0]?.themeVisual?.walkSpine,loaded:!e?.loadingThemeClips,walk:v?.walkSkeleton?.skeletonData?.name}})}));throw e});
const results=[];
for(let stage=0;stage<4;stage++){
 const result=await page.evaluate(stage=>{
  const world=cc.director.getScene().getChildByName('Canvas').getChildByName('World'),node=world.getChildByName('Hero'),hero=node.getComponent('HeroController'),evolution=node.getComponent('HeroEvolution'),visual=node.getComponent('HeroVisual');
  cc.director.pause();if(stage)evolution.evolve();
  const fail=m=>{throw Error('stage '+(stage+1)+': '+m)};
  hero.move(1,0,0);if(!visual.usesWalkSpine||visual.picture.active||visual.usesSpine)fail('walk renderer not selected');
  const skeleton=visual.walkSkeleton;skeleton.updateAnimation(.1);const start=skeleton.getCurrent(0)?.trackTime;for(let i=0;i<8;i++)hero.move(1,0,0);const unchanged=skeleton.getCurrent(0)?.trackTime;if(start!==unchanged)fail('movement restarted walk');skeleton.updateAnimation(.2);const advanced=skeleton.getCurrent(0)?.trackTime;if(!(advanced>start))fail('walk does not advance');
  hero.move(-1,0,0);if(visual.facing!==-1||visual.pivot.scale.x!==-1)fail('mirror');
  hero.startAttack();if(visual.usesWalkSpine||!visual.picture.active||!hero.attacking||!(hero.attackDuration>0))fail('attack did not switch back');hero.finishAttack();if(!visual.usesWalkSpine)fail('moving attack recovery');
  hero.stopMoving();if(visual.usesWalkSpine||!visual.picture.active||!hero.animation.enabledInHierarchy)fail('idle recovery');
  hero.startAttack();hero.stopMoving();hero.finishAttack();if(visual.usesWalkSpine||!visual.picture.active)fail('stopped attack recovery');
  hero.move(1,0,0);skeleton.updateAnimation(.25);
  return {stage:stage+1,asset:skeleton.skeletonData.name,track:skeleton.getCurrent(0)?.animation?.name,start,advanced,duration:hero.attackDuration,scale:skeleton.node.scale.x,y:skeleton.node.position.y,walkVisible:visual.usesWalkSpine,spriteVisible:visual.picture.active};
 },stage);
 results.push(result);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await page.screenshot({path:path.join(out,`stage-${stage+1}.png`)});
}
await page.evaluate(()=>{const node=cc.director.getScene().getChildByName('Canvas').getChildByName('World').getChildByName('Hero'),hero=node.getComponent('HeroController'),v=node.getComponent('HeroVisual');hero.onDied();if(!v.walkSkeleton.paused||v.walkSkeleton.getCurrent(0))throw Error('death did not stop walk')});
if(messages.length)throw Error(JSON.stringify(messages));fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({results,messages},null,2));console.log(JSON.stringify({results,messages}));
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
