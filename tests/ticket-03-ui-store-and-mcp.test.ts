import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { replayCounterexampleSequence } from '../src/lib/pbt-exorcist.ts';
import { POST as postMcpRoute } from '../src/app/api/mcp/route.ts';
import {
  createSignalBoxStore,
  executeSignalBoxMcpTool,
} from '../src/lib/signal-box-store.ts';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TEST_DIR, '..');

test('AC 1: createSignalBoxStore exposes lever state, tappet locking bars, active agent trains, EARS rule citations, audio mute state, and actions to pull/release levers, toggle presets, trigger runExorcism(), and step through shrunken counterexample frames (Story 1)', () => {
  const store = createSignalBoxStore('STANDARD_SAFE');
  const initial = store.getState();

  assert.equal(initial.frame.presetId, 'STANDARD_SAFE');
  assert.equal(initial.topology.safe, true);
  assert.equal(initial.tappetBars.length > 0, true);
  assert.equal(initial.audioMuted, false);
  assert.equal(initial.lastSoundCue, 'NONE');
  assert.equal(initial.exorcismReport, null);
  assert.equal(initial.trialReceipt, null);
  assert.equal(initial.replayBundle, null);
  assert.equal(initial.replayCursor, null);
  assert.equal(initial.collisionBanner, null);

  // Pulling Signal #1 before FPL #3 is plunged triggers interlock clank and EARS citation
  const blockedPull = store.pullLever(1);
  assert.equal(blockedPull.frame.lastOutcome, 'BLOCKED_BY_INTERLOCK');
  assert.equal(blockedPull.frame.blockingRuleId, 'EARS-ILK-04');
  assert.match(
    blockedPull.frame.blockingEarsClause ?? '',
    /WHEN .+ THE SYSTEM SHALL /,
  );
  assert.equal(blockedPull.lastSoundCue, 'INTERLOCK_CLANK');

  // Plunge FPL #3 and pull Signal #1 to clear Builder train on NORTH_TO_BRIDGE
  const afterFpl = store.pullLever(3);
  assert.equal(afterFpl.frame.levers[3], 'REVERSE');
  assert.equal(afterFpl.lastSoundCue, 'LEVER_LATCH');

  const afterSignal1 = store.pullLever(1);
  assert.equal(afterSignal1.frame.levers[1], 'REVERSE');
  assert.equal(afterSignal1.frame.activeRoutes.length, 1);
  assert.equal(afterSignal1.frame.activeRoutes[0].agentTrain, 'Builder');
  assert.equal(
    afterSignal1.tappetBars.some(
      (bar) => bar.ruleId === 'EARS-ILK-01' && bar.engaged === true,
    ),
    true,
  );

  // Toggle audio mute
  const mutedState = store.toggleAudioMute();
  assert.equal(mutedState.audioMuted, true);
  const unmutedState = store.toggleAudioMute();
  assert.equal(unmutedState.audioMuted, false);

  // Switch to cursed preset, run PBT exorcism, and step through shrunken counterexample frames
  store.switchPreset('CURSED_MISSING_CROSSOVER_LOCK');
  const afterExorcism = store.runExorcism();
  assert.notEqual(afterExorcism.exorcismReport, null);
  assert.equal(afterExorcism.exorcismReport?.passed, false);
  assert.notEqual(afterExorcism.trialReceipt, null);
  assert.equal(afterExorcism.trialReceipt?.oracleDiscriminatesFault, true);
  assert.notEqual(afterExorcism.replayBundle, null);
  assert.equal(afterExorcism.replayCursor, null);

  const bundle = afterExorcism.replayBundle!;
  const cliReplay = replayCounterexampleSequence(bundle);
  assert.deepEqual(afterExorcism.replayVerification, cliReplay);

  let stepState = afterExorcism;
  for (let i = 0; i < bundle.shrunkActions.length; i++) {
    stepState = store.stepReplayForward();
    assert.equal(stepState.replayCursor, i);
  }
  assert.equal(stepState.topology.safe, false);
  assert.notEqual(stepState.collisionBanner, null);
  assert.equal(stepState.lastSoundCue, 'COLLISION_ALARM');
});

