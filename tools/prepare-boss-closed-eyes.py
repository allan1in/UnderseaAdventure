"""Pack the generated eye edit into the original sprite, preserving all other pixels."""
from pathlib import Path
from PIL import Image,ImageDraw
import shutil,json
ROOT=Path(__file__).resolve().parents[1];THEME=ROOT.parent/'主题素材/海底冒险'
OUT=THEME/'textures/characters/boss/animations/skeleton-original-motion'
generated=Path('C:/Users/LIN/.codex/generated_images/01a1076d-4eab-76c3-b370-fc5efee5b7ef/exec-9a1c9283-6668-4605-8ec4-616bae510048.png')
shutil.copyfile(generated,OUT/'source-closed-eyes.png')
patch=Image.open(generated).convert('RGBA').resize((100,69),Image.Resampling.LANCZOS)
mask=Image.new('L',(100,69));draw=ImageDraw.Draw(mask)
draw.polygon([(14,9),(32,17),(54,25),(47,39),(33,43),(17,34),(12,21)],fill=255)
draw.polygon([(61,20),(93,7),(96,22),(86,36),(72,41),(62,33)],fill=255)
mask.save(OUT/'eyes-packing-mask.png')
base=Image.open(OUT/'boss-original.png').convert('RGBA');base.paste(patch,(148,151),mask);base.save(OUT/'boss-original-dead.png')
(OUT/'closed-eyes-packing.json').write_text(json.dumps(dict(input=str(generated),crop=[148,151,248,220],mode='Generated edit, packed over eye regions only; all other original pixels retained.'),indent=2),encoding='utf-8')
