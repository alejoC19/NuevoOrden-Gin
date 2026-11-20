extends Node3D
## Root of the game world. Phase 1 win condition (replaced by QuestManager later).

const TARGET_DELIVERIES: int = 3


func _ready() -> void:
	GameState.delivery_completed.connect(_on_delivery_completed)


func _on_delivery_completed(total: int) -> void:
	var hud := get_tree().get_first_node_in_group("hud") as Hud
	if hud != null:
		hud.set_objective("Objetivo: Completá 3 entregas (%d/%d)" % [mini(total, TARGET_DELIVERIES), TARGET_DELIVERIES])
	if total == TARGET_DELIVERIES:
		GameState.post_message("Prototipo completado")
