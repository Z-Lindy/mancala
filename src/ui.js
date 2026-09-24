// ui.js — rendering, DOM updates, event handlers, seed-sprite animation

import { P1_PITS, P2_PITS, P1_STORE, P2_STORE } from "./gameState.js";

const PIT_CAP = 12;
const STORE_CAP = 10;

// Fixed scatter layout for seed dots inside a pit (percent offsets, filled
// in this order as the count grows) so seeds stay put between renders
// instead of jumping to new spots.
const PIT_SLOTS = [
  { x: 50, y: 50 },
  { x: 61.3, y: 61.3 },
  { x: 38.7, y: 61.3 },
  { x: 38.7, y: 38.7 },
  { x: 61.3, y: 38.7 },
  { x: 84, y: 50 },
  { x: 74, y: 74 },
  { x: 50, y: 84 },
  { x: 26, y: 74 },
  { x: 16, y: 50 },
  { x: 26, y: 26 },
  { x: 50, y: 16 },
];

// Fixed pile layout for seed dots inside a store, filled bottom-up.
const STORE_SLOTS = [
  { x: 35, y: 83 }, { x: 65, y: 83 },
  { x: 35, y: 66 }, { x: 65, y: 66 },
  { x: 35, y: 49 }, { x: 65, y: 49 },
  { x: 35, y: 32 }, { x: 65, y: 32 },
  { x: 35, y: 15 }, { x: 65, y: 15 },
];

// Builds the sprite layer for a pit/store: a dot per seed (up to `cap`),
// plus a "+N" badge for anything beyond that. `popLast: true` marks the
// most-recently-added dot so it plays a landing animation — used only
// when updating a single pit mid-animation, never on a full static render.
function buildSeedLayer(count, slots, cap, { popLast = false } = {}) {
  const layer = document.createElement("div");
  layer.className = "seed-layer";
  const shown = Math.min(count, cap);
  for (let i = 0; i < shown; i++) {
    const seed = document.createElement("div");
    seed.className = "seed";
    if (popLast && i === shown - 1) seed.classList.add("seed--pop");
    seed.style.left = `${slots[i].x}%`;
    seed.style.top = `${slots[i].y}%`;
    layer.appendChild(seed);
  }
  if (count > cap) {
    const badge = document.createElement("div");
    badge.className = "seed-overflow";
    badge.textContent = `+${count - cap}`;
    layer.appendChild(badge);
  }
  return layer;
}

// `displayState` is whatever snapshot should currently be shown (live state,
// or a past turn from history). `interactive` gates whether pits are
// clickable — false while rewinding through history. `playedPit` highlights
// the pit that produced this snapshot, if any.
export function renderBoard({ displayState, rules, mode, interactive, playedPit, root, onPitClick }) {
  root.innerHTML = "";

  const board = document.createElement("div");
  board.className = "board";

  board.appendChild(renderStore(displayState, 2, "left"));
  board.appendChild(renderPitRows(displayState, rules, interactive, playedPit, onPitClick));
  board.appendChild(renderStore(displayState, 1, "right"));

  root.appendChild(board);
  root.appendChild(renderStatus(displayState, mode));
}

function renderStore(state, player, side) {
  const storeIndex = player === 1 ? P1_STORE : P2_STORE;
  const count = state.pits[storeIndex];

  const el = document.createElement("div");
  el.className = `store store--${side}`;
  el.dataset.player = String(player);

  const label = document.createElement("div");
  label.className = "store__label";
  label.textContent = `P${player} Store`;

  const seeds = buildSeedLayer(count, STORE_SLOTS, STORE_CAP);
  seeds.classList.add("store__seeds");

  const countEl = document.createElement("div");
  countEl.className = "store__count";
  countEl.textContent = String(count);

  el.appendChild(label);
  el.appendChild(seeds);
  el.appendChild(countEl);
  return el;
}

