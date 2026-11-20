class_name DeliveryPoint
extends Area3D
## Drop-off zone. Accepts one crate, then is "completed" for COOLDOWN seconds.

const REWARD: int = 50
const COOLDOWN: float = 5.0

var completed: bool = false

@onready var _ring: MeshInstance3D = $Ring
@onready var _label: Label3D = $Sign


func _ready() -> void:
	# Each instance needs its own material (sub-resources are shared between instances).
	var mat := _ring.get_surface_override_material(0)
	if mat != null:
		_ring.set_surface_override_material(0, mat.duplicate())
	_apply_state()


func can_deliver() -> bool:
	return not completed


func mark_completed() -> void:
	completed = true
	_apply_state()
	get_tree().create_timer(COOLDOWN).timeout.connect(_reset)


func _reset() -> void:
	completed = false
	_apply_state()


func _apply_state() -> void:
	var mat := _ring.get_surface_override_material(0) as StandardMaterial3D
	if mat == null:
		return
	if completed:
		mat.albedo_color = Color(0.9, 0.25, 0.2, 0.45)
		mat.emission = Color(0.9, 0.25, 0.2)
		_label.text = "Entregado"
	else:
		mat.albedo_color = Color(0.2, 0.9, 0.35, 0.45)
		mat.emission = Color(0.2, 0.9, 0.35)
		_label.text = "ENTREGA\n$%d" % REWARD
