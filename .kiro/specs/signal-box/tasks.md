# Signal Box (LeverFrame) — Implementation & Verification Tasks

## Tasks

- [x] **Task 1: Victorian Mechanical Interlocking Kernel & Independent Topology Oracle (`src/lib/interlocking.ts`)**
  - Implement 8-lever descriptors (`LEVERS` in `src/app/_components/machine.ts`), 4-route catalog (`ROUTE_CATALOG`), and pure state transitions (`createFrameState`, `applyLeverAction`).
  - Implement EARS rule presets (`STANDARD_SAFE` with `EARS-ILK-01..08` and `CURSED_MISSING_CROSSOVER_LOCK` fault injection).
  - Implement immutable `evaluatePhysicalTopology` checking `P1_NO_CONFLICTING_ROUTES` and `P2_SIGNAL_POINT_LOCK_INTEGRITY`.
- [x] **Task 2: Stepwise `fast-check` PBT Exorcist, Shrinking & Deterministic Replay (`src/lib/pbt-exorcist.ts`)**
  - Implement `runInterlockingExorcism` with unfiltered `fc.array` lever action generation (`1..25` steps).
  - Assert `P1` and `P2` after every step, track reachability metrics, and produce `CounterexampleReplayBundle` and `PbtTrialReceipt`.
  - Implement `replayCounterexampleSequence` to deterministically replay `shrunkActions` step-by-step.
- [x] **Task 3: MCP Agent Coordination Adapter & Victorian Signal Box UI (`src/lib/signal-box-store.ts`, `src/app/page.tsx`)**
  - Implement `SignalBoxStore` and MCP tools (`request_route`, `release_route`, `inspect_interlock`, `run_pbt_exorcism`).
  - Build Victorian brass lever frame, tappet locking matrix visualization, illuminated track diagram, PBT Exorcist console, and WebAudio synthesis.

## Verification and provenance

- Completion marks describe implemented behavior, verified by `npm test` (23 tests), `npx tsc --noEmit`, and `npm run build` on 2026-11-11. They do not establish which AI tool authored the implementation.
- The default PBT seed `20261031` executes 80 safe runs and 461 safe step checks; the fault-injected run reports 11 original actions and 3 replay actions. These are seeded observations, not guarantees for every seed. A minimal first failure correctly reports `3 → 3`.
- MCP tests cover JSON-RPC initialization, initialized notification, discovery, calls, and owner checks across all four routes. Locks remain process-local; self-declared `agentId` is not authentication.
- Kiro execution logs and hook execution in Kiro have not been verified. This remediation used Claude Code with GPT; existing repository history records other AI assistance. Do not infer Kiro usage from the presence of this directory.