test('AC 2: Switching presets (STANDARD_SAFE <-> CURSED_MISSING_CROSSOVER_LOCK) while a counterexample replay or collision alert is active immediately clears stale replay cursors, collision banners, and previous preset lever states (Story 4 — Failure F1)', () => {
  const store = createSignalBoxStore('CURSED_MISSING_CROSSOVER_LOCK');
  store.runExorcism();

  const bundle = store.getState().replayBundle!;
  assert.notEqual(bundle, null);

  for (let i = 0; i < bundle.shrunkActions.length; i++) {
    store.stepReplayForward();
  }

  // Positive control: confirm replay cursor, collision banner, and reversed levers are active before switching
  const cursedActive = store.getState();
  assert.notEqual(cursedActive.replayCursor, null);
  assert.notEqual(cursedActive.collisionBanner, null);
  assert.equal(cursedActive.topology.safe, false);
  assert.equal(cursedActive.frame.levers[1], 'REVERSE');
  assert.equal(cursedActive.frame.levers[4], 'REVERSE');

  // Switch preset to STANDARD_SAFE and verify all stale cursed state is wiped
  const switchedToSafe = store.switchPreset('STANDARD_SAFE');
  assert.equal(switchedToSafe.frame.presetId, 'STANDARD_SAFE');
  assert.equal(switchedToSafe.replayBundle, null);
  assert.equal(switchedToSafe.replayCursor, null);
  assert.equal(switchedToSafe.replayVerification, null);
  assert.equal(switchedToSafe.exorcismReport, null);
  assert.equal(switchedToSafe.collisionBanner, null);
  assert.equal(switchedToSafe.topology.safe, true);
  assert.equal(switchedToSafe.frame.activeRoutes.length, 0);
  for (const leverId of [1, 2, 3, 4, 5, 6, 7, 8] as const) {
    assert.equal(switchedToSafe.frame.levers[leverId], 'NORMAL');
  }
});

