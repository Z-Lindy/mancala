# Mancala

A web-based Mancala game (2 players, 6 pits per side), built from `mancala-scaffold.md`. One deviation from standard Kalah: landing in your own store does not grant an extra turn — each player moves exactly once per turn.

## Running

No build step — open `index.html` directly in a browser, or serve the directory:

```sh
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

## Structure

- `src/gameState.js` — board state, turn state, score state
- `src/rules.js` — rule constants + pluggable rule functions (`checkCapture`, `checkGameEnd`, `getWinner`, ...)
- `src/gameEngine.js` — move validation, sowing, and turn orchestration; calls rule functions rather than inlining logic
- `src/ui.js` — rendering (seeds are drawn as sprites, not numbers), DOM event wiring, and the seed-hop/capture/sweep animation sequence
- `src/main.js` — entry point, turn history, and animation orchestration
- `src/solver.js` — Cooperative-mode move search (see below)
- `src/solver.worker.js` — runs the solver in a Web Worker so it never blocks the page

## Seed sprites & animation

Pits and stores render individual seed dots (capped at 12 per pit / 10 per store, with a "+N" badge beyond that) instead of plain numbers. Playing a move animates it: `gameEngine.playMove` returns a move descriptor (`path`, `captured`, `sweep`) describing exactly how seeds moved, which `ui.js`'s `playMoveAnimation` replays as a seed hopping pit-to-pit, then flying into the store on a capture or end-of-game sweep. The engine itself has no notion of animation — it just reports what happened.

## Cooperative variant

`rules.js` exports both `competitiveRules` and `cooperativeRules`, same shape, selected at runtime via the mode toggle in the header (`gameEngine.js` and `ui.js` never hardcode which one is active). Sowing and capture mechanics are unchanged in cooperative mode — only the objective differs: instead of out-scoring your opponent, both players win together by ending the game with an equal number of seeds in each store.

See the scaffold doc's Section 7 for other open design questions (shared store, joint captures, turn order) not addressed by this variant.

## Assist mode (Cooperative only)

An "Assist" checkbox above the board highlights the pit its search thinks gives the best shot at ending with equal stores. The full game tree (30-50 plies deep, branching up to 6) is far too large to solve exactly from an early position in real time, so `solver.js` does an iterative-deepening search with a transposition table, within a ~1.5s time budget, and falls back to a heuristic estimate ("if every seed still on the board settled on its own side right now, how far apart would the stores be?") when the search can't reach the true end of the game. It's a strong look-ahead assistant, not a mathematically-proven-optimal solver — though as a game nears its end and the remaining tree shrinks, the search increasingly reaches genuine, proven outcomes rather than heuristic guesses.

Because a search can take up to ~1.5s, it runs in `solver.worker.js` (a Web Worker) rather than on the main thread, so the board, animations, and the rest of the page stay responsive while it thinks. `main.js` tags each request with an incrementing id so a stale response (e.g. from a search still running when the player moves again) is discarded rather than overwriting a newer suggestion.
