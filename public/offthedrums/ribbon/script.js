/*
  "The rearing ribbon" from Animorio · https://animorio.com
  License: free on your own sites and your clients’ sites, paid work included.
  Not for resale, redistribution, templates or code collections · https://animorio.com/en/license/
*/
/* The rearing ribbon
   Eight cards in a row on a ribbon that is not flat: seen by a real camera, it comes near on the left and goes far on
   the right in one long S, leaning into its own slope like a banked track. The page scrolls down and the ribbon moves
   sideways, a little behind the scroll; the further behind it is, the faster it is going, and at speed the left side
   rears up towards you while the two ends wring opposite ways. The card under the pointer bows back.
   None of this moves the cards themselves: the curve is a fixed surface in space, written as a function of x, and the
   cards travel through it. Every corner of every card asks the same function where it should be, so a card crossing
   a bend takes the bend. The entrance is the loader: three small bars fill, then each one flies off and grows into
   one of the three cards in view, because the bars were those cards all along. */

/* ---- values to change ---- */
const FOLLOW = 0.1;            /* how much of the way to the scroll the ribbon covers every sixtieth of a second */
const RUSH = 140;              /* how many pixels behind the scroll the ribbon must be to count as full speed */
const FIELD = 53.4;            /* the camera's field of view, in degrees */
const DEPTH = 0.2;             /* how deep the S goes, as a share of half the page's width */
const SURGE = 1.1;             /* how much deeper it gets at full speed */
const SPAN = 1.15;             /* how much of the S fits across the page */
const SHIFT = -0.2;            /* slides the S along: negative brings the near bulge in from the left */
const BANK = -0.16;            /* how far the ribbon leans into its own slope, radians at the steepest point */
const DOOR = -0.12;            /* the whole ribbon turned like a door: left edge nearer, right edge further */
const TILT = 0.03;             /* the ribbon runs slightly uphill to the right */
const REAR = { up: 0.1, near: 0.2 };   /* at full speed the left side lifts and comes nearer, in half page widths */
const WRING = 1.8;             /* at full speed the two ends twist opposite ways, in radians */
const DENT = 0.1;              /* how far a card bows back under the pointer, as a share of its height */
const HOVER = 0.5;             /* seconds for the dent to come and go */
const SHADE = 0.5;             /* how dark the far end of the S gets */
const GLOSS = 0.35;            /* how bright the sheen on the cards is */
const CARD = { height: 0.46, gap: 10, round: 20 };   /* the cards: height as a share of the page's, then pixels */
const FLOOR = { light: 0.15, square: 0.11 };         /* the floor: how bright its lines are, a square's side in page widths */
const INTRO = { load: 1.4, flight: 1.5, stagger: 0.05, sides: 1.25 };   /* seconds of the entrance */
const BAR = { width: 48, height: 5, gap: 8 };        /* the three loader bars, in pixels */
const ROOMS = [
  { file: 'sheets/job-1.png', ratio: 0.75 },
  { file: 'sheets/job-2.png', ratio: 0.75 },
  { file: 'sheets/job-3.png', ratio: 0.75 },
  { file: 'sheets/job-4.png', ratio: 0.75 },
  { file: 'sheets/job-5.png', ratio: 0.75 },
  { file: 'sheets/job-6.png', ratio: 0.75 },
  { file: 'sheets/job-7.png', ratio: 0.75 },
  { file: 'sheets/job-8.png', ratio: 0.75 },
];

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
try {
  if (window.top !== window.self) document.documentElement.classList.add('is-embedded');
} catch {}
const jobParam = Number.parseInt(new URLSearchParams(location.search).get('job') ?? '', 10);
const START_JOB = Number.isFinite(jobParam) ? Math.max(0, Math.min(ROOMS.length - 1, jobParam)) : 1;   /* the card to centre on load */
const FIRST = 0;   /* the first card on the ribbon */
const hall = document.querySelector('[data-hall]');
const stage = document.querySelector('[data-stage]');
const canvas = document.querySelector('[data-canvas]');
const hint = document.querySelector('[data-hint]');
const entries = [...document.querySelectorAll('[data-rooms] li')];
document.querySelectorAll('a[href="#"]').forEach((a) => a.addEventListener('click', (e) => e.preventDefault()));

