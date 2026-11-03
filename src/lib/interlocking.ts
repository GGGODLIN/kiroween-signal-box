export type LeverId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export type LeverState = 'NORMAL' | 'REVERSE';
export type LeverRole = 'SIGNAL' | 'POINT' | 'LOCK' | 'CLEARANCE';
export type PresetId = 'STANDARD_SAFE' | 'CURSED_MISSING_CROSSOVER_LOCK';
export type RouteId = 'NORTH_TO_BRIDGE' | 'SOUTH_TO_BRIDGE' | 'BRIDGE_MAINLINE' | 'AUDIT_SIDING';
export type AgentTrainId = 'Builder' | 'Migrator' | 'Deployer' | 'Verifier';

export type LeverAction = {
  leverId: LeverId;
  intent: 'PULL' | 'RELEASE';
};

export type InterlockRule = {
  ruleId: string;
  description: string;
  earsClause: string;
  appliesToLever: LeverId;
  targetIntent: 'PULL' | 'RELEASE';
  check: (levers: Record<LeverId, LeverState>) => { allowed: boolean; reason?: string };
};

export type ActiveRoute = {
  routeId: RouteId;
  signalLever: LeverId;
  agentTrain: AgentTrainId;
  occupiedBlocks: string[];
};

export type StepHistoryEntry = {
  stepIndex: number;
  action: LeverAction;
  outcome: 'APPLIED' | 'NO_OP_IDEMPOTENT' | 'BLOCKED_BY_INTERLOCK' | 'INVALID_INPUT';
  blockingRuleId: string | null;
  blockingReason: string | null;
};

export type FrameState = {
  presetId: PresetId;
  levers: Record<LeverId, LeverState>;
  activeRoutes: ActiveRoute[];
  occupiedBlocks: string[];
  lastOutcome: 'INITIAL' | 'APPLIED' | 'NO_OP_IDEMPOTENT' | 'BLOCKED_BY_INTERLOCK' | 'INVALID_INPUT';
  blockingRuleId: string | null;
  blockingReason: string | null;
  blockingEarsClause: string | null;
  stepHistory: StepHistoryEntry[];
};

export type TopologyEvaluation = {
  safe: boolean;
  p1NoConflictingRoutes: boolean;
  p2SignalPointLockIntegrity: boolean;
  violatedProperty: 'P1_NO_CONFLICTING_ROUTES' | 'P2_SIGNAL_POINT_LOCK_INTEGRITY' | null;
  collisionBlocks: string[];
  misalignedSignals: LeverId[];
  missingRuleId: string | null;
  details: string;
};

export type LeverMetadata = {
  leverId: LeverId;
  name: string;
  shortLabel: string;
  role: LeverRole;
  agentTrain?: AgentTrainId;
  routeId?: RouteId;
  occupiedBlocks?: string[];
  description: string;
};

export type RouteMetadata = {
  routeId: RouteId;
  name: string;
  signalLever: LeverId;
  agentTrain: AgentTrainId;
  occupiedBlocks: string[];
  requiredLevers: Partial<Record<LeverId, LeverState>>;
};

const VALID_LEVER_IDS: readonly LeverId[] = [1, 2, 3, 4, 5, 6, 7, 8];
const VALID_PRESET_IDS: readonly PresetId[] = [
  'STANDARD_SAFE',
  'CURSED_MISSING_CROSSOVER_LOCK',
];

