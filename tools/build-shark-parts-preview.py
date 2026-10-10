"""Layered shark parts and preview-only Spine region rig."""
from pathlib import Path
from PIL import Image
import json, math, importlib.util, sys
sys.dont_write_bytecode=True
ROOT=Path(__file__).resolve().parents[1];THEME=ROOT.parent/'主题素材/海底冒险'
OUT=THEME/'textures/characters/partners/animations/shark/parts-rig';OUT.mkdir(parents=True,exist_ok=True)
PREVIEW=THEME/'previews/pet-shark-parts';PREVIEW.mkdir(parents=True,exist_ok=True)
names=['body','tail','dorsal','near-fin','far-fin']
sheet=Image.open(OUT/'source-parts-sheet.png').convert('RGBA')
for i,n in enumerate(names):
    bounds=[(0,0,600,800),(600,0,930,800),(930,0,1280,800),(0,800,480,1280),(480,800,900,1280)][i]
    im=sheet.crop(tuple(round(v/1280*sheet.width) for v in bounds))
    box=im.getchannel('A').point(lambda v:255 if v>32 else 0).getbbox()
    if not box:raise ValueError('Missing part '+n)
    im=im.crop(box);im.save(OUT/(n+'.png'))
bones=[dict(name='root'),dict(name='body',parent='root')]
configs=[('tail',-82,-1,69,108,(.89,.53)),('dorsal',-16,44,62,61,(.52,.92)),('far-fin',44,-40,39,40,(.15,.16)),('body',0,0,200,137,(.5,.5)),('near-fin',-22,-36,70,60,(.80,.15))]
slots=[];attachments={}
for n,x,y,w,h,(px,py) in configs:
    if n!='body':bones.append(dict(name=n,parent='body',x=x,y=y))
    slots.append(dict(name=n,bone=n,attachment=n))
    attachments[n]={n:dict(path=n,width=w,height=h,x=w*(.5-px),y=h*(py-.5))}
actions={'Idle':[0,.6,1.2,1.8,2.4,3],'Move':[0,.28,.56,.84,1.12,1.4],'Attack':[0,.12,.24,.36,.52,.72]};poses=[]
for action,times in actions.items():
    for i,t in enumerate(times):
        wave=math.sin(t/times[-1]*math.tau);move=action=='Move'
        p=dict(action=action,time=t,rootY=wave*(9 if move else 6),rot={},title={'Idle':'鳍尾轻摆','Move':'摆尾游动','Attack':'远程释放'}[action])
        if action!='Attack':
            p['rot'].update(body=wave*(2 if move else 1.2),tail=wave*(15 if move else 7),dorsal=-wave*2)
            p['rot']['near-fin']=wave*(12 if move else 6);p['rot']['far-fin']=-wave*(9 if move else 4)
        else:
            p['rootY']=[0,1,2,-1,0,0][i]
            p['rot'].update(body=[0,2,4,-3,-1,0][i],tail=[0,-5,-10,12,4,0][i],dorsal=[0,-1,-2,2,1,0][i])
            p['rot']['near-fin']=[0,5,10,-10,-3,0][i];p['rot']['far-fin']=[0,-3,-6,7,2,0][i]
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
pack.pack_atlas({n:Image.open(OUT/(n+'.png')).convert('RGBA') for n in names},'pet-shark')
(OUT/'pet-shark.json').write_text(json.dumps(rig,ensure_ascii=False),encoding='utf-8')
(PREVIEW/'poses.json').write_text(json.dumps(dict(previewOnly=True,rig=rig,poses=poses),ensure_ascii=False),encoding='utf-8')
print(json.dumps(dict(parts=len(slots),bones=len(bones),keyframes=len(poses))))
