"""Align every action to a stable body reference, without changing source PNGs.

Template matching tracks the helmet, shell or bell instead of changing weapons
and limbs. The resulting position/scale keys are native editable Cocos tracks.
"""
from pathlib import Path
import base64
import copy
import json
import math
import sys
import uuid
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT/'assets'
OUT = ROOT/'temp/animation-fix'
OUT.mkdir(parents=True,exist_ok=True)

def read(p): return json.loads(p.read_text(encoding='utf-8-sig'))
def write(p,v):
    p.parent.mkdir(parents=True,exist_ok=True)
    p.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def compressed(s):
    h=s.replace('-','')
    return h[:5]+base64.b64encode(bytes.fromhex(h[5:]+'0')).decode()[:18]
def script_meta(name):
    p=ASSETS/'scripts'/f'{name}.ts.meta'
    if not p.exists():write(p,dict(ver='4.0.24',importer='typescript',imported=True,uuid=str(uuid.uuid4()),files=[],subMetas={},userData={}))
    return compressed(read(p)['uuid'])

def box(path):
    return Image.open(path).convert('RGBA').getchannel('A').point(lambda a:255 if a>=128 else 0).getbbox()

def grey(path):
    im=Image.open(path).convert('RGBA')
    size=im.size
    im.thumbnail((128,128),Image.Resampling.LANCZOS)
    a=np.array(im,dtype=np.float64)/255
    # Keep shading and edges, discarding RGB hidden in transparent pixels.
    g=(a[:,:,0]*.299+a[:,:,1]*.587+a[:,:,2]*.114)*a[:,:,3]
    return g,size,size[0]/im.width

def sums(a,h,w):
    integral=np.pad(a,((1,0),(1,0))).cumsum(0).cumsum(1)
    return integral[h:,w:]-integral[:-h,w:]-integral[h:,:-w]+integral[:-h,:-w]

def correlate(image,template,center,search=26):
    H,W=image.shape;h,w=template.shape
    if h>=H or w>=W or h<8 or w<8:return (-2,0,0)
    t=template-template.mean()
    shape=(1<<(H+h-2).bit_length(),1<<(W+w-2).bit_length())
    cross=np.fft.irfft2(np.fft.rfft2(image,shape)*np.fft.rfft2(t[::-1,::-1],shape),s=shape)[h-1:H,w-1:W]
    total=sums(image,h,w)
    variance=np.maximum(1e-8,sums(image*image,h,w)-total*total/(h*w))
    score=cross/np.sqrt(variance*max(1e-8,(t*t).sum()))
    yy,xx=np.indices(score.shape)
    # Searching near the expected body excludes the sword, claws and tail.
    allowed=(np.abs(xx+w/2-center[0])<search)&(np.abs(yy+h/2-center[1])<search)
    score=np.where(allowed,score,-2)
    iy,ix=np.unravel_index(np.argmax(score),score.shape)
    value=float(score[iy,ix])
    def refine(vals):
        den=vals[0]-2*vals[1]+vals[2]
        return float(np.clip(.5*(vals[0]-vals[2])/den,-.5,.5)) if den < -1e-8 else 0
    dx=refine(score[iy,ix-1:ix+2]) if 0<ix<score.shape[1]-1 else 0
    dy=refine(score[iy-1:iy+2,ix]) if 0<iy<score.shape[0]-1 else 0
    return value,ix+dx+w/2,iy+dy+h/2

