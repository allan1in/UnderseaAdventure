"""Preview motion on the approved original contour, using one connected mesh.
The source pixels preserve occlusion; soft controls cannot expose cut roots.
"""
from pathlib import Path
import json,math,shutil
from PIL import Image
ROOT=Path(__file__).resolve().parents[1];THEME=ROOT.parent/'主题素材/海底冒险'
OUT=THEME/'textures/characters/boss/animations/skeleton-original-motion'
PREVIEW=THEME/'previews/boss-original-motion';OUT.mkdir(parents=True,exist_ok=True);PREVIEW.mkdir(parents=True,exist_ok=True)
source=THEME/'textures/characters/boss/animations/idle/idle-01.png';im=Image.open(source);w,h=im.size;shutil.copyfile(source,OUT/'boss-original.png')
controls=[('rear-left',96,127,20,33),('rear-right',268,165,20,28),('side-left',79,226,23,31),('front-center',150,245,28,29),('side-right',265,237,40,30),('front-lower',207,271,23,18),('head',185,146,43,62)]
bones=[dict(name='root'),dict(name='body',parent='root')]+[dict(name=n,parent='body',x=x-w/2,y=h/2-y) for n,x,y,_,_ in controls]
uv=[];vertices=[];triangles=[];vertexWeights=[];cols=rows=40
for row in range(rows+1):
    for col in range(cols+1):
        x=w*col/cols;y=h*row/rows;uv.extend([col/cols,row/rows])
        guard=math.exp(-((x-185)/43)**2-((y-146)/62)**2)
        weights=[min(.98,guard*4) if name=='head' else .95*math.exp(-((x-cx)/sx)**2-((y-cy)/sy)**2)*(1-guard) for name,cx,cy,sx,sy in controls]
        total=sum(weights);factor=.92/total if total>.92 else 1;weights=[v*factor for v in weights];weighted=[(1,1-sum(weights))]+[(i+2,v) for i,v in enumerate(weights) if v>1e-5]
        norm=sum(v for _,v in weighted);vertices.append(len(weighted));vertexWeights.append([(i,v/norm) for i,v in weighted])
        for i,v in weighted:
            b=bones[i];vertices.extend([i,round(x-w/2-b.get('x',0),6),round(h/2-y-b.get('y',0),6),round(v/norm,8)])
for row in range(rows):
    for col in range(cols):
        a=row*(cols+1)+col;b=a+1;c=a+cols+1;d=c+1;triangles.extend([a,c,b,b,c,d])
attachment=dict(type='mesh',path='boss-original',width=w,height=h,uvs=uv,vertices=vertices,triangles=triangles)
actions={'Idle':[0,.6,1.2,1.8,2.4,3],'Move':[0,.24,.48,.72,.96,1.2],'Attack':[0,.08,.18,.3,.5,.75],'Cast':[0,.12,.24,.4,.6,.8],'Death':[0,.15,.3,.5,.75,1]}
poses=[]
for action,times in actions.items():
    for index,t in enumerate(times):
        p=dict(action=action,time=t,rot={},offset={},opacity=1)
        if action in ('Idle','Move'):
            phase=t/times[-1]*math.pi*2;move=action=='Move';amp=4 if move else 1.5
            p['offset']['root']=[math.sin(phase)*(1.5 if move else 0),math.sin(phase)*(2.5 if move else .7)]
            p['rot']['body']=math.sin(phase)*(.65 if move else .2)
            for i,(n,*_) in enumerate(controls):
                if n=='head':continue
                # All loops meet the neutral original pose at time zero/end.
                wave=math.sin(phase+i*.6)-math.sin(i*.6)
                p['offset'][n]=[wave*amp*.45,wave*amp]
        elif action=='Attack':
            p['offset']['root']=[[0,0],[-1,0],[-3,1],[3,-1],[1,0],[0,0]][index]
            p['rot']['body']=[0,1,2,-2,-1,0][index]
            p['offset']['side-right']=[[0,0],[-5,2],[-10,4],[44,7],[14,2],[0,0]][index]
            p['offset']['front-lower']=[[0,0],[-2,1],[-5,3],[15,3],[5,1],[0,0]][index]
            p['offset']['front-center']=[[0,0],[-1,0],[-2,1],[2,-1],[1,0],[0,0]][index]
        elif action=='Cast':
            p['offset']['root']=[[0,0],[0,1],[0,3],[0,4],[0,1],[0,0]][index]
            rise=[0,5,11,14,5,0][index]
            p['offset']['rear-left']=[-rise*.25,rise];p['offset']['rear-right']=[rise*.25,rise]
            p['offset']['side-left']=[-rise*.15,rise*.35];p['offset']['side-right']=[rise*.15,rise*.35]
        else:
            # Same expression-first loss-of-support logic as the approved crab.
            p['deadFace']=index>=1
            p['offset']['root']=[[0,0],[0,1],[0,-2],[0,-5],[0,-7],[0,-7]][index]
            p['offset']['head']=[[0,0],[0,-1],[0,-5],[0,-11],[0,-17],[0,-17]][index]
            p['rot']['body']=[0,1,2,2.5,2.5,2.5][index]
            fold=[0,1,4,7,10,10][index]
            p['offset']['rear-left']=[fold*.4,-fold];p['offset']['rear-right']=[-fold*.4,-fold]
            p['offset']['side-left']=[fold*.35,-fold*.4];p['offset']['side-right']=[-fold*.35,-fold*.4]
            p['offset']['front-center']=[fold*.15,-fold*.2]
            p['offset']['front-lower']=[-fold*.15,-fold*.2]
        poses.append(p)
