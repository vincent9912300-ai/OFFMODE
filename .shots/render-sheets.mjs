// render the 8 job sheets to PNG textures for the ribbon page
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const CDP_PORT = 9394;
const OUT = 'C:/Users/peter/Desktop/offmode/public/offthedrums/ribbon/sheets';
const W = 360;
const H = 480;
const DSF = 2;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const dir = `${process.env.TEMP}/offmode-profiles/sheets`.replace(/\\/g, '/');
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${dir}`,
  '--no-first-run', '--no-default-browser-check', '--use-angle=swiftshader', '--hide-scrollbars', '--window-size=800,600', 'about:blank'], { stdio: 'ignore' });
try {
  let target = null;
  for (let i = 0; i < 60; i++) { await sleep(250); try { const l = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json`)).json(); target = l.find((t) => t.type === 'page'); if (target) break; } catch {} }
  const ws = await new Promise((res, rej) => { const s = new WebSocket(target.webSocketDebuggerUrl); s.onopen = () => res(s); s.onerror = rej; });
  let id = 0; const pending = new Map();
  ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
  const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
  const evalJS = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value;
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 800, height: 600, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: 'http://localhost:5173/offthedrums/' });
  await sleep(5000);
  await evalJS(`document.fonts.ready.then(() => true)`);

  for (let i = 0; i < 8; i++) {
    const rect = await evalJS(`(() => {
      document.getElementById('__sheet')?.remove();
      const host = document.createElement('div');
      host.id = '__sheet';
      host.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#777;display:grid;place-items:center;';
      const card = document.createElement('div');
      card.className = 'card';
      card.style.cssText = 'width:${W}px;height:${H}px;container-type:inline-size;transform:none;';
      card.innerHTML = document.querySelectorAll('.card')[${i}].querySelector('.sheet').outerHTML;
      host.appendChild(card);
      document.body.appendChild(host);
      const r = card.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    })()`);
    await sleep(250);
    const shot = await send('Page.captureScreenshot', {
      format: 'png',
      clip: { x: rect.x, y: rect.y, width: rect.width, height: rect.height, scale: DSF },
      captureBeyondViewport: false,
    });
    const buf = Buffer.from(shot.result.data, 'base64');
    writeFileSync(`${OUT}/job-${i + 1}.png`, buf);
    console.log(`job-${i + 1}.png`, rect.width, rect.height, buf.length);
  }

  ws.close();
} catch (e) {
  console.error('FAILED', e);
  process.exitCode = 1;
} finally {
  chrome.kill();
}
