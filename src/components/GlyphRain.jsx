import { useEffect, useRef } from 'react';

/**
 * Falling glyph rain (canvasui-style) — katakana + kana columns drifting down
 * behind the stage. One canvas, one rAF, DPR-aware, pauses when hidden.
 */
export default function GlyphRain({
  glyphs = 'ピカチュウカミナリデンキアイウエオカキクケコサシスセソタチツテト01',
  fontSize = 18,
  speed = 58,
  density = 0.85,
  color = '#8d8a97',
  headColor = '#d9a400',
  opacity = 0.38
}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { alpha: true });
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = null;
    let columns = [];
    let w = 0;
    let h = 0;
    let dpr = 1;

    const rand = (a, b) => a + Math.random() * (b - a);

    function build() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.font = `${fontSize}px "Noto Sans JP", "Hiragino Kaku Gothic ProN", monospace`;
      ctx.textBaseline = 'top';

      const step = fontSize * 1.75;
      const count = Math.max(6, Math.round((w / step) * density));
      columns = Array.from({ length: count }, (_, i) => ({
        x: (i + 0.5) * (w / count) + rand(-6, 6),
        y: rand(-h * 0.35, h),          // seeded across the screen, not all above it
        speed: rand(speed * 0.45, speed * 1.35),
        len: Math.round(rand(6, 16)),
        chars: Array.from({ length: 18 }, () => glyphs[(Math.random() * glyphs.length) | 0]),
        swap: rand(0.1, 0.4),
        t: 0
      }));
    }

    function draw(dt) {
      ctx.clearRect(0, 0, w, h);
      const gap = fontSize * 1.35;
      for (const c of columns) {
        c.y += c.speed * dt;
        c.t += dt;
        if (c.t > c.swap) {                       // occasional glyph flicker
          c.t = 0;
          c.chars[(Math.random() * c.chars.length) | 0] =
            glyphs[(Math.random() * glyphs.length) | 0];
        }
        if (c.y - c.len * gap > h) {
          c.y = rand(-h * 0.5, -gap);
          c.speed = rand(speed * 0.45, speed * 1.35);
          c.len = Math.round(rand(6, 16));
        }
        for (let i = 0; i < c.len; i++) {
          const y = c.y - i * gap;
          if (y < -gap || y > h) continue;
          const fade = 1 - i / c.len;
          if (i === 0) {
            ctx.fillStyle = headColor;
            ctx.shadowColor = color;
            ctx.shadowBlur = 12;
          } else {
            ctx.fillStyle = color;
            ctx.shadowBlur = 0;
          }
          ctx.globalAlpha = opacity * fade * fade;
          ctx.fillText(c.chars[i % c.chars.length], c.x, y);
        }
      }
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
    }

    let last = performance.now();
    function frame(now) {
      const dt = Math.max(0, Math.min((now - last) / 1000, 0.05));
      last = now;
      draw(dt);
      raf = requestAnimationFrame(frame);
    }

    const onResize = () => build();
    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf);
        raf = null;
      } else if (!raf && !reduced) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    };

    const start = () => {
      build();
      if (reduced) {
        draw(0);                                  // one static pass, no motion
        return;
      }
      last = performance.now();
      raf = requestAnimationFrame(frame);
    };

    if (document.fonts && document.fonts.ready) document.fonts.ready.then(start);
    else start();

    window.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [glyphs, fontSize, speed, density, color, headColor, opacity]);

  return <canvas ref={canvasRef} className="glyph-rain" aria-hidden="true" />;
}
