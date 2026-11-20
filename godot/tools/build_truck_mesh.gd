extends Node
## Splits a one-piece truck OBJ (CC0, "3D Vehicles Pack" by Inborn Ninja) into a body mesh and four
## wheel meshes centred on their axles, so the wheels can live under the VehicleWheel3D nodes
## (they steer and spin for real). Also rotates the model so its front looks to -Z and scales it.
## Run: godot --headless --path godot res://tools/build_truck_mesh.tscn

const MODEL_SCALE: float = 1.25
const TIRE_RADIUS: float = 0.42   # model units; triangle centroids closer than this to an axle centre are wheel
const MIN_WHEEL_X: float = 0.5    # |x| above this = outside the axle (so the axle stays in the body)


func _ready() -> void:
	_split("res://assets/models/trucks/truck_05.obj", "res://assets/models/trucks/truck_05", Vector2(0.39, 1.33), Vector2(0.39, -1.05))
	print("TRUCK_MESH_OK")
	get_tree().quit()


func _tri_list(mesh: Mesh) -> Array:
	## Returns an array of [Vector3 a, b, c, Vector3 na, nb, nc] per triangle.
	var arrays: Array = mesh.surface_get_arrays(0)
	var verts: PackedVector3Array = arrays[Mesh.ARRAY_VERTEX]
	var norms: PackedVector3Array = arrays[Mesh.ARRAY_NORMAL]
	var idx = arrays[Mesh.ARRAY_INDEX]
	var tris: Array = []
	var count: int = (idx.size() if idx != null and idx.size() > 0 else verts.size())
	for i in range(0, count, 3):
		var ia: int = idx[i] if idx != null and idx.size() > 0 else i
		var ib: int = idx[i + 1] if idx != null and idx.size() > 0 else i + 1
		var ic: int = idx[i + 2] if idx != null and idx.size() > 0 else i + 2
		tris.append([verts[ia], verts[ib], verts[ic], norms[ia], norms[ib], norms[ic]])
	return tris


func _centroid(t: Array) -> Vector3:
	return ((t[0] as Vector3) + (t[1] as Vector3) + (t[2] as Vector3)) / 3.0


func _split(obj_path: String, out_prefix: String, front_yz: Vector2, rear_yz: Vector2) -> void:
	var mesh := load(obj_path) as Mesh
	var tris: Array = _tri_list(mesh)
	# wheel slots: name -> [sign_x, axle(y,z)]
	var slots: Dictionary = {
		"fl": [1.0, Vector2(front_yz.x, front_yz.y)], "fr": [-1.0, Vector2(front_yz.x, front_yz.y)],
		"rl": [1.0, Vector2(rear_yz.x, rear_yz.y)], "rr": [-1.0, Vector2(rear_yz.x, rear_yz.y)],
	}
	# Note: model faces +Z; "left" is decided after the 180 deg rotation, so sign_x is the MODEL x sign
	# (model +x becomes -x after rotation: model +x => truck right).
	var members: Dictionary = {}
	var centers: Dictionary = {}
	for key: String in slots:
		var sx: float = slots[key][0]
		var guess_zy: Vector2 = slots[key][1]  # (y, z)
		var center := Vector3(sx * 0.7, guess_zy.x, guess_zy.y)
		for iter in 3:
			var mem: Array = []
			var mn := Vector3(INF, INF, INF)
			var mx := Vector3(-INF, -INF, -INF)
			for t: Array in tris:
				var c: Vector3 = _centroid(t)
				if signf(c.x) != sx or absf(c.x) < MIN_WHEEL_X:
					continue
				if Vector2(c.y, c.z).distance_to(Vector2(center.y, center.z)) > TIRE_RADIUS:
					continue
				mem.append(t)
				for k in 3:
					var v: Vector3 = t[k]
					mn = mn.min(v)
					mx = mx.max(v)
			if mem.is_empty():
				break
			center = Vector3((mn.x + mx.x) * 0.5, (mn.y + mx.y) * 0.5, (mn.z + mx.z) * 0.5)
			members[key] = mem
		center.y = 0.39  # common axle height (front arches skew the bounding box)
		centers[key] = center
		print(key, " center(model)=", center, " tris=", (members[key] as Array).size())
	# Assign triangles.
	var wheel_tris: Dictionary = {"fl": [], "fr": [], "rl": [], "rr": []}
	var body_tris: Array = []
	for t: Array in tris:
		var owner_key := ""
		for key: String in slots:
			if members.has(key) and (members[key] as Array).has(t):
				owner_key = key
				break
		if owner_key == "":
			body_tris.append(t)
		else:
			wheel_tris[owner_key].append(t)
	_save_mesh(body_tris, Vector3.ZERO, out_prefix + "_body.res", true)
	for key: String in wheel_tris:
		_save_mesh(wheel_tris[key], centers[key], out_prefix + "_wheel_%s.res" % key)
	# Report the wheel centres in truck space (after rotate 180 + scale) for the scene builder.
	for key: String in centers:
		var c: Vector3 = centers[key]
		print("WHEEL ", key, " truck_space=", Vector3(-c.x, c.y, -c.z) * MODEL_SCALE)
	var bb := AABB()
	var first := true
	for t: Array in body_tris:
		for k in 3:
			var v: Vector3 = Vector3(-(t[k] as Vector3).x, (t[k] as Vector3).y, -(t[k] as Vector3).z) * MODEL_SCALE
			bb = AABB(v, Vector3.ZERO) if first else bb.expand(v)
			first = false
	print("BODY aabb(truck space)=", bb)


func _xform(v: Vector3, center: Vector3) -> Vector3:
	var p: Vector3 = v - center
	return Vector3(-p.x, p.y, -p.z) * MODEL_SCALE  # rotate 180 deg about Y: front +Z -> -Z


## Opens the cargo bed (no lid, no rear wall) so the loaded crates are visible; truck-space test.
func _remove_for_open_bed(a: Vector3, b: Vector3, c: Vector3, n: Vector3) -> bool:
	var cen: Vector3 = (a + b + c) / 3.0
	var lid: bool = n.y > 0.8 and cen.y > 1.85 and cen.z > -0.3
	var rear_wall: bool = n.z > 0.8 and cen.z > 2.4 and cen.y > 1.0
	return lid or rear_wall


func _save_mesh(tris: Array, center: Vector3, path: String, open_bed: bool = false) -> void:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for t: Array in tris:
		var a: Vector3 = _xform(t[0], center)
		var b: Vector3 = _xform(t[1], center)
		var c: Vector3 = _xform(t[2], center)
		var n_avg: Vector3 = ((t[3] as Vector3) + (t[4] as Vector3) + (t[5] as Vector3))
		n_avg = Vector3(-n_avg.x, n_avg.y, -n_avg.z).normalized()
		# Godot front faces are clockwise: geometric normal = -(b-a)x(c-a).
		var geo: Vector3 = -(b - a).cross(c - a)
		var verts: Array[Vector3] = [a, b, c]
		var norms: Array[Vector3] = []
		for k in 3:
			var nv: Vector3 = t[3 + k]
			norms.append(Vector3(-nv.x, nv.y, -nv.z).normalized())
		if geo.dot(n_avg) < 0.0:
			verts = [a, c, b]
			norms = [norms[0], norms[2], norms[1]]
		if open_bed and _remove_for_open_bed(a, b, c, n_avg):
			continue
		for k in 3:
			st.set_normal(norms[k])
			st.add_vertex(verts[k])
	var m := st.commit()
	var err: int = ResourceSaver.save(m, path)
	print("saved ", path, " err=", err, " tris=", tris.size())
