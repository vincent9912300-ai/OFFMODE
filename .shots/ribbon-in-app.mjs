// verify job card -> ribbon page -> back to jobs, all inside the React overlay
import { spawn } from 'node:child_process';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const CDP_PORT = 9396;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const dir = `${process.env.TEMP}/offmode-profiles/ribbonin`.replace(/\\/g, '/');
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

  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'k', code: 'KeyK', windowsVirtualKeyCode: 75, modifiers: 2 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'k', code: 'KeyK', windowsVirtualKeyCode: 75, modifiers: 2 });
  await sleep(9000);

  const opened = await evalJS(`(() => {
    const f = document.querySelector('iframe[title^="OFF THE DRUMS"]');
    return { path: location.pathname, frame: f && f.contentWindow.location.pathname, cards: f && f.contentDocument.querySelectorAll('.card').length };
  })()`);

  const hit = await evalJS(`(() => {
    const f = document.querySelector('iframe[title^="OFF THE DRUMS"]');
    const d = f && f.contentDocument;
    if (!d) return null;
    for (let y = 200; y < f.clientHeight - 140; y += 14) {
      for (let x = 90; x < f.clientWidth - 90; x += 14) {
        const el = d.elementFromPoint(x, y);
        const c = el && el.closest && el.closest('.card');
        if (c) return { x, y, g: c.dataset.g };
      }
    }
    return null;
  })()`);
  if (hit) {
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: hit.x, y: hit.y, button: 'left', clickCount: 1 });
    await sleep(80);
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: hit.x, y: hit.y, button: 'left', clickCount: 1 });
  }
  await sleep(7000);

  const ribbon = await evalJS(`(() => {
    const f = document.querySelector('iframe[title^="OFF THE DRUMS"]');
    const w = f && f.contentWindow;
    const d = f && f.contentDocument;
    return {
      path: location.pathname,
      frame: w && w.location.pathname,
      search: w && w.location.search,
      gl: !!(d && d.querySelector('canvas') && (d.querySelector('canvas').getContext('webgl'))),
      sheets: w ? w.performance.getEntriesByType('resource').filter((e) => e.name.includes('/sheets/')).length : null,
      back: d && d.querySelector('.bar__link') ? d.querySelector('.bar__link').getBoundingClientRect().toJSON() : null,
    };
  })()`);

  const backHit = ribbon.back && { x: Math.round(ribbon.back.x + ribbon.back.width / 2), y: Math.round(ribbon.back.y + ribbon.back.height / 2) };
  if (backHit) {
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: backHit.x, y: backHit.y, button: 'left', clickCount: 1 });
    await sleep(80);
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: backHit.x, y: backHit.y, button: 'left', clickCount: 1 });
  }
  await sleep(5000);

  const back = await evalJS(`(() => {
    const f = document.querySelector('iframe[title^="OFF THE DRUMS"]');
    return { path: location.pathname, frame: f && f.contentWindow.location.pathname, cards: f && f.contentDocument.querySelectorAll('.card').length };
  })()`);

  console.log(JSON.stringify({ opened, hit, ribbon, back, errors }, null, 2));
  ws.close();
} catch (e) {
  console.error('FAILED', e);
  process.exitCode = 1;
} finally {
  chrome.kill();
}
