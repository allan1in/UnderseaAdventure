"""Import boss music and wire the gesture-started music controller into Main."""
import base64
import copy
import hashlib
import json
import shutil
import uuid
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
THEME=ROOT.parent/'主题素材/海底冒险'
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def write(p,data):p.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def uid():return str(uuid.uuid4())
source=THEME/'audio/music/bgm-boss-battle.mp3'
dest=ROOT/'assets/audio/music'/source.name
shutil.copy2(source,dest)
meta=Path(str(dest)+'.meta')
if not meta.exists():
    m=read(ROOT/'assets/audio/music/bgm-undersea-game-loop.mp3.meta');m['uuid']=uid();write(meta,m)
script=ROOT/'assets/scripts/MusicDirector.ts.meta'
if not script.exists():
    m=read(ROOT/'assets/scripts/SoundEffects.ts.meta');m['uuid']=uid();write(script,m)
h=read(script)['uuid'].replace('-','');kind=h[:5]+base64.b64encode(bytes.fromhex(h[5:]+'0')).decode()[:18]
scene_path=ROOT/'assets/scenes/Main.scene';scene=read(scene_path)
canvas_id=next(i for i,o in enumerate(scene) if o.get('__type__')=='cc.Node' and o.get('_name')=='Canvas')
hero_id=next(i for i,o in enumerate(scene) if o.get('__type__')=='cc.Node' and o.get('_name')=='Hero')
def audio(name):
    node=next(o for o in scene if o.get('__type__')=='cc.Node' and o.get('_name')==name)
    index=node['_components'][0]['__id__'];return index,scene[index]
normal_id,normal=audio('BackgroundMusic');ambience_id,ambience=audio('BackgroundAmbience')
boss_node=next((o for o in scene if o.get('__type__')=='cc.Node' and o.get('_name')=='BossMusic'),None)
if boss_node is None:
    node_id=len(scene)
    boss_node=copy.deepcopy(scene[normal['node']['__id__']])
    boss_node.update(_name='BossMusic',_components=[{'__id__':node_id+1}],_id=uid())
    boss=copy.deepcopy(normal);boss.update(node={'__id__':node_id},_id=uid())
    scene.extend([boss_node,boss]);scene[canvas_id]['_children'].append({'__id__':node_id})
boss_id,boss=audio('BossMusic');boss['_clip']={'__uuid__':read(meta)['uuid'],'__expectedType__':'cc.AudioClip'}
boss['_volume']=normal['_volume']
for item in [normal,ambience,boss]:item.update(_loop=True,_playOnAwake=False)
controller=next((o for o in scene if o.get('__type__')==kind),None)
if controller is None:
    index=len(scene)
    controller=dict(__type__=kind,_name='',_objFlags=0,__editorExtras__={},node={'__id__':canvas_id},_enabled=True,__prefab=None,_id=uid())
    scene.append(controller);scene[canvas_id]['_components'].append({'__id__':index})
controller.update(hero={'__id__':hero_id},backgroundMusic={'__id__':normal_id},bossMusic={'__id__':boss_id},ambience={'__id__':ambience_id})
write(scene_path,scene)
index_path=THEME/'素材索引.json';data=read(index_path)
entry=next((a for a in data['assets'] if a.get('path')=='audio/music/'+source.name),None)
if entry is None:entry={};data['assets'].append(entry)
entry.update(name=source.name,path='audio/music/'+source.name,category='audio/music',
    status='Boss 战期间循环播放，30%音量；击败Boss后恢复原背景音乐，冒泡15%持续循环',
    projectPath='UnderseaAdventure/assets/audio/music/'+source.name,sha256=hashlib.sha256(source.read_bytes()).hexdigest().upper())
write(index_path,data)
assert dest.read_bytes()==source.read_bytes()
print(json.dumps(dict(musicVolume=normal['_volume'],bossVolume=boss['_volume'],ambienceVolume=ambience['_volume'],loop=True,gestureStart=True)))
