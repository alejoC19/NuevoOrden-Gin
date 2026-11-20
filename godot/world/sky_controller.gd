class_name SkyController
extends WorldEnvironment
## Sky plug. Priority: `sky_texture` (drag a 360 image here) > res://assets/ai_generated/sky.hdr
## > the bundled CC0 Poly Haven HDRI that is already set in the Environment.

@export var sky_texture: Texture2D
@export_file("*.hdr", "*.exr", "*.png", "*.jpg") var sky_path: String = "res://assets/ai_generated/sky.hdr"
@export_range(0.1, 4.0) var sky_energy: float = 1.35


func _ready() -> void:
	var tex: Texture2D = sky_texture
	if tex == null and sky_path != "" and ResourceLoader.exists(sky_path):
		tex = load(sky_path) as Texture2D
	if environment == null or environment.sky == null:
		return
	if tex == null and not (environment.sky.sky_material is PanoramaSkyMaterial and (environment.sky.sky_material as PanoramaSkyMaterial).panorama != null):
		_use_procedural_sky()
		return
	if tex == null:
		return
	var mat := environment.sky.sky_material as PanoramaSkyMaterial
	if mat != null:
		mat.panorama = tex
		mat.energy_multiplier = sky_energy
		print("SkyController: using ", tex.resource_path)


## Fallback when no HDRI is available: procedural sky with a clearly defined sun.
func _use_procedural_sky() -> void:
	var mat := ProceduralSkyMaterial.new()
	mat.sky_top_color = Color(0.2, 0.4, 0.75)
	mat.sky_horizon_color = Color(0.7, 0.78, 0.86)
	mat.ground_horizon_color = Color(0.62, 0.62, 0.58)
	mat.ground_bottom_color = Color(0.25, 0.22, 0.18)
	mat.sun_angle_max = 28.0
	mat.sun_curve = 0.12
	mat.sky_energy_multiplier = sky_energy
	environment.sky.sky_material = mat
