import { useEffect, useRef, useState } from 'react';

const FPS = 24;                 // the source frame rate
const FOLLOW_RANGE = 11;        // px he is ever allowed to drift from centre
const TILT = 0.022;             // max lean, radians

/* One steady drawing per look direction (0-indexed atlas frames).
   He holds the pose while looking aside - no frame churn - and only
   the blink and the body carry the motion. */
const LOOK = {
  front: 20,                    // facing the viewer
  right: 9,                     // head turned toward screen-right
  left: 31                      // head turned toward screen-left
};
const SHUT = [3, 4];            // closing, then closed - the source's own blink
const GIGGLE_END = 56;          // last giggle frame before the source starts throwing bolts

const CENTRE_BAND = 0.14;       // cursor inside this slice of the width = facing front
const TURN_BAND = 0.20;         // and this far out before he turns - hysteresis
const DWELL = 150;              // ms the cursor must stay in a zone before he turns
const BLINK = 0.17;             // seconds of blink, which also covers a turn
const FADE = 0.08;              // seconds of cross-dissolve out of the blink
const TURN_ON = 0.30;           // how far off-centre the cursor must be to turn him
const TURN_OFF = 0.16;          // and how far back before he faces forward again

/** critically damped spring - smooth, never overshoots into jitter */
function spring(state, target, dt, stiffness = 90, damping = 15) {
  const a = (target - state.v) * stiffness - state.d * damping;
  state.d += a * dt;
  state.v += state.d * dt;
  return state.v;
}

