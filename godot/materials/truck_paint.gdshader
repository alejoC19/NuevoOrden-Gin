shader_type spatial;
// Old, worn paint for the one-piece CC0 truck model. Zones are derived from the model-space
// position/normal (cab, cargo bed, glass, chassis) and a CC0 rust texture is blended in by a mask.

uniform vec3 cab_color : source_color = vec3(0.55, 0.17, 0.12);
uniform vec3 bed_color : source_color = vec3(0.66, 0.63, 0.55);
uniform vec3 chassis_color : source_color = vec3(0.07, 0.07, 0.075);
uniform vec3 glass_color : source_color = vec3(0.12, 0.17, 0.2);
uniform float cab_back_z = -0.35;      // cab is in front (more negative z) of this value
uniform float glass_y_min = 1.25;
uniform float glass_y_max = 1.95;
uniform float chassis_top_y = 0.95;
uniform bool wheel_mode = false;       // true for the wheel meshes (rubber tyre + metal rim)
uniform sampler2D rust_albedo : source_color, repeat_enable, filter_linear_mipmap;
uniform sampler2D rust_normal : hint_normal, repeat_enable, filter_linear_mipmap;
uniform sampler2D rust_rough : hint_roughness_gray, repeat_enable, filter_linear_mipmap;
uniform float rust_amount : hint_range(0.0, 1.0) = 0.55;
uniform float rust_scale = 0.8;

varying vec3 lpos;
varying vec3 lnrm;

void vertex() {
	lpos = VERTEX;
	lnrm = NORMAL;
}

void fragment() {
	vec3 p = lpos;
	vec3 n = normalize(lnrm);
	vec3 base;
	float rough = 0.55;
	float metal = 0.25;
	float rust_mask = 0.0;
	if (wheel_mode) {
		float r = length(p.yz);
		bool rim = r < 0.27 && abs(n.x) > 0.5;
		base = rim ? vec3(0.45, 0.45, 0.43) : vec3(0.025, 0.025, 0.027);
		rough = rim ? 0.45 : 0.92;
		metal = rim ? 0.8 : 0.0;
		rust_mask = rim ? 0.35 : 0.0;
	} else {
		bool in_cab = p.z < cab_back_z;
		bool glass = in_cab && p.y > glass_y_min && p.y < glass_y_max && (abs(n.x) > 0.55 || n.z < -0.55);
		if (p.y < chassis_top_y && (n.y < 0.5)) {
			base = chassis_color; rough = 0.8; metal = 0.5; rust_mask = 0.5;
		} else if (glass) {
			base = glass_color; rough = 0.08; metal = 0.6;
		} else if (in_cab) {
			base = cab_color; rough = 0.5; metal = 0.35; rust_mask = 1.0;
		} else {
			base = bed_color; rough = 0.65; metal = 0.2; rust_mask = 1.0;
		}
	}
	// Triplanar rust, masked by a low-frequency noise taken from the rust texture + lower-body bias.
	vec3 w = abs(n); w /= (w.x + w.y + w.z);
	vec2 ux = p.zy * rust_scale; vec2 uy = p.xz * rust_scale; vec2 uz = p.xy * rust_scale;
	vec3 rust = texture(rust_albedo, ux).rgb * w.x + texture(rust_albedo, uy).rgb * w.y + texture(rust_albedo, uz).rgb * w.z;
	float rr = texture(rust_rough, ux).r * w.x + texture(rust_rough, uy).r * w.y + texture(rust_rough, uz).r * w.z;
	float noise = texture(rust_albedo, (p.xz + p.yy * 0.7) * 0.23).r;
	float mask = smoothstep(0.35, 0.75, noise * 1.1 + (1.0 - clamp(p.y / 2.3, 0.0, 1.0)) * 0.45 - 0.2) * rust_amount * rust_mask;
	vec3 nm = texture(rust_normal, ux).rgb * w.x + texture(rust_normal, uy).rgb * w.y + texture(rust_normal, uz).rgb * w.z;
	ALBEDO = mix(base, rust * 0.8, mask);
	ROUGHNESS = mix(rough, max(rr, 0.7), mask);
	METALLIC = mix(metal, 0.1, mask);
	NORMAL_MAP = nm;
	NORMAL_MAP_DEPTH = 0.6 * mask + 0.1;
}
