class_name Hud
extends CanvasLayer
## Heads-up display. Listens to GameState and to the active truck's signals.

const MESSAGE_TIME: float = 3.0

var _truck: Truck = null
var _message_timer: float = 0.0

@onready var _money: Label = $Root/MoneyLabel
@onready var _cargo: Label = $Root/CargoLabel
@onready var _message: Label = $Root/MessageLabel
@onready var _objective: Label = $Root/ObjectiveLabel
@onready var _prompt: Label = $Root/PromptLabel


func _ready() -> void:
	add_to_group("hud")
	GameState.money_changed.connect(_on_money_changed)
	GameState.message_posted.connect(_on_message)
	GameState.prompt_changed.connect(_on_prompt)
	GameState.active_truck_changed.connect(_on_active_truck_changed)
	_on_money_changed(GameState.money)
	_on_prompt("")
	_message.text = ""
	_cargo.visible = false
	set_objective("Objetivo: Completá 3 entregas")


func set_objective(text: String) -> void:
	_objective.text = text


func _process(delta: float) -> void:
	if _message_timer > 0.0:
		_message_timer -= delta
		if _message_timer <= 0.0:
			_message.text = ""


func _on_money_changed(amount: int) -> void:
	_money.text = "Dinero: $%d" % amount


func _on_message(text: String) -> void:
	_message.text = text
	_message_timer = MESSAGE_TIME


func _on_prompt(text: String) -> void:
	_prompt.text = text
	_prompt.visible = text != ""


func _on_active_truck_changed(truck: Node3D) -> void:
	if _truck != null and _truck.cargo_changed.is_connected(_on_cargo_changed):
		_truck.cargo_changed.disconnect(_on_cargo_changed)
	_truck = truck as Truck
	_cargo.visible = _truck != null
	if _truck != null:
		_truck.cargo_changed.connect(_on_cargo_changed)
		_on_cargo_changed(_truck.current_cargo, _truck.max_cargo)


func _on_cargo_changed(current: int, maximum: int) -> void:
	_cargo.text = "Carga: %d/%d" % [current, maximum]
