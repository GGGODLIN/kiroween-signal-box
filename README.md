# Signal Box (`LeverFrame`) — 1856 Victorian Mechanical Interlocking × Spec-Driven `fast-check` PBT Exorcist

> **Kiroween 2026 Submission (`Resurrection` Category + `Best Startup Project` + `Best Demo`)**
> Resurrecting the 19th-century Victorian mechanical railway interlocking signal box (Saxby & Farmer, 1856) in the browser as a safety-critical mutual-exclusion control tower for parallel AI coding agents (`Builder`, `Migrator`, `Deployer`, `Verifier`), verified step-by-step by an independent Physical Topology Oracle and a `fast-check` Property-Based Testing (PBT) Exorcist.

---

## Why Resurrect the 1856 Mechanical Signal Box?

When teams run multiple autonomous AI coding agents in parallel (such as in Kiro Crew workspaces), concurrent agents routinely step on shared resources—simultaneously mutating the same database schema, lockfile, or production deployment lane—while traditional example-based unit tests only check a handful of happy paths and miss multi-step interleaving collisions.

In 1856, John Saxby solved physical mutual exclusion on Victorian railways using the **Mechanical Tappet Interlocking Frame**: a bed of perpendicular steel locking bars beneath brass levers controlling track points, facing point locks (FPL), and semaphore signals that **physically blocks conflicting pulls before a collision can occur**.

**Signal Box (`LeverFrame`)** models this mechanical apparatus in the browser. Its tracked `/.kiro/specs`, `/.kiro/steering`, and `/.kiro/hooks` contain EARS (`WHEN ... THE SYSTEM SHALL ...`) rules, design notes, and hook definitions. Their presence does not establish Kiro execution: Kiro session and hook execution evidence remains unverified. This remediation used Claude Code with GPT, and the Git history retains other AI-assisted work.

---

## Core Architecture & Key Features

1. **8-Lever Victorian Mechanical Interlocking Frame ([src/lib/interlocking.ts](/src/lib/interlocking.ts))**:
   - **Lever #1 (`SIGNAL`)**: North Up Home Signal (`NORTH_TO_BRIDGE` — `Builder` Agent)
   - **Lever #2 (`POINT`)**: Junction Crossover Switch (`NORMAL` straight / `REVERSE` diverging)
   - **Lever #3 (`LOCK`)**: Facing Point Lock (`FPL #3` — plunges into Point #2 to prevent movement under a train)
   - **Lever #4 (`SIGNAL`)**: South Branch Home Signal (`SOUTH_TO_BRIDGE` — `Migrator` Agent)
   - **Lever #5 (`SIGNAL`)**: Schema Bridge Distant Signal (`BRIDGE_MAINLINE` — `Deployer` Agent)
   - **Lever #6 (`SIGNAL`)**: Shunt & Audit Dwarf Signal (`AUDIT_SIDING` — `Verifier` Agent)
   - **Lever #7 (`CLEARANCE`)**: Bridge Token Clearance (`REVERSE` required for Signal #5)
   - **Lever #8 (`CLEARANCE`)**: Maintenance Isolation Lock (`REVERSE` isolates junction for Signal #6)

2. **Strict Separation Between SUT Tappet Matrix & Immutable Physical Topology Oracle**:
   - `getInterlockPreset(presetId)` returns the System Under Test's tappet locking rules (`EARS-ILK-01`..`08`) for either `STANDARD_SAFE` or the fault-injected `CURSED_MISSING_CROSSOVER_LOCK` table.
   - `evaluatePhysicalTopology(state)` is completely decoupled from `presetId` and evaluates physical track-block occupancy (`north-approach`, `south-branch`, `junction-throat`, `schema-bridge`, `prod-mainline`, `audit-siding`) and switch alignment against immutable station geometry:
     - **`P1_NO_CONFLICTING_ROUTES`**: No two active routes may ever occupy overlapping physical track blocks simultaneously.
     - **`P2_SIGNAL_POINT_LOCK_INTEGRITY`**: Every active signal must have its required points aligned and facing point locks plunged.

