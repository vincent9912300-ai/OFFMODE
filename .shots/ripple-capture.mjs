import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const CDP_PORT = 9337;
const PAGE_URL = 'http://127.0.0.1:5199/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const userDataDir = `${process.env.TEMP}/offmode-profiles/ripple-shot`.replace(/\\/g, '/');
const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--hide-scrollbars',
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
    }
  };
  const send = (method, params = {}) =>
    new Promise((res) => {
      const id = ++msgId;
      pending.set(id, res);
      ws.send(JSON.stringify({ id, method, params }));
    });

  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await send('Page.navigate', { url: PAGE_URL });
  await sleep(4500); // loader + intro

  // fast diagonal stroke straight through the baked OFFMODE wordmark:
  // rings must spawn along it and the type must bend under them
  for (let i = 0; i <= 20; i++) {
    const x = 380 + i * 34;
    const y = 250 + i * 22;
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, buttons: 0 });
    await sleep(30);
  }
  // click impulse on the wordmark
  await send('Input.dispatchMouseEvent', {
    type: 'mousePressed', x: 720, y: 450, button: 'left', buttons: 1, clickCount: 1,
  });
  await send('Input.dispatchMouseEvent', {
    type: 'mouseReleased', x: 720, y: 450, button: 'left', buttons: 0, clickCount: 1,
  });
  await sleep(420); // catch rings mid-expand

  const shot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync('.shots/ripple.png', Buffer.from(shot.result.data, 'base64'));
  console.log('ripple.png ok');

  // explore button: hover the bottom-right pill (engages tendrils) and shoot
  for (let i = 0; i <= 12; i++) {
    const x = 720 + Math.round((1322 - 720) * (i / 12));
    const y = 450 + Math.round((826 - 450) * (i / 12));
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, buttons: 0 });
    await sleep(40);
  }
  await sleep(900);
  const pill = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync('.shots/explore.png', Buffer.from(pill.result.data, 'base64'));
  console.log('explore.png ok');

  // press the pill: venom:activate must throw a big ripple under it
  await send('Input.dispatchMouseEvent', {
    type: 'mousePressed', x: 1322, y: 826, button: 'left', buttons: 1, clickCount: 1,
  });
  await send('Input.dispatchMouseEvent', {
    type: 'mouseReleased', x: 1322, y: 826, button: 'left', buttons: 0, clickCount: 1,
  });
  await sleep(350);
  const press = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync('.shots/explore-click.png', Buffer.from(press.result.data, 'base64'));
  console.log('explore-click.png ok');

  // settle check: waves must dissipate and the type must become readable again
  await sleep(5000);
  const settled = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync('.shots/ripple-settled.png', Buffer.from(settled.result.data, 'base64'));
  console.log('ripple-settled.png ok');

  // --- yellow -> matte-black round wipe (scroll driven) ---
  const setScroll = (frac) =>
    send('Runtime.evaluate', {
      expression: `(() => { const el = document.getElementById('app-scroll'); el.scrollTop = Math.round((el.scrollHeight - el.clientHeight) * ${frac}); })()`,
    });

  await setScroll(0.5);
  await sleep(1200); // let the spring settle
  const mid = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync('.shots/wipe-mid.png', Buffer.from(mid.result.data, 'base64'));
  console.log('wipe-mid.png ok');

  await setScroll(1);
  await sleep(1600);
  const screen2 = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync('.shots/select-screen.png', Buffer.from(screen2.result.data, 'base64'));
  console.log('select-screen.png ok');

  // right half = girl pick (no gender text — only the visual highlight)
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 992, y: 450, button: 'left', buttons: 1, clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 992, y: 450, button: 'left', buttons: 0, clickCount: 1 });
  await sleep(1400);
  const girl = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync('.shots/select-girl.png', Buffer.from(girl.result.data, 'base64'));
  console.log('select-girl.png ok');

  // left half = boy pick
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 400, y: 450, button: 'left', buttons: 1, clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 400, y: 450, button: 'left', buttons: 0, clickCount: 1 });
  await sleep(1400);
  const boy = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync('.shots/select-boy.png', Buffer.from(boy.result.data, 'base64'));
  console.log('select-boy.png ok');

  // --- cursor grid: pointer glow must light cells on the background
  // behind the duo (event bubbles up from the halves), canvas readback ---
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 100, y: 100, buttons: 0 });
  await sleep(500);
  const gridProbe = await send('Runtime.evaluate', {
    expression: `(() => {
      const canvas = document.querySelector('#select-screen canvas');
      if (!canvas) return JSON.stringify({ err: 'no grid canvas' });
      const ctx = canvas.getContext('2d');
      const dpr = window.devicePixelRatio || 1;
      const sample = (x, y, w, h) => {
        const d = ctx.getImageData(x * dpr, y * dpr, w * dpr, h * dpr).data;
        let lit = 0, maxA = 0;
        for (let i = 3; i < d.length; i += 4) {
          if (d[i] > 100) lit++;
          if (d[i] > maxA) maxA = d[i];
        }
        return { lit, maxA };
      };
      const near = sample(60, 60, 80, 80);
      const far = sample(1180, 660, 80, 80);
      return JSON.stringify({ near, far, w: canvas.width, h: canvas.height });
    })()`,
    returnByValue: true,
  });
  console.log('grid:', gridProbe.result.result.value);
  const gridShot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync('.shots/select-grid.png', Buffer.from(gridShot.result.data, 'base64'));
  console.log('select-grid.png ok');

  // --- geometry probes: the select layer must always cover the viewport
  // (a straight edge = a sibling layer slicing the circle) and the spring
  // must track scroll back down to a clean hero ---
  const probe = async (tag) => {
    const r = await send('Runtime.evaluate', {
      expression: `(() => {
        const el = document.getElementById('app-scroll');
        const sel = document.getElementById('select-screen');
        const hero = document.getElementById('hero-screen');
        const rc = sel ? sel.getBoundingClientRect() : null;
        const duo = document.getElementById('duo-frame');
        const dc = duo ? duo.getBoundingClientRect() : null;
        const cs = sel ? getComputedStyle(sel) : null;
        const hs = hero ? getComputedStyle(hero) : null;
        return JSON.stringify({
          top: el.scrollTop,
          selTop: rc ? Math.round(rc.top) : null,
          selBottom: rc ? Math.round(rc.bottom) : null,
          duoTop: dc ? Math.round(dc.top) : null,
          duoBottom: dc ? Math.round(dc.bottom) : null,
          duoLeft: dc ? Math.round(dc.left) : null,
          duoRight: dc ? Math.round(dc.right) : null,
          clip: cs ? cs.clipPath : null,
          heroOp: hs ? hs.opacity : null,
          heroFilter: hs ? hs.filter : null,
        });
      })()`,
      returnByValue: true,
    });
    console.log(tag, r.result.result.value);
  };

  await setScroll(0.5);
  await sleep(1600);
  await probe('mid:');
  const midShot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync('.shots/wipe-mid.png', Buffer.from(midShot.result.data, 'base64'));
  console.log('wipe-mid.png ok');

  await setScroll(0);
  await sleep(2200);
  await probe('home:');
  const home = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync('.shots/home-again.png', Buffer.from(home.result.data, 'base64'));
  console.log('home-again.png ok');

  // wheel chain from page two must still work (real wheel events)
  await setScroll(1);
  await sleep(1400);
  for (let i = 0; i < 6; i++) {
    await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 720, y: 450, deltaX: 0, deltaY: -150 });
    await sleep(100);
  }
  await sleep(1600);
  await probe('wheelUp:');
  const rev = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync('.shots/wipe-reverse.png', Buffer.from(rev.result.data, 'base64'));
  console.log('wipe-reverse.png ok');
  ws.close();
} catch (err) {
  console.error('failed:', err.message);
} finally {
  chrome.kill();
}


