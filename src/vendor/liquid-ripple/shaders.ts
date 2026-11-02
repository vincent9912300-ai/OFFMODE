/*
 * The whole effect is one fragment shader over a full-screen triangle.
 *
 * `height()` sums a height-field: two slow crossing swells (so the water is
 * never perfectly still) plus one damped sine ring per live ripple. The main
 * pass finite-differences that field to get a surface normal, uses the normal
 * to refract the background, then adds two light terms — a caustic shimmer
 * and a tight specular glint. Refraction is what sells it: without it the
 * rings read as flat circles drawn on a background.
 *
 * FORK NOTE (offmode): the upstream shader only refracts a two-stop vertical
 * gradient. This fork adds `u_backdrop` — an optional texture (the yellow
 * plane + OFFMODE wordmark drawn offscreen) sampled through the same
 * refracted UV, plus a Fresnel edge term so grazing wave faces catch light.
 * When `u_hasBackdrop == 0` the original gradient path runs unchanged.
 *
 * Everything tunable is a uniform, so `setWave()`/`setPalette()` never have to
 * recompile. Only `maxRipples` is baked in — WebGL 1 needs a constant loop
 * bound and a fixed array size.
 */

export const VERTEX_SHADER = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

export function fragmentShader(maxRipples: number): string {
  return `
precision highp float;

uniform vec2  u_res;
uniform float u_time;

uniform vec3  u_top;
uniform vec3  u_bottom;
uniform vec3  u_glint;
uniform float u_opacity;

uniform float u_swell;
uniform float u_amplitude;
uniform float u_ringSpeed;
uniform float u_decay;
uniform float u_wavelength;
uniform float u_life;
uniform float u_refraction;
uniform float u_caustics;
uniform float u_specular;

uniform sampler2D u_backdrop;
uniform float u_hasBackdrop;

// x, y in aspect-corrected space (y up); z = spawn time, negative = empty slot
uniform vec3  u_ripples[${maxRipples}];

float height(vec2 p) {
  float h = 0.0;

  // Ambient swell — two crossing waves at different scales.
  h += u_swell * 0.016 * sin(p.x * 6.0 + u_time * 0.70) * sin(p.y * 5.0 - u_time * 0.55);
  h += u_swell * 0.010 * sin((p.x + p.y) * 9.0 - u_time * 0.90);

  for (int i = 0; i < ${maxRipples}; i++) {
    vec3 r = u_ripples[i];
    if (r.z < 0.0) continue;
    float age = u_time - r.z;
    if (age < 0.0 || age > u_life) continue;

    // Ring expands outward at u_ringSpeed; the wave packet is tight around it
    // and its whole envelope fades with age.
    float d    = distance(p, r.xy);
    float ring = d - age * u_ringSpeed;
    float amp  = exp(-age * u_decay) * exp(-abs(ring) * 20.0) * u_amplitude;
    h += amp * sin(ring * u_wavelength - age * 4.0);
  }
  return h;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res;

  // Aspect-corrected sample point so ripples stay circular, not oval.
  vec2 p = uv;
  p.x *= u_res.x / u_res.y;

  // Surface normal by finite difference of the height field.
  float e  = 0.0025;
  float h  = height(p);
  float hx = height(p + vec2(e, 0.0));
  float hy = height(p + vec2(0.0, e));
  vec3  n  = normalize(vec3(h - hx, h - hy, e * 14.0));

  // Refract the background through the surface. gl_FragCoord is y-up, so
  // ruv.y == 1 is the top of the canvas — hence u_top as the far end of mix().
  vec2 ruv = uv + n.xy * u_refraction;
  ruv = clamp(ruv, 0.0, 1.0);

  vec3 col;
  if (u_hasBackdrop > 0.5) {
    // The backdrop texture is uploaded with UNPACK_FLIP_Y_WEBGL, so
    // ruv.y == 1 already matches the top of the source canvas.
    col = texture2D(u_backdrop, ruv).rgb;
  } else {
    col = mix(u_bottom, u_top, ruv.y);
  }

  // Caustics: crossing sines, sharpened by a high power.
  float caust = pow(abs(sin(ruv.x * 14.0 + u_time * 0.5) * sin(ruv.y * 12.0 - u_time * 0.4)), 8.0);
  col += u_glint * caust * u_caustics * 0.5;

  // Specular glint off the ripple crests.
  vec3  light = normalize(vec3(0.35, 0.5, 0.8));
  float spec  = pow(max(dot(n, light), 0.0), 60.0);
  col += u_glint * spec * u_specular;

  // Fresnel — wave faces seen at a grazing angle catch the sky. Kept subtle
  // so it reads as wet glass, not neon.
  float fres = pow(1.0 - clamp(n.z, 0.0, 1.0), 2.5);
  col += u_glint * fres * u_specular * 0.18;

  gl_FragColor = vec4(col, u_opacity);
}
`;
}
