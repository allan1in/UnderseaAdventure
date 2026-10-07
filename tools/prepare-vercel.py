"""Create compressed distributions and an immediately visible loading page.
Only distribution copies change: runtime image dimensions and alpha stay intact.
"""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from PIL import Image
import io
import json
import shutil
import subprocess
import sys
import base64
import hashlib
import re

project = Path(__file__).resolve().parents[1]
source = project / 'build/web-mobile'
optimized = project / 'temp/mobile-web'
destination = project / 'build/vercel-mobile'
shutil.copytree(source, optimized, dirs_exist_ok=True)
destination.mkdir(parents=True, exist_ok=True)

def convert(file):
    original = file.read_bytes()
    with Image.open(io.BytesIO(original)) as image:
        rgba = image.convert('RGBA')
        if file.parent.name == 'loading':
            rgba.thumbnail((360, 360), Image.Resampling.LANCZOS)
        output = io.BytesIO()
        rgba.save(output, format='WEBP', quality=78, exact=True, method=4)
        data = output.getvalue()
        if len(data) >= len(original):
            return 0
        with Image.open(io.BytesIO(data)) as decoded:
            assert decoded.size == rgba.size
            assert decoded.convert('RGBA').getchannel('A').tobytes() == rgba.getchannel('A').tobytes()
        file.write_bytes(data)
        return len(original) - len(data)

files = list(optimized.rglob('*.png'))
saved = 0
with ThreadPoolExecutor(max_workers=4) as pool:
    for i, savings in enumerate(pool.map(convert, files), 1):
        saved += savings
        if i % 100 == 0:
            print(f'Compressed images {i}/{len(files)}; saved {saved/1048576:.1f} MiB', flush=True)
node = sys.argv[1] if len(sys.argv) > 1 else 'node'

# Report real Cocos preload progress to the parent loading page. Install this
# before the game bootstrap, after SystemJS and its import map are available.
html = (optimized/'index.html').read_text(encoding='utf-8')
html = html.replace('<script src="./loading/loading.js"></script>', '')
loader = (optimized/'loading/loading.js').read_text(encoding='utf-8')
loader = loader.replace('const splash =', "function notify(type,value){if(parent!==window)parent.postMessage({type,value},location.origin);}\n  const splash =")
loader = loader.replace('if (text) message.textContent = text;', "if (text) message.textContent = text; notify('undersea-progress',progress);")
loader = loader.replace("update(100, '准备出发！'); completed", "update(100, '准备出发！'); notify('undersea-ready'); completed")
loader = loader.replace("message.textContent = '加载失败，请刷新重试';", "notify('undersea-error'); message.textContent = '加载失败，请刷新重试';")
(optimized/'loading/loading.js').write_text(loader,encoding='utf-8')
html = html.replace("<script>\n    System.import", "<script src='./loading/loading.js'></script>\n<script>\n    System.import")
assert html.index('loading/loading.js') < html.index("System.import('./index.js')")
html = html.replace('<head>', '<head><link rel="icon" href="data:,">')
(optimized/'index.html').write_text(html,encoding='utf-8')
compact = project/'build/undersea-adventure-compact.html'
subprocess.run([node, str(project/'tools/pack-single-html.cjs'), str(optimized), str(compact)],check=True)

digest = hashlib.sha256()
for file in sorted(optimized.rglob('*')):
    if file.is_file():
        digest.update(file.relative_to(optimized).as_posix().encode())
        digest.update(file.read_bytes())
release = 'game-' + digest.hexdigest()[:12]
shutil.copytree(optimized,destination/release,dirs_exist_ok=True)
body = re.search(r'(<div id="splash".*?</div>\s*)\s*(?:<!--|<script)',html,re.S).group(1)
def inline_image(match):
    return re.sub(r'src="([^"]+)"',lambda image: 'src="data:image/webp;base64,' + base64.b64encode((optimized/image.group(1)).read_bytes()).decode() + '"',match.group())
body = re.sub(r'<img\b[^>]*>',inline_image,body)
css = (optimized/'loading/loading.css').read_text(encoding='utf-8')
shell = '''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>海底冒险</title><link rel="icon" href="data:,"><style>
html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#032b45}
iframe{position:fixed;inset:0;width:100%;height:100%;border:0;visibility:hidden}
#retry{display:none;margin:14px auto 0;padding:10px 24px;border:1px solid #a5f7ef;border-radius:22px;background:#087c95;color:white;cursor:pointer}
__CSS__
</style></head><body>__BODY__<button id="retry">重新加载</button>
<iframe id="game" title="海底冒险游戏" allow="autoplay; fullscreen"></iframe>
<script>
(() => {
 const frame=document.getElementById('game'),splash=document.getElementById('splash'),retry=document.getElementById('retry');
 const message=document.getElementById('loading-message'),percent=document.getElementById('loading-percent');
 const bar=splash.querySelector('.progress-bar span'),meter=splash.querySelector('[role="progressbar"]');
 splash.querySelector('main').append(retry);
 let ready=false,timer,lastProgress=0;
 function fail(){if(ready)return;message.textContent='加载较慢，请检查网络或重试';retry.style.display='block';}
 function start(){ready=false;lastProgress=0;splash.style.display='flex';frame.style.visibility='hidden';retry.style.display='none';
  message.textContent='正在加载海底世界…';percent.textContent='0%';bar.style.width='0%';
  clearTimeout(timer);timer=setTimeout(fail,90000);frame.src='./__RELEASE__/index.html';}
 addEventListener('message',event=>{
  if(event.origin!==location.origin||event.source!==frame.contentWindow||!event.data)return;
  if(event.data.type==='undersea-progress'){
   lastProgress=Math.max(lastProgress,Math.min(100,Number(event.data.value)||0));
   percent.textContent=lastProgress+'%';bar.style.width=lastProgress+'%';meter.setAttribute('aria-valuenow',String(lastProgress));
  }else if(event.data.type==='undersea-ready'){
   ready=true;clearTimeout(timer);frame.style.visibility='visible';splash.style.display='none';
  }else if(event.data.type==='undersea-error')fail();
 });
 retry.onclick=()=>{frame.src='about:blank';requestAnimationFrame(start);};
 requestAnimationFrame(()=>requestAnimationFrame(start));
})();
</script></body></html>'''
shell = shell.replace('__CSS__',css).replace('__BODY__',body).replace('__RELEASE__',release)
(destination/'index.html').write_text(shell,encoding='utf-8')
config = json.loads((project/'tools/vercel-static.json').read_text(encoding='utf-8'))
config['headers'].append({'source':'/game-:version/:path*','headers':[{'key':'Cache-Control','value':'public, max-age=31536000, immutable'}]})
(destination/'vercel.json').write_text(json.dumps(config,indent=2),encoding='utf-8')
old_link = project/'build/vercel/.vercel/project.json'
if old_link.exists():
    (destination/'.vercel').mkdir(exist_ok=True)
    shutil.copy2(old_link,destination/'.vercel/project.json')
report = {'compactHtmlBytes':compact.stat().st_size,'entryHtmlBytes':len(shell.encode()),
          'hostedResourceBytes':sum(f.stat().st_size for f in (destination/release).rglob('*') if f.is_file()),
          'imageSavings':saved,'release':release,'sourceArtUnchanged':True}
(project/'build/mobile-compression.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(report),flush=True)
