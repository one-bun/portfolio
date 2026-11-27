// ---------- Live Toronto clock in the footer ----------
(function clock() {
  const el = document.getElementById("toronto-time");
  if (!el) return;
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Toronto", hour: "numeric", minute: "2-digit", hour12: true,
  });
  const tick = () => { el.textContent = fmt.format(new Date()).replace(/\s?(AM|PM)/, (_, p) => " " + p.toLowerCase()); };
  tick();
  setInterval(tick, 15000);
})();

// ---------- Photo puzzle: drag a tile to swap it with the next slot clockwise ----------
// Slots: 0 = top-left, 1 = top-right, 2 = bottom-left, 3 = bottom-right
// Clockwise: TL -> TR -> BR -> BL -> TL
(function puzzle() {
  const root = document.querySelector(".puzzle");
  if (!root) return;
  const POS = [ { left: 0, top: 0 }, { left: 75, top: 0 }, { left: 0, top: 76 }, { left: 75, top: 76 } ];
  const NEXT = { 0: 1, 1: 3, 3: 2, 2: 0 };
  const tiles = [...root.querySelectorAll(".tile")];

  const place = (tile, slot) => {
    tile.dataset.slot = slot;
    tile.style.left = POS[slot].left + "px";
    tile.style.top = POS[slot].top + "px";
  };
  tiles.forEach((t, i) => place(t, i));
  const tileAt = (slot) => tiles.find((t) => +t.dataset.slot === slot);

  const swapClockwise = (tile) => {
    const from = +tile.dataset.slot;
    const to = NEXT[from];
    const other = tileAt(to);
    place(tile, to);
    if (other) place(other, from);
  };

  tiles.forEach((tile) => {
    let start = null;
    let moved = false;

    tile.addEventListener("pointerdown", (e) => {
      start = { x: e.clientX, y: e.clientY };
      moved = false;
      tile.setPointerCapture(e.pointerId);
    });

    tile.addEventListener("pointermove", (e) => {
      if (!start) return;
      const dx = e.clientX - start.x, dy = e.clientY - start.y;
      if (!moved && Math.hypot(dx, dy) < 4) return;
      if (!moved) {
        moved = true;
        tile.classList.add("is-dragging");
        tileAt(NEXT[+tile.dataset.slot])?.classList.add("is-target");
      }
      const p = POS[+tile.dataset.slot];
      tile.style.left = p.left + dx + "px";
      tile.style.top = p.top + dy + "px";
    });

    const end = () => {
      if (!start) return;
      start = null;
      tile.classList.remove("is-dragging");
      tiles.forEach((t) => t.classList.remove("is-target"));
      if (moved) swapClockwise(tile);
      else place(tile, +tile.dataset.slot);
      justDragged = moved;
    };
    tile.addEventListener("pointerup", end);
    tile.addEventListener("pointercancel", end);

    // Click (or Enter / Space) flips the tile to its other photo, like the
    // Default <-> Variant2 "Change to" interaction in Figma. A drag doesn't flip.
    let justDragged = false;
    tile.addEventListener("click", () => {
      if (justDragged) { justDragged = false; return; }
      const flipped = tile.classList.toggle("is-flipped");
      tile.setAttribute("aria-pressed", String(flipped));
    });

    // Keyboard: arrow keys swap the focused tile clockwise
    tile.addEventListener("keydown", (e) => {
      if (e.key.startsWith("Arrow")) { e.preventDefault(); swapClockwise(tile); }
    });
  });
})();


// ---------- Pink pill that follows the cursor over case-study frames ----------
(function cursorPill() {
  const pill = document.querySelector(".cursor-pill");
  if (!pill || !matchMedia("(hover: hover)").matches) return;
  const OFFSET = 14; // sits just below-right of the pointer
  let x = 0, y = 0, cx = 0, cy = 0, raf = 0;
  const follow = () => {
    cx += (x - cx) * 0.35;
    cy += (y - cy) * 0.35;
    pill.style.transform = `translate(${cx + OFFSET}px, ${cy + OFFSET}px)`;
    raf = Math.abs(x - cx) + Math.abs(y - cy) > 0.1 ? requestAnimationFrame(follow) : 0;
  };
  const move = (e) => { x = e.clientX; y = e.clientY; if (!raf) raf = requestAnimationFrame(follow); };

  document.querySelectorAll("[data-cursor]").forEach((frame) => {
    frame.addEventListener("pointerenter", (e) => {
      pill.textContent = frame.dataset.cursor;
      x = cx = e.clientX; y = cy = e.clientY; // snap in place instead of flying across the page
      pill.style.transform = `translate(${cx + OFFSET}px, ${cy + OFFSET}px)`;
      pill.classList.add("is-visible");
    });
    frame.addEventListener("pointermove", move);
    // keep the text in sync if it changes mid-hover (e.g. play / pause on the album cover)
    frame.addEventListener("pointermove", () => { if (pill.textContent !== frame.dataset.cursor) pill.textContent = frame.dataset.cursor; });
    frame.addEventListener("pointerleave", () => pill.classList.remove("is-visible"));
  });
})();

