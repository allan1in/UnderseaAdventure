"""Trim region attachments and repack pages; mesh canvases stay intact."""
from PIL import Image
import io
import math


def repack_page(image, regions, meshes):
    parts=[]
    for name,fields in regions:
        assert fields.get('rotate','false')=='false', 'Rotated atlas regions require explicit handling'
        x,y=map(int,fields['xy'].split(','));w,h=map(int,fields['size'].split(','))
        original=image.crop((x,y,x+w,y+h))
        crop=(0,0,w,h) if name in meshes else original.getchannel('A').getbbox()
        if crop is None:crop=(0,0,1,1)
        picture=original.crop(crop)
        ox,oy=map(int,fields.get('offset','0,0').split(','))
        new=dict(fields)
        new['size']=f'{picture.width},{picture.height}'
        new['offset']=f'{ox+crop[0]},{oy+h-crop[3]}'
        # Original canvas dimensions keep each region anchored in the same place.
        parts.append((name,new,picture,crop!=(0,0,w,h)))
    padding=2
    ordered=sorted(parts,key=lambda p:(-p[2].height,-p[2].width,p[0]))
    minimum=max(p[2].width+padding*2 for p in ordered)
    candidates=[]
    for width in range(math.ceil(minimum/16)*16,max(image.width,minimum)+16,16):
        x=y=row_height=0;positions={};used_width=0
        for name,fields,picture,_ in ordered:
            w,h=picture.width+padding*2,picture.height+padding*2
            if x+w>width:x=0;y+=row_height;row_height=0
            positions[name]=(x+padding,y+padding)
            x+=w;row_height=max(row_height,h);used_width=max(used_width,x)
        height=math.ceil((y+row_height)/4)*4
        final_width=math.ceil(used_width/4)*4
        if height<=max(image.size):
            candidates.append((final_width*height,max(final_width,height),final_width,height,positions))
    if not candidates:
        return None,regions,0,image.size
    _,_,width,height,positions=min(candidates,key=lambda p:p[:2])
    packed=Image.new('RGBA',(width,height))
    result=[]
    for name,fields,picture,trimmed in parts:
        x,y=positions[name];packed.paste(picture,(x,y))
        fields['xy']=f'{x},{y}';result.append((name,fields))
        assert packed.crop((x,y,x+picture.width,y+picture.height)).tobytes()==picture.tobytes()
    data=io.BytesIO();packed.save(data,format='WEBP',quality=55,exact=True,method=4)
    with Image.open(io.BytesIO(data.getvalue())) as decoded:
        assert decoded.convert('RGBA').getchannel('A').tobytes()==packed.getchannel('A').tobytes()
    return data.getvalue(),result,sum(p[3] for p in parts),(width,height)


def repack_atlas(text, directory, pixels, meshes):
    pages=[]
    for line in text.splitlines():
        line=line.rstrip()
        if not line:continue
        if not line.startswith(' ') and line.endswith('.png'):
            pages.append({'name':line,'header':{},'regions':[]})
        elif ':' in line:
            key,value=line.strip().split(':',1)
            target=pages[-1]['regions'][-1][1] if line.startswith(' ') else pages[-1]['header']
            target[key]=value.strip()
        else:pages[-1]['regions'].append((line,{}))
    output=[];stats=[]
    for page in pages:
        name=page['name'];file=directory[name];raw=file.read_bytes()
        image=pixels.get(name)
        if image is None:
            with Image.open(io.BytesIO(raw)) as loaded:image=loaded.convert('RGBA')
        data,regions,trimmed,size=repack_page(image,page['regions'],meshes)
        # Repacking is an optimization only when the encoded page actually shrinks.
        if data is not None and len(data)<len(raw) and size[0]*size[1]<image.width*image.height:
            file.write_bytes(data);page['regions']=regions;page['header']['size']=f'{size[0]},{size[1]}'
            stats.append({'page':name,'before':len(raw),'after':len(data),'trimmedRegions':trimmed,'size':size})
        output.extend([name,*[f'{k}: {v}' for k,v in page['header'].items()]])
        for region,fields in page['regions']:
            output.append(region);output.extend(f'  {k}: {v}' for k,v in fields.items())
        output.append('')
    return '\n'.join(output),stats
