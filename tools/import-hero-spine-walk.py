"""Copy the approved Spine walk data and calibrate against the current idle frame."""
from pathlib import Path
import copy, json, shutil, uuid
from PIL import Image

PROJECT=Path(__file__).resolve().parents[1]
ASSETS=PROJECT/'assets'
SOURCE=PROJECT.parent/'主题素材/海底冒险/textures/characters/hero/animations'
def read(p): return json.loads(p.read_text(encoding='utf-8-sig'))
def write(p,v): p.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def identity(p,template):
    meta=Path(str(p)+'.meta'); value=copy.deepcopy(template)
    value['uuid']=read(meta)['uuid'] if meta.exists() else str(uuid.uuid4())
    return meta,value
def directory(p):
    if p==ASSETS:return
    directory(p.parent);p.mkdir(exist_ok=True)
    m=Path(str(p)+'.meta')
    if not m.exists():write(m,dict(ver='1.2.0',importer='directory',imported=True,uuid=str(uuid.uuid4()),files=[],subMetas={},userData={}))
def track_first(clip,prop):
    for t in clip[0]['_tracks']:
        v=clip[t['__id__']];binding=v.get('_binding',{});track_path=binding.get('path',{}).get('__id__')
        if track_path is not None and clip[track_path].get('_paths')==[prop]:
            return [clip[clip[c['__id__']]['_curve']['__id__']]['_values'][0]['value'] for c in v['_channels'][:3]]
    raise ValueError('Missing transform '+prop)
def bbox(p):return Image.open(p).convert('RGBA').getchannel('A').point(lambda a:255 if a>=128 else 0).getbbox()
warning=ASSETS/'resources/gameplay/boss/warning'
dest=ASSETS/'resources/gameplay/hero/spine-walk';directory(dest)
forms_path=ASSETS/'resources/gameplay/hero/forms.json';forms=read(forms_path)
scene_path=ASSETS/'scenes/Main.scene';scene=read(scene_path)
evolution=next(o for o in scene if 'themeIdleClips' in o)
refs=[]
for stage in range(1,5):
    name=f'hero-stage-{stage:02d}';rig=SOURCE/f'stage-{stage:02d}/walk-rig'
    for suffix in ['.png','.atlas','.json']:shutil.copy2(rig/(name+suffix),dest/(name+suffix))
    atlas_meta,atlas=identity(dest/(name+'.atlas'),read(warning/'ANIboss.atlas.meta'));write(atlas_meta,atlas)
    image_meta,image=identity(dest/(name+'.png'),read(warning/'ANIboss.png.meta'));image_id=image['uuid'];w,h=Image.open(dest/(name+'.png')).size
    for subid,sub in image['subMetas'].items():
        sub['uuid']=image_id+'@'+subid;sub['displayName']=name
        data=sub['userData']
        if subid=='6c48a':data['imageUuidOrDatabaseUri']=image_id
        else:
            data.update(width=w,height=h,rawWidth=w,rawHeight=h,trimType='none',trimX=0,trimY=0,rotated=False,imageUuidOrDatabaseUri=image_id+'@6c48a')
            data['vertices']=dict(rawPosition=[-w/2,-h/2,0,w/2,-h/2,0,-w/2,h/2,0,w/2,h/2,0],indexes=[0,1,2,2,1,3],uv=[0,h,w,h,0,0,w,0],nuv=[0,0,1,0,0,1,1,1],minPos=[-w/2,-h/2,0],maxPos=[w/2,h/2,0])
    image['userData']['redirect']=image_id+'@6c48a';write(image_meta,image)
    json_meta,data=identity(dest/(name+'.json'),read(warning/'ANIboss.json.meta'));data['userData']['atlasUuid']=atlas['uuid'];write(json_meta,data)
    refs.append(dict(__uuid__=data['uuid'],__expectedType__='sp.SkeletonData'))
    idle=ASSETS/f'textures/characters/sea-hero/animations/stage-{stage:02d}/idle/idle-01.png'
    clip_path=ASSETS/'animations/HeroIdle.anim' if stage==1 else ASSETS/f'resources/gameplay/hero/theme-animations/HeroStage{stage:02d}Idle.anim'
    clip=read(clip_path);position=track_first(clip,'position');scale=track_first(clip,'scale')[1];idle_box=bbox(idle);idle_height=Image.open(idle).height
    walk_boxes=[bbox(p) for p in (SOURCE/f'stage-{stage:02d}/walk').glob('walk-??.png')]
    walk_top=min(b[1] for b in walk_boxes);walk_bottom=max(b[3] for b in walk_boxes)
    target_height=(idle_box[3]-idle_box[1])*scale;walk_scale=target_height/(walk_bottom-walk_top)
    foot_y=position[1]+(idle_height/2-idle_box[3])*scale
    # The Spine origin is canvas (160,288), at the foot line rather than canvas center.
    settings=dict(scale=walk_scale,x=position[0],y=foot_y-(288-walk_bottom)*walk_scale)
    forms['forms'][stage-1]['themeVisual']['walkSpine']=settings
    print(name,'display calibration',settings,'height',target_height)
evolution['themeWalkSkeletons']=refs
for key,action in [('themeIdleClips','Idle'),('themeRunClips','Walk'),('themeAttackClips','Attack')]:
    paths=[ASSETS/f'animations/Hero{action}.anim']+[ASSETS/f'resources/gameplay/hero/theme-animations/HeroStage{stage:02d}{action}.anim' for stage in range(2,5)]
    evolution[key]=[dict(__uuid__=read(Path(str(p)+'.meta'))['uuid'],__expectedType__='cc.AnimationClip') for p in paths]
write(forms_path,forms);write(scene_path,scene)
print('Imported four Spine skeletons, linked Main.scene, calibrated idle/walk height and foot line.')
