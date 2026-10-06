"""Calibrate fixed strike boxes from opaque artwork at the native hit frames.

Use the existing per-frame position/scale calibration, excluding helmets, tails
and transparent glow. These boxes describe the strike, not movement blocking.
"""
import json
import sys
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'assets'
def read(path): return json.loads(path.read_text(encoding='utf-8-sig'))
def write(path, data): path.write_text(json.dumps(data, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')

forms_path = ASSETS/'resources/gameplay/hero/forms.json'
forms = read(forms_path)
report = read(ROOT/'temp/animation-fix/alignment-report.json')
parts = {'Crab':('enemies/animations/crab','Enemy'), 'Octopus':('boss/animations','Boss'),
    'Shark':('partners/animations/shark','PetBlueDragon'), 'Turtle':('partners/animations/turtle','PetFox'),
    'Seahorse':('partners/animations/seahorse','PetRedDragon'), 'Jellyfish':('partners/animations/jellyfish','PetWhiteTiger')}
calibration = []
previous = {row['name']:row for row in read(ROOT/'temp/animation-fix/attack-calibration.json')} if (ROOT/'temp/animation-fix/attack-calibration.json').exists() else {}
for group in report:
    name = group['name']
    if len(sys.argv)>1 and name not in sys.argv[1:]:
        if name in previous: calibration.append(previous[name])
        continue
    hero = name.startswith('Hero')
    if not hero and name not in ('Crab','Octopus'):
        # Companion skills are remote area attacks; preserve their gameplay range.
        path=ASSETS/'prefabs'/f'{parts[name][1]}.prefab';data=read(path)
        controller=next(v for v in data if 'attackWidth' in v)
        controller.update(attackWidth=350,attackHeight=350,attackOffsetY=50)
        controller.pop('attackOffsetX',None);controller.pop('hitTime',None)
        write(path,data)
        calibration.append(dict(name=name,width=350,height=350,x=0,y=50,mode='remote-area'))
        continue
    part = f'sea-hero/animations/stage-{int(name[-1]):02d}' if hero else parts[name][0]
    # Crab's raised claw strikes forward at .4 s; Boss strikes at .3 s.
    hit = 9 if name == 'Octopus' else 16 if name == 'Crab' else 12
    points = []
    for index in range(hit-2, hit+3):
        im = Image.open(ASSETS/'textures/characters'/part/'attack'/f'attack-{index+1:02d}.png').convert('RGBA')
        pixels = np.asarray(im); yy, xx = np.nonzero(pixels[:,:,3] >= 192)
        pose = group['poses']['attack'][index]; s = pose['scale'][0]
        x = (xx-im.width/2)*s+pose['position'][0]
        y = (im.height/2-yy)*s+pose['position'][1]
        if hero: keep = (x >= 25) & (y <= 35)
        elif name == 'Octopus': keep = y <= 80
        elif name == 'Jellyfish': keep = y <= 15
        elif name == 'Crab': keep = (x >= 10) & (y <= 40)
        elif name in ('Shark','Turtle'): keep = (x >= 15) & (y >= -25)
        else: keep = (x >= 10) & (y >= 0)
        assert np.any(keep), name
        points.append(np.column_stack((x[keep],y[keep])))
    points = np.concatenate(points)
    lo = np.quantile(points, .005, axis=0)-4
    hi = np.quantile(points, .995, axis=0)+4
    if hero: lo[0] = 12
    elif name not in ('Octopus','Jellyfish'): lo[0] = 0
    if name == 'Jellyfish':
        hi[0] = max(abs(lo[0]),abs(hi[0])); lo[0] = -hi[0]
    settings = dict(width=round(float(hi[0]-lo[0]),2), height=round(float(hi[1]-lo[1]),2),
        x=round(float((hi[0]+lo[0])/2),2), y=round(float((hi[1]+lo[1])/2),2),hitProgress=2/3 if name=='Crab' else .5)
    if hero:
        forms['forms'][int(name[-1])-1]['attack'].update(settings)
    else:
        path = ASSETS/'prefabs'/f'{parts[name][1]}.prefab'; data = read(path)
        controller = next(v for v in data if 'attackWidth' in v)
        controller.update(attackWidth=settings['width'],attackHeight=settings['height'],
            attackOffsetX=settings['x'],attackOffsetY=settings['y'])
        if name == 'Crab': controller['hitTime'] = .4
        if name == 'Octopus': controller['lockTarget'] = False
        elif name != 'Crab': controller['hitTime'] = .3
        write(path,data)
    calibration.append(dict(name=name,**settings,hitFrame=hit+1))
if len(sys.argv)==1 or any(name.startswith('Hero') for name in sys.argv[1:]):
    write(forms_path,forms)
    path=ASSETS/'scenes/Main.scene';scene=read(path)
    controller=next(v for v in scene if 'attackRange' in v)
    shape=forms['forms'][0]['attack'];offset=forms['forms'][0]['themeVisual']['animation']['offsets'][0][0]
    controller.update(attackRange=shape['width'],attackHeight=shape['height'],
        attackOffsetX=shape['x']-offset,attackOffsetY=shape['y'],hitTime=.24,slashClip=None)
    write(path,scene)
write(ROOT/'temp/animation-fix/attack-calibration.json',calibration)
for row in calibration: print(row)
