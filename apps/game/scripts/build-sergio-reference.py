import argparse
import hashlib
import json
import math
import sys
from pathlib import Path

import bpy
import numpy as np
from mathutils import Matrix, Vector

parser = argparse.ArgumentParser()
parser.add_argument('--source', type=Path, required=True)
parser.add_argument('--reference', type=Path, required=True)
parser.add_argument('--output', type=Path, required=True)
parser.add_argument('--overwrite', action='store_true')
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
if args.output.exists() and not args.overwrite:
    raise FileExistsError(args.output)
if not args.source.is_file() or not args.reference.is_file():
    raise FileNotFoundError('Both the local rigged source and reference image are required')
args.output.mkdir(exist_ok=args.overwrite)
textures = args.output / 'textures'
textures.mkdir(exist_ok=args.overwrite)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=str(args.source), use_image_search=False)
scene = bpy.context.scene
scene.render.fps = 30
rig = next(o for o in scene.objects if o.type == 'ARMATURE')
rig.name = 'Sergio_Reference_Rig'
rig.animation_data_clear()
for action in list(bpy.data.actions):
    bpy.data.actions.remove(action)
for bone in rig.pose.bones:
    bone.matrix_basis.identity()
bpy.context.view_layer.update()
meshes = [o for o in scene.objects if o.type == 'MESH']
points = [o.matrix_world @ Vector(c) for o in meshes for c in o.bound_box]
rig.scale *= 1.80 / (max(p.z for p in points) - min(p.z for p in points))
bpy.context.view_layer.update()


def image_material(name, color, roughness=0.6, metal=0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*color, 1)
    shader.inputs['Roughness'].default_value = roughness
    shader.inputs['Metallic'].default_value = metal
    mat.diffuse_color = (*color, 1)
    return mat