def register(files,roi):
    ref,size,factor=grey(files['idle'][0]);b=box(files['idle'][0]);bw,bh=b[2]-b[0],b[3]-b[1]
    rect=[int(round((b[0]+roi[0]*bw)/factor)),int(round((b[1]+roi[1]*bh)/factor)),
          int(round((b[0]+roi[2]*bw)/factor)),int(round((b[1]+roi[3]*bh)/factor))]
    template=ref[rect[1]:rect[3],rect[0]:rect[2]]
    tpl=Image.fromarray(template.astype(np.float32),mode='F')
    anchor=np.array([(rect[0]+rect[2])/2*factor,(rect[1]+rect[3])/2*factor])
    result={}
    for action,frames in files.items():
        result[action]=[]
        for p in frames:
            g,sz,fac=grey(p);bounds=box(p)
            center=((bounds[0]+(roi[0]+roi[2])/2*(bounds[2]-bounds[0]))/fac,
                    (bounds[1]+(roi[1]+roi[3])/2*(bounds[3]-bounds[1]))/fac)
            best=(-2,1,0,0)
            for r in np.arange(.55,1.751,.04):
                t=np.array(tpl.resize((max(8,round(template.shape[1]*r)),max(8,round(template.shape[0]*r))),Image.Resampling.BICUBIC))
                score,x,y=correlate(g,t,center)
                if score>best[0]:best=(score,r,x*fac,y*fac)
            r0=best[1]
            for r in np.linspace(max(.5,r0-.035),r0+.035,9):
                tw,th=max(8,round(template.shape[1]*r)),max(8,round(template.shape[0]*r))
                score,x,y=correlate(g,np.array(tpl.resize((tw,th),Image.Resampling.BICUBIC)),center)
                if score>best[0]:best=(score,(tw/template.shape[1]+th/template.shape[0])/2,x*fac,y*fac)
            result[action].append(dict(score=best[0],ratio=best[1],center=[best[2],best[3]]))
    # The exact reference has a known transform, regardless of subpixel search rounding.
    result['idle'][0]=dict(score=1,ratio=1,center=anchor.tolist())
    return anchor,result

def turtle_shell(files):
    # The attack shell has different panel artwork. Match its complete outline,
    # not one repeated panel, which can otherwise produce a false smaller match.
    def shell(path):
        a=np.array(Image.open(path).convert('RGBA'),dtype=float)
        r,g,b,alpha=[a[:,:,i] for i in range(4)]
        ys,xs=np.where((alpha>=128)&(r>80)&(r>g*1.14)&(g>b*1.7))
        if len(xs)<40:raise ValueError('Cannot locate turtle shell: '+str(path))
        left,right=np.quantile(xs,[.01,.99]);top,bottom=np.quantile(ys,[.01,.99])
        return right-left,np.array([(left+right)/2,(top+bottom)/2])
    width,anchor=shell(files['idle'][0]);result={}
    for action,frames in files.items():
        result[action]=[]
        for p in frames:
            w,c=shell(p)
            result[action].append(dict(score=1,ratio=w/width,center=c.tolist()))
    return anchor,result

def crab_shell(files,roi):
    anchor,result=register(files,roi)
    # Raised pincers change the full silhouette dramatically. Track the face
    # against this attack's own neutral frame, with a bounded body scale.
    ref,_,factor=grey(files['attack'][0])
    rect=[round(v/factor) for v in [125,135,220,215]]
    template=ref[rect[1]:rect[3],rect[0]:rect[2]]
    tpl=Image.fromarray(template.astype(np.float32),mode='F')
    center=np.array([(rect[0]+rect[2])/2*factor,(rect[1]+rect[3])/2*factor])
    first=result['attack'][0].copy()
    eyes=[]
    for path in files['attack']:
        a=np.array(Image.open(path).convert('RGBA'),dtype=float);r,g,b,alpha=[a[:,:,k] for k in range(4)]
        y,x=np.nonzero((alpha>=128)&(g>r*.85)&(b<115)&(g>120)&(r>125))
        eyes.append(np.array([x.mean(),np.median(y)]) if len(x)>30 else None)
    for i,eye in enumerate(eyes):
        if eye is None:
            before=next(eyes[k] for k in range(i-1,-1,-1) if eyes[k] is not None)
            after=next(eyes[k] for k in range(i+1,len(eyes)) if eyes[k] is not None)
            eyes[i]=(before+after)/2
    delta=np.array(first['center'])-center
    for i,path in enumerate(files['attack']):
        if i==0:continue
        g,_,fac=grey(path);best=(-2,1,center[0],center[1])
        for ratio in np.linspace(.9,1.1,17):
            tw,th=max(8,round(template.shape[1]*ratio)),max(8,round(template.shape[0]*ratio))
            t=np.array(tpl.resize((tw,th),Image.Resampling.BICUBIC))
            expected=(eyes[i]+(center-eyes[0])*ratio)/fac
            score,x,y=correlate(g,t,expected,search=10)
            actual=(tw/template.shape[1]+th/template.shape[0])/2
            if score>best[0]:best=(score,actual,x*fac,y*fac)
        score,ratio,x,y=best
        result['attack'][i]=dict(score=score,ratio=first['ratio']*ratio,
            center=(np.array([x,y])+delta*ratio).tolist())
    return anchor,result

