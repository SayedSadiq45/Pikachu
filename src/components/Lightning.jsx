import { useEffect, useRef } from 'react';

/**
 * Full-screen yellow thunder. Bolts are grown by midpoint displacement
 * from the middle of the stage out past every edge, redrawn with fresh
 * jitter a few times a second so they crackle instead of sitting still.
 */
const LIFE = 0.62;              // seconds a burst lasts
const CRACKLE = 0.055;          // seconds between re-jitters
const BOLTS = 13;

function boltPath(x0, y0, x1, y1, depth, spread) {
  let pts = [[x0, y0], [x1, y1]];
  for (let d = 0; d < depth; d++) {
    const next = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, ay] = pts[i];
      const [bx, by] = pts[i + 1];
      const mx = (ax + bx) / 2;
      const my = (ay + by) / 2;
      const nx = -(by - ay);
      const ny = bx - ax;
      const len = Math.hypot(nx, ny) || 1;
      const off = (Math.random() - 0.5) * spread;
      next.push([mx + (nx / len) * off, my + (ny / len) * off], [bx, by]);
    }
    pts = next;
    spread *= 0.55;
  }
  return pts;
}

export default function Lightning({ fireRef }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let w = 0, h = 0;
    let raf = null;
    let t = -1;                 // >= 0 while a burst plays
    let bolts = [];
    let nextCrackle = 0;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function grow() {
      const cx = w / 2;
      const cy = h * 0.56;
      const reach = Math.hypot(w, h) * 0.62;
      bolts = Array.from({ length: BOLTS }, (_, i) => {
        const a = (i / BOLTS) * Math.PI * 2 + Math.random() * 0.4;
        const from = i % 2 ? -1 : 1;                       // alternate cheeks
        const x0 = cx + from * Math.min(w * 0.06, 70);
        const y0 = cy - h * 0.03;
        return {
          pts: boltPath(x0, y0, cx + Math.cos(a) * reach, cy + Math.sin(a) * reach, 6, h * 0.28),
          width: 1.6 + Math.random() * 3.4,
          seed: Math.random()
        };
      });
    }

    function render(now) {
      ctx.clearRect(0, 0, w, h);
      if (t < 0) return;

      const k = t / LIFE;                                   // 0 -> 1
      const fade = k < 0.12 ? k / 0.12 : Math.pow(1 - (k - 0.12) / 0.88, 1.6);
      const flicker = 0.65 + 0.35 * Math.sin(now * 0.05 + 1);

      // sky flash
      ctx.globalCompositeOperation = 'lighter';
      const flash = ctx.createRadialGradient(w / 2, h * 0.56, 0, w / 2, h * 0.56, Math.hypot(w, h) * 0.6);
      flash.addColorStop(0, `rgba(255, 224, 120, ${0.30 * fade})`);
      flash.addColorStop(0.4, `rgba(255, 196, 20, ${0.13 * fade})`);
      flash.addColorStop(1, 'rgba(255, 196, 20, 0)');
      ctx.fillStyle = flash;
      ctx.fillRect(0, 0, w, h);

      for (const b of bolts) {
        const a = fade * flicker * (0.55 + b.seed * 0.45);
        ctx.beginPath();
        ctx.moveTo(b.pts[0][0], b.pts[0][1]);
        for (let i = 1; i < b.pts.length; i++) ctx.lineTo(b.pts[i][0], b.pts[i][1]);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        ctx.strokeStyle = `rgba(255, 176, 0, ${a * 0.32})`;   // outer glow
        ctx.lineWidth = b.width * 6;
        ctx.shadowColor = 'rgba(255, 203, 5, 0.9)';
        ctx.shadowBlur = 26;
        ctx.stroke();

        ctx.strokeStyle = `rgba(255, 214, 40, ${a * 0.9})`;   // body
        ctx.lineWidth = b.width * 2;
        ctx.shadowBlur = 14;
        ctx.stroke();

        ctx.strokeStyle = `rgba(255, 250, 214, ${a})`;        // hot core
        ctx.lineWidth = b.width * 0.7;
        ctx.shadowBlur = 0;
        ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.shadowBlur = 0;
    }

    let last = performance.now();
    function loop(now) {
      const dt = Math.max(0, Math.min((now - last) / 1000, 0.04));
      last = now;
      if (t >= 0) {
        t += dt;
        if (now >= nextCrackle) {
          grow();
          nextCrackle = now + CRACKLE * 1000;
        }
        if (t > LIFE) {
          t = -1;
          bolts = [];
          ctx.clearRect(0, 0, w, h);
          raf = null;
          return;                                            // idle: no rAF at all
        }
        render(now);
      }
      raf = requestAnimationFrame(loop);
    }

    function fire() {
      if (reduced) return;
      t = 0;
      nextCrackle = 0;
      grow();
      if (!raf) {
        last = performance.now();
        raf = requestAnimationFrame(loop);
      }
    }

    resize();
    fireRef.current = fire;
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    return () => {
      fireRef.current = null;
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [fireRef]);

  return <canvas ref={canvasRef} className="stage__thunder" aria-hidden="true" />;
}
