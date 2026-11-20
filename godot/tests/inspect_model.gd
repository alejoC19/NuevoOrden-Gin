extends Node
func _dump(n: Node, depth: int) -> void:
	var extra := ""
	if n is MeshInstance3D:
		var mi := n as MeshInstance3D
		var bb := mi.get_aabb()
		extra = " mesh surfaces=%d aabb_pos=%s size=%s" % [mi.mesh.get_surface_count(), bb.position, bb.size]
		var m := mi.get_active_material(0)
		extra += " mat=%s" % (m.resource_name if m else "none")
	print("  ".repeat(depth), n.name, " [", n.get_class(), "] pos=", (n as Node3D).position if n is Node3D else "", extra)
	for c in n.get_children():
		_dump(c, depth + 1)

func _ready() -> void:
	for a in OS.get_cmdline_user_args():
		print("=== ", a)
		var ps := load(a) as PackedScene
		var inst := ps.instantiate()
		_dump(inst, 0)
	get_tree().quit()
