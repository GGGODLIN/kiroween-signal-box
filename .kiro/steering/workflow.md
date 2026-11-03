# Workflow Steering — Spec-Driven TDD & Stepwise PBT

## Verification Loop
1. **Spec First**: Define interlocking rules in EARS format (`WHEN ... THE SYSTEM SHALL ...`) in `.kiro/specs/signal-box/requirements.md`.
2. **Acceptance Batch TDD**: Write failing tests at the declared public seam (`Seam 1` or `Seam 2`), observe assertion-level RED, then implement minimal pure logic to reach GREEN.
3. **Stepwise PBT Calibration**: Run `fast-check` sequences against both `STANDARD_SAFE` (expecting 0 violations with non-zero cleared-signal reachability) and `CURSED_MISSING_CROSSOVER_LOCK` (expecting deterministic detection and shrinking of the converging route collision).
