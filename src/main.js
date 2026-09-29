// main.js — entry point, wires up UI + game engine

import { createGameState, cloneState } from "./gameState.js";
import { playMove } from "./gameEngine.js";
import { competitiveRules, cooperativeRules } from "./rules.js";
import { renderBoard, renderTurnScroller, playMoveAnimation } from "./ui.js";

const RULESETS = { competitive: competitiveRules, cooperative: cooperativeRules };
const MODE_HINTS = {
  competitive: "Capture and out-score your opponent.",
  cooperative: "Work together — the game is won when both stores end up equal.",
};

let mode = "competitive";
let state = createGameState();

// Turn history for the scroller: an array of { state, move } snapshots,
// independent of the live `state` so rewinding never mutates gameplay.
// history[0] is always the game-start snapshot (move: null).
let history = [{ state: cloneState(state), move: null }];
let viewIndex = 0;

// True while a move's seed-sprite animation is playing — input is ignored
// so a rewind or a second move can't interrupt mid-flight.
let busy = false;

// Assist mode (Cooperative only): highlights the pit its search thinks
// gives the best shot at an equal-seed ending. The search runs in a Web
// Worker (src/solver.worker.js) since a strong suggestion can take up to
// ~1.5s — off the main thread so it never freezes the board or animations.
let assistEnabled = false;
let suggestedPit = null;
let assistRequestId = 0;
let solverWorker = null;

const root = document.getElementById("app");
const scrollerRoot = document.getElementById("scroller");
const newGameBtn = document.getElementById("new-game");
const modeHint = document.getElementById("mode-hint");
const modeRadios = document.querySelectorAll('#mode-toggle input[name="mode"]');
const assistToggleWrap = document.getElementById("assist-toggle");
const assistCheckbox = document.getElementById("assist-checkbox");
const assistStatus = document.getElementById("assist-status");

function render() {
  modeHint.textContent = MODE_HINTS[mode];
  assistToggleWrap.hidden = mode !== "cooperative";

  const viewing = history[viewIndex];
  const isLive = viewIndex === history.length - 1;

  renderBoard({
    displayState: viewing.state,
    rules: RULESETS[mode],
    mode,
    interactive: isLive && !busy,
    playedPit: viewing.move ? viewing.move.pitIndex : null,
    suggestedPit: isLive ? suggestedPit : null, // never show a hint while browsing history
    root,
    onPitClick: handlePitClick,
  });

  renderTurnScroller(history, viewIndex, scrollerRoot, handleSeek);
}

function ensureSolverWorker() {
  if (solverWorker) return;
  solverWorker = new Worker(new URL("./solver.worker.js", import.meta.url), { type: "module" });
  solverWorker.onmessage = (e) => {
    const { requestId, move } = e.data;
    if (requestId !== assistRequestId) return; // a newer request superseded this one
    suggestedPit = move;
    assistStatus.textContent =
      move === null ? "No move to suggest." : `Suggests pit ${move} for Player ${state.currentPlayer}.`;
    render();
  };
}

// Kicks off (or clears) an Assist suggestion for whoever's turn it is now.
// Called after anything that changes what should be suggested: a move
// finishing, rewinding through history, a new game, or toggling Assist.
function updateAssistSuggestion() {
  const isLive = viewIndex === history.length - 1;
  const applicable = mode === "cooperative" && assistEnabled && isLive && !state.gameOver && !busy;

  assistRequestId++; // invalidate any suggestion already in flight
  suggestedPit = null;
  assistStatus.hidden = !applicable;

  if (!applicable) {
    render();
    return;
  }

  assistStatus.textContent = "Thinking of the best move…";
  render();

  ensureSolverWorker();
  solverWorker.postMessage({
    requestId: assistRequestId,
    mode,
    state: {
      pits: state.pits.slice(),
      currentPlayer: state.currentPlayer,
      gameOver: state.gameOver,
      winner: state.winner,
    },
  });
}

async function handlePitClick(index) {
  if (busy) return;

  const preMovePits = state.pits.slice();
  let moveResult;
  try {
    moveResult = playMove(state, index, RULESETS[mode]);
  } catch (err) {
    console.error(err.message);
    return;
  }

  history.push({ state: cloneState(state), move: moveResult });

  busy = true;
  await playMoveAnimation({ root, moveResult, preMovePits });
  busy = false;

  viewIndex = history.length - 1;
  render();
  updateAssistSuggestion();
}

function handleSeek(index) {
  if (busy) return;
  viewIndex = Math.max(0, Math.min(index, history.length - 1));
  render();
  updateAssistSuggestion();
}

function newGame() {
  if (busy) return;
  state = createGameState();
  history = [{ state: cloneState(state), move: null }];
  viewIndex = 0;
  render();
  updateAssistSuggestion();
}

newGameBtn.addEventListener("click", newGame);

modeRadios.forEach((radio) => {
  radio.addEventListener("change", (e) => {
    if (busy) return;
    mode = e.target.value;
    newGame();
  });
});

assistCheckbox.addEventListener("change", () => {
  assistEnabled = assistCheckbox.checked;
  updateAssistSuggestion();
});

// Rules content lives once in the page as a <template> and is cloned into
// both the pre-play popup and the persistent reference panel below the board.
function fillRulesContainers() {
  const template = document.getElementById("rules-template");
  document.querySelectorAll(".rules-content").forEach((el) => {
    el.appendChild(template.content.cloneNode(true));
  });
}

function setupRulesModal() {
  const modal = document.getElementById("rules-modal");
  const closeBtn = document.getElementById("rules-modal-close");

  const close = () => {
    modal.hidden = true;
    document.body.style.overflow = "";
  };

  closeBtn.addEventListener("click", close);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) close();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.hidden) close();
  });

  modal.hidden = false;
  document.body.style.overflow = "hidden";
}

fillRulesContainers();
setupRulesModal();
render();
updateAssistSuggestion();
