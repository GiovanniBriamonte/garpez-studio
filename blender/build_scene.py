import bpy
import bmesh
import math
import os
import sys
HERE = os.path.dirname(os.path.abspath(__file__))   # all paths are relative to this folder

from mathutils import Vector

bpy.ops.wm.read_factory_settings(use_empty=True)

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
mode = argv[0] if len(argv) > 0 else "preview"

is_square = mode in ("preview_sq", "final_1x1")
is_final = mode in ("final_16x9", "final_1x1")

scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = 112 if is_final else 48
scene.cycles.use_adaptive_sampling = True
scene.cycles.adaptive_threshold = 0.012 if is_final else 0.02
scene.cycles.use_denoising = True
scene.cycles.denoiser = 'OPENIMAGEDENOISE'
scene.cycles.denoising_input_passes = 'RGB_ALBEDO_NORMAL'

scene.cycles.max_bounces = 10
scene.cycles.diffuse_bounces = 4
scene.cycles.glossy_bounces = 6
scene.cycles.transmission_bounces = 8
scene.cycles.transparent_max_bounces = 8

scene.view_settings.view_transform = 'AgX'
scene.view_settings.look = 'AgX - Medium High Contrast'
scene.view_settings.exposure = 0.0

W = 0.500
H = 0.460
FOOT_H = 0.008
CHASSIS_CZ = FOOT_H + H / 2.0  # 0.238 m
CRT_CZ_REL = 0.029
CRT_CZ = CHASSIS_CZ + CRT_CZ_REL  # 0.267 m

# ==============================================================================
# MATERIALS
# ==============================================================================
SCRATCH_K = float(os.environ.get('SCRATCH_K', '2.24'))
SCRATCH_BUMP = float(os.environ.get('SCRATCH_BUMP', '0.245'))

def make_chassis_material(with_silkscreen=True):
    name = "Chassis_Slate_Front" if with_silkscreen else "Chassis_Slate_Body"
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()

    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])

    tex_coord = nt.nodes.new("ShaderNodeTexCoord")

    # Fine bead-blasted powder-coat grain (~0.15mm)
    noise_fine = nt.nodes.new("ShaderNodeTexNoise")
    noise_fine.inputs["Scale"].default_value = 3800.0
    noise_fine.inputs["Detail"].default_value = 6.0
    noise_fine.inputs["Roughness"].default_value = 0.65
    nt.links.new(tex_coord.outputs["Object"], noise_fine.inputs["Vector"])

    # Subtle macro molding/coat variation
    noise_macro = nt.nodes.new("ShaderNodeTexNoise")
    noise_macro.inputs["Scale"].default_value = 28.0
    noise_macro.inputs["Detail"].default_value = 3.0
    nt.links.new(tex_coord.outputs["Object"], noise_macro.inputs["Vector"])

    # Dark-medium warm slate grey powder-coated chassis (~#4f5155 - #57595d in final sRGB)
    mix_col = nt.nodes.new("ShaderNodeMix")
    mix_col.data_type = 'RGBA'
    mix_col.inputs["A"].default_value = (0.046, 0.047, 0.050, 1.0)
    mix_col.inputs["B"].default_value = (0.054, 0.055, 0.059, 1.0)
    nt.links.new(noise_macro.outputs["Fac"], mix_col.inputs["Factor"])

    map_r = nt.nodes.new("ShaderNodeMapRange")
    map_r.inputs["From Min"].default_value = 0.2
    map_r.inputs["From Max"].default_value = 0.8
    map_r.inputs["To Min"].default_value = 0.40
    map_r.inputs["To Max"].default_value = 0.47
    # broad smudges: some areas a little glossier, as handled plastic is
    smudge = nt.nodes.new("ShaderNodeTexNoise")
    smudge.inputs["Scale"].default_value = 7.0
    smudge.inputs["Detail"].default_value = 4.0
    smudge.inputs["Roughness"].default_value = 0.6
    nt.links.new(tex_coord.outputs["Object"], smudge.inputs["Vector"])
    smr = nt.nodes.new("ShaderNodeMapRange")
    smr.inputs["From Min"].default_value = 0.35; smr.inputs["From Max"].default_value = 0.7
    smr.inputs["To Min"].default_value = -0.07; smr.inputs["To Max"].default_value = 0.06
    nt.links.new(smudge.outputs["Fac"], smr.inputs["Value"])
    rough_add0 = nt.nodes.new("ShaderNodeMath"); rough_add0.operation = 'ADD'
    nt.links.new(map_r.outputs["Result"], rough_add0.inputs[0]); nt.links.new(smr.outputs["Result"], rough_add0.inputs[1])
    scr_map = nt.nodes.new("ShaderNodeMapping")
    scr_map.inputs["Scale"].default_value = (1.15, 1.15, 1.15); scr_map.inputs["Location"].default_value = (0.37, 0.61, 0.0)
    nt.links.new(tex_coord.outputs["Object"], scr_map.inputs["Vector"])
    scr_r = nt.nodes.new("ShaderNodeTexImage"); scr_r.image = bpy.data.images.load(os.path.join(HERE, "assets", "pp_rough.jpg"), check_existing=True)
    scr_r.image.colorspace_settings.name = 'Non-Color'; scr_r.extension = 'REPEAT'
    nt.links.new(scr_map.outputs["Vector"], scr_r.inputs["Vector"])
    scr_k = nt.nodes.new("ShaderNodeMath"); scr_k.operation = 'MULTIPLY_ADD'
    scr_k.inputs[1].default_value = SCRATCH_K; scr_k.inputs[2].default_value = -0.232 * SCRATCH_K
    nt.links.new(scr_r.outputs["Color"], scr_k.inputs[0])
    rough_add = nt.nodes.new("ShaderNodeMath"); rough_add.operation = 'ADD'; rough_add.use_clamp = True
    nt.links.new(rough_add0.outputs["Value"], rough_add.inputs[0]); nt.links.new(scr_k.outputs["Value"], rough_add.inputs[1])
    scr_h = nt.nodes.new("ShaderNodeTexImage"); scr_h.image = bpy.data.images.load(os.path.join(HERE, "assets", "pp_disp.jpg"), check_existing=True)
    scr_h.image.colorspace_settings.name = 'Non-Color'; scr_h.extension = 'REPEAT'
    nt.links.new(scr_map.outputs["Vector"], scr_h.inputs["Vector"])
    nt.links.new(noise_fine.outputs["Fac"], map_r.inputs["Value"])

    if with_silkscreen:
        tex_img = nt.nodes.new("ShaderNodeTexImage")
        img = bpy.data.images.load(os.path.join(HERE, "build", "tex", "silkscreen_labels.png"))
        img.colorspace_settings.name = 'sRGB'
        tex_img.image = img
        tex_img.extension = 'CLIP'
        nt.links.new(tex_coord.outputs["UV"], tex_img.inputs["Vector"])

        # Crisp light cool-grey micro-silkscreen ink (~#c8ccd1 in final sRGB)
        mix_ink = nt.nodes.new("ShaderNodeMix")
        mix_ink.data_type = 'RGBA'
        mix_ink.inputs["B"].default_value = (0.56, 0.58, 0.61, 1.0)
        nt.links.new(tex_img.outputs["Alpha"], mix_ink.inputs["Factor"])
        nt.links.new(mix_col.outputs["Result"], mix_ink.inputs["A"])
        nt.links.new(mix_ink.outputs["Result"], bsdf.inputs["Base Color"])

        mix_r = nt.nodes.new("ShaderNodeMix")
        mix_r.data_type = 'FLOAT'
        mix_r.inputs["B"].default_value = 0.32
        nt.links.new(tex_img.outputs["Alpha"], mix_r.inputs["Factor"])
        nt.links.new(rough_add.outputs["Value"], mix_r.inputs["A"])
        nt.links.new(mix_r.outputs["Result"], bsdf.inputs["Roughness"])

        math_ink = nt.nodes.new("ShaderNodeMath")
        math_ink.operation = 'MULTIPLY'
        math_ink.inputs[1].default_value = 0.25
        nt.links.new(tex_img.outputs["Alpha"], math_ink.inputs[0])

        math_bump = nt.nodes.new("ShaderNodeMath")
        math_bump.operation = 'ADD'
        nt.links.new(noise_fine.outputs["Fac"], math_bump.inputs[0])
        nt.links.new(math_ink.outputs["Value"], math_bump.inputs[1])
        bump_src = math_bump.outputs["Value"]
    else:
        nt.links.new(mix_col.outputs["Result"], bsdf.inputs["Base Color"])
        nt.links.new(rough_add.outputs["Value"], bsdf.inputs["Roughness"])
        bump_src = noise_fine.outputs["Fac"]

    bsdf.inputs["Metallic"].default_value = 0.0
    bsdf.inputs["Specular IOR Level"].default_value = 0.5

    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.14
    bump.inputs["Distance"].default_value = 0.00018
    nt.links.new(bump_src, bump.inputs["Height"])

    grain = nt.nodes.new("ShaderNodeTexNoise")
    grain.inputs["Scale"].default_value = 2600.0
    grain.inputs["Detail"].default_value = 1.0
    grain.inputs["Roughness"].default_value = 0.5
    nt.links.new(tex_coord.outputs["Object"], grain.inputs["Vector"])
    bump2 = nt.nodes.new("ShaderNodeBump")
    bump2.inputs["Strength"].default_value = 0.4
    bump2.inputs["Distance"].default_value = 0.00020
    nt.links.new(grain.outputs["Fac"], bump2.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], bump2.inputs["Normal"])
    bump3 = nt.nodes.new("ShaderNodeBump")
    bump3.inputs["Strength"].default_value = SCRATCH_BUMP
    bump3.inputs["Distance"].default_value = 0.00012
    nt.links.new(scr_h.outputs["Color"], bump3.inputs["Height"])
    nt.links.new(bump2.outputs["Normal"], bump3.inputs["Normal"])
    nt.links.new(bump3.outputs["Normal"], bsdf.inputs["Normal"])
    gmr = nt.nodes.new("ShaderNodeMapRange")
    gmr.inputs["From Min"].default_value = 0.3; gmr.inputs["From Max"].default_value = 0.7
    gmr.inputs["To Min"].default_value = 0.965; gmr.inputs["To Max"].default_value = 1.035
    nt.links.new(grain.outputs["Fac"], gmr.inputs["Value"])
    old = bsdf.inputs["Base Color"].links[0].from_socket
    gmul = nt.nodes.new("ShaderNodeMix"); gmul.data_type = 'RGBA'; gmul.blend_type = 'MULTIPLY'
    gmul.inputs["Factor"].default_value = 1.0
    nt.links.new(old, gmul.inputs["A"]); nt.links.new(gmr.outputs["Result"], gmul.inputs["B"])
    nt.links.new(gmul.outputs["Result"], bsdf.inputs["Base Color"])

    return mat

