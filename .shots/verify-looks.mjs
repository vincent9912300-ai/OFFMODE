import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const CDP_PORT = 9345;
const PAGE_URL = 'http://127.0.0.1:5173/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const userDataDir = `${process.env.TEMP}/offmode-profiles/verify-looks`.replace(/\\/g, '/');
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

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.onopen = res;
    ws.onerror = rej;
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

  const evalJs = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.result?.exceptionDetails) {
      return { __err: r.result.exceptionDetails.exception?.description || 'exception' };
    }
    return r.result?.result?.value;
  };

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });

  await send('Page.navigate', { url: PAGE_URL });
  await sleep(4000);

  const setScroll = (frac) =>
    send('Runtime.evaluate', {
      expression: `(() => { const el = document.getElementById('app-scroll'); if (el) el.scrollTop = Math.round((el.scrollHeight - el.clientHeight) * ${frac}); })()`,
    });

  // Scroll to gallery stage (~0.65)
  console.log('Scrolling to gallery stage (0.65)...');
  await setScroll(0.65);
  await sleep(3500);

  // Capture scrolling view
  const shotScroll = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync('.shots/verify-scrolling.png', Buffer.from(shotScroll.result.data, 'base64'));
  console.log('Captured .shots/verify-scrolling.png');

  // Check the active style text and __dg state
  const dgState = await evalJs(`(() => {
    const dg = window.__dg;
    if (!dg) return { error: 'no __dg' };
    const gallery = dg.gallery;
    const blend = gallery?.getPlaneBlendData(dg.camera.position.z);
    return {
      s2: dg.s2?.get(),
      camZ: dg.camera?.position?.z,
      planeCount: gallery?.planes?.length,
      blend,
    };
  })()`);
  console.log('DG State:', JSON.stringify(dgState, null, 2));

  const styleText = await evalJs(`(() => {
    const el = document.querySelector('#gallery-screen h3');
    return el ? el.textContent : 'none';
  })()`);
  console.log('Active Style Text in Scrolling:', styleText);

  // Dispatch pointerdown directly on canvas to open the look detail
  console.log('Clicking to open individual look detail...');
  const clickResult = await evalJs(`(() => {
    const canvas = document.querySelector('#gallery-screen canvas');
    if (!canvas) return { error: 'no canvas' };
    const rect = canvas.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const ev = new PointerEvent('pointerdown', {
      clientX: x,
      clientY: y,
      bubbles: true,
      cancelable: true
    });
    canvas.dispatchEvent(ev);
    return { ok: true, x, y };
  })()`);
  console.log('Click result:', clickResult);
  await sleep(1500);

  // Verify look detail content
  const detailData = await evalJs(`(() => {
    const root = document.getElementById('look-detail');
    if (!root) return { open: false };
    const hero = root.querySelector('span.font-display')?.textContent || '';
    const title = root.querySelector('h1')?.textContent || '';
    const pills = Array.from(root.querySelectorAll('span.rounded-full')).map(p => {
      const dot = p.querySelector('span[style]');
      return {
        text: p.textContent.trim(),
        dotBg: dot?.style?.backgroundColor || '',
        textColor: dot?.nextElementSibling?.getAttribute('style') || ''
      };
    });
    const dressingEl = root.querySelector('.rounded-xl');
    const dressingHtml = dressingEl ? dressingEl.innerHTML : '';
    const dressingText = dressingEl ? dressingEl.textContent : '';
    return { open: true, hero, title, pills, dressingText, dressingHtmlLength: dressingHtml.length };
  })()`);
  console.log('Detail Data:', JSON.stringify(detailData, null, 2));

  // Capture individual page screenshot
  const shotDetail = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync('.shots/verify-detail.png', Buffer.from(shotDetail.result.data, 'base64'));
  console.log('Captured .shots/verify-detail.png');

  ws.close();
} catch (err) {
  console.error('Error in verification:', err);
} finally {
  chrome.kill();
}
