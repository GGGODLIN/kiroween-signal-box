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

export async function POST(request: Request): Promise<Response> {
  let payload: unknown = null;
  try {
    payload = await request.json();
  } catch {
    payload = null;
  }

  const result = executeSignalBoxMcpTool(mcpStore, payload);
  return Response.json(result, {
    status: result.isError ? 400 : 200,
  });
}