def make_bezel_mask_material():
    mat = bpy.data.materials.new("CRT_Black_Mask")
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (0.004, 0.004, 0.005, 1.0)
    bsdf.inputs["Roughness"].default_value = 0.20
    bsdf.inputs["Specular IOR Level"].default_value = 0.50
    bsdf.inputs["Coat Weight"].default_value = 0.14
    bsdf.inputs["Coat Roughness"].default_value = 0.12
    return mat

def make_crt_glass_material():
    mat = bpy.data.materials.new("CRT_Curved_Glass")
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")

    # Pure transmissive soda-lime CRT glass (Transmission=1.0 -> zero milky haze)
    bsdf.inputs["Base Color"].default_value = (0.86, 0.90, 0.88, 1.0)
    bsdf.inputs["Transmission Weight"].default_value = 1.0
    bsdf.inputs["IOR"].default_value = 1.52
    bsdf.inputs["Roughness"].default_value = 0.026
    bsdf.inputs["Specular IOR Level"].default_value = 0.62
    bsdf.inputs["Coat Weight"].default_value = 0.25
    bsdf.inputs["Coat Roughness"].default_value = 0.016
    bsdf.inputs["Coat IOR"].default_value = 1.55

    # Architectural transparent shadow so studio diffuse lights illuminate phosphor evenly through glass
    lp = nt.nodes.new("ShaderNodeLightPath")
    transp = nt.nodes.new("ShaderNodeBsdfTransparent")
    transp.inputs["Color"].default_value = (0.86, 0.90, 0.88, 1.0)
    mix_s = nt.nodes.new("ShaderNodeMixShader")
    nt.links.new(lp.outputs["Is Shadow Ray"], mix_s.inputs["Fac"])
    nt.links.new(bsdf.outputs["BSDF"], mix_s.inputs[1])
    nt.links.new(transp.outputs["BSDF"], mix_s.inputs[2])
    nt.links.new(mix_s.outputs["Shader"], out.inputs["Surface"])
    return mat

def make_phosphor_material():
    mat = bpy.data.materials.new("CRT_Phosphor_Screen")
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])

    tex_coord = nt.nodes.new("ShaderNodeTexCoord")
    wave = nt.nodes.new("ShaderNodeTexWave")
    wave.wave_type = 'BANDS'
    wave.bands_direction = 'X'
    wave.inputs["Scale"].default_value = 1200.0
    nt.links.new(tex_coord.outputs["Object"], wave.inputs["Vector"])

    # Authentic dark olive-slate phosphor (#2b302e - #343937 in final sRGB)
    mix = nt.nodes.new("ShaderNodeMix")
    mix.data_type = 'RGBA'
    mix.inputs["A"].default_value = (0.032, 0.038, 0.035, 1.0)
    mix.inputs["B"].default_value = (0.040, 0.047, 0.044, 1.0)
    nt.links.new(wave.outputs["Fac"], mix.inputs["Factor"])
    nt.links.new(mix.outputs["Result"], bsdf.inputs["Base Color"])

    bsdf.inputs["Roughness"].default_value = 0.72
    bsdf.inputs["Specular IOR Level"].default_value = 0.05
    return mat

def make_brushed_chrome_material():
    mat = bpy.data.materials.new("Brushed_Chrome_Emblem")
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])

    tex_coord = nt.nodes.new("ShaderNodeTexCoord")
    mapping = nt.nodes.new("ShaderNodeMapping")
    # Horizontal brushed streaks across local X
    mapping.inputs["Scale"].default_value = (8.0, 520.0, 520.0)
    nt.links.new(tex_coord.outputs["Object"], mapping.inputs["Vector"])

    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 4.5
    noise.inputs["Detail"].default_value = 10.0
    noise.inputs["Roughness"].default_value = 0.70
    nt.links.new(mapping.outputs["Vector"], noise.inputs["Vector"])

    mix_col = nt.nodes.new("ShaderNodeMix")
    mix_col.data_type = 'RGBA'
    mix_col.inputs["A"].default_value = (0.56, 0.58, 0.61, 1.0)
    mix_col.inputs["B"].default_value = (0.86, 0.88, 0.90, 1.0)
    nt.links.new(noise.outputs["Fac"], mix_col.inputs["Factor"])
    nt.links.new(mix_col.outputs["Result"], bsdf.inputs["Base Color"])

    bsdf.inputs["Metallic"].default_value = 0.96
    bsdf.inputs["Anisotropic"].default_value = 0.50

    map_r = nt.nodes.new("ShaderNodeMapRange")
    map_r.inputs["From Min"].default_value = 0.2
    map_r.inputs["From Max"].default_value = 0.8
    map_r.inputs["To Min"].default_value = 0.16
    map_r.inputs["To Max"].default_value = 0.28
    nt.links.new(noise.outputs["Fac"], map_r.inputs["Value"])
    nt.links.new(map_r.outputs["Result"], bsdf.inputs["Roughness"])

    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.14
    bump.inputs["Distance"].default_value = 0.00005
    nt.links.new(noise.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    return mat

def make_screw_material():
    mat = bpy.data.materials.new("Machined_Gunmetal_Screw")
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])

    tex_coord = nt.nodes.new("ShaderNodeTexCoord")
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 1800.0
    noise.inputs["Detail"].default_value = 4.0
    nt.links.new(tex_coord.outputs["Object"], noise.inputs["Vector"])

    bsdf.inputs["Base Color"].default_value = (0.11, 0.115, 0.122, 1.0)
    bsdf.inputs["Metallic"].default_value = 0.88

    map_r = nt.nodes.new("ShaderNodeMapRange")
    map_r.inputs["To Min"].default_value = 0.24
    map_r.inputs["To Max"].default_value = 0.34
    nt.links.new(noise.outputs["Fac"], map_r.inputs["Value"])
    nt.links.new(map_r.outputs["Result"], bsdf.inputs["Roughness"])
    return mat

