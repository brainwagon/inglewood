/* ── HUD: Target Consist, Move Counter, Status, Victory ── */

const HUD = (() => {
  let targetCarsEl, moveCounterEl, statusLineEl, victoryEl, victoryMovesEl, errorToastEl;
  let settingsMenuEl, checkSignsEl;
  let targetModalEl, targetModalErrorEl;
  let targetInputs;
  let errorTimeout = null;

  function init() {
    targetCarsEl = document.getElementById('target-cars');
    moveCounterEl = document.getElementById('move-counter');
    statusLineEl = document.getElementById('status-line');
    victoryEl = document.getElementById('victory');
    victoryMovesEl = document.getElementById('victory-moves');
    errorToastEl = document.getElementById('error-toast');
    settingsMenuEl = document.getElementById('settings-menu');
    checkSignsEl = document.getElementById('check-signs');

    document.getElementById('btn-replay-level').addEventListener('click', () => {
      retryGame();
    });
    document.getElementById('btn-new-game').addEventListener('click', () => {
      resetGame();
    });

    // Set Target modal
    targetModalEl = document.getElementById('target-modal');
    targetModalErrorEl = document.getElementById('target-modal-error');
    targetInputs = [1, 2, 3, 4, 5].map(i => document.getElementById(`target-input-${i}`));

    // Auto-advance focus on input
    targetInputs.forEach((inp, idx) => {
      inp.addEventListener('input', () => {
        inp.value = inp.value.replace(/[^1-8]/g, '');
        if (inp.value && idx < 4) targetInputs[idx + 1].focus();
      });
      inp.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !inp.value && idx > 0) {
          targetInputs[idx - 1].focus();
        }
        if (e.key === 'Enter') submitTarget();
        if (e.key === 'Escape') closeTargetModal();
      });
    });

    document.getElementById('btn-set-target').addEventListener('click', openTargetModal);
    document.getElementById('btn-target-ok').addEventListener('click', submitTarget);
    document.getElementById('btn-target-cancel').addEventListener('click', closeTargetModal);

    // Settings logic
    document.getElementById('btn-settings').addEventListener('click', () => {
      settingsMenuEl.classList.toggle('hidden');
    });

    document.getElementById('btn-close-settings').addEventListener('click', () => {
      settingsMenuEl.classList.add('hidden');
    });

    checkSignsEl.addEventListener('change', (e) => {
      Entities.setSignsVisible(e.target.checked);
    });

    renderTarget();
    updateMoves();
    updateStatus();
  }

  function renderTarget() {
    targetCarsEl.innerHTML = '';
    GameState.state.target.forEach((carId) => {
      const el = document.createElement('div');
      el.className = 'target-car';
      const color = new THREE.Color(CONFIG.carColors[carId - 1]);
      el.style.backgroundColor = `#${color.getHexString()}`;
      el.textContent = carId;
      targetCarsEl.appendChild(el);
    });

    // Compute minimum moves via solver and update label
    const targetStr = GameState.state.target.join('');
    const solution = solvePuzzle(targetStr);
    const minMoves = solution ? solution.length - 1 : '?';
    document.getElementById('target-label').textContent =
      `Assemble this train (${minMoves} moves minimum)`;
  }

  function updateMoves() {
    moveCounterEl.textContent = `${LANG.moves}: ${GameState.state.moves}`;
  }

  function makeChip(carId) {
    const chip = document.createElement('div');
    chip.className = 'status-chip';
    const color = new THREE.Color(CONFIG.carColors[carId - 1]);
    chip.style.backgroundColor = `#${color.getHexString()}`;
    chip.textContent = carId;
    return chip;
  }

  function makeStatusRow(label, carIds) {
    const row = document.createElement('div');
    row.className = 'status-row';

    const lbl = document.createElement('span');
    lbl.className = 'status-label';
    lbl.textContent = label;
    row.appendChild(lbl);

    if (carIds.length === 0) {
      const empty = document.createElement('span');
      empty.className = 'status-empty';
      empty.textContent = '—';
      row.appendChild(empty);
    } else {
      const chips = document.createElement('div');
      chips.className = 'status-chips';
      carIds.forEach(id => chips.appendChild(makeChip(id)));
      row.appendChild(chips);
    }
    return row;
  }

  function updateStatus() {
    const st = GameState.state;
    statusLineEl.innerHTML = '';

    // Loco track header
    const header = document.createElement('div');
    header.className = 'status-row';
    const hlbl = document.createElement('span');
    hlbl.className = 'status-label';
    hlbl.textContent = `Loco on ${st.locoTrack}`;
    header.appendChild(hlbl);
    statusLineEl.appendChild(header);

    statusLineEl.appendChild(makeStatusRow('Coupled:', st.coupled));
    statusLineEl.appendChild(makeStatusRow('On siding:', st.sidings[st.locoTrack]));
  }

  function showVictory() {
    victoryMovesEl.textContent = LANG.completedIn.replace('{n}', GameState.state.moves);
    victoryEl.classList.remove('hidden');
    spawnConfetti();
  }

  function hideVictory() {
    victoryEl.classList.add('hidden');
    clearConfetti();
  }

  // ── Confetti ──
  let confettiContainer = null;
  let confettiRAF = null;

  function clearConfetti() {
    if (confettiRAF) { cancelAnimationFrame(confettiRAF); confettiRAF = null; }
    if (confettiContainer) { confettiContainer.remove(); confettiContainer = null; }
  }

  function spawnConfetti() {
    clearConfetti();

    confettiContainer = document.createElement('div');
    confettiContainer.style.cssText =
      'position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:11;';
    victoryEl.parentElement.appendChild(confettiContainer);

    const colors = ['#ffd700', '#e53935', '#1e88e5', '#43a047', '#fb8c00',
                    '#8e24aa', '#00acc1', '#d81b60', '#ff6f00', '#fff'];
    const pieces = [];
    const count = 120;

    for (let i = 0; i < count; i++) {
      const el = document.createElement('div');
      const w = 6 + Math.random() * 6;
      const h = w * (0.5 + Math.random());
      const color = colors[Math.floor(Math.random() * colors.length)];
      el.style.cssText =
        `position:absolute;width:${w}px;height:${h}px;background:${color};` +
        `border-radius:${Math.random() > 0.5 ? '50%' : '2px'};opacity:1;`;
      confettiContainer.appendChild(el);

      pieces.push({
        el,
        x: Math.random() * window.innerWidth,
        y: -20 - Math.random() * 300,
        vx: (Math.random() - 0.5) * 6,
        vy: 2 + Math.random() * 4,
        spin: (Math.random() - 0.5) * 10,
        angle: Math.random() * 360,
        wobble: Math.random() * Math.PI * 2,
        wobbleSpeed: 0.03 + Math.random() * 0.05,
        opacity: 1,
      });
    }

    const bottom = window.innerHeight + 40;
    let settled = 0;

    function tick() {
      for (const p of pieces) {
        if (p.opacity <= 0) continue;
        p.vy += 0.12;                        // gravity
        p.vx *= 0.99;                        // air drag
        p.vy *= 0.99;
        p.wobble += p.wobbleSpeed;
        p.x += p.vx + Math.sin(p.wobble) * 0.8;
        p.y += p.vy;
        p.angle += p.spin;

        if (p.y > bottom) {
          p.opacity = 0;
          p.el.style.display = 'none';
          settled++;
        } else {
          p.el.style.transform =
            `translate(${p.x}px,${p.y}px) rotate(${p.angle}deg)`;
        }
      }

      if (settled < count) {
        confettiRAF = requestAnimationFrame(tick);
      } else {
        clearConfetti();
      }
    }

    confettiRAF = requestAnimationFrame(tick);
  }

  function showError(message) {
    errorToastEl.textContent = message;
    errorToastEl.classList.remove('hidden');
    if (errorTimeout) clearTimeout(errorTimeout);
    errorTimeout = setTimeout(() => {
      errorToastEl.classList.add('hidden');
    }, 1500);
  }

  function retryGame() {
    hideVictory();
    GameState.retry();
    Entities.positionAllEntities();
    updateMoves();
    updateStatus();
    if (Interaction.updateMoveButtons) Interaction.updateMoveButtons();
  }

  function resetGame() {
    hideVictory();
    GameState.init();
    Entities.positionAllEntities();
    renderTarget();
    updateMoves();
    updateStatus();
    if (Interaction.updateMoveButtons) Interaction.updateMoveButtons();
  }

  function openTargetModal() {
    targetInputs.forEach(inp => { inp.value = ''; });
    targetModalErrorEl.classList.add('hidden');
    targetModalEl.classList.remove('hidden');
    targetInputs[0].focus();
  }

  function closeTargetModal() {
    targetModalEl.classList.add('hidden');
  }

  function submitTarget() {
    const values = targetInputs.map(inp => parseInt(inp.value, 10));

    // Validate: all must be numbers 1-8
    if (values.some(v => isNaN(v) || v < 1 || v > 8)) {
      targetModalErrorEl.textContent = 'Each car must be a number from 1 to 8';
      targetModalErrorEl.classList.remove('hidden');
      return;
    }

    // Validate: all unique
    if (new Set(values).size !== 5) {
      targetModalErrorEl.textContent = 'All 5 car numbers must be different';
      targetModalErrorEl.classList.remove('hidden');
      return;
    }

    closeTargetModal();
    hideVictory();
    GameState.retry();
    GameState.state.target = values;
    Entities.positionAllEntities();
    renderTarget();
    updateMoves();
    updateStatus();
    if (Interaction.updateMoveButtons) Interaction.updateMoveButtons();
  }

  return { init, renderTarget, updateMoves, updateStatus, showVictory, hideVictory, showError, retryGame, resetGame };
})();
