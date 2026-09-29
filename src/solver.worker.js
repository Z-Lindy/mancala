// solver.worker.js — runs the Cooperative-mode move search off the main
// thread, since a strong suggestion can take up to ~1.5s. Without this,
// that computation would freeze the page (no clicks, no animations) for
// the duration of every search.

import { suggestMove } from "./solver.js";
import { competitiveRules, cooperativeRules } from "./rules.js";

const RULESETS = { competitive: competitiveRules, cooperative: cooperativeRules };

self.onmessage = (event) => {
  const { requestId, state, mode } = event.data;
  const rules = RULESETS[mode];
  const move = suggestMove(state, rules);
  self.postMessage({ requestId, move });
};
