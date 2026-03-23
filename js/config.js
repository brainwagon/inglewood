/* ── Constants & Configuration ── */

const CONFIG = {
  // Track capacities (cars only; loco doesn't count against capacity)
  trackCapacity: { A: 3, B: 5, C: 3, D: 3 },

  // Total cars in the game
  totalCars: 8,
  targetSize: 5,

  // Car dimensions
  carSize: { x: 1.6, y: 0.8, z: 0.8 },
  locoSize: { x: 2.0, y: 1.0, z: 0.8 },
  slotSpacing: 2.2,

  // Colors
  locoColor: 0xffcc00,
  carColors: [
    0xe53935, // 1 - red
    0x1e88e5, // 2 - blue
    0x43a047, // 3 - green
    0xfb8c00, // 4 - orange
    0x8e24aa, // 5 - purple
    0x00acc1, // 6 - cyan
    0x6d4c41, // 7 - brown
    0xd81b60, // 8 - pink
  ],

  // Camera
  cameraPosition: { x: 0, y: 28, z: 22 },
  cameraLookAt: { x: 2, y: 0, z: 3 },

  // Animation
  moveSpeed: 1.5, // seconds per segment

  // Ground
  groundSize: 60,
  groundColor: 0x4a4a4a,
};

// Internationalization strings
const STRINGS = {
  en: {
    targetConsist: 'Target Consist',
    moves: 'Moves',
    couple: 'Couple',
    decouple: 'Decouple',
    newGame: 'New Game',
    victory: 'Victory!',
    playAgain: 'Play Again',
    completedIn: 'Completed in {n} moves',
    noRoom: 'Not enough room!',
    noCars: 'No cars to couple!',
    alreadyFull: 'Loco is full (max 5 cars)',
  },
};

// Active language
const LANG = STRINGS.en;
