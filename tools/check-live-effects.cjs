const fs=require('fs'),path=require('path');
const {chromium}=require('C:/Users/LIN/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'}),messages=[];
 try {
  const page=await browser.newPage({viewport:{width:1280,height:760}});
  page.on('pageerror',e=>messages.push(e.message));
  page.on('console',m=>{if(m.type()==='error')messages.push(m.text());});
  await page.goto('http://localhost:7456');
  const game=page;
  await game.waitForFunction(()=>window.cc?.director?.getScene(),null,{timeout:30000});
  console.log(JSON.stringify(await game.evaluate(()=>{
   const e=cc.director.getScene().getChildByName('Canvas').getChildByName('World').getChildByName('Hero').getComponent('HeroEvolution');
   return {forms:e.forms?.[0]?.themeVisual?.attackEffect,formAsset:e.formData?.json?.forms?.[0]?.themeVisual?.attackEffect,method:!!e.loadThemeSlashFrames,frameCount:e.themeSlashFrames.length};
  })));
  await game.waitForFunction(()=>{
   const world=cc.director.getScene().getChildByName('Canvas')?.getChildByName('World');
   const hero=world?.getChildByName('Hero');
   return hero?.getComponent('HeroController')?.themeSlashFrame && hero?.getComponent('HeroEvolution')?.themeSlashFrames?.filter(Boolean).length===4;
  },null,{timeout:20000});
  await game.waitForFunction(()=>{
   const e=cc.director.getScene().getChildByName('Canvas').getChildByName('World').getChildByName('Hero').getComponent('HeroEvolution');
   return !e.loadingThemeClips;
  },null,{timeout:20000});
  const result=await game.evaluate(()=>{
   const scene=cc.director.getScene(),canvas=scene.getChildByName('Canvas'),world=canvas.getChildByName('World'),node=world.getChildByName('Hero');
   const hero=node.getComponent('HeroController'),evolution=node.getComponent('HeroEvolution');
   return {heroFrame:hero.themeSlashFrame?.name,evolutionFrames:evolution.themeSlashFrames?.map(f=>f?.name),scene:scene.name,
    assets:hero.themeSlashFrame?{texture:hero.themeSlashFrame.texture?.width,loaded:hero.themeSlashFrame.texture?.image?.data?.width}:null,
    playing:hero.attacking,children:world.children.map(n=>n.name)};
  });
  console.log(JSON.stringify({result,messages}));
  if(process.argv.includes('--ranged')) {
   await game.evaluate(()=>{
    const world=cc.director.getScene().getChildByName('Canvas').getChildByName('World'),hero=world.getChildByName('Hero');
    const system=world.getComponent('BossBattleSystem'),boss=cc.instantiate(system.bossPrefab);
    boss.active=false;world.addChild(boss);boss.setPosition(hero.position.x-450,hero.position.y);
    boss.getComponent('BossController').target=hero;boss.active=true;window.remoteBoss=boss;
   });
   await game.waitForFunction(()=>window.remoteBoss.getComponent('BossRangedAttack')?.tentacleFrames.length===16,null,{timeout:15000});
   const warning=await game.evaluate(()=>{
    const boss=window.remoteBoss,c=boss.getComponent('BossController'),r=boss.getComponent('BossRangedAttack');
    c.cooldown=0;c.rangedCooldown=0;c.update(0);cc.director.pause();
    return {running:r.isRunning,warning:r.warning?.node.active,frames:r.tentacleFrames.length};
   });
   await game.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   await page.screenshot({path:path.join(__dirname,'../temp/animation-fix/live-boss-ranged-warning.png')});
   const eruption=await game.evaluate(()=>{
    const boss=window.remoteBoss,r=boss.getComponent('BossRangedAttack'),hero=boss.getComponent('BossController').target;
    const health=hero.getComponent('HeroHealth'),before=health.currentHealth;r.advance(.5,health);
    const damage=before-health.currentHealth;r.advance(.2,health);
    return {damage,frame:r.tentacleSprite.spriteFrame.name,textureWidth:r.tentacleSprite.spriteFrame.texture.width,active:r.clip.activeInHierarchy};
   });
   await game.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   await page.screenshot({path:path.join(__dirname,'../temp/animation-fix/live-boss-ranged-strike.png')});
   if(!warning.running||!warning.warning||!eruption.active||eruption.damage!==5||eruption.textureWidth!==256||messages.length)throw Error('Ranged preview failed '+JSON.stringify({warning,eruption,messages}));
   console.log(JSON.stringify({warning,eruption,messages}));return;
  }
  if(process.argv.includes('--boss')) {
   const result=await game.evaluate(()=>{
    const world=cc.director.getScene().getChildByName('Canvas').getChildByName('World'),hero=world.getChildByName('Hero');
    const system=world.getComponent('BossBattleSystem');
    const boss=cc.instantiate(system.bossPrefab);boss.active=false;world.addChild(boss);boss.setPosition(hero.position.x-100,hero.position.y);
    const controller=boss.getComponent('BossController');controller.target=hero;boss.active=true;
    controller.cooldown=0;controller.update(0);
    cc.director.pause();
    return {attacking:controller.attacking,effects:!!boss.getComponent('BossAttackEffects'),
      overlays:boss.children.filter(n=>/^Attack(?:Sweep\d*|Hit|Telegraph)$/.test(n.name)).map(n=>n.name)};
   });
   await game.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   await page.screenshot({path:path.join(__dirname,'../temp/animation-fix/live-boss-no-effect.png')});
   if(!result.attacking||result.effects||result.overlays.length)throw Error('Boss effect removal failed');
   console.log(JSON.stringify({boss:result,messages}));return;
  }
  const peaks=[];
  for(let stage=0;stage<4;stage++) {
   const peak=await game.evaluate(stage=>{
    cc.director.pause();
    const world=cc.director.getScene().getChildByName('Canvas').getChildByName('World'),node=world.getChildByName('Hero');
    const hero=node.getComponent('HeroController'),evolution=node.getComponent('HeroEvolution');
    if(stage)evolution.evolve();
    hero.startAttack();hero.update(hero.attackDuration*.5);
    const state=hero.animation.getState(hero.attackClip.name);state.time=hero.attackDuration*.5;state.sample();
    const fx=hero.slashNode;
    return {stage:stage+1,name:fx?.getComponent(cc.Sprite)?.spriteFrame?.name,active:fx?.activeInHierarchy,
     opacity:fx?.getComponent('cc.UIOpacity')?.opacity,size:fx?.getComponent('cc.UITransform')?.contentSize,
     frameTexture:fx?.getComponent(cc.Sprite)?.spriteFrame?.texture?.width};
   },stage);
   await game.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   await page.screenshot({path:path.join(__dirname,'../temp/animation-fix/live-hero-effect-'+(stage+1)+'.png')});
   if(!peak.active||peak.opacity!==255||!peak.name)throw Error('Effect not visible: '+JSON.stringify(peak));
   peaks.push(peak);
  }
  console.log(JSON.stringify({peaks,messages}));
 }catch(e){console.error(JSON.stringify({messages}));throw e;}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
