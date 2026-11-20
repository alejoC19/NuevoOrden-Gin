class_name Truck
extends VehicleBody3D
## Old delivery truck. WASD to drive, Space = handbrake, E at a fuel station = refuel.
## Cargo adds mass and lowers top speed; fuel is burnt while accelerating; wear lowers
## top speed and grows with deliveries and hard crashes.

signal cargo_changed(current: int, max: int)
signal fuel_changed(fuel: float)
signal wear_changed(wear: float)
signal crashed(impact_speed: float)
signal gear_changed(gear: int)

const BASE_MAX_SPEED: float = 15.0
const REVERSE_MAX_SPEED: float = 5.0
const BASE_MASS: float = 1000.0
const MASS_PER_BOX: float = 150.0
const LOAD_SPEED_PENALTY: float = 0.10  # top speed lost per crate (3 crates = -30%)
const ENGINE_FORCE: float = 1650.0     # base force per driven wheel, multiplied by gear and torque curve
const GEAR_TOP: Array[float] = [0.28, 0.52, 0.78, 1.0]   # fraction of top speed where each gear tops out
const GEAR_FORCE: Array[float] = [2.1, 1.45, 1.05, 0.8]  # gear ratio multiplier (1st pulls hard, 4th is tall)
const UPSHIFT_RPM: float = 0.93
const DOWNSHIFT_RPM: float = 0.36
const SHIFT_TIME: float = 0.22
const FRONT_SLIP: float = 3.2
const REAR_SLIP: float = 2.9
const REAR_SLIP_MIN: float = 1.5
const HANDBRAKE_REAR_SLIP: float = 1.0
const BRAKE_FORCE: float = 30.0
const IDLE_BRAKE: float = 2.0
const PARKED_BRAKE: float = 30.0
const MAX_STEER: float = 0.5

const FUEL_MAX: float = 100.0
const FUEL_USE_PER_SECOND: float = 1.0
const WEAR_PER_DELIVERY: float = 2.0
const WEAR_PER_CRASH: float = 10.0
const CRASH_SPEED: float = 3.0
const CRASH_COOLDOWN: float = 1.0
const CRASH_SPEED_KEPT: float = 0.3
const REPAIR_COST: int = 20

@export_group("External model (plug)")
## Drag the 3D truck (e.g. the Meshy glb) here. It replaces the built-in body/wheel meshes; physics,
## collisions and VehicleWheel3D nodes are untouched. If the model has nodes called WheelFL, WheelFR,
## WheelRL, WheelRR (pivot at the wheel centre) they are attached to the physics wheels.
@export var truck_mesh_scene: PackedScene
## Zero-drag alternative: if truck_mesh_scene is empty and this file exists it is loaded automatically.
@export_file("*.glb", "*.gltf", "*.tscn") var truck_mesh_path: String = "res://assets/ai_generated/truck.glb"
@export var truck_model_scale: float = 1.0
@export var truck_model_offset: Vector3 = Vector3.ZERO
## Rotate the model about Y if it faces +Z (the truck drives toward -Z).
@export var truck_model_yaw_deg: float = 0.0
@export var hide_builtin_visuals: bool = true
## Closed box bodies hide the load; keep this off for them, on for open flatbeds.
@export var show_crates_with_external_model: bool = false

var max_cargo: int = 3
var current_cargo: int = 0
var fuel: float = FUEL_MAX
var wear: float = 0.0
var is_driven: bool = false
var gear: int = 1              # 1..4, -1 = reverse
var engine_rpm: float = 0.15   # 0..1 (idle .. redline), used by sound and particles
var top_speed_mult: float = 1.0
var power_mult: float = 1.0
var brake_mult: float = 1.0
var engine_v8: bool = false
var _shift_timer: float = 0.0
var _upside_down_time: float = 0.0
var _smoke_mat: ParticleProcessMaterial
var _soot_mat: ParticleProcessMaterial

var _crates: Array[Node3D] = []
var _prev_velocity: Vector3 = Vector3.ZERO
var _crash_cooldown: float = 0.0
var _empty_tank_warning: float = 0.0
var _last_prompt: String = ""

@onready var _camera: Camera3D = $CameraArm/Camera3D
@onready var _wheels: Array[VehicleWheel3D] = [$WheelFL, $WheelFR, $WheelRL, $WheelRR]
@onready var _smoke: GPUParticles3D = $ExhaustSmoke
@onready var _soot: GPUParticles3D = $ExhaustSoot
@onready var _dust_l: GPUParticles3D = $DustRL
@onready var _dust_r: GPUParticles3D = $DustRR
@onready var _exit_marker: Marker3D = $ExitMarker
@onready var _cargo_box: Node3D = $Visual/CargoBox
@onready var _interact_area: Area3D = $InteractArea