def textured(name, image, roughness=0.65):
    mat = image_material(name, (1, 1, 1), roughness)
    node = mat.node_tree.nodes.new('ShaderNodeTexImage')
    node.image = image
    mat.node_tree.links.new(node.outputs['Color'], mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'])
    return mat


def write_image(image, name):
    if not image.size[0] or not len(image.pixels):
        raise ValueError('Image has no decoded pixels: ' + image.name)
    image.pixels[0]
    image.filepath_raw = str(textures / (name + '.png'))
    image.file_format = 'PNG'
    image.save()
    image.pack()


navy = image_material('Jacket_Navy_Wool', (0.018, 0.025, 0.043), 0.88)
cream = image_material('Sleeves_Ivory_Leather', (0.68, 0.57, 0.40), 0.58)
white = image_material('Sneakers_And_Shirt_Ivory', (0.86, 0.82, 0.74), 0.7)
yellow = image_material('Colombia_Gold', (0.94, 0.55, 0.022), 0.6)
blue = image_material('Colombia_Blue', (0.025, 0.085, 0.26), 0.6)
red = image_material('Colombia_Red', (0.64, 0.028, 0.032), 0.6)
gold = image_material('Accessories_Gold', (0.65, 0.39, 0.105), 0.25, 0.78)
black = image_material('Hat_Black_Fibers', (0.012, 0.009, 0.008), 0.85)
straw = image_material('Hat_Natural_Fibers', (0.67, 0.57, 0.41), 0.9)
for mat in list(bpy.data.materials):
    if not mat.node_tree:
        continue
    shader = mat.node_tree.nodes.get('Principled BSDF')
    if not shader:
        continue
    for slot in ('Roughness', 'Metallic'):
        for link in list(shader.inputs[slot].links):
            mat.node_tree.links.remove(link)
    shader.inputs['Roughness'].default_value = 0.64
    shader.inputs['Metallic'].default_value = 0.0 if mat != gold else 0.78
    if mat.name in ('Hairmat', 'Eyelashmat'):
        opacity = bpy.data.images.get('Remy_Hair_Opacity' if mat.name == 'Hairmat' else 'Remy_Body_Opacity1')
        source_node = shader.inputs['Base Color'].links[0].from_node
        image = source_node.image
        if opacity and image:
            w, h = image.size
            if tuple(opacity.size) != (w, h):
                opacity.scale(w, h)
            rgba = np.array(image.pixels[:], dtype=np.float32).reshape(-1, 4)
            rgba[:, 3] = np.array(opacity.pixels[:], dtype=np.float32).reshape(-1, 4)[:, 0]
            if mat.name == 'Hairmat':
                rgba[:, :3] *= (0.25, 0.18, 0.12)
            result = bpy.data.images.new(mat.name + '_RGBA', width=w, height=h, alpha=True)
            result.pixels.foreach_set(rgba.ravel())
            source_node.image = result
            mat.node_tree.links.new(source_node.outputs['Alpha'], shader.inputs['Alpha'])
            mat.surface_render_method = 'DITHERED'
            write_image(result, mat.name)

reference = bpy.data.images.load(str(args.reference))
w, h = reference.size
photo_pixels = np.array(reference.pixels[:], dtype=np.float32).reshape(h, w, 4)
py, px = np.mgrid[0:h, 0:w]
rgb = photo_pixels[:, :, :3]
background = (np.min(rgb, axis=2) > 0.5) & (np.max(rgb, axis=2) - np.min(rgb, axis=2) < 0.14) & (np.abs(px - 556) > 55) & ((h - py) < 310)
photo_pixels[background, :3] = (0.16, 0.19, 0.24)
photo = bpy.data.images.new('Jacket_Reference_Texture', width=w, height=h)
photo.pixels.foreach_set(photo_pixels.ravel())
write_image(photo, 'jacket-reference')
front_mat = textured('Reference_Jacket_Front_Projection', photo)
top = bpy.data.objects['Tops']
top.name = 'Varsity_Jacket_And_Shirt'
top.data.materials.clear()
for mat in (navy, cream, front_mat):
    top.data.materials.append(mat)
uv = top.data.uv_layers.active
for vertex in top.data.vertices:
    world = top.matrix_world @ vertex.co
    world.x *= 1.045
    world.y *= 1.075
    vertex.co = top.matrix_world.inverted() @ world
for face in top.data.polygons:
    center = sum((top.matrix_world @ top.data.vertices[i].co for i in face.vertices), Vector()) / len(face.vertices)
    normal = (top.matrix_world.to_3x3() @ face.normal).normalized()
    face.material_index = 1 if abs(center.x) > 0.205 else 0
    if center.y < -0.022 and normal.y < -0.25 and abs(center.x) < 0.225:
        face.material_index = 2
    for index in face.loop_indices:
        p = top.matrix_world @ top.data.vertices[top.data.loops[index].vertex_index].co
        px = 556 + p.x * 785
        py = 651 - (p.z - 0.89) * 704
        uv.data[index].uv = (px / photo.size[0], 1 - py / photo.size[1])

bottoms = bpy.data.objects['Bottoms']
bpy.data.objects.remove(bottoms, do_unlink=True)
shoes = bpy.data.objects['Shoes']
shoes.name = 'White_Sneakers'
shoes.data.materials.clear()
shoes.data.materials.append(white)
for face in shoes.data.polygons:
    face.material_index = 0
body = bpy.data.objects['Body']
body.name = 'Human_Anatomy'
hair = bpy.data.objects['Hair']
for vertex in hair.data.vertices:
    p = hair.matrix_world @ vertex.co
    if p.z < 1.655:
        p.z = 1.655 + (p.z - 1.655) * 0.18
        vertex.co = hair.matrix_world.inverted() @ p

n = 512
yy, xx = np.mgrid[0:n, 0:n]
weave = 0.75 + 0.13 * np.sin(xx * 2.4) * np.sin(yy * 2.4) + 0.06 * np.sin((xx + yy) * 1.3)
pixels = np.ones((n, n, 4), dtype=np.float32)
pixels[:, :, :3] = weave[:, :, None] * np.array([0.09, 0.105, 0.13])
denim_image = bpy.data.images.new('Dark_Denim_Weave', width=n, height=n)
denim_image.pixels.foreach_set(pixels.ravel())
write_image(denim_image, 'denim')
denim = textured('Trousers_Dark_Denim', denim_image, 0.94)


def skin_object(obj, weight_fn):
    obj.parent = rig
    obj.matrix_parent_inverse = rig.matrix_world.inverted()
    groups = {}
    for vertex in obj.data.vertices:
        for name, weight in weight_fn(vertex.co).items():
            if weight <= 0:
                continue
            full = 'mixamorig:' + name
            group = groups.get(full)
            if group is None:
                group = obj.vertex_groups.new(name=full)
                groups[full] = group
            group.add([vertex.index], float(weight), 'REPLACE')
    mod = obj.modifiers.new('Humanoid_Skin', 'ARMATURE')
    mod.object = rig
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    return obj


def mesh_object(name, vertices, faces, materials, indices=None, weights=None, uvs=None):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    scene.collection.objects.link(obj)
    for material in materials:
        data.materials.append(material)
    if indices:
        for polygon, index in zip(data.polygons, indices):
            polygon.material_index = index
    uv_layer = data.uv_layers.new(name='UVMap')
    for face in data.polygons:
        for loop in face.loop_indices:
            v = data.loops[loop].vertex_index
            uv_layer.data[loop].uv = uvs[v] if uvs else (vertices[v][0] * 2, vertices[v][2] * 2)
    if weights:
        skin_object(obj, weights)
    return obj


def fixed(name):
    return lambda p: {name: 1.0}


def tube(name, rings, material, weights, segments=32):
    verts, faces, coords = [], [], []
    for j, (center, axis, radius_a, radius_b) in enumerate(rings):
        axis = Vector(axis).normalized()
        a = axis.cross(Vector((0, 1, 0))).normalized()
        b = axis.cross(a).normalized()
        for k in range(segments):
            theta = 2 * math.pi * k / segments
            wrinkle = 1 + 0.006 * math.sin(k * 2.1 + j * 1.7)
            p = Vector(center) + wrinkle * (a * radius_a * math.cos(theta) + b * radius_b * math.sin(theta))
            verts.append(tuple(p))
            coords.append((k / segments, j / max(1, len(rings) - 1)))
            if j:
                a0 = (j - 1) * segments + k
                a1 = (j - 1) * segments + (k + 1) % segments
                b0 = j * segments + k
                b1 = j * segments + (k + 1) % segments
                faces.append((a0, a1, b1, b0))
    return mesh_object(name, verts, faces, [material], weights=weights, uvs=coords)


def path(name, points, radius, material, weights, cyclic=False):
    bpy.ops.object.select_all(action='DESELECT')
    curve = bpy.data.curves.new(name, 'CURVE')
    curve.dimensions = '3D'
    curve.resolution_u = 2
    curve.bevel_depth = radius
    curve.bevel_resolution = 2
    spline = curve.splines.new('POLY')
    spline.points.add(len(points) - 1)
    for p, co in zip(spline.points, points):
        p.co = (*co, 1)
    spline.use_cyclic_u = cyclic
    obj = bpy.data.objects.new(name, curve)
    scene.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.convert(target='MESH')
    obj.select_set(False)
    obj.data.materials.append(material)
    return skin_object(obj, weights)


def sphere(name, center, scale, material, weights):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=12, location=center)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    obj.data.materials.append(material)
    obj.select_set(False)
    return skin_object(obj, weights)


