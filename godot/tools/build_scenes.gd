extends Node
## Scene generator. Run headless after importing the project:
##   godot --headless --path godot res://tools/build_scenes.tscn
## Builds every .tscn of the prototype by code, so the scenes are valid by construction.
## (Scenes can be edited normally in the Godot editor afterwards.)

const LAYER_WORLD: int = 1
const LAYER_PLAYER: int = 2
const LAYER_VEHICLE: int = 4
const LAYER_INTERACT: int = 8


func _ready() -> void:
	_build_cargo_pickup()
	_build_delivery_point()
	_build_warehouse()
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
	_mesh(crate, "Box", _box(Vector3(0.8, 0.8, 0.8)), _mat(Color(0.62, 0.42, 0.22), 0.85), Vector3(0, 0.4, 0))
	_mesh(crate, "Strap", _box(Vector3(0.84, 0.1, 0.84)), _mat(Color(0.35, 0.22, 0.1), 0.9), Vector3(0, 0.4, 0))
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
	var concrete := _mat(Color(0.62, 0.62, 0.6), 0.9)
	var metal := _mat(Color(0.35, 0.4, 0.45), 0.5, 0.8)
	var structure := Node3D.new()
	_add(root, structure, "Structure")
	_static_box(structure, "Floor", Vector3(0, 0.1, 0), Vector3(16, 0.2, 12), concrete)
	_static_box(structure, "BackWall", Vector3(0, 2.2, -5.9), Vector3(16, 4, 0.3), metal)
	_static_box(structure, "LeftWall", Vector3(-7.85, 2.2, 0), Vector3(0.3, 4, 12), metal)
	_static_box(structure, "RightWall", Vector3(7.85, 2.2, 0), Vector3(0.3, 4, 12), metal)
	_static_box(structure, "Roof", Vector3(0, 4.5, 0), Vector3(16.6, 0.3, 12.6), metal)
	# Shelves along the back wall.
	_static_box(structure, "ShelfA", Vector3(-5.5, 0.8, -5.0), Vector3(3.0, 1.6, 1.0), _mat(Color(0.5, 0.36, 0.2), 0.8))
	_static_box(structure, "ShelfB", Vector3(5.5, 0.8, -5.0), Vector3(3.0, 1.6, 1.0), _mat(Color(0.5, 0.36, 0.2), 0.8))
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


