"""Create compressed distributions and an immediately visible loading page.
Only distribution copies change; reduced static textures have matching frame metadata.
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
import gzip
import math
from spine_keyframe_reduction import reduce_skeletons
from spine_atlas_packing import repack_atlas

project = Path(__file__).resolve().parents[1]
source = project / 'build/web-mobile'
optimized = project / 'temp/mobile-web'
destination = project / 'build/vercel-mobile'
if optimized.exists():
    assert optimized.resolve().parent == (project/'temp').resolve()
    shutil.rmtree(optimized)
shutil.copytree(source, optimized, dirs_exist_ok=True)
destination.mkdir(parents=True, exist_ok=True)
resize_names={}
resize_paths = (
    '/textures/undersea/ui/', '/textures/undersea/props/', '/textures/ground/',
    '/gameplay/ad-ui/', '/textures/undersea/effects/hero-attack/',
    '/textures/undersea/characters/partners/',
)
for meta in (project/'assets').rglob('*.png.meta'):
    path=meta.as_posix()
    # Standalone SpriteFrames and Spine atlas pages use separate resize paths.
    if any(prefix in path for prefix in resize_paths):
        data=json.loads(meta.read_text(encoding='utf-8-sig'))
        frame=data.get('subMetas',{}).get('f9941',{})
        if frame and frame.get('userData',{}).get('packable') is False:
            resize_names[data['uuid']]=(frame['displayName'],1536 if '/textures/ground/' in path else 512)
frame_scales={}
atlas_images={}
atlas_frame_names={}
atlas_replacements={}
atlas_jobs=[]
atlas_pages={}
atlas_pixels={}
atlas_source_sizes={}
for atlas in (project/'assets/resources/gameplay').rglob('*.atlas'):
    original_atlas=atlas.read_text(encoding='utf-8')
    lines=original_atlas.splitlines()
    factor=1
    changed=False
    page_files={}
    meshes=set()
    for skeleton_file in atlas.parent.glob('*.json'):
        skeleton=json.loads(skeleton_file.read_text(encoding='utf-8'))
        for skin in skeleton.get('skins',[]):
            for attachments in skin.get('attachments',{}).values():
                for name,attachment in attachments.items():
                    if attachment.get('type') in ('mesh','linkedmesh'):
                        meshes.add(attachment.get('path',name))
    for index,line in enumerate(lines):
        if line and not line.startswith(' ') and line.endswith('.png'):
            page=atlas.parent/line
            with Image.open(page) as image:
                width,height=image.size
            meta=json.loads(page.with_suffix('.png.meta').read_text(encoding='utf-8-sig'))
            uuid=meta['uuid']
            native_page=list((optimized/'assets').rglob(uuid+'.png'))
            assert len(native_page)==1
            page_files[line]=native_page[0]
            atlas_pages[uuid]=meta
            atlas_source_sizes[uuid]=(width,height)
            # All current large rig pages are square power-of-two atlases.
            # Keep smaller pages (Boss, jellyfish, seahorse) at native resolution.
            if max(width,height)>512:
                assert width==height and width%512==0, f'Unsupported atlas size: {page}'
                factor=512/width
                meta=json.loads(page.with_suffix('.png.meta').read_text(encoding='utf-8-sig'))
                atlas_images[meta['uuid']]=(512,512)
                frame=meta.get('subMetas',{}).get('f9941',{})
                if frame:
                    atlas_frame_names[meta['uuid']]=frame['displayName']
                changed=True
            else:
                factor=1
            continue
        if factor==1:
            continue
        entry=re.match(r'^(\s*)(size|xy|orig|offset):\s*(-?\d+)\s*,\s*(-?\d+)\s*$',line)
        if entry:
            indent,key,x,y=entry.groups()
            rounding=math.floor if key=='xy' else math.ceil
            # Round sizes and orig together. Current untrimmed rig regions have
            # zero offsets, preserving attachment dimensions even for odd sizes.
            if key=='offset':
                assert int(x)==0 and int(y)==0, f'Trimmed atlas needs explicit handling: {atlas}'
            a,b=rounding(int(x)*factor),rounding(int(y)*factor)
            lines[index]=f'{indent}{key}: {a},{b}'
    if changed:
        replacement='\n'.join(lines)+'\n'
        atlas_replacements[original_atlas.strip()]=replacement
        atlas_uuid=json.loads(atlas.with_suffix('.atlas.meta').read_text(encoding='utf-8-sig'))['uuid']
        native_atlases=list((optimized/'assets').rglob(atlas_uuid+'.atlas'))
        assert len(native_atlases)==1, f'Atlas missing from build: {atlas}'
        native_atlases[0].write_text(replacement,encoding='utf-8')
    atlas_uuid=json.loads(atlas.with_suffix('.atlas.meta').read_text(encoding='utf-8-sig'))['uuid']
    native_atlas=list((optimized/'assets').rglob(atlas_uuid+'.atlas'))[0]
    atlas_jobs.append((original_atlas,native_atlas,page_files,meshes))

def convert(file):
    original = file.read_bytes()
    with Image.open(io.BytesIO(original)) as image:
        rgba = image.convert('RGBA')
        if file.parent.name == 'loading':
            rgba.thumbnail((360, 360), Image.Resampling.LANCZOS)
        elif file.stem in atlas_images:
            original_size=rgba.size
            rgba=rgba.resize(atlas_images[file.stem],Image.Resampling.LANCZOS)
            if file.stem in atlas_frame_names:
                name=atlas_frame_names[file.stem]
                frame_scales[(name,*original_size)]=(rgba.width/original_size[0],rgba.height/original_size[1])
        elif file.stem in resize_names and max(rgba.size)>resize_names[file.stem][1]:
            name,limit=resize_names[file.stem]
            original_size=rgba.size
            rgba.thumbnail((limit,limit),Image.Resampling.LANCZOS)
            frame_scales[(name,original_size[0],original_size[1])]=(rgba.width/original_size[0],rgba.height/original_size[1])
        elif max(rgba.size) > 512:
            # Reduce color detail above the displayed mobile size, keeping exact
            # geometry and alpha so Cocos SpriteFrame rectangles remain valid.
            color=rgba.convert('RGB')
            limit=2048 if min(rgba.size)>2500 else 512
            color.thumbnail((limit,limit),Image.Resampling.LANCZOS)
            color=color.resize(rgba.size,Image.Resampling.LANCZOS).convert('RGBA')
            color.putalpha(rgba.getchannel('A'))
            rgba=color
        output = io.BytesIO()
        if file.stem in atlas_pages:
            atlas_pixels[file.stem]=rgba.copy()
        rgba.save(output, format='WEBP', quality=55, exact=True, method=4)
        data = output.getvalue()
        if len(data) >= len(original) and rgba.size == image.size:
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

packing_stats=[]
for original,native,page_files,meshes in atlas_jobs:
    pixels={name:atlas_pixels[file.stem] for name,file in page_files.items()}
    text,stats=repack_atlas(native.read_text(encoding='utf-8'),page_files,pixels,meshes)
    if not stats:continue
    native.write_text(text,encoding='utf-8')
    atlas_replacements[original.strip()]=text
    for item in stats:
        file=page_files[item['page']];meta=atlas_pages[file.stem]
        frame=meta.get('subMetas',{}).get('f9941',{})
        if frame:
            width,height=atlas_source_sizes[file.stem]
            frame_scales[(frame['displayName'],width,height)]=(item['size'][0]/width,item['size'][1]/height)
        item['uuid']=file.stem
    packing_stats.extend(stats)
print('Atlas repacking: '+json.dumps(packing_stats),flush=True)
(project/'build/verification/atlas-packing-report.json').write_text(json.dumps(packing_stats,indent=2),encoding='utf-8')

def scale_frames(value):
    changed=False
    if isinstance(value,dict):
        size=value.get('originalSize')
        if size and 'rect' in value:
            factor=frame_scales.get((value.get('name'),size['width'],size['height']))
            if factor:
                sx,sy=factor
                for key in ['rect','offset','originalSize']:
                    for axis in value.get(key,{}):value[key][axis]*=sx if axis in ('x','width') else sy
                value['capInsets']=[v*(sx if i in (0,2) else sy) for i,v in enumerate(value.get('capInsets',[]))]
                vertices=value.get('vertices',{})
                for key,stride in [('rawPosition',3),('uv',2)]:
                    vertices[key]=[v*(sx if i%stride==0 else sy if i%stride==1 else 1) for i,v in enumerate(vertices.get(key,[]))]
                for key in ['minPos','maxPos']:
                    for axis in ('x','y'):
                        if axis in vertices.get(key,{}):vertices[key][axis]*=sx if axis=='x' else sy
                changed=True
        for child in value.values():changed=scale_frames(child) or changed
    elif isinstance(value,list):
        for child in value:changed=scale_frames(child) or changed
    return changed
def scale_atlas_strings(value):
    changed=False
    if isinstance(value,(dict,list)):
        entries=list(value.items()) if isinstance(value,dict) else enumerate(value)
        for key,child in entries:
            if isinstance(child,str):
                replacement=atlas_replacements.get(child.replace('\r\n','\n').strip())
                if replacement is not None:
                    value[key]=replacement
                    changed=True
            else:
                changed=scale_atlas_strings(child) or changed
    return changed
keyframe_totals={'skeletons':0,'before':0,'after':0}
for data_file in (optimized/'assets').rglob('*.json'):
    data=json.loads(data_file.read_text(encoding='utf-8'))
    before_reduction=keyframe_totals['before']-keyframe_totals['after']
    reduce_skeletons(data,keyframe_totals)
    keyframes_changed=before_reduction!=keyframe_totals['before']-keyframe_totals['after']
    frames_changed=scale_frames(data)
    atlas_changed=scale_atlas_strings(data)
    if frames_changed or atlas_changed or keyframes_changed:data_file.write_text(json.dumps(data,separators=(',',':'),ensure_ascii=False),encoding='utf-8')
print(f'Resized {len(atlas_images)} skeleton atlas pages to 512px',flush=True)
print('Skeleton keyframes: '+json.dumps(keyframe_totals),flush=True)
node = sys.argv[1] if len(sys.argv) > 1 else 'node'
ffmpeg_files=list((project/'temp/media-python/imageio_ffmpeg/binaries').glob('ffmpeg*.exe'))
audio_saved=0
if ffmpeg_files:
    for audio in optimized.rglob('*.mp3'):
        result=audio.with_suffix('.compressed.mp3')
        subprocess.run([str(ffmpeg_files[0]),'-v','error','-y','-i',str(audio),'-map_metadata','-1',
                        '-ar','22050','-ac','2','-b:a','48k',str(result)],check=True)
        if result.stat().st_size<audio.stat().st_size:
            audio_saved+=audio.stat().st_size-result.stat().st_size
            result.replace(audio)
        else: result.unlink()

# Report real Cocos preload progress to the parent loading page. Install this
# before the game bootstrap, after SystemJS and its import map are available.
html = (optimized/'index.html').read_text(encoding='utf-8')
html = html.replace('<script src="./loading/loading.js"></script>', '')
loader = (project/'build-templates/web-mobile/loading/loading.js').read_text(encoding='utf-8')
loader = loader.replace('const splash =', "function notify(type,value){if(parent!==window)parent.postMessage({type,value},location.origin);}\n  const splash =")
loader = loader.replace('if (text) message.textContent = text;', "if (text) message.textContent = text; notify('undersea-progress',progress);")
loader = loader.replace("update(100, '准备出发！'); completed", "update(100, '准备出发！'); window.__underseaReady=true;console.debug('__UNDERSEA_READY__');notify('undersea-ready'); completed")
loader = loader.replace("message.textContent = '资源加载失败';", "notify('undersea-error'); message.textContent = '资源加载失败';")
loader = loader.replace('error => error ? reject(error) : resolve()', "error => { if(error) reject(error); else {window.__underseaPreloaded=true;console.debug('__UNDERSEA_PRELOADED__');resolve();} }")
loader = loader.replace('let completed =', 'window.underseaBoot={start:performance.now()};let completed =')
loader = loader.replace("then(cc => {", "then(cc => {window.underseaBoot.ccImported=performance.now();")
loader = loader.replace("const scene = cc.settings", "window.underseaBoot.initialized=performance.now();const scene = cc.settings")
loader = loader.replace("window.__underseaPreloaded=true;", "window.underseaBoot.preloaded=performance.now();window.__underseaPreloaded=true;")
loader = loader.replace("window.__underseaReady=true;", "window.underseaBoot.ready=performance.now();window.__underseaReady=true;")
(optimized/'loading/loading.js').write_text(loader,encoding='utf-8')
html = html.replace("<script>\n    System.import", "<script src='./loading/loading.js'></script>\n<script>\n    System.import")
assert html.index('loading/loading.js') < html.index("System.import('./index.js')")
html = html.replace('<head>', '<head><link rel="icon" href="data:,">')
(optimized/'index.html').write_text(html,encoding='utf-8')
compact = project/'build/undersea-adventure-compact.html'
subprocess.run([node, str(project/'tools/pack-single-html.cjs'), str(optimized), str(compact)],check=True)
# Download every packed resource before creating the game iframe. The engine
# preload delegate also resolves all pet, Boss and hero animation dependencies.
complete_html = compact.read_text(encoding='utf-8').replace('<head>', '<head><base href="__GAME_BASE__">', 1)
(optimized/'startup.html.gz').write_bytes(gzip.compress(complete_html.encode(),compresslevel=9,mtime=0))
(optimized/'complete.html').write_text(complete_html.replace('__GAME_BASE__','./'),encoding='utf-8')

digest = hashlib.sha256()
for file in sorted(optimized.rglob('*')):
    if file.is_file():
        digest.update(file.relative_to(optimized).as_posix().encode())
        digest.update(file.read_bytes())
release = 'game-' + digest.hexdigest()[:12]
shutil.copytree(optimized,destination/release,dirs_exist_ok=True)
for old_release in destination.glob('game-*'):
    if old_release.is_dir() and old_release.name != release:
        assert old_release.resolve().parent == destination.resolve()
        shutil.rmtree(old_release)
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
__CSS__
</style></head><body>__BODY__
<iframe id="game" title="海底冒险游戏" allow="autoplay; fullscreen"></iframe>
<script>
(() => {
 const frame=document.getElementById('game'),splash=document.getElementById('splash');
 const message=document.getElementById('loading-message'),percent=document.getElementById('loading-percent');
 const bar=splash.querySelector('.progress-bar span'),meter=splash.querySelector('[role="progressbar"]');
 let ready=false,lastProgress=0,gameURL;
 function fail(){if(ready)return;message.textContent='资源加载失败';}
 async function start(){window.underseaTimings={start:performance.now()};ready=false;lastProgress=0;splash.style.display='flex';frame.style.visibility='hidden';
  message.textContent='正在加载海底世界…';percent.textContent='0%';bar.style.width='0%';
  try {
   if(!('DecompressionStream' in window)){frame.src='./__RELEASE__/complete.html';return;}
   const response=await fetch('./__RELEASE__/startup.html.gz');window.underseaTimings.headers=performance.now();if(!response.ok)throw Error('startup download');
   const total=Number(response.headers.get('Content-Length')),reader=response.body.getReader();let loaded=0;
   const stream=new ReadableStream({async pull(controller){const item=await reader.read();if(item.done){window.underseaTimings.download=performance.now();controller.close();return;}
    loaded+=item.value.byteLength;if(total){const value=Math.min(85,Math.round(loaded/total*85));percent.textContent=value+'%';bar.style.width=value+'%';}
    controller.enqueue(item.value);}});
   const text=await new Response(stream.pipeThrough(new DecompressionStream('gzip'))).text();window.underseaTimings.decoded=performance.now();
   const base=new URL('./__RELEASE__/',location.href).href;
   if(gameURL)URL.revokeObjectURL(gameURL);gameURL=URL.createObjectURL(new Blob([text.replace('__GAME_BASE__',base)],{type:'text/html'}));frame.src=gameURL;
  }catch(error){console.error(error);fail();}
 }
 addEventListener('message',event=>{
  if(event.origin!==location.origin||event.source!==frame.contentWindow||!event.data)return;
  if(event.data.type==='undersea-progress'){
   lastProgress=Math.max(lastProgress,Math.min(100,85+(Number(event.data.value)||0)*.15));
   lastProgress=Math.round(lastProgress);
   percent.textContent=lastProgress+'%';bar.style.width=lastProgress+'%';meter.setAttribute('aria-valuenow',String(lastProgress));
  }else if(event.data.type==='undersea-ready'){
   ready=true;window.underseaTimings.ready=performance.now();frame.style.visibility='visible';splash.style.display='none';
  }else if(event.data.type==='undersea-error')fail();
 });
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
          'startupCompressedBytes':(optimized/'startup.html.gz').stat().st_size,
          'audioSavings':audio_saved,
          'resizedStaticFrames':len(frame_scales),
          'imageSavings':saved,'release':release,'sourceArtUnchanged':True}
(project/'build/mobile-compression.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(report),flush=True)
