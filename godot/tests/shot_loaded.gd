extends Node
func _ready() -> void:
	var world: Node3D = (load("res://world/world.tscn") as PackedScene).instantiate()
	add_child(world)
	var truck := world.get_node("Truck") as Truck
	for i in 5:
		truck.max_cargo = 5
		truck.add_cargo()
	var cam := Camera3D.new()
	world.add_child(cam)
	cam.global_position = Vector3(-34, 4.2, -26)
	cam.look_at(Vector3(-30, 1.6, -19))
	cam.make_current()
	world.get_node("HUD").visible = false
	for i in 90:
		await get_tree().process_frame
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png("/tmp/claude-0/shots/loaded.png")
	get_tree().quit()
