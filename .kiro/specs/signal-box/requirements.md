# Signal Box (LeverFrame) — EARS Requirements Specification

## 1. Overview

**Signal Box (LeverFrame)** resurrects the 19th-century Victorian mechanical railway interlocking signal box (`Tappet Locking Bed`) in the browser as a safety-critical mutual-exclusion and routing control tower for concurrent AI coding agents (`Builder`, `Migrator`, `Deployer`, `Verifier`).

## 2. EARS Interlocking Requirements (`EARS-ILK-01` .. `EARS-ILK-08`)

### `EARS-ILK-01` — Converging Mainline Mutual Exclusion (North Up vs South Branch)
- **Clause:** WHEN North Up Home Signal #1 is REVERSE, THE SYSTEM SHALL mechanically lock South Branch Home Signal #4 in NORMAL to prevent converging collisions on junction-throat and schema-bridge.
- **Target Lever & Intent:** Lever `#4` (`PULL`)

### `EARS-ILK-02` — Facing Point Lock Backlocking Under Clear Signals
- **Clause:** WHEN any junction signal (#1, #4, #6) is REVERSE, THE SYSTEM SHALL backlock Facing Point Lock #3 in REVERSE so the switch cannot be unlocked under a clear signal.
- **Target Lever & Intent:** Lever `#3` (`RELEASE`)

### `EARS-ILK-03` — Crossover Point Immobilization Under Plunged Lock or Clear Signal
- **Clause:** WHEN Facing Point Lock #3 is REVERSE or any junction signal (#1, #4, #6) is REVERSE, THE SYSTEM SHALL lock Junction Crossover Point #2 in its current position so points cannot move beneath an locked or active route.
- **Target Lever & Intent:** Lever `#2` (`PULL` and `RELEASE`)

### `EARS-ILK-04` — North Up Home Signal #1 Clearance Prerequisites (`Builder` Agent)
- **Clause:** WHEN an operator or agent pulls North Up Home Signal #1, THE SYSTEM SHALL require Junction Crossover Point #2 in NORMAL, Facing Point Lock #3 in REVERSE, conflicting signals (#4, #5, #6) in NORMAL, and Maintenance Isolation Lock #8 in NORMAL.
- **Target Lever & Intent:** Lever `#1` (`PULL`)

### `EARS-ILK-05` — South Branch Home Signal #4 Clearance Prerequisites (`Migrator` Agent)
- **Clause:** WHEN an operator or agent pulls South Branch Home Signal #4, THE SYSTEM SHALL require Junction Crossover Point #2 in REVERSE, Facing Point Lock #3 in REVERSE, conflicting signals (#1, #5, #6) in NORMAL, and Maintenance Isolation Lock #8 in NORMAL.
- **Target Lever & Intent:** Lever `#4` (`PULL`)

### `EARS-ILK-06` — Schema Bridge Distant Signal #5 & Token Clearance Backlock (`Deployer` Agent)
- **Clause:** WHEN an operator or agent pulls Schema Bridge Distant Signal #5, THE SYSTEM SHALL require Bridge Token Clearance #7 in REVERSE, conflicting signals (#1, #4, #6) in NORMAL, and Maintenance Isolation Lock #8 in NORMAL; and WHEN Signal #5 is REVERSE, THE SYSTEM SHALL backlock Bridge Token Clearance #7 in REVERSE.
- **Target Lever & Intent:** Lever `#5` (`PULL`) and Lever `#7` (`RELEASE`)

### `EARS-ILK-07` — Shunt & Audit Dwarf Signal #6 & Isolation Backlock (`Verifier` Agent)
- **Clause:** WHEN an operator or agent pulls Shunt & Audit Dwarf Signal #6, THE SYSTEM SHALL require Maintenance Isolation Lock #8 in REVERSE, Facing Point Lock #3 in REVERSE, and mainline signals (#1, #4, #5) in NORMAL; and WHEN Signal #6 is REVERSE, THE SYSTEM SHALL backlock Maintenance Isolation Lock #8 in REVERSE.
- **Target Lever & Intent:** Lever `#6` (`PULL`) and Lever `#8` (`RELEASE`)

### `EARS-ILK-08` — Maintenance Isolation Lock #8 Engagement Prerequisites
- **Clause:** WHEN an operator or agent pulls Maintenance Isolation Lock #8 to isolate the junction, THE SYSTEM SHALL require mainline signals (#1, #4, #5) to be in NORMAL before engaging isolation.
- **Target Lever & Intent:** Lever `#8` (`PULL`)

### `EARS-VAL-01` — Deterministic Input Validation
- **Clause:** WHEN an out-of-range lever identifier or unsupported action intent is submitted, THE SYSTEM SHALL reject the action with `INVALID_INPUT` and preserve the existing frame state without mutation.

## 3. Correctness Properties for Stepwise Property-Based Testing (PBT)

### `P1_NO_CONFLICTING_ROUTES` — Track Block Mutual Exclusion
- **Clause:** WHEN any sequence of lever actions is executed step-by-step, THE SYSTEM SHALL guarantee that no physical track block (`north-approach`, `south-branch`, `junction-throat`, `schema-bridge`, `prod-mainline`, `audit-siding`) is occupied by two or more active signal routes simultaneously on the independent Physical Topology Oracle.

### `P2_SIGNAL_POINT_LOCK_INTEGRITY` — Signal-to-Point Alignment & Lock Integrity
- **Clause:** WHEN any signal lever (#1, #4, #5, #6) is in the `REVERSE` (clear) state at any step, THE SYSTEM SHALL guarantee that every physical point, facing point lock, and clearance token required by that signal's physical route remains in its required alignment and locked state.
