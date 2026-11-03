import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const CDP_PORT = 9348;
const PAGE_URL = 'http://127.0.0.1:5173/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const userDataDir = `${process.env.TEMP}/offmode-profiles/verify-winj`.replace(/\\/g, '/');
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
  await sleep(3500);

  // Test 1: Verify 3D mode initially loaded
  const initMode = await evalJs(`(() => {
    const appScroll = document.getElementById('app-scroll');
    const heroScreen = document.getElementById('hero-screen');
    return { hasAppScroll: !!appScroll, hasHero: !!heroScreen };
  })()`);
  console.log('Init Mode (3D):', initMode);

  // Test 2: Trigger Win+J keyboard event
  console.log('Dispatching Win+J key event...');
  const keyResult = await evalJs(`(() => {
    const ev = new KeyboardEvent('keydown', {
      key: 'j',
      code: 'KeyJ',
      metaKey: true,
      bubbles: true,
      cancelable: true
    });
    window.dispatchEvent(ev);
    return true;
  })()`);
  await sleep(1000);

  // Verify static website rendered
  const staticState = await evalJs(`(() => {
    const discover = document.getElementById('discover');
    const collections = document.getElementById('collections');
    const styles = document.getElementById('styles');
    const about = document.getElementById('about');
    const cards = document.querySelectorAll('#collections .group');
    const stylesRows = document.querySelectorAll('#styles .group');
    return {
      hasDiscover: !!discover,
      hasCollections: !!collections,
      hasStyles: !!styles,
      hasAbout: !!about,
      cardsCount: cards.length,
      stylesCount: stylesRows.length
    };
  })()`);
  console.log('Static Website State after Win+J:', staticState);

  // Capture screenshot of static website mode
  const shotStatic = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync('.shots/verify-static-site.png', Buffer.from(shotStatic.result.data, 'base64'));
  console.log('Captured .shots/verify-static-site.png');

  // Test 3: Click a card in Collections to open LookDetail
  console.log('Clicking first card in Collections to test look detail modal...');
  await evalJs(`(() => {
    const firstCard = document.querySelector('#collections .group');
    if (firstCard) firstCard.click();
  })()`);
  await sleep(1000);

  const detailState = await evalJs(`(() => {
    const root = document.getElementById('look-detail');
    if (!root) return { open: false };
    const hero = root.querySelector('span.font-display')?.textContent || '';
    const title = root.querySelector('h1')?.textContent || '';
    return { open: true, hero, title };
  })()`);
  console.log('Look Detail Opened from Static Site:', detailState);

  // Close LookDetail
  await evalJs(`(() => {
    const closeBtn = document.querySelector('#look-detail button[aria-label="Close detail"]');
    if (closeBtn) closeBtn.click();
  })()`);
  await sleep(500);

  // Test 4: Dispatch Win+J again to return to 3D scroll flow
  console.log('Dispatching Win+J key event again to toggle back to 3D...');
  await evalJs(`(() => {
    const ev = new KeyboardEvent('keydown', {
      key: 'j',
      code: 'KeyJ',
      metaKey: true,
      bubbles: true,
      cancelable: true
    });
    window.dispatchEvent(ev);
  })()`);
  await sleep(1000);

  const backTo3D = await evalJs(`(() => {
    const appScroll = document.getElementById('app-scroll');
    return { hasAppScroll: !!appScroll };
  })()`);
  console.log('Back to 3D flow:', backTo3D);

  ws.close();
} catch (err) {
  console.error('Error in verification:', err);
} finally {
  chrome.kill();
}
