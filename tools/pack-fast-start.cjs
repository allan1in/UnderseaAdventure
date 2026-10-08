// Measure the real launch-scene dependency set, then embed only that set.
const fs = require('fs'), path = require('path'), http = require('http'), zlib = require('zlib');
const {execFileSync} = require('child_process');
const {chromium} = require('C:/Users/LIN/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const directory = path.resolve(process.argv[2]);
const manifest = path.join(directory, 'startup-files.json');
(async () => {
    const server = http.createServer((req,res) => {
        const name = decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\//,'');
        const file = path.resolve(directory,name);
        if (!file.startsWith(directory+path.sep) || !fs.existsSync(file)) {res.writeHead(404).end();return;}
        res.setHeader('Content-Type', ({'.js':'application/javascript','.json':'application/json','.html':'text/html','.css':'text/css','.png':'image/webp'})[path.extname(file)]||'application/octet-stream');
        fs.createReadStream(file).pipe(res);
    });
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const browser=await chromium.launch({channel:'chrome',headless:true});
    try {
        const page=await browser.newPage(),files=new Set(),errors=[];
        let preloaded=false;
        page.on('console',m=>{if(m.text()==='__UNDERSEA_READY__')preloaded=true;});
        page.on('pageerror',e=>errors.push(String(e)));
        page.on('request',r=>{if(!preloaded)files.add(new URL(r.url()).pathname.slice(1));});
        await page.goto(`http://127.0.0.1:${server.address().port}/index.html`,{waitUntil:'domcontentloaded'});
        await page.waitForFunction(()=>window.__underseaReady,null,{timeout:120000});
        if(errors.length)throw Error(errors.join('\n'));
        fs.writeFileSync(manifest,JSON.stringify([...files].sort()));
        execFileSync(process.execPath,[path.join(__dirname,'pack-single-html.cjs'),directory,path.join(directory,'startup.html'),manifest],{stdio:'inherit'});
        const html=fs.readFileSync(path.join(directory,'startup.html'));
        const compressed=zlib.gzipSync(html,{level:9});
        fs.writeFileSync(path.join(directory,'startup.html.gz'),compressed);
        fs.unlinkSync(path.join(directory,'startup.html'));
        console.log(JSON.stringify({startupFiles:files.size,startupCompressedBytes:compressed.length}));
    } finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;});
