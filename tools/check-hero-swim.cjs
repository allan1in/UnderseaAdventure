const fs=require('fs'),path=require('path'),crypto=require('crypto');
const {chromium}=require('C:/Users/LIN/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'..'),theme=path.resolve(root,'../主题素材/海底冒险');
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
function assert(ok,message){if(!ok)throw Error(message)}
(async()=>{
 let checked=0,cached=0;
 for(let s=1;s<=4;s++){
  const id=String(s).padStart(2,'0'),source=path.join(theme,'textures/characters/hero/animations/stage-'+id),dest=path.join(root,'assets/textures/characters/sea-hero/animations/stage-'+id);
  for(const action of ['swim','attack','idle','run'])for(let f=1;f<=24;f++){
   const name=action+'-'+String(f).padStart(2,'0')+'.png',file=path.join(dest,action,name),png=fs.readFileSync(file),meta=JSON.parse(fs.readFileSync(file+'.meta','utf8'));
   assert(png.readUInt32BE(16)===384&&png.readUInt32BE(20)===384,'PNG dimensions '+file);
   const m=meta.subMetas.f9941.userData;
   assert(m.width===384&&m.height===384&&m.rawWidth===384&&m.rawHeight===384,'meta '+file);
   assert(hash(file)===hash(path.join(source,action,name)),'copy '+file);checked++;
   const lib=path.join(root,'library',meta.uuid.slice(0,2),meta.uuid+'@f9941.json');
   if(fs.existsSync(lib)){const r=JSON.parse(fs.readFileSync(lib,'utf8')).content.rect;assert(r.width===384&&r.height===384,'cached frame '+file);cached++}
  }
  assert(hash(path.join(dest,'attack/attack-01.png'))===hash(path.join(dest,'swim/swim-24.png')),'attack entry '+id);
  assert(hash(path.join(dest,'attack/attack-24.png'))===hash(path.join(dest,'swim/swim-01.png')),'attack return '+id);
 }
 const scene=JSON.parse(fs.readFileSync(path.join(root,'assets/scenes/Main.scene'),'utf8')),e=scene.find(o=>o.themeIdleClips),h=scene.find(o=>o.swimActions);
 assert(h?.swimActions&&e.themeIdleClips.length===4&&JSON.stringify(e.themeIdleClips)===JSON.stringify(e.themeRunClips),'shared scene clips');
 const browser=await chromium.launch({headless:true,channel:'chrome'}),errors=[];
 try{
  const page=await browser.newPage();page.on('pageerror',x=>errors.push(x.message));
  await page.goto('file:///'+path.join(theme,'previews/hero-swim-four-stages.html').replaceAll('\\','/'));
  await page.waitForFunction(()=>window.heroSwimPreview);
  await page.click('#attack');await page.waitForFunction(()=>heroSwimPreview.action==='attack');await page.waitForFunction(()=>heroSwimPreview.action==='swim'&&!heroSwimPreview.pending);
  assert(errors.length===0,'preview '+errors.join(','));
  console.log(JSON.stringify({files:checked,cached,sourceActions:192,previewCycle:'passed'}));
  try{
   await page.goto('http://localhost:7456',{timeout:30000});await page.waitForFunction(()=>window.cc?.director?.getScene(),null,{timeout:30000});
   console.log(JSON.stringify({live:await page.evaluate(()=>{const n=cc.director.getScene().getChildByName('Canvas')?.getChildByName('World')?.getChildByName('Hero'),e=n?.getComponent('HeroEvolution'),h=n?.getComponent('HeroController');return {swimActions:h?.swimActions,loading:e?.loadingThemeClips,idle:e?.themeIdleClips?.map(c=>c?.name),run:e?.themeRunClips?.map(c=>c?.name),errors:[]}}),errors}));
   const playback=await page.evaluate(()=>{
    const n=cc.director.getScene().getChildByName('Canvas').getChildByName('World').getChildByName('Hero'),h=n.getComponent('HeroController'),e=n.getComponent('HeroEvolution'),a=h.animation;
    cc.director.pause();
    const results=[];const verify=(ok,msg)=>{if(!ok)throw Error(msg)};
    h.finishAttack();
    for(let i=0;i<4;i++){
     const swim=e.themeIdleClips[i],attack=e.themeAttackClips[i];
     verify(swim.sample===24&&attack.sample===24&&swim.duration===1&&Math.abs(attack.duration-.48)<.00001,'24 fps duration');
     a.stop();a.defaultClip=swim;h.walkClip=swim;h.attackClip=attack;h.currentClip=null;h.playMovementAnimation(false);
     const state=a.getState(swim.name);state.time=.5;state.sample();h.startAttack();verify(h.attacking,'immediate attack from mid-swim');h.finishAttack();h.playMovementAnimation(false);
     state.time=23/24+.001;state.sample();h.startAttack();
     verify(h.attacking&&a.getState(attack.name).isPlaying,'start attack');
     a.getState(attack.name).time=0;a.getState(attack.name).sample();
     
     h.finishAttack();const reset=a.getState(swim.name);verify(!h.attacking&&reset.isPlaying&&reset.time===0,'return to swim first');
     reset.time=.4;reset.sample();h.playMovementAnimation(true);verify(reset.time===.4,'same moving loop');
     results.push({stage:i+1,sample:24,immediate:true,attack:true,return:true,sharedLoop:true});
    }
    return results;
   });console.log(JSON.stringify({playback}));
  }catch(e){console.log(JSON.stringify({liveUnavailable:e.message}));process.exitCode=1;}
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});


