// about page probe: wrapped-title chapters at the end of the scroll
// usage: node .shots/about-test.mjs   (vite must run on 5173)
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const CDP_PORT = 9351;
const PAGE_URL = 'http://localhost:5173/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const userDataDir = `${process.env.TEMP}/offmode-profiles/about-test`.replace(/\\/g, '/');
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

const op = (id) => `(() => { const el = document.getElementById('${id}'); return el ? +(+getComputedStyle(el).opacity).toFixed(2) : -1; })()`;

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
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
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
        const ring = document.getElementById('about-title');
        const kiln = document.getElementById('about-title-kiln');
        const sc = window.__scroll;
        if (!ring || !kiln) return 'no-about';
        const m = (el) => { const d = new DOMMatrixReadOnly(getComputedStyle(el).transform); return { x: Math.round(d.m41), z: Math.round(d.m43), ry: +(Math.atan2(d.m13, d.m11) * 180 / Math.PI).toFixed(1) }; };
        const L = (r) => { const s = [...r.children]; const mid = s[Math.floor(s.length / 2)]; return { n: s.length, first: s[0] ? m(s[0]) : null, mid: mid ? m(mid) : null, fs: r.style.fontSize }; };
        return JSON.stringify({
          raw: sc ? +sc.raw.get().toFixed(3) : -1,
          about: sc ? +(Math.min(1, Math.max(0, (sc.raw.get() - 0.8) / 0.2))).toFixed(2) : -1,
          intro: ${op('about-intro')},
          article: ${op('about-article')},
          kiln: ${op('about-kiln')},
          footer: ${op('about-footer')},
          title: L(ring),
          kilnTitle: L(kiln),
          ringOpacity: +(+getComputedStyle(ring).opacity).toFixed(2),
          kilnRingOpacity: +(+getComputedStyle(kiln).opacity).toFixed(2),
        });
      })()`,
    );

  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 720, y: 450, buttons: 0 });

  const steps = [0.86, 0.88, 0.9, 0.92, 0.94, 0.96, 0.98, 0.99, 1.0];
  for (let k = 0; k < steps.length; k++) {
    await setScroll(steps[k]);
    await settle(steps[k]);
    await sleep(3500);
    const st = await state();
    console.log(`step ${k + 1} @raw ${steps[k]}:`, typeof st === 'object' ? JSON.stringify(st) : st);
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(`.shots/about-${k + 1}.png`, Buffer.from(shot.result.data, 'base64'));
  }
  console.log('about screenshots written');
  ws.close();
} catch (err) {
  console.error('failed:', err.message);
} finally {
  chrome.kill();
}