def min_area_ratio(p):
    points=[]
    for i,weighted in enumerate(vertexWeights):
        x=uv[i*2]*w;y=-uv[i*2+1]*h
        for bone,weight in weighted:
            off=p['offset'].get(bones[bone]['name'],[0,0]);x+=off[0]*weight;y+=off[1]*weight
        points.append((x,y))
    smallest=1e9
    for i in range(0,len(triangles),3):
        a,b,c=[points[j] for j in triangles[i:i+3]]
        area=(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
        smallest=min(smallest,area/(w/cols*h/rows))
    return smallest
# Connected geometry must not invert or collapse when the strike unfolds.
for p in poses:
    for attempt in range(20):
        if min_area_ratio(p)>.4:break
        for name in [c[0] for c in controls]:
            if name in p['offset']:p['offset'][name]=[v*.85 for v in p['offset'][name]]
    if min_area_ratio(p)<=.4:raise ValueError('Collapsed mesh: '+p['action'])
code=(ROOT/'tools/build-hero-stage04-preview.py').read_text(encoding='utf-8');ns={};exec(code[code.index('def sample('):code.index('\nanimations={}')],ns);sample=ns['sample'];animations={}
for action,times in actions.items():
    frames=[p for p in poses if p['action']==action];ticks=[i/60 for i in range(math.ceil(times[-1]*60))]+[times[-1]];tracks={}
    for b in bones:
        n=b['name'];tracks[n]={'rotate':[dict(time=t,angle=round(sample(times,[p['rot'].get(n,0) for p in frames],t,action in ('Idle','Move')),6)) for t in ticks],
            'translate':[dict(time=t,x=round(sample(times,[p['offset'].get(n,[0,0])[0] for p in frames],t,action in ('Idle','Move')),6),y=round(sample(times,[p['offset'].get(n,[0,0])[1] for p in frames],t,action in ('Idle','Move')),6)) for t in ticks]}
    animations[action]={'bones':tracks}
    animations[action]['slots']={'body-art':{'attachment':[dict(time=0,name='body-art')]}}
    if action=='Death':animations[action]['slots']={'body-art':{'color':[dict(time=t,color='ffffffff') for t in ticks],'attachment':[dict(time=0,name='body-art'),dict(time=.12,name='body-dead')]}}
deadAttachment={**attachment,'path':'boss-original-dead'}
rig=dict(skeleton=dict(spine='3.8.99',images='./'),bones=bones,slots=[dict(name='body-art',bone='body',attachment='body-art')],skins=[dict(name='default',attachments={'body-art':{'body-art':attachment,'body-dead':deadAttachment}})],animations=animations)
(OUT/'boss-original-motion.json').write_text(json.dumps(rig,ensure_ascii=False),encoding='utf-8')
atlas=''
for name in ['boss-original','boss-original-dead']:
    atlas+=f'{name}.png\nsize: {w},{h}\nformat: RGBA8888\nfilter: Linear,Linear\nrepeat: none\n{name}\n  rotate: false\n  xy: 0, 0\n  size: {w}, {h}\n  orig: {w}, {h}\n  offset: 0, 0\n  index: -1\n\n'
(OUT/'boss-original-motion.atlas').write_text(atlas,encoding='utf-8')
(PREVIEW/'poses.json').write_text(json.dumps(dict(previewOnly=True,rig=rig,poses=poses),ensure_ascii=False),encoding='utf-8')
(OUT/'notes.json').write_text(json.dumps(dict(source=str(source),previewOnly=True,method='Connected original-texture weighted mesh; bounded soft tentacle controls preserve occlusion.',hitTime=.3,hiddenSurfacesDrawn=False),ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(dict(bones=len(bones),triangles=len(triangles)//3,keyframes=len(poses))))
