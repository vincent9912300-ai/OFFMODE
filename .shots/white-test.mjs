// find what paints the white cinematic screen
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const CDP_PORT = 9343;
const PAGE_URL = 'http://127.0.0.1:5173/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${process.env.TEMP}/offmode-profiles/white-test`,
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
  const ws = await new Promise((res, rej) => {
    const sock = new WebSocket(target.webSocketDebuggerUrl);
    sock.onopen = () => res(sock);
    sock.onerror = rej;
  });
  let msgId = 0;
  const pending = new Map();
  const logs = [];
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      pending.get(m.id)(m);
      pending.delete(m.id);
    } else if (m.method === 'Log.entryAdded' && /error|fail|shader|webgl/i.test(m.params.entry.text)) {
      logs.push(m.params.entry.level + ': ' + m.params.entry.text.slice(0, 400));
    } else if (m.method === 'Runtime.exceptionThrown') {
      logs.push('EXCEPTION: ' + (m.params.exceptionDetails.exception?.description || ''));
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
    return r.result.exceptionDetails
      ? { __err: r.result.exceptionDetails.exception?.description || 'exception' }
      : r.result.result.value;
  };

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Log.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: PAGE_URL });
  await sleep(5000);

  await send('Runtime.evaluate', {
    expression: `(() => { const el = document.getElementById('app-scroll'); el.scrollTop = Math.round((el.scrollHeight - el.clientHeight) * 0.42); })()`,
  });
  for (let i = 0; i < 40; i++) {
    const s = await evalJs(`(() => { const sc = window.__scroll; return sc ? [sc.raw.get(), sc.smooth.get()] : null; })()`);
    if (s && Math.abs(s[0] - 0.42) < 0.001 && Math.abs(s[1] - s[0]) < 0.006) break;
    await sleep(500);
  }
  await sleep(3000);

  console.log(
    'HIT',
    await evalJs(`(() => {
      const el = document.elementFromPoint(720, 450);
      const cnv = document.querySelector('#cinematic-scroll canvas');
      const cs = cnv ? getComputedStyle(cnv) : null;
      const ctx = cnv && (cnv.getContext('webgl2') || cnv.getContext('webgl'));
      return JSON.stringify({
        hit: el && (el.tagName + '#' + el.id + '.' + el.className),
        chain: (() => { const out = []; let n = el; while (n && out.length < 8) { const s = getComputedStyle(n); out.push((n.id || n.tagName) + ':' + s.backgroundColor + ':' + s.opacity + ':' + s.zIndex); n = n.parentElement; } return out; })(),
        canvas: cs ? { w: cnv.width, h: cnv.height, cw: cnv.clientWidth, ch: cnv.clientHeight } : null,
        ctxLost: ctx ? ctx.isContextLost() : 'noctx',
        glError: ctx ? ctx.getError() : -1,
        cine: window.__cine || null,
      });
    })()`),
  );

  const shot1 = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync('.shots/white-1.png', Buffer.from(shot1.result.data, 'base64'));

  // hide the cylinder layer and measure again
  console.log(
    'HIDDEN',
    await evalJs(`(() => {
      const el = document.getElementById('cinematic-scroll');
      el.style.display = 'none';
      return 'hidden';
    })()`),
  );
  await sleep(1500);
  const shot2 = await send('Page.captureScreenshot', { format: 'png' });
  const px = await evalJs(`(() => new Promise((res) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      const x = c.getContext('2d');
      x.drawImage(img, 0, 0);
      res(JSON.stringify([[720,450],[200,200],[1200,760]].map(([a,b]) => Array.from(x.getImageData(a,b,1,1).data.slice(0,3)))));
    };
    img.src = 'data:image/png;base64,${shot2.result.data}';
  }))()`);
  console.log('HIDDEN PIXELS', px);
  writeFileSync('.shots/white-2.png', Buffer.from(shot2.result.data, 'base64'));

  console.log('ERRORS:', logs.slice(0, 8));
  ws.close();
} finally {
  chrome.kill();
}
