import { useCallback, useEffect, useRef, useState } from 'react';
import SplashCursor from './components/SplashCursor';
import GlyphRain from './components/GlyphRain';
import Pikachu from './components/Pikachu';
import Lightning from './components/Lightning';

export default function App() {
  const [zapped, setZapped] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('pika-theme') || 'dark');

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('pika-theme', theme);
  }, [theme]);

  const fireRef = useRef(null);

  const handleReact = useCallback(() => {
    if (fireRef.current) fireRef.current();
    setZapped(true);
    window.setTimeout(() => setZapped(false), 1400);
  }, []);

  return (
    <main className={'stage' + (zapped ? ' is-zapped' : '')}>
      <div className="stage__glow" aria-hidden="true" />
      <GlyphRain
        color={theme === 'dark' ? '#8a8398' : '#8d8a97'}
        headColor={theme === 'dark' ? '#ffd44d' : '#d9a400'}
        opacity={theme === 'dark' ? 0.5 : 0.38}
      />

      <p className="stage__kanji" aria-hidden="true">電気</p>

      <button
        type="button"
        className="stage__theme"
        onClick={() => setTheme(t => (t === 'dark' ? 'light' : 'dark'))}
        aria-label={theme === 'dark' ? 'Switch to the light studio background' : 'Switch to the dark background'}
        title={theme === 'dark' ? 'Light studio' : 'Dark night'}
      >
        {theme === 'dark' ? '☀' : '☾'}
      </button>

      <header className="stage__head">
        <p className="stage__eyebrow">でんきタイプ · ELECTRIC TYPE · No.025</p>
        <h1>
          <span className="stage__jp">ピカチュウ</span>
          <span className="stage__en" data-text="PIKACHU">PIKACHU</span>
        </h1>
      </header>

      <aside className="creator" aria-label="Creator links">
        <span className="creator__aura">AURA / CREATOR</span>
        <strong className="creator__name">SAYED SADIQ</strong>
        <nav className="creator__links" aria-label="Sayed Sadiq online profiles">
          <a href="https://www.linkedin.com/in/sayed-sadiq45/" target="_blank" rel="noreferrer">
            LinkedIn <span aria-hidden="true">↗</span>
          </a>
          <a href="https://github.com/SayedSadiq45" target="_blank" rel="noreferrer">
            GitHub <span aria-hidden="true">↗</span>
          </a>
        </nav>
      </aside>

      <Pikachu onReact={handleReact} />
      <Lightning fireRef={fireRef} />

      <footer className="stage__foot">
        <span className="stage__hint">
          <em>マウスを動かす</em> move your mouse — he follows
        </span>
        <span className="stage__hint stage__hint--tap">
          <em>クリック</em> click him for a giggle ⚡
        </span>
      </footer>

      <SplashCursor
        DENSITY_DISSIPATION={3.5}
        VELOCITY_DISSIPATION={2}
        PRESSURE={0.1}
        CURL={3}
        SPLAT_RADIUS={0.2}
        SPLAT_FORCE={6000}
        COLOR_UPDATE_SPEED={10}
        SHADING
        RAINBOW_MODE={false}
        COLOR="#EFA400"
      />
    </main>
  );
}
