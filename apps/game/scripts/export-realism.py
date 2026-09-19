import hashlib
import json
from pathlib import Path
import sys

import bpy
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / 'node_modules/.cache/runway-realism-source'
OUTPUT = ROOT / 'public/assets/realism'
OVERWRITE = '--overwrite' in sys.argv
records = []


def load(asset):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(CACHE / asset / (asset + '.gltf')))
    bpy.context.view_layer.update()


def combine(name, objects):
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        world = obj.matrix_world.copy()
        obj.parent = None
        obj.matrix_world = world
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bpy.ops.object.join()
    obj = bpy.context.object
    obj.name = name
    bounds = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    anchor = Vector(((min(v.x for v in bounds) + max(v.x for v in bounds)) / 2, 0, min(v.z for v in bounds)))
    obj.data.transform(Matrix.Translation(-anchor))
    obj.data.update()
    return obj


def export(name, objects, source):
    path = OUTPUT / (name + '.glb')
    if path.exists() and not OVERWRITE:
        raise FileExistsError(path)
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.select_set(True)
    used_materials = {mat for obj in objects for mat in obj.data.materials if mat}
    images = {node.image for mat in used_materials if mat.node_tree for node in mat.node_tree.nodes if node.type == 'TEX_IMAGE' and node.image}
    texture_limit = 512 if name == 'facade-kit' else 1024
    for image in images:
        if not image.size[0] or not len(image.pixels):
            raise ValueError('Missing image: ' + image.name)
        if max(image.size) > texture_limit:
            factor = texture_limit / max(image.size)
            image.scale(round(image.size[0] * factor), round(image.size[1] * factor))
        image.pack()
    for mat in used_materials:
        if 'glass' in mat.name.lower():
            shader = next((node for node in mat.node_tree.nodes if node.type == 'BSDF_PRINCIPLED'), None)
            if shader:
                shader.inputs['Roughness'].default_value = 0.3
                shader.inputs['Metallic'].default_value = 0.35
    bpy.ops.export_scene.gltf(filepath=str(path), export_format='GLB', use_selection=True, export_animations=False, export_cameras=False, export_lights=False, export_image_format='JPEG', export_jpeg_quality=86)
    triangles = 0
    for obj in objects:
        obj.data.calc_loop_triangles()
        triangles += len(obj.data.loop_triangles)
    record = {'file': path.name, 'source': f'https://polyhaven.com/a/{source}', 'license': 'CC0-1.0', 'triangles': triangles, 'nodes': [o.name for o in objects], 'bytes': path.stat().st_size, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'maxTextureDimension': texture_limit}
    records.append(record)
    print('REALISM_EXPORT', json.dumps(record), flush=True)


load('modular_factory_facade')
modules = []
for name, names in [
    ('FacadeWide', ['wall_window_centered_large_01', 'window_centered_large_01']),
    ('FacadeNarrow', ['wall_window_centered_medium_02', 'window_centered_medium_02']),
    ('FacadeDoor', ['wall_door_recessed_small_01', 'door_recessed_small_01']),
    ('FacadeCornice', ['cornice01_standard_standard_01']),
    ('FacadeBase', ['base_standard_standard_01']),
]:
    modules.append(combine(name, [bpy.data.objects[n] for n in names]))
export('facade-kit', modules, 'modular_factory_facade')
for asset, name in [('SchoolChair_01', 'school-chair'), ('wooden_table_02', 'wooden-table')]:
    load(asset)
    objects = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
    model = combine(name, objects)
    bounds = [model.matrix_world @ Vector(c) for c in model.bound_box]
    center_y = (min(v.y for v in bounds) + max(v.y for v in bounds)) / 2
    model.data.transform(Matrix.Translation((0, -center_y, 0)))
    export(name, [model], asset)
(OUTPUT / 'exports.json').write_text(json.dumps({'assets': records}, indent=2) + '\n')
