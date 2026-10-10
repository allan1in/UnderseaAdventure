"""Preview-only octopus: continuous weighted meshes, never hard-cut tentacle joints."""
from pathlib import Path
from PIL import Image
from collections import deque
import importlib.util,json,math,sys
sys.dont_write_bytecode=True
ROOT=Path(__file__).resolve().parents[1];THEME=ROOT.parent/'主题素材/海底冒险'
OUT=THEME/'textures/characters/boss/animations/skeleton-rig';PREVIEW=THEME/'previews/boss-skeleton-keyframes-v1'
OUT.mkdir(parents=True,exist_ok=True);PREVIEW.mkdir(parents=True,exist_ok=True)
names=['head','crown','dead-head','rear-left','rear-right','side-left','side-right','inner-left','inner-right','front-left','front-right']
sheet=Image.open(OUT/'source-parts-sheet.png').convert('RGBA');ys=[0,359,654,934,1254];xs=[0,415,832,1254]
for i,name in enumerate(names):
    row,col=divmod(i,3);box=(xs[col],ys[row],xs[col+1],ys[row+1])
    if name=='front-right':box=(415,934,1254,1254)
    part=sheet.crop(box);w,h=part.size;alpha=bytearray(part.getchannel('A').tobytes());seen=bytearray(w*h);largest=[]
    for start in range(w*h):
        if seen[start] or alpha[start]<=24:continue
        seen[start]=1;q=deque([start]);component=[]
        while q:
            a=q.popleft();component.append(a);x,y=a%w,a//w
            for b in ([a-1]if x else[])+([a+1]if x<w-1 else[])+([a-w]if y else[])+([a+w]if y<h-1 else[]):
                if not seen[b]and alpha[b]>24:seen[b]=1;q.append(b)
        if len(component)>len(largest):largest=component
    if not largest:raise ValueError(name)
    keep=set(largest)
    for a in largest:
        x,y=a%w,a//w
        for dy in [-1,0,1]:
            for dx in [-1,0,1]:
                if 0<=x+dx<w and 0<=y+dy<h:keep.add(a+dx+dy*w)
    for a in range(w*h):
        if a not in keep:alpha[a]=0
    part.putalpha(Image.frombytes('L',(w,h),bytes(alpha)));part=part.crop(part.getchannel('A').getbbox());part.thumbnail((240,240),Image.Resampling.LANCZOS);part.save(OUT/(name+'.png'))
