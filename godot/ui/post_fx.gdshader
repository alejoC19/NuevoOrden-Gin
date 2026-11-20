shader_type canvas_item;
// Subtle chromatic aberration + vignette on the finished 3D image.
uniform sampler2D screen_tex : hint_screen_texture, repeat_disable, filter_linear;
uniform float aberration = 0.0011;
uniform float vignette = 0.38;

void fragment() {
	vec2 uv = SCREEN_UV;
	vec2 dir = uv - vec2(0.5);
	float d2 = dot(dir, dir);
	vec2 off = dir * aberration * (0.4 + d2 * 5.0);
	vec3 col = vec3(texture(screen_tex, uv + off).r, texture(screen_tex, uv).g, texture(screen_tex, uv - off).b);
	float v = smoothstep(0.95, 0.2, length(dir) * 1.25);
	col *= mix(1.0 - vignette, 1.0, v);
	COLOR = vec4(col, 1.0);
}
