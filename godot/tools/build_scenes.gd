extends Node
## Scene generator. Run headless after importing the project:
##   godot --headless --path godot res://tools/build_scenes.tscn
## Builds every .tscn of the prototype by code, so the scenes are valid by construction.
## (Scenes can be edited normally in the Godot editor afterwards.)

const LAYER_WORLD: int = 1
const LAYER_PLAYER: int = 2
const LAYER_VEHICLE: int = 4
const LAYER_INTERACT: int = 8
const BODY_Y_OFFSET: float = -0.12
const WHEEL_CONN_Y: float = 0.6


func _ready() -> void:
	_build_materials()
	_build_crate_model()
	_build_post_fx()
	_build_cargo_pickup()
	_build_delivery_point()
	_build_warehouse()
	_build_fuel_station()
	_build_truck()
	_build_player()
	_build_hud()
	_build_world()
	print("BUILD_OK")
	get_tree().quit()


# --- helpers -----------------------------------------------------------------

func _mat(color: Color, rough: float = 0.8, metal: float = 0.0) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = color
	m.roughness = rough
	m.metallic = metal
	return m


func _add(parent: Node, child: Node, node_name: String) -> Node:
	child.name = node_name
	parent.add_child(child)
	return child


func _mesh(parent: Node, node_name: String, mesh: Mesh, mat: Material, pos: Vector3 = Vector3.ZERO, rot_deg: Vector3 = Vector3.ZERO) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	mi.material_override = mat
	mi.position = pos
	mi.rotation_degrees = rot_deg
	_add(parent, mi, node_name)
	return mi


func _box(size: Vector3) -> BoxMesh:
	var b := BoxMesh.new()
	b.size = size
	return b


func _shape_box(parent: Node, node_name: String, size: Vector3, pos: Vector3 = Vector3.ZERO) -> CollisionShape3D:
	var cs := CollisionShape3D.new()
	var s := BoxShape3D.new()
	s.size = size
	cs.shape = s
	cs.position = pos
	_add(parent, cs, node_name)
	return cs


func _static_box(parent: Node, node_name: String, pos: Vector3, size: Vector3, mat: Material, rot_y_deg: float = 0.0) -> StaticBody3D:
	var sb := StaticBody3D.new()
	sb.position = pos
	sb.rotation_degrees.y = rot_y_deg
	sb.collision_layer = LAYER_WORLD
	sb.collision_mask = 0
	_add(sb, _make_shape_box(size), "CollisionShape3D")
	_mesh(sb, "Visual", _box(size), mat)
	_add(parent, sb, node_name)
	return sb


func _make_shape_box(size: Vector3) -> CollisionShape3D:
	var cs := CollisionShape3D.new()
	var s := BoxShape3D.new()
	s.size = size
	cs.shape = s
	return cs


func _label(parent: Node, node_name: String, text: String, anchors: Vector4, offsets: Vector4, halign: int, font_size: int) -> Label:
	var l := Label.new()
	l.text = text
	l.anchor_left = anchors.x
	l.anchor_top = anchors.y
	l.anchor_right = anchors.z
	l.anchor_bottom = anchors.w
	l.offset_left = offsets.x
	l.offset_top = offsets.y
	l.offset_right = offsets.z
	l.offset_bottom = offsets.w
	l.horizontal_alignment = halign as HorizontalAlignment
	l.add_theme_font_size_override("font_size", font_size)
	l.add_theme_color_override("font_outline_color", Color.BLACK)
	l.add_theme_constant_override("outline_size", 8)
	_add(parent, l, node_name)
	return l


func _set_owner(node: Node, root: Node) -> void:
	for child in node.get_children():
		child.owner = root
		if child.scene_file_path == "":
			_set_owner(child, root)


func _save(root: Node, path: String) -> void:
	_set_owner(root, root)
	var packed := PackedScene.new()
	var err: int = packed.pack(root)
	if err != OK:
		push_error("pack failed for %s: %d" % [path, err])
		return
	err = ResourceSaver.save(packed, path)
	if err != OK:
		push_error("save failed for %s: %d" % [path, err])
	root.free()


# --- PBR material library (res://materials/*.tres) -----------------------------

func _tex_mat(mat_name: String, folder: String, tiling: float, metal: float = 0.0, rough_mult: float = 1.0, normal_depth: float = 1.0) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	var base: String = "res://assets/textures/%s/" % folder
	m.albedo_texture = load(base + "albedo.jpg")
	m.normal_enabled = true
	m.normal_texture = load(base + "normal.jpg")
	m.normal_scale = normal_depth
	m.roughness_texture = load(base + "roughness.jpg")
	m.roughness = rough_mult
	m.metallic = metal
	m.uv1_triplanar = true
	m.uv1_world_triplanar = true
	m.uv1_scale = Vector3.ONE * tiling
	m.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS_ANISOTROPIC
	m.resource_name = mat_name
	if metal < 0.1:
		m.metallic_specular = 0.2  # avoid blown-out grazing highlights on soil/asphalt/brick
	ResourceSaver.save(m, "res://materials/%s.tres" % mat_name)
	return m


