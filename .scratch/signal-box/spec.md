## Problem Statement

When teams run multiple autonomous AI coding agents in parallel (such as in Kiro Crew workspaces) or train engineers on safety-critical routing systems, concurrent agents routinely step on shared resources—simultaneously mutating the same database schema, lockfile, or production deployment lane—while traditional unit tests only verify a handful of hand-picked happy-path examples and miss multi-step interleaving deadlocks or missing mutual-exclusion rules. Meanwhile, the 19th-century Victorian mechanical railway signal box solved physical mutual exclusion in the 1850s using an interlocking lever frame (Tappet Locking Bed), where brass levers controlling track points, facing point locks, and signals physically block conflicting pulls before a collision can occur, yet this foundational safety-critical machinery is largely inaccessible outside railway museums.

## Solution

**Signal Box (LeverFrame)** resurrects the 19th-century Victorian mechanical railway interlocking signal box in the browser as an interactive safety-critical routing and multi-agent mutual-exclusion control tower for **Kiroween 2026 (`Resurrection` category)**. Operators and AI agents (represented as trains such as `Builder`, `Migrator`, `Deployer`, and `Verifier` traversing shared resource blocks like `schema-track`, `lockfile-junction`, and `prod-mainline`) pull brass levers for points, locks, and signals against a live mechanical locking bed with synthesized WebAudio lever latches and block bells. To prove safety and catch subtle specification gaps, an integrated **Property-Based Testing (PBT) Exorcist** powered by `fast-check` bombards the interlocking frame with hundreds of randomized lever action sequences, checks stepwise safety invariants against an independent physical topology oracle after every single lever action, and shrinks any multi-step collision or missing-lock violation under a faulty ("Cursed") rule table down to a minimal, deterministic replayable action sequence on the live canvas.

## User Stories

1. As a hackathon judge or developer, I want to operate a resurrected Victorian mechanical railway signal box (`Signal Box`) in the browser with interactive brass levers, a mechanical tappet locking bed, and an illuminated track diagram, so that I can experience how mechanical interlocking enforces mutual exclusion across railway routes and parallel AI agent workflows `[user: "行啊不然就1"]`
2. As an operator, I want conflicting point, lock, or signal levers to be physically blocked by the interlocking rule table when another conflicting route or dependent signal is active, accompanied by an explicit EARS rule citation and mechanical latch feedback, so that no two trains or agents can ever enter conflicting track blocks simultaneously `[evidence: kiroween.devpost.com/rules Resurrection category & EARS spec requirement]`
3. As a developer trialing Spec-Driven Property-Based Testing (PBT), I want to run randomized lever action sequences against the interlocking engine and inspect a structured PBT Trial Receipt (covering oracle calibration, generator state reachability, shrunken counterexample replay, and execution time), so that I can evaluate after the hackathon whether to crystallize PBT into my global development harness `[user: "總之就是用場黑客松當實驗對吧，我覺得可以，這場黑客松結束之後要來review是否適合固化"]`
4. As an operator or judge, I want to toggle between the verified **Standard Interlocking Table** and a **Cursed (Fault-Injected) Interlocking Table** (which omits a specific mutual-exclusion lock) and trigger the **PBT Exorcist**, so that I can watch `fast-check` discover a multi-step route collision, shrink the failing sequence down to a minimal counterexample, and replay those exact steps on the track diagram `[evidence: kiro.dev/docs/specs/correctness/ shrinking workflow]`
5. As a Kiro Crew workflow or MCP client, I want to request and release routes and inspect current lever/block states through deterministic tool interfaces (`request_route`, `release_route`, `inspect_interlock`, `run_pbt_exorcism`), so that parallel coding agents can coordinate exclusive access to shared repository and deployment lanes `[evidence: kiroween.devpost.com/ Bonus Prize & MCP evaluation criteria]`
6. As a hackathon entrant, I want the repository root to include a complete, non-gitignored `/.kiro` directory containing EARS-formatted specifications (`requirements.md`, `design.md`, `tasks.md`), steering guides, and automated agent hooks, so that the project satisfies all mandatory Kiroween 2026 submission and technological implementation requirements `[user: "A吧，但他有要求必須要用kiro嗎？"]`

## Implementation Decisions

