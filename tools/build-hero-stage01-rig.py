"""Extract approved cutout artwork and author a genuine Spine 3.8 rig.
Animation is bone motion, not a replacement sequence of full-character images.
"""
from pathlib import Path
from PIL import Image
import json,math,copy,uuid,shutil,sys

PROJECT=Path(__file__).resolve().parents[1]
THEME=PROJECT.parent/'主题素材/海底冒险'
OUT=THEME/'textures/characters/hero/animations/stage-01/skeleton-rig'
DEST=PROJECT/'assets/resources/gameplay/hero/stage01-rig'
NAMES=['head','torso','backpack','near-upper-arm','near-forearm','near-hand',
       'far-upper-arm','far-forearm','far-hand','near-thigh','near-shin','near-boot',
       'far-thigh','far-shin','far-boot']
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def write(p,v):p.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

def extract(source):
    OUT.mkdir(parents=True,exist_ok=True)
    shutil.copy2(source,OUT/'source-parts-sheet.png')
    sheet=Image.open(source).convert('RGBA')
    # Generated grid gutters; retain the alpha artwork, excluding the divider pixels.
    xs=[0,333,650,973,1298,sheet.width];ys=[0,326,638,sheet.height]
    parts={}
    for i,name in enumerate(NAMES):
        col,row=i%5,i//5
        im=sheet.crop((xs[col]+5,ys[row]+5,xs[col+1]-5,ys[row+1]-5))
        mask=im.getchannel('A').point(lambda a:255 if a>24 else 0)
        box=mask.getbbox()
        if not box:raise ValueError('Empty part '+name)
        im=im.crop(box)
        # Small textures with four pixels of transparent/extruded gutter in atlas.
        im.thumbnail((240,240),Image.Resampling.LANCZOS)
        im.save(OUT/(name+'.png'));parts[name]=im
    return parts

def pack_atlas(parts, name="hero-stage-01"):
    atlas_name=name
    atlas=Image.new('RGBA',(1024,1024));x=y=4;rowh=0
    text=name+'.png\nsize: 1024,1024\nformat: RGBA8888\nfilter: Linear,Linear\nrepeat: none\n'
    for name,im in parts.items():
        if x+im.width+4>1024:x=4;y+=rowh+8;rowh=0
        if y+im.height+4>1024:raise ValueError('Atlas overflow')
        atlas.paste(im,(x,y))
        # Extrude border pixels into the texture gutter; region rect stays unchanged.
        for d in (1,2):
            atlas.paste(im.crop((0,0,im.width,1)),(x,y-d))
            atlas.paste(im.crop((0,im.height-1,im.width,im.height)),(x,y+im.height-1+d))
            atlas.paste(im.crop((0,0,1,im.height)),(x-d,y))
            atlas.paste(im.crop((im.width-1,0,im.width,im.height)),(x+im.width-1+d,y))
        text+=f'{name}\n  rotate: false\n  xy: {x},{y}\n  size: {im.width},{im.height}\n  orig: {im.width},{im.height}\n  offset: 0,0\n  index: -1\n'
        x+=im.width+8;rowh=max(rowh,im.height)
    atlas.save(OUT/(atlas_name+'.png'));(OUT/(atlas_name+'.atlas')).write_text(text,encoding='utf-8')

