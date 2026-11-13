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

- Open the grey bag shop on the left and choose free apple tree seeds.
- Tap the center of the plot, or use the keyboard-accessible **Plant in center** button.
- Drag the scene to rotate it; scroll or pinch with two fingers to zoom.
- **Escape** closes the shop and cancels plant or tree selection.
- **New game** (the restart icon at the top right) clears the entire garden and stone after confirmation, keeping your selected language.
- Toggle **Garden shears** below the shop, then tap a flower, bush or mushroom to remove it without a refund. Trees are unaffected. Press the button again, **Cancel**, or **Escape** to stop. Keyboard users can choose an occupied place from the tool's controls.

## Plants and saved gardens

- Click the large grey rock to mine **stone**, up to a maximum balance of **10,000**.
- Open the shop with the grey bag button on the left. A flower costs **1 stone**, a mushroom **2**, and a bush **3**. Selecting a plant hides the shop and highlights free places. Tap a place to plant, or **Cancel** to leave planting mode.
- There are **24 places** around the central tree. Each plant occupies one; garden shears free its place for planting again. Moving plants is not available yet.
- Scroll or pinch to zoom closer for easier placement. **Escape** also cancels plant selection.
- The tree's seed, position and planting time, other plants, and stone are saved locally in your browser. Tree growth accounts for time spent away from the page.
- Planted trees cannot be removed or replaced. Clearing site data removes the saved garden. If browser storage is unavailable, the garden only lasts until reload.

## Expanding the garden: up to 36 plots

- Each expansion requires **150 stone, a grown tree, 3 bushes, 6 mushrooms, and 8 flowers** on the **most recently unlocked plot**, all at once. The shop's “Next hexagon” section identifies that plot and shows progress. Existing plants are not consumed.
- Once ready, translucent hexagons with plus signs mark every free neighboring position around the garden. Pick one to add a plot and spend **150 stone**. Occupied positions are excluded and shared neighbors appear only once. The limit is **36 plots**, including the first.
- Every new plot starts as a standard biome with **24 places** and its own dark grey mining rock. The rock's position, shape and proportions are seeded from plot coordinates and stay the same after reload. It avoids the tree and planting places; tapping adds **1 stone** to the shared balance and briefly lights up that rock.
- Plots vary subtly in soil tint and the arrangement of grey decorative stones and grass tufts. Decoration is seeded from plot coordinates, so it stays the same after reload and avoids planting places. Stones and grass use instancing for inexpensive rendering.
- Tree seeds are free. Plot 1 grows an **apple tree**. Starting with plot 2, freely choose an **apple tree** or **spruce**; its type and biome are saved. Already planted trees remain unchanged. Navigation uses neutral names: **Plot 1**, **Plot 2**, and so on.
- Selecting spruce previews the conifer biome: darker soil, white flowers, brown mushrooms, and young conifers as bushes. Planting the tree saves that biome. Spruce grows over 26 seconds with randomized tiers of branches and needles; its shape and growth survive reloads.
- Unlocking the third plot makes **baobab** available on any empty plot from plot 2 onward. Its **savanna** biome has sandy ochre soil, half-dry bushes, orange flowers and morel-like mushrooms. Each baobab has randomized thick-trunk proportions, branches and patches of foliage, and grows over 26 seconds. Selecting it previews the biome; planting saves it, while cancelling restores the previous appearance. All plants are procedural and retain their appearance after reload.
- Switch plots using the horizontally scrollable bottom buttons or by tapping a plot. **Overview** fits the entire garden in view; selecting a plot brings the camera closer. Each plot has its own permanent tree.
- Old one-plot and two-plot saves are loaded automatically, preserving plants, tree seeds, growth times, stone and the second plot's position.

## Desert biome

After unlocking the fourth plot, **palm** seeds become available on any empty plot except the first. Selecting a palm previews pale sand, sand ripples and terracotta pebbles; canceling restores the previous biome. Planting saves the desert biome and a procedural palm with a curved trunk and feathery fronds. Growth takes 26 seconds and resumes after reloading.

Desert plants replace the existing categories: flowering succulents cost **1 stone**, round ribbed cacti **2 stone**, and agaves **3 stone**. Expansion still requires a mature tree, 3 agaves, 6 cacti, 8 succulents and 150 stone on the latest plot. Plant removal works as before, without refunds. Shop and requirement labels follow the corresponding plot's biome in both languages.

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

Tree geometry lives in `trees.js`, small plants in `plants.js`, and terrain in `terrain.js`. `garden-layout.js` defines growth time, neighbors, and planting places; `resources.js` saves progress and validates purchases and expansion. Decorative swaying is disabled when the system's reduced-motion preference is enabled.
