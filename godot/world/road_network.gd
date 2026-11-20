class_name RoadNetwork
extends Node3D
## Two-lane asphalt roads built at runtime from polylines, connecting the warehouse with the fuel
## station and the delivery points. The asphalt is raised ROAD_Y (0.1 m) above the terrain with a
## concrete curb band on both sides, and has real box colliders, so you feel the kerb step.

const ROAD_WIDTH: float = 8.0
const CURB_WIDTH: float = 0.4
const ROAD_Y: float = 0.1
const DASH_LENGTH: float = 3.5
const DASH_GAP: float = 5.0

## World-space polylines (x, z). Corners are 90 degrees; edit freely.
const ROADS: Array = [
	[Vector2(-30, -24), Vector2(-30, 20), Vector2(150, 20), Vector2(150, 200), Vector2(296, 200)],
	[Vector2(-30, 20), Vector2(-30, 200), Vector2(-250, 200), Vector2(-250, 416)],
	[Vector2(-30, 3), Vector2(8, 3)],
]

var _segments: Array = []  # [Vector2 a, Vector2 b]


func _ready() -> void:
	add_to_group("road_network")
	var road_st := SurfaceTool.new()
	var line_st := SurfaceTool.new()
	var curb_st := SurfaceTool.new()
	for st in [road_st, line_st, curb_st]:
		st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var body := StaticBody3D.new()
	body.name = "RoadCollision"
	body.collision_layer = 1
	body.collision_mask = 0
	add_child(body)
	for road: Array in ROADS:
		for i in road.size() - 1:
			var a: Vector2 = road[i]
			var b: Vector2 = road[i + 1]
			_segments.append([a, b])
			var dir: Vector2 = (b - a).normalized()
			var interior_start: bool = i > 0
			var interior_end: bool = i < road.size() - 2
			var ext_a: float = ROAD_WIDTH * 0.5 + CURB_WIDTH if interior_start else 0.0
			var ext_b: float = ROAD_WIDTH * 0.5 + CURB_WIDTH if interior_end else 0.0
			# Asphalt surface (extended at joints so corners are filled).
			_add_strip(road_st, a - dir * ext_a, b + dir * ext_b, ROAD_WIDTH, ROAD_Y)
			# Collision slab: asphalt + curbs, ROAD_Y tall.
			var sa: Vector2 = a - dir * ext_a
			var sb: Vector2 = b + dir * ext_b
			var cs := CollisionShape3D.new()
			var box := BoxShape3D.new()
			box.size = Vector3(ROAD_WIDTH + CURB_WIDTH * 2.0, ROAD_Y, sa.distance_to(sb))
			cs.shape = box
			var mid: Vector2 = (sa + sb) * 0.5
			cs.transform = Transform3D(Basis(Vector3.UP, atan2(dir.x, dir.y)), Vector3(mid.x, ROAD_Y * 0.5, mid.y))
			body.add_child(cs)
			# Dashed centre line.
			var len: float = a.distance_to(b)
			var d: float = ext_a + 6.0 if interior_start else 2.0
			while d + DASH_LENGTH < len - (ext_b + 6.0 if interior_end else 2.0):
				_add_strip(line_st, a + dir * d, a + dir * (d + DASH_LENGTH), 0.2, ROAD_Y + 0.012)
				d += DASH_LENGTH + DASH_GAP
			# Curb bands along both edges (gaps at joints/junctions).
			var ca: Vector2 = a + dir * ext_a
			var cb: Vector2 = b - dir * ext_b
			if ca.distance_to(cb) > 1.0:
				var side: Vector2 = Vector2(-dir.y, dir.x)
				for s in [-1.0, 1.0]:
					var off: Vector2 = side * s * (ROAD_WIDTH * 0.5 + CURB_WIDTH * 0.5)
					_add_curb(curb_st, ca + off, cb + off, CURB_WIDTH)
	_add_mesh("Asphalt", road_st, load("res://materials/asphalt.tres"), false)
	_add_mesh("Lines", line_st, load("res://materials/road_line.tres"), false)
	_add_mesh("Curbs", curb_st, load("res://materials/concrete.tres"), true)


func _add_mesh(node_name: String, st: SurfaceTool, mat: Material, shadows: bool) -> void:
	var mi := MeshInstance3D.new()
	mi.name = node_name
	mi.mesh = st.commit()
	mi.material_override = mat
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON if shadows else GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(mi)


func _quad(st: SurfaceTool, p0: Vector3, p1: Vector3, p2: Vector3, p3: Vector3, n: Vector3) -> void:
	## p0..p3 are counter-clockwise seen from `n`; Godot front faces are clockwise, so reverse.
	for p in [p0, p2, p1, p0, p3, p2]:
		st.set_normal(n)
		st.add_vertex(p)


func _add_strip(st: SurfaceTool, a: Vector2, b: Vector2, width: float, y: float) -> void:
	var dir: Vector2 = (b - a).normalized()
	var side: Vector2 = Vector2(-dir.y, dir.x) * width * 0.5
	_quad(st, Vector3(a.x + side.x, y, a.y + side.y), Vector3(b.x + side.x, y, b.y + side.y),
		Vector3(b.x - side.x, y, b.y - side.y), Vector3(a.x - side.x, y, a.y - side.y), Vector3.UP)


func _add_curb(st: SurfaceTool, a: Vector2, b: Vector2, width: float) -> void:
	## Flush with the asphalt on top, with a vertical face dropping ROAD_Y to the terrain.
	var dir: Vector2 = (b - a).normalized()
	var side: Vector2 = Vector2(-dir.y, dir.x) * width * 0.5
	var low: Array[Vector3] = []
	var top: Array[Vector3] = []
	for pt in [[a, 1.0], [b, 1.0], [b, -1.0], [a, -1.0]]:
		var p: Vector2 = pt[0]
		var x: float = p.x + side.x * pt[1]
		var z: float = p.y + side.y * pt[1]
		low.append(Vector3(x, 0.0, z))
		top.append(Vector3(x, ROAD_Y, z))
	_quad(st, top[0], top[1], top[2], top[3], Vector3.UP)
	var n_side: Vector3 = Vector3(side.x, 0, side.y).normalized()
	_quad(st, low[0], low[1], top[1], top[0], n_side)
	_quad(st, low[2], low[3], top[3], top[2], -n_side)


func is_on_road(p: Vector3) -> bool:
	return distance_to_road(Vector2(p.x, p.z)) <= ROAD_WIDTH * 0.5 + CURB_WIDTH


## Distance from a point (x, z) to the nearest road centre line.
func distance_to_road(p: Vector2) -> float:
	var best: float = INF
	for seg: Array in _segments:
		var a: Vector2 = seg[0]
		var b: Vector2 = seg[1]
		var ab: Vector2 = b - a
		var t: float = clampf((p - a).dot(ab) / ab.length_squared(), 0.0, 1.0)
		best = minf(best, p.distance_to(a + ab * t))
	return best
