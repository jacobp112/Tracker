# Retention Model Eval — Results (2026-08-09)

Store: no real exported bundle yet. This doc is created now (Task 4) so each
checkpoint's `engine` row is git-anchored to the commit that produced it,
rather than carried across subagent handoffs in a scratch note.

Smeared events excluded as targets. Decision rule: with fewer than ~50 scored
events (`n`), the table cannot separate these models — record "insufficient
data, decision deferred."

| Model            | commit | n | skip | MAE | log-loss (soft) | Bernoulli |
|------------------|--------|---|------|-----|-----------------|-----------|
| baseline         | —      | — | —    | —   | —               | —         |

`baseline` row: (deferred — awaiting `EVAL_STORE` run by controller). No real
store has been exported yet; the harness itself is verified against the
synthetic `fixtureStore()` fixture in `tests/eval/harness.test.ts` (always-on
unit tests, `n = 3`, smoke only — not a substitute for a real-store run). Until
the controller runs `tests/eval/harness.eval.ts` against a real exported
bundle and fills this row, every downstream model decision in this doc is
provisional.