function renderPitRows(state, rules, interactive, playedPit, onPitClick) {
  const wrap = document.createElement("div");
  wrap.className = "pit-rows";

  const validMoves =
    interactive && !state.gameOver ? rules.getValidMoves(state, state.currentPlayer) : [];

  // Top row: Player 2 pits, displayed right-to-left (12 -> 7)
  const topRow = document.createElement("div");
  topRow.className = "pit-row pit-row--top";
  for (let i = P2_PITS.length - 1; i >= 0; i--) {
    topRow.appendChild(renderPit(state, P2_PITS[i], validMoves, playedPit, onPitClick));
  }

  // Bottom row: Player 1 pits, left-to-right (0 -> 5)
  const bottomRow = document.createElement("div");
  bottomRow.className = "pit-row pit-row--bottom";
  for (const i of P1_PITS) {
    bottomRow.appendChild(renderPit(state, i, validMoves, playedPit, onPitClick));
  }

  wrap.appendChild(topRow);
  wrap.appendChild(bottomRow);
  return wrap;
}

function renderPit(state, index, validMoves, playedPit, onPitClick) {
  const count = state.pits[index];
  const pit = document.createElement("button");
  pit.className = "pit";
  pit.type = "button";
  pit.dataset.index = String(index);
  pit.setAttribute("aria-label", `Pit with ${count} seed${count === 1 ? "" : "s"}`);
  pit.appendChild(buildSeedLayer(count, PIT_SLOTS, PIT_CAP));

  if (index === playedPit) {
    pit.classList.add("pit--played");
  }

  const playable = validMoves.includes(index);
  pit.disabled = !playable;
  if (playable) {
    pit.classList.add("pit--valid");
    pit.addEventListener("click", () => onPitClick(index));
  }

  return pit;
}

function renderStatus(state, mode) {
  const status = document.createElement("div");
  status.className = "status";

  if (state.gameOver) {
    const outcomeText =
      mode === "cooperative"
        ? state.winner === "success"
          ? `You did it — ${state.pits[P1_STORE]} seeds each!`
          : `Not quite — ${state.pits[P1_STORE]} vs ${state.pits[P2_STORE]}. Try again!`
        : state.winner === "tie"
          ? "It's a tie!"
          : `Player ${state.winner} wins!`;
    status.innerHTML = `<div class="status__gameover">Game over — ${outcomeText}</div>`;
  } else {
    status.innerHTML = `<div class="status__turn">Player ${state.currentPlayer}'s turn</div>`;
  }

  return status;
}

// Turn scroller: lets the viewer step/scrub through the game's history
// without affecting the live game. `history` is an array of
// { state, move } entries (see main.js); `viewIndex` is the entry
// currently displayed.
export function renderTurnScroller(history, viewIndex, root, onSeek) {
  root.innerHTML = "";

  const isLive = viewIndex === history.length - 1;
  const entry = history[viewIndex];

  const bar = document.createElement("div");
  bar.className = "scroller";

  bar.appendChild(scrollerButton("⏮", () => onSeek(0), viewIndex === 0));
  bar.appendChild(scrollerButton("◀ Prev", () => onSeek(viewIndex - 1), viewIndex === 0));

  const slider = document.createElement("input");
  slider.type = "range";
  slider.min = "0";
  slider.max = String(history.length - 1);
  slider.value = String(viewIndex);
  slider.className = "scroller__slider";
  slider.disabled = history.length === 1;
  slider.addEventListener("input", (e) => onSeek(Number(e.target.value)));
  bar.appendChild(slider);

  bar.appendChild(scrollerButton("Next ▶", () => onSeek(viewIndex + 1), isLive));
  bar.appendChild(scrollerButton("Latest ⏭", () => onSeek(history.length - 1), isLive));

  root.appendChild(bar);

  const label = document.createElement("div");
  label.className = "scroller__label";
  const moveText = entry.move ? `P${entry.move.player} played pit ${entry.move.pitIndex}` : "Game start";
  label.textContent = `Turn ${viewIndex} of ${history.length - 1} — ${moveText}`;
  root.appendChild(label);

  if (!isLive) {
    const hint = document.createElement("div");
    hint.className = "scroller__hint";
    hint.textContent = "Viewing history — moves are disabled here. Jump to Latest to keep playing.";
    root.appendChild(hint);
  }
}

