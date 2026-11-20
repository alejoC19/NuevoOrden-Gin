extends TestBase


func _ready() -> void:
	var world := load_world()
	await seconds(2.0)
	var player := world.get_node("Player") as Player
	var truck := world.get_node("Truck") as Truck
	print("Truck settled y=%.2f pos=%s" % [truck.global_position.y, truck.global_position])
	check(truck.global_position.y > -0.2 and truck.global_position.y < 1.0, "truck rests on its wheels")

	# --- load 3 crates ---
	for i in 3:
		var pickup := world.get_node("Warehouse/CargoPickup%d" % (i + 1)) as Node3D
		player.global_position = pickup.global_position + Vector3(0, 0, 1.0)
		await frames(3)
		player.interact()
	check(truck.current_cargo == 3, "3 crates loaded (cargo=%d)" % truck.current_cargo)
	check(messages.has("Caja cargada (3/3)"), "message 'Caja cargada (3/3)'")
	var extra := world.get_node("Warehouse/CargoPickup4") as Node3D
	player.global_position = extra.global_position + Vector3(0, 0, 1.0)
	await frames(3)
	player.interact()
	check(truck.current_cargo == 3 and messages.has("El camión está lleno"), "cannot exceed max cargo")
	check(not (world.get_node("Warehouse/CargoPickup1") as CargoPickup).available, "taken crate is hidden")

	# --- enter truck ---
	var seat := truck.get_node("DriverSeat") as Node3D
	player.global_position = seat.global_position + Vector3(0, -0.5, 0)
	await frames(3)
	player.interact()
	check(player.driving_truck == truck and truck.is_driven, "player entered truck")
	check(GameState.active_truck == truck, "active truck registered")

	# --- drive (on a clear lane) ---
	truck.global_transform = Transform3D(Basis(Vector3.UP, PI), Vector3(-42, 0.3, -18))
	truck.linear_velocity = Vector3.ZERO
	await seconds(1.0)
	Input.action_press("move_forward")
	var peak: float = 0.0
	for s in 12:
		await seconds(1.0)
		peak = maxf(peak, truck.forward_speed())
		print("  t=%2ds speed=%.2f pos=%s" % [s + 1, truck.forward_speed(), truck.global_position])
		if truck.global_position.z > 30.0:
			Input.action_release("move_forward")
			break
	Input.action_release("move_forward")
	check(peak > 8.0, "truck accelerates (peak %.1f m/s)" % peak)
	check(peak <= Truck.BASE_MAX_SPEED + 1.0, "speed capped near base max (%.1f)" % peak)
	check(truck.global_position.distance_to(Vector3(-42, 1, -18)) > 20.0, "truck moved forward")
	Input.action_press("brake")
	await seconds(4.0)
	Input.action_release("brake")
	check(absf(truck.forward_speed()) < 1.0, "handbrake stops the truck (%.2f)" % truck.forward_speed())

	# --- steering ---
	var heading0: float = truck.rotation.y
	Input.action_press("move_forward")
	Input.action_press("move_left")
	await seconds(3.0)
	Input.action_release("move_left")
	Input.action_release("move_forward")
	check(angle_difference(heading0, truck.rotation.y) > 0.15, "steering left turns the truck left (dyaw=%.2f)" % angle_difference(heading0, truck.rotation.y))
	Input.action_press("brake")
	await seconds(4.0)
	Input.action_release("brake")

	# --- exit + deliver ---
	player.exit_truck()
	check(player.driving_truck == null and player.visible, "player exited truck")
	var dp1 := world.get_node("DeliveryPoint1") as DeliveryPoint
	var dp2 := world.get_node("DeliveryPoint2") as DeliveryPoint
	truck.global_position = dp1.global_position + Vector3(5, 1.2, 0)
	truck.linear_velocity = Vector3.ZERO
	player.global_position = dp1.global_position + Vector3(1, 0.1, 0)
	await frames(5)
	player.interact()
	check(GameState.money == 50 and GameState.deliveries_completed == 1, "delivery 1 pays $50")
	check(truck.current_cargo == 2, "cargo decreased")
	player.interact()
	check(GameState.money == 50, "same point refuses during cooldown")
	player.global_position = dp2.global_position + Vector3(1, 0.1, 0)
	truck.global_position = dp2.global_position + Vector3(5, 1.2, 0)
	await frames(5)
	player.interact()
	check(GameState.money == 100, "delivery 2 pays $50")
	await seconds(5.3)
	check(dp1.can_deliver(), "point resets after 5 s")
	player.global_position = dp1.global_position + Vector3(1, 0.1, 0)
	truck.global_position = dp1.global_position + Vector3(5, 1.2, 0)
	await frames(5)
	player.interact()
	check(GameState.deliveries_completed == 3 and messages.has("Prototipo completado"), "3 deliveries -> 'Prototipo completado'")
	await seconds(4.5)
	check((world.get_node("Warehouse/CargoPickup1") as CargoPickup).available, "crates respawn after 10 s")
	finish()
