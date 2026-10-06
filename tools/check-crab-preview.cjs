const path=require('path');
const {pathToFileURL}=require('url');
const {chromium}=require('C:/Users/LIN/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'}),page=await browser.newPage({viewport:{width:1000,height:980}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto('http://127.0.0.1:8789/previews/enemy-crab-coherent.html');
  try{await page.waitForFunction(()=>window.animationReady)}catch(e){console.error(await page.locator('#status').textContent(),errors);throw e;}
  for(const action of ['move','attack','idle'])await page.waitForFunction(a=>window.previewState.action===a,action);
  for(const action of ['idle','move','attack']){
   await page.locator('[data-action='+action+']').click();
   for(const key of [0,11,16,23]){
    await page.locator('#scrub').evaluate((slider,key)=>{slider.value=key;slider.dispatchEvent(new Event('input'));},key);
    await page.waitForFunction(({a,f})=>window.previewState.action===a&&window.previewState.frame===f,{a:action,f:key+1});
   }
  }
  await page.locator('#scrub').evaluate(slider=>{slider.value=16;slider.dispatchEvent(new Event('input'));});
  await page.waitForFunction(()=>window.previewState.frame===17);
  await page.screenshot({path:path.join(__dirname,'../temp/animation-fix/crab-coherent-preview.png')});
  const contact=await page.evaluate(()=>{
   const c=document.createElement('canvas');c.width=1200;c.height=690;const g=c.getContext('2d');g.fillStyle='#153b4c';g.fillRect(0,0,1200,690);
   ['idle','move','attack'].forEach((a,row)=>[0,6,11,16,23].forEach((key,col)=>{
    sprite(g,pose(a,key/data.actions[a].fps),col*240+120,row*230+150,1.1);
    g.font='14px sans-serif';g.fillStyle='white';g.textAlign='center';g.fillText(names[a]+' '+(key+1),col*240+120,row*230+215);
   }));return c.toDataURL('image/png');
  });
  require('fs').writeFileSync(path.join(__dirname,'../temp/animation-fix/crab-coherent-contact.png'),Buffer.from(contact.split(',')[1],'base64'));
  if(errors.length)throw Error(errors.join('\n'));
  console.log(JSON.stringify({loadedFrames:72,autoTransitions:true,manualStates:3,errors}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