/* ---------------------------------------------------------------- the cards: the job sheets as textures */
function loadSheet(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}
function placeholder(i) {
  const c = document.createElement('canvas');
  c.width = 720;
  c.height = 960;
  const g = c.getContext('2d');
  g.fillStyle = '#151412';
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = '#ffd400';
  g.font = '700 150px "Anton", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(`JOB 0${i + 1}`, c.width / 2, c.height / 2);
  return c;
}
const paint = () => Promise.all(ROOMS.map((look, i) => loadSheet(look.file).then((img) => img || placeholder(i))));


/* ---------------------------------------------------------------- WebGL: one bent mesh for every card, and the floor */
const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: true });
const RIBBON_VERTEX = `
  attribute vec2 corner;
  uniform vec2 page;       /* half the page, in pixels */
  uniform float eye;       /* the camera's distance from the page */
  uniform vec4 box;        /* the card where it would lie flat: left, bottom, width, height, in pixels from the middle */
  uniform float on;        /* 0 while the card is still a loader bar, 1 on the ribbon */
  uniform float hover;
  uniform float depth;
  uniform float span;
  uniform float shift;
  uniform float curve;     /* 1 the S, 0 a bowl (narrow screens have no room for an S) */
  uniform float bank;
  uniform float door;
  uniform float tilt;
  uniform vec2 rear;
  uniform float wring;
  uniform float speed;
  uniform float dent;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying float vDeep;
  const float PI = 3.141592653589793;

  void main() {
    vUv = corner;
    vec3 p = vec3(box.xy + corner * box.zw, 0.);

    /* the dent under the pointer: a dome that is zero along every edge, so the outline never moves */
    vec2 c = corner * 2. - 1.;
    float dome = (1. - c.x * c.x) * (1. - c.y * c.y);
    float bow = hover * dent * box.w;
    p.z -= bow * dome;

    /* where this point is across the page, and the surface's height and slope there: the bell brings both back
       to flat off the page by itself, so a card coming in takes the curve gradually */
    float s = p.x / page.x;
    float q = s * span + shift;
    float bell = exp(-q * q);
    float shape = mix(1. - q * q, sin(PI * q), curve) * bell;
    float slope = mix(-2. * q * (2. - q * q), PI * cos(PI * q) - 2. * q * sin(PI * q), curve) * bell;

    /* the roll about the ribbon's centre line: the bank, read off the slope, plus the wring at speed */
    float roll = (bank * slope / PI * curve + wring * speed * smoothstep(0.3, 0.9, abs(s)) * sign(s)) * on;
    float cr = cos(roll);
    float sr = sin(roll);
    p.yz = vec2(p.y * cr - p.z * sr, p.y * sr + p.z * cr);

    /* depth: the S, and the door (a smooth ramp, flat past the edges) */
    float e = clamp(s, -1., 1.);
    p.z += (-depth * shape + door * page.x * e * (1.5 - 0.5 * e * e)) * on;
    p.y += tilt * p.x * on;

    /* at speed the left side rears: up, and towards the camera */
    float lift = (1. - smoothstep(-1., 0.3, s)) * speed * on;
    p.y += rear.x * page.x * lift;
    p.z += rear.y * page.x * lift;

    /* the normal comes from the same formulas, not from the mesh: the sheen needs it exact */
    float dzdx = (-depth * slope * span / page.x + door * 1.5 * (1. - e * e)) * on + 4. * bow * c.x * (1. - c.y * c.y) / box.z;
    float dzdy = 4. * bow * c.y * (1. - c.x * c.x) / box.w;
    vec3 n = normalize(vec3(-dzdx, -dzdy, 1.));
    vNormal = vec3(n.x, n.y * cr - n.z * sr, n.y * sr + n.z * cr);
    vDeep = (clamp((1. + shape) * 0.5, 0., 1.) * on + bow * dome / (2. * depth + 0.0001));

    float w = eye - p.z;
    gl_Position = vec4(p.x * eye / page.x, p.y * eye / page.y, -p.z / (page.x * 2.) * w, w);
  }`;
