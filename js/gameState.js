/* ── Game State Management ── */

const GameState = (() => {
  const state = {
    sidings: { A: [], B: [], C: [], D: [] },
    locoTrack: 'A',
    coupled: [],
    target: [],
    moves: 0,
    won: false,
  };

  function init() {
    const allCars = [];
    for (let i = 1; i <= CONFIG.totalCars; i++) allCars.push(i);

    // Fixed starting positions for clarity
    state.sidings.A = [];
    state.sidings.B = [1, 2, 3, 4, 5];
    state.sidings.C = [6, 7, 8];
    state.sidings.D = [];
    state.locoTrack = 'A';
    state.coupled = [];
    state.moves = 0;
    state.won = false;

    // Generate target: pick 5 of 8 in random order
    state.target = generateTarget(allCars);
  }

  function generateTarget(allCars) {
    const copy = [...allCars];
    shuffle(copy);
    return copy.slice(0, CONFIG.targetSize);
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // Couple one car from the current siding (nearest to SP / front of array)
  function coupleOne() {
    const siding = state.sidings[state.locoTrack];
    if (siding.length === 0) return { ok: false, reason: LANG.noCars };
    if (state.coupled.length >= CONFIG.targetSize)
      return { ok: false, reason: LANG.alreadyFull };

    // Take the car nearest to the loco (throat end).
    // For B/C/D (loco at left): throat-nearest = first element (shift)
    // For A (loco at right): throat-nearest = last element (pop)
    const car = (state.locoTrack === 'A') ? siding.pop() : siding.shift();
    state.coupled.push(car);
    return { ok: true };
  }

  // Decouple all coupled cars onto the current siding
  function decoupleAll() {
    if (state.coupled.length === 0) return { ok: false, reason: 'No coupled cars' };
    if (state.locoTrack === 'A')
      return { ok: false, reason: 'Cannot decouple on the headshunt' };

    const siding = state.sidings[state.locoTrack];

    // Decoupling is always allowed — capacity is enforced when leaving the siding.
    // Drop cars at the throat end of the siding
    // coupled[0] is nearest to loco (throat side), so unshift in order
    siding.unshift(...state.coupled);
    state.coupled = [];
    return { ok: true };
  }

  // Check if loco + coupled cars can move to the target track
  function canMove(toTrack) {
    if (toTrack === state.locoTrack) return false;
    // From B/C/D you can only move to A (headshunt)
    if (state.locoTrack !== 'A' && toTrack !== 'A') return false;

    if (state.locoTrack === 'A') {
      // A → siding: coupled cars must not exceed the destination siding's capacity
      return state.coupled.length + state.sidings[toTrack].length <= CONFIG.trackCapacity[toTrack];
    } else {
      // Siding → A: cars left behind must fit within siding capacity,
      // and coupled cars must not exceed A's capacity
      return state.sidings[state.locoTrack].length <= CONFIG.trackCapacity[state.locoTrack]
        && state.coupled.length <= CONFIG.trackCapacity.A;
    }
  }

  // Execute a move to the target track
  function executeMove(toTrack) {
    if (!canMove(toTrack)) return { ok: false, reason: LANG.noRoom };

    state.locoTrack = toTrack;
    state.moves++;

    // Coupled cars are placed at the SP-end of the destination
    // (but they stay coupled, not dropped)
    // They only get placed when decoupled.

    return { ok: true };
  }

  // Check win condition: all target cars are coupled to the loco in exact order
  function checkWin() {
    if (state.coupled.length !== CONFIG.targetSize) return false;

    for (let i = 0; i < CONFIG.targetSize; i++) {
      if (state.coupled[i] !== state.target[i]) return false;
    }
    state.won = true;
    return true;
  }

  return {
    state,
    init,
    coupleOne,
    decoupleAll,
    canMove,
    executeMove,
    checkWin,
  };
})();
