// sample the rendered sheet textures to confirm they contain the expected job designs
import { spawn } from 'node:child_process';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const CDP_PORT = 9397;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const dir = `${process.env.TEMP}/offmode-profiles/sheetprobe`.replace(/\\/g, '/');
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${dir}`,
  '--no-first-run', '--no-default-browser-check', '--use-angle=swiftshader', '--hide-scrollbars', '--window-size=400,300', 'about:blank'], { stdio: 'ignore' });
try {
  let target = null;
  for (let i = 0; i < 60; i++) { await sleep(250); try { const l = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json`)).json(); target = l.find((t) => t.type === 'page'); if (target) break; } catch {} }
  const ws = await new Promise((res, rej) => { const s = new WebSocket(target.webSocketDebuggerUrl); s.onopen = () => res(s); s.onerror = rej; });
  let id = 0; const pending = new Map();
  ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
  const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
  const evalJS = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value;
  await send('Runtime.enable'); await send('Page.enable');
  await send('Page.navigate', { url: 'http://localhost:5173/offthedrums/ribbon/index.html' });
  await sleep(3000);
  const out = await evalJS(`(async () => {
    const rows = [];
    for (let i = 1; i <= 8; i++) {
      const img = new Image();
      img.src = '/offthedrums/ribbon/sheets/job-' + i + '.png';
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      const g = c.getContext('2d');
      g.drawImage(img, 0, 0);
      const sample = (x, y) => {
        const d = g.getImageData(Math.round(x), Math.round(y), 1, 1).data;
        return '#' + [d[0], d[1], d[2]].map((v) => v.toString(16).padStart(2, '0')).join('');
      };
      rows.push({ job: i, size: [img.width, img.height], top: sample(img.width / 2, 10), mid: sample(img.width / 2, img.height / 2), low: sample(img.width / 2, img.height - 10) });
    }
    return rows;
  })()`);
  console.log(JSON.stringify(out, null, 2));
  ws.close();
} catch (e) {
  console.error('FAILED', e);
  process.exitCode = 1;
} finally {
  chrome.kill();
}