// ---------- About: photo stack — click a photo to bring it to the front ----------
// Slots run back to front, each 34px right and 28px down from the last (as in Figma).
// The clicked photo moves to the front slot; the photos that were in front of it each step back one.
// Clicking the front photo sends it to the back, and the others each step forward one.
(function photoFan() {
  const root = document.querySelector(".photo-fan");
  if (!root) return;
  const order = [...root.querySelectorAll(".photo-fan__photo")]; // index 0 = back, last = front

  const layout = () => {
    order.forEach((photo, slot) => {
      photo.style.left = slot * 34 + "px";
      photo.style.top = slot * 28 + "px";
      photo.style.zIndex = slot + 1;
    });
  };
  layout();

  order.slice().forEach((photo) => {
    photo.addEventListener("click", () => {
      const i = order.indexOf(photo);
      order.splice(i, 1);
      if (i === order.length) order.unshift(photo); // was the front photo
      else order.push(photo);
      layout();
    });
  });
})();

// ---------- About: click the album art to play / pause the song ----------
// Uses Spotify's iFrame API with a hidden player. Visitors not logged in to Spotify get a 30s preview.
(function spotifyToggle() {
  const button = document.querySelector(".listening[data-spotify-uri]");
  const mount = document.getElementById("spotify-embed");
  if (!button || !mount) return;

  let controller = null;
  let started = false;
  let state = { isPaused: true, position: 0, duration: 0 };
  let playWhenReady = false;

  const setPlaying = (playing) => {
    button.setAttribute("aria-pressed", String(playing));
    button.setAttribute("aria-label", (playing ? "Pause" : "Play") + " Cross Your Mind on Spotify");
    button.dataset.cursor = (playing ? "❚❚ " : "▶ ") + "Cross Your Mind";
    const pill = document.querySelector(".cursor-pill");
    if (pill && button.matches(":hover")) pill.textContent = button.dataset.cursor;
  };

  const play = () => {
    const ended = state.duration && state.position >= state.duration - 500;
    if (!started || ended) controller.play();
    else controller.resume();
    started = true;
  };

  window.onSpotifyIframeApiReady = (IFrameAPI) => {
    IFrameAPI.createController(mount, { uri: button.dataset.spotifyUri, width: 300, height: 80 }, (c) => {
      controller = c;
      c.addListener("ready", () => {
        if (playWhenReady) { playWhenReady = false; play(); }
      });
      c.addListener("playback_update", (e) => {
        state = e.data;
        setPlaying(!e.data.isPaused);
      });
    });
  };

  button.addEventListener("click", () => {
    if (!controller) { playWhenReady = true; return; } // clicked before Spotify finished loading
    if (state.isPaused) play();
    else controller.pause();
  });
})();