export const LEVER_CATALOG: Record<LeverId, LeverMetadata> = {
  1: {
    leverId: 1,
    name: 'North Up Home Signal #1',
    shortLabel: 'SIG #1',
    role: 'SIGNAL',
    agentTrain: 'Builder',
    routeId: 'NORTH_TO_BRIDGE',
    occupiedBlocks: ['north-approach', 'junction-throat', 'schema-bridge'],
    description: 'Clears Builder Agent train from North Up Main across Junction Throat onto Schema Bridge.',
  },
  2: {
    leverId: 2,
    name: 'Junction Crossover Point #2',
    shortLabel: 'PT #2',
    role: 'POINT',
    description: 'NORMAL aligns North Up Main straight to Schema Bridge; REVERSE diverges South Branch across crossover.',
  },
  3: {
    leverId: 3,
    name: 'Facing Point Lock #3 (FPL)',
    shortLabel: 'FPL #3',
    role: 'LOCK',
    description: 'REVERSE plunges the steel lock bar into Point #2 so the switch cannot move beneath a train.',
  },
  4: {
    leverId: 4,
    name: 'South Branch Home Signal #4',
    shortLabel: 'SIG #4',
    role: 'SIGNAL',
    agentTrain: 'Migrator',
    routeId: 'SOUTH_TO_BRIDGE',
    occupiedBlocks: ['south-branch', 'junction-throat', 'schema-bridge'],
    description: 'Clears Migrator Agent train from South Branch over the crossover onto Schema Bridge.',
  },
  5: {
    leverId: 5,
    name: 'Schema Bridge Distant Signal #5',
    shortLabel: 'SIG #5',
    role: 'SIGNAL',
    agentTrain: 'Deployer',
    routeId: 'BRIDGE_MAINLINE',
    occupiedBlocks: ['schema-bridge', 'prod-mainline'],
    description: 'Clears Deployer Agent train from Schema Bridge onto Production Mainline.',
  },
  6: {
    leverId: 6,
    name: 'Shunt & Audit Dwarf Signal #6',
    shortLabel: 'SIG #6',
    role: 'SIGNAL',
    agentTrain: 'Verifier',
    routeId: 'AUDIT_SIDING',
    occupiedBlocks: ['junction-throat', 'audit-siding'],
    description: 'Clears Verifier Agent train through Junction Throat into Audit Siding under Maintenance Isolation.',
  },
  7: {
    leverId: 7,
    name: 'Bridge Token Clearance #7',
    shortLabel: 'TOK #7',
    role: 'CLEARANCE',
    description: 'REVERSE grants the single-line high-speed mainline exit token required by Signal #5.',
  },
  8: {
    leverId: 8,
    name: 'Maintenance Isolation Lock #8',
    shortLabel: 'ISO #8',
    role: 'CLEARANCE',
    description: 'REVERSE isolates the junction for Verifier (Signal #6), locking Signals #1, #4, and #5 in NORMAL.',
  },
};

export const ROUTE_CATALOG: Record<RouteId, RouteMetadata> = {
  NORTH_TO_BRIDGE: {
    routeId: 'NORTH_TO_BRIDGE',
    name: 'North Up Main to Schema Bridge',
    signalLever: 1,
    agentTrain: 'Builder',
    occupiedBlocks: ['north-approach', 'junction-throat', 'schema-bridge'],
    requiredLevers: { 2: 'NORMAL', 3: 'REVERSE', 8: 'NORMAL' },
  },
  SOUTH_TO_BRIDGE: {
    routeId: 'SOUTH_TO_BRIDGE',
    name: 'South Branch Crossover to Schema Bridge',
    signalLever: 4,
    agentTrain: 'Migrator',
    occupiedBlocks: ['south-branch', 'junction-throat', 'schema-bridge'],
    requiredLevers: { 2: 'REVERSE', 3: 'REVERSE', 8: 'NORMAL' },
  },
  BRIDGE_MAINLINE: {
    routeId: 'BRIDGE_MAINLINE',
    name: 'Schema Bridge to Production Mainline',
    signalLever: 5,
    agentTrain: 'Deployer',
    occupiedBlocks: ['schema-bridge', 'prod-mainline'],
    requiredLevers: { 7: 'REVERSE', 8: 'NORMAL' },
  },
  AUDIT_SIDING: {
    routeId: 'AUDIT_SIDING',
    name: 'Junction Throat to Audit Siding',
    signalLever: 6,
    agentTrain: 'Verifier',
    occupiedBlocks: ['junction-throat', 'audit-siding'],
    requiredLevers: { 3: 'REVERSE', 8: 'REVERSE' },
  },
};

