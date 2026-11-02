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
  ws.close();
} catch (err) {
  console.error('failed:', err.message);
} finally {
  chrome.kill();
}


