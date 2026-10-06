"""Import the existing transparent effect PNGs without changing their pixels."""
import base64
import copy
import json
import shutil
import uuid
from pathlib import Path
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
ASSETS=ROOT/'assets'
SOURCE=ROOT.parent/'主题素材/海底冒险/textures/effects'
def read(path):return json.loads(path.read_text(encoding='utf-8-sig'))
def write(path,data):
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def uid():return str(uuid.uuid4())
def compressed(value):
    h=value.replace('-','');return h[:5]+base64.b64encode(bytes.fromhex(h[5:]+'0')).decode()[:18]
def directory(path):
    if path==ASSETS:return
    directory(path.parent);path.mkdir(exist_ok=True)
    meta=Path(str(path)+'.meta')
    if not meta.exists():write(meta,dict(ver='1.2.0',importer='directory',imported=True,uuid=uid(),files=[],subMetas={},userData={}))
template=read(ASSETS/'textures/characters/sea-hero/animations/stage-01/run/run-01.png.meta')
def frame(source):
    dest=ASSETS/'textures/undersea/effects'/source.relative_to(SOURCE);directory(dest.parent);shutil.copy2(source,dest)
    path=Path(str(dest)+'.meta');id=read(path)['uuid'] if path.exists() else uid()
    meta=copy.deepcopy(template);meta['uuid']=id
    w,h=Image.open(dest).size
    for key in ['6c48a','f9941']:
        sub=meta['subMetas'][key];sub['uuid']=id+'@'+key;sub['displayName']=dest.stem
    meta['subMetas']['6c48a']['userData']['imageUuidOrDatabaseUri']=id
    data=meta['subMetas']['f9941']['userData']
    data.update(width=w,height=h,rawWidth=w,rawHeight=h,trimX=0,trimY=0,offsetX=0,offsetY=0,
        imageUuidOrDatabaseUri=id+'@6c48a',trimType='none')
    data['vertices']=dict(rawPosition=[-w/2,-h/2,0,w/2,-h/2,0,-w/2,h/2,0,w/2,h/2,0],
        indexes=[0,1,2,2,1,3],uv=[0,h,w,h,0,0,w,0],nuv=[0,0,1,0,0,1,1,1],minPos=[-w/2,-h/2,0],maxPos=[w/2,h/2,0])
    meta['userData']['redirect']=id+'@6c48a';write(path,meta)
    return dict(__uuid__=id+'@f9941',__expectedType__='cc.SpriteFrame')
def bounds(source):
    im=Image.open(source).convert('RGBA');b=im.getchannel('A').point(lambda a:255 if a>=128 else 0).getbbox()
    return dict(__type__='cc.Vec4',x=b[0],y=b[1],z=b[2]-b[0],w=b[3]-b[1])

scene_path=ASSETS/'scenes/Main.scene';scene=read(scene_path)
hero=next(v for v in scene if 'attackRange' in v)
evolution=next(v for v in scene if 'themeAttackClips' in v)
sources=[SOURCE/'hero-attack'/f'hero-stage-{stage:02d}-slash.png' for stage in range(1,5)]
refs=[frame(s) for s in sources];rects=[bounds(s) for s in sources]
evolution.update(themeSlashFrames=refs,themeSlashBounds=rects)
hero.update(themeSlashFrame=refs[0],themeSlashBounds=rects[0])
hero.setdefault('themeSlashScale',1.35)
write(scene_path,scene)
path=ASSETS/'resources/gameplay/hero/forms.json';forms=read(path)
for form,ref,rect in zip(forms['forms'],refs,rects):
    form['themeVisual']['attackEffect']=dict(frame=ref['__uuid__'],bounds=[rect[k] for k in ['x','y','z','w']])
write(path,forms)
# Keep the editable standalone effect prefab aligned with the first ocean slash.
path=ASSETS/'prefabs/SlashEffect.prefab';data=read(path)
next(v for v in data if v['__type__']=='cc.Sprite')['_spriteFrame']=refs[0]
legacy=next(v for v in data if v['__type__']=='cc.Animation');legacy.update(_clips=[],_defaultClip=None)
write(path,data)

count=4
for pet,prefab in [('seahorse','PetRedDragonHit'),('turtle','PetFoxHit'),('jellyfish','PetWhiteTigerHit'),('shark','PetBlueDragonHit')]:
    files=sorted((SOURCE/'pet-skills'/pet).glob('effect-*.png'));assert len(files)==24,(pet,len(files))
    refs=[frame(f) for f in files];count+=len(refs)
    path=ASSETS/'prefabs'/f'{prefab}.prefab';data=read(path)
    playback=next(v for v in data if 'frameInterval' in v)
    playback.update(themeFrames=refs,displayWidth=200,frameInterval=1/24,texture=None,frameData=None)
    picture=data[playback['picture']['__id__']];picture.update(_spriteFrame=refs[0],_sizeMode=0,_isTrimmedMode=False)
    node_id=picture['node']['__id__'];data[node_id]['_lpos'].update(x=0,y=0,z=0)
    ui=next(data[r['__id__']] for r in data[node_id]['_components'] if data[r['__id__']]['__type__']=='cc.UITransform')
    ui['_anchorPoint'].update(x=.5,y=.5);ui['_contentSize'].update(width=200,height=200)
    write(path,data)

# Boss no longer uses attack overlay effects. Remove the component and remap
# serialized references so subsequent imports cannot restore it accidentally.
kind=compressed(read(ASSETS/'scripts/BossAttackEffects.ts.meta')['uuid'])
path=ASSETS/'prefabs/Boss.prefab';data=read(path)
removed={i for i,v in enumerate(data) if v.get('__type__')==kind}
removed.update(data[i]['__prefab']['__id__'] for i in list(removed) if data[i].get('__prefab'))
for v in data:
    if '_components' in v: v['_components']=[r for r in v['_components'] if r['__id__'] not in removed]
mapping={old:new for new,old in enumerate(i for i in range(len(data)) if i not in removed)}
def remap(v):
    if isinstance(v,list):return [remap(x) for x in v]
    if isinstance(v,dict):return {k:mapping[x] if k=='__id__' else remap(x) for k,x in v.items()}
    return v
write(path,remap([v for i,v in enumerate(data) if i not in removed]))
print('Imported',count,'active effect PNGs: four hero slashes and 96 companion frames. Boss attack effects removed.')
