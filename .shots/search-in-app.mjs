// verify search now opens inside the React site (no navigation)
import { spawn } from 'node:child_process';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const CDP_PORT = 9391;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const dir = `${process.env.TEMP}/offmode-profiles/searchin`.replace(/\\/g, '/');
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${dir}`,
  '--no-first-run', '--no-default-browser-check', '--use-angle=swiftshader', '--hide-scrollbars', '--window-size=1422,804', 'about:blank'], { stdio: 'ignore' });
try {
  let target = null;
  for (let i = 0; i < 60; i++) { await sleep(250); try { const l = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json`)).json(); target = l.find((t) => t.type === 'page'); if (target) break; } catch {} }
  const ws = await new Promise((res, rej) => { const s = new WebSocket(target.webSocketDebuggerUrl); s.onopen = () => res(s); s.onerror = rej; });
  let id = 0; const pending = new Map(); const errors = [];
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map((a) => a.value ?? a.description).join(' '));
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.text);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  };
  const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
  const evalJS = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value;
  await send('Runtime.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1422, height: 804, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: 'http://localhost:5173/' });
  await sleep(7000);

  const before = await evalJS(`({ path: location.pathname, searchVisible: !!document.querySelector('iframe[title^="OFF THE DRUMS"]') })`);

  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'k', code: 'KeyK', windowsVirtualKeyCode: 75, modifiers: 2 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'k', code: 'KeyK', windowsVirtualKeyCode: 75, modifiers: 2 });
  await sleep(7000);

  const open = await evalJS(`(() => {
    const f = document.querySelector('iframe[title^="OFF THE DRUMS"]');
    const d = f && f.contentDocument;
    return {
      path: location.pathname,
      overlay: !!f,
      frameSrc: f && f.getAttribute('src'),
      cards: d ? d.querySelectorAll('.card').length : null,
      title: d ? d.title : null,
      back: !!document.querySelector('button[aria-label="Back to OFFMODE"]'),
      scrollLocked: document.getElementById('app-scroll')?.style.overflowY || null,
    };
  })()`);

  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await sleep(1200);
  const closed = await evalJS(`({ overlay: !!document.querySelector('iframe[title^="OFF THE DRUMS"]'), path: location.pathname })`);

  console.log(JSON.stringify({ before, open, closed, errors }));
  ws.close();
} catch (e) { console.error('FAILED', e); } finally { chrome.kill(); }