func _build_materials() -> void:
	DirAccess.make_dir_recursive_absolute("res://materials")
	var asphalt := _tex_mat("asphalt", "asphalt", 0.22, 0.0, 1.0)
	asphalt.albedo_color = Color(0.5, 0.5, 0.52)
	ResourceSaver.save(asphalt, "res://materials/asphalt.tres")
	var concrete := _tex_mat("concrete", "concrete", 0.3, 0.0, 1.0)
	concrete.albedo_color = Color(0.78, 0.78, 0.76)
	ResourceSaver.save(concrete, "res://materials/concrete.tres")
	var brick := _tex_mat("brick", "brick", 0.16, 0.0, 1.0)  # bigger bricks (was 0.35 = tiny)
	brick.roughness_texture = null
	brick.roughness = 0.8  # matte, no plastic shine
	ResourceSaver.save(brick, "res://materials/brick.tres")
	_tex_mat("metal_rust", "metal_rust", 0.4, 0.9, 0.55)   # metal: metallic 0.9, roughness ~0.4-0.5
	_tex_mat("corrugated", "corrugated", 0.35, 0.85, 0.6)
	_tex_mat("wood", "wood", 0.5, 0.0, 0.8)                 # wood: roughness ~0.7
	# Ground: dark earth under the grass. Base layer repeats every ~3 m (fine detail, with normal map);
	# a second layer at ~60 m breaks the repetition so no pattern is visible from far away.
	var soil := _tex_mat("ground_grass", "grass", 0.35, 0.0, 1.0)
	soil.albedo_color = Color(0.82, 0.6, 0.42)           # brown earth (the green texture is multiplied)
	soil.roughness_texture = null
	soil.roughness = 1.0
	soil.normal_scale = 1.6                                # light reacts to the imperfections
	soil.uv2_triplanar = true
	soil.uv2_world_triplanar = true
	soil.uv2_scale = Vector3.ONE * 0.016
	soil.detail_enabled = true
	soil.detail_uv_layer = BaseMaterial3D.DETAIL_UV_2
	soil.detail_albedo = load("res://assets/textures/concrete/albedo.jpg")  # mottled macro variation
	soil.detail_blend_mode = BaseMaterial3D.BLEND_MODE_MUL
	soil.detail_normal = load("res://assets/textures/concrete/normal.jpg")
	ResourceSaver.save(soil, "res://materials/ground_grass.tres")
	var liner := load("res://materials/wood.tres").duplicate() as StandardMaterial3D
	liner.cull_mode = BaseMaterial3D.CULL_FRONT
	liner.uv1_world_triplanar = false
	liner.uv1_scale = Vector3.ONE * 1.2
	liner.albedo_color = Color(0.75, 0.68, 0.6)
	ResourceSaver.save(liner, "res://materials/cargo_liner.tres")
	var line := StandardMaterial3D.new()
	line.albedo_color = Color(0.9, 0.88, 0.78)
	line.roughness = 0.85
	ResourceSaver.save(line, "res://materials/road_line.tres")
	var paint := ShaderMaterial.new()
	paint.shader = load("res://materials/truck_paint.gdshader")
	paint.set_shader_parameter("cab_color", Color(0.3, 0.42, 0.55))   # faded blue like the concept art
	paint.set_shader_parameter("bed_color", Color(0.36, 0.48, 0.6))
	paint.set_shader_parameter("rust_amount", 0.7)
	paint.set_shader_parameter("rust_albedo", load("res://assets/textures/metal_rust/albedo.jpg"))
	paint.set_shader_parameter("rust_normal", load("res://assets/textures/metal_rust/normal.jpg"))
	paint.set_shader_parameter("rust_rough", load("res://assets/textures/metal_rust/roughness.jpg"))
	ResourceSaver.save(paint, "res://materials/truck_paint.tres")
	var wheel := paint.duplicate() as ShaderMaterial
	wheel.set_shader_parameter("wheel_mode", true)
	ResourceSaver.save(wheel, "res://materials/truck_wheel.tres")


# --- model helpers -----------------------------------------------------------

func _scene_aabb(node: Node, xform: Transform3D = Transform3D.IDENTITY) -> AABB:
	var result := AABB()
	var have := false
	var t: Transform3D = xform
	if node is Node3D and node != null:
		t = xform * (node as Node3D).transform
	if node is MeshInstance3D:
		var bb: AABB = t * (node as MeshInstance3D).get_aabb()
		result = bb
		have = true
	for c in node.get_children():
		var sub: AABB = _scene_aabb(c, t)
		if sub.size != Vector3.ZERO:
			result = sub if not have else result.merge(sub)
			have = true
	return result


func _load_model(model: String) -> PackedScene:
	return load("res://assets/models/polyhaven/%s/%s.gltf" % [model, model]) as PackedScene


## Static prop from a Poly Haven model: scaled so its largest side is `target_max` metres, resting on
## the ground at `pos`, with a box collider fitted to its bounds (these never move, so primitives are cheaper than trimesh).
func _prop(parent: Node, node_name: String, model: String, pos: Vector3, rot_y_deg: float, target_max: float, collide: bool = true) -> StaticBody3D:
	var inst: Node3D = _load_model(model).instantiate()
	var bb: AABB = _scene_aabb(inst)
	var s: float = target_max / maxf(bb.size.x, maxf(bb.size.y, bb.size.z))
	var body := StaticBody3D.new()
	body.position = pos
	body.rotation_degrees.y = rot_y_deg
	body.collision_layer = LAYER_WORLD
	body.collision_mask = 0
	inst.scale = Vector3.ONE * s
	inst.position = -Vector3(bb.get_center().x, bb.position.y, bb.get_center().z) * s
	_add(body, inst, "Model")
	if collide:
		var size: Vector3 = bb.size * s
		_add(body, _make_shape_box(size), "CollisionShape3D")
		(body.get_node("CollisionShape3D") as Node3D).position = Vector3(0, size.y * 0.5, 0)
	_add(parent, body, node_name)
	return body


## Crate used on the truck bed and in the warehouse: origin at its centre, 0.8 m wide.
func _build_crate_model() -> void:
	var root := Node3D.new()
	root.name = "CrateModel"
	var inst: Node3D = _load_model("wooden_crate_01").instantiate()
	var bb: AABB = _scene_aabb(inst)
	var s: float = 0.8 / maxf(bb.size.x, maxf(bb.size.y, bb.size.z))
	inst.scale = Vector3.ONE * s
	inst.position = -bb.get_center() * s
	_add(root, inst, "Model")
	_save(root, "res://world/crate_model.tscn")


# --- scenes ------------------------------------------------------------------

