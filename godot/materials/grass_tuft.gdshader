shader_type spatial;
render_mode cull_disabled, depth_prepass_alpha;
// Alpha-scissored grass tuft with a light wind sway. Per-instance colour comes from the MultiMesh.
uniform sampler2D blades : source_color, filter_linear_mipmap, repeat_disable;
uniform float sway = 0.12;
uniform float wind_speed = 1.6;

void vertex() {
	vec3 wpos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	float h = clamp(VERTEX.y, 0.0, 1.0);
	VERTEX.x += sin(TIME * wind_speed + wpos.x * 0.35 + wpos.z * 0.2) * sway * h * h;
	VERTEX.z += cos(TIME * wind_speed * 0.8 + wpos.z * 0.3) * sway * 0.6 * h * h;
}

void fragment() {
	vec4 t = texture(blades, UV);
	if (t.a < 0.5) discard;
	ALBEDO = t.rgb * COLOR.rgb;
	ROUGHNESS = 0.9;
	SPECULAR = 0.15;
	// Soft translucency so the tufts glow a little against the sun.
	BACKLIGHT = vec3(0.12, 0.2, 0.05);
}
