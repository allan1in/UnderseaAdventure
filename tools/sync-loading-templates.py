"""Apply the shared ocean loading screen to Creator 3.8.8 preview/web templates."""
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CREATOR = Path('D:/Cocos/editors/Creator/3.8.8/resources')
preview = ROOT/'preview-template'
loading = preview/'loading'
loading.mkdir(parents=True, exist_ok=True)
files = {
    'logo': ROOT/'assets/textures/undersea/ui/logo-undersea-heroes.png',
    'hero': ROOT/'assets/textures/characters/sea-hero/animations/stage-01/idle/idle-01.png',
    **{pet: ROOT/f'assets/textures/characters/partners/animations/{pet}/idle/idle-01.png'
       for pet in ['seahorse', 'turtle', 'jellyfish', 'shark']},
}
for name, source in files.items(): shutil.copy2(source, loading/f'{name}.png')
markup = (ROOT/'tools/loading-screen.html').read_text(encoding='utf-8')
css = '<link rel="stylesheet" href="./loading/loading.css">'
script = '<script src="./loading/loading.js"></script>'
template = (CREATOR/'app.asar.unpacked/builtin/preview/static/views/index.ejs').read_text(encoding='utf-8')
template = template.replace('</head>', css+'\n</head>')
old = '<div id="splash">\n                        <div class="progress-bar stripes"><span></span></div>\n                    </div>'
assert old in template
template = template.replace(old, markup).replace('</body>', script+'\n</body>')
(preview/'index.ejs').write_text(template, encoding='utf-8')
for platform in ['web-mobile', 'web-desktop']:
    dest = ROOT/'build-templates'/platform
    dest.mkdir(parents=True, exist_ok=True)
    shutil.copytree(loading, dest/'loading', dirs_exist_ok=True)
    template = (CREATOR/f'resources/3d/engine/templates/{platform}/index.ejs').read_text(encoding='utf-8')
    template = template.replace('</head>', css+'\n</head>')
    template = template.replace('<%- include(cocosTemplate, {}) %>', markup+'\n<%- include(cocosTemplate, {}) %>\n'+script)
    (dest/'index.ejs').write_text(template, encoding='utf-8')
print('Ocean loading templates synced for Creator preview, Web Mobile and Web Desktop.')