func _build_cargo_pickup() -> void:
	var root := Area3D.new()
	root.name = "CargoPickup"
	root.set_script(load("res://world/cargo_pickup.gd"))
	root.collision_layer = LAYER_INTERACT
	root.collision_mask = 0
	root.add_to_group("cargo_pickup", true)
	var cs := CollisionShape3D.new()
	var sph := SphereShape3D.new()
	sph.radius = 1.6
	cs.shape = sph
	cs.position = Vector3(0, 0.6, 0)
	_add(root, cs, "CollisionShape3D")
	var crate := Node3D.new()
	_add(root, crate, "Crate")
	var model: Node3D = (load("res://world/crate_model.tscn") as PackedScene).instantiate()
	model.position = Vector3(0, 0.4, 0)
	_add(crate, model, "CrateModel")
	_save(root, "res://world/cargo_pickup.tscn")


func _build_delivery_point() -> void:
	var root := Area3D.new()
	root.name = "DeliveryPoint"
	root.set_script(load("res://world/delivery_point.gd"))
	root.collision_layer = LAYER_INTERACT
	root.collision_mask = 0
	root.add_to_group("delivery_point", true)
	var cs := CollisionShape3D.new()
	var cyl := CylinderShape3D.new()
	cyl.radius = 4.0
	cyl.height = 3.0
	cs.shape = cyl
	cs.position = Vector3(0, 1.5, 0)
	_add(root, cs, "CollisionShape3D")
	var ring_mesh := CylinderMesh.new()
	ring_mesh.top_radius = 4.0
	ring_mesh.bottom_radius = 4.0
	ring_mesh.height = 0.1
	var ring_mat := StandardMaterial3D.new()
	ring_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	ring_mat.albedo_color = Color(0.2, 0.9, 0.35, 0.45)
	ring_mat.emission_enabled = true
	ring_mat.emission = Color(0.2, 0.9, 0.35)
	ring_mat.emission_energy_multiplier = 0.6
	var ring := MeshInstance3D.new()
	ring.mesh = ring_mesh
	ring.position = Vector3(0, 0.06, 0)
	ring.set_surface_override_material(0, ring_mat)
	_add(root, ring, "Ring")
	var post := Node3D.new()
	_add(root, post, "Visual")
	_mesh(post, "Post", _box(Vector3(0.25, 3.0, 0.25)), _mat(Color(0.3, 0.3, 0.32), 0.5, 0.8), Vector3(0, 1.5, 0))
	var beacon_mat := StandardMaterial3D.new()
	beacon_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	beacon_mat.albedo_color = Color(0.2, 0.9, 0.35, 0.25)
	beacon_mat.emission_enabled = true
	beacon_mat.emission = Color(0.2, 0.9, 0.35)
	beacon_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	var beacon_mesh := CylinderMesh.new()
	beacon_mesh.top_radius = 0.6
	beacon_mesh.bottom_radius = 0.6
	beacon_mesh.height = 80.0
	_mesh(post, "Beacon", beacon_mesh, beacon_mat, Vector3(0, 40, 0))
	var sign_label := Label3D.new()
	sign_label.text = "ENTREGA"
	sign_label.font_size = 96
	sign_label.pixel_size = 0.01
	sign_label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	sign_label.outline_size = 24
	sign_label.position = Vector3(0, 3.8, 0)
	_add(root, sign_label, "Sign")
	_save(root, "res://world/delivery_point.tscn")


func _build_warehouse() -> void:
	var root := Node3D.new()
	root.name = "Warehouse"
	root.add_to_group("warehouse", true)
	var concrete: Material = load("res://materials/concrete.tres")
	var brick: Material = load("res://materials/brick.tres")
	var roof_mat: Material = load("res://materials/corrugated.tres")
	var structure := Node3D.new()
	_add(root, structure, "Structure")
	_static_box(structure, "Floor", Vector3(0, 0.1, 0), Vector3(16, 0.2, 12), concrete)
	_static_box(structure, "BackWall", Vector3(0, 2.2, -5.9), Vector3(16, 4, 0.3), brick)
	_static_box(structure, "LeftWall", Vector3(-7.85, 2.2, 0), Vector3(0.3, 4, 12), brick)
	_static_box(structure, "RightWall", Vector3(7.85, 2.2, 0), Vector3(0.3, 4, 12), brick)
	_static_box(structure, "Roof", Vector3(0, 4.5, 0), Vector3(16.6, 0.3, 12.6), roof_mat)
	_static_box(structure, "RoofBeam", Vector3(0, 4.15, 5.9), Vector3(16.6, 0.4, 0.3), _mat(Color(0.25, 0.25, 0.27), 0.5, 0.8))
	# Interior props (Poly Haven, CC0).
	var props := Node3D.new()
	_add(root, props, "Props")
	for i in 3:
		_prop(props, "Shelf%d" % (i + 1), "steel_frame_shelves_01", Vector3(-5.2 + 5.2 * i, 0.2, -5.0), 0.0, 2.3)
	_prop(props, "Door", "rollershutter_door", Vector3(7.65, 0.2, 2.0), -90.0, 3.4, false)
	_prop(props, "CementA", "cement_bag", Vector3(6.2, 0.2, -3.8), 20.0, 0.9)
	_prop(props, "CementB", "cement_bag", Vector3(6.9, 0.2, -3.2), -35.0, 0.9)
	_prop(props, "BoxA", "utility_box_01", Vector3(-7.4, 0.2, 3.2), 90.0, 1.4)
	_prop(props, "Tyre", "old_tyre", Vector3(-6.4, 0.2, 4.4), 0.0, 0.9)
	_prop(props, "Barrel", "barrel_03", Vector3(-7.1, 0.2, -2.4), 0.0, 1.0)
	var pickup_scene: PackedScene = load("res://world/cargo_pickup.tscn")
	for i in 5:
		var p: Node3D = pickup_scene.instantiate()
		p.position = Vector3(-5.0 + 2.5 * i, 0.2, -2.0)
		_add(root, p, "CargoPickup%d" % (i + 1))
	var sign_label := Label3D.new()
	sign_label.text = "ALMACÉN"
	sign_label.font_size = 128
	sign_label.pixel_size = 0.01
	sign_label.outline_size = 24
	sign_label.position = Vector3(0, 5.6, 6.4)
	_add(root, sign_label, "Sign")
	_save(root, "res://world/warehouse.tscn")


