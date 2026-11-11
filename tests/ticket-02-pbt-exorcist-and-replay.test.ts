import assert from 'node:assert/strict';
import test from 'node:test';
import fc from 'fast-check';

import {
  applyLeverAction,
  createFrameState,
  evaluatePhysicalTopology,
  type LeverAction,
  type LeverId,
} from '../src/lib/interlocking.ts';
import {
  generatePbtTrialReceipt,
  replayCounterexampleSequence,
  runInterlockingExorcism,
  type CounterexampleReplayBundle,
} from '../src/lib/pbt-exorcist.ts';

test('AC 1: On STANDARD_SAFE, runInterlockingExorcism verifies P1 and P2 after every step, passes with 0 violations, and records non-zero reachability witnesses (Story 3)', () => {
  const report = runInterlockingExorcism('STANDARD_SAFE');

  assert.equal(report.presetId, 'STANDARD_SAFE');
  assert.equal(report.passed, true);
  assert.equal(report.counterexample, null);
  assert.equal(report.numRunsExecuted, 80);
  assert.equal(report.stepwiseAssertionsChecked > report.numRunsExecuted, true);
  assert.equal(report.reachabilityWitnesses.clearedSignalCount > 0, true);
  assert.equal(report.reachabilityWitnesses.blockedInterlockCount > 0, true);
  assert.equal(report.reachabilityWitnesses.appliedActionCount > 0, true);
  assert.equal(report.executionDurationMs >= 0, true);
});

test('AC 2: On CURSED_MISSING_CROSSOVER_LOCK, the P1/P2 oracle detects a physical route collision and fast-check shrinks the counterexample to <= 4 steps and < originalLength (Story 4)', () => {
  const report = runInterlockingExorcism('CURSED_MISSING_CROSSOVER_LOCK');

  assert.equal(report.presetId, 'CURSED_MISSING_CROSSOVER_LOCK');
  assert.equal(report.passed, false);
  assert.notEqual(report.counterexample, null);

  const counterexample = report.counterexample!;
  assert.equal(counterexample.presetId, 'CURSED_MISSING_CROSSOVER_LOCK');
  assert.equal(
    counterexample.violatedProperty === 'P1_NO_CONFLICTING_ROUTES' ||
      counterexample.violatedProperty === 'P2_SIGNAL_POINT_LOCK_INTEGRITY',
    true,
  );
  assert.equal(counterexample.shrunkActions.length > 0, true);
  assert.equal(
    counterexample.shrunkActions.length <= 4,
    true,
    `Expected shrunkActions.length <= 4, got ${counterexample.shrunkActions.length}`,
  );
  assert.equal(
    counterexample.shrunkActions.length < counterexample.originalLength,
    true,
    `Expected shrunkActions.length (${counterexample.shrunkActions.length}) < originalLength (${counterexample.originalLength})`,
  );
  assert.equal(
    counterexample.failingStepIndex,
    counterexample.shrunkActions.length - 1,
  );
});

test('AC 3: replayCounterexampleSequence deterministically re-executes shrunkActions from a clean initial state and reproduces the exact violation at failingStepIndex (Story 4)', () => {
  const cursedReport = runInterlockingExorcism('CURSED_MISSING_CROSSOVER_LOCK');
  assert.notEqual(cursedReport.counterexample, null);
  const bundle = cursedReport.counterexample!;

  const replayA = replayCounterexampleSequence(bundle);
  const replayB = replayCounterexampleSequence(structuredClone(bundle));

  assert.equal(replayA.valid, true);
  assert.equal(replayA.errorCode, null);
  assert.equal(replayA.errorMessage, null);
  assert.equal(replayA.reproducedViolation, true);
  assert.equal(replayA.failingStepIndex, bundle.failingStepIndex);
  assert.equal(replayA.violatedProperty, bundle.violatedProperty);
  assert.deepEqual(replayA.collisionBlocks, bundle.collisionBlocks);
  assert.deepEqual(replayA, replayB);
});

