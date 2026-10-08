const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const { chromium } = require('C:/Users/LIN/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const url = process.argv[2] || 'http://127.0.0.1:8793';
const maxLoadMilliseconds = Number(process.argv[3]) || Infinity;
const out = path.resolve(__dirname, '../build/verification');
(async () => {
    const browser = await chromium.launch({ channel:'chrome', headless:true });
    const context = await browser.newContext({ viewport:{width:844,height:390}, isMobile:true, hasTouch:true, deviceScaleFactor:2 });
    const page = await context.newPage(), errors = [], requests = [];
    page.on('pageerror',e=>errors.push(e.stack));
    page.on('console',m=>{if(m.type()==='error')errors.push(m.text());if(m.text().startsWith('Undersea late'))console.log(m.text());});
    page.on('requestfailed',r=>errors.push(r.url()+': '+r.failure()?.errorText));
    page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+': '+r.url());});
    page.on('request',r=>requests.push(r.url()));
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:70,downloadThroughput:1500000,uploadThroughput:750000});
    await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
    if(process.argv[4]==='profile'){await cdp.send('Profiler.enable');await cdp.send('Profiler.start');}
    let release;
    const gate = new Promise(resolve=>{release=resolve;});
    await page.route('**/cocos-js/**',async route=>{await gate;await route.continue();});
    try {
        const started=Date.now();
        const response = await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
        await page.waitForTimeout(300);
        const first = await page.evaluate(()=>({
            visible:getComputedStyle(document.getElementById('splash')).display!=='none',
            pictures:[...document.querySelectorAll('#splash img')].every(x=>x.complete&&x.naturalWidth>0),
            progress:document.getElementById('loading-percent').textContent,
            paints:performance.getEntriesByType('paint').map(x=>({name:x.name,time:x.startTime})),
            frameHidden:getComputedStyle(document.getElementById('game')).visibility==='hidden'
        }));
        assert(first.visible&&first.pictures&&first.frameHidden);
        const entryBytes=(await response.body()).length;
        assert(entryBytes<200000);
        await page.screenshot({path:path.join(out,'mobile-loading.png')});
        release();
        await page.waitForFunction(()=>getComputedStyle(document.getElementById('splash')).display==='none',null,{timeout:180000});
        const readyMilliseconds=Date.now()-started;
        if(process.argv[4]==='profile'){
            const profile=(await cdp.send('Profiler.stop')).profile;
            fs.writeFileSync(path.join(out,'mobile-cpu-profile.json'),JSON.stringify(profile));
            const nodes=new Map(profile.nodes.map(n=>[n.id,n])), counts=new Map();
            for(const id of profile.samples||[])counts.set(id,(counts.get(id)||0)+1);
            console.log([...counts].sort((a,b)=>b[1]-a[1]).slice(0,20).map(([id,count])=>({count,frame:nodes.get(id).callFrame})));
        }
        const frame=await(await page.locator('#game').elementHandle()).contentFrame();
        await frame.evaluate(async()=>{window.cc=await System.import('cc');});
        const before=await frame.evaluate(()=>{
            const world=cc.director.getScene().getChildByName('Canvas').getChildByName('World');
            window.mobileGame={world,hero:world.getChildByName('Hero'),battle:world.getComponent('BossBattleSystem')};
            return {x:mobileGame.hero.position.x,y:mobileGame.hero.position.y,time:mobileGame.battle.runningTime};
        });
        assert.equal(before.time,0);
        await page.screenshot({path:path.join(out,'mobile-ready.png')});
        await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:400,y:250}]});
        await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:500,y:240}]});
        await page.waitForTimeout(900);
        await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
        const after=await frame.evaluate(()=>({x:mobileGame.hero.position.x,y:mobileGame.hero.position.y,time:mobileGame.battle.runningTime}));
        assert(after.time>0&&Math.hypot(after.x-before.x,after.y-before.y)>10);
        assert.deepEqual(errors,[]);
        const timings=await page.evaluate(()=>window.underseaTimings);
        const boot=await frame.evaluate(()=>window.underseaBoot);
        const report={url,entryBytes,readyMilliseconds,timings,boot,first,before,after,requestCount:requests.length,requests,errors};
        fs.writeFileSync(path.join(out,'mobile-deployment-report.json'),JSON.stringify(report,null,2));
        console.log(JSON.stringify(report,null,2));
        assert(readyMilliseconds <= maxLoadMilliseconds, `Ready in ${readyMilliseconds} ms, target ${maxLoadMilliseconds} ms`);
    } finally {release?.();await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
