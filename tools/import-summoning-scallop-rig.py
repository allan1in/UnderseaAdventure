"""Import approved scallop rig and wire scene dependencies without changing UUIDs."""
from pathlib import Path
import importlib.util,json,shutil,sys,copy,uuid
sys.dont_write_bytecode=True
ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT.parent/'主题素材/海底冒险/textures/props/summoning-scallop-rig'
DEST=ROOT/'assets/resources/gameplay/summoning-scallop-rig';name='summoning-scallop'
spec=importlib.util.spec_from_file_location('rig',ROOT/'tools/build-hero-stage01-rig.py');rig=importlib.util.module_from_spec(spec);spec.loader.exec_module(rig)
rig.directory(DEST);template=ROOT/'assets/resources/gameplay/hero/stage04-rig'
for suffix in ('.json','.atlas','.png'):shutil.copy2(SOURCE/(name+suffix),DEST/(name+suffix))
m,atlas=rig.meta(DEST/(name+'.atlas'),rig.read(template/'hero-stage-04.atlas.meta'));rig.write(m,atlas)
m,image=rig.meta(DEST/(name+'.png'),rig.read(template/'hero-stage-04.png.meta'))
for key,sub in image['subMetas'].items():
    sub['uuid']=image['uuid']+'@'+key;sub['displayName']=name
    sub['userData']['imageUuidOrDatabaseUri']=image['uuid'] if key=='6c48a' else image['uuid']+'@6c48a'
image['userData']['redirect']=image['uuid']+'@6c48a';rig.write(m,image)
m,data=rig.meta(DEST/(name+'.json'),rig.read(template/'hero-stage-04.json.meta'));data['userData']['atlasUuid']=atlas['uuid'];rig.write(m,data)
scenePath=ROOT/'assets/scenes/Main.scene';scene=rig.read(scenePath)
lamp=next(o for o in scene if o.get('_name')=='MagicLamp');lampId=scene.index(lamp)
system=next(o for o in scene if 'lampData' in o);system['lampData']={'__uuid__':data['uuid'],'__expectedType__':'sp.SkeletonData'}
system['paymentTargetY']=158*system['visualScale']
picture=next(scene[c['__id__']] for c in lamp['_children'] if scene[c['__id__']].get('_name')=='Sprite');picture['_active']=False
for c in picture['_components']:
    if scene[c['__id__']].get('__type__')=='cc.Sprite':scene[c['__id__']]['_spriteFrame']=None
spine=next((scene[c['__id__']] for c in lamp['_children'] if scene[c['__id__']].get('_name')=='Spine'),None)
if spine is None:
    spine=copy.deepcopy(picture);spine['_name']='Spine';spine['_id']=str(uuid.uuid4());spine['_components']=[]
    spineId=len(scene);scene.append(spine);lamp['_children'].insert(1,{'__id__':spineId})
    transform=copy.deepcopy(next(scene[c['__id__']] for c in picture['_components'] if scene[c['__id__']].get('__type__')=='cc.UITransform'))
    transform['node']={'__id__':spineId};transform['_id']=str(uuid.uuid4());transform['_anchorPoint'].update(x=.5,y=0);transform['_contentSize'].update(width=300,height=294)
    spine['_components'].append({'__id__':len(scene)});scene.append(transform)
    skeleton=copy.deepcopy(next(o for o in scene if o.get('__type__')=='sp.Skeleton'));skeleton['node']={'__id__':spineId};skeleton['_id']=str(uuid.uuid4())
    spine['_components'].append({'__id__':len(scene)});scene.append(skeleton)
else:
    skeleton=next(scene[c['__id__']] for c in spine['_components'] if scene[c['__id__']].get('__type__')=='sp.Skeleton')
spine['_active']=True;spine['_parent']={'__id__':lampId};spine['_lpos'].update(x=0,y=0,z=0)
spine['_lscale'].update(x=system['visualScale'],y=system['visualScale'],z=1)
skeleton['_skeletonData']={'__uuid__':data['uuid'],'__expectedType__':'sp.SkeletonData'}
skeleton['defaultAnimation']='idle';skeleton['loop']=True;skeleton['_premultipliedAlpha']=False
rig.write(scenePath,scene)
print(json.dumps({'uuid':data['uuid'],'imported':str(DEST),'paymentTargetY':system['paymentTargetY']}))
