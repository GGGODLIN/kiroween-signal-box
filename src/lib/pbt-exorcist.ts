import fc from 'fast-check';

import {
  applyLeverAction,
  createFrameState,
  evaluatePhysicalTopology,
  type LeverAction,
  type LeverId,
  type PresetId,
} from './interlocking.ts';

export type CounterexampleReplayBundle = {
  presetId: PresetId;
  violatedProperty: 'P1_NO_CONFLICTING_ROUTES' | 'P2_SIGNAL_POINT_LOCK_INTEGRITY';
  originalLength: number;
  shrunkActions: LeverAction[];
  failingStepIndex: number;
  collisionBlocks: string[];
  missingRuleId: string;
  seed: number;
};

export type ReachabilityWitnesses = {
  clearedSignalCount: number;
  blockedInterlockCount: number;
  appliedActionCount: number;
};

export type ExorcismReport = {
  presetId: PresetId;
  passed: boolean;
  numRunsExecuted: number;
  stepwiseAssertionsChecked: number;
  executionDurationMs: number;
  reachabilityWitnesses: ReachabilityWitnesses;
  counterexample: CounterexampleReplayBundle | null;
};

export type ReplayResult = {
  valid: boolean;
  errorCode: string | null;
  errorMessage: string | null;
  reproducedViolation: boolean;
  failingStepIndex: number | null;
  violatedProperty: 'P1_NO_CONFLICTING_ROUTES' | 'P2_SIGNAL_POINT_LOCK_INTEGRITY' | null;
  collisionBlocks: string[];
};

export type PbtTrialReceipt = {
  oracleDiscriminatesFault: boolean;
  reachabilityWitnesses: ReachabilityWitnesses;
  shrinkingRatio: {
    originalLength: number;
    shrunkLength: number;
    reductionFactor: number;
  };
  replayDeterministic: boolean;
  executionDurationMs: number;
  stepwiseAssertionsChecked: number;
  safeReport: ExorcismReport;
  cursedReport: ExorcismReport;
};

const VALID_PRESETS: readonly PresetId[] = [
  'STANDARD_SAFE',
  'CURSED_MISSING_CROSSOVER_LOCK',
];
const VALID_LEVERS: readonly LeverId[] = [1, 2, 3, 4, 5, 6, 7, 8];
const DEFAULT_NUM_RUNS = 80;
const DEFAULT_MAX_STEPS = 25;
const DEFAULT_SEED = 20261031;

function isValidAction(candidate: unknown): candidate is LeverAction {
  if (!candidate || typeof candidate !== 'object') {
    return false;
  }
  const record = candidate as Record<string, unknown>;
  const validLever =
    typeof record.leverId === 'number' &&
    Number.isInteger(record.leverId) &&
    VALID_LEVERS.includes(record.leverId as LeverId);
  const validIntent = record.intent === 'PULL' || record.intent === 'RELEASE';
  return validLever && validIntent;
}

export interface ExorcismOptions {
  seed?: number;
  examples?: [LeverAction[]][];
}

