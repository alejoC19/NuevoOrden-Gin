class_name WorldDecorator
extends Node3D
## Procedural dressing of the world: grass and trees scattered with MultiMeshInstance3D, never on the
## roads and never near delivery points / warehouse / fuel station.
##
## PLUGS: drag your own models into `tree_scene` and `grass_scene` (e.g. the ones generated with
## Meshy in res://assets/ai_generated/). While they are empty, simple procedural placeholders are used.
## Every MeshInstance3D found inside the scene is turned into a MultiMesh, so multi-part models work.

@export_group("Models (plugs)")
@export var tree_scene: PackedScene
@export var grass_scene: PackedScene

@export_group("Area")
@export var area_center: Vector2 = Vector2.ZERO
@export var area_size: Vector2 = Vector2(900.0, 900.0)

@export_group("Amount")
@export_range(200, 5000) var tree_count: int = 320
@export_range(10000, 300000) var grass_count: int = 100000
## Share of the grass placed in a corridor around the roads (the rest is spread over the whole area).
@export_range(0.0, 1.0) var grass_near_roads: float = 0.8
@export var grass_corridor: float = 30.0

@export_group("Look")
@export var tree_scale_range: Vector2 = Vector2(0.8, 1.4)
## Grass tufts are 1 m models: small (0.2-0.4 m tall) and dense.
@export var grass_scale_xz: Vector2 = Vector2(0.45, 0.8)
@export var grass_scale_y: Vector2 = Vector2(0.2, 0.4)
## LOD: grass beyond this distance is culled (fades out), trees keep drawing much further.
@export var grass_view_distance: float = 110.0
@export var tree_view_distance: float = 450.0
## Per-tuft colour range for the placeholder grass (muted olive <-> dry brown).
@export var grass_color_a: Color = Color(0.62, 0.68, 0.4)
@export var grass_color_b: Color = Color(0.8, 0.66, 0.42)

@export_group("Auto-load (zero-drag plugs)")
@export_file("*.glb", "*.gltf", "*.tscn") var tree_path: String = "res://assets/ai_generated/tree.glb"
@export_file("*.glb", "*.gltf", "*.tscn") var grass_path: String = "res://assets/ai_generated/grass.glb"

@export_group("Exclusion")
@export var road_clearance_trees: float = 11.0
@export var road_clearance_grass: float = 0.8
@export var point_clearance: float = 22.0
@export var tree_collision_radius: float = 0.4
@export var seed_value: int = 7

const CELL: float = 100.0

## Placed transforms per group ({"Trees": {cell: [Transform3D]}, "Grass": ...}); handy for debugging/tests.
var placements: Dictionary = {}
var _roads: RoadNetwork
var _keep_clear: Array[Vector2] = []


func _ready() -> void:
	_roads = get_tree().get_first_node_in_group("road_network") as RoadNetwork
	for group in ["delivery_point", "warehouse", "fuel_station", "keep_clear"]:
		for n in get_tree().get_nodes_in_group(group):
			var p: Vector3 = (n as Node3D).global_position
			_keep_clear.append(Vector2(p.x, p.z))
	var rng := RandomNumberGenerator.new()
	rng.seed = seed_value
	if tree_scene == null and tree_path != "" and ResourceLoader.exists(tree_path):
		tree_scene = load(tree_path) as PackedScene
	if grass_scene == null and grass_path != "" and ResourceLoader.exists(grass_path):
		grass_scene = load(grass_path) as PackedScene
	var tree_parts: Array = _extract_parts(tree_scene) if tree_scene != null else _placeholder_tree_parts()
	var grass_parts: Array = _extract_parts(grass_scene) if grass_scene != null else _placeholder_grass_parts()
	var trees: Dictionary = _scatter(rng, tree_count, tree_scale_range, tree_scale_range, road_clearance_trees, 0.0, 3.0)
	var grass: Dictionary = _scatter(rng, grass_count, grass_scale_xz, grass_scale_y, road_clearance_grass, grass_near_roads, 1.0)
	placements = {"Trees": trees, "Grass": grass}
	var n_trees: int = _spawn("Trees", trees, tree_parts, tree_view_distance, true)
	var n_grass: int = _spawn("Grass", grass, grass_parts, grass_view_distance, false)
	_add_tree_colliders(trees)
	print("WorldDecorator: %d trees, %d grass tufts" % [n_trees, n_grass])


# --- placement -----------------------------------------------------------------

func _blocked(p: Vector2, road_clearance: float, point_margin: float) -> bool:
	if _roads != null and _roads.distance_to_road(p) < road_clearance + RoadNetwork.ROAD_WIDTH * 0.5:
		return true
	for k in _keep_clear:
		if p.distance_to(k) < point_margin:
			return true
	return false


