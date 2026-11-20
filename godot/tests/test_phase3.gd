extends TestBase

var world: Node3D
var truck: Truck
var player: Player


func place(pos: Vector3, yaw_deg: float = 180.0) -> void:
	truck.global_transform = Transform3D(Basis(Vector3.UP, deg_to_rad(yaw_deg)), pos)
	truck.linear_velocity = Vector3.ZERO
	truck.angular_velocity = Vector3.ZERO
	await seconds(1.2)


func pitch_deg() -> float:
	return rad_to_deg(asin(clampf((-truck.global_transform.basis.z).y, -1.0, 1.0)))


func slip_deg() -> float:
	var v := truck.linear_velocity
	v.y = 0.0
	if v.length() < 1.0:
		return 0.0
	var fwd := -truck.global_transform.basis.z
	fwd.y = 0.0
	return rad_to_deg(absf(fwd.normalized().signed_angle_to(v.normalized(), Vector3.UP)))


func mock_scene(with_wheels: bool) -> PackedScene:
	var root := Node3D.new()
	root.name = "Mock"
	var mi := MeshInstance3D.new()
	mi.name = "Mesh"
	mi.mesh = BoxMesh.new()
	root.add_child(mi)
	mi.owner = root
	if with_wheels:
		for n in ["WheelFL", "WheelFR", "WheelRL", "WheelRR"]:
			var w := Node3D.new()
			w.name = n
			root.add_child(w)
			w.owner = root
			var wm := MeshInstance3D.new()
			wm.mesh = CylinderMesh.new()
			w.add_child(wm)
			wm.owner = root
	var ps := PackedScene.new()
	ps.pack(root)
	root.free()
	return ps


func total_instances(holder: Node) -> int:
	var total: int = 0
	for c in holder.get_children():
		total += (c as MultiMeshInstance3D).multimesh.instance_count
	return total


