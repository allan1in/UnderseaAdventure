"""Preview-only sea turtle cutout rig; does not import or change gameplay."""
from pathlib import Path
import json, math, importlib.util, sys
from PIL import Image
sys.dont_write_bytecode=True
ROOT=Path(__file__).resolve().parents[1]
THEME=ROOT.parent/'主题素材/海底冒险'
OUT=THEME/'textures/characters/partners/animations/turtle/skeleton-rig'
OUT.mkdir(parents=True,exist_ok=True)
names=['body','head','near-front','far-front','near-rear','far-rear']
sheet=Image.open(OUT/'source-parts-sheet-v2.png').convert('RGBA')
for i,name in enumerate(names):
    x,y=i%3,i//3
    # Generated silhouettes cross nominal cell margins; cut along empty gutters.
    xs=[0,610/1536,1040/1536,1];ys=[0,550/1024,1]
    part=sheet.crop((int(xs[x]*sheet.width),int(ys[y]*sheet.height),int(xs[x+1]*sheet.width),int(ys[y+1]*sheet.height)))
    alpha=part.getchannel('A');box=alpha.point(lambda v:255 if v>32 else 0).getbbox()
    assert box,name
    part=part.crop(box);part.thumbnail((360,360),Image.Resampling.LANCZOS)
    part.save(OUT/(name+'.png'))
bones=[dict(name='root'),dict(name='body',parent='root')]
slots=[];attachments={}
# Complete limb roots overlap beneath the shell; facing follows the eyes (right).
configs=[('far-rear',-42,4,45,40,(.72,.52)),('far-front',45,-5,44,62,(.30,.15)),
         ('near-rear',-38,-9,63,41,(.82,.28)),('body',-10,13,114,88,(.5,.5)),
         ('near-front',12,2,66,88,(.78,.13)),('head',23,11,86,78,(.28,.76))]
for name,x,y,w,h,pivot in configs:
    if name!='body':bones.append(dict(name=name,parent='body',x=x,y=y,rotation=15 if name=='far-front' else 0))
    slots.append(dict(name=name,bone=name,attachment=name))
    attachments[name]={name:dict(path=name,width=w,height=h,
        x=(x if name=='body' else 0)+w*(.5-pivot[0]),
        y=(y if name=='body' else 0)+h*(pivot[1]-.5))}
poses=[]
for action,times in [('Idle',[0,.6,1.2,1.8,2.4,3]),('Move',[0,.24,.48,.72,.96,1.2]),('Attack',[0,.12,.24,.36,.50,.68])]:
    for i,t in enumerate(times):
        wave=math.sin(t/times[-1]*math.tau);r={}
        p=dict(action=action,time=t,rot=r,rootY=0,title={'Idle':'轻摆鳍脚','Move':'交替游动','Attack':['准备','抬头蓄力','蓄力完成','远程释放','回收','恢复'][i]}[action])
        if action in ('Idle','Move'):
            moving=action=='Move';p['rootY']=wave*(1.7 if moving else .7)
            r['body']=wave*(1.2 if moving else .4);r['head']=wave*(1.6 if moving else .8)
            for n,sign in [('near-front',1),('far-front',-1),('near-rear',-1),('far-rear',1)]:r[n]=sign*wave*(14 if moving else 2.5)
        else:
            r['head']=[0,5,9,-5,-2,0][i];r['body']=[0,1,2,-2,-1,0][i]
            p['rootY']=[0,1,2,-1,0,0][i]
            for n,sign in [('near-front',1),('far-front',-1),('near-rear',-1),('far-rear',1)]:r[n]=sign*[0,3,6,-5,-2,0][i]
        poses.append(p)
code=(ROOT/'tools/build-hero-stage04-preview.py').read_text(encoding='utf-8')
ns={};exec(code[code.index('def sample('):code.index('\nanimations={}')],ns);sample=ns['sample']
animations={}
for action in ['Idle','Move','Attack']:
    frames=[p for p in poses if p['action']==action];times=[p['time'] for p in frames]
    ticks=[i/60 for i in range(math.ceil(times[-1]*60))]+[times[-1]];tracks={}
    for b in bones:
        n=b['name'];tracks[n]={'rotate':[dict(time=t,angle=round(sample(times,[p['rot'].get(n,0) for p in frames],t,action!='Attack'),6)) for t in ticks]}
    tracks['root']['translate']=[dict(time=t,x=0,y=round(sample(times,[p['rootY'] for p in frames],t,action!='Attack'),6)) for t in ticks]
    animations[action]={'bones':tracks}
rig=dict(skeleton=dict(spine='3.8.99',images='./'),bones=bones,slots=slots,skins=[dict(name='default',attachments=attachments)],animations=animations)
# One continuous head/neck/chest surface replaces the two overlapping regions.
torso=Image.open(OUT/'source-continuous-torso.png').convert('RGBA')
torso=torso.crop(torso.getchannel('A').point(lambda v:255 if v>32 else 0).getbbox())
torso.thumbnail((480,480),Image.Resampling.LANCZOS);torso.save(OUT/'torso.png')
uv=[];vertices=[];triangles=[];cols=32;rows=24
head_index=next(i for i,b in enumerate(bones) if b['name']=='head')
for row in range(rows+1):
    for col in range(cols+1):
        u=col/cols;v=row/rows;x=-67+158*u;y=65-99*v
        # Head is almost rigid; the short neck blends smoothly into fixed chest.
        blend=max(0,min(1,(x-8)/37));blend=blend*blend*(3-2*blend)
        upper=max(0,min(1,(y+12)/28));upper=upper*upper*(3-2*upper)
        weight=blend*upper
        uv.extend([u,v]);vertices.append(2)
        vertices.extend([1,x,y,round(1-weight,8),head_index,x-23,y-11,round(weight,8)])
for row in range(rows):
    for col in range(cols):
        a=row*(cols+1)+col;b=a+1;c=a+cols+1;d=c+1;triangles.extend([a,c,b,b,c,d])
rig['slots']=[s for s in slots if s['name'] not in ('head','body')]+[dict(name='torso',bone='body',attachment='torso')]
rig['skins'][0]['attachments']={k:v for k,v in attachments.items() if k not in ('head','body')}
rig['skins'][0]['attachments']['torso']={'torso':dict(type='mesh',path='torso',width=158,height=99,uvs=uv,vertices=vertices,triangles=triangles)}
spec=importlib.util.spec_from_file_location('pack',ROOT/'tools/build-hero-stage01-rig.py');pack=importlib.util.module_from_spec(spec);spec.loader.exec_module(pack);pack.OUT=OUT
pack.pack_atlas({s['name']:Image.open(OUT/(s['name']+'.png')).convert('RGBA') for s in rig['slots']},'pet-turtle')
(OUT/'pet-turtle.json').write_text(json.dumps(rig,ensure_ascii=False,indent=2),encoding='utf-8')
preview=THEME/'previews/pet-turtle-skeleton-v1';preview.mkdir(parents=True,exist_ok=True)
(preview/'poses.json').write_text(json.dumps(dict(previewOnly=True,rig=rig,poses=poses),ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(dict(parts=len(slots),bones=len(bones),keyframes=len(poses),output=str(OUT)),ensure_ascii=False))
