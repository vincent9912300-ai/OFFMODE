import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const CDP_PORT = 9338;
const PAGE_URL = 'http://127.0.0.1:5199/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const userDataDir = `${process.env.TEMP}/offmode-profiles/gallery-diag`.replace(/\\/g, '/');
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
      return `EXC: ${r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text}`;
    }
    return r.result.result.value;
  };
  const setScroll = (frac) =>
    evalJs(`(() => { const el = document.getElementById('app-scroll'); el.scrollTop = Math.round((el.scrollHeight - el.clientHeight) * ${frac}); })()`);

  const probe = () =>
    evalJs(`(() => {
      const d = window.__dg;
      if (!d) return JSON.stringify({ err: 'no __dg' });
      const g = d.gallery;
      const out = { s2: +d.s2.get().toFixed(3), camZ: +d.camera.position.z.toFixed(2), vel: +d.scrollState.velocity.toFixed(3) };
      if (!g) { out.gallery = 'building'; return JSON.stringify(out); }
      out.range = g.getDepthRange();
      out.depthProgress = +g.getDepthProgress(d.camera.position.z).toFixed(3);
      out.drift = typeof g.driftCurrent === 'number'
        ? +g.driftCurrent.toFixed(3)
        : g.driftCurrent ?? null;
      out.breath = typeof g.breathIntensity === 'number'
        ? +g.breathIntensity.toFixed(3)
        : null;
      out.planes = g.planes.map((p, i) => ({
        i,
        z: +p.position.z.toFixed(2),
        x: +p.position.x.toFixed(2),
        sx: +p.scale.x.toFixed(2),
        sy: +p.scale.y.toFixed(2),
        op: +p.material.opacity.toFixed(2),
        src: (g.planeConfig[i]?.textureSrc || '').split('/').pop(),
      }));
      return JSON.stringify(out);
    })()`);

  const shot = async (name) => {
    const s = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(`.shots/${name}`, Buffer.from(s.result.data, 'base64'));
    console.log(`${name} ok`);
  };

  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await send('Page.navigate', { url: PAGE_URL });
  await sleep(6000); // loader + texture preload

  console.log('start:', await probe());

  await setScroll(1);
  await sleep(5000);
  console.log('end:', await probe());
  await shot('diag-end.png');

  await setScroll(0.85);
  await sleep(4500);
  console.log('mid:', await probe());
  await shot('diag-mid.png');

  await setScroll(0.7);
  await sleep(3500);
  console.log('wipe:', await probe());
  await shot('diag-wipe.png');

  ws.close();
} catch (err) {
  console.error('failed:', err.message);
} finally {
  chrome.kill();
}
