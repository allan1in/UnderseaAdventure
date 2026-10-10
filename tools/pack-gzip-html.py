"""Embed the complete compressed game in a standalone loading-page HTML."""
from pathlib import Path
import base64, gzip, json, re, shutil

ROOT = Path(__file__).resolve().parents[1]
source = ROOT / 'build/undersea-adventure-compact.html'
destination = ROOT / 'build/undersea-adventure-single.html'
shell = (ROOT / 'build/vercel-mobile/index.html').read_text(encoding='utf-8')
game = source.read_text(encoding='utf-8').replace('<head>', '<head><base href="__GAME_BASE__">', 1)
# Local file/blob documents have an opaque origin; "null" is not a valid targetOrigin.
game = game.replace('parent.postMessage({type,value},location.origin)',
                    "parent.postMessage({type,value},location.origin==='null'?'*':location.origin)")
compressed = gzip.compress(game.encode('utf-8'), compresslevel=9, mtime=0)
payload = base64.b64encode(compressed).decode('ascii')
# Inline inflater provides an offline fallback where native gzip is unavailable.
pako_root = Path('C:/Users/LIN/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/pako')
vendor = ROOT / 'tools/vendor'
vendor.mkdir(exist_ok=True)
inflater = vendor / 'pako_inflate.min.js'
if not inflater.exists():
    shutil.copy2(pako_root / 'dist/pako_inflate.min.js', inflater)
    shutil.copy2(pako_root / 'LICENSE', vendor / 'pako-LICENSE')
start = shell.index("   if(!('DecompressionStream' in window))")
end = shell.index('   if(gameURL)', start)
decode = '''   const encoded=document.getElementById('packed-game').textContent.trim();
   const bytes=new Uint8Array(encoded.length/4*3);let offset=0;
   for(let i=0;i<encoded.length;i+=262144){
    const raw=atob(encoded.slice(i,i+262144));
    for(let j=0;j<raw.length;j++)bytes[offset++]=raw.charCodeAt(j);
    const value=Math.round(Math.min(1,(i+262144)/encoded.length)*75);
    percent.textContent=value+'%';bar.style.width=value+'%';
    await new Promise(resolve=>requestAnimationFrame(resolve));
   }
   const input=bytes.subarray(0,offset);window.underseaTimings.download=performance.now();
   let text;
   if(typeof DecompressionStream==='function'){
    text=await new Response(new Blob([input]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
   }else{text=new TextDecoder().decode(pako.ungzip(input));}
   window.underseaTimings.decoded=performance.now();
   const base=new URL('.',location.href).href;
'''
shell = shell[:start] + decode + shell[end:]
load_start = shell.index('   if(gameURL)')
load_end = shell.index('\n  }catch', load_start)
# Start in the original file document: Cocos bootstrap relies on its file origin.
# The decompressed game has the same loading UI and hides it only after preload.
shell = shell[:load_start] + "   document.open();document.write(text.replace('__GAME_BASE__',base));document.close();" + shell[load_end:]
shell = re.sub(r'<iframe id="game"[^>]*></iframe>', '', shell)
shell = shell.replace("frame.style.visibility='hidden';", '')
handler_start = shell.index(" addEventListener('message',event=>{")
handler_end = shell.index(' requestAnimationFrame(', handler_start)
shell = shell[:handler_start] + shell[handler_end:]
shell = shell.replace("const frame=document.getElementById('game'),splash=", "const splash=")
# Payload follows the boot script, allowing the small splash to render first.
shell = shell.replace('<script>\n(() => {', '<script>' + inflater.read_text(encoding='utf-8') + '</script>\n<script>\n(() => {', 1)
shell = shell.replace('</body></html>', '<script id="packed-game" type="application/octet-stream">' + payload + '</script></body></html>')
assert not re.search(r'(?:src|href)=["\']\./game-', shell)
destination.write_text(shell, encoding='utf-8')
report = {'inputBytes': source.stat().st_size, 'gzipBytes': len(compressed),
          'htmlBytes': destination.stat().st_size,
          'savedPercent': round((1-destination.stat().st_size/source.stat().st_size)*100, 2),
          'offlineFallback': 'bundled pako inflater', 'allResourcesEmbedded': True}
(ROOT / 'build/gzip-html-report.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
print(json.dumps(report))
