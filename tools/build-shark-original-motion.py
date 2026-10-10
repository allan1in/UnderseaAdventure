"""Preview motion on the approved original contour, using one connected mesh.
The source pixels preserve occlusion; soft controls cannot expose cut roots.
"""
from pathlib import Path
import json,math,shutil
from PIL import Image
ROOT=Path(__file__).resolve().parents[1];THEME=ROOT.parent/'主题素材/海底冒险'
OUT=THEME/'textures/characters/partners/animations/shark/original-rig'
PREVIEW=THEME/'previews/pet-shark-original-motion';OUT.mkdir(parents=True,exist_ok=True);PREVIEW.mkdir(parents=True,exist_ok=True)
source=THEME/'textures/characters/partners/animations/shark/idle/idle-01.png';im=Image.open(source);w,h=im.size;shutil.copyfile(source,OUT/'pet-shark.png')
controls=[('tail',177,292,29,49),('side-fin',251,349,34,23),('crest',273,244,29,28),('snout',375,296,27,31),('belly',303,335,39,26)]
bones=[dict(name='root'),dict(name='body',parent='root')]+[dict(name=n,parent='body',x=x-w/2,y=h/2-y) for n,x,y,_,_ in controls]
uv=[];vertices=[];triangles=[];vertexWeights=[];cols=rows=40
for row in range(rows+1):
    for col in range(cols+1):
        x=w*col/cols;y=h*row/rows;uv.extend([col/cols,row/rows])
        guard=math.exp(-((x-323)/35)**2-((y-293)/25)**2)
        weights=[.75*math.exp(-((x-cx)/sx)**2-((y-cy)/sy)**2)*(1-guard) for name,cx,cy,sx,sy in controls]
        total=sum(weights);factor=.92/total if total>.92 else 1;weights=[v*factor for v in weights];weighted=[(1,1-sum(weights))]+[(i+2,v) for i,v in enumerate(weights) if v>1e-5]
        norm=sum(v for _,v in weighted);vertices.append(len(weighted));vertexWeights.append([(i,v/norm) for i,v in weighted])
        for i,v in weighted:
            b=bones[i];vertices.extend([i,round(x-w/2-b.get('x',0),6),round(h/2-y-b.get('y',0),6),round(v/norm,8)])
for row in range(rows):
    for col in range(cols):
        a=row*(cols+1)+col;b=a+1;c=a+cols+1;d=c+1;triangles.extend([a,c,b,b,c,d])
attachment=dict(type='mesh',path='pet-shark',width=w,height=h,uvs=uv,vertices=vertices,triangles=triangles)
actions={'Idle':[0,.6,1.2,1.8,2.4,3],'Move':[0,.28,.56,.84,1.12,1.4],'Attack':[0,.12,.24,.36,.52,.72]}
poses=[]
for action,times in actions.items():
    for i,t in enumerate(times):
        p=dict(action=action,time=t,rot={},offset={},opacity=1)
        if action in ('Idle','Move'):
            phase=t/times[-1]*math.tau;move=action=='Move'
            p['offset']['root']=[0,math.sin(phase)*(9 if move else 6)]
            p['rot']['body']=math.sin(phase)*(2 if move else 1.2)
            for j,(n,*_) in enumerate(controls):
                wave=math.sin(phase+j*.45)-math.sin(j*.45)
                amp={'tail':(7,4),'side-fin':(7,4),'crest':(2,1),'snout':(.8,.4),'belly':(2,1)}[n][0 if move else 1]
                p['offset'][n]=[wave*amp*.3,wave*amp] if n=='tail' else [wave*amp,wave*amp*.4]
        else:
            strike=[0,-2,-4,7,2,0][i]
            p['offset']['root']=[strike,[0,1,2,-1,0,0][i]]
            p['rot']['body']=[0,1.5,3,-2,-.5,0][i]
            p['offset']['snout']=[strike*.5,0]
            p['offset']['tail']=[-strike*.5,strike*.25]
            p['offset']['side-fin']=[-strike*.4,strike*.2]
            p['offset']['crest']=[strike*.15,0]
            p['offset']['belly']=[strike*.2,0]
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
rig=dict(skeleton=dict(spine='3.8.99',images='./'),bones=bones,slots=[dict(name='body-art',bone='body',attachment='body-art')],skins=[dict(name='default',attachments={'body-art':{'body-art':attachment}})],animations=animations)
(OUT/'pet-shark.json').write_text(json.dumps(rig,ensure_ascii=False),encoding='utf-8')
atlas=f'pet-shark.png\nsize: {w},{h}\nformat: RGBA8888\nfilter: Linear,Linear\nrepeat: none\npet-shark\n  rotate: false\n  xy: 0,0\n  size: {w},{h}\n  orig: {w},{h}\n  offset: 0,0\n  index: -1\n'
(OUT/'pet-shark.atlas').write_text(atlas,encoding='utf-8')
(PREVIEW/'poses.json').write_text(json.dumps(dict(previewOnly=True,rig=rig,poses=poses),ensure_ascii=False),encoding='utf-8')
print(json.dumps(dict(bones=len(bones),triangles=len(triangles)//3,keyframes=len(poses))))