def make_pbt_keycap_material(name, base_col):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])

    tex_coord = nt.nodes.new("ShaderNodeTexCoord")
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 5000.0
    noise.inputs["Detail"].default_value = 6.0
    noise.inputs["Roughness"].default_value = 0.7
    nt.links.new(tex_coord.outputs["Object"], noise.inputs["Vector"])

    bsdf.inputs["Base Color"].default_value = base_col
    bsdf.inputs["Metallic"].default_value = 0.0
    bsdf.inputs["Specular IOR Level"].default_value = 0.45
    bsdf.inputs["Subsurface Weight"].default_value = 0.02
    bsdf.inputs["Subsurface Radius"].default_value = (0.0012, 0.0012, 0.0012)

    map_r = nt.nodes.new("ShaderNodeMapRange")
    map_r.inputs["From Min"].default_value = 0.2
    map_r.inputs["From Max"].default_value = 0.8
    map_r.inputs["To Min"].default_value = 0.30
    map_r.inputs["To Max"].default_value = 0.40
    nt.links.new(noise.outputs["Fac"], map_r.inputs["Value"])
    nt.links.new(map_r.outputs["Result"], bsdf.inputs["Roughness"])

    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.14
    bump.inputs["Distance"].default_value = 0.00010
    nt.links.new(noise.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    return mat

def make_dark_cavity_material():
    mat = bpy.data.materials.new("Dark_Cavity_Matte")
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (0.003, 0.003, 0.004, 1.0)
    bsdf.inputs["Roughness"].default_value = 0.90
    bsdf.inputs["Specular IOR Level"].default_value = 0.06
    return mat

def make_rubber_foot_material():
    mat = bpy.data.materials.new("Matte_Black_Rubber")
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (0.012, 0.012, 0.013, 1.0)
    bsdf.inputs["Roughness"].default_value = 0.72
    bsdf.inputs["Specular IOR Level"].default_value = 0.20
    return mat

mat_chassis_front = make_chassis_material(with_silkscreen=True)
mat_chassis_body = make_chassis_material(with_silkscreen=False)
mat_mask = make_bezel_mask_material()
mat_glass = make_crt_glass_material()
mat_phosphor = make_phosphor_material()
mat_chrome = make_brushed_chrome_material()
mat_screw = make_screw_material()
mat_cavity = make_dark_cavity_material()
mat_rubber = make_rubber_foot_material()

# Calibrated PBT keycap colors (matching Option 2 warm yellow, light grey, dark charcoal)
mat_key_info = make_pbt_keycap_material("PBT_Key_INFO", (0.28, 0.28, 0.278, 1.0))
mat_key_dark = make_pbt_keycap_material("PBT_Key_CH", (0.032, 0.032, 0.035, 1.0))
mat_key_power = make_pbt_keycap_material("PBT_Key_POWER", (0.78, 0.53, 0.016, 1.0))

# ==============================================================================
# HELPER: ROUNDED RECT POINTS
# ==============================================================================
def rrect_points(cx, cy, w, h, r, n_arc=10):
    pts = []
    hw = w / 2.0 - r
    hh = h / 2.0 - r
    corners = [
        (cx + hw, cy + hh, 0.0),
        (cx - hw, cy + hh, math.pi / 2.0),
        (cx - hw, cy - hh, math.pi),
        (cx + hw, cy - hh, 3.0 * math.pi / 2.0),
    ]
    for kx, ky, a0 in corners:
        for i in range(n_arc + 1):
            a = a0 + (math.pi / 2.0) * (i / n_arc)
            pts.append((kx + r * math.cos(a), ky + r * math.sin(a)))
    return pts

# ==============================================================================
# 1. FRONT BEZEL FACEPLATE
# ==============================================================================
cd = bpy.data.curves.new("FrontFaceplateCurve", "CURVE")
cd.dimensions = '2D'
cd.fill_mode = 'BOTH'
EDGE_R = 0.0024                       # moulded radius on the outer edge and the screen opening
cd.extrude = 0.00558 - EDGE_R           # keeps the front face where it was
cd.bevel_depth = EDGE_R
cd.bevel_resolution = 5
cutters = bpy.data.curves.new("FaceplateHoles", "CURVE")
cutters.dimensions = '2D'
cutters.fill_mode = 'BOTH'
cutters.extrude = 0.02

def add_poly_spline(curve_data, pts):
    sp = curve_data.splines.new('POLY')
    sp.points.add(len(pts) - 1)
    for i, (px, py) in enumerate(pts):
        sp.points[i].co = (px, py, 0.0, 1.0)
    sp.use_cyclic_u = True

def add_circle_spline(curve_data, cx, cy, r, n=28):
    pts = []
    for i in range(n):
        a = 2.0 * math.pi * i / n
        pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    add_poly_spline(curve_data, pts)

add_poly_spline(cd, rrect_points(0.0, 0.0, W - 2 * EDGE_R, H - 2 * EDGE_R, 0.0040, n_arc=12))
add_poly_spline(cd, rrect_points(0.0, CRT_CZ_REL, 0.428 + 2 * EDGE_R, 0.338 + 2 * EDGE_R, 0.024 + EDGE_R, n_arc=20))

screw_positions = [
    (-0.2375,  0.2170),
    ( 0.2375,  0.2170),
    (-0.2375, -0.2170),
    ( 0.2375, -0.2170),
]
for sx, sz in screw_positions:
    add_circle_spline(cutters, sx, sz, 0.0062, n=32)

# speaker grille: 2.2 mm holes on concentric rings around a centre hole
add_circle_spline(cutters, 0.0, -0.185, 0.0011, n=16)
for ri, cnt in ((0.0050, 8), (0.0095, 15), (0.0140, 22), (0.0185, 29)):
    for k in range(cnt):
        a = 2.0 * math.pi * k / cnt
        add_circle_spline(cutters, ri * math.cos(a), -0.185 + ri * math.sin(a), 0.0011, n=14)

# 4 compact mechanical keycap sockets (~4.24% of W = 0.0212 m)
btn_xs = [0.1052, 0.1362, 0.1672, 0.1982]
btn_z = -0.1890
for bx in btn_xs:
    add_poly_spline(cutters, rrect_points(bx, btn_z, 0.0276, 0.0276, 0.0023, n_arc=6))

plate_obj = bpy.data.objects.new("FrontFaceplate", cd)
bpy.context.collection.objects.link(plate_obj)
bpy.context.view_layer.objects.active = plate_obj
plate_obj.select_set(True)
bpy.ops.object.convert(target='MESH')
plate_obj.select_set(False)

cut_obj = bpy.data.objects.new("FaceplateHoleCutter", cutters)
bpy.context.collection.objects.link(cut_obj)
bpy.context.view_layer.objects.active = cut_obj
cut_obj.select_set(True)
bpy.ops.object.convert(target='MESH')
cut_obj.select_set(False)
bpy.context.view_layer.objects.active = plate_obj
plate_obj.select_set(True)
bmod = plate_obj.modifiers.new("Holes", 'BOOLEAN'); bmod.operation = 'DIFFERENCE'; bmod.object = cut_obj; bmod.solver = 'EXACT'
bpy.ops.object.modifier_apply(modifier="Holes")
hbev = plate_obj.modifiers.new("HoleEdges", 'BEVEL'); hbev.width = 0.00035; hbev.segments = 2
hbev.limit_method = 'ANGLE'; hbev.angle_limit = math.radians(50.0); hbev.use_clamp_overlap = True
bpy.ops.object.modifier_apply(modifier="HoleEdges")
plate_obj.select_set(False)
bpy.data.objects.remove(cut_obj, do_unlink=True)

bm = bmesh.new()
bm.from_mesh(plate_obj.data)
uv_layer = bm.loops.layers.uv.verify()
x_min_uv, x_max_uv = 0.0966, 0.2150
z_min_uv, z_max_uv = -0.2050, -0.1600

for f in bm.faces:
    f.smooth = abs(f.normal.z) <= 0.98
    for loop in f.loops:
        vx, vy, vz = loop.vert.co
        u = (vx - x_min_uv) / (x_max_uv - x_min_uv)
        v = (vy - z_min_uv) / (z_max_uv - z_min_uv)
        loop[uv_layer].uv = (u, v)

bm.to_mesh(plate_obj.data)
bm.free()

plate_obj.rotation_euler = (math.radians(90), 0.0, 0.0)
plate_obj.location = (0.0, 0.00558, CHASSIS_CZ)
plate_obj.data.materials.append(mat_chassis_front)

# ==============================================================================
# 2. RECESSED CRT BEZEL TUNNEL & BLACK MASK
# ==============================================================================
def build_bezel_funnel():
    bm = bmesh.new()
    rings_spec = [
        # starts right where the rounded lip of the opening ends and slopes straight inward,
        # covering the opening's inner wall and its rear edge: one continuous surface, no step
        (0.4284, 0.3384, 0.0242, 0.0026),
        (0.4240, 0.3340, 0.0235, 0.0160),
        (0.4140, 0.3230, 0.0215, 0.0220),
        (0.4050, 0.3120, 0.0200, 0.0290),
        (0.4000, 0.3060, 0.0195, 0.0350),
        (0.4000, 0.3060, 0.0195, 0.0440),
    ]
    n_arc = 24
    ring_verts = []
    for rw, rh, rr, ry in rings_spec:
        pts = rrect_points(0.0, CRT_CZ, rw, rh, rr, n_arc=n_arc)
        verts = [bm.verts.new((px, ry, pz)) for (px, pz) in pts]
        ring_verts.append(verts)

    n_pts = len(ring_verts[0])
    for r_i in range(len(ring_verts) - 1):
        r0 = ring_verts[r_i]
        r1 = ring_verts[r_i + 1]
        for i in range(n_pts):
            ni = (i + 1) % n_pts
            f = bm.faces.new((r0[i], r0[ni], r1[ni], r1[i]))
            f.smooth = True

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    mesh = bpy.data.meshes.new("CRT_Bezel_Funnel")
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new("CRT_Bezel_Funnel", mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat_chassis_body)
    return obj

def build_black_mask():
    bm = bmesh.new()
    rings_spec = [
        (0.403, 0.309, 0.020, 0.0370),
        (0.401, 0.307, 0.0195, 0.0310),
        (0.394, 0.299, 0.0185, 0.0255),
        (0.386, 0.290, 0.0175, 0.0265),
        (0.382, 0.286, 0.0170, 0.0340),
        (0.382, 0.286, 0.0170, 0.0460),
    ]
    n_arc = 24
    ring_verts = []
    for rw, rh, rr, ry in rings_spec:
        pts = rrect_points(0.0, CRT_CZ, rw, rh, rr, n_arc=n_arc)
        verts = [bm.verts.new((px, ry, pz)) for (px, pz) in pts]
        ring_verts.append(verts)

    n_pts = len(ring_verts[0])
    for r_i in range(len(ring_verts) - 1):
        r0 = ring_verts[r_i]
        r1 = ring_verts[r_i + 1]
        for i in range(n_pts):
            ni = (i + 1) % n_pts
            f = bm.faces.new((r0[i], r0[ni], r1[ni], r1[i]))
            f.smooth = True

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    mesh = bpy.data.meshes.new("CRT_Black_Mask")
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new("CRT_Black_Mask", mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat_mask)
    return obj

build_bezel_funnel()
build_black_mask()

# ==============================================================================
# 3. CURVED CRT GLASS & RECESSED PHOSPHOR TUBE
# ==============================================================================
def crt_surface_y(x, z_rel, base_y=0.0140, curve_depth=0.0210):
    u = x / 0.198
    v = z_rel / 0.149
    return base_y + curve_depth * (0.52 * u * u + 0.48 * v * v + 0.05 * u * u * v * v)

def build_curved_grid(name, half_w, half_h, nx, nz, base_y, curve_depth, mat, solidify_thickness=0.0):
    bm = bmesh.new()
    grid = []
    for iz in range(nz + 1):
        row = []
        v = (iz / nz) * 2.0 - 1.0
        z_rel = v * half_h
        for ix in range(nx + 1):
            u = (ix / nx) * 2.0 - 1.0
            x = u * half_w
            y = crt_surface_y(x, z_rel, base_y=base_y, curve_depth=curve_depth)
            row.append(bm.verts.new((x, y, CRT_CZ + z_rel)))
        grid.append(row)

    for iz in range(nz):
        for ix in range(nx):
            f = bm.faces.new((grid[iz][ix], grid[iz][ix+1], grid[iz+1][ix+1], grid[iz+1][ix]))
            f.smooth = True

    for f in bm.faces:
        if f.normal.y > 0:
            f.normal_flip()

    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)

    if solidify_thickness > 0.0:
        mod = obj.modifiers.new("Solidify", 'SOLIDIFY')
        mod.thickness = solidify_thickness
        mod.offset = -1.0
        mod.use_rim = True

    return obj

