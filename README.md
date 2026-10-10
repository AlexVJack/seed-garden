# Seed Garden 🌱

**English** · [Українська](./README.uk.md)

A small interactive 3D diorama: plant a seed and watch a unique, stylized tree grow over 26 seconds.

## 🌱 [Try the live demo](https://alexvjack.github.io/seed-garden/)

## Run locally

From the project directory, run:

```bash
python3 -m http.server 8080
```

Open **http://localhost:8080**. Python only serves the local files; the page itself runs on HTML, CSS, and JavaScript. Opening the HTML file directly does not work with JavaScript modules.

You need a modern browser with WebGL and an internet connection. Three.js loads from jsDelivr and fonts load from Google Fonts, with system fonts as a fallback. No build step or npm installation is required.

## Controls

- Drag the seed onto the central part of the soil with a mouse or your finger.
- Alternatively, click the seed, then click a planting spot.
- The **Plant** button plants a tree in the center and works with a keyboard.
- Drag the scene to rotate it; scroll or pinch with two fingers to zoom.
- **New seed** clears the current tree so you can grow another.
- **Escape** cancels seed selection.

## Languages

The interface supports English and Ukrainian. On your first visit, Ukrainian is selected if it appears in your browser's language preferences; otherwise, English is used. The **EN / УК** switch remembers your choice for future visits when browser storage is available. Switching languages never reloads the page or interrupts tree growth.

Interface text and screen-reader descriptions live in the dictionaries in `i18n.js`.

## How the tree grows

`crypto.getRandomValues()` creates a random seed. A deterministic generator then chooses branch curves, lengths, directions, and foliage colors. Branches divide recursively, taper, and reach upward. Each segment appears after the preceding one grows, and foliage unfolds at branch tips. This is a stylized procedural model rather than a botanical simulation.

The main settings live in `main.js`: `duration` controls growth time, `branch()` defines tree structure, and `leafMaterials` sets canopy colors. Decorative swaying is disabled when the system's reduced-motion preference is enabled.