def build(parts):
    pack_atlas(parts)
    bones=[dict(name='root'),dict(name='body',parent='root',rotation=-18)]
    def bone(name,parent,x=0,y=0,rotation=0,length=0):
        bones.append(dict(name=name,parent=parent,x=x,y=y,rotation=rotation,length=length))
    bone('backpack','body',-30,10,-12)
    bone('head','body',15,38,18)
    for side in ('far','near'):
        near=side=='near'
        bone(side+'-upper-arm','body',20 if near else 9,22 if near else 28,-35 if near else -65,31)
        bone(side+'-forearm',side+'-upper-arm',31,0,75 if near else 85,26)
        bone(side+'-hand',side+'-forearm',26,0,-25 if near else -10,20)
        bone(side+'-thigh','body',-12 if near else -1,-33,-145 if near else -125,29)
        bone(side+'-shin',side+'-thigh',29,0,-20 if near else -25,25)
        bone(side+'-boot',side+'-shin',25,0,165 if near else 150,24)
    slots=[];attachments={}
    def slot(name,width,height,x=0,y=0,rotation=0):
        slots.append(dict(name=name,bone='body' if name=='torso' else name,attachment=name))
        attachments[name]={name:dict(path=name,width=width,height=height,x=x,y=y,rotation=rotation)}
    # Stable draw order: distant limbs behind torso, foreground limbs above it.
    slot('backpack',49,78)
    for side in ('far',):
        slot(side+'-thigh',25,42,15,0,90);slot(side+'-shin',21,37,14,0,90);slot(side+'-boot',34,23,12,-3)
        slot(side+'-upper-arm',42,30,15);slot(side+'-forearm',34,23,13);slot(side+'-hand',32,26,12)
    for side in ('near',):
        slot(side+'-thigh',28,45,15,0,90);slot(side+'-shin',23,39,14,0,90);slot(side+'-boot',37,25,12,-3)
    slot('torso',68,82,0,-3)
    slot('head',108,103,0,43)
    slot('near-upper-arm',44,32,15);slot('near-forearm',36,25,13);slot('near-hand',35,28,12)
    def cyclic(duration,moving):
        timeline={n:{'rotate':[]} for n in ['body','head','backpack','near-upper-arm','near-forearm','far-upper-arm','far-forearm','near-thigh','near-shin','near-boot','far-thigh','far-shin','far-boot']}
        timeline['root']={'translate':[]}
        for i in range(17):
            t=i/16;wave=math.sin(t*2*math.pi);kick=math.sin(t*2*math.pi+math.pi/3)
            timeline['root']['translate'].append(dict(time=t*duration,x=0,y=wave*(2.5 if moving else 1.3)))
            for name,amp,phase in [('body',1.8,0),('head',-1.3,0),('backpack',1,0),('near-upper-arm',4 if moving else 1.5,0),('near-forearm',-3 if moving else -1,0),('far-upper-arm',3 if moving else 1.5,math.pi),('far-forearm',-2,math.pi),('near-thigh',11 if moving else 3,0),('near-shin',-9 if moving else -2,math.pi/3),('near-boot',3,0),('far-thigh',11 if moving else 3,math.pi),('far-shin',-9 if moving else -2,4*math.pi/3),('far-boot',3,math.pi)]:
                timeline[name]['rotate'].append(dict(time=t*duration,angle=amp*math.sin(t*2*math.pi+phase)))
        return {'bones':timeline}
    # Start/end at setup pose. The full attack including recovery stays at .48 sec.
    attack={}
    times=[0,.055,.12,.205,.28,.38,.48]
    angles={'body':[0,-4,-7,3,2,0,0],'head':[0,2,3,-2,-1,0,0],
            'near-upper-arm':[0,-14,-25,32,25,6,0],
            'near-forearm':[0,12,25,-68,-55,-15,0],
            'near-hand':[0,4,8,6,5,1,0],
            'far-upper-arm':[0,5,10,-5,-3,0,0],
            'near-thigh':[0,2,4,-3,-2,0,0],'near-shin':[0,-2,-3,2,1,0,0],
            'far-thigh':[0,-2,-4,3,2,0,0]}
    for name,values in angles.items():attack[name]={'rotate':[dict(time=t,angle=v) for t,v in zip(times,values)]}
    rig=dict(skeleton=dict(spine='3.8.99',images='./',x=-110,y=-120,width=230,height=245),bones=bones,slots=slots,
             skins=[dict(name='default',attachments=attachments)],animations=dict(Idle=cyclic(2.4,False),Move=cyclic(1.2,True),Attack={'bones':attack}))
    write(OUT/'hero-stage-01.json',rig)
    write(OUT/'rig-manifest.json',dict(parts=NAMES,boneCount=len(bones),animations={'Idle':2.4,'Move':1.2,'Attack':.48},attackHitTime=.205,alpha='straight',source='approved stage-01 cutout sheet',drawOrder=[s['name'] for s in slots]))

def directory(p):
    if p==PROJECT/'assets':return
    directory(p.parent);p.mkdir(exist_ok=True)
    meta=Path(str(p)+'.meta')
    if not meta.exists():write(meta,dict(ver='1.2.0',importer='directory',imported=True,uuid=str(uuid.uuid4()),files=[],subMetas={},userData={}))
def meta(p,template):
    value=copy.deepcopy(template);m=Path(str(p)+'.meta')
    value['uuid']=read(m)['uuid'] if m.exists() else str(uuid.uuid4())
    return m,value
