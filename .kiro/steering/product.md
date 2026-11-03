# Product Steering — Signal Box (LeverFrame)

## Vision
**Signal Box (LeverFrame)** resurrects the 19th-century Victorian mechanical railway interlocking signal box (`Tappet Locking Bed`) for **Kiroween 2026 (`Resurrection` category)**. It bridges 1850s railway safety engineering with modern multi-agent mutual exclusion (`Builder`, `Migrator`, `Deployer`, `Verifier`) and Spec-Driven Property-Based Testing (`fast-check`).

## Core Principles
1. **Mechanical Mutual Exclusion Before Execution**: Conflicting routes are blocked at the lever latch before two trains or coding agents can occupy the same shared block (`junction-throat`, `schema-bridge`, `prod-mainline`).
2. **Traceable EARS Rejections**: Every blocked lever operation cites an explicit `EARS-ILK-*` requirement ID and human-readable EARS clause.
3. **Adversarial PBT Verification**: Correctness properties (`P1_NO_CONFLICTING_ROUTES` and `P2_SIGNAL_POINT_LOCK_INTEGRITY`) are verified stepwise against an independent Physical Topology Oracle.