test('AC 4: generatePbtTrialReceipt outputs all 6 GPT-6 Pro trial evaluation metrics (Story 3)', () => {
  const receipt = generatePbtTrialReceipt();

  assert.equal(receipt.oracleDiscriminatesFault, true);
  assert.equal(receipt.safeReport.passed, true);
  assert.equal(receipt.cursedReport.passed, false);
  assert.equal(receipt.reachabilityWitnesses.clearedSignalCount > 0, true);
  assert.equal(receipt.reachabilityWitnesses.blockedInterlockCount > 0, true);
  assert.equal(receipt.reachabilityWitnesses.appliedActionCount > 0, true);
  assert.equal(
    receipt.shrinkingRatio.shrunkLength < receipt.shrinkingRatio.originalLength,
    true,
  );
  assert.equal(receipt.shrinkingRatio.shrunkLength > 0, true);
  assert.equal(receipt.shrinkingRatio.shrunkLength <= 4, true);
  assert.equal(receipt.shrinkingRatio.reductionFactor > 1, true);
  assert.equal(receipt.replayDeterministic, true);
  assert.equal(receipt.executionDurationMs >= 0, true);
  assert.equal(
    receipt.stepwiseAssertionsChecked,
    receipt.safeReport.stepwiseAssertionsChecked +
      receipt.cursedReport.stepwiseAssertionsChecked,
  );

  process.stdout.write(`PBT_TRIAL_RECEIPT=${JSON.stringify(receipt)}\n`);
});

test('AC 5: Running multiple exorcism passes back-to-back produces no cross-run state leakage between STANDARD_SAFE and CURSED_MISSING_CROSSOVER_LOCK (Story 3 — Failure F1)', () => {
  const cursedFirst = runInterlockingExorcism('CURSED_MISSING_CROSSOVER_LOCK');
  const safeAfterCursed = runInterlockingExorcism('STANDARD_SAFE');
  const cursedSecond = runInterlockingExorcism('CURSED_MISSING_CROSSOVER_LOCK');
  const safeSecond = runInterlockingExorcism('STANDARD_SAFE');

  // Positive control: cursed run genuinely fails and mutates levers within its own run
  assert.equal(cursedFirst.passed, false);
  assert.notEqual(cursedFirst.counterexample, null);

  // Subsequent safe run is completely unaffected by prior cursed failure
  assert.equal(safeAfterCursed.passed, true);
  assert.equal(safeAfterCursed.counterexample, null);
  assert.equal(safeSecond.passed, true);
  assert.deepEqual(
    safeAfterCursed.reachabilityWitnesses,
    safeSecond.reachabilityWitnesses,
  );
  assert.equal(
    safeAfterCursed.stepwiseAssertionsChecked,
    safeSecond.stepwiseAssertionsChecked,
  );
  assert.deepEqual(cursedFirst.counterexample, cursedSecond.counterexample);
});

test('AC 6: Passing an empty shrunkActions array or malformed replay bundle to replayCounterexampleSequence returns a structured validation error rather than a false-green pass (Story 4 — Failure F2)', () => {
  const validBundle: CounterexampleReplayBundle = {
    presetId: 'CURSED_MISSING_CROSSOVER_LOCK',
    violatedProperty: 'P1_NO_CONFLICTING_ROUTES',
    originalLength: 10,
    shrunkActions: [
      { leverId: 3, intent: 'PULL' },
      { leverId: 1, intent: 'PULL' },
      { leverId: 4, intent: 'PULL' },
    ],
    failingStepIndex: 2,
    collisionBlocks: ['junction-throat', 'schema-bridge'],
    missingRuleId: 'EARS-ILK-01',
    seed: 20261031,
  };

  // Positive control: valid bundle passes validation and reproduces violation
  const validReplay = replayCounterexampleSequence(validBundle);
  assert.equal(validReplay.valid, true);
  assert.equal(validReplay.reproducedViolation, true);

  const malformedInputs: unknown[] = [
    null,
    undefined,
    'not-an-object',
    { ...validBundle, presetId: 'UNKNOWN_PRESET' },
    { ...validBundle, shrunkActions: [] },
    {
      ...validBundle,
      shrunkActions: [{ leverId: 99, intent: 'PULL' }],
    },
    {
      ...validBundle,
      shrunkActions: [{ leverId: 1, intent: 'INVALID_INTENT' }],
    },
  ];

  for (const invalidInput of malformedInputs) {
    const res = replayCounterexampleSequence(invalidInput);
    assert.equal(res.valid, false);
    assert.equal(res.errorCode, 'INVALID_REPLAY_BUNDLE');
    assert.equal(typeof res.errorMessage, 'string');
    assert.equal((res.errorMessage ?? '').length > 0, true);
    assert.equal(res.reproducedViolation, false);
    assert.equal(res.failingStepIndex, null);
    assert.equal(res.violatedProperty, null);
    assert.deepEqual(res.collisionBlocks, []);
  }
});

