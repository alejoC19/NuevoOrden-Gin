class_name Hud
extends CanvasLayer
## Heads-up display. Listens to GameState and to the active truck's signals.

const MESSAGE_TIME: float = 3.0

var _truck: Truck = null
var _message_timer: float = 0.0

@onready var _money: Label = $Root/MoneyLabel
@onready var _message: Label = $Root/MessageLabel
@onready var _objective: Label = $Root/ObjectiveLabel
@onready var _distance: Label = $Root/DistanceLabel
@onready var _prompt: Label = $Root/PromptLabel
@onready var _panel: Control = $Root/TruckPanel
@onready var _speed: Label = $Root/TruckPanel/SpeedLabel
@onready var _cargo: Label = $Root/TruckPanel/CargoLabel
@onready var _fuel: Label = $Root/TruckPanel/FuelLabel
@onready var _fuel_bar: ProgressBar = $Root/TruckPanel/FuelBar
@onready var _wear: Label = $Root/TruckPanel/WearLabel
@onready var _wear_bar: ProgressBar = $Root/TruckPanel/WearBar


func _ready() -> void:
	add_to_group("hud")
	GameState.money_changed.connect(_on_money_changed)
	GameState.message_posted.connect(_on_message)
	GameState.prompt_changed.connect(_on_prompt)
	GameState.active_truck_changed.connect(_on_active_truck_changed)
	_on_money_changed(GameState.money)
	_on_prompt("")
	_message.text = ""
	_distance.text = ""
	_panel.visible = false
	set_objective("Objetivo: Completá 3 entregas")


func set_objective(text: String) -> void:
	_objective.text = text


func _process(delta: float) -> void:
	if _message_timer > 0.0:
		_message_timer -= delta
		if _message_timer <= 0.0:
			_message.text = ""
	if _truck != null:
		_speed.text = "Velocidad: %d km/h" % roundi(absf(_truck.forward_speed()) * 3.6)
		_update_distance()


func _update_distance() -> void:
	var target: Node3D = null
	var label: String = ""
	if _truck.current_cargo > 0:
		var best: float = INF
		for node in get_tree().get_nodes_in_group("delivery_point"):
			var point := node as DeliveryPoint
			if point == null or not point.can_deliver():
				continue
			var d: float = _truck.global_position.distance_to(point.global_position)
			if d < best:
				best = d
				target = point
		label = "Entrega"
	else:
		target = get_tree().get_first_node_in_group("warehouse") as Node3D
		label = "Almacén"
	if target == null:
		_distance.text = ""
	else:
		_distance.text = "%s: %d m" % [label, roundi(_truck.global_position.distance_to(target.global_position))]


func _on_money_changed(amount: int) -> void:
	_money.text = "Dinero: $%d" % amount


func _on_message(text: String) -> void:
	_message.text = text
	_message_timer = MESSAGE_TIME


func _on_prompt(text: String) -> void:
	_prompt.text = text
	_prompt.visible = text != ""


func _on_active_truck_changed(truck: Node3D) -> void:
	if _truck != null:
		_truck.cargo_changed.disconnect(_on_cargo_changed)
		_truck.fuel_changed.disconnect(_on_fuel_changed)
		_truck.wear_changed.disconnect(_on_wear_changed)
	_truck = truck as Truck
	_panel.visible = _truck != null
	if _truck == null:
		_distance.text = ""
		return
	_truck.cargo_changed.connect(_on_cargo_changed)
	_truck.fuel_changed.connect(_on_fuel_changed)
	_truck.wear_changed.connect(_on_wear_changed)
	_on_cargo_changed(_truck.current_cargo, _truck.max_cargo)
	_on_fuel_changed(_truck.fuel)
	_on_wear_changed(_truck.wear)


func _on_cargo_changed(current: int, maximum: int) -> void:
	_cargo.text = "Carga: %d/%d" % [current, maximum]


func _on_fuel_changed(fuel: float) -> void:
	_fuel.text = "Nafta: %d%%" % roundi(fuel)
	_fuel_bar.value = fuel


func _on_wear_changed(wear: float) -> void:
	_wear.text = "Desgaste: %d%%" % roundi(wear)
	_wear_bar.value = wear