build_curved_grid("CRT_Glass", 0.200, 0.151, 96, 72, base_y=0.0140, curve_depth=0.0210, mat=mat_glass, solidify_thickness=0.0050)
build_curved_grid("CRT_Phosphor", 0.204, 0.155, 80, 60, base_y=0.0210, curve_depth=0.0200, mat=mat_phosphor, solidify_thickness=0.0)

# ==============================================================================
# 4. CORNER SCREWS & COUNTERSUNK POCKETS
# ==============================================================================
def build_torx_screw(name, cx, cz, rot_deg):
    bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=0.0066, depth=0.008, location=(cx, 0.006, cz), rotation=(math.radians(90), 0, 0))
    pocket = bpy.context.active_object
    pocket.name = f"{name}_Pocket"
    pocket.data.materials.append(mat_cavity)

    bm = bmesh.new()
    n_ang = 48
    rings = [
        (0.0050, 0.0032),
        (0.0050, 0.0022),
        (0.0046, 0.0014),
        (0.0036, 0.0009),
        (0.0026, 0.0008),
    ]
    ring_verts = []
    for rad, yp in rings:
        rv = []
        for i in range(n_ang):
            a = 2.0 * math.pi * i / n_ang
            rv.append(bm.verts.new((rad * math.cos(a), yp, rad * math.sin(a))))
        ring_verts.append(rv)

    torx_rim = []
    torx_bot = []
    for i in range(n_ang):
        a = 2.0 * math.pi * i / n_ang
        r_torx = 0.00185 + 0.00042 * math.cos(6.0 * a)
        torx_rim.append(bm.verts.new((r_torx * math.cos(a), 0.00085, r_torx * math.sin(a))))
        torx_bot.append(bm.verts.new((r_torx * 0.92 * math.cos(a), 0.0028, r_torx * 0.92 * math.sin(a))))
    ring_verts.append(torx_rim)
    ring_verts.append(torx_bot)

    for r_i in range(len(ring_verts) - 1):
        r0 = ring_verts[r_i]
        r1 = ring_verts[r_i + 1]
        for i in range(n_ang):
            ni = (i + 1) % n_ang
            f = bm.faces.new((r0[i], r0[ni], r1[ni], r1[i]))
            f.smooth = True

    center_v = bm.verts.new((0.0, 0.0029, 0.0))
    for i in range(n_ang):
        ni = (i + 1) % n_ang
        f = bm.faces.new((torx_bot[i], torx_bot[ni], center_v))
        f.smooth = False

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.location = (cx, 0.0, cz)
    obj.rotation_euler = (0.0, math.radians(rot_deg), 0.0)
    obj.data.materials.append(mat_screw)
    return obj