test('AC 3: executeSignalBoxMcpTool supports request_route, release_route, inspect_interlock, and run_pbt_exorcism, granting or rejecting agent route requests using the exact same interlocking kernel and EARS rules as manual lever pulls (Story 5 — Failure F5)', () => {
  const store = createSignalBoxStore('STANDARD_SAFE');

  // 1. Builder requests NORTH_TO_BRIDGE -> granted
  const grantBuilder = executeSignalBoxMcpTool(store, {
    toolName: 'request_route',
    agentId: 'Builder',
    routeId: 'NORTH_TO_BRIDGE',
  });
  assert.equal(grantBuilder.isError, false);
  if (!grantBuilder.isError && grantBuilder.toolName === 'request_route') {
    assert.equal(grantBuilder.granted, true);
    assert.equal(grantBuilder.blockingRuleId, null);
    assert.equal(grantBuilder.frameState.levers[1], 'REVERSE');
    assert.equal(grantBuilder.frameState.levers[3], 'REVERSE');
  }

  // 2. Migrator requests conflicting SOUTH_TO_BRIDGE while NORTH_TO_BRIDGE is active -> rejected by EARS-ILK-01
  const leversBeforeRejectedRequests = { ...store.getState().frame.levers };
  const rejectMigrator = executeSignalBoxMcpTool(store, {
    toolName: 'request_route',
    agentId: 'Migrator',
    routeId: 'SOUTH_TO_BRIDGE',
  });
  assert.equal(rejectMigrator.isError, false);
  if (!rejectMigrator.isError && rejectMigrator.toolName === 'request_route') {
    assert.equal(rejectMigrator.granted, false);
    assert.equal(rejectMigrator.blockingRuleId, 'EARS-ILK-01');
    assert.match(
      rejectMigrator.blockingEarsClause ?? '',
      /WHEN .+ THE SYSTEM SHALL /,
    );
    assert.deepEqual(rejectMigrator.frameState.levers, leversBeforeRejectedRequests);
  }

  // Deployer requests conflicting BRIDGE_MAINLINE while NORTH_TO_BRIDGE is active -> rejected by EARS-ILK-06 without mutating Lever #7
  const rejectDeployer = executeSignalBoxMcpTool(store, {
    toolName: 'request_route',
    agentId: 'Deployer',
    routeId: 'BRIDGE_MAINLINE',
  });
  assert.equal(rejectDeployer.isError, false);
  if (!rejectDeployer.isError && rejectDeployer.toolName === 'request_route') {
    assert.equal(rejectDeployer.granted, false);
    assert.equal(rejectDeployer.blockingRuleId, 'EARS-ILK-06');
    assert.deepEqual(rejectDeployer.frameState.levers, leversBeforeRejectedRequests);
  }

  // 3. inspect_interlock returns current frame, topology, and tappetBars
  const inspectRes = executeSignalBoxMcpTool(store, {
    toolName: 'inspect_interlock',
    agentId: 'Verifier',
  });
  assert.equal(inspectRes.isError, false);
  if (!inspectRes.isError && inspectRes.toolName === 'inspect_interlock') {
    assert.equal(inspectRes.frame.activeRoutes.length, 1);
    assert.equal(inspectRes.topology.safe, true);
    assert.equal(inspectRes.tappetBars.length > 0, true);
  }

  // 4. Builder releases NORTH_TO_BRIDGE, then Migrator requests SOUTH_TO_BRIDGE -> granted
  const releaseBuilder = executeSignalBoxMcpTool(store, {
    toolName: 'release_route',
    agentId: 'Builder',
    routeId: 'NORTH_TO_BRIDGE',
  });
  assert.equal(releaseBuilder.isError, false);
  if (!releaseBuilder.isError && releaseBuilder.toolName === 'release_route') {
    assert.equal(releaseBuilder.released, true);
    assert.equal(releaseBuilder.frameState.levers[1], 'NORMAL');
  }

  const grantMigratorAfterRelease = executeSignalBoxMcpTool(store, {
    toolName: 'request_route',
    agentId: 'Migrator',
    routeId: 'SOUTH_TO_BRIDGE',
  });
  assert.equal(grantMigratorAfterRelease.isError, false);
  if (
    !grantMigratorAfterRelease.isError &&
    grantMigratorAfterRelease.toolName === 'request_route'
  ) {
    assert.equal(grantMigratorAfterRelease.granted, true);
    assert.equal(grantMigratorAfterRelease.frameState.levers[2], 'REVERSE');
    assert.equal(grantMigratorAfterRelease.frameState.levers[3], 'REVERSE');
    assert.equal(grantMigratorAfterRelease.frameState.levers[4], 'REVERSE');
  }

  // 5. Verifier runs PBT exorcism via MCP tool
  const pbtRes = executeSignalBoxMcpTool(store, {
    toolName: 'run_pbt_exorcism',
    agentId: 'Verifier',
  });
  assert.equal(pbtRes.isError, false);
  if (!pbtRes.isError && pbtRes.toolName === 'run_pbt_exorcism') {
    assert.equal(pbtRes.exorcismReport.passed, true);
    assert.equal(pbtRes.trialReceipt.oracleDiscriminatesFault, true);
  }
});

