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
  // ranges: s1 = smooth [0, 0.2] (hero -> select), s2 = smooth [0.2, 1]
  // (select -> gallery: wipe 0.1-0.22, images 0.22-0.38, depth 0.43-1)
  // raw frac = 0.2 + 0.8 * s2, select frac = 0.2 * s1
  const setScroll = (frac) =>
    send('Runtime.evaluate', {
      expression: `(() => { const el = document.getElementById('app-scroll'); el.scrollTop = Math.round((el.scrollHeight - el.clientHeight) * ${frac}); })()`,
    });

  const evalJs = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true });
    if (r.result.exceptionDetails) return null;
    return r.result.result.value;
  };

  // headless fps delays programmatic scroll events + MV frame updates, so
  // (a) settle only trusts raw AFTER it reflects the target we just set
  //     (kills instant false settles on a stale raw), and
  // (b) waitPointer waits until the select layer's computed pointer-events
  //     actually flipped to 'auto' before every click
  const settle = async (frac, maxMs = 25000) => {
    const t0 = Date.now();
    let lastLog = -3000;
    let s = null;
    while (Date.now() - t0 < maxMs) {
      s = await evalJs(
        `(() => { const sc = window.__scroll; if (!sc) return null; return { raw: sc.raw.get(), smooth: sc.smooth.get() }; })()`,
      );
      if (
        s &&
        Math.abs(s.raw - frac) < 0.001 &&
        Math.abs(s.smooth - s.raw) < 0.006
      ) {
        return true;
      }
      if (Date.now() - t0 - lastLog > 3000) {
        lastLog = Date.now() - t0;
        console.log(`  settle t+${Date.now() - t0}ms`, JSON.stringify(s), 'target', frac);
      }
      await sleep(500);
    }
    console.log('settle TIMEOUT', frac, JSON.stringify(s));
    return false;
  };

  const waitPointer = async (expect) => {
    const t0 = Date.now();
    while (Date.now() - t0 < 10000) {
      // the gate MV lives on the INNER content wrapper (the root keeps
      // pointer-events-none so empty areas pass through)
      const p = await evalJs(
        `(() => { const el = document.getElementById('select-screen'); const inner = el && el.firstElementChild; return inner ? getComputedStyle(inner).pointerEvents : 'none'; })()`,
      );
      if (p === expect) return true;
      await sleep(300);
    }
    console.log('pointer wait FAILED, wanted', expect);
    return false;
  };

  const gallerySet = async () =>
    evalJs(
      `window.__dg && window.__dg.gallery ? (window.__dg.gallery.planeConfig[0]?.textureSrc || '') : ''`,
    );

  // the camera z eases temporally toward its checkpoint, so at headless
  // fps a screenshot right after settle can catch it mid-travel — wait
  // until blend sits at a true rest (≈0 on current, ≈1 at next plane)
  const waitRest = async (maxMs = 45000) => {
    const t0 = Date.now();
    let last = null;
    while (Date.now() - t0 < maxMs) {
      last = await evalJs(
        `(() => { const g = window.__dg && window.__dg.gallery; const c = window.__dg && window.__dg.camera; if (!g || !c) return null; const d = g.getPlaneBlendData(c.position.z); return d ? d.blend : null; })()`,
      );
      if (typeof last === 'number' && (last <= 0.02 || last >= 0.98)) return true;
      await sleep(500);
    }
    console.log('waitRest TIMEOUT, last blend:', last);
    return false;
  };

  await setScroll(0.1);
  await settle(0.1);
  const mid = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync('.shots/wipe-mid.png', Buffer.from(mid.result.data, 'base64'));
  console.log('wipe-mid.png ok');

  // park just under the end of stage one (s1 > 0.97, s2 idle) so the
  // select screen is fully faded in and interactive
  await setScroll(0.195);
  await settle(0.195);
  const screen2 = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync('.shots/select-screen.png', Buffer.from(screen2.result.data, 'base64'));
  console.log('select-screen.png ok');

  // right half = girl pick (no gender text — only the visual highlight)
  await waitPointer('auto');
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
        const gal = document.getElementById('gallery-screen');
        const gs = gal ? getComputedStyle(gal) : null;
        const sc = window.__scroll;
        return JSON.stringify({
          raw: sc ? +sc.raw.get().toFixed(4) : null,
          smooth: sc ? +sc.smooth.get().toFixed(4) : null,
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
          gclip: gs ? gs.clipPath : null,
          gop: gal && gal.firstElementChild
            ? getComputedStyle(gal.firstElementChild).opacity
            : null,
        });
      })()`,
      returnByValue: true,
    });
    console.log(tag, r.result.result.value);
  };

  await setScroll(0.1);
  await settle(0.1);
  await probe('mid:');
  const midShot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync('.shots/wipe-mid.png', Buffer.from(midShot.result.data, 'base64'));
  console.log('wipe-mid.png ok');

  await setScroll(0);
  await settle(0);
  await probe('home:');
  const home = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync('.shots/home-again.png', Buffer.from(home.result.data, 'base64'));
  console.log('home-again.png ok');

  // wheel chain from the very bottom (1250vh) must still reach the top
  await setScroll(1);
  await sleep(1400);
  for (let i = 0; i < 80; i++) {
    await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 720, y: 450, deltaX: 0, deltaY: -300 });
    await sleep(70);
  }
  await settle(0);
  await probe('wheelUp:');
  const rev = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync('.shots/wipe-reverse.png', Buffer.from(rev.result.data, 'base64'));
  console.log('wipe-reverse.png ok');

  // --- screen three: Codrops depth gallery, wipe from the BOTTOM-LEFT ---
  // park the pointer dead-center first: the grid's corner position would
  // otherwise sit in the plane parallax for every gallery screenshot
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 720, y: 450, buttons: 0 });
  await sleep(300);

  // pick from earlier = boy → boy+duo stack; s2 = 0.16 → raw = 0.328
  // (mid gallery wipe, still painting black over the select screen)
  await setScroll(0.33);
  await settle(0.33);
  await probe('gal-wipe:');
  console.log('gal-wipe set:', await gallerySet());
  const galWipe = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync('.shots/gallery-wipe.png', Buffer.from(galWipe.result.data, 'base64'));
  console.log('gallery-wipe.png ok');

  // raw 0.68 → s2 0.6 → depthT 0.47 → a few looks into the stack
  await setScroll(0.68);
  await settle(0.68);
  await waitRest();
  await probe('gal-planes:');
  console.log('gal-planes set:', await gallerySet());
  const galPlanes = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync('.shots/gallery-planes.png', Buffer.from(galPlanes.result.data, 'base64'));
  console.log('gallery-planes.png ok');

  // --- kinetic open: click the resting look, the detail must come up ---
  // camera z lerps toward its checkpoint target, so poll until it's
  // actually resting (blend ≈ 0) before computing the click point
  let openClick = null;
  for (let i = 0; i < 30; i++) {
    openClick = await evalJs(
      `(() => {
        const g = window.__dg && window.__dg.gallery;
        const cam = window.__dg && window.__dg.camera;
        if (!g || !cam || !g.planes.length) return null;
        const b = g.getPlaneBlendData(cam.position.z);
        if (!b) return null;
        if (b.blend > 0.1 && b.blend < 0.9) return 'not-resting:' + b.blend.toFixed(3);
        const pi = b.blend >= 0.9 ? Math.min(b.currentPlaneIndex + 1, g.planes.length - 1) : b.currentPlaneIndex;
        const plane = g.planes[pi];
        if (!plane) return 'no-plane';
        plane.updateMatrixWorld(true);
        const v = cam.position.clone();
        plane.getWorldPosition(v);
        v.project(cam);
        return JSON.stringify({
          x: Math.round((v.x * 0.5 + 0.5) * window.innerWidth),
          y: Math.round((-v.y * 0.5 + 0.5) * window.innerHeight),
          index: pi,
          blend: +b.blend.toFixed(3),
        });
      })()`,
    );
    if (openClick && openClick.startsWith('{')) break;
    await sleep(700);
  }
  console.log('open click target:', openClick);
  if (openClick && openClick.startsWith('{')) {
    const { x, y } = JSON.parse(openClick);
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, buttons: 0 });
    await sleep(300);
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 });
    let opened = false;
    for (let i = 0; i < 40; i++) {
      await sleep(400);
      const op = await evalJs(
        `(() => { const el = document.getElementById('look-detail'); return el ? getComputedStyle(el).opacity : null; })()`,
      );
      if (op !== null && +op > 0.95) { opened = true; break; }
    }
    console.log('look-detail opened:', opened);
    // GSAP's lag smoothing runs the timeline at ~half speed under
    // headless WebGL fps — wait long enough to catch the settled article
    await sleep(7000);
    const detail = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync('.shots/look-detail.png', Buffer.from(detail.result.data, 'base64'));
    console.log('look-detail.png ok');

    // BACK button: click its REAL rect (hand-picked coords drift with
    // layout), then ESC as a fallback — the overlay must reverse and close
    let closed = false;
    const btn = await evalJs(
      `(() => { const b = document.querySelector('#look-detail button'); if (!b) return null; const r = b.getBoundingClientRect(); return JSON.stringify({ x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }); })()`,
    );
    console.log('back button at:', typeof btn === 'object' ? JSON.stringify(btn) : btn);
    if (btn && btn.startsWith('{')) {
      const bxy = JSON.parse(btn);
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: bxy.x, y: bxy.y, buttons: 0 });
      await sleep(300);
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: bxy.x, y: bxy.y, button: 'left', buttons: 1, clickCount: 1 });
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: bxy.x, y: bxy.y, button: 'left', buttons: 0, clickCount: 1 });
      for (let i = 0; i < 30; i++) {
        await sleep(400);
        if ((await evalJs(`!document.getElementById('look-detail')`)) === true) { closed = true; break; }
      }
    }
    if (!closed) {
      console.log('BACK missed, trying ESC');
      await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
      for (let i = 0; i < 30; i++) {
        await sleep(400);
        if ((await evalJs(`!document.getElementById('look-detail')`)) === true) { closed = true; break; }
      }
    }
    console.log('look-detail closed:', closed);
    if (!closed) throw new Error('look-detail stuck open — aborting so later phases are not poisoned');
    // re-park the pointer center so the close-click parallax doesn't
    // skew the following gallery/end screenshots
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 720, y: 450, buttons: 0 });
    await sleep(500);
    const after = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync('.shots/look-closed.png', Buffer.from(after.result.data, 'base64'));
    console.log('look-closed.png ok');
  }

  await setScroll(1);
  await settle(1);
  // the final leg (s2 0.68 → 1) still crosses several plane-steps and the
  // camera now eases temporally, so give both plenty of frames to converge
  await waitRest();
  await sleep(4000);
  const endOps = await evalJs(
    `(() => {
      const g = window.__dg && window.__dg.gallery;
      const cam = window.__dg && window.__dg.camera;
      if (!g || !cam) return 'n/a';
      const p = g.planes[g.planes.length - 1];
      return JSON.stringify({
        ops: g.planes.map((pl) => +pl.material.opacity.toFixed(2)).join(','),
        cam: [cam.position.x, cam.position.y, cam.position.z].map((v) => +v.toFixed(2)),
        last: [p.position.x, p.position.y, p.position.z].map((v) => +v.toFixed(2)),
        lastRot: [p.rotation.x, p.rotation.y].map((v) => +v.toFixed(3)),
        ptr: [g.pointerCurrent.x, g.pointerCurrent.y].map((v) => +v.toFixed(3)),
        breath: +g.breathIntensity.toFixed(3),
        drift: +g.driftCurrent.toFixed(3),
      });
    })()`,
  );
  console.log('gal-end state:', endOps);
  const galEnd = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync('.shots/gallery-end.png', Buffer.from(galEnd.result.data, 'base64'));
  console.log('gallery-end.png ok');

  // switch the pick to girl and come back — gallery must swap to her set
  await setScroll(0.195);
  await settle(0.195);
  await waitPointer('auto');
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 992, y: 450, button: 'left', buttons: 1, clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 992, y: 450, button: 'left', buttons: 0, clickCount: 1 });
  let setOk = false;
  for (let i = 0; i < 30; i++) {
    await sleep(400);
    const src = await gallerySet();
    if (typeof src === 'string' && src.includes('/girl')) {
      setOk = true;
      break;
    }
  }
  console.log('girl set swap:', setOk, await gallerySet());
  await setScroll(0.68);
  await settle(0.68);
  await waitRest();
  await probe('gal-girl:');
  const galGirl = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync('.shots/gallery-girl.png', Buffer.from(galGirl.result.data, 'base64'));
  console.log('gallery-girl.png ok');
  ws.close();
} catch (err) {
  console.error('failed:', err.message);
} finally {
  chrome.kill();
}