function scrollerButton(text, onClick, disabled) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = text;
  btn.disabled = disabled;
  btn.className = "scroller__btn";
  btn.addEventListener("click", onClick);
  return btn;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function centerRelativeTo(el, ancestorRect) {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2 - ancestorRect.left, y: r.top + r.height / 2 - ancestorRect.top };
}

// Animates one seed sprite flying from `fromEl` to `toEl` within `board`,
// with a slight upward arc. `label`, when given, renders a small "+N"
// batch pill instead of a plain dot (used for captures/sweeps, where many
// seeds move at once and animating each individually isn't worth it).
function flySeed(layer, board, fromEl, toEl, { size = 16, duration = 160, label = null } = {}) {
  const boardRect = board.getBoundingClientRect();
  const from = centerRelativeTo(fromEl, boardRect);
  const to = centerRelativeTo(toEl, boardRect);

  const seed = document.createElement("div");
  seed.className = label ? "flying-seed flying-seed--batch" : "flying-seed";
  seed.style.width = `${size}px`;
  seed.style.height = `${size}px`;
  if (label) seed.textContent = label;
  layer.appendChild(seed);

  const midY = (from.y + to.y) / 2 - Math.min(40, 20 + Math.abs(to.x - from.x) * 0.15);

  const anim = seed.animate(
    [
      { left: `${from.x}px`, top: `${from.y}px`, offset: 0 },
      { left: `${(from.x + to.x) / 2}px`, top: `${midY}px`, offset: 0.5 },
      { left: `${to.x}px`, top: `${to.y}px`, offset: 1 },
    ],
    { duration, easing: "ease-in-out", fill: "forwards" }
  );

  // Race against a timeout: a backgrounded tab can defer WAAPI's finished
  // promise indefinitely (the animation itself still completes visually,
  // but Chrome delays resolving the promise until the tab is visible
  // again), and a stuck promise here would freeze the whole game.
  return Promise.race([anim.finished.catch(() => {}), wait(duration + 400)]).then(() => seed.remove());
}

