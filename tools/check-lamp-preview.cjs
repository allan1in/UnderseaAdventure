const assert=require('assert/strict');
const {chromium}=require('C:/Users/LIN/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{const browser=await chromium.launch({headless:true,channel:'chrome'});try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.argv[2]||'http://127.0.0.1:7456',{waitUntil:'domcontentloaded'});
 await page.evaluate(async()=>{window.lampCC=await System.import('cc');});
 await page.waitForFunction(()=>window.lampCC.director.getScene()?.getChildByName('Canvas')?.getChildByName('World')?.getComponent('PetSystem')?.assetsReady,null,{timeout:180000});
 await page.waitForFunction(()=>getComputedStyle(document.getElementById('splash')).display==='none',null,{timeout:180000});
 const result=await page.evaluate(async()=>{
  const cc=await System.import('cc'),world=cc.director.getScene().getChildByName('Canvas').getChildByName('World');
  const lamp=world.getComponent('MagicLampSystem'),pets=world.getComponent('PetSystem'),coins=world.getComponent('CoinSystem');
  const saved=pets.petPrefabs;pets.petPrefabs=[];lamp.setPaidCoins(lamp.costs[lamp.stageIndex]);const balance=coins.balance;
  lamp.update(.1);const before=lamp.isSelectionOpen;
  // Restore readiness without emitting pets-ready: update must recover by itself.
  pets.petPrefabs=saved;lamp.update(.1);const after=lamp.isSelectionOpen;
  const selection=lamp.overlay.getComponent('PetSelection'),cards=selection.candidates.length,paused=cc.director.isPaused();
  selection.chooseRight();
  return {retryCode:lamp.update.toString().includes("this.paid >= cost &&"),paid:lamp.paid,cost:lamp.costs[lamp.stage],lampActive:lamp.lamp?.activeInHierarchy,heroActive:lamp.hero.activeInHierarchy,alive:lamp.hero.getComponent("HeroHealth").isAlive,ready:pets.assetsReady,before,after,cards,paused,uncharged:coins.balance===balance,recruited:pets.recruitedCount,lampStage:lamp.stageIndex,heroStage:lamp.hero.getComponent('HeroEvolution').stageIndex,spine:lamp.hero.getComponent('HeroVisual').usesSpine,closed:!lamp.isSelectionOpen,resumed:!cc.director.isPaused()};
 });
 assert(!result.before&&result.after&&result.cards===2&&result.paused&&result.uncharged);
 assert(result.recruited===1&&result.lampStage===1&&result.heroStage===1&&result.spine&&result.closed&&result.resumed);
 assert.deepEqual(errors,[]);console.log(JSON.stringify({result,errors},null,2));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});