func _ready() -> void:
	add_to_group("truck")
	can_sleep = false
	center_of_mass_mode = RigidBody3D.CENTER_OF_MASS_MODE_CUSTOM
	center_of_mass = Vector3(0.0, -0.2, 0.0)
	_update_mass()
	# Particle materials are sub-resources shared by every truck instance: make them unique.
	_smoke.process_material = _smoke.process_material.duplicate()
	_soot.process_material = _soot.process_material.duplicate()
	_smoke_mat = _smoke.process_material as ParticleProcessMaterial
	_soot_mat = _soot.process_material as ParticleProcessMaterial
	set_engine_v8(engine_v8)
	_apply_external_model()
	for slot in [_smoke, _soot, _dust_l, _dust_r]:
		slot.emitting = false
	cargo_changed.emit(current_cargo, max_cargo)


var _external_model: Node3D = null


func _apply_external_model() -> void:
	if truck_mesh_scene == null and truck_mesh_path != "" and ResourceLoader.exists(truck_mesh_path):
		truck_mesh_scene = load(truck_mesh_path) as PackedScene
	if truck_mesh_scene == null:
		return
	var model := truck_mesh_scene.instantiate() as Node3D
	if model == null:
		push_warning("Truck: truck_mesh_scene must have a Node3D root")
		return
	model.name = "ExternalModel"
	model.scale = Vector3.ONE * truck_model_scale
	model.position = truck_model_offset
	model.rotation_degrees.y = truck_model_yaw_deg
	$Visual.add_child(model)
	_external_model = model
	if hide_builtin_visuals:
		$Visual/Body.visible = false
		$Visual/CargoLiner.visible = false
		for w in _wheels:
			w.get_node("WheelMesh").visible = false
	for wheel_name in ["WheelFL", "WheelFR", "WheelRL", "WheelRR"]:
		var part := model.find_child(wheel_name, true, false) as Node3D
		if part != null:
			part.reparent(get_node(wheel_name), false)
			part.position = Vector3.ZERO


# --- Derived stats -----------------------------------------------------------

## Signed speed along the truck's forward direction (m/s).
func forward_speed() -> float:
	return linear_velocity.dot(-global_transform.basis.z)


func get_load_factor() -> float:
	return maxf(0.2, 1.0 - LOAD_SPEED_PENALTY * current_cargo)


func get_wear_factor() -> float:
	return 1.0 - 0.5 * (wear / 100.0)


func get_max_speed() -> float:
	return BASE_MAX_SPEED * top_speed_mult * get_load_factor() * get_wear_factor()


## Called by the shop (phase 4). The V8 is stronger, faster and smokes more (darker, denser exhaust).
func set_engine_v8(value: bool) -> void:
	engine_v8 = value
	top_speed_mult = 1.4 if value else 1.0
	power_mult = 1.8 if value else 1.0
	if _smoke_mat != null:
		_smoke_mat.color = Color(0.16, 0.14, 0.13, 0.7) if value else Color(0.5, 0.5, 0.5, 0.5)
		_soot_mat.color = Color(0.02, 0.02, 0.02, 0.9)
		_smoke.amount_ratio = 1.0
		_soot.amount = 90 if value else 50


func _update_mass() -> void:
	mass = BASE_MASS + MASS_PER_BOX * current_cargo


# --- State changes -----------------------------------------------------------

func set_driven(value: bool) -> void:
	is_driven = value
	if value:
		_camera.make_current()
	else:
		_set_prompt("")


func get_exit_position() -> Vector3:
	return _exit_marker.global_position


func add_cargo() -> bool:
	if current_cargo >= max_cargo:
		return false
	current_cargo += 1
	_add_crate_visual()
	_update_mass()
	cargo_changed.emit(current_cargo, max_cargo)
	return true


func remove_cargo() -> bool:
	if current_cargo <= 0:
		return false
	current_cargo -= 1
	_remove_crate_visual()
	_update_mass()
	cargo_changed.emit(current_cargo, max_cargo)
	return true


func add_wear(amount: float) -> void:
	wear = clampf(wear + amount, 0.0, 100.0)
	wear_changed.emit(wear)


func register_delivery() -> void:
	add_wear(WEAR_PER_DELIVERY)


func refuel() -> void:
	fuel = FUEL_MAX
	fuel_changed.emit(fuel)


func is_near_fuel_station() -> bool:
	for area in _interact_area.get_overlapping_areas():
		if area.is_in_group("fuel_station"):
			return true
	return false


## E inside the truck at a fuel station.
func try_refuel() -> void:
	if not is_near_fuel_station():
		return
	if fuel >= FUEL_MAX - 0.01:
		GameState.post_message("El tanque ya está lleno")
		return
	refuel()
	GameState.post_message("Tanque lleno")