func _build_fuel_station() -> void:
	var root := Area3D.new()
	root.name = "FuelStation"
	root.collision_layer = LAYER_INTERACT
	root.collision_mask = 0
	root.add_to_group("fuel_station", true)
	var cs := CollisionShape3D.new()
	var shape := CylinderShape3D.new()
	shape.radius = 6.0
	shape.height = 4.0
	cs.shape = shape
	cs.position = Vector3(0, 2.0, 0)
	_add(root, cs, "CollisionShape3D")
	var visual := Node3D.new()
	_add(root, visual, "Visual")
	var red := _mat(Color(0.7, 0.12, 0.1), 0.45, 0.5)
	var steel: Material = load("res://materials/metal_rust.tres")
	_mesh(visual, "Island", _box(Vector3(2.0, 0.3, 8.0)), load("res://materials/concrete.tres"), Vector3(0, 0.15, 0))
	_mesh(visual, "PumpA", _box(Vector3(0.7, 1.6, 0.7)), red, Vector3(0, 1.1, -2.0))
	_mesh(visual, "PumpB", _box(Vector3(0.7, 1.6, 0.7)), red, Vector3(0, 1.1, 2.0))
	_mesh(visual, "CanopyRoof", _box(Vector3(5.0, 0.3, 9.0)), load("res://materials/corrugated.tres"), Vector3(0, 4.6, 0))
	for z in [-4.0, 4.0]:
		_mesh(visual, "Pillar", _box(Vector3(0.3, 4.5, 0.3)), steel, Vector3(0, 2.25, z))
	var body := StaticBody3D.new()
	body.collision_layer = LAYER_WORLD
	body.collision_mask = 0
	_add(body, _make_shape_box(Vector3(0.9, 1.6, 0.9)), "PumpACollision")
	(body.get_node("PumpACollision") as Node3D).position = Vector3(0, 0.8, -2.0)
	_add(body, _make_shape_box(Vector3(0.9, 1.6, 0.9)), "PumpBCollision")
	(body.get_node("PumpBCollision") as Node3D).position = Vector3(0, 0.8, 2.0)
	_add(root, body, "PumpBody")
	_prop(visual, "Jerrycan", "metal_jerrycan_green", Vector3(0.0, 0.3, 0.0), 30.0, 0.55, false)
	_prop(visual, "Tyres", "old_tyre", Vector3(1.6, 0.0, 3.6), 0.0, 0.9, false)
	var sign_label := Label3D.new()
	sign_label.text = "NAFTA\nE: cargar (camión)\nReparación $20 (a pie)"
	sign_label.font_size = 72
	sign_label.pixel_size = 0.01
	sign_label.outline_size = 20
	sign_label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	sign_label.position = Vector3(0, 6.6, 0)
	_add(root, sign_label, "Sign")
	_save(root, "res://world/fuel_station.tscn")


func _build_truck() -> void:
	var root := VehicleBody3D.new()
	root.name = "Truck"
	root.set_script(load("res://vehicles/truck.gd"))
	root.collision_layer = LAYER_VEHICLE
	root.collision_mask = LAYER_WORLD | LAYER_VEHICLE
	root.mass = 1000.0
	root.contact_monitor = true
	root.max_contacts_reported = 6
	# Collision shapes: primitives fitted to the CC0 model (dynamic bodies cannot use trimesh).
	_shape_box(root, "ChassisCollision", Vector3(2.1, 0.8, 4.8), Vector3(0, 0.8, 0.15))
	_shape_box(root, "CabCollision", Vector3(2.0, 1.2, 1.9), Vector3(0, 1.8, -1.3))
	_shape_box(root, "CargoCollision", Vector3(2.1, 0.9, 2.6), Vector3(0, 1.55, 1.25))
	# Visuals.
	var visual := Node3D.new()
	_add(root, visual, "Visual")
	var body := MeshInstance3D.new()
	body.mesh = load("res://assets/models/trucks/truck_05_body.res")
	body.material_override = load("res://materials/truck_paint.tres")
	body.position = Vector3(0, BODY_Y_OFFSET, 0)
	_add(visual, body, "Body")
	# Wooden hold seen through the open bed, and the node the crates are parented to.
	var liner := MeshInstance3D.new()
	var liner_mesh := BoxMesh.new()
	liner_mesh.size = Vector3(1.9, 0.95, 2.75)
	liner.mesh = liner_mesh
	liner.material_override = load("res://materials/cargo_liner.tres")
	liner.position = Vector3(0, 1.45, 1.2)
	_add(visual, liner, "CargoLiner")
	var cargo_box := Node3D.new()
	_add(visual, cargo_box, "CargoBox")
	cargo_box.position = Vector3(0, 1.3, 1.25)
	# Wheels: front (-Z) steers, rear drives.
	var wheel_defs := {
		"WheelFL": ["fl", Vector3(-0.915, WHEEL_CONN_Y, -1.59)], "WheelFR": ["fr", Vector3(0.915, WHEEL_CONN_Y, -1.59)],
		"WheelRL": ["rl", Vector3(-0.89, WHEEL_CONN_Y, 1.25)], "WheelRR": ["rr", Vector3(0.89, WHEEL_CONN_Y, 1.25)],
	}
	for wname: String in wheel_defs:
		var w := VehicleWheel3D.new()
		w.position = wheel_defs[wname][1]
		w.wheel_radius = 0.475
		w.wheel_rest_length = 0.25
		w.suspension_travel = 0.35
		w.suspension_stiffness = 26.0       # medium: visible dive/squat, still holds 5 crates
		w.suspension_max_force = 22000.0
		w.damping_compression = 0.45        # springs take the hit...
		w.damping_relaxation = 0.62         # ...and rebound a bit slower: bounce over bumps
		w.wheel_friction_slip = 3.0         # re-tuned each frame in truck.gd (understeer/oversteer)
		w.wheel_roll_influence = 0.22
		w.use_as_steering = wname.begins_with("WheelF")
		w.use_as_traction = wname.begins_with("WheelR")
		var wm := MeshInstance3D.new()
		wm.mesh = load("res://assets/models/trucks/truck_05_wheel_%s.res" % wheel_defs[wname][0])
		wm.material_override = load("res://materials/truck_wheel.tres")
		_add(w, wm, "WheelMesh")
		_add(root, w, wname)
	# Interaction points.
	var seat := Area3D.new()
	seat.collision_layer = LAYER_INTERACT
	seat.collision_mask = 0
	seat.add_to_group("vehicle_driver_seat", true)
	seat.position = Vector3(-1.9, 1.0, -1.3)
	var seat_cs := CollisionShape3D.new()
	var seat_shape := SphereShape3D.new()
	seat_shape.radius = 2.0
	seat_cs.shape = seat_shape
	_add(seat, seat_cs, "CollisionShape3D")
	_add(root, seat, "DriverSeat")
	var tarea := Area3D.new()
	tarea.collision_layer = 0
	tarea.collision_mask = LAYER_INTERACT
	tarea.position = Vector3(0, 1.0, 0)
	var tcs := CollisionShape3D.new()
	var tshape := SphereShape3D.new()
	tshape.radius = 4.0
	tcs.shape = tshape
	_add(tarea, tcs, "CollisionShape3D")
	_add(root, tarea, "InteractArea")
	var exit_marker := Marker3D.new()
	exit_marker.position = Vector3(-3.0, 0.3, -1.3)
	_add(root, exit_marker, "ExitMarker")
	# Exhaust / dust emitters are added by the particle rig (see _add_truck_particles).
	_add_truck_particles(root)
	# Spring-arm chase camera (top level, follows with inertia).
	var arm := SpringArm3D.new()
	arm.set_script(load("res://vehicles/chase_camera.gd"))
	arm.spring_length = 9.0
	arm.margin = 0.4
	var arm_shape := SphereShape3D.new()
	arm_shape.radius = 0.4
	arm.shape = arm_shape
	arm.collision_mask = LAYER_WORLD
	_add(root, arm, "CameraArm")
	var cam := Camera3D.new()
	cam.fov = 70
	_add(arm, cam, "Camera3D")
	_save(root, "res://vehicles/truck.tscn")