test('AC 4: Invoking executeSignalBoxMcpTool with a missing/empty agentId, unknown tool name, or invalid routeId returns a structured error payload (isError: true, errorCode) without throwing an unhandled exception (Story 5 — Failure F2)', () => {
  const store = createSignalBoxStore('STANDARD_SAFE');

  // Seed state and verify positive control before testing invalid MCP inputs
  store.pullLever(3);
  store.pullLever(1);
  const snapshotBeforeInvalidCalls = structuredClone(store.getState().frame);
  assert.equal(snapshotBeforeInvalidCalls.levers[1], 'REVERSE');

  const missingAgent = executeSignalBoxMcpTool(store, {
    toolName: 'inspect_interlock',
    agentId: '   ',
  });
  assert.equal(missingAgent.isError, true);
  if (missingAgent.isError) {
    assert.equal(missingAgent.errorCode, 'INVALID_AGENT_ID');
  }

  const unknownTool = executeSignalBoxMcpTool(store, {
    toolName: 'teleport_train',
    agentId: 'Builder',
  });
  assert.equal(unknownTool.isError, true);
  if (unknownTool.isError) {
    assert.equal(unknownTool.errorCode, 'UNKNOWN_MCP_TOOL');
  }

  const invalidRoute = executeSignalBoxMcpTool(store, {
    toolName: 'request_route',
    agentId: 'Builder',
    routeId: 'NON_EXISTENT_ROUTE',
  });
  assert.equal(invalidRoute.isError, true);
  if (invalidRoute.isError) {
    assert.equal(invalidRoute.errorCode, 'INVALID_ROUTE_ID');
  }

  const nonObjectPayload = executeSignalBoxMcpTool(store, null);
  assert.equal(nonObjectPayload.isError, true);

  // Verify store frame state was not mutated by any invalid MCP calls
  assert.deepEqual(store.getState().frame, snapshotBeforeInvalidCalls);
});

test('AC 5: Next.js UI and MCP route files exist and render the Victorian brass lever frame, tappet locking matrix, illuminated track diagram, PBT Exorcist & Shrinking Replay panel, and PBT Trial Receipt card (Story 1)', async () => {
  const pagePath = path.join(REPO_ROOT, 'src/app/page.tsx');
  const layoutPath = path.join(REPO_ROOT, 'src/app/layout.tsx');
  const mcpRoutePath = path.join(REPO_ROOT, 'src/app/api/mcp/route.ts');

  assert.equal(fs.existsSync(pagePath), true, 'Expected src/app/page.tsx to exist');
  assert.equal(fs.existsSync(layoutPath), true, 'Expected src/app/layout.tsx to exist');
  assert.equal(fs.existsSync(mcpRoutePath), true, 'Expected src/app/api/mcp/route.ts to exist');

  const pageSource = fs.readFileSync(pagePath, 'utf8');
  for (const requiredMarker of [
    'STANDARD_SAFE',
    'CURSED_MISSING_CROSSOVER_LOCK',
    'NORTH_TO_BRIDGE',
    'SOUTH_TO_BRIDGE',
    'BRIDGE_MAINLINE',
    'AUDIT_SIDING',
    'oracleDiscriminatesFault',
    'stepReplayForward',
    'AudioContext',
  ]) {
    assert.equal(
      pageSource.includes(requiredMarker),
      true,
      `Expected src/app/page.tsx to contain ${requiredMarker}`,
    );
  }

  const validPostRes = await postMcpRoute(
    new Request('http://localhost:3000/api/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        toolName: 'inspect_interlock',
        agentId: 'Verifier',
      }),
    }),
  );
  assert.equal(validPostRes.status, 200);
  const validBody = (await validPostRes.json()) as {
    isError: boolean;
    toolName: string;
  };
  assert.equal(validBody.isError, false);
  assert.equal(validBody.toolName, 'inspect_interlock');

  const invalidPostRes = await postMcpRoute(
    new Request('http://localhost:3000/api/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        toolName: 'unknown_tool',
        agentId: '',
      }),
    }),
  );
  assert.equal(invalidPostRes.status, 400);
  const invalidBody = (await invalidPostRes.json()) as {
    isError: boolean;
    errorCode: string;
  };
  assert.equal(invalidBody.isError, true);
  assert.equal(invalidBody.errorCode, 'UNKNOWN_MCP_TOOL');
});