// Plays the full visual sequence for a move: seeds hop one at a time along
// the sow path, then (if applicable) a capture or end-of-game sweep flies
// a batch of seeds into the relevant store. Mutates only the DOM, not any
// game state — `main.js` re-renders from the authoritative state once this
// resolves. `preMovePits` is the board's pit counts *before* the move.
export async function playMoveAnimation({ root, moveResult, preMovePits }) {
  const board = root.querySelector(".board");
  if (!board) return;

  board.classList.add("board--animating");
  board.querySelectorAll(".pit").forEach((el) => {
    el.classList.remove("pit--valid");
    el.disabled = true;
  });

  const layer = document.createElement("div");
  layer.className = "flight-layer";
  board.appendChild(layer);

  const pits = [...preMovePits];
  const { player, pitIndex, path, captured, sweep } = moveResult;

  const getPitEl = (i) => board.querySelector(`.pit[data-index="${i}"]`);
  const getStoreEl = (p) => board.querySelector(`.store[data-player="${p}"]`);
  const elementForIndex = (idx) => (idx === 6 ? getStoreEl(1) : idx === 13 ? getStoreEl(2) : getPitEl(idx));

  const updatePitDisplay = (i, { pop = false } = {}) => {
    const el = getPitEl(i);
    if (!el) return;
    const oldLayer = el.querySelector(".seed-layer");
    const newLayer = buildSeedLayer(pits[i], PIT_SLOTS, PIT_CAP, { popLast: pop });
    if (oldLayer) el.replaceChild(newLayer, oldLayer);
    else el.appendChild(newLayer);
    el.setAttribute("aria-label", `Pit with ${pits[i]} seed${pits[i] === 1 ? "" : "s"}`);
  };

  const updateStoreDisplay = (p) => {
    const el = getStoreEl(p);
    if (!el) return;
    const storeIndex = p === 1 ? 6 : 13;
    const count = pits[storeIndex];
    const oldLayer = el.querySelector(".store__seeds");
    const newLayer = buildSeedLayer(count, STORE_SLOTS, STORE_CAP, { popLast: true });
    newLayer.classList.add("store__seeds");
    if (oldLayer) el.replaceChild(newLayer, oldLayer);
    const countEl = el.querySelector(".store__count");
    if (countEl) countEl.textContent = String(count);
  };

  // 1. Pick up: empty the source pit with a little squash.
  pits[pitIndex] = 0;
  updatePitDisplay(pitIndex);
  const sourceEl = getPitEl(pitIndex);
  if (sourceEl) {
    sourceEl.animate(
      [{ transform: "scale(1)" }, { transform: "scale(0.88)" }, { transform: "scale(1)" }],
      { duration: 180, easing: "ease-out" }
    );
  }
  await wait(120);

  // 2. Sow: hop one seed at a time along the path, speeding up for long sows
  // so the whole hop sequence stays roughly a consistent length.
  const hopMs = Math.max(70, Math.min(220, Math.round(1400 / Math.max(path.length, 1))));
  let currentIndex = pitIndex;
  for (const idx of path) {
    const fromEl = elementForIndex(currentIndex);
    const toEl = elementForIndex(idx);
    if (fromEl && toEl) {
      await flySeed(layer, board, fromEl, toEl, { duration: hopMs });
    }
    pits[idx] += 1;
    if (idx === 6 || idx === 13) {
      updateStoreDisplay(idx === 6 ? 1 : 2);
    } else {
      updatePitDisplay(idx, { pop: true });
    }
    currentIndex = idx;
  }

  // 3. Capture: fade the two source pits, then fly a labeled batch into
  // the mover's store.
  if (captured) {
    const { pitIndex: capPit, oppositeIndex, amount } = captured;
    for (const idx of [capPit, oppositeIndex]) {
      const seedLayerEl = getPitEl(idx)?.querySelector(".seed-layer");
      seedLayerEl?.animate(
        [{ opacity: 1, transform: "scale(1)" }, { opacity: 0, transform: "scale(0.4)" }],
        { duration: 200, easing: "ease-in", fill: "forwards" }
      );
    }
    await wait(220);
    pits[capPit] = 0;
    pits[oppositeIndex] = 0;
    updatePitDisplay(capPit);
    updatePitDisplay(oppositeIndex);

    const fromEl = getPitEl(oppositeIndex) || getPitEl(capPit);
    const toEl = getStoreEl(player);
    if (fromEl && toEl) {
      await flySeed(layer, board, fromEl, toEl, { duration: 260, size: 22, label: `+${amount}` });
    }
    const storeIdx = player === 1 ? 6 : 13;
    pits[storeIdx] += amount;
    updateStoreDisplay(player);
    getStoreEl(player)?.animate(
      [{ transform: "scale(1)" }, { transform: "scale(1.08)" }, { transform: "scale(1)" }],
      { duration: 260, easing: "ease-out" }
    );
    await wait(150);
  }

  // 4. End-of-game sweep: fade remaining seeds on each non-empty side,
  // then fly a labeled batch into that side's store.
  if (sweep) {
    for (const p of [1, 2]) {
      if (sweep[p] <= 0) continue;
      const side = p === 1 ? [0, 1, 2, 3, 4, 5] : [7, 8, 9, 10, 11, 12];
      for (const idx of side) {
        getPitEl(idx)?.querySelector(".seed-layer")?.animate(
          [{ opacity: 1 }, { opacity: 0 }],
          { duration: 180, fill: "forwards" }
        );
      }
    }
    await wait(200);
    for (const p of [1, 2]) {
      const side = p === 1 ? [0, 1, 2, 3, 4, 5] : [7, 8, 9, 10, 11, 12];
      for (const idx of side) {
        pits[idx] = 0;
        updatePitDisplay(idx);
      }
      if (sweep[p] > 0) {
        const fromEl = getPitEl(side[Math.floor(side.length / 2)]);
        const toEl = getStoreEl(p);
        if (fromEl && toEl) {
          await flySeed(layer, board, fromEl, toEl, { duration: 300, size: 24, label: `+${sweep[p]}` });
        }
        const storeIdx = p === 1 ? 6 : 13;
        pits[storeIdx] += sweep[p];
        updateStoreDisplay(p);
      }
    }
    await wait(150);
  }

  layer.remove();
  board.classList.remove("board--animating");
}
