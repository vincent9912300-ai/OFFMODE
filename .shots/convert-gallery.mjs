import { spawn } from 'node:child_process';
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const CDP_PORT = 9342;
const SRC = 'C:/Users/peter/Downloads';
const OUT = 'C:/Users/peter/Desktop/offmode/src/assets/gallery';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const files = [];
for (const set of ['boy', 'girl', 'duo']) {
  for (let i = 1; i <= 20; i++) {
    const name = `${set}${i}.png`;
    try {
      readFileSync(`${SRC}/${name}`);
      files.push(name);
    } catch {}
  }
}
mkdirSync(OUT, { recursive: true });

const userDataDir = `${process.env.TEMP}/offmode-profiles/webp-convert`.replace(/\\/g, '/');
const chrome = spawn(CHROME, [
  '--headless=new',
  `--remote-debugging-port=${CDP_PORT}`,
  `--user-data-dir=${userDataDir}`,
  '--no-first-run',
  '--no-default-browser-check',
  'about:blank',
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
  let msgId = 0;
  const pending = new Map();
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  };
  const send = (method, params = {}) => new Promise((res) => { const id = ++msgId; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
  await send('Page.enable');

  for (const name of files) {
    const outName = name.replace('.png', '.webp');
    const outPath = `${OUT}/${outName}`;
    if (existsSync(outPath)) { console.log('skip', outName); continue; }
    const b64 = readFileSync(`${SRC}/${name}`).toString('base64');
    const expr = `new Promise((res) => {
      const img = new Image();
      img.onload = () => {
        const targetH = 1152;
        const scale = Math.min(1, targetH / img.height);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        res(c.toDataURL('image/webp', 0.82));
      };
      img.onerror = () => res('ERROR');
      img.src = 'data:image/png;base64,${b64}';
    })`;
    const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    const dataUrl = r.result.result.value;
    if (!dataUrl || dataUrl === 'ERROR' || !dataUrl.startsWith('data:image/webp')) {
      console.log('FAIL', name, String(dataUrl).slice(0, 60));
      continue;
    }
    const buf = Buffer.from(dataUrl.split(',')[1], 'base64');
    writeFileSync(outPath, buf);
    console.log(outName, Math.round(buf.length / 1024) + 'KB');
  }
  ws.close();
} catch (err) {
  console.error('failed:', err.message);
} finally {
  chrome.kill();
}
