// console probe: capture runtime errors from the page
// usage: node .shots/console-test.mjs
import { spawn } from 'node:child_process';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const CDP_PORT = 9353;
const PAGE_URL = 'http://localhost:5173/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const userDataDir = `${process.env.TEMP}/offmode-profiles/console-test`.replace(/\\/g, '/');
const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
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
      return;
    }
    if (msg.method === 'Runtime.consoleAPICalled') {
      const text = (msg.params.args || [])
        .map((a) => a.value ?? a.description ?? a.unserializableValue ?? '')
        .join(' ');
      if (msg.params.type === 'error' || msg.params.type === 'warning') {
        console.log(`[console.${msg.params.type}]`, String(text).slice(0, 400));
      }
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails;
      console.log('[exception]', (d.exception?.description || d.text || '').slice(0, 600));
    }
  };
  const send = (method, params = {}) =>
    new Promise((res) => {
      const id = ++msgId;
      pending.set(id, res);
      ws.send(JSON.stringify({ id, method, params }));
    });

  await send('Runtime.enable');
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await send('Page.navigate', { url: PAGE_URL });
  await sleep(6000);

  const r = await send('Runtime.evaluate', {
    expression: `(() => ({
      rootChildren: document.getElementById('root')?.childElementCount ?? -1,
      about: !!document.getElementById('about-page'),
      title: !!document.getElementById('about-title'),
      scroll: typeof window.__scroll,
      bodyText: (document.body.innerText || '').slice(0, 120),
    }))()`,
    returnByValue: true,
  });
  console.log('state', JSON.stringify(r.result.result.value));
  ws.close();
} catch (err) {
  console.error('failed:', err.message);
} finally {
  chrome.kill();
}