export const runInterlockingExorcism = (
  presetId: PresetId,
  options: ExorcismOptions = {},
): ExorcismReport => {
  const startTime = performance.now();

  const reachabilityWitnesses: ReachabilityWitnesses = {
    clearedSignalCount: 0,
    blockedInterlockCount: 0,
    appliedActionCount: 0,
  };

  let stepwiseAssertionsChecked = 0;
  let firstFailingOriginalLength: number | null = null;

  const actionArb: fc.Arbitrary<LeverAction> = fc.record({
    leverId: fc.constantFrom<LeverId>(1, 2, 3, 4, 5, 6, 7, 8),
    intent: fc.constantFrom<'PULL' | 'RELEASE'>('PULL', 'RELEASE'),
  });

  const sequenceArb = fc.array(actionArb, {
    minLength: 1,
    maxLength: DEFAULT_MAX_STEPS,
  });

  const property = fc.property(sequenceArb, (actions) => {
    let state = createFrameState(presetId);

    for (let i = 0; i < actions.length; i++) {
      state = applyLeverAction(state, actions[i]);

      if (state.lastOutcome === 'APPLIED') {
        reachabilityWitnesses.appliedActionCount += 1;
      } else if (state.lastOutcome === 'BLOCKED_BY_INTERLOCK') {
        reachabilityWitnesses.blockedInterlockCount += 1;
      }
      if (state.activeRoutes.length > 0) {
        reachabilityWitnesses.clearedSignalCount += 1;
      }

      stepwiseAssertionsChecked += 1;
      const topo = evaluatePhysicalTopology(state);
      const invariantsHold =
        topo.p1NoConflictingRoutes && topo.p2SignalPointLockIntegrity;

      if (!invariantsHold) {
        if (firstFailingOriginalLength === null) {
          firstFailingOriginalLength = actions.length;
        }
        return false;
      }
    }

    return true;
  });

  const details = fc.check(property, {
    numRuns: DEFAULT_NUM_RUNS,
    seed: options.seed ?? DEFAULT_SEED,
    examples: options.examples,
  });

  const executionDurationMs = Math.max(
    0,
    Math.round(performance.now() - startTime),
  );

  if (details.failed && details.counterexample && details.counterexample.length > 0) {
    const rawShrunk = details.counterexample[0];
    let state = createFrameState(presetId);
    let failingStepIndex = rawShrunk.length - 1;
    let failingTopology = evaluatePhysicalTopology(state);

    for (let k = 0; k < rawShrunk.length; k++) {
      state = applyLeverAction(state, rawShrunk[k]);
      const topo = evaluatePhysicalTopology(state);
      if (!topo.safe) {
        failingStepIndex = k;
        failingTopology = topo;
        break;
      }
    }

    const shrunkActions = rawShrunk
      .slice(0, failingStepIndex + 1)
      .map((action) => ({
        leverId: action.leverId,
        intent: action.intent,
      }));

    const originalLength = firstFailingOriginalLength ?? rawShrunk.length;

    const counterexample: CounterexampleReplayBundle = {
      presetId,
      violatedProperty:
        failingTopology.violatedProperty ?? 'P1_NO_CONFLICTING_ROUTES',
      originalLength,
      shrunkActions,
      failingStepIndex,
      collisionBlocks: [...failingTopology.collisionBlocks],
      missingRuleId: failingTopology.missingRuleId ?? 'EARS-ILK-01',
      seed: details.seed,
    };

    return {
      presetId,
      passed: false,
      numRunsExecuted: details.numRuns,
      stepwiseAssertionsChecked,
      executionDurationMs,
      reachabilityWitnesses,
      counterexample,
    };
  }

  return {
    presetId,
    passed: true,
    numRunsExecuted: details.numRuns,
    stepwiseAssertionsChecked,
    executionDurationMs,
    reachabilityWitnesses,
    counterexample: null,
  };
};

