"""Import the selected ambience as a separate looping Cocos AudioSource."""
import copy
import hashlib
import json
import shutil
import uuid
from pathlib import Path

PROJECT = Path(__file__).resolve().parents[1]
THEME = PROJECT.parent / '主题素材/海底冒险'
SOURCE = THEME / 'audio/ambience/amb-undersea-bubbles-loop.mp3'
DEST = PROJECT / 'assets/audio/ambience' / SOURCE.name

def read(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))

def write(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

DEST.parent.mkdir(exist_ok=True)
directory_meta = Path(str(DEST.parent) + '.meta')
if not directory_meta.exists():
    meta = read(PROJECT / 'assets/audio/music.meta')
    meta['uuid'] = str(uuid.uuid4())
    write(directory_meta, meta)
shutil.copy2(SOURCE, DEST)
asset_meta = Path(str(DEST) + '.meta')
if not asset_meta.exists():
    meta = read(PROJECT / 'assets/audio/music/bgm-undersea-game-loop.mp3.meta')
    meta['uuid'] = str(uuid.uuid4())
    write(asset_meta, meta)
clip_uuid = read(asset_meta)['uuid']

scene_path = PROJECT / 'assets/scenes/Main.scene'
scene = read(scene_path)
music_node = next(o for o in scene if o.get('__type__') == 'cc.Node' and o.get('_name') == 'BackgroundMusic')
ambience = next((o for o in scene if o.get('__type__') == 'cc.Node' and o.get('_name') == 'BackgroundAmbience'), None)
if ambience is None:
    node_id = len(scene)
    ambience = copy.deepcopy(music_node)
    ambience.update(_name='BackgroundAmbience', _components=[{'__id__': node_id + 1}], _id=str(uuid.uuid4()))
    audio = copy.deepcopy(scene[music_node['_components'][0]['__id__']])
    audio.update(node={'__id__': node_id}, _id=str(uuid.uuid4()))
    scene.extend([ambience, audio])
    scene[music_node['_parent']['__id__']]['_children'].append({'__id__': node_id})
audio = scene[ambience['_components'][0]['__id__']]
managed_playback = any(o.get('backgroundMusic') and o.get('bossMusic') and o.get('ambience') for o in scene)
audio.update(_clip={'__uuid__': clip_uuid, '__expectedType__': 'cc.AudioClip'},
             _enabled=True, _loop=True, _playOnAwake=not managed_playback, _volume=.15)
write(scene_path, scene)

index_path = THEME / '素材索引.json'
index = read(index_path)
entry = next(a for a in index['assets'] if a.get('path') == 'audio/ambience/' + SOURCE.name)
entry.update(status='已接入独立环境音 AudioSource，音量15%，与30%背景音乐叠加循环播放',
             projectPath='UnderseaAdventure/assets/audio/ambience/' + SOURCE.name,
             sha256=hashlib.sha256(SOURCE.read_bytes()).hexdigest().upper())
write(index_path, index)

assert SOURCE.read_bytes() == DEST.read_bytes()
assert audio['_loop'] and audio['_playOnAwake'] == (not managed_playback) and audio['_volume'] == .15
music = scene[music_node['_components'][0]['__id__']]
assert music['_volume'] == .3 and music['_loop']
print(json.dumps({'ambienceVolume': audio['_volume'], 'musicVolume': music['_volume'],
                  'loop': audio['_loop'], 'sourceCopyIdentical': True}))
