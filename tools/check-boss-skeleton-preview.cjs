const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require('C:/Users/LIN/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'..'),theme=path.resolve(root,'../主题素材/海底冒险'),dir=path.join(theme,'textures/characters/boss/animations/skeleton-rig'),out=path.join(root,'temp/verification/boss-skeleton-preview');fs.mkdirSync(out,{recursive:true});
const payload={json:JSON.parse(fs.readFileSync(path.join(dir,'boss-octopus.json'),'utf8')),atlas:fs.readFileSync(path.join(dir,'boss-octopus.atlas'),'utf8'),png:'data:image/png;base64,'+fs.readFileSync(path.join(dir,'boss-octopus.png')).toString('base64')};
const meshes=Object.values(payload.json.skins[0].attachments).flatMap(Object.values).filter(a=>a.type==='mesh');assert.equal(meshes.length,8);
const headOrder=payload.json.slots.findIndex(s=>s.name==='head');
assert(payload.json.slots.every((s,i)=>!s.name.includes('left')&&!s.name.includes('right')||i<headOrder),'Tentacles must draw behind the head');
for(const mesh of meshes){let i=0,count=0;while(i<mesh.vertices.length){const n=mesh.vertices[i++];let total=0;for(let j=0;j<n;j++){assert(mesh.vertices[i]>=0&&mesh.vertices[i]<payload.json.bones.length);total+=mesh.vertices[i+3];i+=4}assert(Math.abs(total-1)<1e-5);count++}assert.equal(count,mesh.uvs.length/2);assert(mesh.triangles.every(i=>i<count));}
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true}),errors=[];try{
 const p=await browser.newPage({viewport:{width:1600,height:850}});p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:8941/'+encodeURIComponent('主题素材')+'/'+encodeURIComponent('海底冒险')+'/previews/boss-skeleton.html');await p.evaluate(()=>window.ready);await p.waitForTimeout(500);await p.screenshot({path:path.join(out,'dynamic.png')});
 const report=await p.evaluate(()=>({bones:rigData.bones.length,slots:rigData.slots.length,actions:Object.keys(rigData.animations)}));assert.equal(report.bones,37);assert.equal(report.slots,10);assert.equal(report.actions.length,5);assert.deepEqual(errors,[]);
 await p.goto('http://127.0.0.1:8799');await p.waitForFunction(()=>getComputedStyle(document.getElementById('splash')).display==='none',null,{timeout:120000});const frame=await(await p.locator('#game').elementHandle()).contentFrame();
 report.native=await frame.evaluate(async data=>{
  const cc=await System.import('cc'),world=cc.director.getScene().getChildByName('Canvas').getChildByName('World'),hero=world.getChildByName('Hero');cc.director.pause();const im=new Image();im.src=data.png;await im.decode();const tex=new cc.Texture2D();tex.image=new cc.ImageAsset(im);const rig=new cc.sp.SkeletonData();rig.skeletonJson=data.json;rig.atlasText=data.atlas;rig.textures=[tex];rig.textureNames=['boss-octopus.png'];
  const n=new cc.Node('BossRigPreview');n.layer=hero.layer;n.setPosition(hero.position.x+220,hero.position.y+20,0);n.setScale(1.2,1.2,1);n.addComponent(cc.UITransform);world.addChild(n);const s=n.addComponent(cc.sp.Skeleton);s.premultipliedAlpha=false;s.skeletonData=rig;
  const samples=[];for(const name of ['Idle','Move','Attack','Cast','Death']){s.setAnimation(0,name,name==='Idle'||name==='Move');s.updateAnimation(name==='Attack'?.3:name==='Death'?.8:.4);s.updateRenderData();samples.push({name,duration:s.findAnimation(name).duration,head:s.findSlot('head').getAttachment().name,limb:s.findSlot('front-right').getAttachment().name,rotation:s.findBone('front-right-0').rotation})}
  s.setAnimation(0,'Attack',false);s.updateAnimation(.3);s.updateRenderData();return samples;
 },payload);
 assert.equal(report.native[4].head,'dead-head');assert(report.native.every(p=>p.limb==='front-right'&&Number.isFinite(p.rotation)));await p.screenshot({path:path.join(out,'native-attack.png')});assert.deepEqual(errors,[]);report.weightedMeshes=meshes.length;report.errors=errors;report.previewOnly=true;fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