def vector_track(a,prop,values,times):
    idx=len(a)
    a.append(dict(__type__='cc.animation.VectorTrack',_nComponents=3,_channels=[],
        _binding=dict(__type__='cc.animation.TrackBinding',path={'__id__':idx+1},proxy=None)))
    a.append(dict(__type__='cc.animation.TrackPath',_paths=[prop]))
    for k in range(4):
        ch=len(a);a[idx]['_channels'].append({'__id__':ch})
        a.append(dict(__type__='cc.animation.Channel',_curve={'__id__':ch+1}))
        a.append(dict(__type__='cc.RealCurve',_times=times if k<3 else [],
            _values=[dict(__type__='cc.RealKeyframeValue',value=v[k],interpolationMode=1,tangentWeightMode=0,
                rightTangent=0,rightTangentWeight=0,leftTangent=0,leftTangentWeight=0,easingMethod=0) for v in values] if k<3 else [],
            preExtrapolation=1,postExtrapolation=1))
    a[0]['_tracks'].append({'__id__':idx})

def rewrite_clip(path,files,poses,fps,loop):
    a=read(path)[:7];a[0]['_tracks']=[{'__id__':1}]
    order=list(range(24)) if not loop else list(range(24))+list(range(22,0,-1))
    times=[i/fps for i in range(len(order))]
    a[0].update(sample=fps,speed=1,wrapMode=2 if loop else 1,_duration=len(order)/fps,_hash=0)
    a[5].update(_times=times,_values=[{'__uuid__':read(Path(str(files[i])+'.meta'))['uuid']+'@f9941','__expectedType__':'cc.SpriteFrame'} for i in order])
    vector_track(a,'position',[poses[i]['position'] for i in order],times)
    vector_track(a,'scale',[poses[i]['scale'] for i in order],times)
    write(path,a)
    return dict(path=str(path.relative_to(ROOT)).replace('\\','/'),duration=len(order)/fps,frames=len(order),fps=fps)

def comp(a,n,kind):
    return next(a[r['__id__']] for r in a[n]['_components'] if a[r['__id__']]['__type__']==kind)
def add_component(a,n,kind,**fields):
    idx=len(a);a.append(dict(__type__=kind,_name='',_objFlags=0,__editorExtras__={},node={'__id__':n},
        _enabled=True,__prefab={'__id__':idx+1},_id='',**fields))
    a.append(dict(__type__='cc.CompPrefabInfo',fileId=str(uuid.uuid4())))
    a[n]['_components'].append({'__id__':idx});return idx
def add_node(a,parent,name):
    n=copy.deepcopy(a[1]);n.update(_name=name,_parent={'__id__':parent},_children=[],_components=[],_prefab={'__id__':len(a)+1},_id='')
    n['_lpos'].update(x=0,y=0,z=0);n['_lscale'].update(x=1,y=1,z=1)
    idx=len(a);a.append(n)
    original=copy.deepcopy(a[a[1]['_prefab']['__id__']]);original.update(root={'__id__':1},fileId=str(uuid.uuid4()))
    a.append(original);a[parent]['_children'].append({'__id__':idx})
    add_component(a,idx,'cc.UITransform',_contentSize={'__type__':'cc.Size','width':1,'height':1},_anchorPoint={'__type__':'cc.Vec2','x':.5,'y':.5})
    return idx

script_meta('SpriteTransition')
forms=read(ASSETS/'resources/gameplay/hero/forms.json')
groups=[]
for stage,form in enumerate(forms['forms'],1):
    groups.append(dict(name=f'Hero{stage}',folder=ASSETS/'textures/characters/sea-hero/animations'/f'stage-{stage:02d}',
        roi=(.27,.01,.72,.50),base=form['themeVisual']['animation']['scale'],offset=form['themeVisual']['animation']['offsets'][0],stage=stage))
