"""Import existing crab frames only, then register all three actions together."""
import hashlib
import json
import shutil
import subprocess
import sys
from pathlib import Path
from PIL import Image

PROJECT = Path(__file__).resolve().parents[1]
THEME = PROJECT.parent / '主题素材/海底冒险'
SOURCE = THEME / 'textures/characters/enemies/animations/crab'
DEST = PROJECT / 'assets/textures/characters/enemies/animations/crab'
OUT = PROJECT / 'temp/animation-fix'
OUT.mkdir(parents=True, exist_ok=True)
def read(path): return json.loads(path.read_text(encoding='utf-8-sig'))
def write(path, data): path.write_text(json.dumps(data, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
def digest(path): return hashlib.sha256(path.read_bytes()).hexdigest()

protected = [PROJECT/'assets/scenes/Main.scene', PROJECT/'assets/resources/gameplay/hero/forms.json',
             *[p for p in (PROJECT/'assets/prefabs').glob('*.prefab') if p.stem!='Enemy'],
             *[p for p in (PROJECT/'assets/animations').glob('*.anim') if not p.name.startswith('SeaCrab')]]
before = {p:digest(p) for p in protected}
changed = 0
for action in ['idle','move','attack']:
    for i in range(1,25):
        source = SOURCE/action/f'{action}-{i:02d}.png'
        dest = DEST/action/source.name
        assert Image.open(source).size == Image.open(dest).size == (320,320)
        assert Path(str(dest)+'.meta').exists()
        if digest(source)!=digest(dest):
            backup = OUT/'crab-before-replacement'/action/source.name
            if not backup.exists():
                backup.parent.mkdir(parents=True,exist_ok=True); shutil.copy2(dest,backup)
            shutil.copy2(source,dest); changed += 1
subprocess.run([sys.executable,str(PROJECT/'tools/polish-animation-clips.py'),'Crab'],check=True)
assert all(digest(p)==hash_value for p,hash_value in before.items()),'Unexpected change outside crab assets'

group = next(g for g in read(OUT/'alignment-report.json') if g['name']=='Crab')
preview = dict(canvas=[320,320],actions={},transition=.075)
for action,clip in zip(['idle','move','attack'],group['clips']):
    data = read(PROJECT/clip['path'])
    order = list(range(24)) if action=='attack' else list(range(24))+list(range(22,0,-1))
    preview['actions'][action] = dict(fps=clip['fps'],duration=clip['duration'],order=order,
                                     poses=group['poses'][action])
write(SOURCE/'preview-timing.json',preview)
(SOURCE/'preview-timing.js').write_text('window.CRAB_PREVIEW='+json.dumps(preview,ensure_ascii=False)+';\n',encoding='utf-8')
print(json.dumps(dict(replacedFrames=changed,frames=72,protectedAssetsUnchanged=True)))
