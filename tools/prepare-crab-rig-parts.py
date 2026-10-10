from pathlib import Path
from PIL import Image
from collections import deque
import shutil
from PIL import ImageOps
ROOT=Path(__file__).resolve().parents[1]
base=ROOT.parent/'主题素材/海底冒险/textures/characters/enemies/animations'
out=base/'crab/skeleton-rig';out.mkdir(parents=True,exist_ok=True)
im=Image.open(out/'source-parts-sheet.png').convert('RGBA')
names=['body','left-arm','left-palm','left-finger','right-arm','right-palm','right-finger','dead-face','left-near-front','left-near-rear','left-far-front','left-far-rear','right-near-front','right-near-rear','right-far-front','right-far-rear']
xs=[[0,370,640,970,1254]]*4;ys=[0,351,649,920,1254]
for i,name in enumerate(names):
 row,col=divmod(i,4);part=im.crop((xs[row][col],ys[row],xs[row][col+1],ys[row+1]));w,h=part.size
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
 part.putalpha(Image.frombytes('L',(w,h),bytes(alpha)));part=part.crop(part.getchannel('A').getbbox());part.thumbnail((240,240),Image.Resampling.LANCZOS);
 if name=='far-forearm':part=ImageOps.mirror(part)
 part.save(out/(name+'.png'))

pair=Image.open(out/'source-palm-pair.png').convert('RGBA')
for i,name in enumerate(['left-palm','right-palm']):
 part=pair.crop((i*pair.width//2,0,(i+1)*pair.width//2,pair.height));part=part.crop(part.getchannel('A').getbbox());part.thumbnail((240,240),Image.Resampling.LANCZOS);part.save(out/(name+'.png'))
print('Crab cutout parts extracted.')
