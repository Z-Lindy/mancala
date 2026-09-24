// gameEngine.js — move validation, sowing, capture, turn-end logic
//
// Only calls named rule functions from rules.js; never inlines rule
// conditionals here, so swapping in a cooperative ruleset later is
// a matter of importing a different rules object.

import { opponentStore, opponent, ownPits } from "./gameState.js";
import { competitiveRules } from "./rules.js";

// Distribute seeds counter-clockwise starting from startIndex, skipping the
// sowing player's opponent's store. Returns the index the last seed landed
// in, plus `path`: the ordered list of indices seeds were dropped into
// (used only by the UI, to animate the sow one hop at a time).
export function sow(state, startIndex, player) {
  let seeds = state.pits[startIndex];
  state.pits[startIndex] = 0;
  const skipIndex = opponentStore(player);

  const path = [];
  let idx = startIndex;
  while (seeds > 0) {
    idx = (idx + 1) % 14;
    if (idx === skipIndex) continue;
    state.pits[idx] += 1;
    path.push(idx);
    seeds -= 1;
  }
  return { lastIndex: idx, path };
}

export function getValidMoves(state, player, rules = competitiveRules) {
  return rules.getValidMoves(state, player);
}

// Play a full turn: sow, apply capture/game-end rules, then pass the turn
// to the opponent. Mutates state and returns a move descriptor describing
// what happened (path, capture, sweep) so the UI can animate it — the
// engine itself has no notion of animation. Throws on an illegal move.
// `rules` selects the active ruleset (competitive by default) — swapping
// it is the only change needed to play a different variant.
export function playMove(state, pitIndex, rules = competitiveRules) {
  if (state.gameOver) {
    throw new Error("Game is already over");
  }
  const player = state.currentPlayer;
  if (!ownPits(player).includes(pitIndex) || state.pits[pitIndex] === 0) {
    throw new Error(`Invalid move: pit ${pitIndex} is not playable for player ${player}`);
  }

  const { lastIndex, path } = sow(state, pitIndex, player);

  let captured = null;
  if (rules.checkCapture(state, lastIndex, player)) {
    captured = { player, ...rules.applyCapture(state, lastIndex, player) };
  }

  state.turnLog.push({ player, pitIndex, lastIndex });

  let sweep = null;
  if (rules.checkGameEnd(state)) {
    sweep = rules.sweepRemaining(state);
    state.gameOver = true;
    state.winner = rules.getWinner(state);
    return { player, pitIndex, path, lastIndex, captured, sweep, gameOver: true, winner: state.winner };
  }

  state.currentPlayer = opponent(player);

  return { player, pitIndex, path, lastIndex, captured, sweep, gameOver: false, winner: null };
}
