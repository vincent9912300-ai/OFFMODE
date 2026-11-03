// temp probe: about page must wait for the last look to settle + extra scroll
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9345;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const chrome = spawn(CHROME, ['--headless=new', '--remote-debugging-port=' + PORT,
  '--no-first-run', '--no-default-browser-check', '--hide-scrollbars',
  '--use-angle=swiftshader', '--window-size=1440,900', 'about:blank'], { stdio: 'ignore' });
try {
  let target = null;
  for (let i = 0; i < 60 && !target; i++) {
    await sleep(250);
    try { target = (await (await fetch('http://127.0.0.1:' + PORT + '/json')).json()).find((t) => t.type === 'page'); } catch {}
  }
  const ws = await new Promise((res, rej) => { const s = new WebSocket(target.webSocketDebuggerUrl); s.onopen = () => res(s); s.onerror = rej; });
  let id = 0; const pending = new Map();
  ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
  const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (expression) => { const r = await send('Runtime.evaluate', { expression, returnByValue: true }); return r.result.exceptionDetails ? { err: r.result.exceptionDetails.text } : r.result.result.value; };
  const shot = async (name) => { const s = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync('.shots/' + name, Buffer.from(s.result.data, 'base64')); };
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: 'http://127.0.0.1:5173/' });
  await sleep(5000);
  const state = () => ev(`(() => {
    const p = document.getElementById('about-page');
    const g = window.__dg && window.__dg.gallery;
    const cam = window.__dg && window.__dg.camera;
    const sc = window.__scroll;
    const top = document.elementFromPoint(720, 450);
    return JSON.stringify({
      smooth: +sc.smooth.get().toFixed(3),
      gallery: +sc.gallery.get().toFixed(2),
      about: +sc.about.get().toFixed(2),
      clip: p ? getComputedStyle(p).clipPath : 'missing',
      pe: p ? getComputedStyle(p).pointerEvents : 'missing',
      camZ: cam ? +cam.position.z.toFixed(2) : null,
      blend: g && cam ? +(g.getPlaneBlendData(cam.position.z).blend || 0).toFixed(2) : null,
      top: top ? (top.id || top.tagName) : 'none',
    });
  })()`);
  for (const frac of [0.86, 0.9, 0.94, 0.999]) {
    await send('Runtime.evaluate', { expression: "(() => { const el = document.getElementById('app-scroll'); el.scrollTop = Math.round((el.scrollHeight - el.clientHeight) * " + frac + "); })()" });
    for (let i = 0; i < 40; i++) {
      const s = await ev("(() => { const sc = window.__scroll; return sc ? { raw: sc.raw.get(), smooth: sc.smooth.get() } : null; })()");
      if (s && !s.err && Math.abs(s.raw - frac) < 0.002 && Math.abs(s.smooth - s.raw) < 0.006) break;
      await sleep(500);
    }
    await sleep(2500);
    console.log('@' + frac, await state());
    await shot('hold-' + String(frac).replace('.', '') + '.png');
  }
  ws.close();
} catch (e) { console.error('failed:', e.message); } finally { chrome.kill(); }
