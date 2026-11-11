# Technical Steering — Signal Box (LeverFrame)

## Stack
- **Runtime**: Node.js 24+ with native TypeScript execution (`node --experimental-strip-types --test`)
- **Framework**: Next.js 16 (App Router, server mode with dynamic `POST /api/mcp`) + React 19 + TypeScript 5 (`strict: true`)
- **MCP**: Official `@modelcontextprotocol/sdk` using JSON Streamable HTTP without transport sessions; route state remains process-local.
- **Property-Based Testing**: `fast-check` ^4.1.1
- **Styling & Audio**: Tailwind CSS v4 (Victorian dark-brass aesthetic) + WebAudio API mechanical synthesizer

## Engineering Constraints
- Use ES Modules (`import`/`export`), 2-space indentation, pure state transition functions, and `??` for nullish fallbacks.
- Keep `evaluatePhysicalTopology` 100% independent from `getInterlockPreset` so fault injection never corrupts the test oracle.
