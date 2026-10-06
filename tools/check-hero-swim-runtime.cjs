const fs = require('fs');
const path = require('path');
const http = require('http');
const ts = require('D:/Cocos/editors/Creator/3.8.8/resources/app.asar.unpacked/node_modules/typescript');
const { chromium } = require('C:/Users/LIN/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const project = path.resolve(__dirname, '..');
const engine = path.resolve('D:/Cocos/editors/Creator/3.8.8/resources/resources/3d/engine/bin/.cache/dev/preview');
const native = path.resolve('D:/Cocos/editors/Creator/3.8.8/resources/resources/3d/engine/native/external');
const out = path.join(project, 'temp/animation-fix');
const assets = {};
const assetIndex = {}, scriptIds = {};
function compressed(uuid) {
    const h = uuid.replaceAll('-', '');
    return h.slice(0, 5) + Buffer.from(h.slice(5) + '0', 'hex').toString('base64').slice(0, 18);
}
function visit(dir) {
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
        const file = path.join(dir, item.name);
        if (item.isDirectory()) visit(file);
        else if (file.endsWith('.meta')) {
            const meta = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
            assetIndex[meta.uuid] = '/' + path.relative(project, file.slice(0, -5)).replaceAll('\\', '/');
            if (file.endsWith('.ts.meta')) scriptIds[path.basename(file, '.ts.meta')] = compressed(meta.uuid);
            const frame = meta.subMetas?.f9941?.userData;
            if (frame) assets[meta.uuid + '@f9941'] = { path: '/' + path.relative(project, file.slice(0, -5)).replaceAll('\\', '/'), width: frame.rawWidth, height: frame.rawHeight };
        }
    }
}
visit(path.join(project, 'assets'));
const map = JSON.parse(fs.readFileSync(path.join(engine, 'import-map.json'), 'utf8'));
for (const [k, v] of Object.entries(map.imports)) if (v.startsWith('./')) map.imports[k] = '/engine/' + v.slice(2);
map.imports.cc = '/cc';
const html = `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;background:#142f3b;color:white"><div id="GameDiv"><div id="Cocos3dGameContainer"><canvas id="GameCanvas" width="16" height="16" style="display:none"></canvas></div></div><canvas id="preview" width="1280" height="760"></canvas><script type="systemjs-importmap">${JSON.stringify(map)}</script><script src="/system.js"></script><script src="/engine/bundled/index.js"></script><script>window.ready=(async()=>{const parts=[];for(const x of ['base','animation','2d','ui','graphics','mask','audio','spine'])parts.push(await System.import('q-bundled:///fs/exports/'+x+'.js'));const cc=Object.assign({},...parts);System.set(new URL('/cc',location.href).href,cc);window.cc=cc;return Object.keys(cc);})();</script></body></html>`;
const server = http.createServer((req, res) => {
    try {
        const url = decodeURIComponent(req.url.split('?')[0]);
        if (url === '/') { res.setHeader('Content-Type', 'text/html'); res.end(html); return; }
        if (url === '/favicon.ico') { res.statusCode = 204; res.end(); return; }
        if (url === '/manifest.json') { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(assets)); return; }
        if (url === '/asset-index.json') { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ assetIndex, scriptIds })); return; }
        let file;
        if (url === '/engine_external/') {
            const id = new URL(req.url, 'http://localhost').searchParams.get('url');
            file = path.join(native, id.replace(/^external:/, ''));
        } else if (url === '/system.js') file = path.join(project, 'temp/programming/preview/systemjs/system.js');
        else if (url.startsWith('/engine/')) file = path.join(engine, url.slice(8));
        else if (url.startsWith('/scripts/')) {
            const name = path.basename(url).replace(/\.js$/, '').replace(/\.ts$/, '');
            file = path.join(project, 'assets/scripts', name + '.ts');
            const result = ts.transpileModule(fs.readFileSync(file, 'utf8'), { fileName: file,
                compilerOptions: { module: ts.ModuleKind.System, target: ts.ScriptTarget.ES2017,
                    experimentalDecorators: true, useDefineForClassFields: false } });
            res.setHeader('Content-Type', 'application/javascript'); res.end(result.outputText); return;
        } else file = path.join(project, url.slice(1));
        if (!file.startsWith(project) && !file.startsWith(engine) && !file.startsWith(native)) throw Error('Path outside fixture');
        res.setHeader('Content-Type', file.endsWith('.js') ? 'application/javascript' : file.endsWith('.wasm') ? 'application/wasm' : file.endsWith('.png') ? 'image/png' : file.endsWith('.mp3') ? 'audio/mpeg' : 'application/json');
        fs.createReadStream(file).on('error', () => { res.statusCode = 404; res.end(); }).pipe(res);
    } catch (e) { res.statusCode = 500; res.end(String(e)); }
});
(async () => {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const browser = await chromium.launch({ headless: true, channel: 'chrome' });
    const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
    const messages = [];
    page.on('pageerror', e => messages.push(e.stack));
    page.on('console', m => { if (m.type() === 'error') messages.push(m.text()); });
    page.on('response', r => { if (r.status() >= 400) messages.push('HTTP ' + r.status() + ' ' + r.url()); });
    try {
        await page.goto('http://127.0.0.1:' + server.address().port);
        const exports = await page.evaluate(async () => { await window.ready; return ['Node','Sprite','Animation','AnimationState','deserialize','Scene','director','sp','_decorator'].map(k => [k,!!cc[k]]); });
        console.log(JSON.stringify({ exports, messages }));
        const init = await page.evaluate(async () => {
            await System.import('q-bundled:///fs/exports/gfx-empty.js');
            await System.import('q-bundled:///fs/exports/legacy-pipeline.js');
            System.set('cce:/internal/x/prerequisite-imports', {});
            await cc.game.init({ renderMode: 3, debugMode: 1,
                overrideSettings: { assets: { builtinAssets: [], preloadAssets: [] }, scripting: { scriptPackages: [] } } });
            // Headless checks use native states and transforms; canvas below draws the original PNGs.
            const effect = cc.deserialize(await (await fetch('/library/60/60f7195c-ec2a-45eb-ba94-8955f60e81d0.json')).json());
            effect.onLoaded();
            const material = new cc.Material(); material.initialize({ effectAsset: effect, defines: { USE_TEXTURE: false } });
            cc.builtinResMgr.addAsset('ui-sprite-material', material);
            cc.builtinResMgr.addAsset('ui-graphics-material', material);
            cc.builtinResMgr.addAsset('ui-base-material', material);
            return { initialized: !!cc.director.root };
        });
        console.log(JSON.stringify({ init, messages }));

        const result=await page.evaluate(async()=>{
          const manifest=await(await fetch('/manifest.json')).json();
          const module=await System.import('/scripts/HeroController.js');
          const healthModule={HeroHealth:cc.js.getClassByName('HeroHealth')};
          const scene=new cc.Scene('SwimCheck');cc.director.runSceneImmediate(scene);cc.director.pause();
          const n=new cc.Node('Hero');n.active=false;scene.addChild(n);n.addComponent(cc.UITransform);
          const visual=new cc.Node('Visual');n.addChild(visual);const picture=new cc.Node('Sprite');visual.addChild(picture);picture.addComponent(cc.UITransform);picture.addComponent(cc.Sprite);
          const a=picture.addComponent(cc.Animation);const health=n.addComponent(healthModule.HeroHealth);health.showHealthBar=false;
          const h=n.addComponent(module.HeroController);h.swimActions=true;n.active=true;
          const frames=new Map();
          async function clip(url){const details=new cc.deserialize.Details(),c=cc.deserialize(await(await fetch(url)).json(),details);details.uuidList.forEach((uuid,i)=>{let f=frames.get(uuid);if(!f){const m=manifest[uuid];f=new cc.SpriteFrame();f.reset({rect:new cc.Rect(0,0,m.width,m.height),originalSize:new cc.Size(m.width,m.height)});f.name=uuid;frames.set(uuid,f)}details.uuidObjList[i][details.uuidPropList[i]]=f});return c}
          const verify=(ok,msg)=>{if(!ok)throw Error(msg)},results=[];
          for(let i=1;i<=4;i++){
           const id=String(i).padStart(2,'0'),base=i===1?'/assets/animations/Hero':'/assets/resources/gameplay/hero/theme-animations/HeroStage'+id;
           const swim=await clip(base+'Idle.anim'),attack=await clip(base+'Attack.anim');
           verify(swim.sample===24&&attack.sample===24&&Math.abs(attack.duration-.48)<.000001,'timing');
           a.stop();a.clips=[swim,attack];a.defaultClip=swim;h.walkClip=swim;h.attackClip=attack;h.attacking=false;h.currentClip=null;h.playMovementAnimation(false);
           const state=a.getState(swim.name);state.time=.5;state.sample();h.startAttack();verify(h.attacking,'immediate attack from mid-swim');h.finishAttack();h.playMovementAnimation(false);
           state.time=23/24+.001;state.sample();h.startAttack();verify(h.attacking&&a.getState(attack.name).isPlaying,'attack starts');
           a.getState(attack.name).time=.205;a.getState(attack.name).sample();verify(picture.getComponent(cc.Sprite).spriteFrame,'frame sampled');
           h.finishAttack();verify(!h.attacking&&state.isPlaying&&state.time===0,'return to first frame');
           state.time=.4;state.sample();h.playMovementAnimation(true);verify(state.time===.4,'move shares uninterrupted swim');
           h.getAttackTargets=()=>[{takeDamage:()=>{}}];h.findAutoTarget=()=>null;health.currentHealth=100;h.attackCooldown=0;h.update(1/60);verify(h.attacking,'nearby enemy starts attack on first update');verify(Math.abs(h.attackCooldown-.48)<.000001,'no extra half-second cooldown');h.update(.24);h.update(.24);verify(!h.attacking,'attack finished');h.update(1/60);verify(h.attacking,'next attack immediately after recovery');h.finishAttack();results.push({automaticAttack:true,noExtraCooldown:true,stage:i,frames:24,attackDuration:attack.duration,entry:true,return:true,sharedLoop:true});
          }
          return results;
        });
        console.log(JSON.stringify({result,messages}));
    }finally{await browser.close();server.close()}
})().catch(e=>{console.error(e);server.close();process.exitCode=1});

