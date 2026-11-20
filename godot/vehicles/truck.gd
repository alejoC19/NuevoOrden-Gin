class_name Truck
extends VehicleBody3D
## Old delivery truck. Driven with WASD, Space = handbrake.

signal cargo_changed(current: int, max: int)

const BASE_MAX_SPEED: float = 15.0
const REVERSE_MAX_SPEED: float = 5.0
const BASE_MASS: float = 1000.0
const ENGINE_FORCE: float = 1800.0
const BRAKE_FORCE: float = 30.0
const IDLE_BRAKE: float = 2.0
const PARKED_BRAKE: float = 30.0
const MAX_STEER: float = 0.5

var max_cargo: int = 3
var current_cargo: int = 0
var is_driven: bool = false

@onready var _camera: Camera3D = $CameraPivot/Camera3D
@onready var _exit_marker: Marker3D = $ExitMarker


func _ready() -> void:
	add_to_group("truck")
	mass = BASE_MASS
	can_sleep = false
	center_of_mass_mode = RigidBody3D.CENTER_OF_MASS_MODE_CUSTOM
	center_of_mass = Vector3(0.0, -0.2, 0.0)
	cargo_changed.emit(current_cargo, max_cargo)


## Signed speed along the truck's forward direction (m/s).
func forward_speed() -> float:
	return linear_velocity.dot(-global_transform.basis.z)


func get_max_speed() -> float:
	return BASE_MAX_SPEED


func set_driven(value: bool) -> void:
	is_driven = value
	if value:
		_camera.make_current()


func get_exit_position() -> Vector3:
	return _exit_marker.global_position


func add_cargo() -> bool:
	if current_cargo >= max_cargo:
		return false
	current_cargo += 1
	cargo_changed.emit(current_cargo, max_cargo)
	return true


func remove_cargo() -> bool:
	if current_cargo <= 0:
		return false
	current_cargo -= 1
	cargo_changed.emit(current_cargo, max_cargo)
	return true


func _physics_process(delta: float) -> void:
	if not is_driven:
		engine_force = 0.0
		brake = PARKED_BRAKE
		steering = move_toward(steering, 0.0, delta * 3.0)
		return
	var throttle: float = Input.get_axis("move_back", "move_forward")
	var steer_input: float = Input.get_axis("move_right", "move_left")
	var speed: float = forward_speed()
	var max_speed: float = get_max_speed()

	var engine: float = 0.0
	var brake_value: float = 0.0
	if throttle > 0.0:
		if speed < -0.5:
			brake_value = BRAKE_FORCE
		else:
			engine = throttle * ENGINE_FORCE * clampf((1.0 - speed / max_speed) * 4.0, 0.0, 1.0)
	elif throttle < 0.0:
		if speed > 0.5:
			brake_value = BRAKE_FORCE
		else:
			engine = throttle * ENGINE_FORCE * clampf((1.0 - (-speed) / REVERSE_MAX_SPEED) * 4.0, 0.0, 1.0)
	else:
		brake_value = IDLE_BRAKE
	if Input.is_action_pressed("brake"):
		brake_value = BRAKE_FORCE
		engine = 0.0
	# VehicleBody3D pushes along +Z for positive engine_force; the model faces -Z.
	engine_force = -engine
	brake = brake_value

	var steer_limit: float = MAX_STEER / (1.0 + absf(speed) * 0.08)
	steering = move_toward(steering, steer_input * steer_limit, delta * 2.5)
