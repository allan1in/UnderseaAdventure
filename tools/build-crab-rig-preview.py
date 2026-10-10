"""Author a preview-only Spine 3.8 crab rig from independent cutouts."""
from pathlib import Path
import importlib.util,json,math,sys
sys.dont_write_bytecode=True
ROOT=Path(__file__).resolve().parents[1];THEME=ROOT.parent/'主题素材/海底冒险';OUT=THEME/'textures/characters/enemies/animations/crab/skeleton-rig'
from PIL import Image
spec=importlib.util.spec_from_file_location('pack',ROOT/'tools/build-hero-stage01-rig.py');pack=importlib.util.module_from_spec(spec);spec.loader.exec_module(pack);pack.OUT=OUT
bones=[dict(name='root'),dict(name='body',parent='root')];slots=[];attachments={}
def bone(name,parent,x=0,y=0,rotation=0):bones.append(dict(name=name,parent=parent,x=x,y=y,rotation=rotation))
def slot(name,width,height,pivot=(.5,.5),attachment=None):
 key=attachment or name;slots.append(dict(name=name,bone='body' if name=='dead-face' else name,attachment=None if name=='dead-face' else key));attachments[name]={key:dict(path=key,width=width,height=height,x=width*(.5-pivot[0]),y=height*(pivot[1]-.5))}
for side,sign in [('left',-1),('right',1)]:
 for n,x,y in [('far-rear',43,0),('far-front',26,-5),('near-rear',42,-16),('near-front',23,-24)]:
  name=side+'-'+n;bone(name,'body',sign*x,y);slot(name,30 if 'far' in n else 35,42 if 'far' in n else 48,(.84 if side=='left' else .16,.12))
slot('body',120,105)
# Dead face replaces the expression without replacing the character body.
slot('dead-face',90,61);attachments['dead-face']['dead-face'].update(x=7,y=-25)
for side,sign in [('left',-1),('right',1)]:
 bone(side+'-arm','body',sign*45,-18);slot(side+'-arm',24,22,(.85 if side=='left' else .15,.5))
 bone(side+'-palm',side+'-arm',sign*18,-6);slot(side+'-palm',66,84,(.64 if side=='left' else .36,.90))
 bone(side+'-finger',side+'-palm',sign*-17.16,28.56);slot(side+'-finger',33,51,(.90 if side=='left' else .10,.90))
poses=[]
for action,times in [('Idle',[0,.3,.6,.9,1.2,1.5]),('Move',[0,.16,.32,.48,.64,.8]),('Attack',[0,.09,.18,.28,.40,.55]),('Death',[0,.12,.24,.42,.65,.85])]:
 for i,t in enumerate(times):
  r={};p=dict(action=action,time=t,rot=r,title={'Idle':'呼吸待机','Move':'交替步足','Attack':['准备','抬螯张开','前挥','夹击命中','回收','恢复'][i],'Death':['受击','失去支撑','倒下','收腿','沉落','结束'][i]}[action])
  if action in ('Idle','Move'):
   wave=math.sin(t/times[-1]*math.pi*2);p['rootY']=wave*(1 if action=='Idle' else 2);r['body']=wave*(.5 if action=='Idle' else 1.3)
   for side,sign in [('left',-1),('right',1)]:
    r[side+'-arm']=sign*wave*2;r[side+'-finger']=sign*wave*3
    for j,n in enumerate(['far-rear','far-front','near-rear','near-front']):r[side+'-'+n]=math.sin(t/times[-1]*math.pi*2+(j%2)*math.pi+(math.pi if side=='right' else 0))*(1.5 if action=='Idle' else 12)
  elif action=='Attack':
   # Only the leading claw strikes; mirroring the whole rig changes its direction.
   r['right-arm']=[0,8,12,-10,-4,0][i]
   r['right-palm']=[0,15,25,-55,-20,0][i]
   r['right-finger']=[0,-14,-23,18,6,0][i]
   # The rear claw stays tucked near the shell, without a second snapping motion.
   r['left-arm']=[0,-2,-3,-3,-1,0][i]
   r['left-palm']=[0,-5,-9,-9,-4,0][i]
   r['left-finger']=[0,-1,-2,-2,-1,0][i]
   r['body']=[0,2,3,-5,-2,0][i]
   p['rootY']=[0,1,2,-1,1,0][i]
  else:
   r['body']=[0,3,7,11,12,12][i];p['rootY']=[0,2,-3,-9,-14,-14][i];p['deadFace']=i>=1
   for side,sign in [('left',-1),('right',1)]:
    r[side+'-arm']=sign*[0,7,15,23,30,30][i];r[side+'-palm']=sign*[0,5,8,12,15,15][i];r[side+'-finger']=sign*[0,-5,-12,-18,-18,-18][i]
    for n in ['far-rear','far-front','near-rear','near-front']:r[side+'-'+n]=sign*[0,5,15,25,34,34][i]
  poses.append(p)
# Reuse the proven monotone cubic sampler, without importing any assets.
code=(ROOT/'tools/build-hero-stage04-preview.py').read_text(encoding='utf-8');sampler=code[code.index('def sample('):code.index('\nanimations={}')];ns={};exec(sampler,ns);sample=ns['sample'];animations={}
for action in ['Idle','Move','Attack','Death']:
 frames=[p for p in poses if p['action']==action];times=[p['time'] for p in frames];ticks=[i/60 for i in range(math.ceil(times[-1]*60))]+[times[-1]];tracks={}
 for b in bones:
  name=b['name'];values=[p['rot'].get(name,0) for p in frames];tracks[name]={'rotate':[dict(time=t,angle=round(sample(times,values,t,action in ('Idle','Move')),6)) for t in ticks]}
 tracks['root']['translate']=[dict(time=t,x=0,y=round(sample(times,[p.get('rootY',0) for p in frames],t,action in ('Idle','Move')),6)) for t in ticks]
 animations[action]={'bones':tracks}
 if action=='Death':animations[action]['slots']={'dead-face':{'attachment':[dict(time=0,name=None),dict(time=.12,name='dead-face')]}}
rig=dict(skeleton=dict(spine='3.8.99',images='./'),bones=bones,slots=slots,skins=[dict(name='default',attachments=attachments)],animations=animations)
OUT.mkdir(parents=True,exist_ok=True);pack.pack_atlas({name:Image.open(OUT/(name+'.png')).convert('RGBA') for name in attachments},'enemy-crab')
(OUT/'enemy-crab.json').write_text(json.dumps(rig,ensure_ascii=False,indent=2),encoding='utf-8')
preview=THEME/'previews/enemy-crab-skeleton-v1';preview.mkdir(parents=True,exist_ok=True);(preview/'poses.json').write_text(json.dumps(dict(previewOnly=True,rig=rig,poses=poses),ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(dict(preview=str(preview),bones=len(bones),parts=len(slots),keyframes=len(poses))))
