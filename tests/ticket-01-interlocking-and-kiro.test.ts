import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  applyLeverAction,
  createFrameState,
  evaluatePhysicalTopology,
  getInterlockPreset,
  ROUTE_CATALOG,
  type LeverAction,
  type PresetId,
} from '../src/lib/interlocking.ts';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TEST_DIR, '..');

function isGitIgnored(repoRoot: string, relativePath: string): boolean {
  try {
    execFileSync('git', ['-C', repoRoot, 'check-ignore', '-q', relativePath], {
      stdio: 'ignore',
    });
    return true;
  } catch {
    return false;
  }
}

test('AC 1: Root /.kiro/ directory contains required specs, steering, and hooks files and is NOT gitignored (Story 6)', () => {
  const requiredKiroFiles = [
    '.kiro/specs/signal-box/requirements.md',
    '.kiro/specs/signal-box/design.md',
    '.kiro/specs/signal-box/tasks.md',
    '.kiro/steering/product.md',
    '.kiro/steering/tech.md',
    '.kiro/steering/structure.md',
    '.kiro/steering/workflow.md',
    '.kiro/hooks/verify-interlock-on-save.json',
    '.kiro/hooks/run-pbt-on-stop.json',
  ];

  for (const relPath of requiredKiroFiles) {
    const absPath = path.join(REPO_ROOT, relPath);
    assert.equal(
      fs.existsSync(absPath),
      true,
      `Expected required Kiro file to exist: ${relPath}`,
    );
    const stat = fs.statSync(absPath);
    assert.equal(stat.size > 50, true, `Expected ${relPath} to be non-empty`);
  }

  const requirementsContent = fs.readFileSync(
    path.join(REPO_ROOT, '.kiro/specs/signal-box/requirements.md'),
    'utf8',
  );
  for (const ruleId of [
    'EARS-ILK-01',
    'EARS-ILK-02',
    'EARS-ILK-03',
    'EARS-ILK-04',
    'EARS-ILK-05',
    'EARS-ILK-06',
    'EARS-ILK-07',
    'EARS-ILK-08',
    'P1_NO_CONFLICTING_ROUTES',
    'P2_SIGNAL_POINT_LOCK_INTEGRITY',
  ]) {
    assert.equal(
      requirementsContent.includes(ruleId),
      true,
      `Expected requirements.md to document ${ruleId}`,
    );
  }
  assert.match(requirementsContent, /WHEN .+ THE SYSTEM SHALL /);

  for (const hookRelPath of [
    '.kiro/hooks/verify-interlock-on-save.json',
    '.kiro/hooks/run-pbt-on-stop.json',
  ]) {
    const rawJson = fs.readFileSync(path.join(REPO_ROOT, hookRelPath), 'utf8');
    const parsed = JSON.parse(rawJson) as Record<string, unknown>;
    assert.equal(typeof parsed.name, 'string', `Expected ${hookRelPath} to define hook name`);
  }

  // Positive control: prove isGitIgnored returns true for ignored paths before asserting /.kiro is not ignored
  assert.equal(isGitIgnored(REPO_ROOT, '.next/cache.json'), true);
  assert.equal(
    isGitIgnored(REPO_ROOT, '.kiro/specs/signal-box/requirements.md'),
    false,
    'Expected /.kiro files NOT to be ignored by .gitignore',
  );
});

test('AC 2: Valid lever sequence clears North Up Main Signal #1 and activates NORTH_TO_BRIDGE route for Builder agent train (Story 1)', () => {
  assert.equal(Object.keys(ROUTE_CATALOG).length, 4);

  let state = createFrameState('STANDARD_SAFE');
  assert.equal(state.levers[2], 'NORMAL');
  assert.equal(state.levers[3], 'NORMAL');
  assert.equal(state.levers[1], 'NORMAL');
  assert.equal(state.activeRoutes.length, 0);

  // Step 1: Plunge Facing Point Lock #3 (REVERSE) while Point #2 is NORMAL
  state = applyLeverAction(state, { leverId: 3, intent: 'PULL' });
  assert.equal(state.lastOutcome, 'APPLIED');
  assert.equal(state.levers[3], 'REVERSE');
  assert.equal(state.blockingRuleId, null);

  // Step 2: Pull North Up Home Signal #1 (REVERSE)
  state = applyLeverAction(state, { leverId: 1, intent: 'PULL' });
  assert.equal(state.lastOutcome, 'APPLIED');
  assert.equal(state.levers[1], 'REVERSE');
  assert.equal(state.blockingRuleId, null);
  assert.equal(state.activeRoutes.length, 1);
  assert.deepEqual(state.activeRoutes[0], {
    routeId: 'NORTH_TO_BRIDGE',
    signalLever: 1,
    agentTrain: 'Builder',
    occupiedBlocks: ['north-approach', 'junction-throat', 'schema-bridge'],
  });
  assert.deepEqual(state.occupiedBlocks, [
    'north-approach',
    'junction-throat',
    'schema-bridge',
  ]);

  const topology = evaluatePhysicalTopology(state);
  assert.equal(topology.safe, true);
  assert.equal(topology.p1NoConflictingRoutes, true);
  assert.equal(topology.p2SignalPointLockIntegrity, true);
  assert.equal(topology.violatedProperty, null);
});

