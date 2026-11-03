// focused probe: is the cinematic stage actually painting (or white)? + console errors
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const CDP_PORT = 9341;
const PAGE_URL = 'http://127.0.0.1:5173/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const userDataDir = `${process.env.TEMP}/offmode-profiles/cine-test`.replace(/\\/g, '/');
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
  const logs = [];
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    } else if (msg.method === 'Runtime.consoleAPICalled') {
      logs.push(msg.params.type + ': ' + msg.params.args.map((a) => a.value ?? a.description ?? '').join(' '));
    } else if (msg.method === 'Runtime.exceptionThrown') {
      logs.push('EXCEPTION: ' + (msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text));
    } else if (msg.method === 'Log.entryAdded') {
      logs.push(msg.params.entry.level + ': ' + msg.params.entry.text);
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
  await send('Runtime.enable');
  await send('Log.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await send('Page.navigate', { url: PAGE_URL });
  await sleep(5000);

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

  for (const frac of [0.34, 0.42, 0.5, 0.58]) {
    await setScroll(frac);
    await settle(frac);
    await sleep(2500);
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    const b64 = shot.result.data;
    writeFileSync(`.shots/cine-${Math.round(frac * 100)}.png`, Buffer.from(b64, 'base64'));
    const px = await evalJs(`(() => new Promise((res) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = img.width; c.height = img.height;
        const x = c.getContext('2d');
        x.drawImage(img, 0, 0);
        const pts = [[720,450],[200,200],[1200,200],[200,700],[1200,700],[720,120]];
        res(JSON.stringify(pts.map(([a,b]) => Array.from(x.getImageData(a,b,1,1).data.slice(0,3)))));
      };
      img.src = 'data:image/png;base64,${b64}';
    }))()`);
    const st = await evalJs(
      `(() => { const sc = window.__scroll; const cine = document.getElementById('cinematic-scroll');
        return JSON.stringify({ cine: +(+getComputedStyle(cine).opacity).toFixed(2),
          gl: window.__cine ? window.__cine.frames : -1,
          stage: sc ? +sc.cine.get().toFixed(2) : -1 }); })()`,
    );
    console.log(`@${frac}`, st, 'pixels', px);
  }

  console.log('LOGS:');
  for (const l of logs.slice(0, 40)) console.log(' ', l);
  ws.close();
} finally {
  chrome.kill();
}
