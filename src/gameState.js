// gameState.js — board state, turn state, score state

export const P1_PITS = [0, 1, 2, 3, 4, 5];
export const P1_STORE = 6;
export const P2_PITS = [7, 8, 9, 10, 11, 12];
export const P2_STORE = 13;

export function createGameState() {
  return {
    pits: [4, 4, 4, 4, 4, 4, 0, 4, 4, 4, 4, 4, 4, 0],
    // indices 0-5: Player 1 pits, index 6: Player 1 store
    // indices 7-12: Player 2 pits, index 13: Player 2 store
    currentPlayer: 1, // 1 or 2
    gameOver: false,
    winner: null, // 🔄 will likely change shape in cooperative mode
    turnLog: [], // history for undo/replay
  };
}

export function ownPits(player) {
  return player === 1 ? P1_PITS : P2_PITS;
}

export function ownStore(player) {
  return player === 1 ? P1_STORE : P2_STORE;
}

export function opponentStore(player) {
  return player === 1 ? P2_STORE : P1_STORE;
}

export function opponent(player) {
  return player === 1 ? 2 : 1;
}

// Shallow snapshot of the board-relevant fields, for turn history / rewind.
export function cloneState(state) {
  return {
    pits: [...state.pits],
    currentPlayer: state.currentPlayer,
    gameOver: state.gameOver,
    winner: state.winner,
  };
}
