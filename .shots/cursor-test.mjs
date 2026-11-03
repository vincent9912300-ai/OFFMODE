// quick cursor-state probe
import { spawn } from 'node:child_process';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const CDP_PORT = 9361;
const PAGE_URL = 'http://localhost:5173/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const userDataDir = `${process.env.TEMP}/offmode-profiles/cursor-test`.replace(/\\/g, '/');
const chrome = spawn(CHROME, [
  '--headless=new',
  `--remote-debugging-port=${CDP_PORT}`,
  `--user-data-dir=${userDataDir}`,
  '--no-first-run', '--no-default-browser-check',
  '--use-angle=swiftshader', '--window-size=1440,900', 'about:blank',
], { stdio: 'ignore' });

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
  let id = 0;
  const pending = new Map();
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  };
  const send = (method, params = {}) => new Promise((res) => {
    const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params }));
  });
  const evalJS = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    return r.result?.result?.value;
  };

  await send('Page.enable');
  await send('Page.navigate', { url: PAGE_URL });
  await sleep(5000);

  for (const f of [0.05, 0.6, 0.85, 1.0, 0.6, 0.05]) {
    await evalJS(`(() => { const el = document.getElementById('app-scroll');
      el.scrollTop = ${f} * (el.scrollHeight - el.clientHeight); return el.scrollTop; })()`);
    await sleep(900);
    const out = await evalJS(`(() => ({
      f: ${f},
      body: document.body.className,
      venom: document.body.dataset.venom || null,
      cursor: getComputedStyle(document.body).cursor.slice(0, 40),
      canvases: document.querySelectorAll('.venom-stage').length,
      lookOpen: document.body.classList.contains('look-open'),
      venomBtn: !!window.VenomButton,
      handOn: window.VenomButton?._debug?.hand?.on,
      handM: window.VenomButton?._debug?.hand?.m?.toFixed(2),
    }))()`);
    console.log(JSON.stringify(out));
  }
  ws.close();
} finally {
  chrome.kill();
}
