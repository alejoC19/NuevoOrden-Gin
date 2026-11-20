extends Node
## Screenshot tool (needs a GPU/Vulkan driver, e.g. xvfb + lavapipe).
## godot --path . --rendering-driver vulkan res://tests/shot.tscn -- out=/tmp/a.png cam=0,5,10 look=0,1,0 [hud=0] [time=2]

func _arg(key: String, default: String) -> String:
	for a in OS.get_cmdline_user_args():
		if a.begins_with(key + "="):
			return a.substr(key.length() + 1)
	return default


func _vec(s: String) -> Vector3:
	var p := s.split(",")
	return Vector3(float(p[0]), float(p[1]), float(p[2]))


func _ready() -> void:
	var world: Node3D = (load("res://world/world.tscn") as PackedScene).instantiate()
	add_child(world)
	var cam := Camera3D.new()
	cam.fov = float(_arg("fov", "70"))
	world.add_child(cam)
	cam.global_position = _vec(_arg("cam", "0,5,10"))
	cam.look_at(_vec(_arg("look", "0,1,0")))
	cam.make_current()
	if _arg("hud", "1") == "0":
		world.get_node("HUD").visible = false
	for i in int(float(_arg("time", "2")) * 60.0):
		await get_tree().process_frame
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png(_arg("out", "/tmp/shot.png"))
	print("SHOT_SAVED")
	get_tree().quit()
