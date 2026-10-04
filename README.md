# PIKACHU LAB

An interactive Pikachu experience built with React and Vite. Move your cursor and Pikachu
tracks it with a springy lean; click him for a giggle, crackling lightning, and a burst of
electric energy.

**Live site:** [pikachu-topaz-theta.vercel.app](https://pikachu-topaz-theta.vercel.app/)

![Pikachu Lab preview](src/assets/hero.png)

## Highlights

- Cursor-aware Pikachu with smooth direction changes and natural blinking
- WebGL fluid cursor splashes tuned to the electric yellow palette
- Canvas-rendered katakana rain with device-pixel-ratio support
- Sprite atlas playback for responsive, lightweight animation
- Click-triggered giggle animation and animated lightning bolts
- Dark night and light studio themes, remembered between visits
- Reduced-motion support for a calmer, accessible experience

## Built with

| Layer | Technology |
| --- | --- |
| UI | React 19 |
| Build | Vite 8 |
| Animation | Canvas, WebGL, and CSS |
| Quality | Oxlint |
| Hosting | Vercel |

## Run locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite, usually `http://localhost:5173`.

Create a production build with:

```bash
npm run build
```

## Project map

```text
src/
├── App.jsx                   # Stage composition, theme, and interactions
├── index.css                 # Visual system and responsive layout
└── components/
    ├── GlyphRain.jsx         # Katakana canvas background
    ├── Lightning.jsx         # Click-triggered electric effect
    ├── Pikachu.jsx           # Sprite playback and cursor tracking
    └── SplashCursor.jsx      # Fluid WebGL cursor effect

public/frames/
├── frames.json               # Atlas geometry and animation segments
├── pikachu-char.webp         # Full-resolution sprite atlas
└── pikachu-char.half.webp    # Smaller atlas for compact screens
```

## Interaction details

Pikachu changes gaze direction based on the cursor position, using hysteresis and a short dwell
to keep transitions stable. His body remains centered while leaning toward the pointer. Clicking
the character plays the giggle segment and regenerates the lightning shape at a steady rhythm.

When `prefers-reduced-motion` is enabled, the page uses a static frame, removes the rain, and
suppresses the lightning reaction.

## Author

Created and maintained by **SayedSadiq45**.

- [GitHub](https://github.com/SayedSadiq45)
- [LinkedIn](https://www.linkedin.com/in/sayed-sadiq45/)

## License

Released under the [MIT License](LICENSE). Copyright © 2026 SayedSadiq45.
