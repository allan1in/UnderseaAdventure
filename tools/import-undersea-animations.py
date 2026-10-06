"""Import existing PNG frames and serialize editable Cocos animation clips.

PNG artwork is copied unchanged. Run transforms stabilize canvas drift; the
forward/backward run cycle avoids jumping directly from frame 24 to frame 1.
Run with the bundled Python runtime (Pillow and numpy).
"""
from pathlib import Path
import base64
import copy
import json
import re
import shutil
import statistics
import runpy
import uuid
from PIL import Image

PROJECT = Path(__file__).resolve().parents[1]
ASSETS = PROJECT / 'assets'
SOURCE = PROJECT.parent / '主题素材/海底冒险/textures/characters'

def read(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))

def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

def uid():
    return str(uuid.uuid4())

def compressed(value):
    h = value.replace('-', '')
    return h[:5] + base64.b64encode(bytes.fromhex(h[5:] + '0')).decode()[:18]

def directory(path):
    if path == ASSETS or not path.is_relative_to(ASSETS):
        return
    directory(path.parent)
    path.mkdir(exist_ok=True)
    meta = Path(str(path) + '.meta')
    if not meta.exists():
        write(meta, dict(ver='1.2.0', importer='directory', imported=True, uuid=uid(), files=[], subMetas={}, userData={}))

IMAGE_TEMPLATE = read(ASSETS / 'textures/characters/sea-hero/animations/stage-01/run/run-01.png.meta')
CLIP_TEMPLATE = read(ASSETS / 'animations/HeroWalk.anim')[:7]
CLIP_META = read(ASSETS / 'animations/HeroWalk.anim.meta')

def import_frame(source, dest):
    directory(dest.parent)
    shutil.copy2(source, dest)
    meta_path = Path(str(dest) + '.meta')
    image_id = read(meta_path)['uuid'] if meta_path.exists() else uid()
    m = copy.deepcopy(IMAGE_TEMPLATE)
    m['uuid'] = image_id
    w, h = Image.open(dest).size
    t = m['subMetas']['6c48a']
    t['uuid'] = image_id + '@6c48a'
    t['displayName'] = dest.stem
    t['userData']['imageUuidOrDatabaseUri'] = image_id
    s = m['subMetas']['f9941']
    s['uuid'] = image_id + '@f9941'
    s['displayName'] = dest.stem
    d = s['userData']
    d.update(width=w, height=h, rawWidth=w, rawHeight=h, imageUuidOrDatabaseUri=image_id+'@6c48a')
    d['vertices'] = dict(rawPosition=[-w/2,-h/2,0,w/2,-h/2,0,-w/2,h/2,0,w/2,h/2,0],
        indexes=[0,1,2,2,1,3], uv=[0,h,w,h,0,0,w,0], nuv=[0,0,1,0,0,1,1,1],
        minPos=[-w/2,-h/2,0], maxPos=[w/2,h/2,0])
    m['userData']['redirect'] = image_id + '@6c48a'
    write(meta_path, m)
    return dict(__uuid__=image_id+'@f9941', __expectedType__='cc.SpriteFrame')

def vector_track(objects, prop, values, times):
    track_id = len(objects)
    objects.append(dict(__type__='cc.animation.VectorTrack', _nComponents=3, _channels=[],
        _binding=dict(__type__='cc.animation.TrackBinding', path={'__id__':track_id+1}, proxy=None)))
    objects.append(dict(__type__='cc.animation.TrackPath', _paths=[prop]))
    for axis in range(4):
        channel_id = len(objects)
        objects[track_id]['_channels'].append({'__id__':channel_id})
        objects.append(dict(__type__='cc.animation.Channel', _curve={'__id__':channel_id+1}))
        objects.append(dict(__type__='cc.RealCurve', _times=times if axis<3 else [],
            _values=[dict(__type__='cc.RealKeyframeValue',value=v[axis],interpolationMode=1,
                tangentWeightMode=0,rightTangent=0,rightTangentWeight=0,leftTangent=0,
                leftTangentWeight=0,easingMethod=0) for v in values] if axis<3 else [],
            preExtrapolation=1, postExtrapolation=1))
    objects[0]['_tracks'].append({'__id__':track_id})

def clip(path, name, refs, fps, loop, position=None, scale=None):
    directory(path.parent)
    objects = copy.deepcopy(CLIP_TEMPLATE)
    objects[0].update(_name=name, sample=fps, speed=1, wrapMode=2 if loop else 1,
        _duration=len(refs)/fps, _tracks=[{'__id__':1}], _hash=0)
    times = [i/fps for i in range(len(refs))]
    objects[5].update(_times=times, _values=refs)
    if position is not None:
        vector_track(objects, 'position', position, times)
        vector_track(objects, 'scale', scale, times)
    write(path, objects)
    meta_path = Path(str(path)+'.meta')
    meta = read(meta_path) if meta_path.exists() else copy.deepcopy(CLIP_META)
    if not meta_path.exists(): meta['uuid'] = uid()
    meta['userData']['name'] = name
    write(meta_path, meta)
    return dict(__uuid__=meta['uuid'], __expectedType__='cc.AnimationClip')

