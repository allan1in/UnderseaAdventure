"""Preserve original visible pixels through shared-atlas mesh regions.

Preview-only rest pose. Hidden limb surfaces are intentionally not invented:
large independent bends require additional hidden-surface artwork later.
"""
from pathlib import Path
from PIL import Image
import json, shutil

ROOT=Path(__file__).resolve().parents[1]
THEME=ROOT.parent/'主题素材/海底冒险'
OUT=THEME/'textures/characters/boss/animations/skeleton-original-idle'
OUT.mkdir(parents=True,exist_ok=True)
source=THEME/'textures/characters/boss/animations/idle/idle-01.png'
im=Image.open(source).convert('RGBA'); w,h=im.size
shutil.copyfile(source,OUT/'boss-original.png')
names=['rear-left','rear-right','side-left','side-right','head','front-center','front-lower']
origins=[(129,157),(236,177),(112,205),(237,212),(182,163),(177,218),(194,244)]
bones=[dict(name='root'),dict(name='body',parent='root')]
for name,(x,y) in zip(names,origins):
    bones.append(dict(name=name,parent='body',x=x-w/2,y=h/2-y))
def owner(x,y):
    # Only visible surfaces are partitioned. Every cell belongs to one region,
    # so their rest-pose union preserves the original silhouette and occlusion.
    if x<132 and y<161:return 'rear-left'
    if x>239 and y<202:return 'rear-right'
    if x<117 and y>=161:return 'side-left'
    if x>238 and y>=202:return 'side-right'
    if y>233 and x>178:return 'front-lower'
    if y>196 and (x<189 or y>220):return 'front-center'
    return 'head'
regions={n:dict(type='mesh',path='boss-original',uvs=[],triangles=[],vertices=[],width=w,height=h,rigidSource=True) for n in names}
xs=[0,117,132,178,189,238,239,w];ys=[0,161,196,202,220,233,h]
for y,y2 in zip(ys,ys[1:]):
    for x,x2 in zip(xs,xs[1:]):
        name=owner((x+x2)/2,(y+y2)/2); a=regions[name];first=len(a['uvs'])//2
        ox,oy=origins[names.index(name)];bone=2+names.index(name)
        for px,py in [(x,y),(x2,y),(x2,y2),(x,y2)]:
            a['uvs'] += [px/w,py/h]
            a['vertices'] += [1,bone,px-ox,oy-py,1]
        a['triangles'] += [first,first+1,first+2,first,first+2,first+3]
slots=[dict(name=n,bone=n,attachment=n) for n in names]
rig=dict(skeleton=dict(spine='3.8.99',images='./'),bones=bones,slots=slots,
    skins=[dict(name='default',attachments={n:{n:regions[n]} for n in names})],
    animations={'Idle':{'bones':{'root':{'translate':[
        dict(time=0,x=0,y=0),dict(time=.75,x=0,y=1),dict(time=1.5,x=0,y=0),
        dict(time=2.25,x=0,y=-1),dict(time=3,x=0,y=0)]}}}})
(OUT/'boss-original-idle.json').write_text(json.dumps(rig,ensure_ascii=False),encoding='utf-8')
(OUT/'boss-original-idle.atlas').write_text(f'boss-original.png\nsize: {w},{h}\nformat: RGBA8888\nfilter: Linear,Linear\nrepeat: none\nboss-original\n  rotate: false\n  xy: 0, 0\n  size: {w}, {h}\n  orig: {w}, {h}\n  offset: 0, 0\n  index: -1\n',encoding='utf-8')
(OUT/'notes.json').write_text(json.dumps(dict(source=str(source),previewOnly=True,
    visiblePixelsPreserved=True,regions=names,hiddenSurfacesDrawn=False,
    limitation='Idle uses assembled original surfaces and whole-body float; independent limb bends and other actions are not yet rebuilt.'),ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(dict(regions=len(names),bones=len(bones),triangles=sum(len(a['triangles'])//3 for a in regions.values()))))