headsV2=OUT/'source-heads-v2.png'
if headsV2.exists():
    pair=Image.open(headsV2).convert('RGBA')
    for i,name in enumerate(['head','dead-head']):
        part=pair.crop((i*pair.width//2,0,(i+1)*pair.width//2,pair.height))
        part=part.crop(part.getchannel('A').point(lambda a:255 if a>24 else 0).getbbox());part.thumbnail((240,240),Image.Resampling.LANCZOS);part.save(OUT/(name+'.png'))
    # Start from a naturally curled continuous limb; forcing the straight strike
    # drawing through a 180-degree fold creates a different, angular silhouette.
    Image.open(OUT/'side-right.png').save(OUT/'front-right.png')
    Image.open(OUT/'rear-left.png').save(OUT/'side-left.png')
spec=importlib.util.spec_from_file_location('pack',ROOT/'tools/build-hero-stage01-rig.py');pack=importlib.util.module_from_spec(spec);spec.loader.exec_module(pack);pack.OUT=OUT
pack.pack_atlas({n:Image.open(OUT/(n+'.png')).convert('RGBA') for n in names},'boss-octopus')
bones=[dict(name='root'),dict(name='body',parent='root'),dict(name='head',parent='body',x=16 if headsV2.exists() else 0,y=45 if headsV2.exists() else 24),dict(name='crown',parent='head',y=50)]
slots=[];attachments={};chains={}
def region(name,bone,width,height):
    slots.append(dict(name=name,bone=bone,attachment=name));attachments[name]={name:dict(path=name,width=width,height=height)}
def world_matrices():
    result={}
    for b in bones:
        p=result.get(b.get('parent'),(0,0,0));angle=p[2]+b.get('rotation',0);r=math.radians(p[2]);x,y=b.get('x',0),b.get('y',0)
        result[b['name']]=(p[0]+x*math.cos(r)-y*math.sin(r),p[1]+x*math.sin(r)+y*math.cos(r),angle)
    return result
def mesh(name,x,y,w,h,points,rotation=0):
    origin=points[0];points=[(w*(u-origin[0]),h*(origin[1]-v)) for u,v in points]
    angles=[math.degrees(math.atan2(b[1]-a[1],b[0]-a[0]))for a,b in zip(points,points[1:])];angles.append(angles[-1]);indices=[]
    for i,point in enumerate(points):
        b=dict(name=name+'-'+str(i),parent='body'if i==0 else name+'-'+str(i-1))
        if i==0:b.update(x=x,y=y,rotation=rotation+angles[0])
        else:b.update(x=math.dist(points[i-1],point),rotation=angles[i]-angles[i-1])
        indices.append(len(bones));bones.append(b)
    chains[name]=[bones[i]['name']for i in indices];mat=world_matrices();uv=[];verts=[];triangles=[];cols,rows=8,5;r=math.radians(rotation)
    for row in range(rows+1):
        for col in range(cols+1):
            u,v=col/cols,row/rows;uv.extend([u,v]);px,py=w*(u-origin[0]),h*(origin[1]-v)
            wx,wy=x+px*math.cos(r)-py*math.sin(r),y+px*math.sin(r)+py*math.cos(r)
            best=None
            for i,(a,b)in enumerate(zip(points,points[1:])):
                dx,dy=b[0]-a[0],b[1]-a[1];t=max(0,min(1,((px-a[0])*dx+(py-a[1])*dy)/(dx*dx+dy*dy)));distance=(px-a[0]-t*dx)**2+(py-a[1]-t*dy)**2
                if best is None or distance<best[0]:best=(distance,i,t)
            _,i,t=best;weights=[(indices[i],1-t),(indices[i+1],t)];weights=[(idx,weight)for idx,weight in weights if weight>1e-6];verts.append(len(weights))
            for idx,weight in weights:
                bx,by,ba=mat[bones[idx]['name']];a=math.radians(ba);vx,vy=wx-bx,wy-by
                verts.extend([idx,round(vx*math.cos(a)+vy*math.sin(a),6),round(-vx*math.sin(a)+vy*math.cos(a),6),round(weight,6)])
    for row in range(rows):
        for col in range(cols):
            a=row*(cols+1)+col;b=a+1;c=a+cols+1;d=c+1;triangles.extend([a,c,b,b,c,d])
    slots.append(dict(name=name,bone=chains[name][0],attachment=name))
    attachments[name]={name:dict(type='mesh',path=name,uvs=uv,triangles=triangles,vertices=verts,width=w,height=h)}
mesh('rear-left',-43,12,70,83,[(.86,.90),(.65,.62),(.42,.32),(.20,.22)])
mesh('rear-right',65,9,55,75,[(.14,.90),(.35,.62),(.58,.32),(.80,.22)])
mesh('side-left',-42,-57,78,99,[(.86,.90),(.65,.62),(.42,.32),(.20,.22)])
mesh('side-right',70,-24,55,74,[(.09,.16),(.36,.45),(.70,.66),(.82,.82)],-10)
headW,headH=(122,146)if headsV2.exists()else(145,125)
region('head','head',headW,headH);attachments['head']['dead-head']=dict(path='dead-head',width=headW,height=headH)
region('crown','crown',105,70)
if headsV2.exists():slots[-1]['attachment']=None # Crown placement is preserved within the original-style head.
mesh('inner-left',-13,0,72,72,[(.86,.20),(.60,.36),(.27,.58),(.40,.78)])
mesh('inner-right',25,0,72,72,[(.14,.20),(.40,.36),(.73,.58),(.60,.78)])
mesh('front-left',40 if headsV2.exists() else -20,0,105,90,[(.90,.20),(.55,.27),(.26,.61),(.46,.84)])
mesh('front-right',12,-5,100,86,[(.09,.16),(.36,.45),(.70,.55),(.84,.75),(.69,.86)])
# Slot order is Spine draw order. Every limb originates behind the head;
# visible lower coils remain outside the head silhouette, without exposed roots.
slots=[s for s in slots if s['name'] not in ('head','crown')]+[s for s in slots if s['name'] in ('head','crown')]
primaryRest=[0,0,0,0,0]
primaryAngles=[b.get('rotation',0) for b in bones if b['name'] in chains['front-right']]
# Uncoil toward the eye direction by straightening the middle links at impact.
primaryStrike=[-8-primaryAngles[0]]+[-a for a in primaryAngles[1:3]]+[0,0]
poses=[]
actions={'Idle':[0,.48,.96,1.44,1.92,2.4],'Move':[0,.24,.48,.72,.96,1.2],'Attack':[0,.08,.18,.3,.5,.75],'Cast':[0,.12,.24,.4,.6,.8],'Death':[0,.15,.3,.5,.75,1]}
for action,times in actions.items():
    for i,t in enumerate(times):
        p=dict(action=action,time=t,rot={},rootY=0,deadHead=False);r=p['rot']
        if action in ('Idle','Move'):
            phase=t/times[-1]*math.pi*2;wave=math.sin(phase);p['rootY']=wave*(1.2 if action=='Idle'else 3);r['body']=wave*(.8 if action=='Idle'else 2)
            for j,(name,chain)in enumerate(chains.items()):
                for k,b in enumerate(chain):r[b]=math.sin(phase+j*.7-k*.45)*(2.5 if action=='Idle'else 7)*(1 if k else .65)
            for k,b in enumerate(chains['front-right']):r[b]+=primaryRest[k]
        elif action=='Attack':
            r['body']=[0,3,5,-5,-2,0][i];r['head']=[0,1,2,-2,-1,0][i];p['rootY']=[0,1,2,-2,-1,0][i]
            main=[[rest,rest-3,rest-6,strike,rest+(strike-rest)*.35,rest] for rest,strike in zip(primaryRest,primaryStrike)]
            for k,b in enumerate(chains['front-right']):r[b]=main[k][i]
            for name,chain in chains.items():
                if name!='front-right':
                    for k,b in enumerate(chain):r[b]=[0,2,4,-3,-1,0][i]*(1 if 'left'in name else-1)
        elif action=='Cast':
            r['body']=[0,1,2,-2,-1,0][i];p['rootY']=[0,2,4,1,0,0][i]
            for name,chain in chains.items():
                sign=-1 if 'left'in name else 1
                for k,b in enumerate(chain):r[b]=sign*[0,4,9,5,2,0][i]*(1 if 'rear'in name else .35)
            for k,b in enumerate(chains['front-right']):r[b]+=primaryRest[k]
        else:
            r['body']=[0,2,5,9,12,12][i];r['head']=[0,-2,-4,-7,-9,-9][i];p['rootY']=[0,1,-5,-14,-25,-25][i];p['deadHead']=i>=1
            for name,chain in chains.items():
                sign=1 if 'left'in name else-1
                for k,b in enumerate(chain):r[b]=sign*[0,2,5,10,15,15][i]*(.5 if k==0 else 1)
            for k,b in enumerate(chains['front-right']):r[b]+=primaryRest[k]
        poses.append(p)
code=(ROOT/'tools/build-hero-stage04-preview.py').read_text(encoding='utf-8');ns={};exec(code[code.index('def sample('):code.index('\nanimations={}')],ns);sample=ns['sample'];animations={}
for action,times in actions.items():
    frames=[p for p in poses if p['action']==action];ticks=[i/60 for i in range(math.ceil(times[-1]*60))]+[times[-1]];tracks={}
    for b in bones:tracks[b['name']]={'rotate':[dict(time=t,angle=round(sample(times,[p['rot'].get(b['name'],0)for p in frames],t,action in ('Idle','Move')),6))for t in ticks]}
    tracks['root']['translate']=[dict(time=t,x=0,y=round(sample(times,[p['rootY']for p in frames],t,action in ('Idle','Move')),6))for t in ticks];animations[action]={'bones':tracks}
    if action=='Death':animations[action]['slots']={'head':{'attachment':[dict(time=0,name='head'),dict(time=.15,name='dead-head')]}}
rig=dict(skeleton=dict(spine='3.8.99',images='./'),bones=bones,slots=slots,skins=[dict(name='default',attachments=attachments)],animations=animations)
(OUT/'boss-octopus.json').write_text(json.dumps(rig,ensure_ascii=False,indent=2),encoding='utf-8');(PREVIEW/'poses.json').write_text(json.dumps(dict(previewOnly=True,rig=rig,poses=poses),ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(dict(parts=len(names),bones=len(bones),weightedMeshes=8,keyframes=len(poses))))
