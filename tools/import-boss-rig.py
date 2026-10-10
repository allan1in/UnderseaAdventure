"""Import approved original-motion Boss assets without changing existing UUIDs."""
from pathlib import Path
import importlib.util,json,shutil,sys
sys.dont_write_bytecode=True
ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT.parent/'主题素材/海底冒险/textures/characters/boss/animations/skeleton-original-motion'
DEST=ROOT/'assets/resources/gameplay/boss/original-rig'
spec=importlib.util.spec_from_file_location('rig',ROOT/'tools/build-hero-stage01-rig.py');rig=importlib.util.module_from_spec(spec);spec.loader.exec_module(rig);rig.directory(DEST)
template=ROOT/'assets/resources/gameplay/hero/stage04-rig';name='boss-original-motion'
for suffix in ['.json','.atlas']:shutil.copy2(SOURCE/(name+suffix),DEST/(name+suffix))
m,atlas=rig.meta(DEST/(name+'.atlas'),rig.read(template/'hero-stage-04.atlas.meta'));rig.write(m,atlas)
for imageName in ['boss-original','boss-original-dead']:
    shutil.copy2(SOURCE/(imageName+'.png'),DEST/(imageName+'.png'))
    m,image=rig.meta(DEST/(imageName+'.png'),rig.read(template/'hero-stage-04.png.meta'))
    for key,sub in image['subMetas'].items():
        sub['uuid']=image['uuid']+'@'+key;sub['displayName']=imageName
        sub['userData']['imageUuidOrDatabaseUri']=image['uuid'] if key=='6c48a' else image['uuid']+'@6c48a'
        if key=='f9941':
            sub['userData'].update(width=320,height=320,rawWidth=320,rawHeight=320,trimX=0,trimY=0,trimType='none')
    image['userData']['redirect']=image['uuid']+'@6c48a';rig.write(m,image)
m,data=rig.meta(DEST/(name+'.json'),rig.read(template/'hero-stage-04.json.meta'));data['userData']['atlasUuid']=atlas['uuid'];rig.write(m,data)
prefabPath=ROOT/'assets/resources/gameplay/deferred/Boss.prefab';prefab=rig.read(prefabPath)
visual=next(o for o in prefab if 'picture' in o and 'visualScale' in o)
visual['bossSkeleton']={'__uuid__':data['uuid'],'__expectedType__':'sp.SkeletonData'}
for obj in prefab:
    if obj.get('__type__')=='cc.Animation':obj.update(_enabled=False,_clips=[],_defaultClip=None,playOnLoad=False)
    if 'moveClip' in obj and 'attackClip' in obj:
        obj.update(_enabled=False,idleClip=None,moveClip=None,attackClip=None)
rig.write(prefabPath,prefab)
print(json.dumps(dict(imported=str(DEST),uuid=data['uuid'])))
