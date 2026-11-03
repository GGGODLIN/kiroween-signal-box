# 03 — Interactive Victorian Signal Box UI, WebAudio Mechanical Synthesis & MCP Tool Surface

**What to build:** Build the interactive Victorian brass Signal Box web application (Next.js App Router) featuring the 8-lever frame, live mechanical tappet locking bed, illuminated track diagram with AI agent trains (`Builder`, `Migrator`, `Deployer`, `Verifier`), `STANDARD_SAFE ↔ CURSED_MISSING_CROSSOVER_LOCK` preset switcher, live PBT Exorcist + step-by-step shrunken counterexample replay controls, PBT Trial Receipt inspector, WebAudio synthesized mechanical sounds, and the MCP tool surface (`request_route`, `release_route`, `inspect_interlock`, `run_pbt_exorcism`).

**Blocked by:** `02 — Stepwise fast-check PBT Exorcist, Shrinking Counterexample Replay & Trial Receipt`

**Status:** `ready-for-agent`

**Needs:** Tickets 01 and 02 completed.

**Validation method:** Run `node --experimental-strip-types --test tests/ticket-03-ui-store-and-mcp.test.ts` and `npm run build` to verify the interactive store, preset switching cleanup, step-by-step replay controls, MCP tool handlers, and production Next.js build.

**Evidence required:** Passing test suite (`tests/ticket-01..03*.test.ts`) and clean `npm run build` output.

**Tests:** `required`

**Test seam:** `Seam 2` — Signal Box interactive state store (`createSignalBoxStore`) and MCP tool dispatcher (`executeSignalBoxMcpTool`, `POST /api/mcp`).

**Regression scope:** Interactive lever frame, tappet bed, and track diagram state (`Story 1, 2`), live PBT Exorcist and step-by-step counterexample replay in UI (`Story 4`), and MCP tool coordination for Kiro Crew agents (`Story 5`).

- [ ] `createSignalBoxStore` exposes lever state, tappet locking bars, active agent trains, EARS rule citations, audio mute state, and actions to pull/release levers, toggle presets, trigger `runExorcism()`, and step through shrunken counterexample frames — Source: Story 1
- [ ] Switching presets (`STANDARD_SAFE` ↔ `CURSED_MISSING_CROSSOVER_LOCK`) while a counterexample replay or collision alert is active immediately clears stale replay cursors, collision banners, and previous preset lever states — Source: Story 4 — Failure: F1
- [ ] `executeSignalBoxMcpTool` supports `request_route`, `release_route`, `inspect_interlock`, and `run_pbt_exorcism`, granting or rejecting agent route requests using the exact same interlocking kernel and EARS rules as manual lever pulls — Source: Story 5 — Failure: F5
- [ ] Invoking `executeSignalBoxMcpTool` with a missing/empty `agentId`, unknown tool name, or invalid `routeId` returns a structured error payload (`isError: true`, `errorCode`) without throwing an unhandled exception — Source: Story 5 — Failure: F2
- [ ] Next.js page renders the Victorian brass lever frame, tappet locking matrix, illuminated track diagram, PBT Exorcist & Shrinking Replay panel, and PBT Trial Receipt card, and `npm run build` succeeds cleanly — Source: Story 1

## Verification Log
