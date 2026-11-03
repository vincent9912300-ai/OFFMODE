// focused test: gallery entry — boxes fly in from corners with varied sizes
// usage: node .shots/entry-test.mjs   (vite must run on 5173)
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const CDP_PORT = 9339;
const PAGE_URL = 'http://127.0.0.1:5173/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const userDataDir = `${process.env.TEMP}/offmode-profiles/entry-test`.replace(/\\/g, '/');
const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--hide-scrollbars',
    '--use-angle=swiftshader',
    '--window-size=1440,900',
    'about:blank',
  ],
  { stdio: 'ignore' },
);

try {
  let target = null;
  for (let i = 0; i < 60; i++) {
    await sleep(250);
    try {
      const list = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json`)).json();
      target = list.find((t) => t.type === 'page');
      if (target) break;
    } catch {}
  }
  if (!target) throw new Error('no CDP target');

  const ws = await new Promise((res, rej) => {
    const sock = new WebSocket(target.webSocketDebuggerUrl);
    sock.onopen = () => res(sock);
    sock.onerror = rej;
  });

  let msgId = 0;
  const pending = new Map();
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  };
  const send = (method, params = {}) =>
    new Promise((res) => {
      const id = ++msgId;
      pending.set(id, res);
      ws.send(JSON.stringify({ id, method, params }));
    });

  const evalJs = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true });
    if (r.result.exceptionDetails) {
      return { __err: r.result.exceptionDetails.exception?.description || 'exception' };
    }
    return r.result.result.value;
  };

  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await send('Page.navigate', { url: PAGE_URL });
  await sleep(4500);

  const setScroll = (frac) =>
    send('Runtime.evaluate', {
      expression: `(() => { const el = document.getElementById('app-scroll'); el.scrollTop = Math.round((el.scrollHeight - el.clientHeight) * ${frac}); })()`,
    });

  const settle = async (frac, maxMs = 30000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < maxMs) {
      const s = await evalJs(
        `(() => { const sc = window.__scroll; if (!sc) return null; return { raw: sc.raw.get(), smooth: sc.smooth.get() }; })()`,
      );
      if (s && !s.__err && Math.abs(s.raw - frac) < 0.001 && Math.abs(s.smooth - s.raw) < 0.006) return true;
      await sleep(500);
    }
    console.log('settle TIMEOUT', frac);
    return false;
  };

  const state = () =>
    evalJs(
      `(() => {
        const g = window.__dg && window.__dg.gallery;
        const c = window.__dg && window.__dg.camera;
        if (!g || !c) return 'no-dg';
        const content = document.querySelector('#gallery-screen > div');
        const cine = document.getElementById('cinematic-scroll');
        const sc = window.__scroll;
        return JSON.stringify({
          camZ: +c.position.z.toFixed(2),
          normalized: +((0 - (c.position.z - g.planeGap)) / g.planeGap).toFixed(2),
          stages: sc ? {
            raw: +sc.raw.get().toFixed(3),
            s1: +sc.s1.get().toFixed(2),
            panels: +sc.panels.get().toFixed(2),
            cine: +sc.cine.get().toFixed(2),
            gallery: +sc.gallery.get().toFixed(2),
          } : null,
          imgOpacity: content ? +(+getComputedStyle(content).opacity).toFixed(2) : -1,
          imgClip: content ? getComputedStyle(content).clipPath : '',
          cineOpacity: cine ? +(+getComputedStyle(cine).opacity).toFixed(2) : -1,
          cine: window.__cine ? { ready: window.__cine.ready, frames: window.__cine.frames, images: window.__cine.images } : null,
          panelOpacity: +(+getComputedStyle(document.getElementById('transition-panels')).opacity).toFixed(2),
          panels: [...document.querySelectorAll('#transition-panels > div')].map((el) => {
            const cs = getComputedStyle(el);
            const m = new DOMMatrixReadOnly(cs.transform);
            return {
              x: Math.round(m.m41),
              y: Math.round(m.m42),
              size: Math.round(el.getBoundingClientRect().width) + 'x' + Math.round(el.getBoundingClientRect().height),
              bg: cs.backgroundColor,
              blur: cs.filter,
            };
          }),
          planes: g.planes.map((p, i) => ({
            i,
            x: +p.position.x.toFixed(2),
            y: +p.position.y.toFixed(2),
            op: +(p.material.opacity || 0).toFixed(2),
            sx: +p.scale.x.toFixed(2),
            sy: +p.scale.y.toFixed(2),
          })),
        });
      })()`,
    );

  // park pointer centre so pointer parallax doesn't skew the offsets
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 720, y: 450, buttons: 0 });

  // full hand-off: panels attach (0.20-0.34) → fade to black → cinematic
  // scroll (0.32-0.62) → gallery opens from the centre (0.58+) → dive
  const steps = [0.21, 0.25, 0.28, 0.31, 0.34, 0.4, 0.46, 0.52, 0.56, 0.59, 0.62, 0.66, 0.72, 0.8, 0.9];
  for (let k = 0; k < steps.length; k++) {
    await setScroll(steps[k]);
    await settle(steps[k]);
    await sleep(4000); // let the temporal camera lerp catch up
    const st = await state();
    console.log(`step ${k + 1} @raw ${steps[k]}:`, typeof st === 'object' ? JSON.stringify(st) : st);
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(`.shots/entry-${k + 1}.png`, Buffer.from(shot.result.data, 'base64'));
  }
  console.log('entry screenshots written');
  ws.close();
} catch (err) {
  console.error('failed:', err.message);
} finally {
  chrome.kill();
}

