// rules.js — rule constants + pluggable rule functions
//
// The engine calls these named functions rather than inlining conditionals,
// so a future cooperative ruleset can be dropped in without touching
// gameEngine.js or ui.js. See Section 4 of the scaffold doc.

import { P1_PITS, P2_PITS, ownPits, ownStore } from "./gameState.js";

// Return indices of pits the given player may currently play.
export function getValidMoves(state, player) {
  return ownPits(player).filter((i) => state.pits[i] > 0);
}

// Opposite pit across the board: pits mirror around index 6.
function oppositePit(index) {
  return 12 - index;
}

// 🔄 Cooperative note: most likely rule to redefine — competitive capture
// steals from the opponent; a cooperative capture might pool seeds instead.
export function checkCapture(state, lastIndex, player) {
  const side = ownPits(player);
  if (!side.includes(lastIndex)) return false;
  if (state.pits[lastIndex] !== 1) return false; // pit was empty before this seed
  const opposite = oppositePit(lastIndex);
  return state.pits[opposite] > 0;
}

// Returns capture details (which pit was emptied, and how much moved)
// so the UI can animate it — not needed for the rule logic itself.
export function applyCapture(state, lastIndex, player) {
  const opposite = oppositePit(lastIndex);
  const amount = state.pits[lastIndex] + state.pits[opposite];
  state.pits[lastIndex] = 0;
  state.pits[opposite] = 0;
  state.pits[ownStore(player)] += amount;
  return { pitIndex: lastIndex, oppositeIndex: opposite, amount };
}

// 🔄 Cooperative note: may change to a shared/joint condition.
export function checkGameEnd(state) {
  const p1Empty = P1_PITS.every((i) => state.pits[i] === 0);
  const p2Empty = P2_PITS.every((i) => state.pits[i] === 0);
  return p1Empty || p2Empty;
}

// End-of-game cleanup: sweep whichever side still has seeds into its store.
// Returns how many seeds were swept for each player, for animation.
export function sweepRemaining(state) {
  const swept = { 1: 0, 2: 0 };
  for (const player of [1, 2]) {
    const side = ownPits(player);
    const remaining = side.reduce((sum, i) => sum + state.pits[i], 0);
    if (remaining > 0) {
      for (const i of side) state.pits[i] = 0;
      state.pits[ownStore(player)] += remaining;
    }
    swept[player] = remaining;
  }
  return swept;
}

// 🔄 Cooperative note: will almost certainly be replaced — e.g. "did you
// hit a combined target?" instead of comparing individual store counts.
export function getWinner(state) {
  const p1Score = state.pits[6];
  const p2Score = state.pits[13];
  if (p1Score === p2Score) return "tie";
  return p1Score > p2Score ? 1 : 2;
}

export const competitiveRules = {
  getValidMoves,
  checkCapture,
  applyCapture,
  checkGameEnd,
  sweepRemaining,
  getWinner,
};

// Cooperative variant: sowing and capture mechanics are unchanged — only
// the objective differs. Instead of accumulating more than your opponent,
// both players win together by ending the game with an equal number of
// seeds in each store.
export function getOutcome(state) {
  return state.pits[6] === state.pits[13] ? "success" : "failure";
}

export const cooperativeRules = {
  getValidMoves,
  checkCapture,
  applyCapture,
  checkGameEnd,
  sweepRemaining,
  getWinner: getOutcome,
};