def bbox(path):
    return Image.open(path).convert('RGBA').getchannel('A').point(lambda a:255 if a>=128 else 0).getbbox()

def component(objects, node_id, kind, **fields):
    index = len(objects)
    prefab = objects[0].get('__type__') == 'cc.Prefab'
    value = dict(__type__=kind, _name='', _objFlags=0, __editorExtras__={}, node={'__id__':node_id},
        _enabled=True, __prefab={'__id__':index+1} if prefab else None, _id='', **fields)
    objects.append(value)
    if prefab: objects.append(dict(__type__='cc.CompPrefabInfo',fileId=uid()))
    objects[node_id]['_components'].append({'__id__':index})
    return index

def comp(objects, node_id, kind):
    return next(objects[r['__id__']] for r in objects[node_id]['_components'] if objects[r['__id__']]['__type__']==kind)

script_meta = ASSETS / 'scripts/CharacterAnimation.ts.meta'
if not script_meta.exists():
    write(script_meta, dict(ver='4.0.24',importer='typescript',imported=True,uuid=uid(),files=[],subMetas={},userData={}))
ANIMATOR_TYPE = compressed(read(script_meta)['uuid'])
STATIC_HEIGHTS = dict(Crab=146.76202860858257, Octopus=385.45081967213116,
    Shark=162.98165, Turtle=148.11024, Seahorse=120.68744, Jellyfish=131.12167)

characters = [
    ('Crab', SOURCE/'enemies/animations/crab', ASSETS/'textures/characters/enemies/animations/crab','Enemy'),
    ('Octopus',SOURCE/'boss/animations',ASSETS/'textures/characters/boss/animations','Boss'),
    ('Shark', SOURCE/'partners/animations/shark',ASSETS/'textures/characters/partners/animations/shark','PetBlueDragon'),
    ('Turtle',SOURCE/'partners/animations/turtle',ASSETS/'textures/characters/partners/animations/turtle','PetFox'),
    ('Seahorse',SOURCE/'partners/animations/seahorse',ASSETS/'textures/characters/partners/animations/seahorse','PetRedDragon'),
    ('Jellyfish',SOURCE/'partners/animations/jellyfish',ASSETS/'textures/characters/partners/animations/jellyfish','PetWhiteTiger'),
]
count = 0
for name, source, dest, prefab_name in characters:
    refs, paths, clips = {}, {}, {}
    for action in ['idle','move','attack']:
        source_action = 'swim' if name=='Shark' and action=='move' else action
        files = sorted(p for p in (source/source_action).glob('*.png') if re.fullmatch(source_action+r'-\d{2}',p.stem))
        assert len(files)==24, (name,action,len(files))
        paths[action] = [dest/action/(action+f'-{i+1:02d}.png') for i in range(24)]
        refs[action] = [import_frame(f,d) for f,d in zip(files,paths[action])]
        count += len(files)
        # Keep existing crab clip identities; saved prefab references remain valid.
        clip_name = 'SeaCrabWalk' if name=='Crab' and action=='move' else 'Sea'+name+action.title()
        clips[action] = clip(ASSETS/'animations'/f'{clip_name}.anim',clip_name,refs[action],10 if action=='idle' else 16,action!='attack')
    path = ASSETS/'prefabs'/f'{prefab_name}.prefab'
    objects = read(path)
    sprite_node = 1 if name=='Crab' else next(i for i,o in enumerate(objects) if o.get('__type__')=='cc.Node' and o.get('_name')=='Sprite')
    sprite, transform = comp(objects,sprite_node,'cc.Sprite'),comp(objects,sprite_node,'cc.UITransform')
    static_root = ASSETS/'textures/undersea/characters'
    static_file = static_root/'enemies/enemy-crab.png' if name=='Crab' else static_root/'boss/boss-octopus.png' if name=='Octopus' else static_root/'partners'/f'pet-{name.lower()}.png'
    old_bbox = bbox(static_file)
    old_w, old_h = Image.open(static_file).size
    old_height = STATIC_HEIGHTS[name]
    target_height = (old_bbox[3]-old_bbox[1])*old_height/old_h
    old_bottom = (old_h/2-old_bbox[3])*old_height/old_h
    boxes = [bbox(f) for files in paths.values() for f in files]
    union = (min(b[0] for b in boxes),min(b[1] for b in boxes),max(b[2] for b in boxes),max(b[3] for b in boxes))
    w,h = Image.open(paths['idle'][0]).size
    size_scale = target_height/(union[3]-union[1])
    transform['_contentSize'].update(width=w*size_scale,height=h*size_scale)
    sprite['_spriteFrame'] = refs['idle'][0]
    sprite['_sizeMode'] = 0
    sprite['_isTrimmedMode'] = False
    if name!='Crab':
        objects[sprite_node]['_lpos'].update(x=(w/2-(union[0]+union[2])/2)*size_scale,
            y=old_bottom+(union[3]-h/2)*size_scale)
        root_size = comp(objects,1,'cc.UITransform')['_contentSize']
        root_size.update(width=w*size_scale,height=h*size_scale)
    if name=='Crab':
        animation = comp(objects,1,'cc.Animation')
        controller = next(o for o in objects if 'walkClip' in o)
        controller.update(idleClip=clips['idle'],walkClip=clips['move'],attackClip=clips['attack'],
            preserveAttackSize=True,hitTime=.9,deathVisualSize=old_height)
        animation.update(_clips=[*clips.values(),controller['deathClip']],_defaultClip=clips['idle'],playOnLoad=False)
    else:
        animation_id = next((i for i,o in enumerate(objects) if o.get('__type__')=='cc.Animation' and o.get('node')=={'__id__':sprite_node}),None)
        if animation_id is None: animation_id=component(objects,sprite_node,'cc.Animation')
        objects[animation_id].update(_clips=list(clips.values()),_defaultClip=clips['idle'],playOnLoad=False)
        existing = next((o for o in objects if o.get('__type__','').startswith(ANIMATOR_TYPE[:5])),None)
        if existing is None:
            existing=objects[component(objects,1,ANIMATOR_TYPE)]
        existing.update(animation={'__id__':animation_id},idleClip=clips['idle'],moveClip=clips['move'],attackClip=clips['attack'])
        existing['__type__']=ANIMATOR_TYPE
        if name=='Octopus':
            next(o for o in objects if 'themeFrame' in o)['themeFrame'] = None
    write(path,objects)
    print(name,'72 frames, 3 clips; display scale',round(size_scale,4))