screw_rots = [17.0, 74.0, -39.0, 112.0]
for idx, ((sx, sz), rdeg) in enumerate(zip(screw_positions, screw_rots)):
    build_torx_screw(f"CornerScrew_{idx}", sx, CHASSIS_CZ + sz, rdeg)

# ==============================================================================
# 5. SPEAKER GRILLE ACOUSTIC BAFFLE + BUTTON SOCKET WELLS
# ==============================================================================
bpy.ops.mesh.primitive_plane_add(size=1.0, location=(0.0, 0.0115, CHASSIS_CZ - 0.185), rotation=(math.radians(90), 0, 0))
baffle = bpy.context.active_object
baffle.name = "Speaker_Acoustic_Baffle"
baffle.scale = (0.046, 0.046, 1.0)
baffle.data.materials.append(mat_cavity)

bpy.ops.mesh.primitive_plane_add(size=1.0, location=(0.1517, 0.0140, CHASSIS_CZ + btn_z), rotation=(math.radians(90), 0, 0))
well = bpy.context.active_object
well.name = "Button_Socket_Well"
well.scale = (0.136, 0.042, 1.0)
well.data.materials.append(mat_cavity)

# ==============================================================================
# 6. SCULPTED PBT MECHANICAL KEYCAPS
# ==============================================================================
def build_keycap(name, cx, cz, mat):
    bm = bmesh.new()
    levels = [
        (0.0092, 0.0014,  0.0075, 0.0),
        (0.0092, 0.0014, -0.0004, 0.0),
        (0.0089, 0.0015, -0.0026, 0.0),
        (0.0083, 0.0016, -0.0048, 0.0),
        (0.0077, 0.0016, -0.0058, 0.0),
        (0.0072, 0.0015, -0.0061, 0.0),
    ]
    n_arc = 6
    rings = []
    for hw, r, yp, _ in levels:
        pts = rrect_points(0.0, 0.0, hw * 2.0, hw * 2.0, r, n_arc=n_arc)
        rv = [bm.verts.new((px, yp, pz)) for (px, pz) in pts]
        rings.append(rv)

    n_pts = len(rings[0])
    for r_i in range(len(rings) - 1):
        r0 = rings[r_i]
        r1 = rings[r_i + 1]
        for i in range(n_pts):
            ni = (i + 1) % n_pts
            f = bm.faces.new((r0[i], r0[ni], r1[ni], r1[i]))
            f.smooth = True

    top_inner1 = []
    top_inner2 = []
    for (px, pz) in rrect_points(0.0, 0.0, 0.0096, 0.0096, 0.0008, n_arc=n_arc):
        dist2 = (px*px + pz*pz) / (0.0072*0.0072)
        y_dish = -0.0061 + 0.0011 * (1.0 - min(dist2, 1.0))
        top_inner1.append(bm.verts.new((px, y_dish, pz)))
    for (px, pz) in rrect_points(0.0, 0.0, 0.0044, 0.0044, 0.0004, n_arc=n_arc):
        dist2 = (px*px + pz*pz) / (0.0072*0.0072)
        y_dish = -0.0061 + 0.0011 * (1.0 - min(dist2, 1.0))
        top_inner2.append(bm.verts.new((px, y_dish, pz)))

    for r0, r1 in [(rings[-1], top_inner1), (top_inner1, top_inner2)]:
        for i in range(n_pts):
            ni = (i + 1) % n_pts
            f = bm.faces.new((r0[i], r0[ni], r1[ni], r1[i]))
            f.smooth = True

    center_v = bm.verts.new((0.0, -0.0061 + 0.00115, 0.0))
    for i in range(n_pts):
        ni = (i + 1) % n_pts
        f = bm.faces.new((top_inner2[i], top_inner2[ni], center_v))
        f.smooth = True

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.location = (cx, 0.0, cz)
    obj.scale = (1.3, 1.0, 1.3)
    obj.data.materials.append(mat)
    return obj

key_specs = [
    ("Key_INFO",  btn_xs[0], CHASSIS_CZ + btn_z, mat_key_info),
    ("Key_CHm",   btn_xs[1], CHASSIS_CZ + btn_z, mat_key_dark),
    ("Key_CHp",   btn_xs[2], CHASSIS_CZ + btn_z, mat_key_dark),
    ("Key_POWER", btn_xs[3], CHASSIS_CZ + btn_z, mat_key_power),
]
for kname, kx, kz, kmat in key_specs:
    build_keycap(kname, kx, kz, kmat)

# ==============================================================================
# 7. RAISED 3D GARPEZ METALLIC RELIEF LOGO (IN RILIEVO)
# ==============================================================================
bpy.ops.import_curve.svg(filepath=os.path.join(HERE, "assets", "garpez-logo.svg"))
logo_objs = [o for o in bpy.data.objects if o.type == 'CURVE']
logo_obj = logo_objs[0]
logo_obj.name = "Garpez_Logo_3D"

logo_obj.data.dimensions = '3D'
bpy.ops.object.select_all(action='DESELECT')
bpy.context.view_layer.objects.active = logo_obj
logo_obj.select_set(True)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

target_logo_w = 0.098
all_pts = []
for sp in logo_obj.data.splines:
    for bp in sp.bezier_points:
        all_pts.append(bp.co.copy())
    for p in sp.points:
        all_pts.append(p.co.xyz.copy())

min_x = min(p.x for p in all_pts)
max_x = max(p.x for p in all_pts)
min_y = min(p.y for p in all_pts)
max_y = max(p.y for p in all_pts)
cx_l = (min_x + max_x) / 2.0
cy_l = (min_y + max_y) / 2.0
sf = target_logo_w / (max_x - min_x)

for sp in logo_obj.data.splines:
    sp.resolution_u = 14
    for bp in sp.bezier_points:
        bp.co = Vector(((bp.co.x - cx_l) * sf, (bp.co.y - cy_l) * sf, 0.0))
        bp.handle_left = Vector(((bp.handle_left.x - cx_l) * sf, (bp.handle_left.y - cy_l) * sf, 0.0))
        bp.handle_right = Vector(((bp.handle_right.x - cx_l) * sf, (bp.handle_right.y - cy_l) * sf, 0.0))

