// Test fresh station atlas and current payment logic in Cocos without building.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const ts=require('D:/Cocos/editors/Creator/3.8.8/resources/app.asar.unpacked/node_modules/typescript');
const {chromium}=require('C:/Users/LIN/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'assets/resources/gameplay/summoning-scallop-rig'),out=path.join(root,'temp/verification/summoning-scallop-rig');fs.mkdirSync(out,{recursive:true});
const scene=JSON.parse(fs.readFileSync(path.join(root,'assets/scenes/Main.scene'),'utf8')),settings=scene.find(o=>'lampData' in o);
const payload={source:ts.transpileModule(fs.readFileSync(path.join(root,'assets/scripts/MagicLampSystem.ts'),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,experimentalDecorators:true}}).outputText,json:JSON.parse(fs.readFileSync(path.join(dir,'summoning-scallop.json'),'utf8')),atlas:fs.readFileSync(path.join(dir,'summoning-scallop.atlas'),'utf8'),png:'data:image/png;base64,'+fs.readFileSync(path.join(dir,'summoning-scallop.png')).toString('base64'),settings};
(async()=>{const browser=await chromium.launch({headless:true,channel:'chrome'}),errors=[];try{
 const page=await browser.newPage({viewport:{width:1280,height:720}});page.on('pageerror',e=>errors.push(e.message));await page.goto(process.argv[2]||'http://127.0.0.1:8799');await page.waitForFunction(()=>getComputedStyle(document.getElementById('splash')).display==='none',null,{timeout:120000});const frame=await(await page.locator('#game').elementHandle()).contentFrame();
 const report=await frame.evaluate(async p=>{
  const cc=await System.import('cc'),scene=cc.director.getScene(),world=scene.getChildByName('Canvas').getChildByName('World'),l=world.getComponent('MagicLampSystem');
  function walk(n){return [n,...n.children.flatMap(walk)]}const nodes=walk(scene);const find=name=>nodes.map(n=>n.getComponent(name)).find(Boolean)?.constructor;
  const exports={},module={exports},decorators={ccclass:()=>c=>c,property:()=>()=>{}};
  const require=name=>name==='cc'?{...cc,_decorator:decorators}:name==='./SoundEffects'?{SoundEffects:{play(){}}}:{[name.slice(2)]:find(name.slice(2))};new Function('require','exports','module',p.source)(require,exports,module);
  for(const name of Object.getOwnPropertyNames(exports.MagicLampSystem.prototype)){const d=Object.getOwnPropertyDescriptor(exports.MagicLampSystem.prototype,name);if(name!=='constructor'&&(typeof d.value==='function'||d.get||d.set))Object.defineProperty(l,name,d);}
  for(const [key,value]of Object.entries(p.settings))if(typeof value==='number')l[key]=value;
  const im=new Image();im.src=p.png;await im.decode();const tex=new cc.Texture2D();tex.image=new cc.ImageAsset(im);const data=new cc.sp.SkeletonData();data.skeletonJson=p.json;data.atlasText=p.atlas;data.textures=[tex];data.textureNames=['summoning-scallop.png'];data.name='summoning-scallop';
  const lamp=l.lampView||l.lamp;let node=lamp.getChildByName('Spine');if(!node){node=new cc.Node('Spine');node.layer=lamp.layer;node.addComponent(cc.UITransform).setContentSize(300,294);lamp.addChild(node)}node.active=true;node.setPosition(0,0,0);node.setScale(.73,.73,1);
  const s=node.getComponent(cc.sp.Skeleton)||node.addComponent(cc.sp.Skeleton);s.enabled=true;s.premultipliedAlpha=false;s.skeletonData=data;l.lampData=data;l.lampView=lamp;l.summonElapsed=null;l.summonFinished=false;const sprite=lamp.getChildByName('Sprite');if(sprite)sprite.active=false;l.bindLamp();
  const initial={animation:s.getCurrent(0).animation.name,slots:p.json.slots.length,scale:node.scale.x,paymentTargetY:l.paymentTargetY,baseRadii:[lamp.getComponent('CircleBody2D').radius,lamp.getComponent('CircleBody2D').verticalRadius],durations:['idle','idle2','summon'].map(a=>s.findAnimation(a).duration)};
  const coins=world.getComponent('CoinSystem');coins.available=999;const rounds=[];
  for(let stage=0;stage<3;stage++){
   l.hero.setPosition(lamp.position.x+120,lamp.position.y+55,0);const cost=l.costs[l.stage],balance=coins.balance,initialPaid=l.paid;
   l.update(.1);const feedback=s.getCurrent(0).animation.name;
   for(let i=0;i<200&&l.paid<cost;i++){s.updateAnimation(.1);l.update(.1)}
   const full={paid:l.paid,open:l.isSelectionOpen,animation:s.getCurrent(0).animation.name,spent:balance-coins.balance};l.onPetsReady();const noEarlySelection=!l.isSelectionOpen;
   for(let i=0;i<11;i++){s.updateAnimation(.1);l.update(.1)}const beforeComplete=l.isSelectionOpen;
   s.updateAnimation(.11);l.update(.11);const selection=l.overlay?.getComponent('PetSelection');
   const result={stage,cost,initialPaid,feedback,full,noEarlySelection,beforeComplete,open:l.isSelectionOpen,cards:selection?.candidates.length,paused:cc.director.isPaused()};rounds.push(result);if(!l.isSelectionOpen)break;selection.chooseRight();result.afterChoose={stage:l.stage,paused:cc.director.isPaused(),animation:s.getCurrent(0).animation.name};
  }
  const recruited=world.getComponent('PetSystem').recruitedCount,finalHidden=!lamp.active;
  l.showStage(0);lamp.setPosition(140,-50,0);l.hero.setPosition(-70,0,0);l.hero.getComponent('HeroController').lateUpdate();const pearlRest=s.findBone('pearl').worldY;s.setAnimation(0,'summon',false);s.updateAnimation(.65);s.updateRenderData();const pose={pearlRise:s.findBone('pearl').worldY-pearlRest,pedestalY:s.findBone('pedestal').worldY,lowerShellY:s.findBone('lower-shell').worldY};cc.director.pause();window.scallopCheck={l,s,lamp};return {initial,rounds,recruited,finalHidden,pose};
 },payload);
 assert.equal(report.initial.animation,'idle');assert.equal(report.initial.slots,4);assert.equal(report.initial.scale,.73);assert.equal(report.initial.paymentTargetY,115.34);assert.deepEqual(report.initial.baseRadii,[85,35]);assert.equal(report.recruited,3);assert(report.finalHidden&&report.pose.pearlRise>15);assert.deepEqual(report.rounds.map(r=>r.cost),[10,50,100]);
 for(const r of report.rounds){assert.equal(r.feedback,'idle2');assert.equal(r.full.animation,'summon');assert(!r.full.open&&r.noEarlySelection&&!r.beforeComplete);assert.equal(r.full.spent,r.cost-r.initialPaid);assert(r.open&&r.cards===2&&r.paused&&!r.afterChoose.paused);assert.equal(r.afterChoose.stage,r.stage+1);assert.equal(r.afterChoose.animation,'idle');}
 await page.screenshot({path:path.join(out,'summon.png')});assert.deepEqual(errors,[]);report.errors=errors;report.mode='Current payment source and fresh rig in existing Cocos native runtime; no build';fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});






