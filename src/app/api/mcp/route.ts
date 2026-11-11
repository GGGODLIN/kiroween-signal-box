import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

import {
  createSignalBoxStore,
  executeSignalBoxMcpTool,
  type SignalBoxStore,
} from '../../../lib/signal-box-store.ts';

const globalForSignalBox = globalThis as unknown as {
  signalBoxMcpStore?: SignalBoxStore;
};

const mcpStore: SignalBoxStore =
  globalForSignalBox.signalBoxMcpStore ?? createSignalBoxStore('STANDARD_SAFE');

globalForSignalBox.signalBoxMcpStore = mcpStore;

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const routeIds = ['NORTH_TO_BRIDGE', 'SOUTH_TO_BRIDGE', 'BRIDGE_MAINLINE', 'AUDIT_SIDING'];
const tools = [
  { name: 'request_route', description: 'Acquire a simulated interlocked route for agentId.', route: true },
  { name: 'release_route', description: 'Release a simulated route held by the same agentId.', route: true },
  { name: 'inspect_interlock', description: 'Inspect the current simulated frame and physical safety oracle.', route: false },
  { name: 'run_pbt_exorcism', description: 'Test isolated safe and fault-injected frames without changing held routes.', route: false },
].map(({ name, description, route }) => ({
  name,
  description,
  inputSchema: {
    type: 'object' as const,
    properties: {
      agentId: { type: 'string', minLength: 1 },
      ...(route ? { routeId: { type: 'string', enum: routeIds } } : {}),
    },
    required: route ? ['agentId', 'routeId'] : ['agentId'],
    additionalProperties: false,
  },
}));

export async function POST(request: Request): Promise<Response> {
  const origin = request.headers.get('origin');
  if (origin !== null && origin !== new URL(request.url).origin) {
    return Response.json({ error: 'Origin not allowed.' }, { status: 403 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({
      jsonrpc: '2.0', id: null,
      error: { code: -32700, message: 'Parse error' },
    }, { status: 400 });
  }

  if (payload !== null && typeof payload === 'object' &&
      !Array.isArray(payload) && 'toolName' in payload &&
      !('jsonrpc' in payload) && !('method' in payload)) {
    const result = executeSignalBoxMcpTool(mcpStore, payload);
    return Response.json(result, { status: result.isError ? 400 : 200 });
  }

  const server = new Server(
    { name: 'signal-box', version: '0.1.0' },
    { capabilities: { tools: {} }, instructions: 'Public simulation only. agentId is self-declared; route locks are process-local and reset on cold starts. Not an authenticated or distributed lock service.' },
  );
  server.setRequestHandler(ListToolsRequestSchema, () => ({ tools }));
  server.setRequestHandler(CallToolRequestSchema, ({ params }) => {
    const result = executeSignalBoxMcpTool(mcpStore, {
      ...params.arguments,
      toolName: params.name,
    });
    return {
      isError: result.isError,
      content: [{ type: 'text', text: JSON.stringify(result) }],
    };
  });
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  try {
    const response = await transport.handleRequest(request, { parsedBody: payload });
    // 先讀完 JSON，才能關閉每次請求的 transport 而不截斷回應。
    const body = await response.text();
    return new Response(body === '' ? null : body, {
      status: response.status,
      headers: response.headers,
    });
  } finally {
    await server.close();
  }
}

export function GET(): Response {
  return new Response(null, { status: 405, headers: { Allow: 'POST' } });
}
