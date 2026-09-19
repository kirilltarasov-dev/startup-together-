import argparse
import hashlib
import json
import sys
from pathlib import Path

import bpy
import numpy as np
from mathutils import Matrix, Vector

parser = argparse.ArgumentParser()
parser.add_argument('source', type=Path)
parser.add_argument('output', type=Path)
parser.add_argument('--overwrite', action='store_true')
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
if not args.source.is_file():
    raise FileNotFoundError(args.source)
if args.output.exists() and not args.overwrite:
    raise FileExistsError(args.output)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=str(args.source), use_image_search=False)
scene = bpy.context.scene
scene.frame_set(1)
rig = next(obj for obj in scene.objects if obj.type == 'ARMATURE')
for bone in rig.data.bones:
    original = bone.name
    normalized = 'mixamorig:' + original.rsplit(':', 1)[-1]
    if original != normalized:
        bone.name = normalized
        for obj in scene.objects:
            if obj.type == 'MESH' and original in obj.vertex_groups:
                obj.vertex_groups[original].name = normalized
source_actions = [(action.name, list(action.frame_range)) for action in bpy.data.actions]
rig.animation_data_clear()
for bone in rig.pose.bones:
    bone.matrix_basis.identity()
bpy.context.view_layer.update()
meshes = [obj for obj in scene.objects if obj.type == 'MESH']
points = [obj.matrix_world @ Vector(corner) for obj in meshes for corner in obj.bound_box]
source_height = max(p.z for p in points) - min(p.z for p in points)
rig.scale *= 1.78 / source_height
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

for material in bpy.data.materials:
    if not material.node_tree:
        continue
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    shader = next((node for node in nodes if node.type == 'BSDF_PRINCIPLED'), None)
    if not shader:
        continue
    shader.inputs['Metallic'].default_value = 0
    roughness = shader.inputs['Roughness']
    if roughness.is_linked:
        source_node = roughness.links[0].from_node
        image = source_node.image if source_node.type == 'TEX_IMAGE' else None
        if image and 'Gloss' in image.name:
            width, height = image.size
            pixels = np.empty(width * height * 4, dtype=np.float32)
            image.pixels.foreach_get(pixels)
            pixels = pixels.reshape(-1, 4)
            pixels[:, :3] = 1 - pixels[:, :3]
            converted = bpy.data.images.new(image.name.replace('Gloss', 'Roughness'), width=width, height=height)
            converted.colorspace_settings.name = 'Non-Color'
            converted.pixels.foreach_set(pixels.ravel())
            converted.pack()
            source_node.image = converted
    if material.name in ('Hairmat', 'Eyelashmat'):
        opacity_name = 'Remy_Hair_Opacity' if material.name == 'Hairmat' else 'Remy_Body_Opacity1'
        opacity = bpy.data.images.get(opacity_name)
        base_node = shader.inputs['Base Color'].links[0].from_node
        diffuse = base_node.image
        if opacity and diffuse:
            width, height = diffuse.size
            if tuple(opacity.size) != (width, height):
                opacity.scale(width, height)
            color = np.empty(width * height * 4, dtype=np.float32)
            mask = np.empty_like(color)
            diffuse.pixels.foreach_get(color)
            opacity.pixels.foreach_get(mask)
            color = color.reshape(-1, 4)
            color[:, 3] = mask.reshape(-1, 4)[:, 0]
            combined = bpy.data.images.new(material.name + '_RGBA', width=width, height=height, alpha=True)
            combined.pixels.foreach_set(color.ravel())
            combined.pack()
            base_node.image = combined
            links.new(base_node.outputs['Alpha'], shader.inputs['Alpha'])
            material.surface_render_method = 'DITHERED'

for image in bpy.data.images:
    if image.size[0] > 1024 or image.size[1] > 1024:
        factor = 1024 / max(image.size)
        image.scale(round(image.size[0] * factor), round(image.size[1] * factor))
        image.pack()

scene.frame_start = scene.frame_end = 1
bpy.ops.object.select_all(action='DESELECT')
for obj in [rig, *meshes]:
    obj.select_set(True)
args.output.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.export_scene.gltf(
    filepath=str(args.output), export_format='GLB', use_selection=True,
    export_animations=False, export_skins=True, export_rest_position_armature=False,
    export_cameras=False, export_lights=False, export_image_format='JPEG', export_jpeg_quality=85,
)
report = {
    'source': args.source.name,
    'sourceSha256': hashlib.sha256(args.source.read_bytes()).hexdigest(),
    'sourceActions': source_actions,
    'pose': 'Locally fitted static seated pose; not a supplied seated animation',
    'bones': len(rig.data.bones),
    'meshes': len(meshes),
    'vertices': sum(len(obj.data.vertices) for obj in meshes),
    'maxTextureDimension': 1024,
    'outputBytes': args.output.stat().st_size,
    'outputSha256': hashlib.sha256(args.output.read_bytes()).hexdigest(),
}
print('REMY_CONVERSION', json.dumps(report))
args.output.with_suffix('.json').write_text(json.dumps(report, indent=2) + '\n')
