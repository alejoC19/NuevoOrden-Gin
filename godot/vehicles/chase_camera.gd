class_name ChaseCamera
extends SpringArm3D
## Third-person chase camera with inertia. It follows the truck's position and heading with lag,
## pulls back when the truck accelerates and comes closer when it brakes (sense of weight).

@export var base_length: float = 9.0
@export var height: float = 2.8
@export var pitch_deg: float = -13.0
@export var base_fov: float = 68.0

var _truck: Truck
var _yaw: float = 0.0
var _prev_speed: float = 0.0
var _accel: float = 0.0

@onready var _camera: Camera3D = $Camera3D


func _ready() -> void:
	top_level = true
	_truck = get_parent() as Truck
	add_excluded_object(_truck.get_rid())
	_yaw = _heading()
	global_position = _truck.global_position + Vector3(0, height, 0)
	_apply_basis()


func _heading() -> float:
	var fwd: Vector3 = -_truck.global_transform.basis.z
	return atan2(-fwd.x, -fwd.z)


func _apply_basis() -> void:
	global_basis = Basis(Vector3.UP, _yaw) * Basis(Vector3.RIGHT, deg_to_rad(pitch_deg))


func _physics_process(delta: float) -> void:
	if not _truck.is_driven:
		return
	global_position = global_position.lerp(_truck.global_position + Vector3(0, height, 0), 1.0 - exp(-14.0 * delta))
	_yaw = lerp_angle(_yaw, _heading(), 1.0 - exp(-3.5 * delta))
	_apply_basis()
	var speed: float = _truck.forward_speed()
	var raw_accel: float = (speed - _prev_speed) / maxf(delta, 0.0001)
	_prev_speed = speed
	_accel = lerpf(_accel, clampf(raw_accel, -12.0, 8.0), 1.0 - exp(-2.5 * delta))
	var target: float = base_length + clampf(_accel * 0.45, -2.2, 2.4) + clampf(absf(speed) * 0.05, 0.0, 1.0)
	spring_length = lerpf(spring_length, target, 1.0 - exp(-3.0 * delta))
	_camera.fov = lerpf(_camera.fov, base_fov + clampf(absf(speed) * 0.5, 0.0, 9.0), 1.0 - exp(-3.0 * delta))
