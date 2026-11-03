# Signal Box (LeverFrame) — Architectural Design

## 1. Architectural Overview

Signal Box separates its safety-critical simulation into three strictly decoupled layers:

1. **Mutable SUT Interlocking Engine (`src/lib/interlocking.ts`)**:
   - Models the 8-lever Victorian mechanical tappet frame (`STANDARD_SAFE` vs fault-injected `CURSED_MISSING_CROSSOVER_LOCK`).
   - Processes `PULL` and `RELEASE` actions via pure function `applyLeverAction(state, action)`.
2. **Independent Physical Topology Oracle (`evaluatePhysicalTopology` in `src/lib/interlocking.ts`)**:
   - Strictly separated from `getInterlockPreset` and `state.presetId`.
   - Computes physical track block occupancy and switch/lock alignment directly from `state.levers` against the immutable station geometry.
   - Evaluates `P1_NO_CONFLICTING_ROUTES` and `P2_SIGNAL_POINT_LOCK_INTEGRITY`.
3. **Stepwise PBT Exorcist & Counterexample Replay (`src/lib/pbt-exorcist.ts`)**:
   - Uses `fast-check` to generate unfiltered random `LeverAction[]` sequences (`1..25` steps).
   - Evaluates `evaluatePhysicalTopology` after every individual step.
   - Captures shrunken minimal counterexample bundles (`CounterexampleReplayBundle`) and replays them step-by-step.
4. **Interactive Store, MCP Adapter & Victorian UI (`src/lib/signal-box-store.ts`, `src/app/page.tsx`)**:
   - Exposes `request_route`, `release_route`, `inspect_interlock`, and `run_pbt_exorcism` for Kiro Crew / MCP agent coordination.

## 2. 8-Lever Station Topology

| Lever | Name | Role | Agent Train | Route ID | Occupied Blocks When Clear |
|---|---|---|---|---|---|
| `#1` | North Up Home Signal #1 | `SIGNAL` | `Builder` | `NORTH_TO_BRIDGE` | `north-approach`, `junction-throat`, `schema-bridge` |
| `#2` | Junction Crossover Point #2 | `POINT` | — | — | — (`NORMAL` = North straight, `REVERSE` = South crossover) |
| `#3` | Facing Point Lock #3 (FPL) | `LOCK` | — | — | — (`REVERSE` plunges lock bar into Point #2) |
| `#4` | South Branch Home Signal #4 | `SIGNAL` | `Migrator` | `SOUTH_TO_BRIDGE` | `south-branch`, `junction-throat`, `schema-bridge` |
| `#5` | Schema Bridge Distant Signal #5 | `SIGNAL` | `Deployer` | `BRIDGE_MAINLINE` | `schema-bridge`, `prod-mainline` |
| `#6` | Shunt & Audit Dwarf Signal #6 | `SIGNAL` | `Verifier` | `AUDIT_SIDING` | `junction-throat`, `audit-siding` |
| `#7` | Bridge Token Clearance #7 | `CLEARANCE` | — | — | — (`REVERSE` grants high-speed exit token for `#5`) |
| `#8` | Maintenance Isolation Lock #8 | `CLEARANCE` | — | — | — (`REVERSE` isolates junction for `#6`) |

## 3. Why Oracle Separation Is Mandatory

When testing fault injection (`CURSED_MISSING_CROSSOVER_LOCK`), weakening a shared rule table would corrupt both the SUT and the test oracle, causing tautological passes. By keeping the Physical Topology Oracle immutable and independent of `presetId`, weakening `EARS-ILK-01` and `EARS-ILK-05` in the SUT allows `Signal #1` and `Signal #4` to clear simultaneously while the Oracle immediately flags `P1_NO_CONFLICTING_ROUTES` on `['junction-throat', 'schema-bridge']`.