func _build_truck() -> void:
	var root := VehicleBody3D.new()
	root.name = "Truck"
	root.set_script(load("res://vehicles/truck.gd"))
	root.collision_layer = LAYER_VEHICLE
	root.collision_mask = LAYER_WORLD | LAYER_VEHICLE
	root.mass = 1000.0
	root.contact_monitor = true
	root.max_contacts_reported = 6
	# Collision shapes (do not change in later phases).
	_shape_box(root, "ChassisCollision", Vector3(2.2, 0.7, 5.6), Vector3(0, 0.85, 0))
	_shape_box(root, "CabCollision", Vector3(2.1, 1.2, 1.7), Vector3(0, 1.8, -1.95))
	_shape_box(root, "CargoCollision", Vector3(2.2, 1.7, 3.4), Vector3(0, 1.85, 0.95))
	# Visuals (primitive meshes; replaced by CC0 models in phase 3).
	var visual := Node3D.new()
	_add(root, visual, "Visual")
	var paint := _mat(Color(0.55, 0.2, 0.15), 0.65, 0.3)
	var dark := _mat(Color(0.12, 0.12, 0.13), 0.6, 0.2)
	_mesh(visual, "ChassisMesh", _box(Vector3(2.2, 0.5, 5.6)), dark, Vector3(0, 0.8, 0))
	_mesh(visual, "CabMesh", _box(Vector3(2.1, 1.3, 1.7)), paint, Vector3(0, 1.75, -1.95))
	_mesh(visual, "WindshieldMesh", _box(Vector3(1.9, 0.6, 0.05)), _mat(Color(0.2, 0.3, 0.4), 0.1, 0.5), Vector3(0, 2.1, -2.82))
	_mesh(visual, "BumperMesh", _box(Vector3(2.3, 0.3, 0.2)), _mat(Color(0.6, 0.6, 0.62), 0.4, 0.9), Vector3(0, 0.75, -2.85))
	var cargo_box := Node3D.new()
	_add(visual, cargo_box, "CargoBox")
	cargo_box.position = Vector3(0, 1.85, 0.95)
	var bed_mat := _mat(Color(0.7, 0.68, 0.6), 0.8, 0.2)
	_mesh(cargo_box, "BedMesh", _box(Vector3(2.2, 0.15, 3.4)), bed_mat, Vector3(0, -0.8, 0))
	_mesh(cargo_box, "SideLeft", _box(Vector3(0.1, 1.2, 3.4)), bed_mat, Vector3(-1.05, -0.2, 0))
	_mesh(cargo_box, "SideRight", _box(Vector3(0.1, 1.2, 3.4)), bed_mat, Vector3(1.05, -0.2, 0))
	_mesh(cargo_box, "SideFront", _box(Vector3(2.2, 1.2, 0.1)), bed_mat, Vector3(0, -0.2, -1.65))
	_mesh(cargo_box, "SideBack", _box(Vector3(2.2, 1.2, 0.1)), bed_mat, Vector3(0, -0.2, 1.65))
	# Wheels: front (-Z) steers, rear drives.
	var wheel_pos := {
		"WheelFL": Vector3(-1.1, 0.4, -1.9), "WheelFR": Vector3(1.1, 0.4, -1.9),
		"WheelRL": Vector3(-1.1, 0.4, 1.7), "WheelRR": Vector3(1.1, 0.4, 1.7),
	}
	for wname: String in wheel_pos:
		var w := VehicleWheel3D.new()
		w.position = wheel_pos[wname]
		w.wheel_radius = 0.45
		w.wheel_rest_length = 0.2
		w.suspension_travel = 0.25
		w.suspension_stiffness = 40.0
		w.suspension_max_force = 20000.0
		w.damping_compression = 0.9
		w.damping_relaxation = 1.1
		w.wheel_friction_slip = 3.0
		w.wheel_roll_influence = 0.3
		w.use_as_steering = wname.begins_with("WheelF")
		w.use_as_traction = wname.begins_with("WheelR")
		var cyl := CylinderMesh.new()
		cyl.top_radius = 0.45
		cyl.bottom_radius = 0.45
		cyl.height = 0.35
		_mesh(w, "WheelMesh", cyl, _mat(Color(0.05, 0.05, 0.05), 0.95), Vector3.ZERO, Vector3(0, 0, 90))
		_add(root, w, wname)
	# Interaction points.
	var seat := Area3D.new()
	seat.collision_layer = LAYER_INTERACT
	seat.collision_mask = 0
	seat.add_to_group("vehicle_driver_seat", true)
	seat.position = Vector3(-1.9, 1.0, -1.6)
	var seat_cs := CollisionShape3D.new()
	var seat_shape := SphereShape3D.new()
	seat_shape.radius = 2.0
	seat_cs.shape = seat_shape
	_add(seat, seat_cs, "CollisionShape3D")
	_add(root, seat, "DriverSeat")
	var exit_marker := Marker3D.new()
	exit_marker.position = Vector3(-3.0, 0.3, -1.6)
	_add(root, exit_marker, "ExitMarker")
	# Chase camera.
	var pivot := Node3D.new()
	_add(root, pivot, "CameraPivot")
	pivot.position = Vector3(0, 2.6, 0)
	var cam := Camera3D.new()
	cam.position = Vector3(0, 1.6, 8.5)
	cam.rotation_degrees = Vector3(-12, 0, 0)
	cam.fov = 70
	_add(pivot, cam, "Camera3D")
	_save(root, "res://vehicles/truck.tscn")


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
	_label(ctrl, "ObjectiveLabel", "", Vector4(1, 0, 1, 0), Vector4(-520, 14, -20, 54), R, 22)
	_label(ctrl, "MessageLabel", "", Vector4(0.5, 0, 0.5, 0), Vector4(-400, 90, 400, 140), C, 28)
	_label(ctrl, "CargoLabel", "Carga: 0/3", Vector4(0, 1, 0, 1), Vector4(20, -64, 320, -20), L, 28)
	_label(ctrl, "PromptLabel", "", Vector4(0.5, 1, 0.5, 1), Vector4(-300, -150, 300, -100), C, 26)
	_save(root, "res://ui/hud.tscn")


