// One-time vendor transform for exteestudio/venom-button.
// Reads venom-raw.js (script extracted from the demo index.html) and emits
// venom.js as an ES module with the OFFMODE patches applied, plus venom.css
// (cursor vars + stage/hit rules) and the Geist Bold font blob for index.html.
// Re-run: node scripts/vendor-venom.mjs
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const write = (p, s) => writeFileSync(join(root, p), s, 'utf8');

let s = read('src/vendor/venom-button/venom-raw.js').replace(/\r\n/g, '\n');

function sub(from, to, label, all = false) {
  const i = s.indexOf(from);
  if (i < 0) throw new Error(`anchor not found [${label}]: ${from.slice(0, 60)}`);
  if (!all && s.indexOf(from, i + 1) !== -1) throw new Error(`anchor ambiguous [${label}]`);
  s = s.slice(0, i) + to + s.slice(i + from.length);
}

// 1. IIFE -> exported mount function
sub("'use strict';\n(() => {", "'use strict';\nexport function mountVenomButton(opts = {}) {", 'wrapper-open');
{
  const i = s.lastIndexOf('})();');
  if (i < 0) throw new Error('wrapper-close not found');
  s =
    s.slice(0, i) +
    `  // one-shot mount: OFFMODE keeps the button for the whole page lifetime,
  // so no teardown is needed (React StrictMode double-mount is avoided by
  // deferring the mount one tick in the component).
  return function destroyVenom() {};
}
`;
}

// 2. element lookup -> caller-provided nodes
sub(
  `const canvas = document.getElementById('stage');
const hitEl = document.getElementById('venom');
const hintEl = document.getElementById('hint');
const panelEl = document.getElementById('panel');
const tuneToggle = document.getElementById('tuneToggle');`,
  `const canvas = opts.canvas;
const hitEl = opts.hit;
if (!canvas || !hitEl) return undefined;`,
  'dom-consts',
);

// 3. label text
s = s.replace(/^const LABEL_TEXT = .*$/m, "const LABEL_TEXT = opts.label || 'EXPLORE';");

// 4. transparent context
sub(
  `canvas.getContext('webgl2', { antialias: false, alpha: false, depth: false`,
  `canvas.getContext('webgl2', { antialias: false, alpha: true, premultipliedAlpha: false, depth: false`,
  'gl-alpha',
);

// 5. pass 2: drop the white studio floor, composite only shadows (straight alpha)
sub(
  `  if (g.w < 0.5) {
    col = floorShade(p);
    // analytic edge coverage from the closest approach of the ray (also keeps hair-thin strands visible)
    float cov = clamp(0.5 - g.x * uDpr, 0.0, 1.0);
    if (cov > 0.0) {`,
  `  float alpha = 1.0;
  if (g.w < 0.5) {
    // offmode patch: no white studio floor and no floor shadows at all
    // (button / pointer cast shadows removed) -- the page shows through
    float cov = clamp(0.5 - g.x * uDpr, 0.0, 1.0);
    col = vec3(0.0);
    alpha = 0.0;
    if (cov > 0.0) {`,
  'pass2-floor',
);
sub(
  `      col = mix(col, gn.w > 0.5 ? shadeAny(p, gn) : vec3(0.012), cov);`,
  `      col = gn.w > 0.5 ? shadeAny(p, gn) : vec3(0.012);
      alpha = cov;`,
  'pass2-edge',
);
sub(`  outC = vec4(col, 1.0);`, `  outC = vec4(col, alpha);`, 'pass2-out');

// 6. pass 3 FXAA: carry scene alpha through
sub(`  vec3 cM = texture(uC, uv).rgb;`, `  vec4 tM = texture(uC, uv);
  vec3 cM = tM.rgb;`, 'fxaa-center');
sub(`{ outC = vec4(cM, 1.0); return; }`, `{ outC = tM; return; }`, 'fxaa-flat');
sub(
  `outC = vec4((lB < lMin || lB > lMax) ? A : B, 1.0);`,
  `outC = vec4((lB < lMin || lB > lMax) ? A : B, tM.a);`,
  'fxaa-edge',
);

// 7. layout: anchor the pill to the bottom-right corner
sub(
  `function layoutButton() {
  btn.cx = viewW() / 2;
  btn.cy = viewH() / 2;
  // the pill hugs the word: its caps begin just past the first and last letters
  const sc = LABEL_CSS / LABEL_PX;
  btn.hh = 30;                                    // 60px tall: more room above and below the word
  btn.hw = ((labelInkW || 520) * sc) / 2 + 30;    // tighter sides: 30px past the first and last letters
  btn.lbw = (LABEL_W * sc) / 2;
  btn.lbh = (LABEL_H * sc) / 2;`,
  `function layoutButton() {
  // offmode patch: the pill hugs the word and sits in the bottom-right corner
  const sc = LABEL_CSS / LABEL_PX;
  btn.hh = 30;
  btn.hw = ((labelInkW || 520) * sc) / 2 + 30;
  btn.lbw = (LABEL_W * sc) / 2;
  btn.lbh = (LABEL_H * sc) / 2;
  btn.cx = viewW() - (opts.padRight ?? 44) - btn.hw;
  btn.cy = viewH() - (opts.padBottom ?? 44) - btn.hh;`,
  'layout-button',
);

