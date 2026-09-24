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

## Seed sprites & animation

Pits and stores render individual seed dots (capped at 12 per pit / 10 per store, with a "+N" badge beyond that) instead of plain numbers. Playing a move animates it: `gameEngine.playMove` returns a move descriptor (`path`, `captured`, `sweep`) describing exactly how seeds moved, which `ui.js`'s `playMoveAnimation` replays as a seed hopping pit-to-pit, then flying into the store on a capture or end-of-game sweep. The engine itself has no notion of animation — it just reports what happened.

## Cooperative variant

`rules.js` exports both `competitiveRules` and `cooperativeRules`, same shape, selected at runtime via the mode toggle in the header (`gameEngine.js` and `ui.js` never hardcode which one is active). Sowing and capture mechanics are unchanged in cooperative mode — only the objective differs: instead of out-scoring your opponent, both players win together by ending the game with an equal number of seeds in each store.

See the scaffold doc's Section 7 for other open design questions (shared store, joint captures, turn order) not addressed by this variant.
