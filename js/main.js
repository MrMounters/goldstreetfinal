/**
 * HARTWELL EXEC — Cinematic Scrollytelling
 * Architecture: Lenis → GSAP ScrollTrigger → Video scrub
 *
 * Flow:
 *   1. Lenis smooth scroll initialised, ticked by GSAP
 *   2. Video preloads; loader shows progress
 *   3. On video ready → loader fades, ScrollTriggers activate
 *   4. Each scene ScrollTrigger scrubs video.currentTime
 *   5. Overlay text animations tied to per-scene scroll progress
 */

'use strict';

/* ────────────────────────────────────────────────
   CONSTANTS
   ──────────────────────────────────────────────── */
const SCENE_CONFIG = [
  // { id, scrollHeight (vh), videoStart%, videoEnd%, overlays[] }
  {
    id: 1,
    vh: 400,
    vs: 0.00, ve: 0.16,
    overlays: [
      { sel: '.s1-eyebrow', type: 'fade-up', at: [0.10, 0.20], out: [0.75, 0.90] },
      { sel: '.s1-title',   type: 'fade-up', at: [0.15, 0.28], out: [0.75, 0.90], delay: 0.06 },
    ]
  },
  {
    id: 2,
    vh: 400,
    vs: 0.16, ve: 0.33,
    overlays: [
      { sel: '.s2-eyebrow', type: 'fade-up', at: [0.10, 0.22], out: [0.78, 0.92] },
      { sel: '.s2-title',   type: 'fade-up', at: [0.16, 0.30], out: [0.78, 0.92], delay: 0.06 },
      { sel: '.s2-sub',     type: 'fade-up', at: [0.22, 0.36], out: [0.78, 0.92], delay: 0.12 },
    ]
  },
  {
    id: 3,
    vh: 300,
    vs: 0.33, ve: 0.47,
    overlays: [
      { sel: '.s3-title', type: 'fade-up', at: [0.15, 0.32], out: [0.72, 0.92] },
      { sel: '.s3-line',  type: 'fade',    at: [0.22, 0.38], out: [0.72, 0.88], delay: 0.08 },
    ]
  },
  {
    id: 4,
    vh: 400,
    vs: 0.47, ve: 0.64,
    overlays: []  // Pure cinema — no text
  },
  {
    id: 5,
    vh: 300,
    vs: 0.64, ve: 0.79,
    overlays: [
      { sel: '.s5-eyebrow', type: 'fade-up', at: [0.12, 0.26], out: [0.74, 0.90] },
      { sel: '.s5-title',   type: 'fade-up', at: [0.18, 0.34], out: [0.74, 0.90], delay: 0.08 },
    ]
  },
  {
    id: 6,
    vh: 300,
    vs: 0.79, ve: 0.94,
    overlays: [
      { sel: '.s6-word', type: 'scale-fade', at: [0.14, 0.38], out: [0.72, 0.94] },
    ]
  },
];

/* ────────────────────────────────────────────────
   ELEMENTS
   ──────────────────────────────────────────────── */
const video      = document.getElementById('scene-video');
const loader     = document.getElementById('loader');
const loaderBar  = document.querySelector('.loader__bar');
const nav        = document.getElementById('nav');
const progressEl = document.getElementById('scroll-progress');
const dotsEl     = document.getElementById('scene-dots');

/* ────────────────────────────────────────────────
   1. LENIS + GSAP SYNC
   ──────────────────────────────────────────────── */
const lenis = new Lenis({
  lerp: 0.08,
  smoothWheel: true,
  syncTouch: false,  // native on mobile for performance
});

lenis.on('scroll', ScrollTrigger.update);

gsap.ticker.add((time) => {
  lenis.raf(time * 1000);
});

gsap.ticker.lagSmoothing(0);

/* ────────────────────────────────────────────────
   2. VIDEO LOAD
   ──────────────────────────────────────────────── */
function initAfterVideo() {
  // Hide loader
  loader.classList.add('hidden');
  setTimeout(() => { loader.style.display = 'none'; }, 900);

  // Show nav + dots
  nav.classList.add('visible');
  dotsEl.classList.add('visible');

  // Kick off all ScrollTriggers
  buildScenes();
  buildScrollProgress();
}

// Progress bar while video buffers
video.addEventListener('progress', () => {
  if (!video.duration) return;
  try {
    const buf = video.buffered;
    if (buf.length) {
      const pct = (buf.end(buf.length - 1) / video.duration) * 100;
      loaderBar.style.width = Math.min(pct, 90) + '%';
    }
  } catch (_) {}
});