func _soft_circle() -> GradientTexture2D:
	var g := Gradient.new()
	g.set_color(0, Color(1, 1, 1, 1))
	g.set_color(1, Color(1, 1, 1, 0))
	var t := GradientTexture2D.new()
	t.gradient = g
	t.fill = GradientTexture2D.FILL_RADIAL
	t.fill_from = Vector2(0.5, 0.5)
	t.fill_to = Vector2(1.0, 0.5)
	t.width = 64
	t.height = 64
	return t


func _particle_emitter(node_name: String, pos: Vector3, color: Color, amount: int, lifetime: float, dir: Vector3, speed: Vector2, spread: float, gravity: Vector3, scale_range: Vector2, grow: float) -> GPUParticles3D:
	var p := GPUParticles3D.new()
	p.name = node_name
	p.position = pos
	p.amount = amount
	p.lifetime = lifetime
	p.local_coords = false
	p.visibility_aabb = AABB(Vector3(-6, -3, -6), Vector3(12, 8, 12))
	var pm := ParticleProcessMaterial.new()
	pm.direction = dir
	pm.spread = spread
	pm.initial_velocity_min = speed.x
	pm.initial_velocity_max = speed.y
	pm.gravity = gravity
	pm.scale_min = scale_range.x
	pm.scale_max = scale_range.y
	var curve := Curve.new()
	curve.add_point(Vector2(0, 0.4))
	curve.add_point(Vector2(1, grow))
	var ct := CurveTexture.new()
	ct.curve = curve
	pm.scale_curve = ct
	pm.color = color
	var ramp := Gradient.new()
	ramp.set_color(0, Color(1, 1, 1, 0.0))
	ramp.add_point(0.15, Color(1, 1, 1, 1.0))
	ramp.set_color(ramp.get_point_count() - 1, Color(1, 1, 1, 0.0))
	var rt := GradientTexture1D.new()
	rt.gradient = ramp
	pm.color_ramp = rt
	pm.damping_min = 0.3
	pm.damping_max = 0.8
	p.process_material = pm
	var quad := QuadMesh.new()
	quad.size = Vector2(1, 1)
	var qm := StandardMaterial3D.new()
	qm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	qm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	qm.billboard_mode = BaseMaterial3D.BILLBOARD_PARTICLES
	qm.vertex_color_use_as_albedo = true
	qm.albedo_texture = _soft_circle()
	qm.billboard_keep_scale = true
	quad.material = qm
	p.draw_pass_1 = quad
	p.emitting = false
	return p


func _add_truck_particles(root: Node) -> void:
	# Exhaust under the rear-right of the bed; smoke always while the engine runs, soot at full throttle.
	var exhaust_pos := Vector3(0.95, 0.55, 2.45)
	_add(root, _particle_emitter("ExhaustSmoke", exhaust_pos, Color(0.5, 0.5, 0.5, 0.5), 40, 2.4, Vector3(0.15, 0.5, 1.0), Vector2(0.8, 1.8), 18.0, Vector3(0, 0.5, 0), Vector2(0.35, 0.7), 3.2), "ExhaustSmoke")
	_add(root, _particle_emitter("ExhaustSoot", exhaust_pos, Color(0.02, 0.02, 0.02, 0.9), 50, 2.0, Vector3(0.15, 0.6, 1.0), Vector2(2.5, 4.0), 22.0, Vector3(0, 0.7, 0), Vector2(0.5, 1.0), 4.0), "ExhaustSoot")
	# Dust kicked up by the rear wheels on dirt/grass.
	_add(root, _particle_emitter("DustRL", Vector3(-0.89, 0.15, 1.25), Color(0.62, 0.55, 0.42, 0.55), 36, 1.3, Vector3(0, 1, 0.6), Vector2(0.8, 2.0), 35.0, Vector3(0, 0.3, 0), Vector2(0.4, 0.9), 3.0), "DustRL")
	_add(root, _particle_emitter("DustRR", Vector3(0.89, 0.15, 1.25), Color(0.62, 0.55, 0.42, 0.55), 36, 1.3, Vector3(0, 1, 0.6), Vector2(0.8, 2.0), 35.0, Vector3(0, 0.3, 0), Vector2(0.4, 0.9), 3.0), "DustRR")


