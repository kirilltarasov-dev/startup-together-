import argparse
import hashlib
import json
import sys
from pathlib import Path

import bpy
import numpy as np

parser = argparse.ArgumentParser()
parser.add_argument('source', type=Path)
parser.add_argument('output', type=Path)
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
args.output.mkdir(parents=True, exist_ok=True)
image = bpy.data.images.load(str(args.source))
width, height = image.size
pixels = np.array(image.pixels[:], dtype=np.float32).reshape(-1, 4)
alpha = (1 - pixels[:, :3].mean(axis=1)) * pixels[:, 3]
outputs = []
for name, value in [('cognition-dark.png', 0), ('cognition-light.png', 1)]:
    path = args.output / name
    if path.exists():
        raise FileExistsError(path)
    result = bpy.data.images.new(name, width=width, height=height, alpha=True)
    rgba = np.ones((width * height, 4), dtype=np.float32) * value
    rgba[:, 3] = alpha
    result.pixels.foreach_set(rgba.ravel())
    result.filepath_raw = str(path)
    result.file_format = 'PNG'
    result.save()
    outputs.append({'file': name, 'bytes': path.stat().st_size, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()})
(args.output / 'source.json').write_text(json.dumps({'name': args.source.name, 'sourceSha256': hashlib.sha256(args.source.read_bytes()).hexdigest(), 'license': 'User-provided Cognition brand asset; no CC0 license claimed', 'modification': 'Preserved mark, removed white background and made dark/light variants', 'size': [width, height], 'outputs': outputs}, indent=2) + '\n')
print('BRANDING_READY', width, height, outputs)