const RIBBON_FRAGMENT = `
  precision highp float;
  uniform sampler2D picture;
  uniform vec4 box;
  uniform float on;
  uniform float corners;
  uniform float wash;      /* 1 the white of a loader bar, 0 the picture */
  uniform float fill;      /* how much of a loader bar is filled */
  uniform float alpha;
  uniform float shade;
  uniform float gloss;
  uniform float density;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying float vDeep;
  void main() {
    if (vUv.x > fill) discard;
    vec2 p = (vUv - 0.5) * box.zw;
    vec2 d = abs(p) - (box.zw * 0.5 - corners);
    float outside = length(max(d, 0.)) + min(max(d.x, d.y), 0.) - corners;
    float inside = 1. - smoothstep(-0.7, 0.7, outside * density);
    if (inside < 0.01) discard;
    vec3 colour = mix(texture2D(picture, vUv).rgb, vec3(1.), wash);
    /* darker towards the far end of the S, a light from up on the left, and a tight sheen */
    vec3 n = normalize(vNormal);
    vec3 light = normalize(vec3(-0.4, 0.5, 1.));
    colour *= 1. - shade * clamp(vDeep, 0., 1.) * (1. - wash);
    colour *= 1. - 0.12 * on * (1. - (dot(n, light) * 0.5 + 0.5));
    colour += pow(max(dot(n, normalize(light + vec3(0., 0., 1.))), 0.), 48.) * gloss * on;
    gl_FragColor = vec4(colour, 1.) * inside * alpha;
  }`;
const FLOOR_VERTEX = `
  attribute vec2 corner;
  varying vec2 vUv;
  void main() {
    vUv = corner;
    gl_Position = vec4(corner * 2. - 1., 0.999, 1.);
  }`;
/* the floor: a plane of squares under the ribbon, found by sending a ray through every pixel */
const FLOOR_FRAGMENT = `
  precision highp float;
  uniform vec2 page;
  uniform float eye;
  uniform float under;     /* how far below the middle of the page the floor lies */
  uniform float square;
  uniform float light;
  varying vec2 vUv;
  float line(float at, float width) {
    float d = abs(fract(at / square + 0.5) - 0.5) * square;
    return (1. - smoothstep(width * 0.5, width * 1.5, d)) * clamp(square / width / 5., 0., 1.);
  }
  void main() {
    vec2 p = (vUv - 0.5) * page * 2.;
    if (p.y >= -1.) { gl_FragColor = vec4(0.); return; }
    float t = under / -p.y;
    float lines = max(line(p.x * t, t), line(eye * t, t * t * eye / under));
    float fade = smoothstep(0.1, 0.45, -p.y / page.y) * exp(-t * 0.16);
    gl_FragColor = vec4(lines * light * fade);
  }`;

function build(vertex, fragment) {
  const program = gl.createProgram();
  [[gl.VERTEX_SHADER, vertex], [gl.FRAGMENT_SHADER, fragment]].forEach(([type, source]) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, source);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    gl.attachShader(program, s);
  });
  gl.bindAttribLocation(program, 0, 'corner');
  gl.linkProgram(program);
  const at = {};
  for (let i = 0; i < gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS); i++) {
    const name = gl.getActiveUniform(program, i).name;
    at[name] = gl.getUniformLocation(program, name);
  }
  return { program, at };
}

/* ---------------------------------------------------------------- the state of every card, moved by GSAP */
const cards = ROOMS.map((look, i) => ({ i, ratio: look.ratio, x: 0, w: 0, hover: 0, fly: 1, side: 0, alpha: 1, boot: -1, texture: null }));
const load = { p: 0, bars: 0 };
const ground = { light: REDUCED ? 1 : 0 };
let travel = 0;      /* how far the ribbon can go, in pixels */
let aim = 0;         /* where the scroll says it should be */
let at = 0;          /* where it is */
let height = 0;
let ribbon;
let floor;
let mesh;
let count = 0;
let density = 1;