function assertValidPresetId(presetId: unknown): asserts presetId is PresetId {
  if (
    typeof presetId !== 'string' ||
    !VALID_PRESET_IDS.includes(presetId as PresetId)
  ) {
    throw new Error(`Unknown interlock preset: ${String(presetId)}`);
  }
}

function isValidLeverId(leverId: unknown): leverId is LeverId {
  return (
    typeof leverId === 'number' &&
    Number.isInteger(leverId) &&
    VALID_LEVER_IDS.includes(leverId as LeverId)
  );
}

function isValidIntent(intent: unknown): intent is 'PULL' | 'RELEASE' {
  return intent === 'PULL' || intent === 'RELEASE';
}

function deriveActiveRoutesAndBlocks(levers: Record<LeverId, LeverState>): {
  activeRoutes: ActiveRoute[];
  occupiedBlocks: string[];
} {
  const signalRouteOrder: readonly RouteMetadata[] = [
    ROUTE_CATALOG.NORTH_TO_BRIDGE,
    ROUTE_CATALOG.SOUTH_TO_BRIDGE,
    ROUTE_CATALOG.BRIDGE_MAINLINE,
    ROUTE_CATALOG.AUDIT_SIDING,
  ];

  const activeRoutes: ActiveRoute[] = [];
  const occupiedBlocks: string[] = [];

  for (const route of signalRouteOrder) {
    if (levers[route.signalLever] === 'REVERSE') {
      activeRoutes.push({
        routeId: route.routeId,
        signalLever: route.signalLever,
        agentTrain: route.agentTrain,
        occupiedBlocks: [...route.occupiedBlocks],
      });
      for (const block of route.occupiedBlocks) {
        if (!occupiedBlocks.includes(block)) {
          occupiedBlocks.push(block);
        }
      }
    }
  }

  return { activeRoutes, occupiedBlocks };
}