// 8. strip demo chrome: SVG drag-drop label, tuning panel, hint flash
{
  const start = s.indexOf('\n// SVG label: drag-drop');
  const end = s.indexOf('\nwindow.VenomButton = ');
  if (start < 0 || end < 0 || end < start) throw new Error('strip range not found');
  s = s.slice(0, start) + s.slice(end);
}

// sanity
for (const bad of ['hintEl', 'panelEl', 'tuneToggle', 'flashHint', 'const SLIDERS', 'alpha: false']) {
  if (s.includes(bad)) throw new Error(`residual: ${bad}`);
}
for (const good of [
  'export function mountVenomButton',
  'alpha: true, premultipliedAlpha: false',
  'outC = vec4(col, alpha);',
  'opts.padRight ?? 44',
  "opts.label || 'EXPLORE'",
  'return function destroyVenom',
]) {
  if (!s.includes(good)) throw new Error(`missing: ${good}`);
}
if ((s.match(/window\.VenomButton = /g) || []).length !== 1) throw new Error('window.VenomButton count');

write('src/vendor/venom-button/venom.js', s);

// --- venom.css: cursor vars + stage/hit rules (from the demo stylesheet) ---
const demo = readFileSync(
  'C:/Users/peter/AppData/Local/Temp/opencode/venom-button/index.html',
  'utf8',
);
const demoLines = demo.split(/\r?\n/);
const arrow = demoLines.find((l) => l.includes('--cur-arrow:'));
const hand = demoLines.find((l) => l.includes('--cur-hand:'));
if (!arrow || !hand) throw new Error('cursor vars not found in demo CSS');
// strip the baked drop shadow from the native cursor icons
// (same regex the GL buildIcon uses; the 3D hand has no shadow either)
const stripShadow = (l) => l.replace(/\sfilter=(["'])url\([^)]*\)\1/g, '');
write(
  'src/styles/venom.css',
  `/* ------------------------------------------------------------------ */
/* venom-button (vendored from exteestudio/venom-button)               */
/* transparent GL goo button + its native cursor icons                  */
/* ------------------------------------------------------------------ */
:root {
${stripShadow(arrow.trim())}
${stripShadow(hand.trim())}
  color-scheme: light;
}

/* native OS cursors: drawn by the system, so they never trail the pointer */
body {
  cursor: var(--cur-arrow) 5 1, default;
}
body.is-over-goo,
body.no-gl .venom-hit {
  cursor: var(--cur-hand) 7 2, pointer;
}
body.is-engaged {
  cursor: none;
}

.venom-stage {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  display: block;
  pointer-events: none;
  z-index: 20;
}
.venom-hit {
  position: fixed;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: transparent;
  font: 700 19px/1 "Geist", system-ui, sans-serif;
  -webkit-tap-highlight-color: transparent;
  touch-action: none;
  cursor: inherit;
  z-index: 21;
}
.venom-hit:focus {
  outline: none;
}
.venom-hit:focus-visible {
  outline: 1.5px solid #050505;
  outline-offset: 18px;
}
/* no-WebGL2 fallback pill */
body.no-gl .venom-hit {
  color: oklch(0.95 0.005 260);
  background: radial-gradient(120% 140% at 30% 20%, oklch(0.32 0.02 275), oklch(0.12 0.01 270) 60%);
  box-shadow: 0 18px 30px -16px oklch(0.2 0.02 270 / 0.6), inset 0 1px 0 oklch(1 0 0 / 0.18);
}
`,
);

// --- Geist Bold blob -> index.html (before the module script) ---
const FONT_ID = 'font-geist-bold';
const appHtml = read('index.html');
if (!appHtml.includes(FONT_ID)) {
  const fontLine = demoLines.find((l) => l.includes(`id="${FONT_ID}"`));
  if (!fontLine) throw new Error('Geist font blob not found');
  const comment = `<!-- Geist Bold by Vercel (SIL Open Font License 1.1, see the venom-button repo fonts/Geist-OFL.txt) -->\n    ${fontLine.trim()}\n    `;
  const patched = appHtml.replace('    <script type="module"', `${comment}<script type="module"`);
  if (patched === appHtml) throw new Error('font injection point not found');
  write('index.html', patched);
  console.log('index.html: Geist blob injected');
} else {
  console.log('index.html: Geist blob already present');
}

console.log('venom.js:', s.length, 'bytes; venom.css written');