func _build_world() -> void:
	var root := Node3D.new()
	root.name = "World"
	root.set_script(load("res://world/world.gd"))

	# Ground (100 x 100) and perimeter walls.
	var ground := _static_box(root, "Ground", Vector3(0, -0.5, 0), Vector3(100, 1, 100), _mat(Color(0.36, 0.4, 0.3), 0.95))
	ground.add_to_group("ground", true)
	var wall_mat := _mat(Color(0.5, 0.5, 0.5), 0.9)
	_static_box(root, "WallN", Vector3(0, 1, -50.5), Vector3(102, 2, 1), wall_mat)
	_static_box(root, "WallS", Vector3(0, 1, 50.5), Vector3(102, 2, 1), wall_mat)
	_static_box(root, "WallW", Vector3(-50.5, 1, 0), Vector3(1, 2, 100), wall_mat)
	_static_box(root, "WallE", Vector3(50.5, 1, 0), Vector3(1, 2, 100), wall_mat)

	# Environment + light.
	var we := WorldEnvironment.new()
	var env := Environment.new()
	env.background_mode = Environment.BG_SKY
	var sky := Sky.new()
	sky.sky_material = ProceduralSkyMaterial.new()
	env.sky = sky
	env.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	we.environment = env
	_add(root, we, "WorldEnvironment")
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-50, -30, 0)
	sun.shadow_enabled = true
	_add(root, sun, "Sun")

	# Warehouse, truck, deliveries.
	var warehouse: Node3D = (load("res://world/warehouse.tscn") as PackedScene).instantiate()
	warehouse.position = Vector3(-30, 0, -30)
	_add(root, warehouse, "Warehouse")
	var truck: Node3D = (load("res://vehicles/truck.tscn") as PackedScene).instantiate()
	truck.position = Vector3(-30, 1.2, -18)
	truck.rotation_degrees.y = 180
	_add(root, truck, "Truck")
	var dp_scene: PackedScene = load("res://world/delivery_point.tscn")
	var dp1: Node3D = dp_scene.instantiate()
	dp1.position = Vector3(30, 0, 25)
	_add(root, dp1, "DeliveryPoint1")
	var dp2: Node3D = dp_scene.instantiate()
	dp2.position = Vector3(-25, 0, 38)
	_add(root, dp2, "DeliveryPoint2")

	# Simple obstacles.
	var obstacles := Node3D.new()
	_add(root, obstacles, "Obstacles")
	var block_mat := _mat(Color(0.65, 0.65, 0.62), 0.9)
	var blocks: Array[Vector3] = [
		Vector3(-10, 0.5, -5), Vector3(5, 0.5, 5), Vector3(15, 0.5, 15), Vector3(0, 0.5, 25),
		Vector3(-15, 0.5, 20), Vector3(20, 0.5, 35), Vector3(40, 0.5, 5),
	]
	for i in blocks.size():
		_static_box(obstacles, "Block%d" % (i + 1), blocks[i], Vector3(2.5, 1.0, 1.2), block_mat, 20.0 * i)
	var barrel_mat := _mat(Color(0.8, 0.3, 0.1), 0.5, 0.4)
	var barrel_mesh := CylinderMesh.new()
	barrel_mesh.top_radius = 0.45
	barrel_mesh.bottom_radius = 0.45
	barrel_mesh.height = 1.0
	var barrels: Array[Vector3] = [Vector3(-5, 0.5, 12), Vector3(10, 0.5, -10), Vector3(25, 0.5, 20), Vector3(-36, 0.5, 15)]
	for i in barrels.size():
		var sb := StaticBody3D.new()
		sb.position = barrels[i]
		sb.collision_layer = LAYER_WORLD
		sb.collision_mask = 0
		var bcs := CollisionShape3D.new()
		var bs := CylinderShape3D.new()
		bs.radius = 0.45
		bs.height = 1.0
		bcs.shape = bs
		_add(sb, bcs, "CollisionShape3D")
		_mesh(sb, "Visual", barrel_mesh, barrel_mat)
		_add(obstacles, sb, "Barrel%d" % (i + 1))

	# Player (near the warehouse) and HUD.
	var player: Node3D = (load("res://player/player.tscn") as PackedScene).instantiate()
	player.position = Vector3(-24, 0.1, -22)
	player.rotation_degrees.y = 180
	_add(root, player, "Player")
	var hud: Node = (load("res://ui/hud.tscn") as PackedScene).instantiate()
	_add(root, hud, "HUD")
	_save(root, "res://world/world.tscn")
