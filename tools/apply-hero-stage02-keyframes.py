"""Build the approved articulated poses into Spine animation, retaining UUIDs."""
import importlib.util
import copy
from hero_sword_rest import adjust_sword_rest
import math
import sys
from PIL import Image
from pathlib import Path

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('rig_builder', Path(__file__).with_name('build-hero-stage01-rig.py'))
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)
builder.OUT=builder.THEME/'textures/characters/hero/animations/stage-02/skeleton-rig'
builder.DEST=builder.PROJECT/'assets/resources/gameplay/hero/stage02-rig'
preview = builder.THEME / 'previews/hero-stage02-sword-keyframes-v3/poses.json'
data = adjust_sword_rest(builder.read(preview))
rig = copy.deepcopy(data['rig'])
poses = data['poses']
builder.write(preview.parent / 'poses-sword-rest.json', data)
setup = poses[0]
for bone in rig['bones']:
    bone['rotation'] = bone.get('rotation', 0) + setup['rot'].get(bone['name'], 0)
rig['bones'].append(dict(name='sword', parent='near-hand', x=9, y=0, rotation=data['sword']['handAngleOffset']-90))
hand_index = next(i for i,s in enumerate(rig['slots']) if s['name']=='near-hand')
rig['slots'].insert(hand_index, dict(name='sword', bone='sword', attachment='sword'))
parts = {name: Image.open(builder.OUT / data['partFiles'][name]).convert('RGBA') for name in builder.NAMES}
sword = Image.open(builder.OUT / data['sword']['file']).convert('RGBA')
width,height = sword.size
display_height = data['sword']['displayHeight']
display_width = display_height * width / height
parts['sword'] = sword.copy()
parts['sword'].thumbnail((240,240), Image.Resampling.LANCZOS)
builder.pack_atlas(parts,'hero-stage-02')
# The grip pivot, not the picture center, attaches to the hand.
rig['skins'][0]['attachments']['sword'] = {'sword':dict(path='sword',width=display_width,height=display_height,
    x=0,y=display_height*(data['sword']['gripPivot'][1]-.5))}

def sample(times, values, t, loop):
    """Monotone cubic interpolation: continuous velocity, no angle overshoot."""
    slopes=[(values[i+1]-values[i])/(times[i+1]-times[i]) for i in range(len(times)-1)]
    def tangent(a,b):
        return 2*a*b/(a+b) if a*b>0 else 0
    tangents=[0]+[tangent(slopes[i-1],slopes[i]) for i in range(1,len(times)-1)]+[0]
    if loop:
        tangents[0]=tangents[-1]=tangent(slopes[-1],slopes[0])
    i=next((i for i in range(len(times)-1) if t<=times[i+1]),len(times)-2)
    dt=times[i+1]-times[i]; u=(t-times[i])/dt
    return (2*u**3-3*u**2+1)*values[i]+(u**3-2*u**2+u)*dt*tangents[i]+(-2*u**3+3*u**2)*values[i+1]+(u**3-u**2)*dt*tangents[i+1]

animations={}
for action in ('Idle','Move','Attack'):
    frames=[p for p in poses if p['action']==action]
    times=[p['time'] for p in frames]; duration=times[-1]
    ticks=[i/60 for i in range(math.ceil(duration*60))]+[duration]
    timelines={}
    for bone in rig['bones']:
        name=bone['name']
        if name=='sword':continue
        values=[p['rot'].get(name,0)-setup['rot'].get(name,0) for p in frames]
        timelines[name]={'rotate':[dict(time=t,angle=round(sample(times,values,t,action!='Attack'),6)) for t in ticks]}
    timelines['root']['translate']=[dict(time=t,
        x=round(sample(times,[p.get('rootX',0) for p in frames],t,action!='Attack'),6),
        y=round(sample(times,[p.get('rootY',0) for p in frames],t,action!='Attack'),6)) for t in ticks]
    animations[action]={'bones':timelines}
rig['animations']=animations
builder.write(builder.OUT/'hero-stage-02.json',rig)
builder.write(builder.OUT/'rig-manifest.json',dict(parts=builder.NAMES+['sword'],boneCount=len(rig['bones']),
    animations={'Idle':2.4,'Move':1.2,'Attack':.48},attackHitTime=.205,
    source=str(preview),interpolation='monotone cubic sampled at 60 Hz',weaponParent='near-hand',
    drawOrder=[s['name'] for s in rig['slots']]))
builder.import_rig(2)
