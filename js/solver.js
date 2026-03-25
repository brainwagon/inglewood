/**
 * Inglenook Sidings Solver Component
 * 
 * This module provides a clean API for solving the shunting puzzle.
 * It is designed to be easily integrated into graphical front-ends.
 */

class MinHeap {
  constructor() {
    this.heap = [];
  }
  push(node) {
    this.heap.push(node);
    this.bubbleUp();
  }
  pop() {
    if (this.size() === 0) return null;
    if (this.size() === 1) return this.heap.pop();
    const min = this.heap[0];
    this.heap[0] = this.heap.pop();
    this.bubbleDown();
    return min;
  }
  bubbleUp() {
    let index = this.heap.length - 1;
    while (index > 0) {
      let parentIndex = Math.floor((index - 1) / 2);
      if (this.heap[parentIndex].f <= this.heap[index].f) break;
      [this.heap[parentIndex], this.heap[index]] = [this.heap[index], this.heap[parentIndex]];
      index = parentIndex;
    }
  }
  bubbleDown() {
    let index = 0;
    while (true) {
      let left = 2 * index + 1;
      let right = 2 * index + 2;
      let smallest = index;
      if (left < this.heap.length && this.heap[left].f < this.heap[smallest].f) smallest = left;
      if (right < this.heap.length && this.heap[right].f < this.heap[smallest].f) smallest = right;
      if (smallest === index) break;
      [this.heap[smallest], this.heap[index]] = [this.heap[index], this.heap[smallest]];
      index = smallest;
    }
  }
  size() { return this.heap.length; }
}

class State {
  constructor(locomotivePos, tracks, target, parent = null, moveDesc = "", pulledCount = 0) {
    this.locomotivePos = locomotivePos;
    this.tracks = tracks; 
    this.target = target;
    this.parent = parent;
    this.moveDesc = moveDesc;
    this.pulledCount = pulledCount; // Helpful for animation logic
    this.g = parent ? parent.g + 1 : 0;
    this.h = this.calculateHeuristic();
    this.f = this.g + this.h;
  }

  calculateHeuristic() {
    let breaks = 0;

    // 1. Check if locomotive is attached to the first target car
    let attached = (this.locomotivePos === 'A') ? [...this.tracks.A].reverse() : this.tracks[this.locomotivePos];
    if (attached.length === 0 || attached[0] !== this.target[0]) {
      breaks++;
    }

    // 2. Check breaks between adjacent target cars
    for (let i = 0; i < this.target.length - 1; i++) {
      let t1 = this.target[i];
      let t2 = this.target[i+1];
      let foundTogether = false;

      // Sidings (B, C, D): t1 should be immediately before t2
      for (let siding of ['B', 'C', 'D']) {
        let track = this.tracks[siding];
        let idx1 = track.indexOf(t1);
        if (idx1 !== -1 && idx1 + 1 < track.length && track[idx1 + 1] === t2) {
          foundTogether = true;
          break;
        }
      }

      // Headshunt (A): t1 should be immediately AFTER t2 (reversed)
      if (!foundTogether) {
        let trackA = this.tracks.A;
        let idx1 = trackA.indexOf(t1);
        if (idx1 !== -1 && idx1 - 1 >= 0 && trackA[idx1 - 1] === t2) {
          foundTogether = true;
        }
      }

      if (!foundTogether) {
        breaks++;
      }
    }

    // Admissibility: A single push/pull move can fix at most 4 breaks.
    return Math.ceil(breaks / 4);
  }

  isGoal() {
    let attached = (this.locomotivePos === 'A') ? [...this.tracks.A].reverse() : this.tracks[this.locomotivePos];
    if (attached.length < this.target.length) return false;
    for (let i = 0; i < this.target.length; i++) {
      if (attached[i] !== this.target[i]) return false;
    }
    return true;
  }

  getHash() {
    return `${this.locomotivePos}|${this.tracks.A.join(",")}|${this.tracks.B.join(",")}|${this.tracks.C.join(",")}|${this.tracks.D.join(",")}`;
  }

  getNeighbors() {
    const neighbors = [];
    const capacities = { B: 5, C: 3, D: 3 };

    if (this.locomotivePos === 'A') {
      ['B', 'C', 'D'].forEach(siding => {
        const nextTracks = {
          A: [],
          B: this.tracks.B,
          C: this.tracks.C,
          D: this.tracks.D,
          [siding]: [...this.tracks.A, ...this.tracks[siding]]
        };
        neighbors.push(new State(siding, nextTracks, this.target, this, `Push to Siding ${siding}`, 0));
      });
    } else {
      const siding = this.locomotivePos;
      const currentSidingCars = this.tracks[siding];
      for (let k = 0; k <= Math.min(3, currentSidingCars.length); k++) {
        const remainingOnSiding = currentSidingCars.slice(k);
        if (remainingOnSiding.length > capacities[siding]) continue;
        const nextTracks = {
          A: currentSidingCars.slice(0, k),
          B: this.tracks.B,
          C: this.tracks.C,
          D: this.tracks.D,
          [siding]: remainingOnSiding
        };
        neighbors.push(new State('A', nextTracks, this.target, this, `Pull ${k} cars from ${siding}`, k));
      }
    }
    return neighbors;
  }
}

/**
 * Solves the Inglenook Sidings puzzle.
 * 
 * @param {string} targetStr - 5-digit target (e.g., "51237")
 * @param {Object} [initialTracks] - Optional custom starting state
 * @returns {Array|null} Array of move objects or null if unsolvable.
 */
function solvePuzzle(targetStr, initialTracks = null) {
  const target = targetStr.split('').map(Number);
  const startTracks = initialTracks || { A: [], B: [1, 2, 3, 4, 5], C: [6, 7, 8], D: [] };
  
  const initialState = new State('A', startTracks, target);
  const openSet = new MinHeap();
  openSet.push(initialState);
  const closedSet = new Map();

  while (openSet.size() > 0) {
    const current = openSet.pop();
    if (current.isGoal()) return reconstructPath(current);

    const hash = current.getHash();
    if (closedSet.has(hash) && closedSet.get(hash) <= current.g) continue;
    closedSet.set(hash, current.g);

    for (const neighbor of current.getNeighbors()) {
      const nHash = neighbor.getHash();
      if (!closedSet.has(nHash) || closedSet.get(nHash) > neighbor.g) {
        openSet.push(neighbor);
      }
    }
  }
  return null;
}

function reconstructPath(state) {
  const path = [];
  let current = state;
  while (current) {
    // Return a clean object for the consumer
    path.unshift({
      moveDesc: current.moveDesc,
      locomotivePos: current.locomotivePos,
      pulledCount: current.pulledCount,
      tracks: JSON.parse(JSON.stringify(current.tracks)), // Deep copy for UI safety
      isGoal: current.isGoal()
    });
    current = current.parent;
  }
  return path;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { solvePuzzle };
}
