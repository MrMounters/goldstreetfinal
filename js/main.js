'use strict';

/* ─── 0. WATCHDOG ─────────────────────────────────────
   Unconditional safety net — clears the loader even if
   GSAP/Lenis fail to load from CDN (slow/blocked network).
   ──────────────────────────────────────────────────── */
setTimeout(() => {
  const l = document.getElementById('loader');
  if (l && !l.classList.contains('hidden')) {
    l.classList.add('hidden');
    setTimeout(() => { l.style.display = 'none'; }, 900);
    document.getElementById('nav')?.classList.add('visible');
    document.getElementById('scene-dots')?.classList.add('visible');
  }
}, 6000);

const SCENE_CONFIG = [
  {
    id: 1, vh: 400, vs: 0.00, ve: 0.16,
    overlays: [
      { sel: '.s1-eyebrow', type: 'fade-up', at: [0.10, 0.20], out: [0.75, 0.90] },
      { sel: '.s1-title',   type: 'fade-up', at: [0.15, 0.28], out: [0.75, 0.90], delay: 0.06 },
    ]
  },
  {
    id: 2, vh: 400, vs: 0.16, ve: 0.33,
    overlays: [
      { sel: '.s2-eyebrow', type: 'pills-stagger', at: [0.10, 0.28], out: [0.78, 0.92] },
      { sel: '.s2-title',   type: 'fade-up', at: [0.16, 0.30], out: [0.78, 0.92], delay: 0.06 },
      { sel: '.s2-sub',     type: 'fade-up', at: [0.22, 0.36], out: [0.78, 0.92], delay: 0.12 },
    ]
  },
  {
    id: 3, vh: 300, vs: 0.33, ve: 0.47,
    overlays: [
      { sel: '.s3-title', type: 'fade-up', at: [0.15, 0.32], out: [0.72, 0.92] },
      { sel: '.s3-line',  type: 'fade',    at: [0.22, 0.38], out: [0.72, 0.88], delay: 0.08 },
    ]
  },
  {
    id: 4, vh: 400, vs: 0.47, ve: 0.64,
    overlays: []
  },
  {
    id: 5, vh: 300, vs: 0.64, ve: 0.79,
    overlays: [
      { sel: '.s5-eyebrow', type: 'pills-stagger', at: [0.12, 0.30], out: [0.74, 0.90] },
      { sel: '.s5-title',   type: 'fade-up', at: [0.18, 0.34], out: [0.74, 0.90], delay: 0.08 },
    ]
  },
  {
    id: 6, vh: 300, vs: 0.79, ve: 0.94,
    overlays: [
      { sel: '.s6-word', type: 'scale-fade', at: [0.14, 0.38], out: [0.72, 0.94] },
    ]
  },
];

const video      = document.getElementById('scene-video');
const loader     = document.getElementById('loader');
const loaderBar  = document.querySelector('.loader__bar');
const loaderPct  = document.getElementById('loader-pct');
const nav        = document.getElementById('nav');
const progressEl = document.getElementById('scroll-progress');
const dotsEl     = document.getElementById('scene-dots');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ─── 1. LENIS + GSAP SYNC ────────────────────────────
   Use scrollerProxy so ScrollTrigger reads Lenis position
   instead of window.scrollY — fixes desktop drift.
   Wrapped in try/catch: a CDN failure must not crash init.
   ──────────────────────────────────────────────────── */
let lenis = null;

try {
  if (!reducedMotion) {
    lenis = new Lenis({
      lerp: 0.1,
      smoothWheel: true,
      syncTouch: false,
    });

    ScrollTrigger.scrollerProxy(document.documentElement, {
      scrollTop(value) {
        if (arguments.length) {
          lenis.scrollTo(value, { immediate: true });
        }
        return lenis.scroll;
      },
      getBoundingClientRect() {
        return { top: 0, left: 0, width: window.innerWidth, height: window.innerHeight };
      },
      pinType: document.documentElement.style.transform ? 'transform' : 'fixed',
    });

    lenis.on('scroll', () => ScrollTrigger.update());

    gsap.ticker.add((time) => {
      lenis.raf(time * 1000);
    });

    gsap.ticker.lagSmoothing(0);
  } else {
    window.addEventListener('scroll', () => ScrollTrigger.update(), { passive: true });
  }
} catch (err) {
  console.warn('Lenis/GSAP unavailable — falling back to native scroll.', err);
}