func _random_road_point(rng: RandomNumberGenerator) -> Vector2:
	var road: Array = RoadNetwork.ROADS[rng.randi() % RoadNetwork.ROADS.size()]
	var i: int = rng.randi() % (road.size() - 1)
	var a: Vector2 = road[i]
	var b: Vector2 = road[i + 1]
	var dir: Vector2 = (b - a).normalized()
	var side := Vector2(-dir.y, dir.x)
	var lateral: float = rng.randf_range(-grass_corridor, grass_corridor)
	return a.lerp(b, rng.randf()) + side * lateral


## Returns {cell_key: [Transform3D, ...]} for `count` placements.
func _scatter(rng: RandomNumberGenerator, count: int, xz_range: Vector2, y_range: Vector2, road_clearance: float, near_roads: float, point_margin_mult: float) -> Dictionary:
	var cells: Dictionary = {}
	var placed: int = 0
	var guard: int = 0
	var half: Vector2 = area_size * 0.5
	while placed < count and guard < count * 20:
		guard += 1
		var p: Vector2
		if rng.randf() < near_roads and _roads != null:
			p = _random_road_point(rng)
		else:
			p = area_center + Vector2(rng.randf_range(-half.x, half.x), rng.randf_range(-half.y, half.y))
		if absf(p.x) > 495.0 or absf(p.y) > 495.0:
			continue
		if _blocked(p, road_clearance, point_clearance * point_margin_mult):
			continue
		var sxz: float = rng.randf_range(xz_range.x, xz_range.y)
		var sy: float = rng.randf_range(y_range.x, y_range.y)
		# Random yaw per instance so no two tufts/trees look alike.
		var basis := Basis(Vector3.UP, rng.randf() * TAU).scaled(Vector3(sxz, sy, sxz))
		var key := Vector2i(floori(p.x / CELL), floori(p.y / CELL))
		if not cells.has(key):
			cells[key] = []
		cells[key].append(Transform3D(basis, Vector3(p.x, 0.0, p.y)))
		placed += 1
	return cells


func _spawn(group_name: String, cells: Dictionary, parts: Array, view_distance: float, shadows: bool) -> int:
	var holder := Node3D.new()
	holder.name = group_name
	add_child(holder)
	var total: int = 0
	for key: Vector2i in cells:
		var list: Array = cells[key]
		for part_idx in parts.size():
			var part: Dictionary = parts[part_idx]
			var mm := MultiMesh.new()
			mm.transform_format = MultiMesh.TRANSFORM_3D
			var tint: bool = part.get("tint", false)
			mm.use_colors = tint
			mm.mesh = part["mesh"]
			mm.instance_count = list.size()
			for n in list.size():
				mm.set_instance_transform(n, (list[n] as Transform3D) * (part["xform"] as Transform3D))
				if tint:
					mm.set_instance_color(n, grass_color_a.lerp(grass_color_b, randf()) * randf_range(0.8, 1.05))
			var mmi := MultiMeshInstance3D.new()
			mmi.name = "%s_%d_%d_%d" % [group_name, key.x, key.y, part_idx]
			mmi.multimesh = mm
			mmi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON if shadows else GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
			mmi.visibility_range_end = view_distance
			mmi.visibility_range_end_margin = view_distance * 0.15
			mmi.visibility_range_fade_mode = GeometryInstance3D.VISIBILITY_RANGE_FADE_SELF
			mmi.custom_aabb = AABB(Vector3(key.x * CELL - 20, -2, key.y * CELL - 20), Vector3(CELL + 40, 40, CELL + 40))
			holder.add_child(mmi)
		total += list.size()
	return total


func _add_tree_colliders(cells: Dictionary) -> void:
	var body := StaticBody3D.new()
	body.name = "TreeColliders"
	body.collision_layer = 1
	body.collision_mask = 0
	var shape := CylinderShape3D.new()
	shape.radius = tree_collision_radius
	shape.height = 4.0
	for key: Vector2i in cells:
		for t: Transform3D in cells[key]:
			var cs := CollisionShape3D.new()
			cs.shape = shape
			cs.position = t.origin + Vector3(0, 2.0, 0)
			body.add_child(cs)
	add_child(body)


# --- model extraction ----------------------------------------------------------

## Collects every MeshInstance3D of a scene as {mesh, xform} (xform relative to the scene root).
func _extract_parts(scene: PackedScene) -> Array:
	var parts: Array = []
	var inst: Node = scene.instantiate()
	_collect(inst, Transform3D.IDENTITY, parts)
	inst.free()
	if parts.is_empty():
		push_warning("WorldDecorator: the assigned scene has no MeshInstance3D")
	return parts