test('AC 3: Conflicting pulls (Signal #4 REVERSE or FPL #3 NORMAL while Signal #1 is clear) are blocked with EARS rule IDs and preserve lever state (Story 2)', () => {
  const initial = createFrameState('STANDARD_SAFE');
  const lockedFpl = applyLeverAction(initial, { leverId: 3, intent: 'PULL' });
  const clearedNorth = applyLeverAction(lockedFpl, { leverId: 1, intent: 'PULL' });

  // Positive control: state changed when valid pull was applied
  assert.equal(clearedNorth.levers[1], 'REVERSE');
  assert.equal(clearedNorth.activeRoutes.length, 1);

  const snapshotBeforeBlockedPull = structuredClone(clearedNorth);

  // Attempt conflicting pull on South Branch Signal #4
  const blockedSignal4 = applyLeverAction(clearedNorth, { leverId: 4, intent: 'PULL' });
  assert.equal(blockedSignal4.lastOutcome, 'BLOCKED_BY_INTERLOCK');
  assert.equal(blockedSignal4.blockingRuleId, 'EARS-ILK-01');
  assert.equal(typeof blockedSignal4.blockingReason, 'string');
  assert.match(blockedSignal4.blockingEarsClause ?? '', /WHEN .+ THE SYSTEM SHALL /);
  assert.deepEqual(blockedSignal4.levers, snapshotBeforeBlockedPull.levers);
  assert.deepEqual(blockedSignal4.activeRoutes, snapshotBeforeBlockedPull.activeRoutes);
  assert.deepEqual(clearedNorth, snapshotBeforeBlockedPull);

  // Attempt to unlock FPL #3 while Signal #1 is REVERSE (backlock)
  const blockedUnlockFpl3 = applyLeverAction(clearedNorth, { leverId: 3, intent: 'RELEASE' });
  assert.equal(blockedUnlockFpl3.lastOutcome, 'BLOCKED_BY_INTERLOCK');
  assert.equal(blockedUnlockFpl3.blockingRuleId, 'EARS-ILK-02');
  assert.deepEqual(blockedUnlockFpl3.levers, snapshotBeforeBlockedPull.levers);

  // Attempt to move Point #2 while FPL #3 is REVERSE
  const blockedPoint2 = applyLeverAction(clearedNorth, { leverId: 2, intent: 'PULL' });
  assert.equal(blockedPoint2.lastOutcome, 'BLOCKED_BY_INTERLOCK');
  assert.equal(blockedPoint2.blockingRuleId, 'EARS-ILK-03');
  assert.deepEqual(blockedPoint2.levers, snapshotBeforeBlockedPull.levers);
});

test('AC 4: Out-of-range lever ID or unknown preset name fails deterministically without mutating frame state (Story 2 — Failure F2)', () => {
  assert.throws(
    () => getInterlockPreset('INVALID_PRESET' as PresetId),
    /Unknown interlock preset/,
  );
  assert.throws(
    () => createFrameState('INVALID_PRESET' as PresetId),
    /Unknown interlock preset/,
  );

  // Pre-seed non-trivial state before testing invariance on invalid input
  let seeded = createFrameState('STANDARD_SAFE');
  seeded = applyLeverAction(seeded, { leverId: 3, intent: 'PULL' });
  seeded = applyLeverAction(seeded, { leverId: 1, intent: 'PULL' });
  const seededSnapshot = structuredClone(seeded);

  const invalidLeverResult = applyLeverAction(seeded, {
    leverId: 99 as LeverAction['leverId'],
    intent: 'PULL',
  });
  assert.equal(invalidLeverResult.lastOutcome, 'INVALID_INPUT');
  assert.equal(invalidLeverResult.blockingRuleId, 'EARS-VAL-01');
  assert.deepEqual(invalidLeverResult.levers, seededSnapshot.levers);
  assert.deepEqual(invalidLeverResult.activeRoutes, seededSnapshot.activeRoutes);
  assert.deepEqual(seeded, seededSnapshot);
});