def import_rig(stage=1):
    name=f"hero-stage-{stage:02d}"
    directory(DEST);template=PROJECT/'assets/resources/gameplay/boss/warning'
    for suffix in ('.json','.atlas','.png'):shutil.copy2(OUT/(name+suffix),DEST/(name+suffix))
    m,atlas=meta(DEST/(name+'.atlas'),read(template/'ANIboss.atlas.meta'));write(m,atlas)
    m,img=meta(DEST/(name+'.png'),read(template/'ANIboss.png.meta'));image_id=img['uuid'];w=h=1024
    for subid,sub in img['subMetas'].items():
        sub['uuid']=image_id+'@'+subid;sub['displayName']=name;d=sub['userData']
        if subid=='6c48a':d['imageUuidOrDatabaseUri']=image_id
        else:
            d.update(width=w,height=h,rawWidth=w,rawHeight=h,trimType='none',trimX=0,trimY=0,rotated=False,imageUuidOrDatabaseUri=image_id+'@6c48a')
            d['vertices']=dict(rawPosition=[-w/2,-h/2,0,w/2,-h/2,0,-w/2,h/2,0,w/2,h/2,0],indexes=[0,1,2,2,1,3],uv=[0,h,w,h,0,0,w,0],nuv=[0,0,1,0,0,1,1,1],minPos=[-w/2,-h/2,0],maxPos=[w/2,h/2,0])
    img['userData']['redirect']=image_id+'@6c48a';write(m,img)
    m,data=meta(DEST/(name+'.json'),read(template/'ANIboss.json.meta'));data['userData']['atlasUuid']=atlas['uuid'];write(m,data)
    scene_path=PROJECT/'assets/scenes/Main.scene';scene=read(scene_path);evolution=next(o for o in scene if 'themeIdleClips' in o)
    evolution[{1:'stageOneSkeleton',2:'stageTwoSkeleton',3:'stageThreeSkeleton',4:'stageFourSkeleton'}[stage]]=dict(__uuid__=data['uuid'],__expectedType__='sp.SkeletonData')
    if stage in (2,3,4):
        for key in ('themeIdleClips','themeRunClips','themeAttackClips'):
            while len(evolution[key])<stage:evolution[key].append(None)
            evolution[key][stage-1]=None
        write(scene_path,scene)
        print(json.dumps(dict(imported=str(DEST),skeletonUUID=data['uuid'],stage=stage)))
        return
    # Preserve source frames on disk, but stop shipping their 48 referenced
    # swim/attack textures now that stage one is rendered from articulated parts.
    for key in ('stageOneIdleClip','stageOneRunClip','stageOneAttackClip','stageOneIdleFrame'):evolution[key]=None
    for key in ('themeIdleClips','themeRunClips','themeAttackClips'):evolution[key][0]=None
    hero_id=evolution['node']['__id__'];hero=scene[hero_id]
    visual=next(scene[c['__id__']] for c in hero['_children'] if scene[c['__id__']].get('_name')=='Visual')
    picture=next(scene[c['__id__']] for c in visual['_children'] if scene[c['__id__']].get('_name')=='Sprite')
    picture_id=scene.index(picture);picture['_active']=False
    for obj in scene:
        node_id=obj.get('node',{}).get('__id__')
        if obj.get('__type__')=='cc.Animation' and node_id==picture_id:obj['_clips']=[];obj['_defaultClip']=None
        if obj.get('__type__')=='cc.Sprite' and node_id==picture_id:obj['_spriteFrame']=copy.deepcopy(evolution['themeFrames'][0])
        if node_id==hero_id and 'attackMaxTargets' in obj:obj['walkClip']=None;obj['attackClip']=None
    spine_node=next(scene[c['__id__']] for c in visual['_children'] if scene[c['__id__']].get('_name')=='Spine')
    spine_node['_active']=True;spine_node['_lpos'].update(x=10,y=-11);spine_node['_lscale'].update(x=.68,y=.68)
    skeleton=next(scene[c['__id__']] for c in spine_node['_components'] if scene[c['__id__']].get('__type__')=='sp.Skeleton')
    skeleton['_skeletonData']=dict(__uuid__=data['uuid'],__expectedType__='sp.SkeletonData');skeleton['defaultAnimation']='Idle';skeleton['_premultipliedAlpha']=False
    write(scene_path,scene)
    print(json.dumps(dict(output=str(OUT),imported=str(DEST),skeletonUUID=data['uuid'],atlasBytes=(DEST/(name+'.png')).stat().st_size)))

if __name__=='__main__':
    if len(sys.argv)>1:build(extract(Path(sys.argv[1])))
    import_rig()
