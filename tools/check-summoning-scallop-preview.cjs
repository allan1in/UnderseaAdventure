const path=require('path'),assert=require('assert/strict');
const {chromium}=require('C:/Users/LIN/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1500,height:850}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  await page.goto('http://127.0.0.1:8941/'+encodeURIComponent('主题素材')+'/'+encodeURIComponent('海底冒险')+'/previews/summoning-scallop-skeleton.html');
  await page.evaluate(()=>window.ready);
  const report=await page.evaluate(()=>{
   const rig=rigData,animations=Object.values(rig.animations);
   return {
    bones:rig.bones.length,parts:rig.slots.length,actions:Object.keys(rig.animations),
    fixedBase:animations.every(a=>!a.bones.pedestal&&!a.bones['lower-shell']),
    recovery:animations.every(a=>Math.abs(a.bones.pearl.translate.at(-1).y)<1e-6&&Math.abs(a.bones.pearl.scale.at(-1).x-1)<1e-6&&Math.abs(a.bones['upper-shell'].scale.at(-1).y-1)<1e-6)
   };
  });
  assert.equal(report.bones,5);assert.equal(report.parts,4);assert(report.fixedBase&&report.recovery);assert.deepEqual(errors,[]);
  await page.screenshot({path:path.resolve(__dirname,'../temp/summoning-scallop-preview.png')});
  console.log(JSON.stringify({...report,errors}));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
