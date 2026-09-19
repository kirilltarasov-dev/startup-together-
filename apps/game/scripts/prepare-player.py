import argparse
import hashlib
import json
import sys
from pathlib import Path

import bpy

parser = argparse.ArgumentParser()
parser.add_argument('source', type=Path)
parser.add_argument('output', type=Path)
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
if args.output.exists():
    raise FileExistsError(args.output)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(args.source))
rigs = [o for o in bpy.context.scene.objects if o.type == 'ARMATURE']
shapes = {b.custom_shape for rig in rigs for b in rig.pose.bones if b.custom_shape}
bpy.ops.object.select_all(action='DESELECT')
for obj in bpy.context.scene.objects:
    if obj.type in ('MESH', 'ARMATURE') and obj not in shapes:
        obj.select_set(True)
for image in bpy.data.images:
    if image.size[0] and max(image.size) > 1024:
        factor = 1024 / max(image.size)
        image.scale(round(image.size[0] * factor), round(image.size[1] * factor))
        image.pack()
args.output.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(args.output), export_format='GLB', use_selection=True, export_animations=True, export_animation_mode='ACTIONS', export_skins=True, export_morph=True, export_morph_animation=True, export_cameras=False, export_lights=False, export_image_format='JPEG', export_jpeg_quality=82)
report = {'source': args.source.name, 'sourceSha256': hashlib.sha256(args.source.read_bytes()).hexdigest(), 'outputBytes': args.output.stat().st_size, 'outputSha256': hashlib.sha256(args.output.read_bytes()).hexdigest(), 'clips': [a.name for a in bpy.data.actions], 'note': 'User-authorized Remy-derived Sergio. Locally authored prototype loops, not mocap; run/jump/land clips not supplied.'}
args.output.with_suffix('.json').write_text(json.dumps(report, indent=2) + '\n')
print('PLAYER_READY', json.dumps(report))