export const getInterlockPreset = (presetId: PresetId): InterlockRule[] => {
  assertValidPresetId(presetId);

  const sharedRulesBeforeIlk05: InterlockRule[] = [
    {
      ruleId: 'EARS-ILK-02',
      description: 'Backlock Facing Point Lock #3 while any junction signal (#1, #4, #6) is REVERSE.',
      earsClause:
        'WHEN any junction signal (#1, #4, #6) is REVERSE, THE SYSTEM SHALL backlock Facing Point Lock #3 in REVERSE so the switch cannot be unlocked under a clear signal.',
      appliesToLever: 3,
      targetIntent: 'RELEASE',
      check: (levers) => {
        if (
          levers[1] === 'REVERSE' ||
          levers[4] === 'REVERSE' ||
          levers[6] === 'REVERSE'
        ) {
          return {
            allowed: false,
            reason:
              'Facing Point Lock #3 is backlocked while Signal #1, #4, or #6 is clear (REVERSE).',
          };
        }
        return { allowed: true };
      },
    },
    {
      ruleId: 'EARS-ILK-03',
      description: 'Lock Point #2 (PULL) when FPL #3 is plunged or any junction signal (#1, #4, #6) is clear.',
      earsClause:
        'WHEN Facing Point Lock #3 is REVERSE or any of Signals #1, #4, #6 is REVERSE, THE SYSTEM SHALL lock Point #2 in its current position.',
      appliesToLever: 2,
      targetIntent: 'PULL',
      check: (levers) => {
        if (
          levers[3] === 'REVERSE' ||
          levers[1] === 'REVERSE' ||
          levers[4] === 'REVERSE' ||
          levers[6] === 'REVERSE'
        ) {
          return {
            allowed: false,
            reason:
              'Point #2 is mechanically locked by Facing Point Lock #3 (REVERSE) or an active junction signal.',
          };
        }
        return { allowed: true };
      },
    },
    {
      ruleId: 'EARS-ILK-03',
      description: 'Lock Point #2 (RELEASE) when FPL #3 is plunged or any junction signal (#1, #4, #6) is clear.',
      earsClause:
        'WHEN Facing Point Lock #3 is REVERSE or any of Signals #1, #4, #6 is REVERSE, THE SYSTEM SHALL lock Point #2 in its current position.',
      appliesToLever: 2,
      targetIntent: 'RELEASE',
      check: (levers) => {
        if (
          levers[3] === 'REVERSE' ||
          levers[1] === 'REVERSE' ||
          levers[4] === 'REVERSE' ||
          levers[6] === 'REVERSE'
        ) {
          return {
            allowed: false,
            reason:
              'Point #2 is mechanically locked by Facing Point Lock #3 (REVERSE) or an active junction signal.',
          };
        }
        return { allowed: true };
      },
    },
    {
      ruleId: 'EARS-ILK-04',
      description: 'North Up Home Signal #1 requires Point #2 NORMAL, FPL #3 REVERSE, Signals #4/#5/#6 NORMAL, and Lever #8 NORMAL.',
      earsClause:
        'WHEN pulling North Up Home Signal #1, THE SYSTEM SHALL require Point #2 in NORMAL, FPL #3 in REVERSE, Signals #4, #5, #6 in NORMAL, and Maintenance Isolation Lock #8 in NORMAL.',
      appliesToLever: 1,
      targetIntent: 'PULL',
      check: (levers) => {
        if (levers[2] !== 'NORMAL') {
          return {
            allowed: false,
            reason: 'Signal #1 requires Point #2 in NORMAL (straight mainline alignment).',
          };
        }
        if (levers[3] !== 'REVERSE') {
          return {
            allowed: false,
            reason: 'Signal #1 requires Facing Point Lock #3 plunged (REVERSE).',
          };
        }
        if (
          levers[4] !== 'NORMAL' ||
          levers[5] !== 'NORMAL' ||
          levers[6] !== 'NORMAL'
        ) {
          return {
            allowed: false,
            reason: 'Signal #1 requires conflicting Signals #4, #5, and #6 in NORMAL.',
          };
        }
        if (levers[8] !== 'NORMAL') {
          return {
            allowed: false,
            reason: 'Signal #1 is locked while Maintenance Isolation Lock #8 is REVERSE.',
          };
        }
        return { allowed: true };
      },
    },
  ];

  const sharedRulesAfterIlk05: InterlockRule[] = [
    {
      ruleId: 'EARS-ILK-06',
      description: 'Schema Bridge Distant Signal #5 requires Bridge Token Clearance #7 REVERSE and Signals #1, #4, #6, and Lever #8 NORMAL.',
      earsClause:
        'WHEN pulling Schema Bridge Distant Signal #5, THE SYSTEM SHALL require Bridge Token Clearance #7 in REVERSE, conflicting Signals #1, #4, #6 in NORMAL, and Maintenance Isolation Lock #8 in NORMAL.',
      appliesToLever: 5,
      targetIntent: 'PULL',
      check: (levers) => {
        if (levers[7] !== 'REVERSE') {
          return {
            allowed: false,
            reason: 'Signal #5 requires Bridge Token Clearance #7 in REVERSE.',
          };
        }
        if (
          levers[1] !== 'NORMAL' ||
          levers[4] !== 'NORMAL' ||
          levers[6] !== 'NORMAL'
        ) {
          return {
            allowed: false,
            reason: 'Signal #5 requires Signals #1, #4, and #6 in NORMAL.',
          };
        }
        if (levers[8] !== 'NORMAL') {
          return {
            allowed: false,
            reason: 'Signal #5 is locked while Maintenance Isolation Lock #8 is REVERSE.',
          };
        }
        return { allowed: true };
      },
    },
    {
      ruleId: 'EARS-ILK-06',
      description: 'Backlock Bridge Token Clearance #7 while Signal #5 is clear.',
      earsClause:
        'WHEN Schema Bridge Distant Signal #5 is REVERSE, THE SYSTEM SHALL backlock Bridge Token Clearance #7 in REVERSE.',
      appliesToLever: 7,
      targetIntent: 'RELEASE',
      check: (levers) => {
        if (levers[5] === 'REVERSE') {
          return {
            allowed: false,
            reason: 'Bridge Token Clearance #7 is backlocked while Signal #5 is clear (REVERSE).',
          };
        }
        return { allowed: true };
      },
    },
    {
      ruleId: 'EARS-ILK-07',
      description: 'Shunt & Audit Dwarf Signal #6 requires Lever #8 REVERSE, FPL #3 REVERSE, and Signals #1, #4, #5 NORMAL.',
      earsClause:
        'WHEN pulling Shunt & Audit Dwarf Signal #6, THE SYSTEM SHALL require Maintenance Isolation Lock #8 in REVERSE, Facing Point Lock #3 in REVERSE, and Signals #1, #4, #5 in NORMAL.',
      appliesToLever: 6,
      targetIntent: 'PULL',
      check: (levers) => {
        if (levers[8] !== 'REVERSE') {
          return {
            allowed: false,
            reason: 'Signal #6 requires Maintenance Isolation Lock #8 in REVERSE.',
          };
        }
        if (levers[3] !== 'REVERSE') {
          return {
            allowed: false,
            reason: 'Signal #6 requires Facing Point Lock #3 plunged (REVERSE).',
          };
        }
        if (
          levers[1] !== 'NORMAL' ||
          levers[4] !== 'NORMAL' ||
          levers[5] !== 'NORMAL'
        ) {
          return {
            allowed: false,
            reason: 'Signal #6 requires mainline Signals #1, #4, and #5 in NORMAL.',
          };
        }
        return { allowed: true };
      },
    },
    {
      ruleId: 'EARS-ILK-07',
      description: 'Backlock Maintenance Isolation Lock #8 while Signal #6 is clear.',
      earsClause:
        'WHEN Shunt & Audit Dwarf Signal #6 is REVERSE, THE SYSTEM SHALL backlock Maintenance Isolation Lock #8 in REVERSE.',
      appliesToLever: 8,
      targetIntent: 'RELEASE',
      check: (levers) => {
        if (levers[6] === 'REVERSE') {
          return {
            allowed: false,
            reason: 'Maintenance Isolation Lock #8 is backlocked while Signal #6 is clear (REVERSE).',
          };
        }
        return { allowed: true };
      },
    },
    {
      ruleId: 'EARS-ILK-08',
      description: 'Maintenance Isolation Lock #8 requires Signals #1, #4, and #5 in NORMAL.',
      earsClause:
        'WHEN pulling Maintenance Isolation Lock #8, THE SYSTEM SHALL require mainline Signals #1, #4, and #5 in NORMAL.',
      appliesToLever: 8,
      targetIntent: 'PULL',
      check: (levers) => {
        if (
          levers[1] !== 'NORMAL' ||
          levers[4] !== 'NORMAL' ||
          levers[5] !== 'NORMAL'
        ) {
          return {
            allowed: false,
            reason: 'Maintenance Isolation Lock #8 requires Signals #1, #4, and #5 in NORMAL.',
          };
        }
        return { allowed: true };
      },
    },
  ];

  if (presetId === 'STANDARD_SAFE') {
    const ruleIlk01: InterlockRule = {
      ruleId: 'EARS-ILK-01',
      description: 'Mutual exclusion between North Up Home Signal #1 and South Branch Home Signal #4.',
      earsClause:
        'WHEN North Up Home Signal #1 is REVERSE, THE SYSTEM SHALL mechanically lock South Branch Home Signal #4 in NORMAL to prevent converging collisions on junction-throat and schema-bridge.',
      appliesToLever: 4,
      targetIntent: 'PULL',
      check: (levers) => {
        if (levers[1] === 'REVERSE') {
          return {
            allowed: false,
            reason:
              'South Branch Signal #4 is mechanically locked in NORMAL while North Up Signal #1 is REVERSE.',
          };
        }
        return { allowed: true };
      },
    };

    const ruleIlk05Standard: InterlockRule = {
      ruleId: 'EARS-ILK-05',
      description: 'South Branch Home Signal #4 requires Point #2 REVERSE, FPL #3 REVERSE, Signals #1/#5/#6 NORMAL, and Lever #8 NORMAL.',
      earsClause:
        'WHEN pulling South Branch Home Signal #4, THE SYSTEM SHALL require Point #2 in REVERSE, FPL #3 in REVERSE, conflicting Signals #1, #5, #6 in NORMAL, and Maintenance Isolation Lock #8 in NORMAL.',
      appliesToLever: 4,
      targetIntent: 'PULL',
      check: (levers) => {
        if (levers[2] !== 'REVERSE') {
          return {
            allowed: false,
            reason: 'Signal #4 requires Crossover Point #2 in REVERSE.',
          };
        }
        if (levers[3] !== 'REVERSE') {
          return {
            allowed: false,
            reason: 'Signal #4 requires Facing Point Lock #3 plunged (REVERSE).',
          };
        }
        if (
          levers[1] !== 'NORMAL' ||
          levers[5] !== 'NORMAL' ||
          levers[6] !== 'NORMAL'
        ) {
          return {
            allowed: false,
            reason: 'Signal #4 requires conflicting Signals #1, #5, and #6 in NORMAL.',
          };
        }
        if (levers[8] !== 'NORMAL') {
          return {
            allowed: false,
            reason: 'Signal #4 is locked while Maintenance Isolation Lock #8 is REVERSE.',
          };
        }
        return { allowed: true };
      },
    };

    return [
      ruleIlk01,
      ...sharedRulesBeforeIlk05,
      ruleIlk05Standard,
      ...sharedRulesAfterIlk05,
    ];
  }

  // Fault-injected preset omits EARS-ILK-01 and weakens EARS-ILK-05 (omitting Point #2 === REVERSE and Signal #1 === NORMAL)
  // so the SUT permits clearing Signal #4 while Signal #1 is already REVERSE and Point #2 is NORMAL.
  const ruleIlk05Cursed: InterlockRule = {
    ruleId: 'EARS-ILK-05',
    description: 'Cursed South Branch Signal #4 rule (missing Point #2 REVERSE and Signal #1 NORMAL checks).',
    earsClause:
      'WHEN pulling South Branch Home Signal #4, THE SYSTEM SHALL require FPL #3 in REVERSE and Maintenance Isolation Lock #8 in NORMAL (CURSED: missing Point #2 and Signal #1 checks).',
    appliesToLever: 4,
    targetIntent: 'PULL',
    check: (levers) => {
      if (levers[3] !== 'REVERSE') {
        return {
          allowed: false,
          reason: 'Signal #4 requires Facing Point Lock #3 plunged (REVERSE).',
        };
      }
      if (levers[5] !== 'NORMAL' || levers[6] !== 'NORMAL') {
        return {
          allowed: false,
          reason: 'Signal #4 requires Signals #5 and #6 in NORMAL.',
        };
      }
      if (levers[8] !== 'NORMAL') {
        return {
          allowed: false,
          reason: 'Signal #4 is locked while Maintenance Isolation Lock #8 is REVERSE.',
        };
      }
      return { allowed: true };
    },
  };

  return [
    ...sharedRulesBeforeIlk05,
    ruleIlk05Cursed,
    ...sharedRulesAfterIlk05,
  ];
};