## E on foot at the fuel station. Costs REPAIR_COST.
func repair() -> void:
	if wear <= 0.0:
		GameState.post_message("El camión no necesita reparación")
		return
	if not GameState.spend_money(REPAIR_COST):
		GameState.post_message("Faltan $%d para reparar" % (REPAIR_COST - GameState.money))
		return
	wear = 0.0
	wear_changed.emit(wear)
	GameState.post_message("Camión reparado")


# --- Visible crates ----------------------------------------------------------

func _crate_slot(index: int) -> Vector3:
	var col: int = index % 2
	var row: int = index / 2
	return Vector3(-0.5 + 1.0 * col, 0.0, -0.9 + 0.9 * row)


const CRATE_SCENE: PackedScene = preload("res://world/crate_model.tscn")


func _add_crate_visual() -> void:
	var crate: Node3D = CRATE_SCENE.instantiate()
	crate.name = "CargoCrate%d" % _crates.size()
	crate.position = _crate_slot(_crates.size())
	crate.rotation.y = (_crates.size() % 3 - 1) * 0.08
	crate.visible = _external_model == null or show_crates_with_external_model
	_cargo_box.add_child(crate)
	_crates.append(crate)


func _remove_crate_visual() -> void:
	if _crates.is_empty():
		return
	var crate: Node3D = _crates.pop_back()
	crate.queue_free()


# --- Physics -----------------------------------------------------------------

func _set_prompt(text: String) -> void:
	if text != _last_prompt:
		_last_prompt = text
		GameState.set_prompt(text)


func _integrate_forces(state: PhysicsDirectBodyState3D) -> void:
	# Contacts reported now were solved last step, so _prev_velocity is the pre-impact velocity.
	if _crash_cooldown <= 0.0:
		for i in state.get_contact_count():
			var n: Vector3 = state.get_contact_local_normal(i)
			if absf(n.y) > 0.7:
				continue  # ground / ramps are not crashes
			var impact: float = absf(_prev_velocity.dot(n))
			if impact > CRASH_SPEED:
				state.linear_velocity *= CRASH_SPEED_KEPT
				_crash_cooldown = CRASH_COOLDOWN
				_on_crash.call_deferred(impact)
				break
	_prev_velocity = state.linear_velocity


func _on_crash(impact: float) -> void:
	add_wear(WEAR_PER_CRASH)
	crashed.emit(impact)
	if is_driven:
		GameState.post_message("¡Choque! Desgaste +%d%%" % int(WEAR_PER_CRASH))


func _torque_curve(r: float) -> float:
	## Simple engine torque curve over normalised rpm: weak at idle, peak mid-range, falls near redline.
	return lerpf(0.55, 1.0, smoothstep(0.0, 0.35, r)) * (1.0 - 0.3 * smoothstep(0.7, 1.0, r))


func _update_gearbox(speed: float, throttle: float, max_speed: float, delta: float) -> float:
	## Automatic 4-speed gearbox. Returns the engine force multiplier for the current gear/rpm.
	_shift_timer = maxf(0.0, _shift_timer - delta)
	if speed < -0.5 or (throttle < 0.0 and speed < 0.5):
		if gear != -1:
			gear = -1
			gear_changed.emit(gear)
		engine_rpm = lerpf(engine_rpm, 0.2 + 0.5 * clampf(-speed / REVERSE_MAX_SPEED, 0.0, 1.0), delta * 6.0)
		return 0.9
	if gear < 1:
		gear = 1
		gear_changed.emit(gear)
	var top: float = maxf(0.1, max_speed * GEAR_TOP[gear - 1])
	var rpm: float = clampf(speed / top, 0.0, 1.1)
	if _shift_timer <= 0.0:
		if rpm > UPSHIFT_RPM and gear < 4:
			gear += 1
			_shift_timer = SHIFT_TIME
			gear_changed.emit(gear)
		elif gear > 1 and speed / maxf(0.1, max_speed * GEAR_TOP[gear - 2]) < DOWNSHIFT_RPM:
			gear -= 1
			gear_changed.emit(gear)
	engine_rpm = lerpf(engine_rpm, 0.15 + 0.85 * rpm, delta * 8.0)
	if _shift_timer > 0.0:
		return 0.0  # engine cut while the clutch is open
	return GEAR_FORCE[gear - 1] * _torque_curve(rpm)