test('AC 7: Both direct CLI test replay and store-triggered replay consume the identical shrunkActions array and report the same failing step index and violated property (Story 4 — Failure F5)', () => {
  const cursedReport = runInterlockingExorcism('CURSED_MISSING_CROSSOVER_LOCK');
  assert.notEqual(cursedReport.counterexample, null);
  const directBundle = cursedReport.counterexample!;

  // Simulate store-serialized bundle consuming the exact same shrunkActions array
  const storeTriggeredBundle: CounterexampleReplayBundle = JSON.parse(
    JSON.stringify(directBundle),
  ) as CounterexampleReplayBundle;

  assert.deepEqual(
    storeTriggeredBundle.shrunkActions,
    directBundle.shrunkActions,
  );

  const directReplay = replayCounterexampleSequence(directBundle);
  const storeReplay = replayCounterexampleSequence(storeTriggeredBundle);

  assert.equal(directReplay.valid, true);
  assert.equal(storeReplay.valid, true);
  assert.equal(directReplay.reproducedViolation, true);
  assert.equal(storeReplay.reproducedViolation, true);
  assert.equal(directReplay.failingStepIndex, directBundle.failingStepIndex);
  assert.equal(storeReplay.failingStepIndex, directReplay.failingStepIndex);
  assert.equal(directReplay.violatedProperty, directBundle.violatedProperty);
  assert.equal(storeReplay.violatedProperty, directReplay.violatedProperty);
  assert.deepEqual(storeReplay.collisionBlocks, directReplay.collisionBlocks);
});

test('originalLength equals the first failing input for fixed and randomly chosen seeds', () => {
  const actionArb = fc.record({
    leverId: fc.constantFrom<LeverId>(1, 2, 3, 4, 5, 6, 7, 8),
    intent: fc.constantFrom<'PULL' | 'RELEASE'>('PULL', 'RELEASE'),
  });
  const sequenceArb = fc.array(actionArb, { minLength: 1, maxLength: 25 });
  const seeds = [20261031, ...fc.sample(fc.integer(), 3)];
  for (const seed of seeds) {
    let firstFailure: LeverAction[] | null = null;
    fc.check(fc.property(sequenceArb, (actions) => {
      let state = createFrameState('CURSED_MISSING_CROSSOVER_LOCK');
      for (const action of actions) {
        state = applyLeverAction(state, action);
        if (!evaluatePhysicalTopology(state).safe) {
          firstFailure ??= actions;
          return false;
        }
      }
      return true;
    }), { seed, numRuns: 80 });
    const report = runInterlockingExorcism('CURSED_MISSING_CROSSOVER_LOCK', { seed });
    if (firstFailure === null) {
      assert.equal(report.counterexample, null);
    } else {
      assert.equal(report.counterexample?.originalLength, (firstFailure as LeverAction[]).length);
    }
    process.stdout.write(`LENGTH_SEED=${JSON.stringify({ seed, counterexample: report.counterexample })}\n`);
  }
});

test('a minimal first failure reports no shrinking instead of inventing one extra action', () => {
  const minimal: LeverAction[] = [
    { leverId: 3, intent: 'PULL' },
    { leverId: 1, intent: 'PULL' },
    { leverId: 4, intent: 'PULL' },
  ];
  // 固定首筆案例讓第一個失敗本身已最小，才能觀察零縮短的真實邊界。
  const bundle = runInterlockingExorcism('CURSED_MISSING_CROSSOVER_LOCK', {
    examples: [[minimal]],
  }).counterexample!;
  assert.deepEqual(bundle.shrunkActions, minimal);
  assert.equal(bundle.originalLength, 3);
  assert.equal(bundle.originalLength / bundle.shrunkActions.length, 1);
});
