from pathlib import Path
from PIL import Image
from collections import deque
import shutil
ROOT=Path(__file__).resolve().parents[1]
base=ROOT.parent/'主题素材/海底冒险/textures/characters/hero/animations'
out=base/'stage-03/skeleton-rig';out.mkdir(parents=True,exist_ok=True)
im=Image.open(out/'source-parts-sheet.png').convert('RGBA')
names=['head','torso','backpack','near-upper-arm','near-forearm','near-hand','far-upper-arm','far-forearm','far-hand','near-thigh','near-shin','near-boot','far-thigh','far-shin','far-boot']
xs=[[0,412,696,1027,1332,1619],[0,383,710,1026,1329,1619],[0,361,710,1025,1310,1619]];ys=[0,365,649,971]
for i,name in enumerate(names):
 row,col=divmod(i,5);part=im.crop((xs[row][col],ys[row],xs[row][col+1],ys[row+1]));w,h=part.size
 alpha=bytearray(part.getchannel('A').tobytes());seen=bytearray(w*h);largest=[]
 for start in range(w*h):
  if seen[start] or alpha[start]<=24:continue
  seen[start]=1;q=deque([start]);component=[]
  while q:
   a=q.popleft();component.append(a);x,y=a%w,a//w
   for b in ([a-1] if x else [])+([a+1] if x<w-1 else [])+([a-w] if y else [])+([a+w] if y<h-1 else []):
    if not seen[b] and alpha[b]>24:seen[b]=1;q.append(b)
  if len(component)>len(largest):largest=component
 assert largest,name
 # Retain only this part's connected silhouette, including one pixel AA fringe.
 keep=set(largest)
 for a in largest:
  x,y=a%w,a//w
  for dy in [-1,0,1]:
   for dx in [-1,0,1]:
    if 0<=x+dx<w and 0<=y+dy<h:keep.add(a+dx+dy*w)
 for a in range(w*h):
  if a not in keep:alpha[a]=0
 part.putalpha(Image.frombytes('L',(w,h),bytes(alpha)));part=part.crop(part.getchannel('A').getbbox());part.thumbnail((240,240),Image.Resampling.LANCZOS);part.save(out/(name+'.png'))
for side in ['near','far']:
 shutil.copy2(base/f'stage-02/skeleton-rig/{side}-hand-v2.png',out/f'{side}-hand-v2.png')
 shutil.copy2(out/f'{side}-forearm.png',out/f'{side}-forearm-v2.png')
print('Extracted 15 third-form cutouts; approved two-view fists retained.')
