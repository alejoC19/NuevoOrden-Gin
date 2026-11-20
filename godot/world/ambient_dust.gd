class_name AmbientDust
extends GPUParticles3D
## Very subtle floating dust that follows the active camera (gives depth to the air).

func _process(_delta: float) -> void:
	var cam: Camera3D = get_viewport().get_camera_3d()
	if cam != null:
		global_position = cam.global_position
