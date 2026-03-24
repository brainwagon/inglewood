# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A browser-based 3D railway shunting puzzle (Inglenook Sidings) built with Three.js and vanilla JavaScript. No build tools, bundlers, or package manager — open `index.html` directly in a browser.

## Development

There is no build step, no test suite, and no linter. To run the game, serve or open `index.html`. Three.js r147 and OrbitControls load from CDN.

## Architecture

Eight IIFE modules loaded via `<script>` tags in dependency order. All modules communicate through their exported APIs on the global scope. The load order matters:

1. **config.js** — `CONFIG` and `LANG` globals (dimensions, colors, capacities, strings)
2. **tracks.js** — `Tracks` module: track geometry, switch points SP1/SP2, routing waypoints, and all entity positioning math (stop positions, buffer-packing, fill directions)
3. **scene.js** — `SceneManager`: Three.js renderer, camera, lighting, ground plane, render loop
4. **entities.js** — `Entities`: creates all 3D meshes and owns `positionAllEntities()` which is the single source of truth for where everything goes after state changes
5. **gameState.js** — `GameState`: authoritative game state (`sidings`, `coupled`, `locoTrack`), coupling/decoupling logic, move validation, win check
6. **hud.js** — `HUD`: DOM manipulation for status, target display, victory overlay, error toasts
7. **animation.js** — `Animation`: polyline path-following for move animations and victory drive-off
8. **interaction.js** — `Interaction`: raycasting, click zones, button handlers

Bootstrap in **main.js** calls `init()` on each module.

## Key Design Patterns

- **State vs. presentation split:** `GameState` owns the logical state; `Entities.positionAllEntities()` translates state to 3D positions. After any state change (couple, decouple, move complete), `positionAllEntities()` is called to reconcile.
- **Animation flow:** `handleMove()` in interaction.js calls `GameState.executeMove()` (updates state) then `Animation.animateMove()` (visual). The animation's `onComplete` callback calls `positionAllEntities()` to snap everything to final positions.
- **Track coordinate system:** Each track has a throat (switch end), a fill direction (the direction cars are placed from the loco), and a length. Track A is special — the loco sits at the far end and cars fill back toward the throat; B/C/D have the loco at the throat and cars fill toward the buffer.

## Track Layout

Tracks A and B are colinear at z=0. SP1 at (1,0,0) splits to a 15° diagonal. SP2 splits that diagonal into tracks C (horizontal) and D (continues diagonal). Switch lead = 1 unit between each SP and the nearest throat.

## Positioning Math

The critical function is `Tracks.getLocoStopPosition(trackId, numCoupled, numSidingCars)`. On B/C/D it computes loco placement so the consist's rear edge maintains one inter-car gap from the nearest siding car (or buffer). Siding cars on B/C/D are buffer-packed via `getBufferPackedPosition()`. Both functions use the same constants (0.8 buffer offset, `slotSpacing`, `carSize.x`) — keep them in sync.

## Functional Specification

See `SPEC.md` for detailed game rules, track geometry, entity properties, and all configuration values.
