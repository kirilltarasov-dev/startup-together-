import argparse
import json
import math
import struct
import sys
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector

parser = argparse.ArgumentParser()
parser.add_argument('directory', type=Path)
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
results = {}
for extension in ('fbx', 'glb'):
    path = args.directory / ('sergio-reference.' + extension)
    assert path.is_file() and path.stat().st_size > 10000, str(path)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    if extension == 'fbx':
        bpy.ops.import_scene.fbx(filepath=str(path), use_image_search=False)
    else:
        data = path.read_bytes()
        magic, version, size = struct.unpack_from('<4sII', data)
        assert magic == b'glTF' and version == 2 and size == len(data)
        json_size, kind = struct.unpack_from('<II', data, 12)
        assert kind == 0x4E4F534A
        gltf = json.loads(data[20:20 + json_size])
        assert len(gltf.get('skins', [])) >= 1
        assert all('uri' not in im for im in gltf.get('images', [])), 'GLB must embed textures'
        names = [a['name'] for a in gltf.get('animations', [])]
        assert all(any(expected in n for n in names) for expected in ('Idle', 'Walk', 'Talking', 'Face_Blink_And_Speech')), names
        bpy.ops.import_scene.gltf(filepath=str(path))
    scene = bpy.context.scene
    rigs = [o for o in scene.objects if o.type == 'ARMATURE']
    bone_shapes = {b.custom_shape for r in rigs for b in r.pose.bones if b.custom_shape}
    meshes = [o for o in scene.objects if o.type == 'MESH' and o not in bone_shapes]
    assert len(rigs) == 1
    rig = rigs[0]
    assert len(rig.data.bones) >= 60
    assert len(meshes) > 10
    assert not any(o.type in ('CAMERA', 'LIGHT') for o in scene.objects)
    action_names = [a.name for a in bpy.data.actions]
    for expected in ('Idle', 'Walk', 'Talking'):
        assert any(expected in n for n in action_names), (extension, expected, action_names)
    morphs = [o for o in meshes if o.data.shape_keys]
    assert any('Blink' in o.data.shape_keys.key_blocks and 'MouthOpen' in o.data.shape_keys.key_blocks for o in morphs)
    missing_weights = []
    for obj in meshes:
        assert any(m.type == 'ARMATURE' for m in obj.modifiers), obj.name
        if any(not v.groups for v in obj.data.vertices):
            missing_weights.append(obj.name)
        assert all(math.isfinite(c) for v in obj.data.vertices for c in v.co)
    assert not missing_weights, missing_weights
    texture_images = {node.image for mat in bpy.data.materials if mat.node_tree for node in mat.node_tree.nodes if node.type == 'TEX_IMAGE' and node.image}
    assert texture_images
    assert all(image.size[0] > 0 and len(image.pixels) > 0 for image in texture_images)
    if rig.animation_data:
        for track in rig.animation_data.nla_tracks:
            track.mute = True
    rig.animation_data_create()
    idle = next(a for a in bpy.data.actions if 'Idle' in a.name and any(s.target_id_type == 'OBJECT' for s in a.slots))
    rig.animation_data.action = idle
    if hasattr(idle, 'slots') and idle.slots:
        rig.animation_data.action_slot = next((slot for slot in idle.slots if slot.target_id_type == 'OBJECT'), idle.slots[0])
    scene.frame_set(int(idle.frame_range[0]))
    bpy.context.view_layer.update()
    depsgraph = bpy.context.evaluated_depsgraph_get()
    points = [o.evaluated_get(depsgraph).matrix_world @ Vector(c) for o in meshes for c in o.evaluated_get(depsgraph).bound_box]
    bounds = [[min(p[i] for p in points), max(p[i] for p in points)] for i in range(3)]
    assert 1.65 < bounds[2][1] - bounds[2][0] < 2.1, bounds
    assert bounds[0][1] - bounds[0][0] < 1.3, bounds
    moving = next(o for o in meshes if 'Sleeve' in o.name)
    talking = next(a for a in bpy.data.actions if 'Talking' in a.name and any(s.target_id_type == 'OBJECT' for s in a.slots))
    rig.animation_data.action = talking
    if hasattr(talking, 'slots') and talking.slots:
        rig.animation_data.action_slot = next((slot for slot in talking.slots if slot.target_id_type == 'OBJECT'), talking.slots[0])
    snapshots = []
    start, end = talking.frame_range
    for frame in (int(start), int(start + (end - start) * 0.2)):
        scene.frame_set(frame)
        bpy.context.view_layer.update()
        evaluated = moving.evaluated_get(bpy.context.evaluated_depsgraph_get())
        snapshots.append(np.array([tuple(evaluated.matrix_world @ v.co) for v in evaluated.data.vertices]))
    movement = float(np.max(np.linalg.norm(snapshots[1] - snapshots[0], axis=1)))
    assert movement > 0.001, ('No skinned animation deformation', movement)
    morph = next(o for o in morphs if 'Blink' in o.data.shape_keys.key_blocks)
    basis = morph.data.shape_keys.key_blocks['Basis']
    morph_changes = {}
    for name in ('Blink', 'MouthOpen'):
        key = morph.data.shape_keys.key_blocks[name]
        amount = max((a.co - b.co).length for a, b in zip(key.data, basis.data))
        assert amount > 0.00001, (name, amount)
        morph_changes[name] = amount
    rig.animation_data.action = idle
    if idle.slots:
        rig.animation_data.action_slot = next(s for s in idle.slots if s.target_id_type == 'OBJECT')
    scene.frame_set(int(idle.frame_range[0]))
    for obj in morphs:
        obj.data.shape_keys.animation_data_clear()
        for key in obj.data.shape_keys.key_blocks:
            key.value = 0
    scene.world = bpy.data.worlds.new('Verification_Studio')
    scene.world.use_nodes = True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value = (0.2, 0.22, 0.25, 1)
    for location, energy in [((-2, -3, 4), 350), ((2, -1, 3), 150)]:
        bpy.ops.object.light_add(type='AREA', location=location)
        light = bpy.context.object
        light.data.energy = energy
        light.data.size = 3
        light.rotation_euler = (Vector((0, 0, 1)) - light.location).to_track_quat('-Z', 'Y').to_euler()
    bpy.ops.object.camera_add(location=(1.5, -4, 1.4))
    camera = bpy.context.object
    camera.data.type = 'ORTHO'
    camera.data.ortho_scale = 2.08
    camera.rotation_euler = (Vector((0, 0, 0.93)) - camera.location).to_track_quat('-Z', 'Y').to_euler()
    scene.camera = camera
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 12
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 600
    scene.render.resolution_y = 760
    scene.render.resolution_percentage = 100
    scene.render.filepath = str(args.directory / ('verified-' + extension + '.png'))
    bpy.ops.render.render(write_still=True)
    results[extension] = {
        'bytes': path.stat().st_size,
        'bones': len(rig.data.bones),
        'meshObjects': len(meshes),
        'actions': action_names,
        'loadedTextureImages': len(texture_images),
        'idleBoundsMeters': bounds,
        'talkingVertexMovementMeters': movement,
        'morphVertexDisplacementsLocal': morph_changes,
    }
(args.directory / 'verification.json').write_text(json.dumps(results, indent=2) + '\n')
print('CHARACTER_VERIFICATION_PASS', json.dumps(results))
