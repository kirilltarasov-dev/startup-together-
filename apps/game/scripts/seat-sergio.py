import argparse
import hashlib
import json
import sys
from pathlib import Path

import bpy
from mathutils import Matrix, Vector

parser = argparse.ArgumentParser()
parser.add_argument('output', type=Path)
parser.add_argument('--overwrite', action='store_true')
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
if args.output.exists() and not args.overwrite:
    raise FileExistsError(args.output)
source = Path(bpy.data.filepath)
source_hash = hashlib.sha256(source.read_bytes()).hexdigest()
scene = bpy.context.scene
rig = next(obj for obj in scene.objects if obj.type == 'ARMATURE')
meshes = [obj for obj in scene.objects if obj.type == 'MESH' and any(modifier.type == 'ARMATURE' and modifier.object == rig for modifier in obj.modifiers)]
rig.animation_data_clear()
for obj in meshes:
    obj.animation_data_clear()
    if obj.data.shape_keys:
        obj.data.shape_keys.animation_data_clear()
        for key in obj.data.shape_keys.key_blocks:
            key.value = 0
for bone in rig.pose.bones:
    bone.matrix_basis.identity()
bpy.context.view_layer.update()


def aim(name, direction):
    bone = rig.pose.bones['mixamorig:' + name]
    matrix = rig.matrix_world @ bone.matrix
    current = (rig.matrix_world.to_3x3() @ (bone.tail - bone.head)).normalized()
    turn = current.rotation_difference(Vector(direction).normalized()).to_matrix().to_4x4()
    location = matrix.translation.copy()
    bone.matrix = rig.matrix_world.inverted() @ Matrix.Translation(location) @ turn @ Matrix.Translation(-location) @ matrix
    bpy.context.view_layer.update()


for side, sign in [('Left', 1), ('Right', -1)]:
    foot = rig.pose.bones['mixamorig:' + side + 'Foot']
    foot_direction = rig.matrix_world.to_3x3() @ (foot.tail - foot.head)
    aim(side + 'UpLeg', (sign * 0.08, -1, -0.06))
    aim(side + 'Leg', (0, 0.05, -1))
    aim(side + 'Foot', foot_direction)
    aim(side + 'Arm', (sign * 0.12, -0.35, -1))
    aim(side + 'ForeArm', (0, -0.65, -0.75))
    aim(side + 'Hand', (0, -1, -0.14))
hips = rig.matrix_world @ rig.pose.bones['mixamorig:Hips'].head
rig.location.z += 0.63 - hips.z
bpy.context.view_layer.update()
for image in bpy.data.images:
    if image.size[0] and max(image.size) > 1024:
        ratio = 1024 / max(image.size)
        image.scale(round(image.size[0] * ratio), round(image.size[1] * ratio))
        image.pack()
scene.frame_start = scene.frame_end = 1
bpy.ops.object.select_all(action='DESELECT')
for obj in [rig, *meshes]:
    obj.select_set(True)
bpy.context.view_layer.objects.active = rig
args.output.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(args.output), export_format='GLB', use_selection=True, export_animations=False, export_skins=True, export_rest_position_armature=False, export_morph=True, export_cameras=False, export_lights=False, export_image_format='JPEG', export_jpeg_quality=82)
depsgraph = bpy.context.evaluated_depsgraph_get()
points = [obj.evaluated_get(depsgraph).matrix_world @ Vector(corner) for obj in meshes for corner in obj.evaluated_get(depsgraph).bound_box]
report = {'source': source.name, 'sourceSha256': source_hash, 'reference': 'ChatGPT Image Sep 19, 2026, 01_55_43 PM.png', 'pose': 'Locally fitted static seated derivative; original animation exports preserved separately', 'bones': len(rig.data.bones), 'meshes': len(meshes), 'seatedBoundsMeters': [[min(point[i] for point in points), max(point[i] for point in points)] for i in range(3)], 'hipsHeightMeters': (rig.matrix_world @ rig.pose.bones['mixamorig:Hips'].head).z, 'maxTextureDimension': 1024, 'outputBytes': args.output.stat().st_size, 'outputSha256': hashlib.sha256(args.output.read_bytes()).hexdigest()}
args.output.with_suffix('.json').write_text(json.dumps(report, indent=2) + '\n')
assert hashlib.sha256(source.read_bytes()).hexdigest() == source_hash
print(json.dumps(report), flush=True)
