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

const root = document.getElementById("app");
const scrollerRoot = document.getElementById("scroller");
const newGameBtn = document.getElementById("new-game");
const modeHint = document.getElementById("mode-hint");
const modeRadios = document.querySelectorAll('#mode-toggle input[name="mode"]');

function render() {
  modeHint.textContent = MODE_HINTS[mode];

  const viewing = history[viewIndex];
  const isLive = viewIndex === history.length - 1;

  renderBoard({
    displayState: viewing.state,
    rules: RULESETS[mode],
    mode,
    interactive: isLive && !busy,
    playedPit: viewing.move ? viewing.move.pitIndex : null,
    root,
    onPitClick: handlePitClick,
  });

  renderTurnScroller(history, viewIndex, scrollerRoot, handleSeek);
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
}

function handleSeek(index) {
  if (busy) return;
  viewIndex = Math.max(0, Math.min(index, history.length - 1));
  render();
}

function newGame() {
  if (busy) return;
  state = createGameState();
  history = [{ state: cloneState(state), move: null }];
  viewIndex = 0;
  render();
}

newGameBtn.addEventListener("click", newGame);

modeRadios.forEach((radio) => {
  radio.addEventListener("change", (e) => {
    if (busy) return;
    mode = e.target.value;
    newGame();
  });
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