- **Domain Model & Lever Frame Topology**: The signal box models a canonical 8-lever Victorian mechanical frame governing a junction with two converging mainlines (`North Up Main — Builder Agent`, `South Branch — Migrator Agent`), a crossover switch (`Point #2`, `Facing Point Lock #3`), a shared critical single-track bridge (`Schema Bridge Block — Deployer Agent`), and four semaphore home/distant signals (`Signals #1, #4, #5, #6`) plus two agent-clearance release levers (`Levers #7, #8`). Each lever has a deterministic state (`NORMAL` vs `REVERSE`), role (`POINT`, `LOCK`, `SIGNAL`, `CLEARANCE`), and EARS requirement ID `[inferred]`
- **Strict Separation Between SUT Rule Table and Independent Physical Topology Oracle**: Following the GPT-6 Pro advisory review, the mutable interlocking rule table consumed by the System Under Test (the Tappet Locking Matrix that decides whether a lever pull is permitted) MUST be strictly separated from the immutable **Track Physical Topology Oracle** (which defines physical track block occupancy, switch geometry, and physical collision conditions). When fault injection ("Cursed Table") is enabled, only the SUT's locking matrix is weakened; the Oracle remains untouched so property assertions never share a corrupted source of truth `[user: "把這個PBT相關的發給gpt6pro問問他的意見"]`
- **Deterministic Stepwise State Machine**: Every lever action (`PULL` or `RELEASE` on lever `1..8`) is processed by a pure state transition function that returns an immutable frame snapshot (`levers`, `activeRoutes`, `occupiedBlocks`, `lastOutcome`: `APPLIED` | `BLOCKED_BY_INTERLOCK`, `blockingRuleId`, `blockingReason`, and `stepHistory`). When a lever pull or release is rejected by the interlocking table, the frame state MUST remain unchanged and report the exact EARS rule ID that prevented the move `[inferred]`
- **Stepwise Property-Based Testing & Shrinking Engine**: Using `fast-check`, the PBT Exorcist generates bounded random sequences of lever commands without pre-filtering conflicting requests (ensuring adversarial requests actually hit the SUT). Each generated sequence starts from a fresh initial state and asserts two core safety properties **after every individual step** (not only at the end of the array):
  - **Property P1 (Mutual Exclusion / No Conflicting Routes)**: According to the independent Physical Topology Oracle, no two active routes may ever occupy overlapping or conflicting physical track blocks at any step.
  - **Property P2 (Signal-to-Point Alignment & Lock Integrity)**: Whenever any signal lever is in the `REVERSE` (clear/green) state, every point required by that signal's physical route MUST be aligned and its facing point lock engaged, and those point/lock levers MUST be immovable while the signal remains clear `[evidence: GPT-6 Pro advisor review items #1, #2, #5]`
- **Deterministic Counterexample Artifact & Replay Contract**: When a property fails under a fault-injected rule table, the engine captures a self-contained replay artifact containing the initial fixture ID, rule table preset, the unshrunk failing action sequence, the shrunken minimal action sequence (array of concrete `{ leverId, action }` steps), the violated property ID, the exact failing step index, and the `fast-check` seed. Both CLI replay and browser canvas replay execute the saved shrunken action array step-by-step against the state machine rather than playing pre-baked animations or relying solely on a random seed `[evidence: GPT-6 Pro advisor review item #9]`
- **WebAudio Mechanical Sound Synthesis & Visual Canvas**: The browser UI renders the brass lever frame, mechanical tappet locking grid (showing horizontal locking bars engaging and blocking perpendicular tappets), and illuminated track diagram on a responsive dark-brass Victorian control-tower interface. User interactions and replays trigger WebAudio-synthesized mechanical latch clicks, interlocking clanks on blocked pulls, and railway block-bell chimes with a mute toggle and `prefers-reduced-motion` support `[inferred]`
- **MCP Tool Surface & Kiro Directory Layout**: A pure TypeScript MCP tool adapter exposes `request_route`, `release_route`, `inspect_interlock`, and `run_pbt_exorcism` over the same interlocking store, and the root `/.kiro/` directory ships with EARS-formatted `.kiro/specs/signal-box/{requirements,design,tasks}.md`, `.kiro/steering/{product,tech,structure,workflow}.md`, and `.kiro/hooks/{verify-interlock-on-save,run-pbt-on-stop}.json` `[evidence: kiroween.devpost.com/rules /.kiro requirement]`

