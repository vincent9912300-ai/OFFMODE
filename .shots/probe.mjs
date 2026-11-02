import { spawn } from 'node:child_process';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const CDP_PORT = 9337;
const PAGE_URL = process.argv[2] || 'http://127.0.0.1:5186/';
const userDataDir = `${process.env.TEMP}/offmode-probe`.replace(/\\/g, '/');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
    ...process.argv.slice(3),
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
      const text = msg.params.args.map((a) => a.value ?? a.description ?? '').join(' ');
      logs.push(`[${msg.params.type}] ${text}`);
      pending.set('log', () => {});
    } else if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails;
      logs.push(`[EXCEPTION] ${d.text} ${d.exception?.description ?? ''}`);
    }
  };
  const send = (method, params = {}) =>
    new Promise((res) => {
      const id = ++msgId;
      pending.set(id, res);
      ws.send(JSON.stringify({ id, method, params }));
    });

  const evalJs = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
    return r.result?.result?.value;
  };

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Page.navigate', { url: PAGE_URL });
  await sleep(8000);
  console.log('=== console/exceptions ===');
  for (const l of logs) console.log(l);

  const report = await evalJs(`(() => {
    const q = (s) => document.querySelector(s);
    const cs = (s, prop) => { const el = q(s); return el ? getComputedStyle(el)[prop] : 'MISSING'; };
    const rect = (s) => { const el = q(s); if (!el) return 'MISSING'; const r = el.getBoundingClientRect(); return JSON.stringify([r.x|0, r.y|0, r.width|0, r.height|0]); };
    const letters = [...document.querySelectorAll('.wordmark-letter')];
    return JSON.stringify({
      letterCount: letters.length,
      maskCount: document.querySelectorAll('.wordmark-mask').length,
      firstLetterTransform: cs('.wordmark-letter', 'transform'),
      firstLetterRect: rect('.wordmark-letter'),
      h1Transform: cs('.wordmark', 'transform'),
      h1Filter: cs('.wordmark', 'filter'),
      h1Rect: rect('.wordmark'),
      echoTransform: cs('.wordmark-echo', 'transform'),
      echoOpacity: cs('.wordmark-echo', 'opacity'),
      echoColor: cs('.wordmark-echo', 'color'),
      letterSpacing: cs('.wordmark', 'letterSpacing'),
      navOpacity: cs('header', 'opacity'),
      canvasCount: document.querySelectorAll('canvas').length,
      containerOpacity: (() => { const c = q('[data-testid=liquid-background]'); return c ? getComputedStyle(c).opacity : 'none'; })(),
    }, null, 1);
  })()`);
  console.log(report);
  const gsapState = await evalJs(`JSON.stringify((() => {
    const letters = [...document.querySelectorAll('.wordmark-letter')];
    return letters.slice(0, 3).map((l) => ({
      hasData: !!l._gsap,
      yPercent: l._gsap ? l._gsap.yPercent : null,
      y: l._gsap ? l._gsap.y : null,
      style: l.getAttribute('style'),
    }));
  })())`);
  console.log('=== gsap element data ===');
  console.log(gsapState);
  ws.close();
} finally {
  chrome.kill();
}