func _update_grip(speed: float, delta: float) -> void:
	## Front tyres keep their grip; rear tyres lose it when the truck corners hard, earlier when loaded
	## (light oversteer). The handbrake locks the rears for a slide.
	var lateral_accel: float = absf(speed * angular_velocity.y)
	var limit: float = 7.5 - 0.9 * current_cargo
	var over: float = clampf((lateral_accel - limit * 0.6) / (limit * 0.6), 0.0, 1.0)
	var rear: float = lerpf(REAR_SLIP, REAR_SLIP_MIN, over)
	if is_driven and Input.is_action_pressed("brake") and absf(speed) > 3.0:
		rear = HANDBRAKE_REAR_SLIP
	for w in _wheels:
		var target: float = FRONT_SLIP if w.use_as_steering else rear
		w.wheel_friction_slip = lerpf(w.wheel_friction_slip, target, clampf(delta * 8.0, 0.0, 1.0))


func _update_particles(throttle: float, speed: float, max_speed: float) -> void:
	var on: bool = is_driven
	_smoke.emitting = on
	_smoke.amount_ratio = lerpf(0.35, 1.0, clampf(absf(throttle), 0.0, 1.0)) if on else 0.0
	_soot.emitting = on and throttle > 0.9 and speed < max_speed * 0.92 and fuel > 0.0
	var roads := get_tree().get_first_node_in_group("road_network")
	var dust_on: bool = on and throttle > 0.0 and speed > 1.5
	for pair in [[_dust_l, _wheels[2]], [_dust_r, _wheels[3]]]:
		var emitter: GPUParticles3D = pair[0]
		var wheel: VehicleWheel3D = pair[1]
		var off_road: bool = roads == null or not roads.call("is_on_road", wheel.global_position)
		emitter.emitting = dust_on and off_road and wheel.is_in_contact()


func _check_flipped(delta: float) -> void:
	if global_transform.basis.y.y < 0.2:
		_upside_down_time += delta
		if _upside_down_time > 2.5:
			_upside_down_time = 0.0
			var heading: float = atan2(-(-global_transform.basis.z).x, -(-global_transform.basis.z).z)
			global_transform = Transform3D(Basis(Vector3.UP, heading), global_position + Vector3(0, 1.5, 0))
			linear_velocity = Vector3.ZERO
			angular_velocity = Vector3.ZERO
			GameState.post_message("Camión enderezado")
	else:
		_upside_down_time = 0.0


func _physics_process(delta: float) -> void:
	_crash_cooldown = maxf(0.0, _crash_cooldown - delta)
	_empty_tank_warning = maxf(0.0, _empty_tank_warning - delta)
	_check_flipped(delta)
	var speed: float = forward_speed()
	_update_grip(speed, delta)
	if not is_driven:
		engine_force = 0.0
		brake = PARKED_BRAKE
		steering = move_toward(steering, 0.0, delta * 3.0)
		engine_rpm = lerpf(engine_rpm, 0.0, delta * 4.0)
		_update_particles(0.0, speed, get_max_speed())
		return

	var throttle: float = Input.get_axis("move_back", "move_forward")
	var steer_input: float = Input.get_axis("move_right", "move_left")
	var max_speed: float = get_max_speed()
	var gear_mult: float = _update_gearbox(speed, throttle, max_speed, delta)

	var engine: float = 0.0
	var brake_value: float = 0.0
	if throttle > 0.0:
		if speed < -0.5:
			brake_value = BRAKE_FORCE
		else:
			engine = throttle * ENGINE_FORCE * power_mult * gear_mult * clampf((1.0 - speed / max_speed) * 7.0, 0.0, 1.0)
	elif throttle < 0.0:
		if speed > 0.5:
			brake_value = BRAKE_FORCE
		else:
			engine = throttle * ENGINE_FORCE * gear_mult * clampf((1.0 - (-speed) / REVERSE_MAX_SPEED) * 4.0, 0.0, 1.0)
	else:
		brake_value = IDLE_BRAKE
	if Input.is_action_pressed("brake"):
		brake_value = BRAKE_FORCE
		engine = 0.0
	brake_value *= brake_mult

	# Fuel: burnt while the accelerator is pressed.
	if throttle != 0.0 and fuel > 0.0:
		fuel = maxf(0.0, fuel - FUEL_USE_PER_SECOND * delta)
		fuel_changed.emit(fuel)
	if fuel <= 0.0:
		if throttle != 0.0 and _empty_tank_warning <= 0.0:
			GameState.post_message("¡Sin nafta! Buscá la estación")
			_empty_tank_warning = 5.0
		engine = 0.0

	# VehicleBody3D pushes along +Z for positive engine_force; the model faces -Z.
	engine_force = -engine
	brake = brake_value

	var steer_limit: float = MAX_STEER / (1.0 + absf(speed) * 0.08)
	steering = move_toward(steering, steer_input * steer_limit, delta * 2.5)

	_update_particles(throttle, speed, max_speed)
	_set_prompt("[E] Cargar combustible" if is_near_fuel_station() else "")