def make_cast_metal():
    mat = bpy.data.materials.new("Logo_Cast_Metal"); mat.use_nodes = True
    nt = mat.node_tree; nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial"); bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    tc = nt.nodes.new("ShaderNodeTexCoord")
    n1 = nt.nodes.new("ShaderNodeTexNoise"); n1.inputs["Scale"].default_value = 900.0
    n1.inputs["Detail"].default_value = 8.0; n1.inputs["Roughness"].default_value = 0.75
    nt.links.new(tc.outputs["Object"], n1.inputs["Vector"])
    mix = nt.nodes.new("ShaderNodeMix"); mix.data_type = 'RGBA'
    mix.inputs["A"].default_value = (0.52, 0.53, 0.55, 1.0); mix.inputs["B"].default_value = (0.70, 0.71, 0.73, 1.0)
    nt.links.new(n1.outputs["Fac"], mix.inputs["Factor"]); nt.links.new(mix.outputs["Result"], bsdf.inputs["Base Color"])
    bsdf.inputs["Metallic"].default_value = 1.0
    mr = nt.nodes.new("ShaderNodeMapRange"); mr.inputs["To Min"].default_value = 0.22; mr.inputs["To Max"].default_value = 0.36
    nt.links.new(n1.outputs["Fac"], mr.inputs["Value"]); nt.links.new(mr.outputs["Result"], bsdf.inputs["Roughness"])
    bump = nt.nodes.new("ShaderNodeBump"); bump.inputs["Strength"].default_value = 0.25; bump.inputs["Distance"].default_value = 0.00008
    nt.links.new(n1.outputs["Fac"], bump.inputs["Height"]); nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    return mat

def finish_logo(obj, extrude, offset, bevel_w, mat, y):
    obj.data.dimensions = '2D'; obj.data.fill_mode = 'BOTH'
    obj.data.extrude = extrude; obj.data.offset = offset; obj.data.bevel_depth = 0.0
    bpy.ops.object.select_all(action='DESELECT')
    bpy.context.view_layer.objects.active = obj; obj.select_set(True)
    bpy.ops.object.convert(target='MESH'); obj.select_set(False)
    bm_l = bmesh.new(); bm_l.from_mesh(obj.data)
    bmesh.ops.remove_doubles(bm_l, verts=bm_l.verts, dist=0.00004)
    bmesh.ops.recalc_face_normals(bm_l, faces=bm_l.faces)
    for f in bm_l.faces: f.smooth = abs(f.normal.z) < 0.7
    bm_l.to_mesh(obj.data); bm_l.free()
    if bevel_w > 0:
        bev = obj.modifiers.new("LogoBevel", 'BEVEL'); bev.width = bevel_w; bev.segments = 3
        bev.limit_method = 'ANGLE'; bev.angle_limit = math.radians(40.0); bev.use_clamp_overlap = True
    obj.data.materials.clear(); obj.data.materials.append(mat)
    obj.rotation_euler = (math.radians(90), 0.0, 0.0)
    obj.location = (-0.161, y, CHASSIS_CZ - 0.185)

from shapely.geometry import Polygon
from shapely.ops import unary_union
from mathutils.geometry import interpolate_bezier
def _ring(sp):
    pts = []; bps = list(sp.bezier_points); n = len(bps)
    for i in range(n):
        p0, p1 = bps[i], bps[(i + 1) % n]
        seg = interpolate_bezier(p0.co, p0.handle_right, p1.handle_left, p1.co, 10)
        pts += [(v.x, v.y) for v in seg[:-1]]
    return pts
shape = None
for sp in logo_obj.data.splines:
    r = _ring(sp)
    if len(r) < 3: continue
    pg = Polygon(r).buffer(0)
    shape = pg if shape is None else shape.symmetric_difference(pg)   # even-odd: counters stay open
LOGO_OFFSET = 0.0019
grown = shape.buffer(LOGO_OFFSET, join_style=1, resolution=8)
cd_out = bpy.data.curves.new("LogoOutlineCurve", "CURVE"); cd_out.dimensions = '2D'
for g in (grown.geoms if hasattr(grown, "geoms") else [grown]):
    for ring in [g.exterior] + list(g.interiors):
        add_poly_spline(cd_out, list(ring.coords)[:-1])
outline_obj = bpy.data.objects.new("Garpez_Logo_Outline", cd_out)
bpy.context.collection.objects.link(outline_obj)
finish_logo(logo_obj, 0.0023, 0.0, 0.00095, make_cast_metal(), -0.0024)
finish_logo(outline_obj, 0.0010, 0.0, 0.0003, mat_mask, -0.0006)
print("LOGO DIMS", tuple(logo_obj.dimensions), tuple(outline_obj.dimensions))

# ==============================================================================
# 8. MAIN REAR CHASSIS BODY & RUBBER FEET
# ==============================================================================
cd_collar = bpy.data.curves.new("ChassisCollarCurve", "CURVE")
cd_collar.dimensions = '2D'
cd_collar.fill_mode = 'BOTH'
cd_collar.extrude = 0.022
cd_collar.bevel_depth = 0.0035
cd_collar.bevel_resolution = 2
add_poly_spline(cd_collar, rrect_points(0.0, 0.0, W - 0.004, H - 0.004, 0.004, n_arc=10))
add_poly_spline(cd_collar, rrect_points(0.0, CRT_CZ_REL, 0.452, 0.362, 0.030, n_arc=10))   # opening larger than the faceplate's: the collar never shows through it

collar_obj = bpy.data.objects.new("ChassisCollar", cd_collar)
bpy.context.collection.objects.link(collar_obj)
bpy.context.view_layer.objects.active = collar_obj
collar_obj.select_set(True)
bpy.ops.object.convert(target='MESH')
collar_obj.select_set(False)
collar_obj.rotation_euler = (math.radians(90), 0.0, 0.0)
collar_obj.location = (0.0, 0.011 + 0.0235, CHASSIS_CZ)
collar_obj.data.materials.append(mat_chassis_body)

cd_body = bpy.data.curves.new("ChassisBodyCurve", "CURVE")
cd_body.dimensions = '2D'
cd_body.fill_mode = 'BOTH'
cd_body.extrude = 0.150
cd_body.bevel_depth = 0.0045
cd_body.bevel_resolution = 4
cd_body.bevel_resolution = 2
add_poly_spline(cd_body, rrect_points(0.0, 0.0, W - 0.004, H - 0.004, 0.004, n_arc=10))

body_obj = bpy.data.objects.new("ChassisBody", cd_body)
bpy.context.collection.objects.link(body_obj)
bpy.context.view_layer.objects.active = body_obj
body_obj.select_set(True)
bpy.ops.object.convert(target='MESH')
body_obj.select_set(False)
body_obj.rotation_euler = (math.radians(90), 0.0, 0.0)
body_obj.location = (0.0, 0.050 + 0.152, CHASSIS_CZ)
body_obj.data.materials.append(mat_chassis_body)

for fx in (-0.185, 0.185):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(fx, 0.145, FOOT_H / 2.0))
    foot = bpy.context.active_object
    foot.name = f"RubberFoot_{fx:+.3f}"
    foot.scale = (0.062, 0.250, FOOT_H)
    bpy.ops.object.transform_apply(scale=True)
    bev = foot.modifiers.new("Bevel", 'BEVEL')
    bev.width = 0.0012
    bev.segments = 2
    foot.data.materials.append(mat_rubber)

# ==============================================================================
# 9. CAMERA SETUP
# ==============================================================================
cam_data = bpy.data.cameras.new("StudioCamera")
cam_data.lens = 152.0 if is_square else 95.0
cam_data.sensor_width = 36.0
cam_data.sensor_fit = 'HORIZONTAL'
cam_data.dof.use_dof = False

cam_obj = bpy.data.objects.new("StudioCamera", cam_data)
bpy.context.collection.objects.link(cam_obj)
cam_obj.location = (0.0, -2.86, CHASSIS_CZ)
cam_obj.rotation_euler = (math.radians(90), 0.0, 0.0)
scene.camera = cam_obj

aspect_h_over_w = 1.0 if is_square else (9.0 / 16.0)
sensor_h = cam_data.sensor_width * aspect_h_over_w
dist_to_wall = 2.86 + 1.65
z_top_frame = CHASSIS_CZ + dist_to_wall * (sensor_h / (2.0 * cam_data.lens))

