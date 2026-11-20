extends TestBase

var world: Node3D
var truck: Truck
var player: Player


func place(pos: Vector3, yaw_deg: float = 180.0) -> void:
	truck.global_transform = Transform3D(Basis(Vector3.UP, deg_to_rad(yaw_deg)), pos)
	truck.linear_velocity = Vector3.ZERO
	truck.angular_velocity = Vector3.ZERO
	await seconds(1.2)


## Accelerate from rest for `t` seconds; returns [speed, distance].
func accel_run(t: float) -> Array:
	await place(Vector3(100, 0.3, 100))
	var start := truck.global_position
	Input.action_press("move_forward")
	await seconds(t)
	Input.action_release("move_forward")
	return [truck.forward_speed(), truck.global_position.distance_to(start)]


## Get to `target` m/s, then handbrake; returns stopping distance.
func brake_run(target: float) -> float:
	await place(Vector3(100, 0.3, 100))
	Input.action_press("move_forward")
	var guard: int = 0
	while truck.forward_speed() < target and guard < 1200:
		await frames(1)
		guard += 1
	Input.action_release("move_forward")
	var start := truck.global_position
	Input.action_press("brake")
	await seconds(8.0)
	Input.action_release("brake")
	return truck.global_position.distance_to(start)


func _ready() -> void:
	world = load_world()
	world.get_node("Obstacles").free()  # clear lanes for physics measurements
	await seconds(1.5)
	player = world.get_node("Player") as Player
	truck = world.get_node("Truck") as Truck
	player.enter_truck(truck)

	print("== Weight ==")
	check(is_equal_approx(truck.mass, 1000.0), "empty mass 1000 (%.0f)" % truck.mass)
	var empty_run: Array = await accel_run(4.0)
	var empty_stop: float = await brake_run(9.0)
	var empty_vmax: float = truck.get_max_speed()
	for i in 3:
		truck.add_cargo()
	check(is_equal_approx(truck.mass, 1450.0), "3 crates -> mass 1450 (%.0f)" % truck.mass)
	var loaded_run: Array = await accel_run(4.0)
	var loaded_stop: float = await brake_run(9.0)
	print("  empty:  v(4s)=%.2f  dist=%.1f  stop(9m/s)=%.1f m" % [empty_run[0], empty_run[1], empty_stop])
	print("  loaded: v(4s)=%.2f  dist=%.1f  stop(9m/s)=%.1f m" % [loaded_run[0], loaded_run[1], loaded_stop])
	check(loaded_run[0] < empty_run[0] - 1.0, "loaded truck accelerates slower")
	check(loaded_stop > empty_stop * 1.15, "loaded truck brakes slower")
	check(absf(truck.get_max_speed() / empty_vmax - 0.7) < 0.01, "3 crates -> top speed -30%% (%.2f)" % (truck.get_max_speed() / empty_vmax))
	# Top speed actually reached.
	await place(Vector3(0, 0.3, 200))
	Input.action_press("move_forward")
	var peak: float = 0.0
	for i in 14:
		await seconds(1.0)
		peak = maxf(peak, truck.forward_speed())
	Input.action_release("move_forward")
	print("  loaded peak speed: %.2f (limit %.2f)" % [peak, truck.get_max_speed()])
	check(peak > 9.0 and peak <= 10.6, "loaded peak speed ~10.5 m/s")

	print("== Crates visible ==")
	var crates := truck.get_node("Visual/CargoBox").get_children().filter(func(n: Node) -> bool: return n.name.begins_with("CargoCrate"))
	check(crates.size() == 3, "3 crate meshes in the cargo box (%d)" % crates.size())
	truck.remove_cargo()
	await frames(2)
	crates = truck.get_node("Visual/CargoBox").get_children().filter(func(n: Node) -> bool: return n.name.begins_with("CargoCrate"))
	check(crates.size() == 2, "removing cargo removes a crate mesh (%d)" % crates.size())
	truck.remove_cargo()
	truck.remove_cargo()
	await frames(2)
	check(is_equal_approx(truck.mass, 1000.0), "mass back to 1000")

	print("== Fuel ==")
	await place(Vector3(0, 0.3, 200))
	truck.fuel = 100.0
	var f0: float = truck.fuel
	await seconds(3.0)
	check(is_equal_approx(truck.fuel, f0), "no consumption when idle")
	Input.action_press("move_forward")
	await seconds(5.0)
	var used: float = f0 - truck.fuel
	Input.action_release("move_forward")
	print("  fuel used in 5 s: %.2f" % used)
	check(used > 4.5 and used < 5.5, "fuel drops ~1.0/s while accelerating")
	truck.fuel = 0.0
	await place(Vector3(0, 0.3, 200))
	Input.action_press("move_forward")
	await seconds(3.0)
	Input.action_release("move_forward")
	check(absf(truck.forward_speed()) < 0.5, "no acceleration with empty tank (%.2f)" % truck.forward_speed())
	var station := world.get_node("FuelStation") as Node3D
	await place(station.global_position + Vector3(3.5, 0.3, 0))
	check(truck.is_near_fuel_station(), "truck detects fuel station")
	truck.fuel = 10.0
	player.interact()
	check(is_equal_approx(truck.fuel, 100.0), "E at station refuels to 100")
	check(messages.has("Tanque lleno"), "message 'Tanque lleno'")

	print("== Wear ==")
	check(is_equal_approx(truck.get_wear_factor(), 1.0), "factor 1.0 at wear 0")
	truck.wear = 100.0
	check(is_equal_approx(truck.get_max_speed(), 7.5), "wear 100% -> top speed 7.5")
	truck.wear = 50.0
	check(is_equal_approx(truck.get_max_speed(), 11.25), "wear 50% -> top speed 11.25")
	truck.wear = 0.0
	player.exit_truck()
	var dp := world.get_node("DeliveryPoint1") as Node3D
	truck.add_cargo()
	await place(dp.global_position + Vector3(5, 0.3, 0))
	player.global_position = dp.global_position + Vector3(1, 0.1, 0)
	await frames(5)
	player.interact()
	check(is_equal_approx(truck.wear, 2.0), "delivery adds +2 wear (%.1f)" % truck.wear)
	truck.wear = 0.0

	print("== Crash ==")
	player.enter_truck(truck)
	# Test wall (world layer), 60 m ahead of the start point along +Z.
	var wall := StaticBody3D.new()
	wall.collision_layer = 1
	var wcs := CollisionShape3D.new()
	var wshape := BoxShape3D.new()
	wshape.size = Vector3(20, 4, 1)
	wcs.shape = wshape
	wall.add_child(wcs)
	world.add_child(wall)
	wall.global_position = Vector3(-100, 2, 260)
	# Slow bump (<3 m/s): nothing happens.
	await place(Vector3(-100, 0.3, 256.8))
	truck.wear = 0.0
	Input.action_press("move_forward")
	await seconds(2.0)
	Input.action_release("move_forward")
	print("  slow bump: wear=%.1f" % truck.wear)
	check(is_equal_approx(truck.wear, 0.0), "light scrape/bump causes no wear")
	# Hard crash.
	await place(Vector3(-100, 0.3, 225))
	truck.wear = 0.0
	var crashed_speeds: Array[float] = []
	truck.crashed.connect(func(s: float) -> void: crashed_speeds.append(s))
	Input.action_press("move_forward")
	var pre_speed: float = 0.0
	for i in 480:
		await frames(1)
		if truck.global_position.z < 258.0:
			pre_speed = maxf(pre_speed, truck.forward_speed())
		if truck.wear > 0.0:
			break
	Input.action_release("move_forward")
	print("  pre-impact speed %.1f, wear=%.1f, impacts=%s, speed after=%.2f" % [pre_speed, truck.wear, crashed_speeds, truck.forward_speed()])
	check(is_equal_approx(truck.wear, 10.0), "hard crash adds +10 wear")
	check(crashed_speeds.size() == 1 and crashed_speeds[0] > 3.0, "crash signal with impact > 3 m/s")
	await seconds(0.5)
	check(truck.forward_speed() < pre_speed * 0.5, "crash slashes speed (%.1f -> %.1f)" % [pre_speed, truck.forward_speed()])
	check(messages.any(func(m: String) -> bool: return m.begins_with("¡Choque!")), "crash message shown")

	print("== Repair ==")
	player.exit_truck()
	truck.wear = 10.0
	GameState.money = 5
	await place(station.global_position + Vector3(3.5, 0.3, 0))
	player.global_position = station.global_position + Vector3(0, 0.1, 3.0)
	await frames(5)
	player.interact()
	check(is_equal_approx(truck.wear, 10.0) and GameState.money == 5, "repair refused with < $20")
	GameState.add_money(25)
	player.interact()
	check(is_equal_approx(truck.wear, 0.0) and GameState.money == 10, "repair costs $20 and resets wear (money=%d)" % GameState.money)
	check(messages.has("Camión reparado"), "message 'Camión reparado'")
	finish()
