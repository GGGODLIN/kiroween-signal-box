# Signal Box — Victorian interlocking for parallel AI agents

Signal Box is a browser simulation of a mechanical railway signal box. Builder and Migrator can request the same junction, but the locking rules refuse a conflicting route before its signal clears. The brass lever frame shows which lock stopped the action and cites its EARS requirement.

[Try the live Vercel workbench & MCP server](https://kiroween-signal-box.vercel.app) · [Static browser mirror](https://blog.gggodlin.com/kiroween-signal-box/) · [Watch the launch film](https://youtu.be/qXKqfpr7NzE) · [Read the source](https://github.com/GGGODLIN/kiroween-signal-box) · [Read the technical article](https://dev.to/gggodlin/resurrecting-the-1856-victorian-signal-box-with-kiro-spec-driven-development-property-based-oae)

## What it does

The [interlocking engine](https://github.com/GGGODLIN/kiroween-signal-box/blob/main/src/lib/interlocking.ts) models eight levers and four routes. Signals represent Builder, Migrator, Deployer, and Verifier. Points, facing point locks, and clearance tokens constrain which routes can open.

The safety oracle checks physical block occupancy and point alignment independently of the locking table. Switching to `CURSED_MISSING_CROSSOVER_LOCK` removes a conflict rule and weakens a point check. The independent oracle still catches the collision.

The [PBT Exorcist](https://github.com/GGGODLIN/kiroween-signal-box/blob/main/src/lib/pbt-exorcist.ts) uses `fast-check` to test both safety properties after each action. With seed `20261031`, the 2026-11-11 verification ran 80 safe sequences with 461 step checks. The faulty table failed on run 3; its first failing input contained 11 actions and its replay counterexample contained 3. Other seeds can produce different counts or find no failure within the run budget. When the first failure is already minimal, the report honestly shows equal lengths.

The [interactive workbench](https://github.com/GGGODLIN/kiroween-signal-box/blob/main/src/app/page.tsx) combines the illuminated track diagram, lever frame, locking bed, WebAudio sounds, and stepwise replay. The [store and tool dispatcher](https://github.com/GGGODLIN/kiroween-signal-box/blob/main/src/lib/signal-box-store.ts) share the same interlocking transitions.

## MCP endpoint and deployment

The [MCP route](https://github.com/GGGODLIN/kiroween-signal-box/blob/main/src/app/api/mcp/route.ts) supports JSON-RPC 2.0 `initialize`, `notifications/initialized`, `tools/list`, and `tools/call` through the official MCP SDK. Tools are `request_route`, `release_route`, `inspect_interlock`, and `run_pbt_exorcism`. Existing workbench requests remain supported.

A granted route records its `agentId`. Another ID cannot take over or release it. This compares self-declared IDs; it does not authenticate an agent. The browser and HTTP stores are separate, process-local simulations. Server cold starts reset the HTTP store, and separate Vercel instances do not share locks. Signal Box does not coordinate real production deployments or provide distributed locking.

The repository is deployed in Next.js server mode on Vercel at [kiroween-signal-box.vercel.app](https://kiroween-signal-box.vercel.app), serving the dynamic `POST https://kiroween-signal-box.vercel.app/api/mcp` endpoint (verified across JSON-RPC 2.0 `initialize`, `notifications/initialized`, `tools/list`, and `tools/call`; empty `GET` returns `405`). The GitHub Pages mirror linked above is a static browser demo only and does not serve `/api/mcp`.

## Specifications and AI assistance

The tracked [Kiro directory](https://github.com/GGGODLIN/kiroween-signal-box/tree/main/.kiro) contains:

- [EARS requirements](https://github.com/GGGODLIN/kiroween-signal-box/blob/main/.kiro/specs/signal-box/requirements.md), [design](https://github.com/GGGODLIN/kiroween-signal-box/blob/main/.kiro/specs/signal-box/design.md), and [verified task status](https://github.com/GGGODLIN/kiroween-signal-box/blob/main/.kiro/specs/signal-box/tasks.md).
- [Product](https://github.com/GGGODLIN/kiroween-signal-box/blob/main/.kiro/steering/product.md), [technical](https://github.com/GGGODLIN/kiroween-signal-box/blob/main/.kiro/steering/tech.md), [structure](https://github.com/GGGODLIN/kiroween-signal-box/blob/main/.kiro/steering/structure.md), and [workflow](https://github.com/GGGODLIN/kiroween-signal-box/blob/main/.kiro/steering/workflow.md) steering files.
- [Save-time interlocking test hook definition](https://github.com/GGGODLIN/kiroween-signal-box/blob/main/.kiro/hooks/verify-interlock-on-save.json) and [agent-stop PBT hook definition](https://github.com/GGGODLIN/kiroween-signal-box/blob/main/.kiro/hooks/run-pbt-on-stop.json).

These files establish the repository's specifications and hook definitions. They do not prove Kiro authored or executed the work. Kiro session and hook execution evidence remains unverified. Claude Code with GPT performed the current remediation; existing Git history also records other AI assistance. Task checkboxes describe verified implementation, not tool authorship. No Kiro execution record was created or fabricated during this remediation.

## Verification

On 2026-11-11, `npm test` passed 23 unit and PBT tests with test concurrency limited to 3. The suite covers both safety properties, deterministic replay, true original lengths with fixed and randomly chosen seeds, all four route owners, MCP handshake, tool discovery, and tool calls. `npx tsc --noEmit` and `npm run build` passed. `npm audit` reported zero vulnerabilities after updating Next.js to `16.4.6`.

React Doctor reported zero errors and eight warnings in existing code. The UI interaction check exercised route acquisition, conflict refusal, owner release, and the three-step collision replay against the local production build.

## License

[MIT license](https://github.com/GGGODLIN/kiroween-signal-box/blob/main/LICENSE).
