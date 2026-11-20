class_name CargoPickup
extends Area3D
## A crate in the warehouse. Taking it hides it; it respawns after RESPAWN_TIME.

const RESPAWN_TIME: float = 10.0

var available: bool = true

@onready var _crate: Node3D = $Crate


func take() -> bool:
	if not available:
		return false
	available = false
	_crate.visible = false
	get_tree().create_timer(RESPAWN_TIME).timeout.connect(_respawn)
	return true


func _respawn() -> void:
	available = true
	_crate.visible = true