for side, sign in [('Left', 1), ('Right', -1)]:
    shoulder = rig.matrix_world @ rig.data.bones['mixamorig:' + side + 'Arm'].head_local
    elbow = rig.matrix_world @ rig.data.bones['mixamorig:' + side + 'ForeArm'].head_local
    wrist = rig.matrix_world @ rig.data.bones['mixamorig:' + side + 'Hand'].head_local

    def sleeve_weights(p, side=side, elbow=elbow):
        t = max(0, min(1, (abs(p.x) - abs(elbow.x) + 0.06) / 0.12))
        return {side + 'Arm': 1 - t, side + 'ForeArm': t}

    rings = []
    for i in range(29):
        t = i / 28
        center = shoulder.lerp(wrist, t)
        radius = 0.092 * (1 - t) + 0.048 * t
        radius *= 1 + 0.04 * math.sin(t * 39)
        rings.append((center, (sign, 0, 0), radius, radius * 0.94))
    tube(side + '_Cream_Jacket_Sleeve', rings, cream, sleeve_weights)
    sphere(side + '_Shoulder_Seam', shoulder + Vector((sign * 0.012, 0, 0)), (0.081, 0.085, 0.089), cream, fixed(side + 'Arm'))
    if side == 'Right':
        for index, (start, end, mat) in enumerate(((0.31, 0.34, yellow), (0.34, 0.355, blue), (0.355, 0.37, red))):
            patch = [(sign * x, shoulder.y - 0.082, shoulder.z + z) for x, z in ((start, -0.024), (end, -0.024), (end, 0.024), (start, 0.024))]
            mesh_object('Colombia_Sleeve_Flag_' + str(index), patch, [(0, 1, 2, 3)], [mat], weights=fixed(side + 'Arm'))
    for j, mat in enumerate((navy, yellow, blue, red, white, navy)):
        x = wrist.x - sign * (0.031 - j * 0.005)
        tube(side + '_Striped_Cuff_' + str(j), [((x, wrist.y, wrist.z), (sign, 0, 0), 0.05, 0.049), ((x + sign * 0.005, wrist.y, wrist.z), (sign, 0, 0), 0.05, 0.049)], mat, fixed(side + 'ForeArm'))
    hip = rig.matrix_world @ rig.data.bones['mixamorig:' + side + 'UpLeg'].head_local
    knee = rig.matrix_world @ rig.data.bones['mixamorig:' + side + 'Leg'].head_local
    ankle = rig.matrix_world @ rig.data.bones['mixamorig:' + side + 'Foot'].head_local

    def pants_weights(p, side=side, knee=knee):
        t = max(0, min(1, (knee.z + 0.08 - p.z) / 0.16))
        return {side + 'UpLeg': 1 - t, side + 'Leg': t}

    rings = []
    for i in range(37):
        t = i / 36
        center = hip.lerp(ankle, t)
        center.z += (1 - t) * 0.065
        radius = 0.114 * (1 - t) + 0.064 * t
        radius *= 1 + 0.03 * math.sin(t * 51) + 0.018 * math.cos(t * 93)
        rings.append((center, (0, 0, -1), radius, radius * 0.97))
    tube(side + '_Full_Length_Trousers', rings, denim, pants_weights)
    for j in range(5):
        z = 0.107 - j * 0.009
        y = -0.075 - j * 0.014
        path(side + '_Shoe_Lace_' + str(j), [(ankle.x - 0.035, y, z), (ankle.x, y - 0.005, z + 0.005), (ankle.x + 0.035, y, z)], 0.0022, white, fixed(side + 'Foot'))