func _build_player() -> void:
	var root := CharacterBody3D.new()
	root.name = "Player"
	root.set_script(load("res://player/player.gd"))
	root.collision_layer = LAYER_PLAYER
	root.collision_mask = LAYER_WORLD | LAYER_VEHICLE
	var cs := CollisionShape3D.new()
	var cap := CapsuleShape3D.new()
	cap.radius = 0.35
	cap.height = 1.8
	cs.shape = cap
	cs.position = Vector3(0, 0.9, 0)
	_add(root, cs, "CollisionShape3D")
	var head := Node3D.new()
	head.position = Vector3(0, 1.6, 0)
	_add(root, head, "Head")
	var cam := Camera3D.new()
	cam.fov = 75
	_add(head, cam, "Camera3D")
	var area := Area3D.new()
	area.collision_layer = 0
	area.collision_mask = LAYER_INTERACT
	area.position = Vector3(0, 1.0, 0)
	var acs := CollisionShape3D.new()
	var sph := SphereShape3D.new()
	sph.radius = 2.4
	acs.shape = sph
	_add(area, acs, "CollisionShape3D")
	_add(root, area, "InteractArea")
	_save(root, "res://player/player.tscn")


func _build_hud() -> void:
	var root := CanvasLayer.new()
	root.name = "HUD"
	root.set_script(load("res://ui/hud.gd"))
	var ctrl := Control.new()
	ctrl.set_anchors_preset(Control.PRESET_FULL_RECT)
	ctrl.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_add(root, ctrl, "Root")
	var L := HORIZONTAL_ALIGNMENT_LEFT
	var C := HORIZONTAL_ALIGNMENT_CENTER
	var R := HORIZONTAL_ALIGNMENT_RIGHT
	_label(ctrl, "MoneyLabel", "Dinero: $0", Vector4(0, 0, 0, 0), Vector4(20, 14, 320, 54), L, 30)
	_label(ctrl, "ObjectiveLabel", "", Vector4(1, 0, 1, 0), Vector4(-620, 14, -20, 54), R, 22)
	_label(ctrl, "DistanceLabel", "", Vector4(1, 0, 1, 0), Vector4(-620, 54, -20, 90), R, 20)
	_label(ctrl, "MessageLabel", "", Vector4(0.5, 0, 0.5, 0), Vector4(-400, 90, 400, 140), C, 28)
	_label(ctrl, "PromptLabel", "", Vector4(0.5, 1, 0.5, 1), Vector4(-300, -150, 300, -100), C, 26)
	# Truck panel (only visible while driving).
	var panel := VBoxContainer.new()
	panel.anchor_top = 1.0
	panel.anchor_bottom = 1.0
	panel.offset_left = 20
	panel.offset_top = -250
	panel.offset_right = 340
	panel.offset_bottom = -20
	panel.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_add(ctrl, panel, "TruckPanel")
	_panel_label(panel, "SpeedLabel", "Velocidad: 0 km/h")
	_panel_label(panel, "CargoLabel", "Carga: 0/3")
	_panel_label(panel, "FuelLabel", "Nafta: 100%")
	_panel_bar(panel, "FuelBar", Color(1.0, 0.7, 0.15))
	_panel_label(panel, "WearLabel", "Desgaste: 0%")
	_panel_bar(panel, "WearBar", Color(0.9, 0.3, 0.25))
	_save(root, "res://ui/hud.tscn")


func _panel_label(parent: Node, node_name: String, text: String) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_font_size_override("font_size", 24)
	l.add_theme_color_override("font_outline_color", Color.BLACK)
	l.add_theme_constant_override("outline_size", 8)
	_add(parent, l, node_name)
	return l


func _panel_bar(parent: Node, node_name: String, color: Color) -> ProgressBar:
	var bar := ProgressBar.new()
	bar.min_value = 0
	bar.max_value = 100
	bar.value = 0
	bar.show_percentage = false
	bar.custom_minimum_size = Vector2(300, 14)
	bar.modulate = color
	_add(parent, bar, node_name)
	return bar


func _static_cylinder(parent: Node, node_name: String, pos: Vector3, mesh: CylinderMesh, mat: Material) -> StaticBody3D:
	var sb := StaticBody3D.new()
	sb.position = pos
	sb.collision_layer = LAYER_WORLD
	sb.collision_mask = 0
	var cs := CollisionShape3D.new()
	var shape := CylinderShape3D.new()
	shape.radius = maxf(mesh.top_radius, mesh.bottom_radius)
	shape.height = mesh.height
	cs.shape = shape
	_add(sb, cs, "CollisionShape3D")
	_mesh(sb, "Visual", mesh, mat)
	_add(parent, sb, node_name)
	return sb


func _build_post_fx() -> void:
	var root := CanvasLayer.new()
	root.name = "PostFx"
	root.layer = 0
	var rect := ColorRect.new()
	rect.set_anchors_preset(Control.PRESET_FULL_RECT)
	rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var m := ShaderMaterial.new()
	m.shader = load("res://ui/post_fx.gdshader")
	rect.material = m
	_add(root, rect, "Overlay")
	_save(root, "res://ui/post_fx.tscn")