/* the cards in a row, the one called FIRST in the middle of the page when the scroll is at the top */
function layout() {
  const W = stage.clientWidth;
  const H = stage.clientHeight;
  height = Math.min(H * CARD.height, W * 0.78);
  let x = 0;
  cards.forEach((c) => {
    c.w = height * c.ratio;
    c.x = x;
    x += c.w + CARD.gap;
  });
  const middle = (c) => c.x + c.w / 2;
  const start = middle(cards[FIRST]);
  travel = middle(cards[cards.length - 1]) - start;
  cards.forEach((c) => { c.x -= start; });
  hall.style.height = `${H + travel}px`;
}
const scrolled = () => Math.min(travel, Math.max(0, -hall.getBoundingClientRect().top));

if (gl) start();
else flat();

function start() {
  ribbon = build(RIBBON_VERTEX, RIBBON_FRAGMENT);
  floor = build(FLOOR_VERTEX, FLOOR_FRAGMENT);
  /* a sheet of 32 by 8 squares: it only bends along its length */
  const across = 32;
  const down = 8;
  const points = [];
  for (let j = 0; j <= down; j++) for (let i = 0; i <= across; i++) points.push(i / across, j / down);
  const order = [];
  for (let j = 0; j < down; j++) {
    for (let i = 0; i < across; i++) {
      const a = j * (across + 1) + i;
      order.push(a, a + 1, a + across + 1, a + 1, a + across + 2, a + across + 1);
    }
  }
  /* the floor is the first two triangles of the same buffers: the four corners come first */
  const corners = [0, 0, 1, 0, 0, 1, 1, 1];
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([...corners, ...points]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  mesh = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 1, 3, 2, ...order.map((k) => k + 4)]), gl.STATIC_DRAW);
  count = order.length;
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  size();
  addEventListener('resize', size);
  /* where the browser can, a card seen at a slant is filtered along the slant */
  const sharp = gl.getExtension('EXT_texture_filter_anisotropic');
  paint().then((pictures) => {
    pictures.forEach((picture, i) => {
      /* stretched onto a square of 1024 so the card can have mipmaps: far away and twisted, it stays clean */
      const square = document.createElement('canvas');
      square.width = square.height = 1024;
      square.getContext('2d').drawImage(picture, 0, 0, 1024, 1024);
      const t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, square);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      if (sharp) gl.texParameterf(gl.TEXTURE_2D, sharp.TEXTURE_MAX_ANISOTROPY_EXT, 8);
      cards[i].texture = t;
    });
    if (START_JOB > 0) {
      const target = Math.min(travel, Math.max(0, cards[START_JOB].x + cards[START_JOB].w / 2));
      if (target > 0) window.scrollTo(0, target);
    }
    at = aim = scrolled();
    enter();
    requestAnimationFrame(frame);
  });
}
/* no WebGL: the cards go into the list, a flat row that the scroll moves */
function flat() {
  stage.classList.add('is-flat');
  gsap.set('.bar, .foot', { opacity: 1 });
  const list = document.querySelector('[data-rooms]');
  document.fonts.ready.then(() => {
    paint().then((pictures) => {
      pictures.forEach((picture, i) => {
        const img = document.createElement('img');
        img.src = ROOMS[i].file;
        img.alt = '';
        entries[i % entries.length].append(img);
      });
      layout();
      const move = () => { list.style.transform = `translate3d(${stage.clientWidth / 2 + cards[0].x - scrolled()}px, 0, 0)`; };
      addEventListener('scroll', move, { passive: true });
      addEventListener('resize', () => { layout(); move(); });
      move();
    });
  });
}
function size() {
  density = Math.min(devicePixelRatio, 2);
  canvas.width = Math.round(canvas.clientWidth * density);
  canvas.height = Math.round(canvas.clientHeight * density);
  layout();
}