export const createFrameState = (presetId: PresetId = 'STANDARD_SAFE'): FrameState => {
  assertValidPresetId(presetId);

  return {
    presetId,
    levers: {
      1: 'NORMAL',
      2: 'NORMAL',
      3: 'NORMAL',
      4: 'NORMAL',
      5: 'NORMAL',
      6: 'NORMAL',
      7: 'NORMAL',
      8: 'NORMAL',
    },
    activeRoutes: [],
    occupiedBlocks: [],
    lastOutcome: 'INITIAL',
    blockingRuleId: null,
    blockingReason: null,
    blockingEarsClause: null,
    stepHistory: [],
  };
};

export const applyLeverAction = (state: FrameState, action: LeverAction): FrameState => {
  const clonedLevers: Record<LeverId, LeverState> = { ...state.levers };
  const clonedRoutes: ActiveRoute[] = state.activeRoutes.map((route) => ({
    ...route,
    occupiedBlocks: [...route.occupiedBlocks],
  }));
  const clonedBlocks: string[] = [...state.occupiedBlocks];
  const clonedHistory: StepHistoryEntry[] = state.stepHistory.map((entry) => ({
    ...entry,
    action: { ...entry.action },
  }));

  if (
    !action ||
    !isValidLeverId(action.leverId) ||
    !isValidIntent(action.intent)
  ) {
    const invalidReason = 'Invalid lever ID or action intent';
    const nextStep: StepHistoryEntry = {
      stepIndex: clonedHistory.length,
      action: {
        leverId: (action?.leverId ?? (0 as LeverId)),
        intent: (action?.intent ?? ('PULL' as 'PULL' | 'RELEASE')),
      },
      outcome: 'INVALID_INPUT',
      blockingRuleId: 'EARS-VAL-01',
      blockingReason: invalidReason,
    };

    return {
      presetId: state.presetId,
      levers: clonedLevers,
      activeRoutes: clonedRoutes,
      occupiedBlocks: clonedBlocks,
      lastOutcome: 'INVALID_INPUT',
      blockingRuleId: 'EARS-VAL-01',
      blockingReason: invalidReason,
      blockingEarsClause:
        'WHEN an out-of-range lever identifier or unsupported action intent is submitted, THE SYSTEM SHALL reject the action with INVALID_INPUT and preserve the existing frame state without mutation.',
      stepHistory: [...clonedHistory, nextStep],
    };
  }

  const currentLeverState = state.levers[action.leverId];
  const targetLeverState: LeverState =
    action.intent === 'PULL' ? 'REVERSE' : 'NORMAL';

  // F6 Idempotency: pulling an already-reversed lever or releasing an already-normal lever
  // preserves levers, activeRoutes, and stepHistory without duplication.
  if (currentLeverState === targetLeverState) {
    return {
      presetId: state.presetId,
      levers: clonedLevers,
      activeRoutes: clonedRoutes,
      occupiedBlocks: clonedBlocks,
      lastOutcome: 'NO_OP_IDEMPOTENT',
      blockingRuleId: null,
      blockingReason: null,
      blockingEarsClause: null,
      stepHistory: clonedHistory,
    };
  }

  const rules = getInterlockPreset(state.presetId);
  const matchingRules = rules.filter(
    (rule) =>
      rule.appliesToLever === action.leverId &&
      rule.targetIntent === action.intent,
  );

  for (const rule of matchingRules) {
    const checkResult = rule.check(state.levers);
    if (!checkResult.allowed) {
      const reason = checkResult.reason ?? rule.description;
      const blockedStep: StepHistoryEntry = {
        stepIndex: clonedHistory.length,
        action: { leverId: action.leverId, intent: action.intent },
        outcome: 'BLOCKED_BY_INTERLOCK',
        blockingRuleId: rule.ruleId,
        blockingReason: reason,
      };

      return {
        presetId: state.presetId,
        levers: clonedLevers,
        activeRoutes: clonedRoutes,
        occupiedBlocks: clonedBlocks,
        lastOutcome: 'BLOCKED_BY_INTERLOCK',
        blockingRuleId: rule.ruleId,
        blockingReason: reason,
        blockingEarsClause: rule.earsClause,
        stepHistory: [...clonedHistory, blockedStep],
      };
    }
  }

  const nextLevers: Record<LeverId, LeverState> = {
    ...clonedLevers,
    [action.leverId]: targetLeverState,
  };
  const { activeRoutes, occupiedBlocks } = deriveActiveRoutesAndBlocks(nextLevers);
  const appliedStep: StepHistoryEntry = {
    stepIndex: clonedHistory.length,
    action: { leverId: action.leverId, intent: action.intent },
    outcome: 'APPLIED',
    blockingRuleId: null,
    blockingReason: null,
  };

  return {
    presetId: state.presetId,
    levers: nextLevers,
    activeRoutes,
    occupiedBlocks,
    lastOutcome: 'APPLIED',
    blockingRuleId: null,
    blockingReason: null,
    blockingEarsClause: null,
    stepHistory: [...clonedHistory, appliedStep],
  };
};

