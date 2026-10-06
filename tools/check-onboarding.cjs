const fs=require('fs'),path=require('path'),http=require('http');
const {chromium}=require('C:/Users/LIN/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const project=path.resolve(__dirname,'..'),out=path.join(project,'temp/animation-fix');
const markup=fs.readFileSync(path.join(__dirname,'loading-screen.html'),'utf8');
// Render the new preview shell against the running Creator resource server.
// Creator caches the selected shell until the editor's preview server restarts.
const server=http.createServer(async(req,res)=>{
 try {
  if(req.url.startsWith('/loading/')) {
   const file=path.join(project,'preview-template',req.url.split('?')[0]);
   res.setHeader('Content-Type',file.endsWith('.css')?'text/css':file.endsWith('.js')?'text/javascript':'image/png');
   fs.createReadStream(file).pipe(res);return;
  }
  const response=await fetch('http://localhost:7456'+req.url);
  res.statusCode=response.status;res.setHeader('Content-Type',response.headers.get('content-type')||'application/octet-stream');
  if(req.url==='/'||req.url.startsWith('/?')) {
   res.setHeader('Content-Type','text/html; charset=utf-8');
   let html=await response.text();
   if(!html.includes('undersea-loading'))html=html.replace(/<div id="splash">\s*<div class="progress-bar stripes"><span><\/span><\/div>\s*<\/div>/,markup)
    .replace('</head>','<link rel="stylesheet" href="./loading/loading.css"></head>')
    .replace('</body>','<script src="./loading/loading.js"></script></body>');
   res.end(html);
  } else res.end(Buffer.from(await response.arrayBuffer()));
 }catch(error){res.statusCode=500;res.end(String(error));}
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true,channel:'chrome'}),messages=[];
 try{
  const page=await browser.newPage({viewport:{width:1280,height:760}});
  page.on('pageerror',error=>messages.push(error.message));
  let release;const gate=new Promise(resolve=>release=resolve);
  await page.route('**/preview-app/index.js',async route=>{await gate;await route.continue();});
  await page.goto('http://127.0.0.1:'+server.address().port,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.UnderseaLoading&&[...document.querySelectorAll('#splash img')].every(img=>img.complete&&img.naturalWidth>0),null,{timeout:30000});
  await page.locator('#splash').waitFor({state:'visible'});
  await page.evaluate(()=>UnderseaLoading.update(42,'正在加载海底世界…'));
  await page.waitForFunction(()=>{
   const track=document.querySelector('.progress-bar'),bar=track.firstElementChild;
   return Math.abs(bar.getBoundingClientRect().width/track.getBoundingClientRect().width-.42)<.01;
  });
  await page.screenshot({path:path.join(out,'loading-desktop.png')});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:path.join(out,'loading-mobile.png')});
  const loading=await page.evaluate(()=>({images:document.querySelectorAll('#splash img').length,progress:document.querySelector('[role="progressbar"]').getAttribute('aria-valuenow'),overflow:document.documentElement.scrollWidth>innerWidth}));
  if(loading.progress!=='42'||loading.images!==6||loading.overflow)throw Error('Loading layout/progress failed: '+JSON.stringify(loading));
  if(process.argv.includes('--loading-only')){release();console.log(JSON.stringify({loading,messages}));return;}
  await page.setViewportSize({width:1280,height:760});release();
  await page.waitForFunction(()=>window.cc?.director?.getScene(),null,{timeout:60000});
  await page.waitForFunction(()=>getComputedStyle(document.getElementById('splash')).display==='none',null,{timeout:5000});
  await page.waitForFunction(()=>{
   const canvas=cc.director.getScene().getChildByName('Canvas'),hint=canvas?.getChildByName('JoystickHint');
   return hint?.activeInHierarchy&&hint.getChildByName('DragHand')?.getComponent('cc.Sprite')?.spriteFrame?.texture?.width===1254;
  },null,{timeout:20000});
  const hint=await page.evaluate(()=>{
   const canvas=cc.director.getScene().getChildByName('Canvas'),hint=canvas.getChildByName('JoystickHint'),ui=canvas.getComponent('cc.UITransform');
   const actual=canvas.getChildByName('Joystick').getChildByName('joystick-base'),base=hint.getChildByName('joystick-base');
   return {active:hint.activeInHierarchy,position:hint.position,canvas:{width:ui.width,height:ui.height},hand:hint.getChildByName('DragHand').getComponent('cc.UITransform').contentSize,
    size:base.getComponent('cc.UITransform').contentSize,actualSize:actual.getComponent('cc.UITransform').contentSize,scale:base.scale,actualScale:actual.scale,caption:!!hint.getChildByName('Caption')};
  });
  if(hint.caption||JSON.stringify(hint.size)!==JSON.stringify(hint.actualSize)||JSON.stringify(hint.scale)!==JSON.stringify(hint.actualScale)
    ||Math.abs(hint.position.x/hint.canvas.width-.22)>.001||Math.abs(hint.position.y/hint.canvas.height+.18)>.001)throw Error('Hint size/position failed: '+JSON.stringify(hint));
  await page.screenshot({path:path.join(out,'joystick-hint.png')});
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await page.screenshot({path:path.join(out,'joystick-hint-mobile.png')});
  await page.setViewportSize({width:1280,height:760});
  await page.mouse.move(400,450);await page.mouse.down();await page.mouse.move(440,410);
  const used=await page.evaluate(()=>{
   const canvas=cc.director.getScene().getChildByName('Canvas');return {hint:canvas.getChildByName('JoystickHint').active,joystick:canvas.getChildByName('Joystick').getComponent('cc.UIOpacity').opacity};
  });
  await page.mouse.up();
  const released=await page.evaluate(()=>cc.director.getScene().getChildByName('Canvas').getChildByName('JoystickHint').active);
  if(used.hint||used.joystick!==255||released)throw Error('First drag did not dismiss hint: '+JSON.stringify({used,released}));
  const boss=await page.evaluate(()=>{
   const canvas=cc.director.getScene().getChildByName('Canvas'),world=canvas.getChildByName('World'),system=world.getComponent('BossBattleSystem');
   const node=cc.instantiate(system.bossPrefab);world.addChild(node);const hero=world.getChildByName('Hero');node.setPosition(hero.position.x-100,hero.position.y);
   const controller=node.getComponent('BossController');controller.target=hero;controller.cooldown=0;controller.update(0);
   return {attacking:controller.attacking,effects:!!node.getComponent('BossAttackEffects'),overlays:node.children.filter(n=>/^Attack(?:Sweep\d*|Hit|Telegraph)$/.test(n.name)).map(n=>n.name)};
  });
  if(!boss.attacking||boss.effects||boss.overlays.length)throw Error('Boss attack removal failed: '+JSON.stringify(boss));
  if(messages.length)throw Error('Runtime errors: '+JSON.stringify(messages));
  console.log(JSON.stringify({loading,hint,used,released,boss,messages}));
 }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
