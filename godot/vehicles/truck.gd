class_name Truck
extends VehicleBody3D
## Old delivery truck. WASD to drive, Space = handbrake, E at a fuel station = refuel.
## Cargo adds mass and lowers top speed; fuel is burnt while accelerating; wear lowers
## top speed and grows with deliveries and hard crashes.

signal cargo_changed(current: int, max: int)
signal fuel_changed(fuel: float)
signal wear_changed(wear: float)
signal crashed(impact_speed: float)

const BASE_MAX_SPEED: float = 15.0
const REVERSE_MAX_SPEED: float = 5.0
const BASE_MASS: float = 1000.0
const MASS_PER_BOX: float = 150.0
const LOAD_SPEED_PENALTY: float = 0.10  # top speed lost per crate (3 crates = -30%)
const ENGINE_FORCE: float = 1800.0
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

var max_cargo: int = 3
var current_cargo: int = 0
var fuel: float = FUEL_MAX
var wear: float = 0.0
var is_driven: bool = false

var _crates: Array[MeshInstance3D] = []
var _prev_velocity: Vector3 = Vector3.ZERO
var _crash_cooldown: float = 0.0
var _empty_tank_warning: float = 0.0
var _last_prompt: String = ""

@onready var _camera: Camera3D = $CameraPivot/Camera3D
@onready var _exit_marker: Marker3D = $ExitMarker
@onready var _cargo_box: Node3D = $Visual/CargoBox
@onready var _interact_area: Area3D = $InteractArea


func _ready() -> void:
	add_to_group("truck")
	can_sleep = false
	center_of_mass_mode = RigidBody3D.CENTER_OF_MASS_MODE_CUSTOM
	center_of_mass = Vector3(0.0, -0.2, 0.0)
	_update_mass()
	cargo_changed.emit(current_cargo, max_cargo)


# --- Derived stats -----------------------------------------------------------

## Signed speed along the truck's forward direction (m/s).
func forward_speed() -> float:
	return linear_velocity.dot(-global_transform.basis.z)


func get_load_factor() -> float:
	return maxf(0.2, 1.0 - LOAD_SPEED_PENALTY * current_cargo)


func get_wear_factor() -> float:
	return 1.0 - 0.5 * (wear / 100.0)


func get_max_speed() -> float:
	return BASE_MAX_SPEED * get_load_factor() * get_wear_factor()


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
	return Vector3(-0.5 + 1.0 * col, -0.32, -1.0 + 1.0 * row)


func _add_crate_visual() -> void:
	var crate := MeshInstance3D.new()
	crate.name = "CargoCrate%d" % _crates.size()
	var box := BoxMesh.new()
	box.size = Vector3(0.8, 0.8, 0.8)
	crate.mesh = box
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.62, 0.42, 0.22)
	mat.roughness = 0.85
	crate.material_override = mat
	crate.position = _crate_slot(_crates.size())
	_cargo_box.add_child(crate)
	_crates.append(crate)


func _remove_crate_visual() -> void:
	if _crates.is_empty():
		return
	var crate: MeshInstance3D = _crates.pop_back()
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


func _physics_process(delta: float) -> void:
	_crash_cooldown = maxf(0.0, _crash_cooldown - delta)
	_empty_tank_warning = maxf(0.0, _empty_tank_warning - delta)
	if not is_driven:
		engine_force = 0.0
		brake = PARKED_BRAKE
		steering = move_toward(steering, 0.0, delta * 3.0)
		return

	var throttle: float = Input.get_axis("move_back", "move_forward")
	var steer_input: float = Input.get_axis("move_right", "move_left")
	var speed: float = forward_speed()
	var max_speed: float = get_max_speed()

	var engine: float = 0.0
	var brake_value: float = 0.0
	if throttle > 0.0:
		if speed < -0.5:
			brake_value = BRAKE_FORCE
		else:
			engine = throttle * ENGINE_FORCE * clampf((1.0 - speed / max_speed) * 4.0, 0.0, 1.0)
	elif throttle < 0.0:
		if speed > 0.5:
			brake_value = BRAKE_FORCE
		else:
			engine = throttle * ENGINE_FORCE * clampf((1.0 - (-speed) / REVERSE_MAX_SPEED) * 4.0, 0.0, 1.0)
	else:
		brake_value = IDLE_BRAKE
	if Input.is_action_pressed("brake"):
		brake_value = BRAKE_FORCE
		engine = 0.0

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

	_set_prompt("[E] Cargar combustible" if is_near_fuel_station() else "")
