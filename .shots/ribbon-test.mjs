// verify the ribbon job page and the card-click route from the jobs page
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const CDP_PORT = 9395;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const dir = `${process.env.TEMP}/offmode-profiles/ribbon`.replace(/\\/g, '/');
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

  await send('Page.navigate', { url: 'http://localhost:5173/offthedrums/ribbon/index.html?job=5' });
  await sleep(7000);
  const ribbon = await evalJS(`(() => {
    const c = document.querySelector('canvas');
    const gl = c && (c.getContext('webgl') || c.getContext('experimental-webgl'));
    return {
      title: document.title,
      search: location.search,
      canvas: c ? [c.width, c.height] : null,
      gl: !!gl,
      hall: document.querySelector('[data-hall]').style.height,
      scrollH: document.documentElement.scrollHeight,
      startY: Math.round(scrollY),
      sheets: performance.getEntriesByType('resource').filter((e) => e.name.includes('/sheets/')).map((e) => e.name.split('/').pop()),
      brand: document.querySelector('.brand')?.textContent,
      back: document.querySelector('.bar__link')?.getAttribute('href'),
    };
  })()`);
  let shot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync('C:/Users/peter/Desktop/offmode/.shots/ribbon-page.png', Buffer.from(shot.result.data, 'base64'));

  await evalJS(`scrollTo({ top: document.documentElement.scrollHeight * 0.5, behavior: 'instant' }); true`);
  await sleep(1800);
  const scrolled = await evalJS(`({ y: Math.round(scrollY), h: document.documentElement.scrollHeight })`);
  shot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync('C:/Users/peter/Desktop/offmode/.shots/ribbon-scrolled.png', Buffer.from(shot.result.data, 'base64'));

  await send('Page.navigate', { url: 'http://localhost:5173/offthedrums/' });
  await sleep(6000);
  const hit = await evalJS(`(() => {
    for (let y = 200; y < innerHeight - 120; y += 16) {
      for (let x = 80; x < innerWidth - 80; x += 16) {
        const el = document.elementFromPoint(x, y);
        const c = el && el.closest && el.closest('.card');
        if (c) return { x, y, g: c.dataset.g };
      }
    }
    return null;
  })()`);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: hit.x, y: hit.y, button: 'left', clickCount: 1 });
  await sleep(80);
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: hit.x, y: hit.y, button: 'left', clickCount: 1 });
  await sleep(2500);
  const afterClick = await evalJS(`({ path: location.pathname, search: location.search, title: document.title })`);

  console.log(JSON.stringify({ ribbon, scrolled, hit, afterClick, errors }, null, 2));
  ws.close();
} catch (e) {
  console.error('FAILED', e);
  process.exitCode = 1;
} finally {
  chrome.kill();
}
