'use strict';

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
      { sel: '.s2-eyebrow', type: 'fade-up', at: [0.10, 0.22], out: [0.78, 0.92] },
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
      { sel: '.s5-eyebrow', type: 'fade-up', at: [0.12, 0.26], out: [0.74, 0.90] },
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

/* ─── 1. LENIS + GSAP SYNC ────────────────────────────
   Use scrollerProxy so ScrollTrigger reads Lenis position
   instead of window.scrollY — fixes desktop drift.
   ──────────────────────────────────────────────────── */
const lenis = new Lenis({
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
  ScrollTrigger.refresh();
  buildScenes();
  buildScrollProgress();
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

// Fallback at 8s
setTimeout(() => {
  if (loader.classList.contains('hidden')) return;
  setLoaderProgress(100);
  initAfterVideo();
}, 8000);

// Pause on first play — scroll scrubbing controls currentTime
video.addEventListener('play', () => { video.pause(); }, { once: true });

video.load();

/* ─── 3. SCENE SCROLLTRIGGERS ────────────────────────
   Each section scrubs the video + animates overlays.
   ──────────────────────────────────────────────────── */
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
      scrub:   0.8,
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

          let inAlpha = 0;
          if (p >= at[0] + delay && p <= at[1] + delay) {
            inAlpha = (p - (at[0] + delay)) / ((at[1] - at[0]));
          } else if (p > at[1] + delay) {
            inAlpha = 1;
          }

          let outAlpha = 1;
          if (out && p >= out[0] && p <= out[1]) {
            outAlpha = 1 - (p - out[0]) / (out[1] - out[0]);
          } else if (out && p > out[1]) {
            outAlpha = 0;
          }

          const alpha   = Math.max(0, Math.min(1, Math.min(inAlpha, outAlpha)));
          el.style.opacity = alpha;

          if (type === 'fade-up') {
            el.style.transform = `translateY(${(1 - Math.min(inAlpha, 1)) * 22}px)`;
          }
          if (type === 'scale-fade') {
            el.style.transform = `scale(${0.88 + 0.12 * Math.min(inAlpha, 1)})`;
          }
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

/* ─── 7. RESIZE ──────────────────────────────────── */
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => ScrollTrigger.refresh(), 250);
});
