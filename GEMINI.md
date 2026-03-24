# Inglenook Sidings - GEMINI context

## Project Overview
Inglenook Sidings is a browser-based 3D railway shunting puzzle built with Three.js. The player controls a locomotive to arrange freight cars into a specific target order across a set of sidings. It is a digital implementation of the classic Inglenook Sidings shunting puzzle.

### Core Technologies
- **Three.js (r152)**: 3D rendering and scene management.
- **Vanilla JavaScript**: Logic and state management using the IIFE module pattern.
- **HTML5/CSS3**: HUD, UI overlays, and game container.
- **OrbitControls**: Camera interaction.

### Architecture
The project is organized into several key modules located in the `js/` directory:
- `config.js`: Constants, dimensions, colors, and string translations.
- `tracks.js`: Geometry, routing, and positioning logic for the rail layout.
- `scene.js`: Three.js renderer, camera, lighting, and ground setup.
- `entities.js`: Creation and visual properties of 3D meshes (loco, cars, rails, scenery).
- `gameState.js`: Authority on the game's logical state (car positions, coupling, win conditions).
- `hud.js`: DOM-based user interface updates.
- `animation.js`: Handles the polyline path-following movement for the train.
- `interaction.js`: Raycasting for mouse clicks and button event wiring.
- `main.js`: Initialization and the main render loop.

## Building and Running
- **No Build Step**: The project uses vanilla JS and can be run directly in a browser.
- **Local Development**: Open `index.html` in a modern web browser. Using a local development server (e.g., `npx serve`, `python3 -m http.server`, or VS Code Live Server) is recommended for consistent behavior.

## Core Mandates & Constraints
- **Logic Freeze**: Do NOT modify movement, animation, or shunting logic. These systems are finely tuned to the track geometry and game rules.
- **Cosmetic Focus**: You are encouraged to make cosmetic changes to the graphics, materials, and scenery within `js/entities.js`, `js/scene.js`, and `css/style.css`.
- **Coordinate System**: The track layout is defined in `js/tracks.js`. Be careful when modifying visuals to ensure they still align with the logical positions defined there.

## Development Conventions
- **Module Pattern**: Each JS file uses an IIFE to export a public API (e.g., `const Entities = (() => { ... return { init, ... }; })();`).
- **Global Objects**: The modules are exposed as global objects and interact with each other directly.
- **Units**: 1 unit ≈ 1 meter. The locomotive is 2 units long, and cars are 1.6 units long.
- **Colors**: Hex codes are used for Three.js colors (e.g., `0xffcc00`).
- **Shadows**: PCFSoftShadowMap is used for soft shadows; ensure new meshes have `castShadow` and `receiveShadow` set appropriately.