/* ─── 2. LOADER PROGRESS ──────────────────────────── */
function setLoaderProgress(pct) {
  const clamped = Math.min(Math.round(pct), 99);
  loaderBar.style.width = clamped + '%';
  if (loaderPct) loaderPct.textContent = clamped + '%';
}

let appInitialized = false;

function initAfterVideo() {
  if (appInitialized) return;
  appInitialized = true;

  loaderBar.style.width = '100%';
  if (loaderPct) loaderPct.textContent = '100%';
  loader.classList.add('hidden');
  setTimeout(() => { loader.style.display = 'none'; }, 900);
  nav.classList.add('visible');
  dotsEl.classList.add('visible');

  initTicker();
  initAmbient();
  initIdleReminder();

  if (typeof ScrollTrigger === 'undefined') return;
  try {
    ScrollTrigger.refresh();
    buildScenes();
    buildScrollProgress();
    buildWatermark();
    initPressShine();
  } catch (err) {
    console.warn('Scene scroll-binding failed.', err);
  }
}

video.addEventListener('progress', () => {
  if (!video.duration) return;
  try {
    const buf = video.buffered;
    if (buf.length) {
      const pct = (buf.end(buf.length - 1) / video.duration) * 100;
      setLoaderProgress(Math.min(pct, 90));
    }
  } catch (_) {}
});

video.addEventListener('canplaythrough', () => {
  setLoaderProgress(100);
  setTimeout(initAfterVideo, 400);
}, { once: true });

setTimeout(() => {
  if (loader.classList.contains('hidden')) return;
  setLoaderProgress(100);
  initAfterVideo();
}, 8000);

video.addEventListener('play', () => { video.pause(); }, { once: true });
video.load();

/* ─── 3. SCENE SCROLLTRIGGERS ──────────────────────── */
function computeAlpha(p, at, out, delay = 0) {
  let inAlpha = 0;
  if (p >= at[0] + delay && p <= at[1] + delay) {
    inAlpha = (p - (at[0] + delay)) / (at[1] - at[0]);
  } else if (p > at[1] + delay) {
    inAlpha = 1;
  }

  let outAlpha = 1;
  if (out && p >= out[0] && p <= out[1]) {
    outAlpha = 1 - (p - out[0]) / (out[1] - out[0]);
  } else if (out && p > out[1]) {
    outAlpha = 0;
  }

  return Math.max(0, Math.min(1, Math.min(inAlpha, outAlpha)));
}

function applyOverlayMotion(el, type, inAlpha, alpha) {
  el.style.opacity = alpha;

  if (type === 'fade-up') {
    el.style.transform = `translateY(${(1 - Math.min(inAlpha, 1)) * 22}px)`;
  }
  if (type === 'scale-fade') {
    el.style.transform = `scale(${0.88 + 0.12 * Math.min(inAlpha, 1)})`;
  }
}

function buildScenes() {
  const dur = video.duration || 1;

  SCENE_CONFIG.forEach((cfg) => {
    const scene = document.querySelector(`.scene--${cfg.id}`);
    if (!scene) return;

    const segStart = cfg.vs * dur;
    const segLen   = (cfg.ve - cfg.vs) * dur;

    ScrollTrigger.create({
      trigger: scene,
      start:   'top top',
      end:     'bottom bottom',
      scrub:   reducedMotion ? 0 : 0.8,
      onUpdate(self) {
        const t = segStart + self.progress * segLen;
        video.currentTime = Math.max(0, Math.min(dur, t));
      },
    });

    const dot = document.querySelector(`.dot[data-scene="${cfg.id}"]`);
    if (dot) {
      ScrollTrigger.create({
        trigger: scene,
        start:   'top 60%',
        end:     'bottom 40%',
        onEnter()     { activateDot(cfg.id); },
        onEnterBack() { activateDot(cfg.id); },
      });
    }

    cfg.overlays.forEach(({ sel, type, at, out, delay = 0 }) => {
      const el = scene.querySelector(sel);
      if (!el) return;

      ScrollTrigger.create({
        trigger: scene,
        start:   'top top',
        end:     'bottom bottom',
        scrub:   true,
        onUpdate(self) {
          const p = self.progress;

          if (type === 'pills-stagger') {
            const pills = el.querySelectorAll('.eyebrow-pill');
            const containerAlpha = computeAlpha(p, at, out, delay);
            el.style.opacity = containerAlpha;

            pills.forEach((pill, index) => {
              const pillDelay = delay + index * 0.08;
              const pillInAlpha = computeAlpha(p, at, out, pillDelay);
              const pillAlpha = Math.min(containerAlpha, pillInAlpha);
              pill.style.opacity = pillAlpha;
              pill.style.transform = `translateY(${(1 - Math.min(pillInAlpha, 1)) * 14}px)`;
            });
            return;
          }

          const inAlpha = computeAlpha(p, at, out, delay);
          let rawInAlpha = 0;
          if (p >= at[0] + delay && p <= at[1] + delay) {
            rawInAlpha = (p - (at[0] + delay)) / (at[1] - at[0]);
          } else if (p > at[1] + delay) {
            rawInAlpha = 1;
          }
          applyOverlayMotion(el, type, rawInAlpha, inAlpha);
        },
      });
    });
  });
}

