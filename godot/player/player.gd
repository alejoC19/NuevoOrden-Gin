class_name Player
extends CharacterBody3D
## First-person on-foot controller. Also routes input while driving a truck.

const SPEED: float = 5.0
const JUMP_VELOCITY: float = 4.5
const GRAVITY: float = 20.0
const MOUSE_SENSITIVITY: float = 0.0025
const TRUCK_REACH: float = 18.0

var driving_truck: Truck = null

@onready var _head: Node3D = $Head
@onready var _camera: Camera3D = $Head/Camera3D
@onready var _interact_area: Area3D = $InteractArea
@onready var _collider: CollisionShape3D = $CollisionShape3D


func _ready() -> void:
	add_to_group("player")
	Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	_camera.make_current()


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED and driving_truck == null:
		rotate_y(-event.relative.x * MOUSE_SENSITIVITY)
		_head.rotate_x(-event.relative.y * MOUSE_SENSITIVITY)
		_head.rotation.x = clampf(_head.rotation.x, deg_to_rad(-80.0), deg_to_rad(80.0))
	elif event.is_action_pressed("toggle_mouse"):
		toggle_mouse()
	elif event.is_action_pressed("interact"):
		interact()
	elif event.is_action_pressed("ui_cancel") and driving_truck != null:
		exit_truck()


func toggle_mouse() -> void:
	if Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	else:
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED


func _physics_process(delta: float) -> void:
	if driving_truck != null:
		return
	if not is_on_floor():
		velocity.y -= GRAVITY * delta
	elif Input.is_action_just_pressed("ui_accept"):
		velocity.y = JUMP_VELOCITY
	var input_dir: Vector2 = Input.get_vector("move_left", "move_right", "move_forward", "move_back")
	var direction: Vector3 = (global_transform.basis * Vector3(input_dir.x, 0.0, input_dir.y)).normalized()
	velocity.x = direction.x * SPEED
	velocity.z = direction.z * SPEED
	move_and_slide()
	_update_prompt()


# --- Interaction -------------------------------------------------------------

func _nearest_in_group(group: StringName) -> Area3D:
	var best: Area3D = null
	var best_dist: float = INF
	for area in _interact_area.get_overlapping_areas():
		if not area.is_in_group(group):
			continue
		if area is CargoPickup and not (area as CargoPickup).available:
			continue
		var d: float = global_position.distance_to(area.global_position)
		if d < best_dist:
			best_dist = d
			best = area
	return best


func _nearest_truck() -> Truck:
	var best: Truck = null
	var best_dist: float = TRUCK_REACH
	for node in get_tree().get_nodes_in_group("truck"):
		var truck := node as Truck
		var d: float = global_position.distance_to(truck.global_position)
		if d < best_dist:
			best_dist = d
			best = truck
	return best


func _current_action() -> Dictionary:
	## Returns {"text": String, "run": Callable} for the best available interaction.
	var seat := _nearest_in_group(&"vehicle_driver_seat")
	if seat != null:
		return {"text": "[E] Subir al camión", "run": _do_enter.bind(seat)}
	var pickup := _nearest_in_group(&"cargo_pickup")
	if pickup != null:
		return {"text": "[E] Cargar caja", "run": _do_pickup.bind(pickup)}
	var point := _nearest_in_group(&"delivery_point")
	if point != null:
		return {"text": "[E] Entregar caja", "run": _do_deliver.bind(point)}
	return {}


func _update_prompt() -> void:
	var action: Dictionary = _current_action()
	GameState.set_prompt("" if action.is_empty() else String(action["text"]))


func interact() -> void:
	if driving_truck != null:
		return
	var action: Dictionary = _current_action()
	if not action.is_empty():
		(action["run"] as Callable).call()


func _do_enter(seat: Area3D) -> void:
	var truck := seat.get_parent() as Truck
	if truck != null:
		enter_truck(truck)


func _do_pickup(pickup: Area3D) -> void:
	var truck := _nearest_truck()
	if truck == null:
		GameState.post_message("Acercá el camión al almacén")
		return
	if truck.current_cargo >= truck.max_cargo:
		GameState.post_message("El camión está lleno")
		return
	if (pickup as CargoPickup).take():
		truck.add_cargo()
		GameState.post_message("Caja cargada (%d/%d)" % [truck.current_cargo, truck.max_cargo])


func _do_deliver(point: Area3D) -> void:
	var delivery := point as DeliveryPoint
	var truck := _nearest_truck()
	if truck == null or truck.current_cargo <= 0:
		GameState.post_message("No tenés cajas para entregar")
		return
	if not delivery.can_deliver():
		GameState.post_message("Este punto ya recibió una entrega")
		return
	truck.remove_cargo()
	delivery.mark_completed()
	GameState.add_money(DeliveryPoint.REWARD)
	GameState.register_delivery()
	GameState.post_message("Entrega completada +$%d" % DeliveryPoint.REWARD)


# --- Vehicle -----------------------------------------------------------------

func enter_truck(truck: Truck) -> void:
	driving_truck = truck
	visible = false
	_collider.disabled = true
	velocity = Vector3.ZERO
	GameState.set_prompt("")
	truck.set_driven(true)
	GameState.set_active_truck(truck)


func exit_truck() -> void:
	var truck := driving_truck
	if truck == null:
		return
	truck.set_driven(false)
	driving_truck = null
	global_position = truck.get_exit_position()
	rotation.y = truck.rotation.y
	_head.rotation.x = 0.0
	visible = true
	_collider.disabled = false
	_camera.make_current()
	GameState.set_active_truck(null)
