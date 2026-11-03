import {
  applyLeverAction,
  createFrameState,
  evaluatePhysicalTopology,
  getInterlockPreset,
  ROUTE_CATALOG,
  type FrameState,
  type LeverAction,
  type LeverId,
  type PresetId,
  type RouteId,
  type TopologyEvaluation,
} from './interlocking.ts';
import {
  generatePbtTrialReceipt,
  replayCounterexampleSequence,
  runInterlockingExorcism,
  type CounterexampleReplayBundle,
  type ExorcismReport,
  type PbtTrialReceipt,
  type ReplayResult,
} from './pbt-exorcist.ts';

export type SoundCue =
  | 'NONE'
  | 'LEVER_LATCH'
  | 'INTERLOCK_CLANK'
  | 'COLLISION_ALARM'
  | 'BELL_CHIME';

export interface TappetBarState {
  ruleId: string;
  description: string;
  appliesToLever: LeverId;
  targetIntent: 'PULL' | 'RELEASE';
  earsClause: string;
  engaged: boolean;
  reason: string | null;
}

export interface SignalBoxStoreState {
  frame: FrameState;
  topology: TopologyEvaluation;
  tappetBars: TappetBarState[];
  audioMuted: boolean;
  lastSoundCue: SoundCue;
  exorcismReport: ExorcismReport | null;
  trialReceipt: PbtTrialReceipt | null;
  replayBundle: CounterexampleReplayBundle | null;
  replayCursor: number | null;
  replayVerification: ReplayResult | null;
  collisionBanner: string | null;
}

export interface SignalBoxStore {
  getState: () => SignalBoxStoreState;
  pullLever: (leverId: LeverId) => SignalBoxStoreState;
  releaseLever: (leverId: LeverId) => SignalBoxStoreState;
  switchPreset: (presetId: PresetId) => SignalBoxStoreState;
  toggleAudioMute: () => SignalBoxStoreState;
  runExorcism: () => SignalBoxStoreState;
  stepReplayForward: () => SignalBoxStoreState;
}

export type SignalBoxMcpSuccessResponse =
  | {
      isError: false;
      toolName: 'request_route';
      granted: boolean;
      agentId: string;
      routeId: RouteId;
      blockingRuleId: string | null;
      blockingReason: string | null;
      blockingEarsClause: string | null;
      frameState: FrameState;
    }
  | {
      isError: false;
      toolName: 'release_route';
      released: boolean;
      agentId: string;
      routeId: RouteId;
      frameState: FrameState;
    }
  | {
      isError: false;
      toolName: 'inspect_interlock';
      agentId: string;
      frame: FrameState;
      topology: TopologyEvaluation;
      tappetBars: TappetBarState[];
    }
  | {
      isError: false;
      toolName: 'run_pbt_exorcism';
      agentId: string;
      exorcismReport: ExorcismReport;
      trialReceipt: PbtTrialReceipt;
    };

export interface SignalBoxMcpErrorResponse {
  isError: true;
  errorCode:
    | 'INVALID_MCP_REQUEST'
    | 'UNKNOWN_MCP_TOOL'
    | 'INVALID_AGENT_ID'
    | 'INVALID_ROUTE_ID';
  errorMessage: string;
}

export type SignalBoxMcpResponse =
  | SignalBoxMcpSuccessResponse
  | SignalBoxMcpErrorResponse;

const VALID_MCP_TOOLS = [
  'request_route',
  'release_route',
  'inspect_interlock',
  'run_pbt_exorcism',
] as const;

type McpToolName = (typeof VALID_MCP_TOOLS)[number];

function isValidMcpToolName(value: unknown): value is McpToolName {
  return (
    typeof value === 'string' &&
    VALID_MCP_TOOLS.includes(value as McpToolName)
  );
}

function isValidRouteId(value: unknown): value is RouteId {
  return (
    typeof value === 'string' &&
    Object.prototype.hasOwnProperty.call(ROUTE_CATALOG, value)
  );
}

function computeTappetBars(frame: FrameState): TappetBarState[] {
  const rules = getInterlockPreset(frame.presetId);
  return rules.map((rule) => {
    const checkResult = rule.check(frame.levers);
    return {
      ruleId: rule.ruleId,
      description: rule.description,
      appliesToLever: rule.appliesToLever,
      targetIntent: rule.targetIntent,
      earsClause: rule.earsClause,
      engaged: !checkResult.allowed,
      reason: checkResult.reason ?? null,
    };
  });
}

function deriveSoundCue(
  frame: FrameState,
  topology: TopologyEvaluation,
): SoundCue {
  if (
    frame.lastOutcome === 'BLOCKED_BY_INTERLOCK' ||
    frame.lastOutcome === 'INVALID_INPUT'
  ) {
    return 'INTERLOCK_CLANK';
  }
  if (!topology.safe) {
    return 'COLLISION_ALARM';
  }
  return 'LEVER_LATCH';
}