/* ─── 4. SCROLL PROGRESS BAR ─────────────────────── */
function buildScrollProgress() {
  ScrollTrigger.create({
    trigger: document.body,
    start: 'top top',
    end: 'bottom bottom',
    onUpdate(self) {
      progressEl.style.height = (self.progress * 100) + '%';
    }
  });
}

/* ─── 5. CTA REVEAL ──────────────────────────────── */
function buildCTA() {
  if (typeof ScrollTrigger === 'undefined' || typeof gsap === 'undefined') return;
  const copy = document.querySelector('.cta__copy');
  if (copy) {
    ScrollTrigger.create({
      trigger: copy,
      start: 'top 80%',
      once: true,
      onEnter() {
        gsap.to(copy, { opacity: 1, y: 0, duration: 1, ease: 'power3.out', delay: 0.2 });
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', buildCTA);

/* ─── 6. DOTS ────────────────────────────────────── */
function activateDot(sceneId) {
  document.querySelectorAll('.dot').forEach((d) => {
    d.classList.toggle('active', +d.dataset.scene === sceneId);
  });
}

/* ─── 7. NAV MENU TOGGLE ─────────────────────────── */
const burger = document.getElementById('nav-burger');
const navMenu = document.getElementById('nav-menu');

if (burger && navMenu) {
  burger.addEventListener('click', () => {
    const isOpen = navMenu.classList.toggle('open');
    burger.setAttribute('aria-expanded', String(isOpen));
  });

  navMenu.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      navMenu.classList.remove('open');
      burger.setAttribute('aria-expanded', 'false');
    });
  });

  document.addEventListener('click', (e) => {
    if (!navMenu.classList.contains('open')) return;
    if (!navMenu.contains(e.target) && e.target !== burger) {
      navMenu.classList.remove('open');
      burger.setAttribute('aria-expanded', 'false');
    }
  });
}

/* ─── 7c. IN-PAGE ANCHOR SCROLL ───────────────────────
   Lenis drives actual scroll position via ScrollTrigger's
   scrollerProxy, so a native browser anchor-jump fights it and
   lands in the wrong spot. Route hash links through lenis.scrollTo()
   instead, offset by the fixed ticker+nav height so the destination
   isn't hidden underneath them.
   ──────────────────────────────────────────────────── */
function scrollToHash(hash) {
  const target = document.querySelector(hash);
  if (!target) return;

  const tickerEl = document.getElementById('ticker');
  const headerHeight = (tickerEl?.offsetHeight || 0) + (nav?.offsetHeight || 0);

  if (lenis) {
    lenis.scrollTo(target, { offset: -headerHeight, duration: 1.4 });
  } else {
    const top = target.getBoundingClientRect().top + window.scrollY - headerHeight;
    window.scrollTo({ top, behavior: 'smooth' });
  }
}

document.querySelectorAll('.nav__cta, .nav__menu-link').forEach((link) => {
  link.addEventListener('click', (e) => {
    const hash = link.getAttribute('href');
    if (!hash || hash.charAt(0) !== '#') return;
    e.preventDefault();
    scrollToHash(hash);
  });
});

/* ─── 8. WATERMARK ───────────────────────────────── */
function buildWatermark() {
  const wm = document.getElementById('gs-watermark');
  if (!wm || reducedMotion) return;

  SCENE_CONFIG.forEach((cfg) => {
    const scene = document.querySelector(`.scene--${cfg.id}`);
    if (!scene) return;

    ScrollTrigger.create({
      trigger: scene,
      start: 'top 75%',
      end: 'bottom 25%',
      onEnter:     () => gsap.to(wm, { opacity: 0.038, duration: 1.1, ease: 'power2.out' }),
      onLeave:     () => gsap.to(wm, { opacity: 0.012, duration: 0.7, ease: 'power2.out' }),
      onEnterBack: () => gsap.to(wm, { opacity: 0.038, duration: 1.1, ease: 'power2.out' }),
      onLeaveBack: () => gsap.to(wm, { opacity: 0.012, duration: 0.7, ease: 'power2.out' }),
    });
  });
}

/* ─── 7b. LIVE MARKET TICKER ──────────────────────── */
function renderTickerItems(indices) {
  const sets = document.querySelectorAll('.ticker__set');
  if (!sets.length) return;

  const itemsHtml = indices.map(({ name, price, changePercent }) => {
    const isUp = (changePercent ?? 0) >= 0;
    const sign = isUp ? '+' : '−';
    const pct = Math.abs(changePercent ?? 0).toFixed(2);
    const priceStr = price.toLocaleString('en-US', { maximumFractionDigits: 2 });

    return `
      <span class="ticker__item">
        <span class="ticker__name">${name}</span>
        <span class="ticker__price">${priceStr}</span>
        <span class="ticker__change ${isUp ? 'ticker__change--up' : 'ticker__change--down'}">${sign}${pct}%</span>
      </span>
    `;
  }).join('');

  sets.forEach((set) => { set.innerHTML = itemsHtml; });
}

function initTicker() {
  const track = document.getElementById('ticker-track');
  if (!track) return;

  const fetchIndices = () => {
    fetch('/api/indices')
      .then((r) => r.json())
      .then((data) => {
        if (data && Array.isArray(data.indices) && data.indices.length) {
          renderTickerItems(data.indices);
        }
      })
      .catch(() => { /* keep last-known values on failure */ });
  };

  fetchIndices();
  setInterval(fetchIndices, 60000);
}

/* ─── 8b. PRESS STRIP SHINE ───────────────────────── */
function initPressShine() {
  const label = document.querySelector('.press-strip__label');
  const link  = document.querySelector('.press-social-link');
  if (!label && !link) return;

  ScrollTrigger.create({
    trigger: '.press-strip',
    start: 'top 85%',
    once: true,
    onEnter() {
      if (label) label.classList.add('shine-once');
      if (link) link.classList.add('shine-once');
    },
  });
}

/* ─── 9. IDLE SCROLL REMINDER ─────────────────────── */
function initIdleReminder() {
  const arrow = document.getElementById('scroll-arrow');
  if (!arrow) return;

  const IDLE_DELAY = 2200;
  const INTRO_DURATION = 5000;
  let idleTimer = null;

  const markActive = () => {
    arrow.classList.remove('idle');
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      arrow.classList.add('idle');
    }, IDLE_DELAY);
  };

  if (lenis) {
    lenis.on('scroll', markActive);
  } else {
    window.addEventListener('scroll', markActive, { passive: true });
  }

  // Bold entrance on first reveal — settles into the quiet idle-only
  // reminder above once the intro window elapses, regardless of
  // whether the visitor has scrolled yet.
  arrow.classList.add('intro');
  setTimeout(() => {
    arrow.classList.remove('intro');
    markActive();
  }, INTRO_DURATION);
}

