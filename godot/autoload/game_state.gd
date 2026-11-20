extends Node
## Global game state (autoload). Money, deliveries and UI message bus.

signal money_changed(amount: int)
signal delivery_completed(total: int)
signal message_posted(text: String)
signal prompt_changed(text: String)
signal active_truck_changed(truck: Node3D)

var money: int = 0
var deliveries_completed: int = 0
var active_truck: Node3D = null


func add_money(amount: int) -> void:
	money += amount
	money_changed.emit(money)


func spend_money(amount: int) -> bool:
	if money < amount:
		return false
	money -= amount
	money_changed.emit(money)
	return true


func register_delivery() -> void:
	deliveries_completed += 1
	delivery_completed.emit(deliveries_completed)


func post_message(text: String) -> void:
	message_posted.emit(text)


func set_prompt(text: String) -> void:
	prompt_changed.emit(text)


func set_active_truck(truck: Node3D) -> void:
	active_truck = truck
	active_truck_changed.emit(truck)
