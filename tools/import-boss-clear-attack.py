"""Replace only the 24 Boss melee attack frames, retaining UUIDs and combat timing."""
from pathlib import Path
import json
from PIL import Image
HERE=Path(__file__).resolve().parent
helper=HERE/'import-undersea-animations.py'
ns={'__file__':str(helper),'__name__':'boss_attack_helpers'}
exec(helper.read_text(encoding='utf-8').split('script_meta =')[0],ns)
ASSETS=ns['ASSETS'];read=ns['read'];write=ns['write'];bbox=ns['bbox'];clip=ns['clip'];import_frame=ns['import_frame']
source=ASSETS.parent.parent/'主题素材/海底冒险/textures/characters/boss/animations/attack'
dest=ASSETS/'textures/characters/boss/animations/attack'
clip_path=ASSETS/'animations/SeaOctopusAttack.anim'
old=read(clip_path)
def transform(data,prop):
    for ref in data[0]['_tracks']:
        t=data[ref['__id__']];bid=t.get('_binding',{}).get('path',{}).get('__id__')
        if bid is not None and data[bid].get('_paths')==[prop]:
            return [data[data[ch['__id__']]['_curve']['__id__']]['_values'][0]['value'] for ch in t['_channels'][:3]]
    raise ValueError(prop)
old_position=transform(old,'position');old_scale=transform(old,'scale')
first=dest/'attack-01.png';b=bbox(first);w,h=Image.open(first).size
target_height=(b[3]-b[1])*old_scale[1]
foot=old_position[1]+(h/2-b[3])*old_scale[1]
axis=old_position[0]+((b[0]+b[2])/2-w/2)*old_scale[0]
b=bbox(source/'attack-01.png');scale=target_height/(b[3]-b[1]);position=[axis-( (b[0]+b[2])/2-256)*scale,foot-(256-b[3])*scale,old_position[2]]
refs=[import_frame(source/f'attack-{i:02d}.png',dest/f'attack-{i:02d}.png') for i in range(1,25)]
clip(clip_path,old[0]['_name'],refs,old[0]['sample'],False,[position]*24,[[scale,scale,old_scale[2]]]*24)
new=read(clip_path);new[0]['speed']=old[0]['speed'];new[0]['_duration']=old[0]['_duration'];write(clip_path,new)
print(json.dumps({'frames':24,'canvas':512,'duration':new[0]['_duration'],'sample':new[0]['sample'],'scale':scale,'position':position}))
