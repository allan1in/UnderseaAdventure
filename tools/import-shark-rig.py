"""Import the approved shark rig and link PetBlueDragon.prefab, preserving asset UUIDs."""
from pathlib import Path
import importlib.util, json, shutil, sys
sys.dont_write_bytecode=True
ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT.parent/'主题素材/海底冒险/textures/characters/partners/animations/shark/parts-rig'
DEST=ROOT/'assets/resources/gameplay/pets/shark-rig'
spec=importlib.util.spec_from_file_location('rig',ROOT/'tools/build-hero-stage01-rig.py')
rig=importlib.util.module_from_spec(spec);spec.loader.exec_module(rig)
rig.directory(DEST)
template=ROOT/'assets/resources/gameplay/hero/stage04-rig'
name='pet-shark'
for suffix in ('.json','.atlas','.png'):shutil.copy2(SOURCE/(name+suffix),DEST/(name+suffix))
m,atlas=rig.meta(DEST/(name+'.atlas'),rig.read(template/'hero-stage-04.atlas.meta'));rig.write(m,atlas)
m,image=rig.meta(DEST/(name+'.png'),rig.read(template/'hero-stage-04.png.meta'))
for key,sub in image['subMetas'].items():
    sub['uuid']=image['uuid']+'@'+key;sub['displayName']=name
    sub['userData']['imageUuidOrDatabaseUri']=image['uuid'] if key=='6c48a' else image['uuid']+'@6c48a'
image['subMetas']['f9941']['userData'].update(width=1024,height=1024,rawWidth=1024,rawHeight=1024)
image['userData']['redirect']=image['uuid']+'@6c48a';rig.write(m,image)
m,data=rig.meta(DEST/(name+'.json'),rig.read(template/'hero-stage-04.json.meta'))
data['userData']['atlasUuid']=atlas['uuid'];rig.write(m,data)
prefabPath=ROOT/'assets/resources/gameplay/deferred/PetBlueDragon.prefab';prefab=rig.read(prefabPath)
controller=next(o for o in prefab if 'idleRange' in o)
controller['petSkeleton']={'__uuid__':data['uuid'],'__expectedType__':'sp.SkeletonData'}
controller.update(skeletonScale=0.5576397147254566,skeletonOffsetX=12.546893581322774,skeletonOffsetY=-0.7188697818753218,skeletonCardSize=245.0,skeletonCardOffsetX=22.5,skeletonCardOffsetY=2.4399999999999977)
for obj in prefab:
    if obj.get('__type__')=='cc.Animation':
        obj['_clips']=[];obj['_defaultClip']=None;obj['playOnLoad']=False;obj['_enabled']=False
    if 'idleClip' in obj and 'moveClip' in obj:
        obj['_enabled']=False
        for key in ('idleClip','moveClip','attackClip'):obj[key]=None
rig.write(prefabPath,prefab)
print(json.dumps({'imported':str(DEST),'uuid':data['uuid']}))
