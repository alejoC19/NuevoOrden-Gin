extends Node
## Renders models side by side: args models=a,b,c out=path [scale=1 cx= cy= cz=]
func _arg(key: String, default: String) -> String:
	for a in OS.get_cmdline_user_args():
		if a.begins_with(key + "="):
			return a.substr(key.length() + 1)
	return default

func _ready() -> void:
	var env := WorldEnvironment.new()
	var e := Environment.new()
	e.background_mode = Environment.BG_COLOR
	e.background_color = Color(0.5, 0.55, 0.6)
	e.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	e.ambient_light_color = Color(0.6, 0.6, 0.6)
	env.environment = e
	add_child(env)
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-40, -35, 0)
	add_child(sun)
	var models := _arg("models", "").split(",")
	var scale_v := float(_arg("scale", "1"))
	for i in models.size():
		var res := load(models[i])
		var inst: Node3D
		if res is PackedScene:
			inst = (res as PackedScene).instantiate() as Node3D
			for c in inst.get_children():
				if c is Light3D or c is Camera3D:
					c.queue_free()
		else:
			inst = MeshInstance3D.new()
			(inst as MeshInstance3D).mesh = res as Mesh
			print(models[i], " aabb=", (res as Mesh).get_aabb(), " surfaces=", (res as Mesh).get_surface_count())
		inst.scale = Vector3.ONE * scale_v
		inst.position = Vector3(i * 7.0, 0, 0)
		add_child(inst)
	var cam := Camera3D.new()
	add_child(cam)
	var mid := (models.size() - 1) * 3.5
	cam.position = Vector3(mid + float(_arg("cx", "0")), float(_arg("cy", "7")), float(_arg("cz", "14")))
	cam.look_at(Vector3(mid, 1.5, 0))
	cam.make_current()
	for i in 20:
		await get_tree().process_frame
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png(_arg("out", "/tmp/mv.png"))
	get_tree().quit()