# ==============================================================================
# 10. STUDIO CYCLORAMA & SEAMLESS VERTICAL GRADIENT BACKDROP
# ==============================================================================
bm_cyc = bmesh.new()
prof = []
for y in [-12.0, -4.0, -1.5, -0.3, 0.0, 0.25, 0.45]:
    prof.append((y, 0.0))
r_cove = 1.20
for i in range(1, 33):
    a = (math.pi / 2.0) * (i / 32.0)
    prof.append((0.45 + r_cove * math.sin(a), r_cove * (1.0 - math.cos(a))))
prof.append((0.45 + r_cove, 2.20))
prof.append((0.45 + r_cove, 4.00))

xs_cyc = [-6.0, 6.0]
grid_cyc = []
for py, pz in prof:
    row = [bm_cyc.verts.new((px, py, pz)) for px in xs_cyc]
    grid_cyc.append(row)

for i in range(len(grid_cyc) - 1):
    f = bm_cyc.faces.new((grid_cyc[i][0], grid_cyc[i][1], grid_cyc[i+1][1], grid_cyc[i+1][0]))
    f.smooth = True

bmesh.ops.recalc_face_normals(bm_cyc, faces=bm_cyc.faces)
cyc_mesh = bpy.data.meshes.new("StudioCyclorama")
bm_cyc.to_mesh(cyc_mesh)
bm_cyc.free()
cyc_obj = bpy.data.objects.new("StudioCyclorama", cyc_mesh)
bpy.context.collection.objects.link(cyc_obj)

mat_cyc = bpy.data.materials.new("Studio_Cyclorama_Mat")
mat_cyc.use_nodes = True
nt = mat_cyc.node_tree
nt.nodes.clear()
out = nt.nodes.new("ShaderNodeOutputMaterial")

tex_coord = nt.nodes.new("ShaderNodeTexCoord")
sep_xyz = nt.nodes.new("ShaderNodeSeparateXYZ")
nt.links.new(tex_coord.outputs["Object"], sep_xyz.inputs["Vector"])

lp = nt.nodes.new("ShaderNodeLightPath")

# Physical light studio floor (#ededed) receiving contact shadow & AO under TV feet
bsdf_floor = nt.nodes.new("ShaderNodeBsdfPrincipled")
bsdf_floor.inputs["Base Color"].default_value = (0.52, 0.52, 0.53, 1.0)
bsdf_floor.inputs["Roughness"].default_value = 0.88
bsdf_floor.inputs["Specular IOR Level"].default_value = 0.08

# Dark diffuse velvet flag for glossy/transmission rays
bsdf_flag = nt.nodes.new("ShaderNodeBsdfDiffuse")
bsdf_flag.inputs["Color"].default_value = (0.008, 0.008, 0.009, 1.0)
bsdf_flag.inputs["Roughness"].default_value = 1.0

# Smooth vertical backdrop ramp (#ededed floor -> #787878 mid -> #0d0d0f top of frame)
ramp = nt.nodes.new("ShaderNodeValToRGB")
ramp.color_ramp.interpolation = 'B_SPLINE'   # smooth sweep, no step
e0 = ramp.color_ramp.elements[0]
e0.position = 0.0
e0.color = (0.471, 0.471, 0.477, 1.0)
e1 = ramp.color_ramp.elements[1]
e1.position = 1.0
e1.color = (0.0085, 0.0085, 0.0098, 1.0)  # Renders to ~#0d0d0f at top of frame!

e_m1 = ramp.color_ramp.elements.new(0.22)
e_m1.color = (0.224, 0.224, 0.228, 1.0)
e_m2 = ramp.color_ramp.elements.new(0.50)
e_m2.color = (0.084, 0.084, 0.086, 1.0)
e_m3 = ramp.color_ramp.elements.new(0.78)
e_m3.color = (0.028, 0.028, 0.031, 1.0)

map_z = nt.nodes.new("ShaderNodeMapRange")
map_z.interpolation_type = 'SMOOTHSTEP'
map_z.inputs["From Min"].default_value = 0.0
map_z.inputs["From Max"].default_value = z_top_frame * 1.02
nt.links.new(sep_xyz.outputs["Z"], map_z.inputs["Value"])
nt.links.new(map_z.outputs["Result"], ramp.inputs["Fac"])

emis_wall = nt.nodes.new("ShaderNodeEmission")
emis_wall.inputs["Strength"].default_value = 1.0
nt.links.new(ramp.outputs["Color"], emis_wall.inputs["Color"])

map_blend = nt.nodes.new("ShaderNodeMapRange")
map_blend.interpolation_type = 'SMOOTHSTEP'
map_blend.inputs["From Min"].default_value = 0.24
map_blend.inputs["From Max"].default_value = 0.78
nt.links.new(sep_xyz.outputs["Y"], map_blend.inputs["Value"])

mix_sh = nt.nodes.new("ShaderNodeMixShader")
nt.links.new(map_blend.outputs["Result"], mix_sh.inputs["Fac"])
nt.links.new(bsdf_floor.outputs["BSDF"], mix_sh.inputs[1])
nt.links.new(emis_wall.outputs["Emission"], mix_sh.inputs[2])

math_ray = nt.nodes.new("ShaderNodeMath")
math_ray.operation = 'MAXIMUM'
nt.links.new(lp.outputs["Is Glossy Ray"], math_ray.inputs[0])
nt.links.new(lp.outputs["Is Transmission Ray"], math_ray.inputs[1])

mix_glossy = nt.nodes.new("ShaderNodeMixShader")
nt.links.new(math_ray.outputs["Value"], mix_glossy.inputs["Fac"])
nt.links.new(mix_sh.outputs["Shader"], mix_glossy.inputs[1])
nt.links.new(bsdf_flag.outputs["BSDF"], mix_glossy.inputs[2])
nt.links.new(mix_glossy.outputs["Shader"], out.inputs["Surface"])

cyc_obj.data.materials.append(mat_cyc)

# ==============================================================================
# 11. STUDIO LIGHTING, LIGHT LINKING & CRT SOFTBOX REFLECTORS
# ==============================================================================
world = bpy.data.worlds.new("StudioWorld")
scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes["Background"]
bg.inputs["Color"].default_value = (0.006, 0.006, 0.007, 1.0)
bg.inputs["Strength"].default_value = 0.25

# Light linking collections so logo lighting never leaks onto CRT glass or blows out chassis
col_logo_only = bpy.data.collections.new("LL_Logo_Only")
col_logo_only.objects.link(logo_obj)
col_logo_only.objects.link(outline_obj)

col_chassis = bpy.data.collections.new("LL_Chassis")
for _n in ("FrontFaceplate", "ChassisBody", "ChassisCollar", "CRT_Bezel_Funnel"):
    col_chassis.objects.link(bpy.data.objects[_n])
col_glass_only = bpy.data.collections.new("LL_Glass_Only")
for _n in ("CRT_Glass", "CRT_Black_Mask", "CRT_Phosphor"):
    col_glass_only.objects.link(bpy.data.objects[_n])
col_logo_and_face = bpy.data.collections.new("LL_Logo_And_Face")
col_logo_and_face.objects.link(logo_obj)
col_logo_and_face.objects.link(outline_obj)
col_logo_and_face.objects.link(plate_obj)