for name,part,pre,height,roi in [
    ('Crab','enemies/animations/crab','Enemy',146.7620286086,(.30,.05,.75,.66)),
    ('Octopus','boss/animations','Boss',385.4508196721,(.27,.02,.72,.60)),
    ('Shark','partners/animations/shark','PetBlueDragon',162.98165,(.48,.17,.98,.79)),
    ('Turtle','partners/animations/turtle','PetFox',148.11024,(.17,.04,.66,.48)),
    ('Seahorse','partners/animations/seahorse','PetRedDragon',120.68744,(.18,.01,.91,.48)),
    ('Jellyfish','partners/animations/jellyfish','PetWhiteTiger',131.12167,(.17,.02,.84,.51))]:
    static=ASSETS/'textures/undersea/characters'/('enemies/enemy-crab.png' if name=='Crab' else 'boss/boss-octopus.png' if name=='Octopus' else 'partners/pet-'+name.lower()+'.png')
    b=box(static);h=Image.open(static).height
    folder=ASSETS/'textures/characters'/part;ib=box(folder/'idle/idle-01.png');iw,ih=Image.open(folder/'idle/idle-01.png').size
    base=(b[3]-b[1])*height/h/(ib[3]-ib[1])
    offset=[(iw/2-(ib[0]+ib[2])/2)*base,(h/2-b[3])*height/h+(ib[3]-ih/2)*base]
    groups.append(dict(name=name,folder=folder,roi=roi,base=base,offset=offset,prefab=pre))