waist_rings = [((0, 0, z), (0, 0, 1), rx, ry) for z, rx, ry in [(0.85, 0.168, 0.115), (0.91, 0.181, 0.124), (0.985, 0.168, 0.115)]]
tube('Trouser_Waist', waist_rings, denim, fixed('Hips'), 48)
for j, mat in enumerate((navy, white, red, blue, yellow, navy)):
    z = 0.89 + j * 0.007
    points = [(0.173 * math.cos(t), 0.139 * math.sin(t), z) for t in np.linspace(0, 2 * math.pi, 97)[:-1]]
    path('Jacket_Hem_' + str(j), points, 0.006, mat, fixed('Spine'))
for j, mat in enumerate((navy, yellow, blue, red, white)):
    points = []
    for theta in np.linspace(-0.1, math.pi + 0.1, 55):
        points.append((0.073 * math.cos(theta), 0.065 * math.sin(theta) - 0.01, 1.494 + j * 0.005))
    path('Striped_Collar_' + str(j), points, 0.004, mat, fixed('Neck'))

chain = [(0.068 * math.cos(t), -0.105 - 0.025 * math.sin(t), 1.466 - 0.106 * math.sin(t)) for t in np.linspace(0, math.pi, 65)]
path('Gold_Necklace', chain, 0.0022, gold, fixed('Spine2'))
left_wrist = rig.matrix_world @ rig.data.bones['mixamorig:LeftHand'].head_local
watch_center = left_wrist + Vector((-0.018, 0, 0))
watch_ring = [(watch_center.x, watch_center.y + 0.044 * math.cos(t), watch_center.z + 0.035 * math.sin(t)) for t in np.linspace(0, 2 * math.pi, 49)[:-1]]
path('Gold_Watch_Band', watch_ring, 0.005, gold, fixed('LeftForeArm'), True)
sphere('Gold_Watch_Case', (watch_center.x, watch_center.y - 0.044, watch_center.z), (0.017, 0.006, 0.021), gold, fixed('LeftForeArm'))
sphere('Watch_Dial', (watch_center.x, watch_center.y - 0.05, watch_center.z), (0.012, 0.002, 0.016), navy, fixed('LeftForeArm'))