// Wait for enough data to scrub
video.addEventListener('canplaythrough', () => {
  loaderBar.style.width = '100%';
  setTimeout(initAfterVideo, 400);
}, { once: true });

// Fallback: if video loads slowly, unblock at 8s
setTimeout(() => {
  if (loader.classList.contains('hidden')) return;
  loaderBar.style.width = '100%';
  initAfterVideo();
}, 8000);

// Start loading
video.load();

/* ────────────────────────────────────────────────
   3. SCENE SCROLLTRIGGERS
   ──────────────────────────────────────────────── */
function buildScenes() {
  const dur = video.duration || 1;

  SCENE_CONFIG.forEach((cfg) => {
    const scene = document.querySelector(`.scene--${cfg.id}`);
    if (!scene) return;

    const segStart = cfg.vs * dur;
    const segLen   = (cfg.ve - cfg.vs) * dur;

    /* ── Video scrub ── */
    ScrollTrigger.create({
      trigger: scene,
      start:   'top top',
      end:     'bottom bottom',
      scrub:   0.6,
      pin:     false, // sections use sticky child instead
      onUpdate(self) {
        const t = segStart + self.progress * segLen;
        // requestVideoFrameCallback-aware: clamp to valid range
        video.currentTime = Math.max(0, Math.min(dur, t));
      },
    });

    /* ── Dot indicator ── */
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

    /* ── Overlay text animations ── */
    cfg.overlays.forEach(({ sel, type, at, out, delay = 0 }) => {
      const el = scene.querySelector(sel);
      if (!el) return;

      // Entrance
      ScrollTrigger.create({
        trigger: scene,
        start:   'top top',
        end:     'bottom bottom',
        scrub:   true,
        onUpdate(self) {
          const p = self.progress;

          // Fade in window
          let inAlpha = 0;
          if (p >= at[0] + delay && p <= at[1] + delay) {
            inAlpha = (p - (at[0] + delay)) / ((at[1] - at[0]));
          } else if (p > at[1] + delay) {
            inAlpha = 1;
          }

          // Fade out window
          let outAlpha = 1;
          if (out && p >= out[0] && p <= out[1]) {
            outAlpha = 1 - (p - out[0]) / (out[1] - out[0]);
          } else if (out && p > out[1]) {
            outAlpha = 0;
          }

          const alpha = Math.min(inAlpha, outAlpha);
          const clamped = Math.max(0, Math.min(1, alpha));

          el.style.opacity = clamped;

          // Y translate for fade-up
          if (type === 'fade-up') {
            const yOffset = (1 - Math.min(inAlpha, 1)) * 22;
            el.style.transform = `translateY(${yOffset}px)`;
          }

          // Scale for scale-fade (single word)
          if (type === 'scale-fade') {
            const s = 0.88 + 0.12 * Math.min(inAlpha, 1);
            el.style.transform = `scale(${s})`;
          }
        },
      });
    });
  });
}

/* ────────────────────────────────────────────────
   4. SCROLL PROGRESS BAR
   ──────────────────────────────────────────────── */
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

/* ────────────────────────────────────────────────
   5. CTA SECTION (Scene 7) — Standard reveal
   ──────────────────────────────────────────────── */
function buildCTA() {
  const card = document.querySelector('.guide-card');
  const copy = document.querySelector('.cta__copy');

  if (card) {
    ScrollTrigger.create({
      trigger: card,
      start: 'top 80%',
      once: true,
      onEnter() {
        gsap.to(card, {
          opacity: 1, y: 0, duration: 1.1,
          ease: 'power3.out', delay: 0.1
        });
      }
    });
  }

  if (copy) {
    ScrollTrigger.create({
      trigger: copy,
      start: 'top 80%',
      once: true,
      onEnter() {
        gsap.to(copy, {
          opacity: 1, y: 0, duration: 1,
          ease: 'power3.out', delay: 0.3
        });
      }
    });
  }
}

// CTA can init immediately (no video dependency)
document.addEventListener('DOMContentLoaded', buildCTA);

/* ────────────────────────────────────────────────
   6. SCENE DOT HELPERS
   ──────────────────────────────────────────────── */
function activateDot(sceneId) {
  document.querySelectorAll('.dot').forEach((d) => {
    d.classList.toggle('active', +d.dataset.scene === sceneId);
  });
}

/* ────────────────────────────────────────────────
   7. RESIZE HANDLER
   ──────────────────────────────────────────────── */
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    ScrollTrigger.refresh();
  }, 200);
});