func _collect(node: Node, xform: Transform3D, out: Array) -> void:
	var t: Transform3D = xform
	if node is Node3D:
		t = xform * (node as Node3D).transform
	if node is MeshInstance3D and (node as MeshInstance3D).mesh != null:
		var mi := node as MeshInstance3D
		var mesh: Mesh = mi.mesh
		if mi.material_override != null:
			mesh = mesh.duplicate()
			for s in mesh.get_surface_count():
				mesh.surface_set_material(s, mi.material_override)
		out.append({"mesh": mesh, "xform": t})
	for c in node.get_children():
		_collect(c, t, out)


# --- placeholders (used until the real models are plugged in) ---------------------

func _placeholder_tree_parts() -> Array:
	var trunk_mat := StandardMaterial3D.new()
	trunk_mat.albedo_color = Color(0.32, 0.22, 0.14)
	trunk_mat.roughness = 0.95
	var leaf_mat := StandardMaterial3D.new()
	leaf_mat.albedo_color = Color(0.14, 0.33, 0.12)
	leaf_mat.roughness = 0.9
	var trunk := CylinderMesh.new()
	trunk.top_radius = 0.18
	trunk.bottom_radius = 0.32
	trunk.height = 3.0
	trunk.material = trunk_mat
	var cone_a := CylinderMesh.new()
	cone_a.top_radius = 0.0
	cone_a.bottom_radius = 1.9
	cone_a.height = 3.6
	cone_a.material = leaf_mat
	var cone_b := CylinderMesh.new()
	cone_b.top_radius = 0.0
	cone_b.bottom_radius = 1.4
	cone_b.height = 3.0
	cone_b.material = leaf_mat
	return [
		{"mesh": trunk, "xform": Transform3D(Basis.IDENTITY, Vector3(0, 1.5, 0))},
		{"mesh": cone_a, "xform": Transform3D(Basis.IDENTITY, Vector3(0, 4.0, 0))},
		{"mesh": cone_b, "xform": Transform3D(Basis.IDENTITY, Vector3(0, 6.0, 0))},
	]


func _placeholder_grass_parts() -> Array:
	var mat := StandardMaterial3D.new()
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA_SCISSOR
	mat.alpha_scissor_threshold = 0.5
	mat.cull_mode = BaseMaterial3D.CULL_DISABLED
	mat.albedo_texture = _make_blade_texture()
	mat.vertex_color_use_as_albedo = true
	mat.roughness = 0.95
	mat.metallic_specular = 0.1
	mat.backlight_enabled = true
	mat.backlight = Color(0.3, 0.3, 0.14)
	mat.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS_ANISOTROPIC
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for angle in [0.0, PI / 3.0, 2.0 * PI / 3.0]:
		var dx: float = cos(angle) * 0.5
		var dz: float = sin(angle) * 0.5
		var p0 := Vector3(-dx, 0, -dz)
		var p1 := Vector3(dx, 0, dz)
		var p2 := Vector3(dx, 1.0, dz)
		var p3 := Vector3(-dx, 1.0, -dz)
		for v in [[p0, Vector2(0, 1)], [p2, Vector2(1, 0)], [p1, Vector2(1, 1)], [p0, Vector2(0, 1)], [p3, Vector2(0, 0)], [p2, Vector2(1, 0)]]:
			st.set_normal(Vector3.UP)
			st.set_uv(v[1])
			st.add_vertex(v[0])
	var mesh := st.commit()
	mesh.surface_set_material(0, mat)
	return [{"mesh": mesh, "xform": Transform3D.IDENTITY, "tint": true}]


func _make_blade_texture() -> ImageTexture:
	var size: int = 128
	var img := Image.create(size, size, true, Image.FORMAT_RGBA8)
	img.fill(Color(0, 0, 0, 0))
	var rng := RandomNumberGenerator.new()
	rng.seed = 99
	for blade in 26:
		var base_x: float = rng.randf_range(0.1, 0.9) * size
		var height: float = rng.randf_range(0.45, 0.98) * size
		var lean: float = rng.randf_range(-0.35, 0.35)
		var width: float = rng.randf_range(2.5, 5.0)
		var shade: float = rng.randf_range(0.7, 1.0)
		for y in int(height):
			var t: float = float(y) / height
			var cx: float = base_x + lean * t * t * size * 0.5
			var w: float = width * (1.0 - t) + 0.4
			for x in range(int(cx - w), int(cx + w) + 1):
				if x < 0 or x >= size:
					continue
				var green := Color(0.22, 0.24, 0.09).lerp(Color(0.5, 0.52, 0.22), t) * shade
				green.a = 1.0
				img.set_pixel(x, size - 1 - y, green)
	img.generate_mipmaps()
	return ImageTexture.create_from_image(img)