export default function Pikachu({ onReact }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const half = window.innerWidth < 900 || (window.devicePixelRatio || 1) < 1.5;

    let meta = null;
    let charImg = null;
    let raf = null;
    let alive = true;

    // stage state
    let w = 0, h = 0, dpr = 1;
    const pointer = { x: 0, y: 0, inside: false, moved: 0 };
    const ox = { v: 0, d: 0 };          // smoothed offset x
    const oy = { v: 0, d: 0 };          // smoothed offset y
    const rot = { v: 0, d: 0 };         // smoothed lean
    const pop = { v: 1, d: 0 };         // click squash-and-stretch

    let dir = 'front';                  // front | right | left
    let lastFrame = LOOK.front;         // what we dissolve out of after a blink
    let fadeT = 1;                      // 0..1 dissolve progress

    let mode = 'idle';                  // idle -> giggle -> idle
    let cursor = 0;                     // frame inside a reaction segment
    let acc = 0;
    let bob = 0;
    let blinkAt = performance.now() + 2200;
    let blinkT = -1;                    // >= 0 while a blink plays
    let turnPending = null;             // direction to adopt behind closed eyes
    let candidate = 'front';            // zone the cursor is in right now
    let candidateAt = 0;                // since when - he waits DWELL before turning
    let geom = null;                    // where he is drawn, for hit-testing

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = wrap.clientWidth;
      h = wrap.clientHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingQuality = 'high';
    }

    function load(src) {
      return new Promise((res, rej) => {
        const im = new Image();
        im.onload = () => res(im);
        im.onerror = rej;
        im.src = src;
      });
    }

    function cell(sheet, index) {
      const [cw, ch] = sheet.cell;
      return [(index % sheet.cols) * cw, Math.floor(index / sheet.cols) * ch, cw, ch];
    }

    /** frames to show this instant: [[frame, alpha], ...] */
    function charFrames(dt) {
      if (mode === 'giggle') return [[meta.char.giggle[0] + cursor, 1]];

      if (blinkT >= 0) {
        return [[blinkT < 0.35 ? SHUT[0] : SHUT[1], 1]];
      }

      const f = LOOK[dir];
      if (fadeT < 1) {
        fadeT = Math.min(1, fadeT + dt / FADE);
        const t = fadeT * fadeT * (3 - 2 * fadeT);
        return [[lastFrame, 1 - t], [f, t]];
      }
      lastFrame = f;
      return [[f, 1]];
    }

    function draw(dt) {
      ctx.clearRect(0, 0, w, h);
      if (!meta) return;

      const [CX, CY, CW, CH] = meta.char.crop;
      const target = Math.min(h * 0.78, 620);
      const s = target / CH;                       // source px -> screen px
      const cx = w / 2 + ox.v;
      const cy = h / 2 + oy.v + Math.sin(bob) * 5;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rot.v);
      ctx.scale(pop.v, 2 - pop.v);

      if (charImg) {
        const sheet = meta.char;
        for (const [index, alpha] of charFrames(dt)) {
          if (alpha <= 0.001) continue;
          const [sx, sy, sw, sh] = cell(sheet, index);
          ctx.globalAlpha = alpha;
          ctx.drawImage(charImg, sx, sy, sw, sh, (-CW * s) / 2, (-CH * s) / 2, CW * s, CH * s);
        }
        ctx.globalAlpha = 1;
      }
      ctx.restore();

      geom = { cx, cy, hw: (CW * s) / 2, hh: (CH * s) / 2 };
    }

    /** step the click reaction (the giggle, then back to idle) */
    function advance(dt) {
      if (mode === 'idle') return;
      acc += dt;
      const stepTime = 1 / FPS;
      while (acc >= stepTime) {
        acc -= stepTime;
        cursor++;
        if (mode === 'giggle') {
          const a = meta.char.giggle[0];
          if (a + cursor > GIGGLE_END) {
            mode = 'idle';
            cursor = 0;
            fadeT = 0;
            blinkAt = performance.now() + 1200;
          }
        }
      }
    }

    function turnTo(next, now) {
      if (next === dir || turnPending === next) return;
      turnPending = next;
      blinkT = 0;                                  // he blinks as he turns
      blinkAt = now + 2200;
    }

    let last = performance.now();
    function frame(now) {
      if (!alive) return;
      const dt = Math.max(0, Math.min((now - last) / 1000, 0.04));
      last = now;
      bob += dt * 1.4;

      // ── head: he looks wherever the cursor is - left, centre or right
      if (mode === 'idle') {
        const side = pointer.inside ? (pointer.x - w / 2) / w : 0;   // -0.5 .. 0.5
        const out = dir === 'front' ? TURN_BAND : CENTRE_BAND;
        let zone = dir;
        if (side > out) zone = 'right';
        else if (side < -out) zone = 'left';
        else if (Math.abs(side) < CENTRE_BAND) zone = 'front';

        if (zone !== candidate) {
          candidate = zone;
          candidateAt = now;
        }
        // only commit once he has settled in that zone - crossing the centre
        // on the way from one side to the other must not trigger a turn
        if (candidate !== dir && now - candidateAt >= DWELL) turnTo(candidate, now);
      }

      // ── blinking: through every turn, and now and then while facing forward
      if (blinkT >= 0) {
        blinkT += dt / BLINK;
        if (blinkT >= 0.45 && turnPending) {        // swap pose behind closed eyes
          dir = turnPending;
          turnPending = null;
        }
        if (blinkT >= 1) {
          blinkT = -1;
          fadeT = 0;
          blinkAt = now + 1900 + Math.random() * 3200;
        }
      } else if (mode === 'idle' && dir === 'front' && now >= blinkAt) {
        blinkT = 0;
      }

      // ── body: he stays centred, only leaning a little toward the cursor
      let tx = 0, ty = 0;
      if (pointer.inside) {
        const dx = pointer.x - w / 2;
        const dy = pointer.y - h / 2;
        const d = Math.hypot(dx, dy) || 1;
        const pull = Math.min(1, d / (Math.max(w, h) * 0.45));
        tx = (dx / d) * FOLLOW_RANGE * pull;
        ty = (dy / d) * FOLLOW_RANGE * 0.5 * pull;
      }
      spring(ox, tx, dt, 70, 14);
      spring(oy, ty, dt, 70, 14);
      spring(rot, (tx / FOLLOW_RANGE) * TILT, dt, 60, 13.5);
      spring(pop, 1, dt, 190, 17);

      advance(dt);
      draw(dt);
      raf = requestAnimationFrame(frame);
    }

    function onPointerMove(e) {
      const r = wrap.getBoundingClientRect();
      const nx = e.clientX - r.left;
      const ny = e.clientY - r.top;
      if (Math.abs(nx - pointer.x) + Math.abs(ny - pointer.y) > 0.5) {
        pointer.moved = performance.now();
      }
      pointer.x = nx;
      pointer.y = ny;
      pointer.inside = true;
    }
    function onPointerLeave() { pointer.inside = false; }

    function onPointerDown(e) {
      if (!geom) return;
      const r = wrap.getBoundingClientRect();
      const nx = (e.clientX - r.left - geom.cx) / (geom.hw * 0.62);
      const ny = (e.clientY - r.top - geom.cy) / (geom.hh * 0.92);
      if (nx * nx + ny * ny > 1) return;           // clicked the stage, not him
      if (mode !== 'idle') return;                 // let a reaction finish
      mode = 'giggle';
      blinkT = -1;
      turnPending = null;
      cursor = 0;
      acc = 0;
      pop.v = 0.9;
      pop.d = 1.6;
      if (onReact) onReact();
    }

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('mousemove', onPointerMove, { passive: true });
    window.addEventListener('pointerleave', onPointerLeave);
    wrap.addEventListener('pointerdown', onPointerDown);

    const suffix = half ? '.half' : '';
    fetch('frames/frames.json')
      .then(r => r.json())
      .then(async m => {
        meta = m;
        if (half) meta.char.cell = meta.char.cell.map(v => v / 2);
        charImg = await load('frames/' + m.char.file.replace('.webp', suffix + '.webp'));
        if (!alive) return;
        setReady(true);
        if (reduced) { draw(0); return; }
        last = performance.now();
        raf = requestAnimationFrame(frame);
      });

    const onVisibility = () => {
      if (document.hidden) {
        if (raf) cancelAnimationFrame(raf);
        raf = null;
      } else if (!raf && meta && !reduced) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      alive = false;
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('pointerleave', onPointerLeave);
      wrap.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [onReact]);

  return (
    <div ref={wrapRef} className={'pika-stage' + (ready ? ' is-ready' : '')}>
      <canvas ref={canvasRef} aria-label="Pikachu - click him" role="img" />
    </div>
  );
}
