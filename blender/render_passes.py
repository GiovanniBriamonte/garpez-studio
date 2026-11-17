import bpy, sys, json, time
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
argv = sys.argv[sys.argv.index("--")+1:]
mode = argv[0]; RX, RY = int(argv[1]), int(argv[2]); out = argv[3]
import os
HERE = os.path.dirname(os.path.abspath(__file__))
bpy.ops.wm.open_mainfile(filepath=os.path.join(HERE, "garpez_tv.blend"))
s = bpy.context.scene  # Cycles uses all CPU threads; for GPU see README
s.render.resolution_x, s.render.resolution_y, s.render.resolution_percentage = RX, RY, 100
s.cycles.samples = 96
if mode == "spill": s.cycles.samples = 256
s.render.image_settings.file_format = 'PNG'; s.render.image_settings.color_mode = 'RGB'
O = bpy.data.objects; cam = s.camera
KEYS = ["Key_INFO", "Key_CHm", "Key_CHp", "Key_POWER"]
def emis(name, col, strength):
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; nt.nodes.clear()
    o = nt.nodes.new("ShaderNodeOutputMaterial"); e = nt.nodes.new("ShaderNodeEmission")
    e.inputs[0].default_value = (*col, 1); e.inputs[1].default_value = strength
    nt.links.new(e.outputs[0], o.inputs[0]); return m
def setmat(obj, m): obj.data.materials.clear(); obj.data.materials.append(m)
def view(x, z): 
    c = world_to_camera_view(s, cam, Vector((x, 0, z))); return c.x, c.y
def border(x0, z0, x1, z1):
    a = view(x0, z0); b = view(x1, z1)
    s.render.use_border = True; s.render.use_crop_to_border = False
    s.render.border_min_x, s.render.border_max_x = a[0], b[0]
    s.render.border_min_y, s.render.border_max_y = a[1], b[1]
    return [a[0], 1 - b[1], b[0], 1 - a[1]]
ph = O["CRT_Phosphor"]
CRT_CZ = 0.267; KZ = O["Key_INFO"].location.z
info = {}
info["crtbox"] = [*view(-0.232, CRT_CZ + 0.19)[:1], 1 - view(0, CRT_CZ + 0.19)[1], view(0.232, 0)[0], 1 - view(0, CRT_CZ - 0.19)[1]]
info["keybox"] = [view(0.080, 0)[0], 1 - view(0, KZ + 0.022)[1], view(0.222, 0)[0], 1 - view(0, KZ - 0.022)[1]]
hs = 0.0138 + 0.0022
info["keys"] = []
for nm in KEYS:
    x = O[nm].location.x
    a = view(x - hs, KZ + hs); b = view(x + hs, KZ - hs)
    info["keys"].append({"c": [view(x, KZ)[0], 1 - view(x, KZ)[1]], "box": [a[0], 1 - a[1], b[0], 1 - b[1]]})
json.dump(info, open(out + ".json", "w"))

if mode == "dark":
    m = bpy.data.materials.new("Black"); m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]; b.inputs["Base Color"].default_value = (0,0,0,1)
    b.inputs["Roughness"].default_value = .7; b.inputs["Specular IOR Level"].default_value = .0
    setmat(ph, m); border(-0.232, CRT_CZ - 0.19, 0.232, CRT_CZ + 0.19)
elif mode == "keys":
    for nm in KEYS: O[nm].location.y += 0.0042
    border(0.080, KZ - 0.022, 0.222, KZ + 0.022)
elif mode == "spill":
    for o in O:
        if o.type == 'LIGHT': o.hide_render = True
    s.world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0
    for n in bpy.data.materials["Studio_Cyclorama_Mat"].node_tree.nodes:
        if n.type == 'EMISSION': n.inputs["Strength"].default_value = 0
    setmat(ph, emis("ScreenOn", (1,1,1), 6.0)); O["CRT_Glass"].visible_camera = False
    s.view_settings.view_transform = 'Standard'; s.view_settings.look = 'None'; s.render.use_compositing = False
elif mode == "mask":
    m = bpy.data.materials.new("HO"); m.use_nodes = True; nt = m.node_tree; nt.nodes.clear()
    o = nt.nodes.new("ShaderNodeOutputMaterial"); h = nt.nodes.new("ShaderNodeHoldout"); nt.links.new(h.outputs[0], o.inputs[0])
    for ob in O:
        if ob.type == 'MESH' and ob != ph: setmat(ob, m)
    O["CRT_Glass"].hide_render = True; setmat(ph, emis("W", (1,1,1), 1))
    s.render.film_transparent = True; s.cycles.samples = 16; s.cycles.use_denoising = False
    s.view_settings.view_transform = 'Standard'; s.view_settings.look = 'None'; s.render.use_compositing = False
    s.render.image_settings.color_mode = 'RGBA'
s.render.filepath = out
t = time.time(); bpy.ops.render.render(write_still=True); print("DONE", mode, round(time.time() - t), "s")