# Hero frame artwork stays intact. Serialize correction into native animation tracks.
forms = read(ASSETS/'resources/gameplay/hero/forms.json')
form_list = forms if isinstance(forms,list) else forms['forms']
for stage,form in enumerate(form_list,1):
    folder=ASSETS/'textures/characters/sea-hero/animations'/f'stage-{stage:02d}'
    settings=form['themeVisual']['animation']
    base_scale=settings['scale']
    offsets=settings['offsets']
    run_files=sorted((folder/'run').glob('run-*.png'))
    boxes=[bbox(f) for f in run_files]
    median_top=statistics.median(b[1] for b in boxes)
    median_center=statistics.median((b[0]+b[2])/2 for b in boxes)
    median_height=statistics.median(b[3]-b[1] for b in boxes)
    w,h=Image.open(run_files[0]).size
    for action,clip_action,offset in [('idle','Idle',offsets[0]),('run','Walk',offsets[1]),('attack','Attack',offsets[2])]:
        files=sorted((folder/action).glob(action+'-*.png'))
        assert len(files)==24
        frame_refs=[dict(__uuid__=read(Path(str(f)+'.meta'))['uuid']+'@f9941',__expectedType__='cc.SpriteFrame') for f in files]
        order=list(range(24)) + list(range(22,0,-1)) if action=='run' else list(range(24))
        positions,scales=[],[]
        for i in order:
            s=base_scale
            x,y=offset
            if action=='run':
                b=boxes[i]
                s*=max(.85,min(1.15,median_height/(b[3]-b[1])))
                x+=(median_center-w/2)*base_scale-((b[0]+b[2])/2-w/2)*s
                y+=(h/2-median_top)*base_scale-(h/2-b[1])*s
            positions.append([x,y,0]);scales.append([s,s,1])
        clip_name='Hero'+clip_action if stage==1 else f'HeroStage{stage:02d}'+clip_action
        path=ASSETS/'animations'/f'{clip_name}.anim' if stage==1 else ASSETS/'resources/gameplay/hero/theme-animations'/f'{clip_name}.anim'
        clip(path,clip_name,[frame_refs[i] for i in order],10 if action=='idle' else 16,action!='attack',positions,scales)
    print('Hero stage',stage,'run position and scale stabilized; 46-key round-trip loop')

# Persist the summoning body's component so it is editable in Creator too.
scene_path=ASSETS/'scenes/Main.scene'
scene=read(scene_path)
system=next(o for o in scene if 'lampView' in o)
station_id=system['lampView']['__id__']
body_type=compressed(read(ASSETS/'scripts/CircleBody2D.ts.meta')['uuid'])
body=next((scene[r['__id__']] for r in scene[station_id]['_components'] if scene[r['__id__']]['__type__'].startswith(body_type[:5])),None)
if body is None:body=scene[component(scene,station_id,body_type)]
body.update(radius=85,verticalRadius=35,offsetY=35,collisionGroup=3,collisionMask=3)
body['__type__']=body_type
system['collisionRadius']=85
system.update(collisionRadiusY=35,collisionOffsetY=35)
write(scene_path,scene)
print('Imported',count,'PNG frames; station radius 85 saved in Main.scene')

# Reapply the final timing and body calibration after every future reimport.
runpy.run_path(str(Path(__file__).with_name('polish-animation-clips.py')), run_name='__main__')
