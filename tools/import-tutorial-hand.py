"""Replace the shared hand image while preserving scene/resource UUID references."""
import json
import shutil
from pathlib import Path
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
source=ROOT.parent/'主题素材/海底冒险/textures/ui/tutorial-hand-v2.png'
dest=ROOT/'assets/resources/gameplay/ad-ui/tutorial-hand.png'
shutil.copy2(source,dest)
path=Path(str(dest)+'.meta');meta=json.loads(path.read_text(encoding='utf-8-sig'))
w,h=Image.open(source).size
d=meta['subMetas']['f9941']['userData']
d.update(width=w,height=h,rawWidth=w,rawHeight=h,trimX=0,trimY=0,offsetX=0,offsetY=0,trimType='none')
d['vertices']=dict(rawPosition=[-w/2,-h/2,0,w/2,-h/2,0,-w/2,h/2,0,w/2,h/2,0],
    indexes=[0,1,2,2,1,3],uv=[0,h,w,h,0,0,w,0],nuv=[0,0,1,0,0,1,1,1],minPos=[-w/2,-h/2,0],maxPos=[w/2,h/2,0])
path.write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
path=ROOT/'assets/scenes/Main.scene';scene=json.loads(path.read_text(encoding='utf-8-sig'))
hand=next(n for n in scene if n.get('_name')=='DownloadHand')
ui=next(scene[r['__id__']] for r in hand['_components'] if scene[r['__id__']]['__type__']=='cc.UITransform')
ui['_contentSize'].update(width=100,height=100)
path.write_text(json.dumps(scene,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('New tutorial-hand-v2.png replaces the shared hand with its existing UUID.')
