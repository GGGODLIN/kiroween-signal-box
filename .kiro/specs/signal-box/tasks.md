# Signal Box (LeverFrame) — Implementation & Verification Tasks

## Tasks

- [x] **Task 1: Victorian Mechanical Interlocking Kernel & Independent Topology Oracle (`src/lib/interlocking.ts`)**
  - Implement 8-lever catalog (`LEVER_CATALOG`), 4-route catalog (`ROUTE_CATALOG`), and pure state transitions (`createFrameState`, `applyLeverAction`).
  - Implement EARS rule presets (`STANDARD_SAFE` with `EARS-ILK-01..08` and `CURSED_MISSING_CROSSOVER_LOCK` fault injection).
  - Implement immutable `evaluatePhysicalTopology` checking `P1_NO_CONFLICTING_ROUTES` and `P2_SIGNAL_POINT_LOCK_INTEGRITY`.
- [ ] **Task 2: Stepwise `fast-check` PBT Exorcist, Shrinking & Deterministic Replay (`src/lib/pbt-exorcist.ts`)**
  - Implement `runPbtExorcism` with unfiltered `fc.array` lever action generation (`1..25` steps).
  - Assert `P1` and `P2` after every step, track reachability metrics, and produce `CounterexampleReplayBundle` and `PbtTrialReceipt`.
  - Implement `replayCounterexample` to deterministically replay `shrunkActions` step-by-step.
- [ ] **Task 3: MCP Agent Coordination Adapter & Victorian Signal Box UI (`src/lib/signal-box-store.ts`, `src/app/page.tsx`)**
  - Implement `SignalBoxStore` and MCP tools (`request_route`, `release_route`, `inspect_interlock`, `run_pbt_exorcism`).
  - Build Victorian brass lever frame, tappet locking matrix visualization, illuminated track diagram, PBT Exorcist console, and WebAudio synthesis.