test('AC 5: CURSED_MISSING_CROSSOVER_LOCK weakens only the SUT locking matrix while evaluatePhysicalTopology detects physical collisions (Story 3 — Failure F5)', () => {
  const standardRules = getInterlockPreset('STANDARD_SAFE');
  const cursedRules = getInterlockPreset('CURSED_MISSING_CROSSOVER_LOCK');

  assert.equal(
    standardRules.some((r) => r.ruleId === 'EARS-ILK-01'),
    true,
  );
  assert.equal(
    cursedRules.some((r) => r.ruleId === 'EARS-ILK-01'),
    false,
  );

  let cursedState = createFrameState('CURSED_MISSING_CROSSOVER_LOCK');
  cursedState = applyLeverAction(cursedState, { leverId: 3, intent: 'PULL' });
  cursedState = applyLeverAction(cursedState, { leverId: 1, intent: 'PULL' });

  // Under the cursed SUT table, pulling Signal #4 is erroneously allowed
  cursedState = applyLeverAction(cursedState, { leverId: 4, intent: 'PULL' });
  assert.equal(cursedState.lastOutcome, 'APPLIED');
  assert.equal(cursedState.levers[1], 'REVERSE');
  assert.equal(cursedState.levers[4], 'REVERSE');

  // Independent Physical Topology Oracle catches the collision and point misalignment
  const oracleReport = evaluatePhysicalTopology(cursedState);
  assert.equal(oracleReport.safe, false);
  assert.equal(oracleReport.p1NoConflictingRoutes, false);
  assert.equal(oracleReport.p2SignalPointLockIntegrity, false);
  assert.equal(oracleReport.violatedProperty, 'P1_NO_CONFLICTING_ROUTES');
  assert.deepEqual(oracleReport.collisionBlocks, ['junction-throat', 'schema-bridge']);
  assert.deepEqual(oracleReport.misalignedSignals, [4]);
  assert.equal(oracleReport.missingRuleId, 'EARS-ILK-01');

  // Verify P2-only violation when Signal #1 is released leaving Signal #4 clear with Point #2 still NORMAL
  const p2ViolationState = applyLeverAction(cursedState, { leverId: 1, intent: 'RELEASE' });
  const p2Report = evaluatePhysicalTopology(p2ViolationState);
  assert.equal(p2Report.safe, false);
  assert.equal(p2Report.p1NoConflictingRoutes, true);
  assert.equal(p2Report.p2SignalPointLockIntegrity, false);
  assert.equal(p2Report.violatedProperty, 'P2_SIGNAL_POINT_LOCK_INTEGRITY');
  assert.deepEqual(p2Report.misalignedSignals, [4]);
  assert.equal(p2Report.missingRuleId, 'EARS-ILK-05');
});

test('AC 6: Pulling an already-reversed lever or releasing an already-normal lever is idempotent without duplicating routes or corrupting history (Story 1 — Failure F6)', () => {
  let state = createFrameState('STANDARD_SAFE');
  state = applyLeverAction(state, { leverId: 3, intent: 'PULL' });
  state = applyLeverAction(state, { leverId: 1, intent: 'PULL' });

  assert.equal(state.activeRoutes.length, 1);
  assert.equal(state.stepHistory.length, 2);

  // Pulling Signal #1 again when already REVERSE
  const repeatedPull = applyLeverAction(state, { leverId: 1, intent: 'PULL' });
  assert.equal(repeatedPull.lastOutcome, 'NO_OP_IDEMPOTENT');
  assert.equal(repeatedPull.blockingRuleId, null);
  assert.equal(repeatedPull.blockingReason, null);
  assert.equal(repeatedPull.activeRoutes.length, 1);
  assert.equal(repeatedPull.stepHistory.length, 2);
  assert.deepEqual(repeatedPull.levers, state.levers);

  // Releasing Point #2 when already NORMAL
  const repeatedRelease = applyLeverAction(repeatedPull, { leverId: 2, intent: 'RELEASE' });
  assert.equal(repeatedRelease.lastOutcome, 'NO_OP_IDEMPOTENT');
  assert.equal(repeatedRelease.blockingRuleId, null);
  assert.equal(repeatedRelease.activeRoutes.length, 1);
  assert.equal(repeatedRelease.stepHistory.length, 2);
});
