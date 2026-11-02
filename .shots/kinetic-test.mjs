// focused test: kinetic look open/close on the depth gallery
// reuse: node .shots/kinetic-test.mjs  (vite must run on 5199)
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const CDP_PORT = 9338;
const PAGE_URL = 'http://127.0.0.1:5199/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const userDataDir = `${process.env.TEMP}/offmode-profiles/kinetic-test`.replace(/\\/g, '/');
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

  // scroll into the gallery at a resting checkpoint: raw 0.68 → s2 0.6
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

  // park pointer center (neutral parallax)
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 720, y: 450, buttons: 0 });
  await setScroll(0.68);
  await settle(0.68);

  // wait until the camera's temporal lerp has truly rested (blend ≈ 0)
  let openClick = null;
  for (let i = 0; i < 30; i++) {
    openClick = await evalJs(
      `(() => {
        const g = window.__dg && window.__dg.gallery;
        const cam = window.__dg && window.__dg.camera;
        if (!g || !cam || !g.planes.length) return 'no-dg';
        const b = g.getPlaneBlendData(cam.position.z);
        if (!b) return 'no-blend';
        if (b.blend > 0.1 && b.blend < 0.9) return 'not-resting:' + b.blend.toFixed(3);
        const pi = b.blend >= 0.9 ? Math.min(b.currentPlaneIndex + 1, g.planes.length - 1) : b.currentPlaneIndex;
        const plane = g.planes[pi];
        if (!plane) return 'no-plane';
        plane.updateMatrixWorld(true);
        const v = cam.position.clone();
        plane.getWorldPosition(v);
        v.project(cam);
        return JSON.stringify({
          x: Math.round((v.x * 0.5 + 0.5) * window.innerWidth),
          y: Math.round((-v.y * 0.5 + 0.5) * window.innerHeight),
          index: pi,
          blend: +b.blend.toFixed(3),
        });
      })()`,
    );
    if (typeof openClick === 'string' && openClick.startsWith('{')) break;
    await sleep(700);
  }
  console.log('open click target:', typeof openClick === 'object' ? JSON.stringify(openClick) : openClick);
  if (!(typeof openClick === 'string' && openClick.startsWith('{'))) throw new Error('no resting click target');

  const { x, y } = JSON.parse(openClick);
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, buttons: 0 });
  await sleep(300);
  // diagnose: what element is on top, where are the plane quads, what is
  // the blend right now (hover gate uses the LIVE camera state)
  const dbg = await evalJs(
    `(() => {
      const g = window.__dg && window.__dg.gallery;
      const c = window.__dg && window.__dg.camera;
      if (!g || !c) return 'no-dg';
      const b = g.getPlaneBlendData(c.position.z);
      const hit = document.elementFromPoint(${x}, ${y});
      const boxes = g.planes.map((p, i) => {
        p.updateMatrixWorld(true);
        const pts = [[-1.5,-1.5],[1.5,-1.5],[1.5,1.5],[-1.5,1.5]].map(([lx, ly]) => {
          const v = p.position.constructor ? new (p.position.constructor)(lx, ly, 0) : null;
          p.localToWorld(v);
          v.project(c);
          return [Math.round((v.x*0.5+0.5)*innerWidth), Math.round((-v.y*0.5+0.5)*innerHeight)];
        });
        const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
        return { i, op: +p.material.opacity.toFixed(2), x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
      });
      return JSON.stringify({
        blend: b ? +b.blend.toFixed(3) : null,
        cur: b ? b.currentPlaneIndex : null,
        resting: b ? (b.blend <= 0.1 ? b.currentPlaneIndex : b.blend >= 0.9 ? b.nextPlaneIndex : -1) : null,
        elem: hit ? (hit.tagName + '#' + hit.id + '.' + (hit.className && hit.className.baseVal !== undefined ? hit.className.baseVal : hit.className)) : 'none',
        boxes,
      });
    })()`,
  );
  console.log('hover debug:', typeof dbg === 'object' ? JSON.stringify(dbg) : dbg);
  // hover must show the pointer cursor (raycast hit on resting plane)
  const cursor = await evalJs(`(() => { const c = document.querySelector('#gallery-screen canvas'); return c ? c.style.cursor : 'no-canvas'; })()`);
  console.log('hover cursor:', typeof cursor === 'object' ? JSON.stringify(cursor) : cursor);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 });

  let opened = false;
  for (let i = 0; i < 40; i++) {
    await sleep(400);
    const op = await evalJs(
      `(() => { const el = document.getElementById('look-detail'); return el ? getComputedStyle(el).opacity : null; })()`,
    );
    if (op !== null && !op.__err && +op > 0.95) { opened = true; break; }
  }
  console.log('look-detail opened:', opened);
  // lag smoothing halves GSAP speed at headless fps — wait for full reveal
  await sleep(7000);
  const detail = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync('.shots/look-detail.png', Buffer.from(detail.result.data, 'base64'));
  console.log('look-detail.png ok');

  // scroll lock must be on while open
  const lock = await evalJs(`(() => { const el = document.getElementById('app-scroll'); return getComputedStyle(el).overflowY; })()`);
  console.log('scroll overflow while open:', typeof lock === 'object' ? JSON.stringify(lock) : lock);

  // ESC must reverse and close
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  let closed = false;
  for (let i = 0; i < 40; i++) {
    await sleep(400);
    const gone = await evalJs(`!document.getElementById('look-detail')`);
    if (gone === true) { closed = true; break; }
  }
  console.log('look-detail closed via ESC:', closed);
  const lockAfter = await evalJs(`(() => { const el = document.getElementById('app-scroll'); return getComputedStyle(el).overflowY; })()`);
  console.log('scroll overflow after close:', typeof lockAfter === 'object' ? JSON.stringify(lockAfter) : lockAfter);

  // gallery must still be alive underneath
  const alive = await evalJs(
    `(() => { const g = window.__dg && window.__dg.gallery; return g ? 'planes:' + g.planes.length : 'no-gallery'; })()`,
  );
  console.log('gallery after close:', typeof alive === 'object' ? JSON.stringify(alive) : alive);
  const after = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync('.shots/look-closed.png', Buffer.from(after.result.data, 'base64'));
  console.log('look-closed.png ok');
  ws.close();
} catch (err) {
  console.error('failed:', err.message);
} finally {
  chrome.kill();
}