/* ---------------------------------------------------------------- the entrance: the loader's bars are the cards */
function enter() {
  if (REDUCED) {
    gsap.set('.bar, .foot', { opacity: 1 });
    return;
  }
  /* the three cards nearest the middle start as bars; the others wait off to the sides */
  const near = [...cards].sort((a, b) => Math.abs(a.x + a.w / 2 - at) - Math.abs(b.x + b.w / 2 - at));
  const three = near.slice(0, 3).sort((a, b) => a.x - b.x);
  const rest = near.slice(3);
  three.forEach((c, k) => { c.boot = k; c.fly = 0; });
  rest.forEach((c) => { c.alpha = 0; c.side = Math.sign(c.x + c.w / 2 - at || 1) * stage.clientWidth * 0.5; });
  const intro = gsap.timeline();
  intro.to(load, { bars: 1, duration: 0.4, ease: 'power1.out' })
    /* a pretend load: with a real one, tween load.p towards the share that has arrived */
    .to(load, { p: 1, duration: INTRO.load, ease: 'power1.inOut' }, 0.1)
    .addLabel('go')
    .to(three, { fly: 1, duration: INTRO.flight, ease: 'expo.inOut', stagger: INTRO.stagger }, 'go')
    .to(rest, { side: 0, duration: INTRO.sides, ease: 'expo.out', stagger: 0.05 }, 'go+=1.15')
    .to(rest, { alpha: 1, duration: INTRO.sides * 0.5, ease: 'power1.out', stagger: 0.05 }, 'go+=1.15')
    .to(ground, { light: 1, duration: 1.1, ease: 'power2.out' }, 'go+=0.9')
    .to('.bar, .foot', { opacity: 1, duration: 0.6, ease: 'power1.out', stagger: 0.06 }, 'go+=0.75');
}

/* ---------------------------------------------------------------- the pointer: the card under it bows back */
let over = -1;
function find(e) {
  const r = stage.getBoundingClientRect();
  const x = e.clientX - r.left - r.width / 2;
  const y = r.height / 2 - (e.clientY - r.top);
  const hit = Math.abs(y) > height / 2 ? null : cards.find((c) => x > c.x - at && x < c.x - at + c.w);
  return hit ? hit.i : -1;
}
function point(i) {
  if (i === over) return;
  over = i;
  stage.classList.toggle('is-over-card', i >= 0);
  if (REDUCED) return;
  cards.forEach((c) => gsap.to(c, { hover: c.i === i ? 1 : 0, duration: HOVER, ease: 'expo.out', overwrite: 'auto' }));
}
stage.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') point(find(e)); });
stage.addEventListener('pointerleave', () => point(-1));
/* a click brings a card to the middle */
canvas.addEventListener('click', (e) => {
  const i = find(e);
  if (i < 0) return;
  const c = cards[i];
  scrollTo({ top: scrollY + hall.getBoundingClientRect().top + Math.min(travel, Math.max(0, c.x + c.w / 2)), behavior: REDUCED ? 'auto' : 'smooth' });
});
if (matchMedia('(hover: none)').matches) hint.textContent = 'Swipe up';

