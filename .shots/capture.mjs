import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const CDP_PORT = 9335;
const PAGE_URL = process.argv[2] || 'http://127.0.0.1:5183/';
const WAIT_MS = Number(process.argv[3] || 6500);
const EXTRA_FLAGS = (process.argv[4] || '').split(' ').filter(Boolean);
const VIEWPORTS = {
  desktop: [1440, 900],
  tablet: [834, 1112],
  mobile: [390, 844],
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

for (const [name, [w, h]] of Object.entries(VIEWPORTS)) {
  const userDataDir = `${process.env.TEMP}/offmode-profiles/cdp-${name}`.replace(/\\/g, '/');
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
      `--window-size=${w},${h}`,
      ...EXTRA_FLAGS,
      'about:blank',
    ],
    { stdio: 'ignore' },
  );

  try {
    // wait for the DevTools endpoint
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
      width: w,
      height: h,
      deviceScaleFactor: 1,
      mobile: name === 'mobile',
    });
    await send('Page.navigate', { url: PAGE_URL });
    await sleep(WAIT_MS); // real time: loader (1.1s) + exit + intro (~2.5s)
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(`.shots/${name}.png`, Buffer.from(shot.result.data, 'base64'));
    console.log(`[${name}] ok`);
    ws.close();
  } catch (err) {
    console.error(`[${name}] failed:`, err.message);
  } finally {
    chrome.kill();
    await sleep(400);
  }
}
