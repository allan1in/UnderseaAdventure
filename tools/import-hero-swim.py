"""Replace hero art with the approved shared swim loop and draw/slash/sheath attack."""
from pathlib import Path
import json, shutil
from PIL import Image
HERE=Path(__file__).resolve().parent
helper=HERE/'import-undersea-animations.py'
ns={'__file__':str(helper),'__name__':'hero_swim_helpers'}
exec(helper.read_text(encoding='utf-8').split('script_meta =')[0],ns)
ASSETS=ns['ASSETS'];PROJECT=ns['PROJECT'];read=ns['read'];write=ns['write'];import_frame=ns['import_frame'];clip=ns['clip'];bbox=ns['bbox']
SOURCE=PROJECT.parent/'主题素材/海底冒险/textures/characters/hero/animations'
forms_path=ASSETS/'resources/gameplay/hero/forms.json';forms=read(forms_path)
scene_path=ASSETS/'scenes/Main.scene';scene=read(scene_path)
evolution=next(o for o in scene if 'themeIdleClips' in o);evolution.pop('themeWalkSkeletons',None)
idle_clips=[];attack_clips=[];first_frames=[]
ATTACK_TIMES=[0,.01,.02,.03,.045,.06,.075,.09,.105,.125,.145,.165,.185,.205,.225,.245,.27,.295,.32,.345,.37,.395,.42,.45]
ATTACK_DURATION=.48
def first_transform(objects,prop):
    for ref in objects[0]['_tracks']:
        track=objects[ref['__id__']];tid=track.get('_binding',{}).get('path',{}).get('__id__')
        if tid is not None and objects[tid].get('_paths')==[prop]:return [objects[objects[ch['__id__']]['_curve']['__id__']]['_values'][0]['value'] for ch in track['_channels'][:3]]
    raise ValueError(prop)
for stage in range(1,5):
    sid=f'{stage:02d}';source=SOURCE/f'stage-{sid}';dest=ASSETS/f'textures/characters/sea-hero/animations/stage-{sid}'
    idle_path=ASSETS/'animations/HeroIdle.anim' if stage==1 else ASSETS/f'resources/gameplay/hero/theme-animations/HeroStage{sid}Idle.anim'
    old=read(idle_path);old_image=dest/'idle/idle-01.png';old_box=bbox(old_image);old_h=Image.open(old_image).height
    old_scale=first_transform(old,'scale')[1];old_position=first_transform(old,'position')
    target_height=(old_box[3]-old_box[1])*old_scale
    old_foot=old_position[1]+(old_h/2-old_box[3])*old_scale
    swim_files=[source/f'swim/swim-{i:02d}.png' for i in range(1,25)];attack_files=[source/f'attack/attack-{i:02d}.png' for i in range(1,25)]
    box=bbox(swim_files[0]);scale=target_height/(box[3]-box[1]);offset=[(192-(box[0]+box[2])/2)*scale,old_foot-(192-box[3])*scale]
    refs=[import_frame(p,dest/'swim'/p.name) for p in swim_files];attack_refs=[import_frame(p,dest/'attack'/p.name) for p in attack_files]
    for alias in ['idle','run']:
        for i,p in enumerate(swim_files):import_frame(p,dest/alias/f'{alias}-{i+1:02d}.png')
    # Keep the original static path/UUID while replacing its standing artwork.
    import_frame(swim_files[0],ASSETS/f'textures/characters/sea-hero/hero-stage-{sid}.png')
    position=[[*offset,0]]*24;scales=[[scale,scale,1]]*24
    name='HeroIdle' if stage==1 else f'HeroStage{sid}Idle';idle_clips.append(clip(idle_path,name,refs,24,True,position,scales));first_frames.append(refs[0])
    walk_path=ASSETS/'animations/HeroWalk.anim' if stage==1 else ASSETS/f'resources/gameplay/hero/theme-animations/HeroStage{sid}Walk.anim'
    clip(walk_path,'HeroWalk' if stage==1 else f'HeroStage{sid}Walk',refs,24,True,position,scales)
    attack_path=ASSETS/'animations/HeroAttack.anim' if stage==1 else ASSETS/f'resources/gameplay/hero/theme-animations/HeroStage{sid}Attack.anim'
    attack_clips.append(clip(attack_path,'HeroAttack' if stage==1 else f'HeroStage{sid}Attack',attack_refs,24,False,position,scales))
    attack_data=read(attack_path)
    attack_data[0]['_duration']=ATTACK_DURATION
    for obj in attack_data:
        if len(obj.get('_times',[]))==24:obj['_times']=ATTACK_TIMES
    write(attack_path,attack_data)
    forms['forms'][stage-1]['attack']['hitProgress']=.205/ATTACK_DURATION
    settings=forms['forms'][stage-1]['themeVisual'];settings.pop('walkSpine',None);settings.update(swim=True,scale=scale,offsets=[offset]*3,animation=dict(scale=scale,offsets=[offset]*3))
    print('stage',stage,'192 unique source frames total; shared loop scale',round(scale,4),'offset',offset)
evolution.update(themeIdleClips=idle_clips,themeRunClips=idle_clips,themeAttackClips=attack_clips,themeFrames=first_frames,stageOneIdleClip=idle_clips[0],stageOneRunClip=idle_clips[0],stageOneAttackClip=attack_clips[0],stageOneIdleFrame=first_frames[0])
hero=next(o for o in scene if 'attackMaxTargets' in o and 'walkClip' in o);hero.update(walkClip=idle_clips[0],attackClip=attack_clips[0],swimActions=True)
visual_id=next(i for i,o in enumerate(scene) if o.get('_name')=='Hero')
visual_id=next(ref['__id__'] for ref in scene[visual_id]['_children'] if scene[ref['__id__']].get('_name')=='Visual')
sprite_id=next(ref['__id__'] for ref in scene[visual_id]['_children'] if scene[ref['__id__']].get('_name')=='Sprite')
for ref in scene[sprite_id]['_components']:
    comp=scene[ref['__id__']]
    if comp['__type__']=='cc.Animation':comp.update(_clips=[idle_clips[0],attack_clips[0]],_defaultClip=idle_clips[0],playOnLoad=False)
    if comp['__type__']=='cc.Sprite':comp['_spriteFrame']=first_frames[0]
scene[sprite_id]['_lpos'].update(x=forms['forms'][0]['themeVisual']['animation']['offsets'][0][0],y=forms['forms'][0]['themeVisual']['animation']['offsets'][0][1])
scale=forms['forms'][0]['themeVisual']['animation']['scale'];scene[sprite_id]['_lscale'].update(x=scale,y=scale)
write(forms_path,forms);write(scene_path,scene)
print('Saved shared idle/move references, attack clips, static hero poses and scene bindings.')
