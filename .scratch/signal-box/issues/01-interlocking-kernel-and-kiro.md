# 01 — Victorian Mechanical Interlocking Kernel, Independent Topology Oracle & .kiro/ Foundation

**What to build:** Initialize the Signal Box repository with a complete, non-gitignored root `/.kiro` directory (`specs/`, `steering/`, `hooks/`) compliant with Kiroween 2026 rules, and implement the 8-lever Victorian mechanical interlocking state machine alongside a strictly separated, immutable Physical Topology Oracle so valid lever sequences clear signals for AI agent trains while conflicting pulls are mechanically blocked with explicit EARS rule IDs.

**Blocked by:** None — can start immediately

**Status:** `done`

**Needs:** Node.js 24+ and npm (`fast-check` + Next.js/TypeScript dependencies installed in the repository).

**Validation method:** Run `node --experimental-strip-types --test tests/ticket-01-interlocking-and-kiro.test.ts` to verify `.kiro/` file presence/non-gitignore status, valid lever sequences clearing signals, mechanical interlocking blocks with EARS rule citations, and strict separation between the mutable SUT locking matrix and the immutable Physical Topology Oracle.

**Evidence required:** Test runner output showing 0 failures across all Ticket 01 acceptance tests and `.kiro/` structure checks.

**Tests:** `required`

**Test seam:** `Seam 1` — Interlocking state machine and Physical Topology Oracle public functions (`createFrameState`, `applyLeverAction`, `evaluatePhysicalTopology`, `getInterlockPreset`) plus filesystem inspection of `/.kiro/`.

**Regression scope:** Valid route clearance (`Story 1`), conflicting lever mutual-exclusion blocking with EARS rule IDs (`Story 2`), and root `/.kiro/` directory completeness (`Story 6`).

- [x] Root `/.kiro/` directory contains `.kiro/specs/signal-box/{requirements,design,tasks}.md` (with EARS `WHEN ... THE SYSTEM SHALL ...` clauses), `.kiro/steering/{product,tech,structure,workflow}.md`, and `.kiro/hooks/{verify-interlock-on-save,run-pbt-on-stop}.json`, and `.gitignore` does NOT ignore `/.kiro` — Source: Story 6
- [x] Pulling the valid sequence for North Up Main (`Point #2 NORMAL` → `FPL #3 REVERSE` → `Signal #1 REVERSE`) transitions Signal #1 to clear (`REVERSE`) and marks the North-to-Bridge route active for the `Builder` agent train — Source: Story 1
- [x] Attempting to pull South Branch Signal #4 (`REVERSE`) or unlock FPL #3 (`NORMAL`) while Signal #1 is clear is rejected with `lastOutcome: 'BLOCKED_BY_INTERLOCK'`, preserves the existing lever state unchanged, and cites the blocking EARS rule ID (`EARS-ILK-*`) — Source: Story 2
- [x] Passing an out-of-range lever ID or unknown preset name throws or returns a deterministic validation error without mutating frame state — Source: Story 2 — Failure: F2
- [x] Loading the fault-injected `CURSED_MISSING_CROSSOVER_LOCK` preset weakens only the SUT's tappet locking matrix while `evaluatePhysicalTopology` continues to report physical track-block collisions using the immutable station topology — Source: Story 3 — Failure: F5
- [x] Pulling an already-reversed lever or releasing an already-normal lever is handled idempotently without duplicating active routes or corrupting step history — Source: Story 1 — Failure: F6

## Verification Log

- **Batch execution & testing mode**: `execution_mode=subagent-driven` (`1b`), `testing_mode=tdd` (`2a`), covering Tickets `01`, `02`, `03` — User verbatim choice: `"1b, 2a"`.
- **Ticket 01 TDD & YAGNI Verification**: `tests/ticket-01-interlocking-and-kiro.test.ts` written first at `Seam 1` (observed RED: 0 pass / 6 fail), then implemented `.kiro/{specs,steering,hooks}` and `src/lib/interlocking.ts`. Applied `[ticket-yagni]` cuts (removed `isValidIntent`, `LeverRole`, `LeverMetadata`, `LEVER_CATALOG`; trimmed `RouteMetadata`). Verified GREEN: 6/6 tests pass (`70.7ms`) and `tsc --noEmit` 0 errors.