func _make_environment() -> Environment:
	var env := Environment.new()
	# Sky: Poly Haven HDRI (CC0) in a PanoramaSkyMaterial.
	var sky_mat := PanoramaSkyMaterial.new()
	sky_mat.panorama = load("res://assets/hdri/kloofendal_43d_clear_puresky_2k.hdr")
	var sky := Sky.new()
	sky.sky_material = sky_mat
	env.background_mode = Environment.BG_SKY
	env.sky = sky
	env.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	env.reflected_light_source = Environment.REFLECTION_SOURCE_SKY
	env.tonemap_mode = Environment.TONE_MAPPER_ACES
	env.tonemap_white = 6.0
	# Screen-space effects (Forward+ only). SDFGI / VoxelGI intentionally off.
	env.ssao_enabled = true
	env.ssao_intensity = 1.6
	env.ssao_radius = 1.5
	env.ssil_enabled = true
	env.ssil_intensity = 0.8
	env.ssr_enabled = true
	env.ssr_max_steps = 48
	env.ssr_fade_in = 0.15
	env.ssr_fade_out = 2.0
	env.ssr_depth_tolerance = 0.3
	env.glow_enabled = true
	env.glow_intensity = 0.2
	env.glow_bloom = 0.04
	env.volumetric_fog_enabled = true
	env.volumetric_fog_density = 0.02
	env.volumetric_fog_albedo = Color(0.88, 0.9, 0.95)
	env.volumetric_fog_length = 64.0
	env.volumetric_fog_ambient_inject = 1.0
	env.volumetric_fog_anisotropy = 0.0   # no glare when looking toward the sun
	env.volumetric_fog_sky_affect = 0.0
	env.fog_enabled = true
	env.fog_light_color = Color(0.68, 0.78, 0.92)
	env.fog_density = 0.0035            # horizon dissolves into haze: the map edge is never visible
	env.fog_aerial_perspective = 0.5
	env.fog_sky_affect = 0.15
	env.fog_height = -20.0
	env.ambient_light_energy = 1.4
	env.adjustment_enabled = true
	env.adjustment_brightness = 1.08
	env.adjustment_contrast = 1.05
	env.adjustment_saturation = 0.95
	return env


