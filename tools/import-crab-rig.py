"""Import the approved crab rig and link Enemy.prefab, preserving asset UUIDs."""
from pathlib import Path
import importlib.util, json, shutil, sys
sys.dont_write_bytecode=True
ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT.parent/'主题素材/海底冒险/textures/characters/enemies/animations/crab/skeleton-rig'
DEST=ROOT/'assets/resources/gameplay/enemies/crab-rig'
spec=importlib.util.spec_from_file_location('rig',ROOT/'tools/build-hero-stage01-rig.py')
rig=importlib.util.module_from_spec(spec);spec.loader.exec_module(rig)
rig.directory(DEST)
template=ROOT/'assets/resources/gameplay/hero/stage04-rig'
name='enemy-crab'
for suffix in ('.json','.atlas','.png'):shutil.copy2(SOURCE/(name+suffix),DEST/(name+suffix))
m,atlas=rig.meta(DEST/(name+'.atlas'),rig.read(template/'hero-stage-04.atlas.meta'));rig.write(m,atlas)
m,image=rig.meta(DEST/(name+'.png'),rig.read(template/'hero-stage-04.png.meta'))
for key,sub in image['subMetas'].items():
    sub['uuid']=image['uuid']+'@'+key;sub['displayName']=name
    sub['userData']['imageUuidOrDatabaseUri']=image['uuid'] if key=='6c48a' else image['uuid']+'@6c48a'
image['userData']['redirect']=image['uuid']+'@6c48a';rig.write(m,image)
m,data=rig.meta(DEST/(name+'.json'),rig.read(template/'hero-stage-04.json.meta'))
data['userData']['atlasUuid']=atlas['uuid'];rig.write(m,data)
prefabPath=ROOT/'assets/prefabs/Enemy.prefab';prefab=rig.read(prefabPath)
controller=next(o for o in prefab if 'attackInterval' in o and 'hurtWidth' in o)
controller['crabSkeleton']={'__uuid__':data['uuid'],'__expectedType__':'sp.SkeletonData'}
controller['hitTime']=.28
for key in ('idleClip','walkClip','attackClip','deathClip'):controller[key]=None
for obj in prefab:
    if obj.get('__type__')=='cc.Animation':
        obj['_clips']=[];obj['_defaultClip']=None;obj['playOnLoad']=False;obj['_enabled']=False
rig.write(prefabPath,prefab)
print(json.dumps({'imported':str(DEST),'uuid':data['uuid'],'hitTime':.28}))