```typescript
// Prototype type shape for the separated SUT Locking Table vs Independent Topology Oracle
export type LeverId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export type LeverState = 'NORMAL' | 'REVERSE';
export type LeverAction = { leverId: LeverId; intent: 'PULL' | 'RELEASE' };

export type InterlockRule = {
  ruleId: string; // e.g. "EARS-ILK-01"
  whenLever: LeverId;
  whenState: LeverState;
  locksLever: LeverId;
  requiredState: LeverState;
  earsClause: string;
};

export type CounterexampleReplayBundle = {
  presetId: 'STANDARD_SAFE' | 'CURSED_MISSING_CROSSOVER_LOCK';
  violatedProperty: 'P1_NO_CONFLICTING_ROUTES' | 'P2_SIGNAL_POINT_LOCK_INTEGRITY';
  originalLength: number;
  shrunkActions: LeverAction[];
  failingStepIndex: number;
  collisionBlocks: string[];
  missingRuleId: string;
  seed: number;
};
```

## Testing Decisions

- **What makes a good test**: Tests observe behavior strictly through the two confirmed public seams (`Seam 1`: the interlocking & PBT exorcist module; `Seam 2`: the UI/MCP state store) without reaching into private helpers. Following the GPT-6 Pro review, tests are separated into three distinct roles so safety properties never conflict with TDD's RED requirement:
  1. **New-Capability Acceptance Tests (Must be RED before implementation)**: Concrete example-based tests proving that valid lever sequences successfully clear signals and dispatch trains/agents, and that conflicting pulls are blocked with the expected EARS rule ID.
  2. **Stepwise Safety Property Guardians (`fast-check` P1 & P2)**: Property-based tests asserting after every step of randomized lever sequences that P1 (no conflicting routes on the independent physical topology oracle) and P2 (signal-to-point-and-lock integrity) hold on the `STANDARD_SAFE` table, plus reachability witnesses confirming that random runs actually clear signals and attempt conflicting pulls (preventing vacuous pass).
  3. **Positive Fault Control & Shrinking Calibration**: A deterministic calibration test verifying that when the `CURSED_MISSING_CROSSOVER_LOCK` table is loaded into the SUT (while the Oracle retains the true physical topology), the exact same P1/P2 oracle detects the collision, shrinks the counterexample sequence, and reproduces the failure when the shrunken `shrunkActions` array is replayed.
- **Which modules will be tested**:
  - `Seam 1`: Interlocking state machine, EARS rule compiler, independent physical topology oracle, and `fast-check` PBT Exorcist + counterexample replay.
  - `Seam 2`: Signal Box interactive store, MCP tool handlers (`request_route`, `release_route`, `inspect_interlock`, `run_pbt_exorcism`), and `.kiro/` specification/hook structural integrity.
- **Post-Hackathon PBT Trial Receipt**: The test suite and UI generate a measurable receipt (oracle discrimination, generator state reachability counts, shrunken sequence length vs original length, and execution duration in ms) to feed our scheduled post-hackathon harness review.
  - **Measured PBT Trial Receipt (Ticket 02 Verification Write-Back)**:
    - `oracleDiscriminatesFault`: `true` (`STANDARD_SAFE` passes 80 runs / 461 stepwise assertions with 0 violations; `CURSED_MISSING_CROSSOVER_LOCK` fails at run 3 / 122 stepwise assertions on `P1_NO_CONFLICTING_ROUTES` with `collisionBlocks: ["junction-throat", "schema-bridge"]` and `missingRuleId: "EARS-ILK-01"`).
    - `reachabilityWitnesses`: `{ clearedSignalCount: 19, blockedInterlockCount: 100, appliedActionCount: 98 }` (confirming non-vacuous exploration of both active routes and mechanical blocks).
    - `shrinkingRatio`: `{ originalLength: 11, shrunkLength: 3, reductionFactor: 3.67 }` (`fast-check` shrinks an 11-step random sequence down to the exact 3-step minimal counterexample: `PULL #3 -> PULL #1 -> PULL #4`, `failingStepIndex: 2`).
    - `replayDeterministic`: `true` (`replayCounterexampleSequence` deterministically reproduces the exact violation from `shrunkActions` without RNG state).
    - `executionDurationMs`: `1–2 ms` total for 583 stepwise assertions across both presets.
    - `stepwiseAssertionsChecked`: `583`.

## Out of Scope

- Connecting to physical USB railway hardware or real PLC serial controllers.
- Multi-user networked WebSocket rooms or paid cloud authentication.
- Automatic AI mutation of production source files inside the browser (fixes are applied by switching or repairing the declarative EARS interlocking rule table).

## Further Notes

- The project targets **Kiroween 2026** (`Resurrection` primary category + `Best Startup Project` + `Best Demo` + `Bonus Blog Prize`).
- A post-hackathon review task has been recorded in `work_state` (`kiroween-signal-box` and `pbt-harness-experiment`) to evaluate the PBT trial receipt against GPT-6 Pro's 6 criteria before modifying global `~/.claude/skills/{to-spec,tdd}`.
