# Product Steering — Signal Box (LeverFrame)

## Vision
**Signal Box (LeverFrame)** models a Victorian mechanical railway interlocking signal box (`Tappet Locking Bed`) in the browser for **Kiroween 2026 (`Resurrection` category)**. Builder, Migrator, Deployer, and Verifier represent concurrent agents in a simulation verified by `fast-check`. It does not lock actual files, databases, or production services.

## Core Principles
1. **Mechanical Mutual Exclusion Before Execution**: Conflicting routes are blocked at the lever latch before two trains or coding agents can occupy the same shared block (`junction-throat`, `schema-bridge`, `prod-mainline`).
2. **Traceable EARS Rejections**: Every blocked lever operation cites an explicit `EARS-ILK-*` requirement ID and human-readable EARS clause.
3. **Adversarial PBT Verification**: Correctness properties (`P1_NO_CONFLICTING_ROUTES` and `P2_SIGNAL_POINT_LOCK_INTEGRITY`) are verified stepwise against an independent Physical Topology Oracle.