def add_area_light(name, loc, target, size_x, size_y, energy, color=(1.0, 0.995, 0.985),
                   texture_path=None, visible_diffuse=True, visible_glossy=True,
                   visible_transmission=True, receiver_col=None):
    ldata = bpy.data.lights.new(name, 'AREA')
    ldata.shape = 'RECTANGLE'
    ldata.size = size_x
    ldata.size_y = size_y
    ldata.energy = energy
    ldata.color = color
    if texture_path:
        ldata.use_nodes = True
        nt_l = ldata.node_tree
        emis = nt_l.nodes["Emission"]
        tc = nt_l.nodes.new("ShaderNodeTexCoord")
        ti = nt_l.nodes.new("ShaderNodeTexImage")
        img = bpy.data.images.load(texture_path)
        ti.image = img
        nt_l.links.new(tc.outputs["UV"], ti.inputs["Vector"])
        nt_l.links.new(ti.outputs["Color"], emis.inputs["Color"])
    lobj = bpy.data.objects.new(name, ldata)
    bpy.context.collection.objects.link(lobj)
    lobj.location = loc
    lobj.visible_camera = False
    lobj.visible_diffuse = visible_diffuse
    lobj.visible_glossy = visible_glossy
    lobj.visible_transmission = visible_transmission
    if receiver_col is not None:
        lobj.light_linking.receiver_collection = receiver_col
    direction = Vector(target) - Vector(loc)
    lobj.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
    return lobj

# A. Diffuse Studio Key & Fill (visible_glossy=False AND visible_transmission=False -> zero CRT glass glare!)
add_area_light(
    "Top_Studio_Diffuse_Key",
    loc=(0.0, -1.05, 1.35),
    target=(0.0, 0.10, 0.05),
    size_x=2.60,
    size_y=1.40,
    energy=29.0,
    color=(0.98, 0.99, 1.0),
    visible_diffuse=True,
    visible_glossy=False,
    visible_transmission=False
)

add_area_light(
    "Front_Soft_Diffuse_Fill",
    loc=(-0.18, -1.95, 0.60),
    target=(0.0, 0.0, CHASSIS_CZ),
    size_x=1.80,
    size_y=1.20,
    energy=20.0,
    color=(0.98, 0.99, 1.0),
    visible_diffuse=True,
    visible_glossy=False,
    visible_transmission=False
)

# Gentle side rim strips (subtle chamfer catchlights without blowing out chassis)
add_area_light(
    "Side_Strip_Left",
    loc=(-1.20, -0.45, 0.38),
    target=(0.0, 0.02, CHASSIS_CZ),
    size_x=0.28,
    size_y=0.75,
    energy=4.5,
    visible_diffuse=True,
    visible_glossy=True,
    visible_transmission=False
)
add_area_light(
    "Side_Strip_Right",
    loc=(1.20, -0.45, 0.38),
    target=(0.0, 0.02, CHASSIS_CZ),
    size_x=0.28,
    size_y=0.75,
    energy=4.0,
    visible_diffuse=True,
    visible_glossy=True,
    visible_transmission=False
)

# B. Dedicated Glossy Softbox Reflectors on upper curved CRT glass (no diffuse glare!)
add_area_light(
    "Glass_Softbox_Left",
    loc=(-0.31, -0.82, 0.56),
    target=(-0.06, 0.02, CRT_CZ + 0.095),
    size_x=0.17,
    size_y=0.34,
    energy=12.0,
    texture_path=os.path.join(HERE, "build", "tex", "softbox_scrim.png"),
    visible_diffuse=False,
    visible_glossy=True,
    visible_transmission=False,
    receiver_col=col_glass_only
)

add_area_light(
    "Glass_Softbox_Right",
    loc=(0.14, -0.80, 0.57),
    target=(0.04, 0.02, CRT_CZ + 0.095),
    size_x=0.44,
    size_y=0.36,
    energy=15.0,
    texture_path=os.path.join(HERE, "build", "tex", "softbox_scrim.png"),
    visible_diffuse=False,
    visible_glossy=True,
    visible_transmission=False,
    receiver_col=col_glass_only
)

add_area_light(
    "Glass_Top_Rim_Strip",
    loc=(0.0, -0.62, 0.86),
    target=(0.0, 0.02, CRT_CZ + 0.138),
    size_x=0.95,
    size_y=0.14,
    energy=7.5,
    visible_diffuse=False,
    visible_glossy=True,
    visible_transmission=False,
    receiver_col=col_glass_only
)

# Big soft sheen card behind the camera, a touch below centre: an even satin sheen on the plastic,
# brighter toward the bottom, so the top never washes out again. Glossy only, chassis only.
add_area_light(
    "Chassis_Sheen_Card",
    loc=(0.0, -3.9, -0.25),
    target=(0.0, 0.0, CHASSIS_CZ - 0.02),
    size_x=3.2,
    size_y=2.2,
    energy=float(os.environ.get("SHEEN", "55")),
    visible_diffuse=False,
    visible_glossy=True,
    visible_transmission=False,
    receiver_col=col_chassis
)

# C. Light-Linked Chrome Logo Sculpting (gives brushed chrome garpez rich silver speculars + soft cast shadow!)
add_area_light(
    "Logo_Chrome_Studio_Card",
    loc=(-0.22, -1.65, 0.28),
    target=(-0.161, 0.0, CHASSIS_CZ - 0.185),
    size_x=0.95,
    size_y=0.48,
    energy=8.0,
    texture_path=os.path.join(HERE, "build", "tex", "softbox_scrim.png"),
    visible_diffuse=False,
    visible_glossy=True,
    visible_transmission=False,
    receiver_col=col_logo_only
)

add_area_light(
    "Logo_Raking_Key",
    loc=(-0.38, -0.70, 0.65),
    target=(-0.161, 0.0, CHASSIS_CZ - 0.185),
    size_x=0.22,
    size_y=0.22,
    energy=9.0,
    visible_diffuse=True,
    visible_glossy=False,
    visible_transmission=False,
    receiver_col=col_logo_and_face
)

# ==============================================================================
# 12. COMPOSITOR: SUBTLE MEDIUM-FORMAT FILM GRAIN & NATURAL OPTICAL VIGNETTE
# ==============================================================================
scene.use_nodes = True
cnt = scene.node_tree
cnt.nodes.clear()

r_layers = cnt.nodes.new("CompositorNodeRLayers")
comp_out = cnt.nodes.new("CompositorNodeComposite")

mask_vig = cnt.nodes.new("CompositorNodeEllipseMask")
mask_vig.x = 0.5
mask_vig.y = 0.5
mask_vig.width = 0.96
mask_vig.height = 0.96

blur_vig = cnt.nodes.new("CompositorNodeBlur")
blur_vig.filter_type = 'GAUSS'
blur_vig.use_relative = True
blur_vig.factor_x = 32.0
blur_vig.factor_y = 32.0
cnt.links.new(mask_vig.outputs["Mask"], blur_vig.inputs["Image"])

mix_vig = cnt.nodes.new("CompositorNodeMixRGB")
mix_vig.blend_type = 'MULTIPLY'
mix_vig.inputs["Fac"].default_value = 0.07
cnt.links.new(r_layers.outputs["Image"], mix_vig.inputs[1])
cnt.links.new(blur_vig.outputs["Image"], mix_vig.inputs[2])

tex_grain = bpy.data.textures.new("FilmGrainTex", type='NOISE')
node_tex = cnt.nodes.new("CompositorNodeTexture")
node_tex.texture = tex_grain

desat = cnt.nodes.new("CompositorNodeHueSat")
desat.inputs["Saturation"].default_value = 0.0
cnt.links.new(node_tex.outputs["Color"], desat.inputs["Image"])

mix_grain = cnt.nodes.new("CompositorNodeMixRGB")
mix_grain.blend_type = 'SOFT_LIGHT'
mix_grain.inputs["Fac"].default_value = 0.014
cnt.links.new(mix_vig.outputs["Image"], mix_grain.inputs[1])
cnt.links.new(desat.outputs["Image"], mix_grain.inputs[2])

cnt.links.new(mix_grain.outputs["Image"], comp_out.inputs["Image"])

bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, "garpez_tv.blend"))
print("SCENE_SAVED")
