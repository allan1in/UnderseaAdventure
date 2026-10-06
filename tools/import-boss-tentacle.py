"""Slice the generated sheet, register a stable base axis, and import into Cocos."""
import base64
import copy
import json
import hashlib
import shutil
import sys
import uuid
from pathlib import Path
import numpy as np
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
ASSETS=ROOT/'assets'
SOURCE=ROOT.parent/'主题素材/海底冒险/textures/effects/boss'
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def write(p,d):
    p.parent.mkdir(parents=True,exist_ok=True)
    p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def uid():return str(uuid.uuid4())
def directory(p):
    if p==ASSETS:return
    directory(p.parent);p.mkdir(exist_ok=True)
    m=Path(str(p)+'.meta')
    if not m.exists():write(m,dict(ver='1.2.0',importer='directory',imported=True,uuid=uid(),files=[],subMetas={},userData={}))
template=read(ASSETS/'resources/gameplay/ad-ui/tutorial-hand.png.meta')
def frame(source,dest):
    directory(dest.parent);shutil.copy2(source,dest)
    p=Path(str(dest)+'.meta');id=read(p)['uuid'] if p.exists() else uid()
    meta=copy.deepcopy(template);meta['uuid']=id;w,h=Image.open(source).size
    for key in ['6c48a','f9941']:
        meta['subMetas'][key]['uuid']=id+'@'+key;meta['subMetas'][key]['displayName']=dest.stem
    meta['subMetas']['6c48a']['userData']['imageUuidOrDatabaseUri']=id
    data=meta['subMetas']['f9941']['userData']
    data.update(width=w,height=h,rawWidth=w,rawHeight=h,trimX=0,trimY=0,offsetX=0,offsetY=0,trimType='none',imageUuidOrDatabaseUri=id+'@6c48a')
    data['vertices']=dict(rawPosition=[-w/2,-h/2,0,w/2,-h/2,0,-w/2,h/2,0,w/2,h/2,0],indexes=[0,1,2,2,1,3],
        uv=[0,h,w,h,0,0,w,0],nuv=[0,0,1,0,0,1,1,1],minPos=[-w/2,-h/2,0],maxPos=[w/2,h/2,0])
    meta['userData']['redirect']=id+'@6c48a';write(p,meta)
    return dict(__uuid__=id+'@f9941',__expectedType__='cc.SpriteFrame')

sheet=Image.open(sys.argv[1]).convert('RGBA');w,h=sheet.size
assert w%4==0 and h%4==0
cw,ch=w//4,h//4
dest=SOURCE/'tentacle-animation';dest.mkdir(exist_ok=True)
shutil.copy2(sys.argv[1],dest/'tentacle-strike-sheet.png')
refs=[];offsets=[];boxes=[]
for i in range(16):
    cell=sheet.crop((i%4*cw,i//4*ch,(i%4+1)*cw,(i//4+1)*ch))
    alpha=np.array(cell.getchannel('A'));opaque=alpha>=128
    ys,xs=np.nonzero(opaque);assert len(xs),i
    box=[int(xs.min()),int(ys.min()),int(xs.max())+1,int(ys.max())+1];boxes.append(box)
    assert not opaque[:,0].any() and not opaque[:,-1].any(),(i+1,'solid sprite clipped at cell boundary',box)
    bottom=box[3]
    base=np.nonzero(opaque[max(0,bottom-25):bottom])[1]
    base_x=(float(base.min())+float(base.max())+1)/2
    offsets.append([round(cw/2-base_x,3),round(bottom-ch*350/384,3)])
    source=dest/f'strike-{i+1:02d}.png';cell.save(source)
    refs.append(frame(source,ASSETS/f'resources/gameplay/boss/tentacle-strike-frames/strike-{i+1:02d}.png'))
write(dest/'animation.json',dict(frames=16,cell=[cw,ch],duration=.55,fps=16/.55,baseline=ch*350/384,offsets=offsets,opaqueBounds=boxes,
    sequence='frames 1-4 emerge, 5-8 strike, 9-12 recoil, 13-16 retract'))
config=ASSETS/'resources/gameplay/boss/tentacle-strike-timing.json';write(config,dict(duration=.55,offsets=offsets))
meta=Path(str(config)+'.meta')
if not meta.exists():
    data=copy.deepcopy(read(ASSETS/'resources/gameplay/hero/forms.json.meta'));data['uuid']=uid();write(meta,data)
static=SOURCE/'tentacle-strike.png';ref=frame(static,ASSETS/'resources/gameplay/boss/tentacle-strike.png')
im=Image.open(static);b=im.getchannel('A').point(lambda a:255 if a>=128 else 0).getbbox()
script=ASSETS/'scripts/BossRangedAttack.ts.meta';hexid=read(script)['uuid'].replace('-','')
kind=hexid[:5]+base64.b64encode(bytes.fromhex(hexid[5:]+'0')).decode()[:18]
path=ASSETS/'prefabs/Boss.prefab';data=read(path)
component=next((v for v in data if v.get('__type__')==kind),None)
if component is None:
    index=len(data)
    component=dict(__type__=kind,_name='',_objFlags=0,__editorExtras__={},node={'__id__':1},_enabled=True,__prefab={'__id__':index+1},_id='')
    data.extend([component,dict(__type__='cc.CompPrefabInfo',fileId=uid())]);data[1]['_components'].append({'__id__':index})
component.update(warningTime=.5,damage=5,radiusX=100,radiusY=60,eruptionDuration=.55,tentacleFrame=ref,tentacleFrames=refs,
    tentacleBounds=dict(__type__='cc.Vec4',x=b[0],y=b[1],z=b[2]-b[0],w=b[3]-b[1]),
    tentacleFrameOffsets=[dict(__type__='cc.Vec2',x=x,y=y) for x,y in offsets])
controller=next(v for v in data if 'attackDamage' in v);controller.update(rangedInterval=3,rangedRange=700)
write(path,data)
index_path=ROOT.parent/'主题素材/海底冒险/素材索引.json'
index=read(index_path)
theme=index_path.parent
new_assets=[static,dest/'tentacle-strike-sheet.png',*[dest/f'strike-{i+1:02d}.png' for i in range(16)]]
for source in new_assets:
    relative=source.relative_to(theme).as_posix()
    entry=next((a for a in index['assets'] if a.get('path')==relative),None)
    if entry is None:entry={};index['assets'].append(entry)
    entry.update(name=source.name,path=relative,category='textures/effects/boss',
        status='Boss 定点远程触手动画：16帧透明PNG，底座偏移已校准，已接入 UnderseaAdventure',
        sha256=hashlib.sha256(source.read_bytes()).hexdigest().upper())
    if source==static:entry['projectPath']='UnderseaAdventure/assets/resources/gameplay/boss/tentacle-strike.png'
    elif source.name.startswith('strike-'):entry['projectPath']='UnderseaAdventure/assets/resources/gameplay/boss/tentacle-strike-frames/'+source.name
write(index_path,index)
print(json.dumps(dict(imported=16,cell=[cw,ch],offsets=offsets,opaqueBounds=boxes),ensure_ascii=False))