// ---------- Footer: a subtle trail of little symbols that follows the cursor ----------
(function footerTrail() {
  const footer = document.querySelector(".footer");
  if (!footer || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const SYMBOLS = [".", "*", "%", "x", "&", "#", "!", "/", "@", "=", "?", "+", "^"];
  const MESSAGES = ["hiiii!", "hellooo!", "what's up?", ":3", "XD", ":P"];
  const SPACING = 22;          // px the cursor travels between symbols
  const MAX = 60;              // cap on plain symbols alive at once
  const MESSAGE_CHANCE = 0.06; // roughly 1 in 16 symbols becomes a message...
  const MESSAGE_GAP = 1800;    // ...but never more than one every 1.8s
  let last = null;
  let lastMessageAt = 0;

  const pick = (list) => list[Math.floor(Math.random() * list.length)];

  footer.addEventListener("pointermove", (e) => {
    const rect = footer.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (last && Math.hypot(x - last.x, y - last.y) < SPACING) return;
    last = { x, y };

    const now = performance.now();
    const isMessage = now - lastMessageAt > MESSAGE_GAP && Math.random() < MESSAGE_CHANCE;
    if (isMessage) lastMessageAt = now;

    const el = document.createElement("span");
    el.className = isMessage ? "trail-symbol trail-symbol--message" : "trail-symbol";
    el.setAttribute("aria-hidden", "true");
    el.textContent = isMessage ? pick(MESSAGES) : pick(SYMBOLS);
    el.style.setProperty("--x", x - 4 + "px");
    el.style.setProperty("--y", y - 6 + "px");
    el.style.setProperty("--dx", (Math.random() - 0.5) * 16 + "px");
    el.style.setProperty("--dy", 6 + Math.random() * 10 + "px");
    el.style.setProperty("--rot", (Math.random() - 0.5) * (isMessage ? 12 : 60) + "deg");
    el.addEventListener("animationend", () => el.remove());
    footer.appendChild(el);

    const trail = footer.querySelectorAll(".trail-symbol:not(.trail-symbol--message)");
    if (trail.length > MAX) trail[0].remove();
  });
  footer.addEventListener("pointerleave", () => { last = null; });
})();

// ---------- Case study menu: click to scroll to a section; the section in view gets the pink block ----------
(function caseStudyToc() {
  const links = [...document.querySelectorAll(".cs-toc__links a[href^='#']")];
  if (!links.length) return;
  const sections = links.map((a) => document.querySelector(a.getAttribute("href")));
  const smooth = !matchMedia("(prefers-reduced-motion: reduce)").matches;

  const setActive = (i) => {
    links.forEach((a, j) => {
      a.classList.toggle("is-active", j === i);
      if (j === i) a.setAttribute("aria-current", "true");
      else a.removeAttribute("aria-current");
    });
  };

  // Active = the last section whose top has passed 35% of the viewport (the last one once you hit the bottom)
  let ticking = false;
  const update = () => {
    ticking = false;
    const line = innerHeight * 0.35;
    let active = 0;
    sections.forEach((s, i) => { if (s && s.getBoundingClientRect().top <= line) active = i; });
    if (innerHeight + scrollY >= document.documentElement.scrollHeight - 4) active = sections.length - 1;
    setActive(active);
  };
  addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  addEventListener("resize", update);
  update();

  links.forEach((a, i) => {
    a.addEventListener("click", (e) => {
      const target = sections[i];
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
      history.replaceState(null, "", a.getAttribute("href"));
    });
  });
})();

// ---------- Home: the "Hi, I'm Ken Piquero!" header types itself out once ----------
(function typewriter() {
  const el = document.querySelector("[data-typewriter]");
  if (!el || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const text = el.textContent;
  const SPEED = 55;   // ms per character
  const START = 300;  // short pause before typing
  el.style.minHeight = el.offsetHeight + "px"; // no layout jump while it types

  const typed = document.createElement("span");
  typed.setAttribute("aria-hidden", "true");
  const caret = document.createElement("span");
  caret.className = "typewriter__caret";
  caret.setAttribute("aria-hidden", "true");
  el.textContent = "";
  el.append(typed, caret);

  const chars = [...text];
  let i = 0;
  const step = () => {
    typed.textContent = chars.slice(0, ++i).join("");
    if (i < chars.length) setTimeout(step, SPEED + Math.random() * 40); // slight human jitter
    else { document.dispatchEvent(new Event("typewriter:done")); }
    if (i >= chars.length) setTimeout(() => { caret.classList.add("is-done"); setTimeout(() => caret.remove(), 450); }, 1800);
  };
  setTimeout(step, START);
})();

// ---------- Home: bio and pills appear (staggered) once the header has typed out ----------
(function appearIntro() {
  const items = document.querySelectorAll(".appear");
  if (!items.length) return;
  let shown = false;
  const show = () => { if (shown) return; shown = true; items.forEach((el) => el.classList.add("is-in")); };
  const typing = document.querySelector("[data-typewriter]");
  if (!typing || matchMedia("(prefers-reduced-motion: reduce)").matches) { show(); return; }
  document.addEventListener("typewriter:done", () => setTimeout(show, 150), { once: true });
  setTimeout(show, 4000); // safety net
})();

// ---------- Case study: Version 1 / Version 2 toggle ----------
(function quizVersions() {
  const box = document.querySelector("[data-versions]");
  if (!box) return;
  const tabs = [...box.querySelectorAll(".cs-toggle__btn")];
  const summary = box.querySelector(".cs-versions__summary");
  const select = (tab) => {
    tabs.forEach((t) => {
      const on = t === tab;
      t.classList.toggle("is-on", on);
      t.setAttribute("aria-selected", on);
      const panel = document.getElementById(t.getAttribute("aria-controls"));
      panel.hidden = !on;
      if (on) { panel.classList.remove("is-entering"); void panel.offsetWidth; panel.classList.add("is-entering"); }
    });
    summary.textContent = summary.dataset[tab.id === "tab-v2" ? "v2" : "v1"];
  };
  tabs.forEach((t, i) => {
    t.addEventListener("click", () => select(t));
    t.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const next = tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
      next.focus(); select(next);
    });
  });
})();

