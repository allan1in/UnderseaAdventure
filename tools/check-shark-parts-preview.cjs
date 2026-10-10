const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require('C:/Users/LIN/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const theme=path.resolve(__dirname,'../../主题素材/海底冒险'),dir=path.join(theme,'textures/characters/partners/animations/shark/parts-rig'),out=path.join(theme,'previews/pet-shark-parts');
const rig=JSON.parse(fs.readFileSync(path.join(dir,'pet-shark.json'),'utf8'));
assert.equal(rig.slots.length,4);assert.equal(rig.bones.length,6);
for(const [name,a]of Object.entries(rig.animations))for(const [bone,track]of Object.entries(a.bones)){
 assert(Math.abs(track.rotate[0].angle-track.rotate.at(-1).angle)<1e-6,'Rest pose recovery '+name+' '+bone);
 if(name!=='Attack')assert(Math.abs((track.rotate[1].angle-track.rotate[0].angle)-(track.rotate.at(-1).angle-track.rotate.at(-2).angle))<.8,'Loop continuity');
}
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true}),errors=[];try{
 const page=await browser.newPage({viewport:{width:1500,height:850}});page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8942/'+encodeURIComponent('主题素材')+'/'+encodeURIComponent('海底冒险')+'/previews/pet-shark-skeleton.html');await page.evaluate(()=>window.ready);await page.evaluate(()=>{drawRig('Idle',0);drawRig('Move',.24);drawRig('Attack',.36)});await page.screenshot({path:path.join(out,'browser.png')});
 await page.goto(require('url').pathToFileURL(path.resolve(__dirname,'../build/undersea-adventure-single.html')).href);await page.waitForFunction(()=>getComputedStyle(document.getElementById('splash')).display==='none',null,{timeout:120000});
 const frame=page;
 const native=await frame.evaluate(async p=>{const cc=await System.import('cc');cc.director.pause();const world=cc.director.getScene().getChildByName('Canvas').getChildByName('World'),hero=world.getChildByName('Hero');const im=new Image();im.src=p.png;await im.decode();const tex=new cc.Texture2D();tex.image=new cc.ImageAsset(im);const data=new cc.sp.SkeletonData();data.skeletonJson=p.json;data.atlasText=p.atlas;data.textures=[tex];data.textureNames=['pet-shark.png'];const n=new cc.Node('SharkRigPreview');n.layer=hero.layer;n.setPosition(hero.position.x+200,hero.position.y,0);n.setScale(1,1,1);n.addComponent(cc.UITransform);world.addChild(n);const s=n.addComponent(cc.sp.Skeleton);s.premultipliedAlpha=false;s.skeletonData=data;const result=[];for(const name of ['Idle','Move','Attack']){s.setAnimation(0,name,name!=='Attack');s.updateAnimation(.36);s.updateRenderData();result.push({name,duration:s.findAnimation(name).duration,head:s.findSlot('body').getAttachment().name,front:s.findBone('tail').rotation})}return result;},{json:rig,atlas:fs.readFileSync(path.join(dir,'pet-shark.atlas'),'utf8'),png:'data:image/png;base64,'+fs.readFileSync(path.join(dir,'pet-shark.png')).toString('base64')});
 assert.equal(native.length,3);assert(native.every(p=>p.head==='body'));assert.deepEqual(errors,[]);await page.screenshot({path:path.join(out,'native.png')});
 const report={parts:rig.slots.length,bones:rig.bones.length,actions:Object.keys(rig.animations),native,errors,separatedParts:true,previewOnly:true};fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify(report,null,2));console.log(report);
 }finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});

