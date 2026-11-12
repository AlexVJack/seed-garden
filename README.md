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

## Plants and saved gardens

- Click the large grey rock to mine **stone**.
- Open the shop with the grey bag button on the left. A flower costs **1 stone**, a mushroom **2**, and a bush **3**. Selecting a plant hides the shop and highlights free places. Tap a place to plant, or **Cancel** to leave planting mode.
- There are **24 places** around the central tree. Each plant occupies one; removal and moving are not available yet.
- Scroll or pinch to zoom closer for easier placement. **Escape** also cancels plant selection.
- The tree's seed, position and planting time, other plants, and stone are saved locally in your browser. Tree growth accounts for time spent away from the page.
- **New seed** replaces only the tree, preserving purchased plants and stone. Clearing site data removes the saved garden. If browser storage is unavailable, the garden only lasts until reload.

## Checks

Test prices, the 24 places, and saved state with Node.js 22+:

```bash
node --experimental-default-type=module --test tests/garden.test.mjs
```

## Languages

The interface supports English and Ukrainian. On your first visit, Ukrainian is selected if it appears in your browser's language preferences; otherwise, English is used. The **EN / УК** switch remembers your choice for future visits when browser storage is available. Switching languages never reloads the page or interrupts tree growth.

Interface text and screen-reader descriptions live in the dictionaries in `i18n.js`.

## How the tree grows

`crypto.getRandomValues()` creates a random seed. A deterministic generator then chooses branch curves, lengths, directions, and foliage colors. Branches divide recursively, taper, and reach upward. Each segment appears after the preceding one grows, and foliage unfolds at branch tips. This is a stylized procedural model rather than a botanical simulation.

The main settings live in `main.js`: `duration` controls growth time, `branch()` defines tree structure, and `leafMaterials` sets canopy colors. Decorative swaying is disabled when the system's reduced-motion preference is enabled.