// ---------- Case study: Insight 03 searches slide in and type themselves (24s loop, from the Figma timeline) ----------
(function keywordSearches() {
  const box = document.querySelector("[data-searches]");
  if (!box) return;
  const searches = [...box.querySelectorAll(".cs-search")];
  const rows = searches.map((s) => {
    const q = s.querySelector(".cs-search__q");
    const text = q.textContent;
    q.textContent = "";
    const chars = [...text].map((c) => {
      const span = document.createElement("span");
      span.className = "ch"; span.textContent = c; q.append(span);
      return span;
    });
    return { box: s, q, chars, cursor: s.querySelector(".cs-search__cursor"), theme: s.parentElement.querySelector(".cs-theme") };
  });

  // Reduced motion: show the finished state, no loop
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
    rows.forEach((r) => { r.box.classList.add("is-in"); r.theme.classList.add("is-in"); r.chars.forEach((c) => c.classList.add("is-in")); });
    return;
  }

  const LOOP = 24000;
  const BOX = [300, 1800, 3300, 4800];       // search bar slides up
  const TYPE = [650, 2150, 3650, 5150];      // typing starts
  const STEP = [50, 47.37, 56.25, 45];       // ms per character (each query types in ~0.9s)
  const THEME = [1550, 3050, 4550, 6050];    // theme pill slides in
  let timers = [];
  let visible = false, running = false;
  const at = (ms, fn) => timers.push(setTimeout(fn, ms));
  const moveCursor = (r, n) => {
    const last = r.chars[n - 1];
    r.cursor.style.translate = (last ? last.offsetLeft + last.offsetWidth : 0) + "px 0";
  };

  const reset = () => {
    timers.forEach(clearTimeout); timers = [];
    rows.forEach((r) => {
      r.box.classList.remove("is-in"); r.theme.classList.remove("is-in"); r.cursor.classList.remove("is-on");
      r.chars.forEach((c) => c.classList.remove("is-in")); moveCursor(r, 0);
    });
  };

  const play = () => {
    running = true;
    reset();
    rows.forEach((r, i) => {
      at(BOX[i], () => r.box.classList.add("is-in"));
      at(TYPE[i], () => r.cursor.classList.add("is-on"));
      r.chars.forEach((c, n) => at(TYPE[i] + STEP[i] * (n + 1), () => { c.classList.add("is-in"); moveCursor(r, n + 1); }));
      at(THEME[i], () => r.theme.classList.add("is-in"));
      if (i < rows.length - 1) at(TYPE[i] + 1000, () => r.cursor.classList.remove("is-on"));
    });
    // The last cursor blinks twice, then stays
    const last = rows[rows.length - 1].cursor;
    at(6150, () => last.classList.remove("is-on"));
    at(6600, () => last.classList.add("is-on"));
    at(7050, () => last.classList.remove("is-on"));
    at(7500, () => last.classList.add("is-on"));
    at(LOOP, () => { if (visible) play(); else running = false; });
  };

  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible && !running) play();
  }, { threshold: 0.35 }).observe(box);
})();

// ---------- Case study: pause the looping showreel and phone rail while they're off screen ----------
(function pauseOffscreenLoops() {
  const loops = document.querySelectorAll(".reel, .rail");
  if (!loops.length || !("IntersectionObserver" in window)) return;
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => e.target.classList.toggle("is-paused", !e.isIntersecting));
  });
  loops.forEach((el) => io.observe(el));
})();
