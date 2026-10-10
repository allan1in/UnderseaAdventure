"""Prepare preview-only articulated scallop artwork; original static asset stays intact."""
from pathlib import Path
import importlib.util,json,math,sys
sys.dont_write_bytecode=True
from PIL import Image
ROOT=Path(__file__).resolve().parents[1];THEME=ROOT.parent/'主题素材/海底冒险'
OUT=THEME/'textures/props/summoning-scallop-rig';PREVIEW=THEME/'previews/summoning-scallop-keyframes-v1'
OUT.mkdir(parents=True,exist_ok=True);PREVIEW.mkdir(parents=True,exist_ok=True)
names=['upper-shell','lower-shell','pearl','pedestal']
sheet=Image.open(OUT/'source-parts-sheet.png').convert('RGBA')
for i,name in enumerate(names):
    col,row=i%2,i//2
    # Actual generated gutters differ by row; keep the whole coral silhouette.
    xs=[[0,786,1536],[0,650,1536]];ys=[0,530,1024]
    part=sheet.crop((xs[row][col],ys[row],xs[row][col+1],ys[row+1]))
    box=part.getchannel('A').point(lambda a:255 if a>24 else 0).getbbox()
    if not box:raise ValueError(name+' is empty')
    part=part.crop(box);part.thumbnail((420,420),Image.Resampling.LANCZOS);part.save(OUT/(name+'.png'))
spec=importlib.util.spec_from_file_location('pack',ROOT/'tools/build-hero-stage01-rig.py');pack=importlib.util.module_from_spec(spec);spec.loader.exec_module(pack);pack.OUT=OUT
pack.pack_atlas({n:Image.open(OUT/(n+'.png')).convert('RGBA') for n in names},'summoning-scallop')
# Bottom-centred origin. Only the lid and pearl move; the bowl and stone stay fixed.
bones=[dict(name='root'),dict(name='pedestal',parent='root'),dict(name='upper-shell',parent='root',y=137),dict(name='lower-shell',parent='root',y=94),dict(name='pearl',parent='root',y=158)]
slots=[];attachments={}
sizes={'pedestal':(300,151,75.5),'upper-shell':(238,157,78.5),'lower-shell':(237,97,48.5),'pearl':(82,82,0)}
for n in ['pedestal','upper-shell','lower-shell','pearl']:
    width,height,y=sizes[n];slots.append(dict(name=n,bone=n,attachment=n));attachments[n]={n:dict(path=n,width=width,height=height,y=y)}
poses=[]
for action,times in [('idle',[0,.6,1.2,1.8,2.4,3]),('idle2',[0,.07,.15,.25,.38,.5]),('summon',[0,.18,.38,.65,.9,1.2])]:
    for i,t in enumerate(times):
        pose=dict(action=action,time=t,upperScale=1,pearlY=0,pearlScale=1)
        if action=='idle':
            wave=math.sin(t/3*2*math.pi);pose.update(upperScale=1+wave*.012,pearlY=wave*2,pearlScale=1+wave*.012)
        elif action=='idle2':
            pose.update(upperScale=[1,.97,.94,1.025,1.01,1][i],pearlY=[0,-2,1,6,2,0][i],pearlScale=[1,.96,1.04,1.06,1.02,1][i])
        else:
            pose.update(upperScale=[1,.96,1.04,1.065,1.025,1][i],pearlY=[0,-3,12,22,10,0][i],pearlScale=[1,.95,1.10,1.16,1.06,1][i])
        poses.append(pose)
code=(ROOT/'tools/build-hero-stage04-preview.py').read_text(encoding='utf-8');ns={};exec(code[code.index('def sample('):code.index('\nanimations={}')],ns);sample=ns['sample']
animations={}
for action in ['idle','idle2','summon']:
    frames=[p for p in poses if p['action']==action];times=[p['time'] for p in frames];ticks=[i/60 for i in range(math.ceil(times[-1]*60))]+[times[-1]]
    def curve(field,t):return round(sample(times,[p[field] for p in frames],t,action=='idle'),6)
    animations[action]={'bones':{
        'upper-shell':{'scale':[dict(time=t,x=1,y=curve('upperScale',t)) for t in ticks]},
        'pearl':{'translate':[dict(time=t,x=0,y=curve('pearlY',t)) for t in ticks],'scale':[dict(time=t,x=curve('pearlScale',t),y=curve('pearlScale',t)) for t in ticks]}}}
rig=dict(skeleton=dict(spine='3.8.99',images='./'),bones=bones,slots=slots,skins=[dict(name='default',attachments=attachments)],animations=animations)
(OUT/'summoning-scallop.json').write_text(json.dumps(rig,ensure_ascii=False,indent=2),encoding='utf-8')
(PREVIEW/'poses.json').write_text(json.dumps(dict(previewOnly=True,rig=rig,poses=poses),ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(dict(parts=4,bones=5,animations=list(animations),keyframes=18)))
