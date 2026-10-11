"""Reduce linear bone timelines in distribution copies with bounded error."""

FIELDS = {
    'rotate': (('angle',), 0.0, 0.12),
    'translate': (('x', 'y'), 0.0, 0.12),
    'scale': (('x', 'y'), 1.0, 0.001),
    'shear': (('x', 'y'), 0.0, 0.12),
}


def reduce_timeline(frames, kind):
    if len(frames) < 5 or any('curve' in frame for frame in frames):
        return frames
    fields, default, tolerance = FIELDS[kind]
    times = [frame.get('time', 0.0) for frame in frames]
    values = [[frame.get(field, default) for field in fields] for frame in frames]
    if any(b <= a for a, b in zip(times, times[1:])):
        return frames
    if kind == 'rotate' and any(abs(b[0] - a[0]) >= 180 for a, b in zip(values, values[1:])):
        return frames
    # Keep the two endpoint samples on each side so loop boundary slopes stay intact.
    keep = {0, 1, len(frames) - 2, len(frames) - 1}
    pending = [(1, len(frames) - 2)]
    while pending:
        left, right = pending.pop()
        if right - left < 2:
            continue
        worst, split = 0.0, left + 1
        for index in range(left + 1, right):
            ratio = (times[index] - times[left]) / (times[right] - times[left])
            error = max(abs(v - (a + (b - a) * ratio)) for v, a, b in
                        zip(values[index], values[left], values[right]))
            if error > worst:
                worst, split = error, index
        # Spine rotates through the shortest arc; never create a long rotation segment.
        if worst > tolerance or (kind == 'rotate' and abs(values[right][0] - values[left][0]) >= 180):
            keep.add(split)
            pending.extend([(left, split), (split, right)])
    return [frames[index] for index in sorted(keep)]


def reduce_skeletons(value, totals):
    if isinstance(value, dict):
        if 'skeleton' in value and isinstance(value.get('animations'), dict) and isinstance(value.get('bones'), list):
            totals['skeletons'] += 1
            for animation in value['animations'].values():
                for timelines in animation.get('bones', {}).values():
                    for kind, frames in timelines.items():
                        if kind not in FIELDS or not isinstance(frames, list):
                            continue
                        reduced = reduce_timeline(frames, kind)
                        totals['before'] += len(frames)
                        totals['after'] += len(reduced)
                        timelines[kind] = reduced
            return
        for child in value.values():
            reduce_skeletons(child, totals)
    elif isinstance(value, list):
        for child in value:
            reduce_skeletons(child, totals)
