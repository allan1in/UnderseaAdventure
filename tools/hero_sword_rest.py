"""Use the same low forward sword heading in all four articulated forms."""
import copy

REST_HEADING = 5

def adjust_sword_rest(source):
    data = copy.deepcopy(source)
    bones = {b['name']: b for b in data['rig']['bones']}
    offset = data['sword'].get('handAngleOffset', 90)
    for pose in data['poses']:
        if pose['action'] == 'Attack':
            continue
        rot = pose['rot']
        rot['near-upper-arm'] = rot.get('near-upper-arm', 0) - 30
        fore = sum(bones[n].get('rotation', 0) + rot.get(n, 0)
                   for n in ('body', 'near-upper-arm', 'near-forearm'))
        rot['near-hand'] = REST_HEADING - offset - fore - bones['near-hand'].get('rotation', 0)
        pose['swordAngle'] = REST_HEADING
        assert abs(bones['near-hand'].get('rotation', 0) + rot['near-hand']) <= 35
    rest = next(p for p in data['poses'] if p['action'] == 'Idle')
    attack = [p for p in data['poses'] if p['action'] == 'Attack']
    for pose in (attack[0], attack[-1]):
        for name in ('near-upper-arm', 'near-forearm', 'near-hand'):
            pose['rot'][name] = rest['rot'].get(name, 0)
        pose['swordAngle'] = REST_HEADING
    data['sword']['restHeading'] = REST_HEADING
    return data