hat_z = 1.756
verts, faces, indices, uvs = [], [], [], []
segments = 128
radii = np.linspace(0.097, 0.213, 29)
for j, radius in enumerate(radii):
    for k in range(segments):
        t = k * 2 * math.pi / segments
        edge = (radius - 0.097) / (0.213 - 0.097)
        z = hat_z + 0.022 * edge ** 2 * math.cos(2 * t) - 0.005 * edge
        verts.append((radius * math.cos(t), radius * 0.88 * math.sin(t) + 0.005, z))
        uvs.append((k / segments, j / 28))
        if j:
            faces.append(((j - 1) * segments + k, (j - 1) * segments + (k + 1) % segments, j * segments + (k + 1) % segments, j * segments + k))
            band = j in (3, 4, 8, 9, 10, 15, 16, 21, 22, 26, 28)
            indices.append(1 if band or (j in (12, 24) and k % 8 < 3) else 0)
hat = mesh_object('Woven_Wide_Hat_Brim', verts, faces, [straw, black], indices, fixed('Head'), uvs)
solid = hat.modifiers.new('Brim_Thickness', 'SOLIDIFY')
solid.thickness = 0.003
bpy.context.view_layer.objects.active = hat
bpy.ops.object.modifier_apply(modifier=solid.name)
verts, faces, indices, uvs = [], [], [], []
for j in range(19):
    f = j / 18
    radius = 0.1 * (1 - 0.18 * f)
    for k in range(96):
        t = k * 2 * math.pi / 96
        verts.append((radius * math.cos(t), radius * 0.91 * math.sin(t) + 0.005, hat_z + 0.072 * f))
        uvs.append((k / 96, f))
        if j:
            faces.append(((j - 1) * 96 + k, (j - 1) * 96 + (k + 1) % 96, j * 96 + (k + 1) % 96, j * 96 + k))
            pattern = j in (1, 3, 15, 18) or ((k // 6) % 2 == 0 and ((k + j * 2) % 12 < 5))
            indices.append(1 if pattern else 0)
faces.append(tuple(range(18 * 96, 19 * 96)))
indices.append(0)
mesh_object('Woven_Patterned_Hat_Crown', verts, faces, [straw, black], indices, fixed('Head'), uvs)
for j in (0, 1, 2):
    radius = 0.213 - j * 0.002
    points = [(radius * math.cos(t), radius * 0.88 * math.sin(t) + 0.005, hat_z + 0.022 * math.cos(2 * t) - 0.005) for t in np.linspace(0, 2 * math.pi, 129)[:-1]]
    path('Hat_Bound_Edge_' + str(j), points, 0.0015, black if j != 1 else straw, fixed('Head'), True)

batch_groups = {}
originals = {top, body, hair, shoes, bpy.data.objects['Eyes'], bpy.data.objects['Eyelashes']}
for obj in list(scene.objects):
    if obj.type == 'MESH' and obj not in originals and len(obj.data.materials) == 1:
        batch_groups.setdefault(obj.data.materials[0], []).append(obj)
for material, objects in batch_groups.items():
    if len(objects) < 2:
        continue
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    objects[0].name = 'Outfit_' + material.name

body.shape_key_add(name='Basis')
blink = body.shape_key_add(name='Blink')
mouth = body.shape_key_add(name='MouthOpen')
inv_body = body.matrix_world.inverted()
for vertex in body.data.vertices:
    p = body.matrix_world @ vertex.co
    blink_p = p.copy()
    for side in ('Left', 'Right'):
        center = rig.matrix_world @ rig.data.bones['mixamorig:' + side + 'Eye'].head_local
        dx = (p.x - center.x) / 0.019
        dz = (p.z - center.z) / 0.015
        if abs(dx) < 1 and abs(dz) < 1.35 and p.y < center.y - 0.008:
            strength = max(0, 1 - dx * dx) * max(0, 1 - abs(dz) / 1.35)
            blink_p.z += (center.z - p.z) * strength * 1.5
    blink.data[vertex.index].co = inv_body @ blink_p
    mouth_p = p.copy()
    if abs(p.x) < 0.047 and 1.53 < p.z < 1.598 and p.y < -0.055:
        strength = max(0, 1 - (p.x / 0.047) ** 2) * max(0, 1 - abs(p.z - 1.565) / 0.035)
        mouth_p.z -= 0.011 * strength
        mouth_p.y -= 0.004 * strength
    mouth.data[vertex.index].co = inv_body @ mouth_p

for image in list(bpy.data.images):
    if not image.size[0] or image == photo:
        continue
    if max(image.size) > 1024:
        factor = 1024 / max(image.size)
        image.scale(round(image.size[0] * factor), round(image.size[1] * factor))
    write_image(image, image.name.replace('/', '_'))


def aim(name, direction):
    bone = rig.pose.bones['mixamorig:' + name]
    matrix = rig.matrix_world @ bone.matrix
    current = (rig.matrix_world.to_3x3() @ (bone.tail - bone.head)).normalized()
    turn = current.rotation_difference(Vector(direction).normalized()).to_matrix().to_4x4()
    location = matrix.translation.copy()
    bone.matrix = rig.matrix_world.inverted() @ Matrix.Translation(location) @ turn @ Matrix.Translation(-location) @ matrix
    bpy.context.view_layer.update()


rig.animation_data_create()
for clip, length in [('Idle', 91), ('Walk', 31), ('Talking', 91)]:
    action = bpy.data.actions.new(clip)
    rig.animation_data.action = action
    for frame in range(1, length + 1):
        phase = (frame - 1) / (length - 1) * 2 * math.pi
        for bone in rig.pose.bones:
            bone.matrix_basis.identity()
            bone.rotation_mode = 'QUATERNION'
        bpy.context.view_layer.update()
        for side, sign in [('Left', 1), ('Right', -1)]:
            stride = math.sin(phase) * sign if clip == 'Walk' else 0
            gesture = (0.5 + 0.5 * math.sin(phase * 2 + sign)) if clip == 'Talking' else 0
            aim(side + 'Arm', (sign * (0.16 + gesture * 0.07), 0.25 * stride - 0.12 * gesture, -1))
            aim(side + 'ForeArm', (sign * 0.07, -0.10 + 0.22 * stride - 0.64 * gesture, -1 + gesture * 0.3))
            aim(side + 'Hand', (sign * 0.05, -0.10 - 0.30 * gesture, -1))
            if clip == 'Walk':
                aim(side + 'UpLeg', (sign * 0.025, -0.34 * stride, -1))
                aim(side + 'Leg', (0, 0.30 * stride + 0.18 * max(0, -stride), -1))
                aim(side + 'Foot', (sign * 0.06, -1, -0.45))
            for finger in ('Index', 'Middle', 'Ring', 'Pinky'):
                for joint in (1, 2, 3):
                    bone = rig.pose.bones.get('mixamorig:' + side + 'Hand' + finger + str(joint))
                    if bone:
                        bone.rotation_mode = 'XYZ'
                        bone.rotation_euler.z = sign * (0.12 if joint == 1 else 0.18)
        head = rig.pose.bones['mixamorig:Head']
        head.rotation_mode = 'XYZ'
        head.rotation_euler.y += 0.015 * math.sin(phase) if clip != 'Talking' else 0.045 * math.sin(phase * 2)
        spine = rig.pose.bones['mixamorig:Spine2']
        spine.rotation_mode = 'XYZ'
        spine.rotation_euler.x = 0.009 * math.sin(phase)
        for bone in rig.pose.bones:
            bone.keyframe_insert(data_path='rotation_euler' if bone.rotation_mode == 'XYZ' else 'rotation_quaternion', frame=frame, group=bone.name)
    action.use_fake_user = True
    rig.animation_data.action = None
    track = rig.animation_data.nla_tracks.new()
    track.name = clip
    strip = track.strips.new(clip, 1, action)
    track.mute = True

keys = body.data.shape_keys
keys.animation_data_create()
face_action = bpy.data.actions.new('Face_Blink_And_Speech')
keys.animation_data.action = face_action
for frame in range(1, 92):
    blink.value = max(0, 1 - abs(frame - 24) / 3) + max(0, 1 - abs(frame - 74) / 3)
    mouth.value = 0.0 if frame in (1, 91) else (0.5 + 0.5 * math.sin(frame * 0.63)) * 0.7
    blink.keyframe_insert(data_path='value', frame=frame)
    mouth.keyframe_insert(data_path='value', frame=frame)
face_action.use_fake_user = True
keys.animation_data.action = None
face_track = keys.animation_data.nla_tracks.new()
face_track.name = 'Face_Blink_And_Speech'
face_track.strips.new('Face_Blink_And_Speech', 1, face_action)
face_track.mute = True
blink.value = mouth.value = 0

for bone in rig.pose.bones:
    bone.matrix_basis.identity()
rig.animation_data.action = bpy.data.actions['Idle']
scene.frame_start = 1
scene.frame_end = 91
scene.frame_set(1)
bpy.context.view_layer.update()
asset_objects = [o for o in scene.objects if o.type in ('MESH', 'ARMATURE')]
bpy.ops.object.select_all(action='DESELECT')
for obj in asset_objects:
    obj.select_set(True)
bpy.context.view_layer.objects.active = rig
rig['reference_status'] = 'Local Remy-based approximation; not a recovered facial likeness or scanned garment.'
rig['source_reference'] = args.reference.name
rig['animation_status'] = 'Locally authored procedural loops; no motion capture or audio-driven lip sync.'
rig.animation_data.action = None
for track in rig.animation_data.nla_tracks:
    track.mute = False
face_track.mute = False
fbx_path = args.output / 'sergio-reference.fbx'
bpy.ops.export_scene.fbx(filepath=str(fbx_path), use_selection=True, object_types={'ARMATURE', 'MESH'}, add_leaf_bones=False, path_mode='COPY', embed_textures=True, bake_anim=True, bake_anim_use_all_actions=False, bake_anim_use_nla_strips=True, bake_anim_simplify_factor=0, axis_forward='-Z', axis_up='Y')
bpy.ops.export_scene.gltf(filepath=str(args.output / 'sergio-reference.glb'), export_format='GLB', use_selection=True, export_animations=True, export_animation_mode='NLA_TRACKS', export_skins=True, export_morph=True, export_morph_animation=True, export_cameras=False, export_lights=False, export_image_format='JPEG', export_jpeg_quality=88)
for track in rig.animation_data.nla_tracks:
    track.mute = True
face_track.mute = True
rig.animation_data.action = bpy.data.actions['Idle']
scene.frame_set(1)
bpy.ops.object.select_all(action='DESELECT')
scene.world = bpy.data.worlds.new('Studio_World')
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs[0].default_value = (0.32, 0.36, 0.43, 1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value = 0.45
floor_mat = image_material('Preview_Floor', (0.18, 0.20, 0.23), 0.95)
bpy.ops.mesh.primitive_plane_add(size=200, location=(0, 0, -0.006))
floor = bpy.context.object
floor.name = 'PREVIEW_ONLY_Floor'
floor.data.materials.append(floor_mat)
for name, position, energy, size in [('Key', (-2.5, -4, 4.5), 350, 4), ('Fill', (3, -2, 2.5), 160, 3), ('Rim', (0, 2, 3), 280, 2.5)]:
    bpy.ops.object.light_add(type='AREA', location=position)
    light = bpy.context.object
    light.name = 'PREVIEW_ONLY_' + name
    light.data.energy = energy
    light.data.shape = 'DISK'
    light.data.size = size
    light.rotation_euler = (Vector((0, 0, 1)) - light.location).to_track_quat('-Z', 'Y').to_euler()
bpy.ops.object.camera_add(location=(0, -4, 1.05))
camera = bpy.context.object
camera.name = 'PREVIEW_ONLY_Camera'
camera.data.type = 'ORTHO'
camera.data.ortho_scale = 2.12
camera.rotation_euler = (Vector((0, 0, 0.94)) - camera.location).to_track_quat('-Z', 'Y').to_euler()
scene.camera = camera
scene.render.engine = 'CYCLES'
scene.cycles.samples = 24
scene.cycles.use_denoising = True
scene.render.resolution_x = 900
scene.render.resolution_y = 1100
scene.render.resolution_percentage = 100
scene.view_settings.view_transform = 'AgX'
bpy.ops.wm.save_as_mainfile(filepath=str(args.output / 'sergio-reference.blend'))
scene.render.filepath = str(args.output / 'preview-front.png')
bpy.ops.render.render(write_still=True)
camera.location = (2.8, -4, 1.6)
camera.rotation_euler = (Vector((0, 0, 0.95)) - camera.location).to_track_quat('-Z', 'Y').to_euler()
scene.render.filepath = str(args.output / 'preview-three-quarter.png')
bpy.ops.render.render(write_still=True)
report = {
    'reference': str(args.reference),
    'source': str(args.source),
    'sourceSha256': hashlib.sha256(args.source.read_bytes()).hexdigest(),
    'referenceSha256': hashlib.sha256(args.reference.read_bytes()).hexdigest(),
    'method': 'Local Blender adaptation of existing rigged human with reference-projected jacket front and modeled clothing/accessories.',
    'limitations': ['Face remains the supplied base character, not exact reference identity.', 'Hidden surfaces inferred; garment construction approximated.', 'Blink and mouth morphs are approximate, not production facial topology or phoneme lip sync.', 'Procedural idle/walk/talking loops require in-game review; not motion capture.', 'Base asset license/source attribution still needs owner confirmation before distribution.'],
    'bones': len(rig.data.bones),
    'meshObjects': len(asset_objects) - 1,
    'vertices': sum(len(o.data.vertices) for o in asset_objects if o.type == 'MESH'),
    'triangles': sum(len(p.vertices) - 2 for o in asset_objects if o.type == 'MESH' for p in o.data.polygons),
    'clips': ['Idle', 'Walk', 'Talking', 'Face_Blink_And_Speech'],
    'files': {p.name: p.stat().st_size for p in args.output.iterdir() if p.is_file()},
}
(args.output / 'asset-report.json').write_text(json.dumps(report, indent=2) + '\n')
print('CHARACTER_EXPORT', json.dumps(report))
