import bpy
import hashlib
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'public/assets/environment/courtyard-tree.glb'
if OUTPUT.exists() and '--overwrite' not in sys.argv:
    raise RuntimeError('Refusing to overwrite existing tree export')
source = bpy.data.objects['tree_small_02_LOD1']
tree = source.copy()
tree.data = source.data.copy()
bpy.context.scene.collection.objects.link(tree)
for obj in bpy.context.view_layer.objects:
    obj.select_set(False)
tree.hide_set(False)
tree.hide_viewport = False
tree.hide_render = False
tree.select_set(True)
bpy.context.view_layer.objects.active = tree
tree.data.calc_loop_triangles()
original_triangles = len(tree.data.loop_triangles)
modifier = tree.modifiers.new('Browser triangle budget', 'DECIMATE')
modifier.ratio = min(1, 65000 / original_triangles)
modifier.use_collapse_triangulate = True
bpy.ops.object.modifier_apply(modifier=modifier.name)
for image in bpy.data.images:
    if image.size[0] and max(image.size) > 512:
        ratio = 512 / max(image.size)
        image.scale(round(image.size[0] * ratio), round(image.size[1] * ratio))
        image.pack()
for index, original in enumerate(tree.data.materials):
    if 'lea' not in original.name.lower():
        continue
    material = original.copy()
    tree.data.materials[index] = material
    material.surface_render_method = 'DITHERED'
    material.use_backface_culling = False
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    nodes.clear()
    shader = nodes.new('ShaderNodeBsdfPrincipled')
    shader.inputs['Metallic'].default_value = 0
    output = nodes.new('ShaderNodeOutputMaterial')
    links.new(shader.outputs['BSDF'], output.inputs['Surface'])
    diffuse = nodes.new('ShaderNodeTexImage')
    diffuse.image = bpy.data.images.load(str(ROOT / 'node_modules/.cache/runway-environment-source/tree-leaves-rgba.png'))
    diffuse.image.colorspace_settings.name = 'sRGB'
    links.new(diffuse.outputs['Color'], shader.inputs['Base Color'])
    links.new(diffuse.outputs['Alpha'], shader.inputs['Alpha'])
    roughness = nodes.new('ShaderNodeTexImage')
    roughness.image = bpy.data.images['tree_small_02_leaves_rough.png']
    links.new(roughness.outputs['Color'], shader.inputs['Roughness'])
    normal = nodes.new('ShaderNodeTexImage')
    normal.image = bpy.data.images['tree_small_02_leaves_nor_gl.png']
    normal_map = nodes.new('ShaderNodeNormalMap')
    links.new(normal.outputs['Color'], normal_map.inputs['Color'])
    links.new(normal_map.outputs['Normal'], shader.inputs['Normal'])
bpy.ops.export_scene.gltf(filepath=str(OUTPUT), export_format='GLB', use_selection=True, export_image_format='JPEG', export_jpeg_quality=82, export_animations=False, export_cameras=False, export_lights=False)
tree.data.calc_loop_triangles()
evidence = {'source': 'https://polyhaven.com/a/tree_small_02', 'license': 'CC0-1.0', 'author': 'Rico Cilliers', 'sourceLOD': 'LOD1', 'sourceTriangles': original_triangles, 'triangles': len(tree.data.loop_triangles), 'bytes': OUTPUT.stat().st_size, 'sha256': hashlib.sha256(OUTPUT.read_bytes()).hexdigest(), 'maxTextureDimension': 512}
OUTPUT.with_suffix('.json').write_text(json.dumps(evidence, indent=2) + '\n')
print(json.dumps(evidence), flush=True)
