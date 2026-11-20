class_name TestBase
extends Node
## Tiny helper base for headless simulation tests.

var failures: int = 0
var messages: Array[String] = []


func check(cond: bool, label: String) -> void:
	if cond:
		print("  PASS  ", label)
	else:
		print("  FAIL  ", label)
		failures += 1


func frames(n: int) -> void:
	for i in n:
		await get_tree().physics_frame


func seconds(t: float) -> void:
	await frames(int(t * 60.0))


func finish() -> void:
	print("RESULT: %s (%d failures)" % ["OK" if failures == 0 else "FAILED", failures])
	get_tree().quit(1 if failures > 0 else 0)


func load_world() -> Node3D:
	var world: Node3D = (load("res://world/world.tscn") as PackedScene).instantiate()
	add_child(world)
	GameState.message_posted.connect(func(t: String) -> void: messages.append(t))
	return world
