"""Preview-only jellyfish rig with continuous tentacle meshes and hidden roots."""
from pathlib import Path
from PIL import Image
import json,math,importlib.util,sys
sys.dont_write_bytecode=True
ROOT=Path(__file__).resolve().parents[1];THEME=ROOT.parent/'主题素材/海底冒险'
OUT=THEME/'textures/characters/partners/animations/jellyfish/skeleton-rig';OUT.mkdir(parents=True,exist_ok=True)
names=['bell','left-outer','left-inner','center','right-inner','right-outer']
sheet=Image.open(OUT/'source-parts-sheet.png').convert('RGBA')
for i,n in enumerate(names):
 x,y=i%3,i//3;xs=[0,680/1536,1050/1536,1];ys=[0,520/1024,1]
 im=sheet.crop((int(xs[x]*sheet.width),int(ys[y]*sheet.height),int(xs[x+1]*sheet.width),int(ys[y+1]*sheet.height)))
 box=im.getchannel('A').point(lambda v:255 if v>32 else 0).getbbox();assert box,n
 im=im.crop(box);im.thumbnail((300,300),Image.Resampling.LANCZOS);im.save(OUT/(n+'.png'))
bones=[dict(name='root'),dict(name='body',parent='root')];slots=[];attachments={}
configs=[('left-outer',-40,4,40,56),('right-outer',40,4,40,56),('left-inner',-22,0,44,96),('right-inner',22,0,44,98),('center',0,0,35,81)]
for n,x,y,w,h in configs:
 base=len(bones);bones.append(dict(name=n,parent='body',x=x,y=y));tip=len(bones);bones.append(dict(name=n+'-tip',parent=n,y=-h*.48))
 uv=[];v=[];tri=[];cols=6;rows=18
 for r in range(rows+1):
  for c in range(cols+1):
   u=c/cols;t=r/rows;px=(u-.5)*w;py=8-t*h;blend=max(0,min(1,(t-.30)/.55));blend=blend*blend*(3-2*blend)
   uv.extend([u,t]);v.extend([2,base,px,py,round(1-blend,8),tip,px,py+h*.48,round(blend,8)])
 for r in range(rows):
  for c in range(cols):
   a=r*(cols+1)+c;b=a+1;d=a+cols+2;z=a+cols+1;tri.extend([a,z,b,b,z,d])
 slots.append(dict(name=n,bone=n,attachment=n));attachments[n]={n:dict(type='mesh',path=n,width=w,height=h,uvs=uv,vertices=v,triangles=tri)}
# Face and entire rim stay together, covering all five tentacle roots.
slots.append(dict(name='bell',bone='body',attachment='bell'));attachments['bell']={'bell':dict(path='bell',width=145,height=104,x=0,y=40)}
poses=[];actions={'Idle':[0,.6,1.2,1.8,2.4,3],'Move':[0,.28,.56,.84,1.12,1.4],'Attack':[0,.12,.24,.36,.52,.72]}
for action,times in actions.items():
 for i,t in enumerate(times):
  p=dict(action=action,time=t,rot={},rootY=0,title={'Idle':'漂浮轻摆','Move':'触手波浪游动','Attack':['准备','触手收拢','蓄力','远程释放','舒展回收','恢复'][i]}[action]);phase=t/times[-1]*math.tau
  if action!='Attack':
   move=action=='Move';p['rootY']=math.sin(phase)*(3 if move else 1.5);p['rot']['body']=math.sin(phase)*(.8 if move else .3)
   for j,(n,*_) in enumerate(configs):
    wave=math.sin(phase+j*.5)-math.sin(j*.5)
    p['rot'][n]=wave*(4 if move else 1.8);p['rot'][n+'-tip']=wave*(9 if move else 4)
  else:
   p['rootY']=[0,1,3,-2,1,0][i]
   for j,(n,x,*_) in enumerate(configs):
    sign=1 if x<0 else -1 if x>0 else .25
    p['rot'][n]=sign*[0,4,8,-6,-2,0][i];p['rot'][n+'-tip']=sign*[0,7,14,-9,-3,0][i]
  poses.append(p)
code=(ROOT/'tools/build-hero-stage04-preview.py').read_text(encoding='utf-8');ns={};exec(code[code.index('def sample('):code.index('\nanimations={}')],ns);sample=ns['sample'];animations={}
for action,times in actions.items():
 frames=[p for p in poses if p['action']==action];ticks=[i/60 for i in range(math.ceil(times[-1]*60))]+[times[-1]];tracks={}
 for b in bones:
  n=b['name'];tracks[n]={'rotate':[dict(time=t,angle=round(sample(times,[p['rot'].get(n,0) for p in frames],t,action!='Attack'),6)) for t in ticks]}
 tracks['root']['translate']=[dict(time=t,x=0,y=round(sample(times,[p['rootY'] for p in frames],t,action!='Attack'),6)) for t in ticks]
 animations[action]={'bones':tracks}
rig=dict(skeleton=dict(spine='3.8.99',images='./'),bones=bones,slots=slots,skins=[dict(name='default',attachments=attachments)],animations=animations)
spec=importlib.util.spec_from_file_location('pack',ROOT/'tools/build-hero-stage01-rig.py');pack=importlib.util.module_from_spec(spec);spec.loader.exec_module(pack);pack.OUT=OUT
pack.pack_atlas({n:Image.open(OUT/(n+'.png')).convert('RGBA') for n in names},'pet-jellyfish')
(OUT/'pet-jellyfish.json').write_text(json.dumps(rig,ensure_ascii=False),encoding='utf-8')
preview=THEME/'previews/pet-jellyfish-skeleton-v1';preview.mkdir(parents=True,exist_ok=True)
(preview/'poses.json').write_text(json.dumps(dict(previewOnly=True,rig=rig,poses=poses),ensure_ascii=False),encoding='utf-8')
print(json.dumps(dict(parts=len(slots),bones=len(bones),keyframes=len(poses))))