/* ─── 10. AMBIENT SOUND ──────────────────────────── */
function initAmbient() {
  const toggle = document.getElementById('ambient-toggle');
  const audio  = document.getElementById('ambient-audio');
  const label  = toggle?.querySelector('.ambient-toggle__label');
  if (!toggle || !audio) return;

  toggle.hidden = false;
  toggle.classList.add('ambient-toggle--pulse');

  toggle.addEventListener('click', async () => {
    try {
      if (audio.paused) {
        audio.volume = 0.35;
        await audio.play();
        toggle.classList.add('is-on');
        toggle.classList.remove('ambient-toggle--pulse');
        toggle.setAttribute('aria-pressed', 'true');
        toggle.setAttribute('aria-label', 'Mute ambient sound');
        if (label) label.textContent = 'On';
      } else {
        audio.pause();
        toggle.classList.remove('is-on');
        toggle.classList.add('ambient-toggle--pulse');
        toggle.setAttribute('aria-pressed', 'false');
        toggle.setAttribute('aria-label', 'Unmute ambient sound');
        if (label) label.textContent = 'Unmute';
      }
    } catch (_) {}
  });
}

/* ─── 11. RESIZE ─────────────────────────────────── */
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (typeof ScrollTrigger !== 'undefined') ScrollTrigger.refresh();
  }, 250);
});