/* ---------------------------------------------------------------- drawing */
const mix = (a, b, k) => a + (b - a) * k;
/* the ribbon's depth at a point across the page: the same S as the shader, to draw the far cards first */
function deep(x, half, curve) {
  const q = (x / half) * SPAN + SHIFT;
  return -(curve ? Math.sin(Math.PI * q) : 1 - q * q) * Math.exp(-q * q);
}
let last = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, last ? (now - last) / 1000 : 1 / 60);
  last = now;
  const W = stage.clientWidth;
  const H = stage.clientHeight;
  const half = W / 2;
  const eye = H / 2 / Math.tan((FIELD * Math.PI) / 360);
  const curve = W < 650 ? 0 : 1;

  /* the ribbon follows the scroll; how far behind it is says how fast it is going */
  aim = scrolled();
  at = REDUCED ? aim : at + (aim - at) * (1 - Math.pow(1 - FOLLOW, dt * 60));
  const rush = REDUCED ? 0 : Math.tanh(Math.abs(aim - at) / RUSH);
  const speed = rush * rush;
  const strength = REDUCED ? 0 : 1;

  gl.viewport(0, 0, canvas.width, canvas.height);
  /* the canvas is see-through: the page's own colour is the background */
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  gl.disable(gl.DEPTH_TEST);
  gl.useProgram(floor.program);
  gl.uniform2f(floor.at.page, half, H / 2);
  gl.uniform1f(floor.at.eye, eye);
  gl.uniform1f(floor.at.under, height / 2 + 28);
  gl.uniform1f(floor.at.square, FLOOR.square * Math.max(W, H * 0.75));
  gl.uniform1f(floor.at.light, FLOOR.light * ground.light);
  gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);

  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  gl.useProgram(ribbon.program);
  gl.uniform2f(ribbon.at.page, half, H / 2);
  gl.uniform1f(ribbon.at.eye, eye);
  gl.uniform1f(ribbon.at.depth, half * (curve ? DEPTH : DEPTH * 0.9) * (1 + SURGE * speed));
  gl.uniform1f(ribbon.at.span, curve ? SPAN : 1);
  gl.uniform1f(ribbon.at.shift, curve ? SHIFT : 0);
  gl.uniform1f(ribbon.at.curve, curve);
  gl.uniform1f(ribbon.at.bank, BANK);
  gl.uniform1f(ribbon.at.door, curve ? DOOR : 0);
  gl.uniform1f(ribbon.at.tilt, TILT);
  gl.uniform2f(ribbon.at.rear, REAR.up, REAR.near);
  gl.uniform1f(ribbon.at.wring, WRING);
  gl.uniform1f(ribbon.at.speed, speed);
  gl.uniform1f(ribbon.at.dent, DENT);
  gl.uniform1f(ribbon.at.shade, SHADE);
  gl.uniform1f(ribbon.at.gloss, GLOSS);
  gl.uniform1f(ribbon.at.density, density);
  gl.uniform1i(ribbon.at.picture, 0);
  gl.activeTexture(gl.TEXTURE0);

  /* far cards first, so the soft edge of a near one blends over them */
  const seen = cards.filter((c) => c.x - at + c.side < half * 1.7 && c.x - at + c.side + c.w > -half * 1.7);
  seen.sort((a, b) => deep(a.x - at + a.w / 2, half, curve) - deep(b.x - at + b.w / 2, half, curve));
  seen.forEach((c) => {
    const x = c.x - at + c.side;
    /* still a loader bar: a small white rectangle in the middle of the page, filled from the left */
    const bar = c.boot < 0 ? null : [(c.boot - 1) * (BAR.width + BAR.gap) - BAR.width / 2, -BAR.height / 2, BAR.width, BAR.height];
    const k = c.fly;
    const box = bar ? [mix(bar[0], x, k), mix(bar[1], -height / 2, k), mix(bar[2], c.w, k), mix(bar[3], height, k)] : [x, -height / 2, c.w, height];
    gl.bindTexture(gl.TEXTURE_2D, c.texture);
    gl.uniform4f(ribbon.at.box, box[0], box[1], box[2], box[3]);
    gl.uniform1f(ribbon.at.on, k * strength);
    gl.uniform1f(ribbon.at.hover, c.hover);
    gl.uniform1f(ribbon.at.corners, Math.min(mix(BAR.height / 2, CARD.round, k), box[3] / 2));
    gl.uniform1f(ribbon.at.wash, bar ? 1 - Math.min(1, k * 1.08) : 0);
    gl.uniform1f(ribbon.at.fill, bar && k === 0 ? Math.min(1, Math.max(0, load.p * 3 - c.boot)) : 1);
    gl.uniform1f(ribbon.at.alpha, bar && k === 0 ? load.bars : c.alpha);
    gl.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_SHORT, 12);
  });
}
