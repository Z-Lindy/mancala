// solver.js — Cooperative-mode move assistant
//
// In Cooperative mode both players share one objective (end the game with
// equal seeds in each store), so this is not adversarial minimax: at every
// node, regardless of whose turn it is, we just pick whichever move leads
// to the best reachable outcome for that one shared objective.
//
// The exact game tree is far too large to solve fully from an early
// position — turns don't grant extra moves in this build, but a game still
// runs 30-50 plies deep with a branching factor up to 6, which is many
// orders of magnitude beyond what a browser can exhaustively search live.
// So this does a bounded, iterative-deepening search within a time budget
// and falls back to a heuristic estimate at the cutoff depth. It's a strong
// look-ahead assistant — not a mathematically-proven-optimal solver — and
// it only ever advises whoever's turn it currently is.

import { P1_PITS, P2_PITS, P1_STORE, P2_STORE } from "./gameState.js";
import { playMove, getValidMoves } from "./gameEngine.js";

const PERFECT_SCORE = 0; // stores exactly equal — nothing beats this

function cloneForSearch(state) {
  return {
    pits: state.pits.slice(),
    currentPlayer: state.currentPlayer,
    gameOver: state.gameOver,
    winner: state.winner,
    turnLog: [],
  };
}

// Exact score for a finished game: 0 (equal stores) down to -48 (worst case).
function exactScore(state) {
  return -Math.abs(state.pits[P1_STORE] - state.pits[P2_STORE]);
}

// Heuristic for a cutoff (non-terminal) node: "if every seed still on the
// board settled on its own side right now, with no more capturing or
// sowing, how far apart would the stores be?" Cheap to compute, and it
// converges to the exact score as the board empties toward the real end
// of the game, so deeper searches naturally get more accurate for free.
function heuristicScore(state) {
  const p1Total = state.pits[P1_STORE] + P1_PITS.reduce((sum, i) => sum + state.pits[i], 0);
  const p2Total = state.pits[P2_STORE] + P2_PITS.reduce((sum, i) => sum + state.pits[i], 0);
  return -Math.abs(p1Total - p2Total);
}

// Different move orders often reach the identical board position
// (transpositions) — memoizing search results by that position cuts out a
// huge amount of redundant work and is what makes a genuinely deep search
// affordable at all. Keyed by pit contents + whose turn it is; the cached
// result is only reusable if it was computed at least as deep as what's
// being asked for now.
function stateKey(state) {
  return state.pits.join(",") + "|" + state.currentPlayer;
}

// `exact: true` means `score` came from an actual finished game somewhere
// in this line of play — a proven outcome. `exact: false` means it's only
// the cutoff heuristic's guess. This distinction matters: a heuristic that
// happens to read 0 (looks perfectly balanced *right now*) is not the same
// as a verified equal-stores ending, and treating them the same was the
// bug in an earlier version of this search — it made iterative deepening
// declare victory on a shallow, unverified guess and stop looking, which
// consistently produced worse real outcomes than searching properly would.
function search(state, rules, depth, deadline, tt) {
  if (state.gameOver) {
    return { score: exactScore(state), move: null, exact: true };
  }
  if (depth === 0 || performance.now() > deadline) {
    return { score: heuristicScore(state), move: null, exact: false };
  }

  const key = stateKey(state);
  const cached = tt.get(key);
  if (cached && cached.depth >= depth) return cached;

  const moves = getValidMoves(state, state.currentPlayer, rules);

  // Try the most promising-looking moves first (by their immediate
  // heuristic value) so the "already proven perfect, stop looking" cutoff
  // below fires as early as possible.
  const candidates = moves.map((m) => {
    const child = cloneForSearch(state);
    playMove(child, m, rules);
    return { m, child, quickScore: heuristicScore(child) };
  });
  candidates.sort((a, b) => b.quickScore - a.quickScore);

  let best = { score: -Infinity, move: null, exact: false };
  for (const { m, child } of candidates) {
    const result = search(child, rules, depth - 1, deadline, tt);
    if (result.score > best.score) {
      best = { score: result.score, move: m, exact: result.exact };
    }
    if (best.score === PERFECT_SCORE && best.exact) break; // proven — can't beat it
  }
  tt.set(key, { ...best, depth });
  return best;
}

// Suggests a pit for the CURRENT player to play, searching as deep as
// `timeBudgetMs` allows. Iterative deepening makes this "anytime": even if
// the time budget cuts a deep search short, the best move found by the
// last depth that finished is still returned — and each depth reuses the
// previous depths' transposition table, so deepening is cheap.
export function suggestMove(state, rules, timeBudgetMs = 1500) {
  const moves = getValidMoves(state, state.currentPlayer, rules);
  if (moves.length === 0) return null;
  if (moves.length === 1) return moves[0];

  const deadline = performance.now() + timeBudgetMs;
  const tt = new Map();
  let best = { score: -Infinity, move: moves[0], exact: false };

  for (let depth = 2; depth <= 60; depth += 2) {
    if (performance.now() > deadline) break;
    const result = search(cloneForSearch(state), rules, depth, deadline, tt);
    if (result.move !== null) best = result;
    if (best.score === PERFECT_SCORE && best.exact) break; // proven — deeper search can't improve on it
  }

  return best.move;
}