report=[]
previous={e['name']:e for e in read(OUT/'alignment-report.json')} if (OUT/'alignment-report.json').exists() else {}
for group in groups:
    name=group['name'];files={a:sorted((group['folder']/('run' if a=='move' and name.startswith('Hero') else a)).glob('*.png')) for a in ['idle','move','attack']}
    if len(sys.argv)>1 and name not in sys.argv[1:]:
        report.append(previous[name]);continue
    assert all(len(fs)==24 for fs in files.values()),name
    anchor,reg=turtle_shell(files) if name=='Turtle' else crab_shell(files,group['roi']) if name=='Crab' else register(files,group['roi'])
    w,h=Image.open(files['idle'][0]).size;base=group['base'];ox,oy=group['offset']
    target=np.array([ox+(anchor[0]-w/2)*base,oy+(h/2-anchor[1])*base])
    poses={};clips=[]
    for action in files:
        poses[action]=[]
        for item in reg[action]:
            # Registration uses a stable core; separate limb and weapon motion is retained.
            s=base/item['ratio'];cx,cy=item['center']
            poses[action].append(dict(position=[float(target[0]-(cx-w/2)*s),float(target[1]-(h/2-cy)*s),0],scale=[s,s,1]))
        if name.startswith('Hero'):
            act={'idle':'Idle','move':'Walk','attack':'Attack'}[action];stage=group['stage']
            clip_name='Hero'+act if stage==1 else f'HeroStage{stage:02d}'+act
            path=ASSETS/'animations'/f'{clip_name}.anim' if stage==1 else ASSETS/'resources/gameplay/hero/theme-animations'/f'{clip_name}.anim'
        else:
            clip_name='SeaCrabWalk' if name=='Crab' and action=='move' else 'Sea'+name+action.title()
            path=ASSETS/'animations'/f'{clip_name}.anim'
        fps=24 if action!='attack' else 50 if name.startswith('Hero') else 40 if name in ['Shark','Turtle','Seahorse','Jellyfish'] else 40 if name=='Crab' else 32
        clips.append(rewrite_clip(path,files[action],poses[action],fps,action!='attack'))
    if 'prefab' in group:
        path=ASSETS/'prefabs'/f"{group['prefab']}.prefab";a=read(path)
        if name=='Crab':
            visual=next((i for i,o in enumerate(a) if o.get('__type__')=='cc.Node' and o.get('_name')=='Visual'),None)
            if visual is None:
                visual=add_node(a,1,'Visual');sprite_id=add_node(a,visual,'Sprite')
                old=comp(a,1,'cc.Sprite');old['_enabled']=False
                new_id=add_component(a,sprite_id,'cc.Sprite')
                preserved=a[new_id]['__prefab'];a[new_id]=copy.deepcopy(old)
                a[new_id].update(node={'__id__':sprite_id},__prefab=preserved,_enabled=True)
                legacy=comp(a,1,'cc.Animation');legacy['_enabled']=False
                anim=add_component(a,sprite_id,'cc.Animation',playOnLoad=False,_clips=legacy['_clips'],_defaultClip=legacy['_defaultClip'])
            else:sprite_id=next(r['__id__'] for r in a[visual]['_children'] if a[r['__id__']]['_name']=='Sprite')
            controller=next(o for o in a if 'walkClip' in o)
            controller.update(hitTime=.4,deathVisualSize=0)
            # No new death artwork exists; retain the normalized idle body for the brief death hold.
            death_path=ASSETS/'animations/SeaCrabDeath.anim';death=read(death_path)[:7]
            death[0].update(_duration=.3,_tracks=[{'__id__':1}],_hash=0)
            death[5].update(_times=[0],_values=[read(ASSETS/'animations/SeaCrabIdle.anim')[5]['_values'][0]])
            vector_track(death,'position',[poses['idle'][0]['position']],[0])
            vector_track(death,'scale',[poses['idle'][0]['scale']],[0]);write(death_path,death)
        else:sprite_id=next(i for i,o in enumerate(a) if o.get('__type__')=='cc.Node' and o.get('_name')=='Sprite')
        sprite=comp(a,sprite_id,'cc.Sprite');sprite['_sizeMode']=2;sprite['_isTrimmedMode']=False
        comp(a,sprite_id,'cc.UITransform')['_contentSize'].update(width=w,height=h)
        first=poses['idle'][0];a[sprite_id]['_lpos'].update(zip(['x','y','z'],first['position']));a[sprite_id]['_lscale'].update(zip(['x','y','z'],first['scale']))
        edges=[]
        for action,fs in files.items():
            for f,pose in zip(fs,poses[action]):
                b=box(f);x,y,_=pose['position'];s=pose['scale'][0]
                edges.append([(b[0]-w/2)*s+x,(b[2]-w/2)*s+x,(h/2-b[3])*s+y,(h/2-b[1])*s+y])
        comp(a,1,'cc.UITransform')['_contentSize'].update(width=2*max(abs(e[k]) for e in edges for k in [0,1]),height=2*max(abs(e[k]) for e in edges for k in [2,3]))
        footprint={'Crab':(44,25),'Shark':(46,25),'Turtle':(38,24),'Seahorse':(24,18),'Jellyfish':(35,20)}.get(name)
        if footprint:
            body=next(o for o in a if 'collisionMask' in o)
            body.update(radius=footprint[0],verticalRadius=footprint[1])
        if name=='Octopus':next(o for o in a if 'moveSpeed' in o)['moveSpeed']=200
        write(path,a)
    else:
        form=forms['forms'][group['stage']-1]
        form['attack']['hitProgress']=.5
        form['themeVisual']['collision']['radiusY']=[18,19,21,24][group['stage']-1]
    entry=dict(name=name,clips=clips,registration=reg,poses=poses,anchor=anchor.tolist(),base=base,offset=group['offset'],roi=group['roi'])
    report.append(entry)
    print(name,'attack',clips[-1]['duration'],'s; minimum body match',round(min(r['score'] for rs in reg.values() for r in rs),3),flush=True)
processed_heroes = any(g['name'].startswith('Hero') and (len(sys.argv)==1 or g['name'] in sys.argv[1:]) for g in groups)
if processed_heroes:
    write(ASSETS/'resources/gameplay/hero/forms.json',forms)
write(OUT/'alignment-report.json',report)
# Keep the first form's serialized hit time consistent before HeroEvolution.start.
if processed_heroes:
    p=ASSETS/'scenes/Main.scene';a=read(p)
    for o in a:
        if 'slashClip' in o and 'hitTime' in o:o['hitTime']=.24
    write(p,a)

# Recalculate strikes whenever frame registration changes.
import runpy
runpy.run_path(str(Path(__file__).with_name('calibrate-attack-ranges.py')), run_name='__main__')
