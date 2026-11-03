# 02 — Stepwise fast-check PBT Exorcist, Shrinking Counterexample Replay & Trial Receipt

**What to build:** Implement the `fast-check` stepwise Property-Based Testing (PBT) Exorcist (`runInterlockingExorcism`), deterministic shrunken counterexample replay (`replayCounterexampleSequence`), and the 6-metric post-hackathon PBT Trial Receipt generator (`generatePbtTrialReceipt`) following the GPT-6 Pro advisory guardrails.

**Blocked by:** `01 — Victorian Mechanical Interlocking Kernel, Independent Topology Oracle & .kiro/ Foundation`

**Status:** `done`

**Needs:** Ticket 01 interlocking kernel and `fast-check` installed.

**Validation method:** Run `node --experimental-strip-types --test tests/ticket-02-pbt-exorcist-and-replay.test.ts` to verify stepwise P1/P2 guardianship on `STANDARD_SAFE`, non-vacuous reachability witnesses, positive fault control + shrinking on `CURSED_MISSING_CROSSOVER_LOCK`, deterministic action-array replay, and the PBT Trial Receipt metrics.

**Evidence required:** Test runner output showing 0 failures and printed PBT Trial Receipt JSON confirming oracle discrimination, reachability counts > 0, shrunken counterexample length < original failing length, and replay reproduction at the exact `failingStepIndex`.

**Tests:** `required`

**Test seam:** `Seam 1` — Public PBT Exorcist and replay functions (`runInterlockingExorcism`, `replayCounterexampleSequence`, `generatePbtTrialReceipt`).

**Regression scope:** Stepwise safety property verification and Trial Receipt generation (`Story 3`), fault-injected shrinking discovery and deterministic replay (`Story 4`), and preservation of Ticket 01 interlocking invariants (`Story 1, 2`).

- [x] On `STANDARD_SAFE`, `runInterlockingExorcism` runs randomized lever action sequences with a fresh initial state per run, checks `P1_NO_CONFLICTING_ROUTES` and `P2_SIGNAL_POINT_LOCK_INTEGRITY` against `evaluatePhysicalTopology` after every step, passes with 0 violations, and records non-zero reachability witnesses (`clearedSignalCount > 0` and `blockedInterlockCount > 0`) — Source: Story 3
- [x] On `CURSED_MISSING_CROSSOVER_LOCK` (positive fault control), the exact same P1/P2 oracle detects a physical route collision (`passed: false`), and `fast-check` shrinks the failing sequence to a minimal `shrunkActions` array (`shrunkActions.length <= 4` and `< originalLength`) — Source: Story 4
- [x] Calling `replayCounterexampleSequence` with the saved `CounterexampleReplayBundle` re-executes `shrunkActions` step-by-step from a clean initial state and reproduces the exact `violatedProperty` and `collisionBlocks` at `failingStepIndex` without relying on RNG state — Source: Story 4
- [x] `generatePbtTrialReceipt` outputs all 6 GPT-6 Pro trial evaluation metrics (`oracleDiscriminatesFault`, `reachabilityWitnesses`, `shrinkingRatio`, `replayDeterministic`, `executionDurationMs`, and `stepwiseAssertionsChecked`) — Source: Story 3
- [x] Running multiple exorcism passes back-to-back produces no cross-run state leakage between `STANDARD_SAFE` and `CURSED_MISSING_CROSSOVER_LOCK` — Source: Story 3 — Failure: F1
- [x] Passing an empty `shrunkActions` array or malformed replay bundle to `replayCounterexampleSequence` returns a structured validation error rather than a false-green pass — Source: Story 4 — Failure: F2
- [x] Both direct CLI test replay and store-triggered replay consume the identical `shrunkActions` array and report the same failing step index and violated property — Source: Story 4 — Failure: F5

## Verification Log

- **Ticket 02 TDD & YAGNI Verification**: `tests/ticket-02-pbt-exorcist-and-replay.test.ts` written first at `Seam 1` (observed RED: 0 pass / 7 fail), then implemented `src/lib/pbt-exorcist.ts`. Applied `[ticket-yagni]` cuts (demoted `ExorcismOptions` to internal constants; removed `ReplayStepSnapshot` and `ReplayResult.steps`). Verified GREEN: 7/7 Ticket 02 tests + 6/6 Ticket 01 tests pass (`74ms`), `tsc --noEmit` 0 errors, and `PBT_TRIAL_RECEIPT` confirmed `oracleDiscriminatesFault: true`, `clearedSignalCount: 19`, `blockedInterlockCount: 100`, `originalLength: 11 -> shrunkLength: 3` (`reductionFactor: 3.67`), `replayDeterministic: true`, `executionDurationMs: 1`, `stepwiseAssertionsChecked: 583`.
- **Degradation Policy Note**: Initial worker pass ran `git clean` after generating patch; controller resumed same worker via `SendMessage` per Preflight Degradation Policy to persist files on disk and export `signal-box-ticket-02.patch`.