// Immutable Physical Station Topology — intentionally decoupled from getInterlockPreset and presetId
// so fault injection in the SUT never corrupts the safety oracle.
const IMMUTABLE_PHYSICAL_SIGNAL_TOPOLOGY: ReadonlyArray<{
  signalLever: LeverId;
  blocks: readonly string[];
  requiredLevers: Readonly<Partial<Record<LeverId, LeverState>>>;
}> = [
  {
    signalLever: 1,
    blocks: ['north-approach', 'junction-throat', 'schema-bridge'],
    requiredLevers: { 2: 'NORMAL', 3: 'REVERSE', 8: 'NORMAL' },
  },
  {
    signalLever: 4,
    blocks: ['south-branch', 'junction-throat', 'schema-bridge'],
    requiredLevers: { 2: 'REVERSE', 3: 'REVERSE', 8: 'NORMAL' },
  },
  {
    signalLever: 5,
    blocks: ['schema-bridge', 'prod-mainline'],
    requiredLevers: { 7: 'REVERSE', 8: 'NORMAL' },
  },
  {
    signalLever: 6,
    blocks: ['junction-throat', 'audit-siding'],
    requiredLevers: { 3: 'REVERSE', 8: 'REVERSE' },
  },
];

export const evaluatePhysicalTopology = (state: FrameState): TopologyEvaluation => {
  const blockCounts = new Map<string, number>();
  const collisionBlocks: string[] = [];
  const misalignedSignals: LeverId[] = [];

  for (const spec of IMMUTABLE_PHYSICAL_SIGNAL_TOPOLOGY) {
    if (state.levers[spec.signalLever] === 'REVERSE') {
      for (const block of spec.blocks) {
        const nextCount = (blockCounts.get(block) ?? 0) + 1;
        blockCounts.set(block, nextCount);
        if (nextCount > 1 && !collisionBlocks.includes(block)) {
          collisionBlocks.push(block);
        }
      }

      const requiredEntries = Object.entries(spec.requiredLevers) as Array<
        [string, LeverState]
      >;
      const hasMisalignment = requiredEntries.some(([reqLeverStr, reqState]) => {
        const reqLever = Number(reqLeverStr) as LeverId;
        return state.levers[reqLever] !== reqState;
      });

      if (hasMisalignment) {
        misalignedSignals.push(spec.signalLever);
      }
    }
  }

  const p1NoConflictingRoutes = collisionBlocks.length === 0;
  const p2SignalPointLockIntegrity = misalignedSignals.length === 0;
  const safe = p1NoConflictingRoutes && p2SignalPointLockIntegrity;

  if (!p1NoConflictingRoutes) {
    return {
      safe: false,
      p1NoConflictingRoutes,
      p2SignalPointLockIntegrity,
      violatedProperty: 'P1_NO_CONFLICTING_ROUTES',
      collisionBlocks,
      misalignedSignals,
      missingRuleId: 'EARS-ILK-01',
      details: `Conflicting active signal routes occupy shared physical blocks: ${collisionBlocks.join(', ')}.`,
    };
  }

  if (!p2SignalPointLockIntegrity) {
    return {
      safe: false,
      p1NoConflictingRoutes,
      p2SignalPointLockIntegrity,
      violatedProperty: 'P2_SIGNAL_POINT_LOCK_INTEGRITY',
      collisionBlocks,
      misalignedSignals,
      missingRuleId: 'EARS-ILK-05',
      details: `Clear signals lack required physical switch/lock alignment: Signals ${misalignedSignals.map((s) => `#${s}`).join(', ')}.`,
    };
  }

  return {
    safe: true,
    p1NoConflictingRoutes: true,
    p2SignalPointLockIntegrity: true,
    violatedProperty: null,
    collisionBlocks: [],
    misalignedSignals: [],
    missingRuleId: null,
    details: 'All active routes satisfy physical mutual exclusion (P1) and switch/lock alignment (P2).',
  };
};