func _ready() -> void:
	world = load_world()
	await seconds(1.5)
	player = world.get_node("Player") as Player
	truck = world.get_node("Truck") as Truck

	print("== Plugs: decorator with external scenes ==")
	var deco_default := world.get_node("Decorator") as WorldDecorator
	check(total_instances(deco_default.get_node("Grass")) >= 10000, "placeholder grass >= 10000 (%d)" % total_instances(deco_default.get_node("Grass")))
	check(total_instances(deco_default.get_node("Trees")) >= 200, "placeholder trees >= 200 (%d)" % total_instances(deco_default.get_node("Trees")))
	var d := WorldDecorator.new()
	d.tree_scene = mock_scene(false)
	d.grass_scene = mock_scene(false)
	d.tree_count = 250
	d.grass_count = 50000
	d.name = "TestDecorator"
	world.add_child(d)
	var n_trees: int = total_instances(d.get_node("Trees"))
	var n_grass: int = total_instances(d.get_node("Grass"))
	check(n_trees >= 200 and n_grass >= 50000, "exported PackedScenes used (trees %d, grass %d)" % [n_trees, n_grass])
	# No instance on roads or near delivery points.
	var roads := world.get_node("Roads") as RoadNetwork
	var bad_road: int = 0
	var bad_point: int = 0
	var points: Array[Vector3] = []
	for p in get_tree().get_nodes_in_group("delivery_point"):
		points.append((p as Node3D).global_position)
	for holder_name in ["Trees", "Grass"]:
		for key in d.placements[holder_name]:
			for t: Transform3D in d.placements[holder_name][key]:
				var o: Vector3 = t.origin
				if roads.distance_to_road(Vector2(o.x, o.z)) < RoadNetwork.ROAD_WIDTH * 0.5:
					bad_road += 1
				for pt in points:
					if Vector2(o.x, o.z).distance_to(Vector2(pt.x, pt.z)) < 4.5:
						bad_point += 1
	check(bad_road == 0, "no vegetation on the asphalt (%d bad)" % bad_road)
	check(bad_point == 0, "no vegetation on delivery points (%d bad)" % bad_point)

	print("== Roads: raised 0.1 m with colliders ==")
	var space := truck.get_world_3d().direct_space_state
	var q_road := PhysicsRayQueryParameters3D.create(Vector3(-30, 5, 150), Vector3(-30, -5, 150))
	var q_grass := PhysicsRayQueryParameters3D.create(Vector3(-50, 5, 150), Vector3(-50, -5, 150))
	var hit_road := space.intersect_ray(q_road)
	var hit_grass := space.intersect_ray(q_grass)
	check(not hit_road.is_empty() and absf((hit_road["position"] as Vector3).y - 0.1) < 0.01, "road surface at y=0.1 (%s)" % [hit_road.get("position", "none")])
	check(not hit_grass.is_empty() and absf((hit_grass["position"] as Vector3).y) < 0.01, "terrain at y=0 (%s)" % [hit_grass.get("position", "none")])
	check(roads.is_on_road(Vector3(-30, 0, 100)) and not roads.is_on_road(Vector3(-50, 0, 100)), "is_on_road works")

	print("== Plugs: truck_mesh_scene ==")
	var t2: Truck = (load("res://vehicles/truck.tscn") as PackedScene).instantiate()
	t2.truck_mesh_scene = mock_scene(true)
	t2.truck_model_scale = 1.5
	t2.position = Vector3(300, 1.0, -300)
	world.add_child(t2)
	await frames(5)
	check(t2.has_node("Visual/ExternalModel"), "external model instanced under Visual")
	check(not (t2.get_node("Visual/Body") as Node3D).visible, "built-in body hidden")
	check(t2.get_node("WheelFL").has_node("WheelFL"), "model WheelFL attached to the physics wheel")
	check(t2.has_node("ChassisCollision") and t2.has_node("WheelRR"), "collisions and VehicleWheel3D untouched")
	t2.queue_free()

	print("== Physics: bumps, braking, cornering ==")
	player.enter_truck(truck)
	for i in 3:
		truck.add_cargo()
	await place(Vector3(-30, 0.4, 30))
	var ymin: float = 99.0
	var ymax: float = -99.0
	var max_pitch: float = 0.0
	Input.action_press("move_forward")
	var crossed: bool = false
	for i in 900:
		await frames(1)
		if truck.global_position.z > 55.0 and truck.global_position.z < 70.0:
			ymin = minf(ymin, truck.global_position.y)
			ymax = maxf(ymax, truck.global_position.y)
		max_pitch = maxf(max_pitch, absf(pitch_deg()))
		if truck.global_position.z > 75.0:
			crossed = true
			break
	check(crossed, "truck drove over the speed bumps")
	print("  bump crossing: y range %.3f..%.3f (bounce %.3f m), max |pitch| %.1f deg, speed %.1f, gear %d" % [ymin, ymax, ymax - ymin, max_pitch, truck.forward_speed(), truck.gear])
	check(ymax - ymin > 0.02, "suspension reacts to the bumps")
	check(max_pitch < 20.0, "no violent pitching over bumps")
	# Brake dive.
	while truck.forward_speed() < 8.0 and truck.global_position.z < 95.0:
		await frames(1)
	Input.action_release("move_forward")
	var pitch_before: float = pitch_deg()
	var dive: float = 0.0
	Input.action_press("brake")
	for i in 90:
		await frames(1)
		dive = maxf(dive, absf(pitch_deg() - pitch_before))
	Input.action_release("brake")
	print("  brake dive: %.2f deg" % dive)
	check(dive > 0.5 and dive < 15.0, "truck dips forward under hard braking (%.2f deg)" % dive)
	# Hard corner at speed with load (open grass).
	await place(Vector3(100, 0.4, 100), 180.0)
	var gear_seen: Dictionary = {}
	Input.action_press("move_forward")
	for i in 300:
		await frames(1)
		gear_seen[truck.gear] = true
	var min_rear_slip: float = 99.0
	var max_slip: float = 0.0
	var min_up: float = 1.0
	Input.action_press("move_left")
	for i in 240:
		await frames(1)
		min_rear_slip = minf(min_rear_slip, (truck.get_node("WheelRL") as VehicleWheel3D).wheel_friction_slip)
		max_slip = maxf(max_slip, slip_deg())
		min_up = minf(min_up, truck.global_transform.basis.y.y)
		gear_seen[truck.gear] = true
	Input.action_release("move_left")
	Input.action_release("move_forward")
	print("  corner: speed %.1f, max slip angle %.1f deg, min rear slip %.2f, min up.y %.2f, gears seen %s" % [truck.forward_speed(), max_slip, min_rear_slip, min_up, gear_seen.keys()])
	check(min_up > 0.6, "truck does not roll over in a hard corner (up.y %.2f)" % min_up)
	check(min_rear_slip < Truck.REAR_SLIP - 0.2, "rear tyres lose some grip when cornering loaded (%.2f)" % min_rear_slip)
	check(max_slip > 3.0 and max_slip < 70.0, "light oversteer, not a spin (slip %.1f deg)" % max_slip)
	check(gear_seen.size() >= 2, "gearbox changes gear while accelerating")

	print("== Particles ==")
	await place(Vector3(100, 0.4, 100), 180.0)
	Input.action_press("move_forward")
	await seconds(1.5)
	check((truck.get_node("ExhaustSmoke") as GPUParticles3D).emitting, "exhaust smoke on while the engine runs")
	check((truck.get_node("ExhaustSoot") as GPUParticles3D).emitting, "black soot cloud at full throttle")
	check((truck.get_node("DustRL") as GPUParticles3D).emitting or (truck.get_node("DustRR") as GPUParticles3D).emitting, "rear-wheel dust on grass")
	Input.action_release("move_forward")
	await place(Vector3(-30, 0.4, 130))
	Input.action_press("move_forward")
	await seconds(1.5)
	check(not (truck.get_node("DustRL") as GPUParticles3D).emitting, "no dust on asphalt")
	Input.action_release("move_forward")
	var smoke_mat := (truck.get_node("ExhaustSmoke") as GPUParticles3D).process_material as ParticleProcessMaterial
	var old_color: Color = smoke_mat.color
	truck.set_engine_v8(true)
	check(smoke_mat.color != old_color and (truck.get_node("ExhaustSoot") as GPUParticles3D).amount > 50, "V8 smoke is darker and denser")
	truck.set_engine_v8(false)
	check(world.has_node("AmbientDust") and (world.get_node("AmbientDust") as GPUParticles3D).emitting, "ambient dust emitting")

	print("== Stress: 40 s of random driving ==")
	var objs0: int = int(Performance.get_monitor(Performance.OBJECT_COUNT))
	var mem0: float = Performance.get_monitor(Performance.MEMORY_STATIC)
	await place(Vector3(-30, 0.4, 40))
	var rng := RandomNumberGenerator.new()
	rng.seed = 5
	var finite: bool = true
	var max_speed: float = 0.0
	var max_ang: float = 0.0
	for step in 80:
		for a in ["move_forward", "move_back", "move_left", "move_right", "brake"]:
			Input.action_release(a)
		var r := rng.randf()
		if r < 0.7:
			Input.action_press("move_forward")
		elif r < 0.85:
			Input.action_press("move_back")
		if rng.randf() < 0.5:
			Input.action_press("move_left" if rng.randf() < 0.5 else "move_right")
		if rng.randf() < 0.2:
			Input.action_press("brake")
		await seconds(0.5)
		var p := truck.global_position
		finite = finite and is_finite(p.x) and is_finite(p.y) and is_finite(p.z)
		max_speed = maxf(max_speed, truck.linear_velocity.length())
		max_ang = maxf(max_ang, truck.angular_velocity.length())
		if absf(p.x) > 480 or absf(p.z) > 480:
			await place(Vector3(-30, 0.4, 40))
	for a in ["move_forward", "move_back", "move_left", "move_right", "brake"]:
		Input.action_release(a)
	var objs1: int = int(Performance.get_monitor(Performance.OBJECT_COUNT))
	print("  max speed %.1f m/s, max angular %.1f rad/s, objects %d -> %d, static mem %.1f -> %.1f MB" % [max_speed, max_ang, objs0, objs1, mem0 / 1e6, Performance.get_monitor(Performance.MEMORY_STATIC) / 1e6])
	check(finite, "positions stay finite")
	check(max_speed < 30.0, "truck never flies off (max %.1f m/s)" % max_speed)
	check(max_ang < 20.0, "no violent spinning (max %.1f rad/s)" % max_ang)
	check(absf(truck.global_position.y) < 5.0, "truck is still on the ground (y %.2f)" % truck.global_position.y)
	check(objs1 < objs0 + 300, "object count stable (no particle leaks)")
	finish()