export const replayCounterexampleSequence = (
  bundle: unknown,
): ReplayResult => {
  if (!bundle || typeof bundle !== 'object') {
    return {
      valid: false,
      errorCode: 'INVALID_REPLAY_BUNDLE',
      errorMessage: 'Replay bundle must be a non-null object.',
      reproducedViolation: false,
      failingStepIndex: null,
      violatedProperty: null,
      collisionBlocks: [],
    };
  }

  const record = bundle as Record<string, unknown>;
  const presetId = record.presetId as PresetId;
  if (
    typeof presetId !== 'string' ||
    !VALID_PRESETS.includes(presetId)
  ) {
    return {
      valid: false,
      errorCode: 'INVALID_REPLAY_BUNDLE',
      errorMessage: `Invalid or unsupported presetId: ${String(record.presetId)}`,
      reproducedViolation: false,
      failingStepIndex: null,
      violatedProperty: null,
      collisionBlocks: [],
    };
  }

  if (!Array.isArray(record.shrunkActions) || record.shrunkActions.length === 0) {
    return {
      valid: false,
      errorCode: 'INVALID_REPLAY_BUNDLE',
      errorMessage: 'Replay bundle shrunkActions must be a non-empty array.',
      reproducedViolation: false,
      failingStepIndex: null,
      violatedProperty: null,
      collisionBlocks: [],
    };
  }

  for (let i = 0; i < record.shrunkActions.length; i++) {
    if (!isValidAction(record.shrunkActions[i])) {
      return {
        valid: false,
        errorCode: 'INVALID_REPLAY_BUNDLE',
        errorMessage: `Invalid lever action at index ${i}.`,
        reproducedViolation: false,
        failingStepIndex: null,
        violatedProperty: null,
        collisionBlocks: [],
      };
    }
  }

  const actions = record.shrunkActions as LeverAction[];
  let state = createFrameState(presetId);

  for (let stepIndex = 0; stepIndex < actions.length; stepIndex++) {
    const action: LeverAction = {
      leverId: actions[stepIndex].leverId,
      intent: actions[stepIndex].intent,
    };
    state = applyLeverAction(state, action);
    const topology = evaluatePhysicalTopology(state);

    if (!topology.safe) {
      return {
        valid: true,
        errorCode: null,
        errorMessage: null,
        reproducedViolation: true,
        failingStepIndex: stepIndex,
        violatedProperty: topology.violatedProperty,
        collisionBlocks: [...topology.collisionBlocks],
      };
    }
  }

  return {
    valid: true,
    errorCode: null,
    errorMessage: null,
    reproducedViolation: false,
    failingStepIndex: null,
    violatedProperty: null,
    collisionBlocks: [],
  };
};

export const generatePbtTrialReceipt = (): PbtTrialReceipt => {
  const safeReport = runInterlockingExorcism('STANDARD_SAFE');
  const cursedReport = runInterlockingExorcism(
    'CURSED_MISSING_CROSSOVER_LOCK',
  );

  const counterexample = cursedReport.counterexample;
  let replayDeterministic = false;

  if (counterexample !== null) {
    const firstReplay = replayCounterexampleSequence(counterexample);
    const secondReplay = replayCounterexampleSequence(counterexample);
    replayDeterministic =
      firstReplay.valid &&
      secondReplay.valid &&
      firstReplay.reproducedViolation &&
      secondReplay.reproducedViolation &&
      firstReplay.failingStepIndex === counterexample.failingStepIndex &&
      secondReplay.failingStepIndex === counterexample.failingStepIndex &&
      firstReplay.violatedProperty === counterexample.violatedProperty &&
      secondReplay.violatedProperty === counterexample.violatedProperty;
  }

  const originalLength = counterexample?.originalLength ?? 0;
  const shrunkLength = counterexample?.shrunkActions.length ?? 0;
  const reductionFactor =
    shrunkLength > 0 ? Number((originalLength / shrunkLength).toFixed(2)) : 0;

  return {
    oracleDiscriminatesFault:
      safeReport.passed === true &&
      cursedReport.passed === false &&
      counterexample !== null,
    reachabilityWitnesses: {
      clearedSignalCount: safeReport.reachabilityWitnesses.clearedSignalCount,
      blockedInterlockCount:
        safeReport.reachabilityWitnesses.blockedInterlockCount,
      appliedActionCount: safeReport.reachabilityWitnesses.appliedActionCount,
    },
    shrinkingRatio: {
      originalLength,
      shrunkLength,
      reductionFactor,
    },
    replayDeterministic,
    executionDurationMs:
      safeReport.executionDurationMs + cursedReport.executionDurationMs,
    stepwiseAssertionsChecked:
      safeReport.stepwiseAssertionsChecked +
      cursedReport.stepwiseAssertionsChecked,
    safeReport,
    cursedReport,
  };
};