3. **Stepwise `fast-check` PBT Exorcist & Deterministic Shrinking Replay ([src/lib/pbt-exorcist.ts](/src/lib/pbt-exorcist.ts))**:
   - `runInterlockingExorcism(presetId)` generates un-filtered random sequences of lever pulls/releases and asserts `P1` and `P2` **after every individual step**.
   - With the default seed `20261031` (verified 2026-11-11), all 80 `STANDARD_SAFE` runs (461 stepwise assertions) pass with 0 violations and non-zero reachability witnesses (`clearedSignalCount: 19`, `blockedInterlockCount: 100`). Counts vary by seed and dependency version.
   - On `CURSED_MISSING_CROSSOVER_LOCK` (which omits `EARS-ILK-01` and the crossover point check when Signal #1 is clear), `fast-check` catches the physical collision on `["junction-throat", "schema-bridge"]` in an 11-step sequence and **shrinks it to a 3-step minimal counterexample (`3.67x` reduction)**:
     1. `{ leverId: 3, intent: "PULL" }` (Engage Facing Point Lock #3)
     2. `{ leverId: 1, intent: "PULL" }` (Clear North Up Home Signal #1 → `Builder` enters `junction-throat` & `schema-bridge`)
     3. `{ leverId: 4, intent: "PULL" }` (Clear South Branch Signal #4 → `Migrator` collides on `junction-throat` & `schema-bridge` at `failingStepIndex: 2`).
   - `replayCounterexampleSequence(bundle)` replays the saved `shrunkActions` array deterministically step-by-step without relying on RNG state.

4. **Interactive Victorian Control Tower UI, WebAudio Mechanical Synthesis & MCP Tool Surface ([src/app/page.tsx](/src/app/page.tsx), [src/lib/signal-box-store.ts](/src/lib/signal-box-store.ts), [src/app/api/mcp/route.ts](/src/app/api/mcp/route.ts))**:
   - Live SVG illuminated track diagram, 8-lever brass frame, Tappet Locking Bed with EARS rule citations, step-by-step Shrinking Counterexample Replay controls, and WebAudio synthesized mechanical sounds (`LEVER_LATCH`, `INTERLOCK_CLANK`, `COLLISION_ALARM`, `BELL_CHIME`).
   - Deterministic MCP tool dispatcher (`request_route`, `release_route`, `inspect_interlock`, `run_pbt_exorcism`) exposed in-memory and at `POST /api/mcp`. The HTTP endpoint supports JSON-RPC 2.0 initialization, notifications, discovery, and tool calls through the official MCP SDK, alongside the legacy request format.
   - Routes record the acquiring `agentId`; another ID cannot take over or release a held route. IDs are self-declared, and the HTTP store is process-local. This is a public simulation, not an authenticated or distributed lock service. Browser and server stores are separate; cold starts reset server state.
   - Deploy this repository in Next.js server mode on Vercel (`npm run build`); `POST /api/mcp` is dynamic. A GitHub Pages mirror only serves the browser demo. The production Vercel URL and remote endpoint still require deployment verification.

---

## Kiro Spec-Driven Directory (`/.kiro/`)

Per Kiroween 2026 rules, the root [/.kiro/](/.kiro) directory is tracked in Git and contains:
- **Specs**: [.kiro/specs/signal-box/requirements.md](/.kiro/specs/signal-box/requirements.md) (EARS syntax), [.kiro/specs/signal-box/design.md](/.kiro/specs/signal-box/design.md), [.kiro/specs/signal-box/tasks.md](/.kiro/specs/signal-box/tasks.md)
- **Steering**: [.kiro/steering/product.md](/.kiro/steering/product.md), [.kiro/steering/tech.md](/.kiro/steering/tech.md), [.kiro/steering/structure.md](/.kiro/steering/structure.md), [.kiro/steering/workflow.md](/.kiro/steering/workflow.md)
- **Agent Hooks**: [.kiro/hooks/verify-interlock-on-save.json](/.kiro/hooks/verify-interlock-on-save.json), [.kiro/hooks/run-pbt-on-stop.json](/.kiro/hooks/run-pbt-on-stop.json)

---

## Quick Start & Verification

```bash
# Install dependencies (Node.js 24+)
npm install

# Run all 23 unit & fast-check PBT acceptance tests (2026-11-11)
npm test

# Build production Next.js bundle
npm run build

# Start interactive Victorian Signal Box server
npm run dev
```

## License

MIT License — see [LICENSE](/LICENSE).