export function createSignalBoxStore(
  initialPreset: PresetId = 'STANDARD_SAFE',
): SignalBoxStore {
  const initialFrame = createFrameState(initialPreset);
  const initialTopology = evaluatePhysicalTopology(initialFrame);

  let state: SignalBoxStoreState = {
    frame: initialFrame,
    topology: initialTopology,
    tappetBars: computeTappetBars(initialFrame),
    audioMuted: false,
    lastSoundCue: 'NONE',
    exorcismReport: null,
    trialReceipt: null,
    replayBundle: null,
    replayCursor: null,
    replayVerification: null,
    collisionBanner: null,
  };

  const applyAction = (action: LeverAction): SignalBoxStoreState => {
    const nextFrame = applyLeverAction(state.frame, action);
    const nextTopology = evaluatePhysicalTopology(nextFrame);
    const nextTappetBars = computeTappetBars(nextFrame);
    const collisionBanner = nextTopology.safe ? null : nextTopology.details;
    const lastSoundCue = deriveSoundCue(nextFrame, nextTopology);

    state = {
      ...state,
      frame: nextFrame,
      topology: nextTopology,
      tappetBars: nextTappetBars,
      lastSoundCue,
      collisionBanner,
    };
    return state;
  };

  return {
    getState: () => state,

    pullLever: (leverId: LeverId): SignalBoxStoreState =>
      applyAction({ leverId, intent: 'PULL' }),

    releaseLever: (leverId: LeverId): SignalBoxStoreState =>
      applyAction({ leverId, intent: 'RELEASE' }),

    switchPreset: (presetId: PresetId): SignalBoxStoreState => {
      const resetFrame = createFrameState(presetId);
      const resetTopology = evaluatePhysicalTopology(resetFrame);
      state = {
        ...state,
        frame: resetFrame,
        topology: resetTopology,
        tappetBars: computeTappetBars(resetFrame),
        lastSoundCue: 'BELL_CHIME',
        exorcismReport: null,
        replayBundle: null,
        replayCursor: null,
        replayVerification: null,
        collisionBanner: null,
      };
      return state;
    },

    toggleAudioMute: (): SignalBoxStoreState => {
      state = {
        ...state,
        audioMuted: !state.audioMuted,
      };
      return state;
    },

    runExorcism: (): SignalBoxStoreState => {
      const exorcismReport = runInterlockingExorcism(state.frame.presetId);
      const trialReceipt = generatePbtTrialReceipt();
      const replayBundle = exorcismReport.counterexample;
      const replayVerification =
        replayBundle !== null ? replayCounterexampleSequence(replayBundle) : null;
      const resetFrame = createFrameState(state.frame.presetId);
      const resetTopology = evaluatePhysicalTopology(resetFrame);

      state = {
        ...state,
        frame: resetFrame,
        topology: resetTopology,
        tappetBars: computeTappetBars(resetFrame),
        lastSoundCue: 'BELL_CHIME',
        exorcismReport,
        trialReceipt,
        replayBundle,
        replayCursor: null,
        replayVerification,
        collisionBanner: null,
      };
      return state;
    },

    stepReplayForward: (): SignalBoxStoreState => {
      if (state.replayBundle === null) {
        return state;
      }

      const maxIndex = state.replayBundle.shrunkActions.length - 1;
      const nextCursor =
        state.replayCursor === null
          ? 0
          : Math.min(state.replayCursor + 1, maxIndex);

      let replayFrame = createFrameState(state.replayBundle.presetId);
      for (let i = 0; i <= nextCursor; i++) {
        replayFrame = applyLeverAction(
          replayFrame,
          state.replayBundle.shrunkActions[i],
        );
      }

      const nextTopology = evaluatePhysicalTopology(replayFrame);
      const nextTappetBars = computeTappetBars(replayFrame);
      const collisionBanner = nextTopology.safe ? null : nextTopology.details;
      const lastSoundCue = deriveSoundCue(replayFrame, nextTopology);

      state = {
        ...state,
        frame: replayFrame,
        topology: nextTopology,
        tappetBars: nextTappetBars,
        lastSoundCue,
        replayCursor: nextCursor,
        collisionBanner,
      };
      return state;
    },
  };
}