func _build_world() -> void:
	var half: float = 500.0  # ground is 1000 x 1000 so a delivery trip takes a while
	var root := Node3D.new()
	root.name = "World"
	root.set_script(load("res://world/world.gd"))

	var ground := _static_box(root, "Ground", Vector3(0, -0.5, 0), Vector3(half * 2, 1, half * 2), load("res://materials/ground_grass.tres"))
	ground.add_to_group("ground", true)
	# Visual terrain far larger than the 1 km playable area so the map edge never shows.
	var far_plane := PlaneMesh.new()
	far_plane.size = Vector2(12000, 12000)
	var gvis := ground.get_node("Visual") as MeshInstance3D
	gvis.mesh = far_plane
	gvis.position.y = 0.5
	gvis.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	var wall_mat: Material = load("res://materials/concrete.tres")  # invisible boundary walls (collision only)
	_static_box(root, "WallN", Vector3(0, 1, -half - 0.5), Vector3(half * 2 + 2, 2, 1), wall_mat)
	_static_box(root, "WallS", Vector3(0, 1, half + 0.5), Vector3(half * 2 + 2, 2, 1), wall_mat)
	_static_box(root, "WallW", Vector3(-half - 0.5, 1, 0), Vector3(1, 2, half * 2), wall_mat)
	_static_box(root, "WallE", Vector3(half + 0.5, 1, 0), Vector3(1, 2, half * 2), wall_mat)
	for wn in ["WallN", "WallS", "WallW", "WallE"]:
		(root.get_node(wn).get_node("Visual") as MeshInstance3D).visible = false

	var we := WorldEnvironment.new()
	we.set_script(load("res://world/sky_controller.gd"))
	we.environment = _make_environment()
	_add(root, we, "WorldEnvironment")
	# Low, warm sun (morning/afternoon) with tuned bias to avoid shadow acne.
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-24, -40, 0)
	sun.light_color = Color(1.0, 0.9, 0.76)
	sun.light_energy = 1.7
	sun.shadow_enabled = true
	sun.shadow_bias = 0.04
	sun.shadow_normal_bias = 1.2
	sun.shadow_blur = 2.5
	sun.directional_shadow_mode = DirectionalLight3D.SHADOW_PARALLEL_4_SPLITS
	sun.directional_shadow_max_distance = 160.0
	sun.light_angular_distance = 0.4
	_add(root, sun, "Sun")

	var roads := Node3D.new()
	roads.set_script(load("res://world/road_network.gd"))
	_add(root, roads, "Roads")

	var warehouse: Node3D = (load("res://world/warehouse.tscn") as PackedScene).instantiate()
	warehouse.position = Vector3(-30, 0, -30)
	_add(root, warehouse, "Warehouse")
	var truck: Node3D = (load("res://vehicles/truck.tscn") as PackedScene).instantiate()
	truck.position = Vector3(-30, 1.2, -18)
	truck.rotation_degrees.y = 180
	_add(root, truck, "Truck")
	var station: Node3D = (load("res://world/fuel_station.tscn") as PackedScene).instantiate()
	station.position = Vector3(-8, 0, 8.5)
	station.rotation_degrees.y = 90
	_add(root, station, "FuelStation")
	var dp_scene: PackedScene = load("res://world/delivery_point.tscn")
	var dp1: Node3D = dp_scene.instantiate()
	dp1.position = Vector3(300, 0, 200)
	_add(root, dp1, "DeliveryPoint1")
	var dp2: Node3D = dp_scene.instantiate()
	dp2.position = Vector3(-250, 0, 420)
	_add(root, dp2, "DeliveryPoint2")

	# Obstacles (Poly Haven models with fitted box colliders), seeded, kept off the roads and key places.
	var obstacles := Node3D.new()
	_add(root, obstacles, "Obstacles")
	var keep_clear: Array[Vector3] = [Vector3(-30, 0, -25), Vector3(-8, 0, 8), Vector3(300, 0, 200), Vector3(-250, 0, 420)]
	var rng := RandomNumberGenerator.new()
	rng.seed = 20241
	var kinds: Array = [
		["concrete_road_barrier_02", 3.2], ["barrel_03", 1.0], ["old_tyre", 0.9], ["utility_box_01", 1.3], ["cement_bag", 0.8], ["wooden_crate_01", 1.0],
	]
	var count: int = 0
	var guard: int = 0
	while count < 90 and guard < 4000:
		guard += 1
		var pos := Vector3(rng.randf_range(-480, 480), 0.0, rng.randf_range(-480, 480))
		var ok := true
		for k in keep_clear:
			if pos.distance_to(k) < 35.0:
				ok = false
		if not ok or _near_road(pos):
			continue
		count += 1
		var kind: Array = kinds[rng.randi() % kinds.size()]
		_prop(obstacles, "Obstacle%d" % count, kind[0], pos, rng.randf_range(0, 360), kind[1])
	# Guaranteed obstacles near the start so crashes are easy to find.
	_prop(obstacles, "StartBarrierA", "concrete_road_barrier_02", Vector3(-10, 0, 0), 20.0, 3.2)
	_prop(obstacles, "StartBarrierB", "concrete_road_barrier_02", Vector3(20, 0, 15), 70.0, 3.2)
	_prop(obstacles, "StartBarrierC", "concrete_road_barrier_02", Vector3(-60, 0, 40), 0.0, 3.2)
	# Speed bumps on the first road leg (suspension bounce).
	var bumps := Node3D.new()
	_add(root, bumps, "SpeedBumps")
	for bz in [60.0, 62.2, 100.0, 102.2]:
		_speed_bump(bumps, "Bump_%d" % int(bz * 10), Vector3(-30, 0, bz) if bz < 150.0 else Vector3(-30, 0, bz))
	var decorator := Node3D.new()
	decorator.set_script(load("res://world/world_decorator.gd"))
	_add(root, decorator, "Decorator")
	var player: Node3D = (load("res://player/player.tscn") as PackedScene).instantiate()
	player.position = Vector3(-24, 0.1, -22)
	player.rotation_degrees.y = 180
	_add(root, player, "Player")
	var dust := GPUParticles3D.new()
	dust.set_script(load("res://world/ambient_dust.gd"))
	dust.amount = 220
	dust.lifetime = 9.0
	dust.local_coords = false
	dust.visibility_aabb = AABB(Vector3(-30, -10, -30), Vector3(60, 20, 60))
	var dust_pm := ParticleProcessMaterial.new()
	dust_pm.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_BOX
	dust_pm.emission_box_extents = Vector3(25, 8, 25)
	dust_pm.gravity = Vector3(0.02, -0.01, 0.0)
	dust_pm.initial_velocity_min = 0.05
	dust_pm.initial_velocity_max = 0.25
	dust_pm.direction = Vector3(1, 0.2, 0.4)
	dust_pm.spread = 180.0
	dust_pm.scale_min = 0.5
	dust_pm.scale_max = 1.1
	dust_pm.turbulence_enabled = true
	dust_pm.turbulence_noise_strength = 0.3
	var dust_ramp := Gradient.new()
	dust_ramp.set_color(0, Color(1, 1, 1, 0.0))
	dust_ramp.add_point(0.2, Color(1, 1, 1, 0.22))
	dust_ramp.set_color(dust_ramp.get_point_count() - 1, Color(1, 1, 1, 0.0))
	var dust_rt := GradientTexture1D.new()
	dust_rt.gradient = dust_ramp
	dust_pm.color_ramp = dust_rt
	dust.process_material = dust_pm
	var dust_quad := QuadMesh.new()
	dust_quad.size = Vector2(0.06, 0.06)
	var dust_mat := StandardMaterial3D.new()
	dust_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	dust_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	dust_mat.billboard_mode = BaseMaterial3D.BILLBOARD_PARTICLES
	dust_mat.vertex_color_use_as_albedo = true
	dust_mat.albedo_texture = _soft_circle()
	dust_mat.albedo_color = Color(1.0, 0.95, 0.85)
	dust_quad.material = dust_mat
	dust.draw_pass_1 = dust_quad
	dust.emitting = true
	_add(root, dust, "AmbientDust")
	var hud: Node = (load("res://ui/hud.tscn") as PackedScene).instantiate()
	_add(root, hud, "HUD")
	_add(root, (load("res://ui/post_fx.tscn") as PackedScene).instantiate(), "PostFx")
	_save(root, "res://world/world.tscn")


func _near_road(pos: Vector3) -> bool:
	var q := Vector2(pos.x, pos.z)
	for road: Array in RoadNetwork.ROADS:
		for i in road.size() - 1:
			var a: Vector2 = road[i]
			var b: Vector2 = road[i + 1]
			var ab: Vector2 = b - a
			var t: float = clampf((q - a).dot(ab) / ab.length_squared(), 0.0, 1.0)
			if q.distance_to(a + ab * t) < 9.0:
				return true
	return false


func _speed_bump(parent: Node, node_name: String, pos: Vector3) -> void:
	var sb := StaticBody3D.new()
	sb.position = pos + Vector3(0, RoadNetwork.ROAD_Y - 0.12, 0)
	sb.collision_layer = LAYER_WORLD
	sb.collision_mask = 0
	var cyl := CylinderMesh.new()
	cyl.top_radius = 0.3
	cyl.bottom_radius = 0.3
	cyl.height = 7.6
	var mi := _mesh(sb, "Visual", cyl, _mat(Color(0.85, 0.75, 0.1), 0.7), Vector3.ZERO, Vector3(0, 0, 90))
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
	var cs := CollisionShape3D.new()
	var shape := CylinderShape3D.new()
	shape.radius = 0.3
	shape.height = 7.6
	cs.shape = shape
	cs.rotation_degrees = Vector3(0, 0, 90)
	_add(sb, cs, "CollisionShape3D")
	_add(parent, sb, node_name)
