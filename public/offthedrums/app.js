(() => {
  "use strict";

  const stage = document.getElementById("stage");
  const track = document.getElementById("track");
  const proxy = document.getElementById("proxy");
  const nextBtn = document.getElementById("next");
  const curEl = document.getElementById("cur");
  const totEl = document.getElementById("tot");
  const dotsWrap = document.getElementById("dots");
  const indicator = document.getElementById("indicator");
  const page = document.querySelector(".page");
  const rope = document.getElementById("rope");
  const ropeShadow = document.getElementById("ropeShadow");
  const ropePath = document.getElementById("ropePath");
  const ropeHi = document.getElementById("ropeHi");
  const knotL = document.getElementById("knotL");
  const knotR = document.getElementById("knotR");
  const searchTrigger = document.getElementById("searchTrigger");
  const searchWrap = document.getElementById("search");
  const searchInput = document.getElementById("searchInput");
  const searchResults = document.getElementById("searchResults");
  const searchEmpty = document.getElementById("searchEmpty");
  let searchOpen = false;
  let searchActive = 0;
  let searchMatches = [];

  const PER_SET = 8;
  const SETS = 5;
  const pad = (n) => String(n).padStart(2, "0");

  const JOBS = [
    {
      tilt: -1.25,
      html: `
        <div class="sheet sheet--wol">
          <div class="wol__meta"><span>A3 · 170GSM</span><span>RISO 2C</span></div>
          <h2 class="wol__title">Water<br>of Leith<br>Festival</h2>
          <svg class="wol__waves" viewBox="0 0 300 52" preserveAspectRatio="none" aria-hidden="true">
            <path d="M0 8C18 -2 32 18 50 8S82 -2 100 8S132 18 150 8S182 -2 200 8S232 18 250 8S282 -2 300 8"/>
            <path d="M0 20C18 10 32 30 50 20S82 10 100 20S132 30 150 20S182 10 200 20S232 30 250 20S282 10 300 20"/>
            <path d="M0 32C18 22 32 42 50 32S82 22 100 32S132 42 150 32S182 22 200 32S232 42 250 32S282 22 300 32"/>
            <path d="M0 44C18 34 32 54 50 44S82 34 100 44S132 54 150 44S182 34 200 44S232 54 250 44S282 34 300 44"/>
          </svg>
          <div class="wol__foot"><span>SAT 12 JUL</span><span>LEITH LINKS</span></div>
        </div>`,
    },
    {
      tilt: 0.9,
      html: `
        <div class="sheet sheet--fen">
          <div class="fen__top"><span>FENNICK</span><span>A2 · 300GSM</span></div>
          <div class="fen__photo" aria-hidden="true"></div>
          <div class="fen__title">Fennick<br>Gallery</div>
          <div class="fen__foot"><span>PRINT PULL / 04</span><span>ED. 30</span></div>
        </div>`,
    },
    {
      tilt: -0.7,
      html: `
        <div class="sheet sheet--house">
          <div class="house__top"><span>HOUSE COLOUR</span><span>VOL. 02</span></div>
          <div class="house__num">412</div>
          <div class="house__foot"><span>Jobs through<br>drum two</span><span>Riso<br>green</span></div>
        </div>`,
    },
    {
      tilt: 1.2,
      html: `
        <div class="sheet sheet--saltire">
          <div class="salt__frame">
            <div class="salt__series">SALTIRE BOOKS · POETRY</div>
            <div class="salt__title"><em>salt</em><span>poems<br>01—12</span></div>
            <div class="salt__foot"><span>B5</span><span>£8</span></div>
          </div>
        </div>`,
    },
    {
      tilt: -1.1,
      html: `
        <div class="sheet sheet--ailsa">
          <div class="ailsa__frame">
            <div class="ailsa__kicker">TOGETHER WITH THEIR FAMILIES</div>
            <div class="ailsa__names">Ailsa<i>&amp;</i>Tom</div>
            <div class="ailsa__place">PORT OBELLO · 04.10.26</div>
            <div class="ailsa__foot"><span>HAND-SET INVITES</span><span>A6 · 600GSM</span></div>
          </div>
        </div>`,
    },
    {
      tilt: 0.7,
      html: `
        <div class="sheet sheet--granton">
          <div class="granton__photo" aria-hidden="true"></div>
          <div class="granton__title">Granton<br>Darkroom</div>
          <div class="granton__foot"><span>PHOTO ZINE</span><span>A5 · 32PP</span></div>
        </div>`,
    },
    {
      tilt: -1.35,
      html: `
        <div class="sheet sheet--bow">
          <div class="bow__top"><span>BOW STREET</span><span>A7</span></div>
          <div class="bow__grid">
            <span class="tag">3.50</span><span class="tag tag--y">Nº4</span>
            <span class="tag tag--y">£1</span><span class="tag">/ EA</span>
            <span class="tag">PAINT</span><span class="tag tag--y">½&quot;</span>
          </div>
          <div class="bow__name">Hardware<br>Price cards</div>
          <div class="bow__foot"><span>PRICE CARDS</span><span>A7 · 350GSM</span></div>
        </div>`,
    },
    {
      tilt: 0.55,
      html: `
        <div class="sheet sheet--job">
          <div class="job__kicker">OFF THE DRUMS · BOOKING</div>
          <div class="job__title">Your<br>job<br>next</div>
          <div class="job__row">
            <span class="job__cta">BOOK A SLOT</span>
            <span class="job__arrow" aria-hidden="true">↗</span>
          </div>
          <div class="job__foot"><span>YOU · NEXT</span><span>08 / 08</span></div>
        </div>`,
    },
  ];

  const pinMarkup =
    '<span class="pin" aria-hidden="true"><span class="pin__spring"></span></span>';

  const cards = [];
  const frag = document.createDocumentFragment();
  for (let s = 0; s < SETS; s += 1) {
    for (let i = 0; i < PER_SET; i += 1) {
      const card = document.createElement("article");
      card.className = "card";
      card.dataset.g = String(s * PER_SET + i);
      card.dataset.tilt = String(JOBS[i].tilt);
      card.dataset.factor = (0.78 + (((i * 37) % 23) / 23) * 0.34).toFixed(3);
      card.dataset.phase = (i * 0.9 + s * 0.31).toFixed(3);
      card.style.transform = `rotate(${JOBS[i].tilt}deg)`;
      card.innerHTML = pinMarkup + JOBS[i].html;
      frag.appendChild(card);
      cards.push(card);
    }
  }
  track.appendChild(frag);
  totEl.textContent = pad(PER_SET);

  const dots = [];
  for (let i = 0; i < PER_SET; i += 1) {
    const dot = document.createElement("button");
    dot.type = "button";
    dot.className = "progress__dot";
    dot.setAttribute("aria-label", `Go to job ${pad(i + 1)}`);
    dot.addEventListener("click", () => jumpTo(i));
    dotsWrap.appendChild(dot);
    dots.push(dot);
  }

  let stride = 1;
  let period = 1;
  let base = 0;
  let x0 = 0;
  let cardWidth = 1;
  let stageW = 1;
  let ropeBase = 46;
  let lastIdx = -1;
  let targetK = null;
  let snapTween = null;
  let wheelTarget = null;
  let wheelIdle = 0;
  let prevX = 0;
  let primed = false;
  const sway = { a: 0, v: 0 };
  const sag = { a: 12, v: 0 };

  const getX = () => Number(gsap.getProperty(proxy, "x")) || 0;
  const wrapX = (px) => gsap.utils.wrap(-period, 0, px);
  const mod = (n, m) => ((n % m) + m) % m;

  function render(px, time) {
    const x = x0 + wrapX(px);
    track.style.transform = `translate3d(${x.toFixed(2)}px, 0, 0)`;

    const k = (base - x) / stride;
    const t = time === undefined ? performance.now() / 1000 : time;
    const swayDeg = sway.a * 57.29578;

    for (let i = 0; i < cards.length; i += 1) {
      const card = cards[i];
      const g = Number(card.dataset.g);
      const d = Math.abs(g - k);
      const scale = 1 - Math.min(d, 1.6) * 0.035;
      const opacity = Math.max(0, 1 - Math.min(d, 2.5) * 0.2);

      const center = g * stride + cardWidth / 2 + x;
      const u = Math.max(0, Math.min(1, center / stageW));
      const hang = 4 * sag.a * u * (1 - u);

      const factor = Number(card.dataset.factor);
      const idle = Math.sin(t * 0.9 + Number(card.dataset.phase)) * 0.06;
      const angle = Math.max(
        -8,
        Math.min(8, Number(card.dataset.tilt) + swayDeg * factor + idle)
      );

      card.style.transform = `translate3d(0, ${hang.toFixed(2)}px, 0) rotate(${angle.toFixed(3)}deg) scale(${scale.toFixed(4)})`;
      card.style.opacity = opacity.toFixed(3);
    }

    updateHud(k);
  }

  function updateHud(k) {
    const idx = mod(Math.round(k), PER_SET);
    if (idx === lastIdx) return;
    lastIdx = idx;

    curEl.textContent = pad(idx + 1);
    for (let i = 0; i < dots.length; i += 1) {
      dots[i].classList.toggle("is-active", i === idx);
    }
    const dot = dots[idx];
    if (dot) indicator.style.left = `${dot.offsetLeft + dot.offsetWidth / 2}px`;
  }

  function measure() {
    cardWidth = cards[0].offsetWidth;
    const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
    stride = cardWidth + gap;
    period = stride * PER_SET;
    stageW = stage.clientWidth;
    base = stageW / 2 - cardWidth / 2;
    x0 = base - period * 2;
    ropeBase =
      parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--rope-y")) || 46;
    rope.setAttribute("viewBox", `0 0 ${stageW} 160`);
    prevX = x0 + wrapX(getX());
    primed = true;
    sway.a *= 0.5;
    sway.v *= 0.5;
    drawRope();
    render(getX());
  }

  function drawRope() {
    const mid = ropeBase + sag.a * 2;
    const d = `M0 ${ropeBase} Q ${stageW / 2} ${mid} ${stageW} ${ropeBase}`;
    ropePath.setAttribute("d", d);
    ropeHi.setAttribute("d", d);
    ropeShadow.setAttribute("d", d);
    knotL.setAttribute("cx", "0");
    knotL.setAttribute("cy", String(ropeBase));
    knotR.setAttribute("cx", String(stageW));
    knotR.setAttribute("cy", String(ropeBase));
  }

  function tick(time, deltaTime) {
    const dt = Math.min(0.05, Math.max(0.001, deltaTime / 1000));
    const x = x0 + wrapX(getX());

    let vx = 0;
    if (primed) {
      vx = (x - prevX) / dt;
      if (Math.abs(x - prevX) > period * 0.5) vx = 0;
      prevX = x;
    }
    vx = Math.max(-4000, Math.min(4000, vx));

    sway.v += (-vx * 0.0011 - sway.a * 30 - sway.v * 6.5) * dt;
    sway.a = Math.max(-0.13, Math.min(0.13, sway.a + sway.v * dt));

    const target = 12 + Math.min(Math.abs(vx), 3200) * 0.0016 + Math.abs(sway.a) * 14;
    sag.v += ((target - sag.a) * 55 - sag.v * 7) * dt;
    sag.a += sag.v * dt;
    if (sag.a < 7) {
      sag.a = 7;
      sag.v = Math.abs(sag.v) * 0.35;
    }

    drawRope();
    render(getX(), time * 0.001);
  }

  function snap() {
    const px = getX();
    const vis = x0 + wrapX(px);
    const k = Math.round((base - vis) / stride);
    const delta = base - k * stride - vis;

    targetK = k;
    snapTween && snapTween.kill();
    snapTween = gsap.to(proxy, {
      x: px + delta,
      duration: 0.55,
      ease: "power3.out",
      overwrite: true,
    });
  }

  function goTo(kTarget) {
    const px = getX();
    const vis = x0 + wrapX(px);
    const delta = base - kTarget * stride - vis;

    targetK = kTarget;
    wheelTarget = null;
    snapTween && snapTween.kill();
    snapTween = gsap.to(proxy, {
      x: px + delta,
      duration: 0.6,
      ease: "power3.inOut",
      overwrite: true,
    });
  }

  function currentK() {
    const vis = x0 + wrapX(getX());
    return targetK !== null ? targetK : Math.round((base - vis) / stride);
  }

  function step(dir) {
    goTo(currentK() + dir);
  }

  function jumpTo(index) {
    let d = index - mod(currentK(), PER_SET);
    if (d > PER_SET / 2) d -= PER_SET;
    if (d < -PER_SET / 2) d += PER_SET;
    goTo(currentK() + d);
  }

  const SEARCH_META = [
    { title: "Water of Leith Festival", meta: "A3 · 170GSM", tags: ["poster", "festival", "leith", "riso", "yellow"] },
    { title: "Fennick Gallery", meta: "A2 · 300GSM", tags: ["exhibition", "print pull", "photo", "black"] },
    { title: "House Colour", meta: "412 jobs · drum two", tags: ["riso", "green", "zine", "412"] },
    { title: "Saltire Books", meta: "B5 · Poetry", tags: ["book", "cover", "poems", "blue"] },
    { title: "Ailsa & Tom, Portobello", meta: "A6 · 600GSM", tags: ["wedding", "invites", "letterpress", "hand-set"] },
    { title: "Granton Darkroom", meta: "A5 · 32pp", tags: ["photo", "zine", "darkroom", "mono"] },
    { title: "Bow Street Hardware", meta: "A7 · Price cards", tags: ["hardware", "tags", "paint", "price"] },
    { title: "Your Job Next", meta: "Booking", tags: ["quote", "print", "book", "cta"] },
  ];

  const haystack = (job) => `${job.title} ${job.meta} ${job.tags.join(" ")}`.toLowerCase();

  function renderResults(query) {
    const q = query.trim().toLowerCase();
    searchMatches = SEARCH_META.map((job, index) => ({ job, index })).filter(
      ({ job }) => !q || haystack(job).includes(q)
    );
    searchActive = 0;
    searchResults.innerHTML = searchMatches
      .map(
        ({ job, index }, i) => `
        <li class="search__item" role="option" data-job="${index}" aria-selected="${i === 0}">
          <span class="search__num">${pad(index + 1)}</span>
          <span class="search__title">${job.title}</span>
          <span class="search__meta">${job.meta}</span>
        </li>`
      )
      .join("");
    searchEmpty.hidden = searchMatches.length > 0;
    searchEmpty.querySelector("span").textContent = query.trim();
    paintSelection();
  }

  function paintSelection() {
    const items = searchResults.children;
    for (let i = 0; i < items.length; i += 1) {
      const on = i === searchActive;
      items[i].classList.toggle("is-active", on);
      items[i].setAttribute("aria-selected", on ? "true" : "false");
    }
    const el = items[searchActive];
    if (el) el.scrollIntoView({ block: "nearest" });
  }

  function openSearch() {
    if (searchOpen) return;
    searchOpen = true;
    searchWrap.hidden = false;
    searchTrigger.setAttribute("aria-expanded", "true");
    searchInput.value = "";
    renderResults("");
    requestAnimationFrame(() => searchInput.focus());
  }

  function closeSearch(refocus = true) {
    if (!searchOpen) return;
    searchOpen = false;
    searchWrap.hidden = true;
    searchTrigger.setAttribute("aria-expanded", "false");
    if (refocus) searchTrigger.focus({ preventScroll: true });
  }

  function flash(index) {
    const x = x0 + wrapX(getX());
    let best = null;
    let bestD = Infinity;
    for (const card of cards) {
      const g = Number(card.dataset.g);
      if (mod(g, PER_SET) !== index) continue;
      const d = Math.abs(g * stride + cardWidth / 2 + x - stageW / 2);
      if (d < bestD) {
        bestD = d;
        best = card;
      }
    }
    if (!best) return;
    cards.forEach((card) => card.classList.remove("is-found"));
    best.classList.add("is-found");
    setTimeout(() => best.classList.remove("is-found"), 1700);
  }

  function chooseJob(index) {
    closeSearch(false);
    jumpTo(index);
    setTimeout(() => flash(index), 640);
  }

  searchTrigger.addEventListener("click", () => {
    if (searchOpen) closeSearch();
    else openSearch();
  });
  searchWrap.addEventListener("pointerdown", (e) => {
    if (e.target === searchWrap) closeSearch();
  });
  searchInput.addEventListener("input", () => renderResults(searchInput.value));
  searchResults.addEventListener("click", (e) => {
    const item = e.target.closest(".search__item");
    if (item) chooseJob(Number(item.dataset.job));
  });
  searchResults.addEventListener("pointermove", (e) => {
    const item = e.target.closest(".search__item");
    if (!item) return;
    const idx = Array.prototype.indexOf.call(searchResults.children, item);
    if (idx !== -1 && idx !== searchActive) {
      searchActive = idx;
      paintSelection();
    }
  });
  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!searchMatches.length) return;
      const dir = e.key === "ArrowDown" ? 1 : -1;
      searchActive = (searchActive + dir + searchMatches.length) % searchMatches.length;
      paintSelection();
    } else if (e.key === "Enter") {
      e.preventDefault();
      const match = searchMatches[searchActive];
      if (match) chooseJob(match.index);
    } else if (e.key === "Escape") {
      e.preventDefault();
      closeSearch();
    }
  });

  Draggable.create(proxy, {
    trigger: stage,
    type: "x",
    inertia: true,
    allowNativeTouchScrolling: false,
    cursor: "grab",
    activeCursor: "grabbing",
    onPress() {
      snapTween && snapTween.kill();
      wheelTarget = null;
      targetK = null;
      stage.classList.add("is-dragging");
    },
    onDrag() {
      render(getX());
    },
    onThrowUpdate() {
      render(getX());
    },
    onDragEnd() {
      stage.classList.remove("is-dragging");
      if (!this.isThrowing) snap();
    },
    onThrowComplete() {
      stage.classList.remove("is-dragging");
      snap();
    },
  });

  function onWheel(e) {
    if (e.ctrlKey) return;
    e.preventDefault();

    snapTween && snapTween.kill();
    targetK = null;

    const raw = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    const boost = e.deltaMode === 1 ? 18 : 1;

    if (wheelTarget === null) wheelTarget = getX();
    wheelTarget -= raw * boost * 2.4;

    gsap.to(proxy, {
      x: wheelTarget,
      duration: 0.42,
      ease: "power2.out",
      overwrite: true,
    });

    clearTimeout(wheelIdle);
    wheelIdle = setTimeout(() => {
      wheelTarget = null;
      snap();
    }, 150);
  }

  page.addEventListener("wheel", onWheel, { passive: false });

  nextBtn.addEventListener("click", () => step(1));
  window.addEventListener("keydown", (e) => {
    if (searchOpen) {
      if (e.key === "Escape") {
        e.preventDefault();
        closeSearch();
      }
      return;
    }

    if (e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      openSearch();
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      openSearch();
      return;
    }

    if (e.key === "ArrowRight") {
      e.preventDefault();
      step(1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      step(-1);
    }
  });

  let downX = 0;
  let downY = 0;
  let downTarget = null;
  stage.addEventListener("pointerdown", (e) => {
    downX = e.clientX;
    downY = e.clientY;
    downTarget = e.target instanceof Element ? e.target : null;
  });
  stage.addEventListener("pointerup", (e) => {
    const moved = Math.abs(e.clientX - downX) + Math.abs(e.clientY - downY);
    const card = downTarget && downTarget.closest(".card");
    if (moved < 8 && card) {
      const idx = mod(Number(card.dataset.g), PER_SET);
      window.location.href = `./ribbon/index.html?job=${idx}`;
      return;
    }
    const u = Math.max(0, Math.min(1, e.clientX / stageW));
    const ropeY =
      stage.getBoundingClientRect().top + ropeBase + 4 * sag.a * u * (1 - u);
    if (moved < 8 && Math.abs(e.clientY - ropeY) < 22) step(1);
  });

  let resizeIdle = 0;
  window.addEventListener("resize", () => {
    clearTimeout(resizeIdle);
    resizeIdle = setTimeout(() => {
      measure();
      snap();
    }, 120);
  });

  measure();
  gsap.ticker.add(tick);
  requestAnimationFrame(() => {
    measure();
    snap();
  });
})();