function buildRouteActionSequence(
  frame: FrameState,
  routeId: RouteId,
): LeverAction[] {
  const { levers } = frame;
  const junctionSignalsClear =
    levers[1] === 'REVERSE' ||
    levers[4] === 'REVERSE' ||
    levers[6] === 'REVERSE';

  if (routeId === 'NORTH_TO_BRIDGE') {
    const actions: LeverAction[] = [];
    if (levers[2] === 'REVERSE' && !junctionSignalsClear) {
      if (levers[3] === 'REVERSE') {
        actions.push({ leverId: 3, intent: 'RELEASE' });
      }
      actions.push({ leverId: 2, intent: 'RELEASE' });
    }
    actions.push({ leverId: 3, intent: 'PULL' });
    actions.push({ leverId: 1, intent: 'PULL' });
    return actions;
  }

  if (routeId === 'SOUTH_TO_BRIDGE') {
    const actions: LeverAction[] = [];
    if (!junctionSignalsClear) {
      if (levers[2] === 'NORMAL') {
        if (levers[3] === 'REVERSE') {
          actions.push({ leverId: 3, intent: 'RELEASE' });
        }
        actions.push({ leverId: 2, intent: 'PULL' });
      }
      actions.push({ leverId: 3, intent: 'PULL' });
    } else if (levers[3] === 'NORMAL') {
      actions.push({ leverId: 3, intent: 'PULL' });
    }
    actions.push({ leverId: 4, intent: 'PULL' });
    return actions;
  }

  if (routeId === 'BRIDGE_MAINLINE') {
    const actions: LeverAction[] = [];
    if (levers[7] === 'NORMAL') {
      actions.push({ leverId: 7, intent: 'PULL' });
    }
    actions.push({ leverId: 5, intent: 'PULL' });
    return actions;
  }

  // AUDIT_SIDING
  const actions: LeverAction[] = [];
  if (levers[8] === 'NORMAL') {
    actions.push({ leverId: 8, intent: 'PULL' });
  }
  if (levers[3] === 'NORMAL') {
    actions.push({ leverId: 3, intent: 'PULL' });
  }
  actions.push({ leverId: 6, intent: 'PULL' });
  return actions;
}

export function executeSignalBoxMcpTool(
  store: SignalBoxStore,
  request: unknown,
): SignalBoxMcpResponse {
  if (!request || typeof request !== 'object') {
    return {
      isError: true,
      errorCode: 'INVALID_MCP_REQUEST',
      errorMessage: 'MCP request payload must be a non-null JSON object.',
    };
  }

  const record = request as Record<string, unknown>;
  if (!isValidMcpToolName(record.toolName)) {
    return {
      isError: true,
      errorCode: 'UNKNOWN_MCP_TOOL',
      errorMessage: `Unknown MCP tool: ${String(record.toolName)}`,
    };
  }

  if (
    typeof record.agentId !== 'string' ||
    record.agentId.trim().length === 0
  ) {
    return {
      isError: true,
      errorCode: 'INVALID_AGENT_ID',
      errorMessage: 'MCP tool call requires a non-empty agentId string.',
    };
  }

  const agentId = record.agentId.trim();
  const toolName = record.toolName;

  if (toolName === 'inspect_interlock') {
    const current = store.getState();
    return {
      isError: false,
      toolName: 'inspect_interlock',
      agentId,
      frame: current.frame,
      topology: current.topology,
      tappetBars: current.tappetBars,
    };
  }

  if (toolName === 'run_pbt_exorcism') {
    const after = store.runExorcism();
    return {
      isError: false,
      toolName: 'run_pbt_exorcism',
      agentId,
      exorcismReport: after.exorcismReport!,
      trialReceipt: after.trialReceipt!,
    };
  }

  if (!isValidRouteId(record.routeId)) {
    return {
      isError: true,
      errorCode: 'INVALID_ROUTE_ID',
      errorMessage: `Invalid or unsupported routeId: ${String(record.routeId)}`,
    };
  }

  const routeId = record.routeId;

  if (toolName === 'release_route') {
    const routeSpec = ROUTE_CATALOG[routeId];
    let nextState = store.releaseLever(routeSpec.signalLever);
    if (routeId === 'BRIDGE_MAINLINE' && nextState.frame.levers[7] === 'REVERSE') {
      nextState = store.releaseLever(7);
    } else if (
      routeId === 'AUDIT_SIDING' &&
      nextState.frame.levers[8] === 'REVERSE'
    ) {
      nextState = store.releaseLever(8);
    }

    return {
      isError: false,
      toolName: 'release_route',
      released: nextState.frame.levers[routeSpec.signalLever] === 'NORMAL',
      agentId,
      routeId,
      frameState: nextState.frame,
    };
  }

  // request_route
  const plannedActions = buildRouteActionSequence(
    store.getState().frame,
    routeId,
  );
  let latestState = store.getState();

  for (const step of plannedActions) {
    latestState =
      step.intent === 'PULL'
        ? store.pullLever(step.leverId)
        : store.releaseLever(step.leverId);

    if (
      latestState.frame.lastOutcome === 'BLOCKED_BY_INTERLOCK' ||
      latestState.frame.lastOutcome === 'INVALID_INPUT'
    ) {
      return {
        isError: false,
        toolName: 'request_route',
        granted: false,
        agentId,
        routeId,
        blockingRuleId: latestState.frame.blockingRuleId,
        blockingReason: latestState.frame.blockingReason,
        blockingEarsClause: latestState.frame.blockingEarsClause,
        frameState: latestState.frame,
      };
    }
  }

  return {
    isError: false,
    toolName: 'request_route',
    granted: true,
    agentId,
    routeId,
    blockingRuleId: null,
    blockingReason: null,
    blockingEarsClause: null,
    frameState: latestState.frame,
  };
}
