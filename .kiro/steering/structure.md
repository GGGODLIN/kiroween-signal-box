# Repository Structure Steering

## Layout
- `/.kiro/specs/signal-box/` — EARS requirements (`requirements.md`), system architecture (`design.md`), and task breakdown (`tasks.md`).
- `/.kiro/steering/` — Product, technical, structural, and workflow steering guides.
- `/.kiro/hooks/` — Kiro automated verification hooks (`verify-interlock-on-save.json`, `run-pbt-on-stop.json`).
- `/src/lib/interlocking.ts` — 8-lever Victorian mechanical interlocking state machine and independent Physical Topology Oracle (`Seam 1`).
- `/src/lib/pbt-exorcist.ts` — Stepwise `fast-check` property runner, counterexample shrinking, and replay engine (`Seam 1`).
- `/src/lib/signal-box-store.ts` — Interactive Signal Box store and MCP tool surface (`Seam 2`).
- `/src/app/` — Next.js Victorian Signal Box UI (`page.tsx`, `layout.tsx`, `globals.css`).
- `/tests/` — Node.js test suites verifying Seam 1 and Seam 2.
