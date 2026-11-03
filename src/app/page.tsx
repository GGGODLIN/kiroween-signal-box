'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';

import type { FrameState, LeverId, PresetId, RouteId } from '../lib/interlocking.ts';
import type { CounterexampleReplayBundle, ExorcismReport, PbtTrialReceipt } from '../lib/pbt-exorcist.ts';
import {
  createSignalBoxStore,
  executeSignalBoxMcpTool,
  type SignalBoxMcpResponse,
  type SignalBoxStore,
  type SignalBoxStoreState,
  type SoundCue,
} from '../lib/signal-box-store.ts';

import { LeverFrame, type LeverJerk } from './_components/lever-frame.tsx';
import {
  LEVER_IDS,
  RULE_TITLES,
  SPEC_SOURCE,
  actionCode,
  leverDescriptor,
  lockedLevers,
  missingRuleIds,
  weakenedRuleIds,
} from './_components/machine.ts';
import { TrackDiagram } from './_components/track-diagram.tsx';

// ─────────────────────────────── Kiro Crew: one agent train per signalled route ───────────────────────────────

type CrewAgent = 'Builder' | 'Migrator' | 'Deployer' | 'Verifier';

interface AgentRouteSpec {
  routeId: RouteId;
  agentId: CrewAgent;
}

const AGENT_ROUTE_SPECS: readonly AgentRouteSpec[] = [
  { routeId: 'NORTH_TO_BRIDGE', agentId: 'Builder' },
  { routeId: 'SOUTH_TO_BRIDGE', agentId: 'Migrator' },
  { routeId: 'BRIDGE_MAINLINE', agentId: 'Deployer' },
  { routeId: 'AUDIT_SIDING', agentId: 'Verifier' },
];

const PRESETS: ReadonlyArray<{ presetId: PresetId; tone: 'green' | 'red' }> = [
  { presetId: 'STANDARD_SAFE', tone: 'green' },
  { presetId: 'CURSED_MISSING_CROSSOVER_LOCK', tone: 'red' },
];

// ─────────────────────────────── WebAudio: the box's own sounds, synthesised on demand ───────────────────────────────

let sharedAudioContext: AudioContext | null = null;
let sharedMaster: GainNode | null = null;
let sharedNoise: AudioBuffer | null = null;

function audioGraph(): { ctx: AudioContext; master: GainNode; noise: AudioBuffer } | null {
  if (typeof window === 'undefined' || !('AudioContext' in window)) {
    return null;
  }
  if (!sharedAudioContext || sharedAudioContext.state === 'closed') {
    sharedAudioContext = new window.AudioContext();
    sharedMaster = sharedAudioContext.createGain();
    sharedMaster.gain.value = 0.8;
    sharedMaster.connect(sharedAudioContext.destination);
    const length = Math.floor(sharedAudioContext.sampleRate * 0.4);
    sharedNoise = sharedAudioContext.createBuffer(1, length, sharedAudioContext.sampleRate);
    const data = sharedNoise.getChannelData(0);
    // a fixed LCG instead of Math.random so every clack is the same clack
    let seed = 1856;
    for (let i = 0; i < length; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      data[i] = (seed / 4294967296) * 2 - 1;
    }
  }
  if (sharedAudioContext.state === 'suspended') {
    void sharedAudioContext.resume();
  }
  return { ctx: sharedAudioContext, master: sharedMaster!, noise: sharedNoise! };
}

function partial(ctx: AudioContext, out: AudioNode, freq: number, t0: number, dur: number, level: number, type: OscillatorType = 'sine'): void {
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.exponentialRampToValueAtTime(level, t0 + 0.004);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(env).connect(out);
  osc.onended = () => {
    osc.disconnect();
    env.disconnect();
  };
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function burst(ctx: AudioContext, out: AudioNode, noise: AudioBuffer, t0: number, dur: number, freq: number, q: number, level: number): void {
  const src = ctx.createBufferSource();
  const band = ctx.createBiquadFilter();
  const env = ctx.createGain();
  src.buffer = noise;
  band.type = 'bandpass';
  band.frequency.value = freq;
  band.Q.value = q;
  env.gain.setValueAtTime(level, t0);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(band).connect(env).connect(out);
  src.onended = () => {
    src.disconnect();
    band.disconnect();
    env.disconnect();
  };
  src.start(t0);
  src.stop(t0 + dur + 0.02);
}

function playMechanicalSound(cue: SoundCue, muted: boolean): void {
  if (muted || cue === 'NONE') {
    return;
  }
  try {
    const graph = audioGraph();
    if (graph === null) {
      return;
    }
    const { ctx, master, noise } = graph;
    const now = ctx.currentTime + 0.005;
    if (cue === 'LEVER_LATCH') {
      // the catch drops into the quadrant notch: a dry clack over a short iron thump
      burst(ctx, master, noise, now, 0.04, 2600, 5, 0.55);
      partial(ctx, master, 140, now, 0.11, 0.24, 'triangle');
      burst(ctx, master, noise, now + 0.055, 0.03, 1700, 6, 0.28);
    } else if (cue === 'INTERLOCK_CLANK') {
      // iron meeting a brass dog: inharmonic partials and a dull knock
      [311, 742, 1306, 2017].forEach((f, i) => partial(ctx, master, f, now, 0.3 - i * 0.05, 0.2 / (i + 1)));
      burst(ctx, master, noise, now, 0.07, 820, 2.5, 0.6);
    } else if (cue === 'COLLISION_ALARM') {
      // the block bell struck twice, hard
      for (const offset of [0, 0.22]) {
        [880, 1863, 2650].forEach((f, i) => partial(ctx, master, f, now + offset, 0.7, 0.16 / (i + 1)));
      }
      burst(ctx, master, noise, now, 0.12, 300, 1.2, 0.35);
    } else {
      // BELL_CHIME: one stroke on the block bell
      [1046, 2214, 3150].forEach((f, i) => partial(ctx, master, f, now, 1.1, 0.1 / (i + 1)));
    }
  } catch {
    // browsers may refuse audio before the first gesture; the box still works silently
  }
}

// ─────────────────────────────── what the register says about the last move ───────────────────────────────

type DeskEvent =
  | { kind: 'boot' }
  | { kind: 'lever'; leverId: LeverId; intent: 'PULL' | 'RELEASE'; before: SignalBoxStoreState }
  | { kind: 'mcp'; response: SignalBoxMcpResponse; toolName: 'request_route' | 'release_route'; agentId: CrewAgent; routeId: RouteId; before: SignalBoxStoreState }
  | { kind: 'preset'; presetId: PresetId }
  | { kind: 'exorcism' }
  | { kind: 'replay' };

type Tone = 'idle' | 'green' | 'red' | 'brass';

interface RegisterView {
  tone: Tone;
  headline: string;
  code: boolean;
  sub: string;
  clause: string | null;
  source: string | null;
}

const listLevers = (ids: readonly LeverId[]): string => ids.map((id) => `#${id}`).join(' · ');

function lockDiff(before: SignalBoxStoreState, after: SignalBoxStoreState): string {
  const was = lockedLevers(before.frame.levers, before.tappetBars);
  const now = lockedLevers(after.frame.levers, after.tappetBars);
  const locks = now.filter((id) => !was.includes(id));
  const frees = was.filter((id) => !now.includes(id));
  return [locks.length > 0 ? `Locks ${listLevers(locks)}.` : '', frees.length > 0 ? `Frees ${listLevers(frees)}.` : '']
    .filter(Boolean)
    .join(' ');
}

function routeDiff(before: FrameState, after: FrameState): string {
  const was = before.activeRoutes.map((route) => route.routeId);
  const set = after.activeRoutes.filter((route) => !was.includes(route.routeId));
  const cancelled = before.activeRoutes.filter(
    (route) => !after.activeRoutes.some((r) => r.routeId === route.routeId),
  );
  return [
    ...set.map((route) => `Route set: ${route.routeId} — ${route.agentTrain} holds ${route.occupiedBlocks.join(' → ')}.`),
    ...cancelled.map((route) => `Route cancelled: ${route.routeId}.`),
  ].join(' ');
}

function blockedView(state: SignalBoxStoreState, prefix: string): RegisterView {
  const ruleId = state.frame.blockingRuleId ?? 'EARS-ILK-??';
  return {
    tone: 'red',
    headline: `${prefix} ${ruleId}`,
    code: true,
    sub: state.frame.blockingReason ?? '',
    clause: state.frame.blockingEarsClause,
    source: RULE_TITLES[ruleId] ?? null,
  };
}

function describeRegister(state: SignalBoxStoreState, event: DeskEvent): RegisterView {
  const { frame, topology } = state;

  if (!topology.safe) {
    const where =
      topology.collisionBlocks.length > 0
        ? topology.collisionBlocks.join(' × ')
        : `signal #${topology.misalignedSignals.join(', #')}`;
    return {
      tone: 'red',
      headline: topology.collisionBlocks.length > 0 ? `Collision on ${where}` : `Lock violation at ${where}`,
      code: false,
      sub: topology.details,
      clause: `${topology.violatedProperty} · the rule that should have stopped it: ${topology.missingRuleId}`,
      source: topology.missingRuleId ? (RULE_TITLES[topology.missingRuleId] ?? null) : null,
    };
  }

  if (event.kind === 'mcp') {
    const { response, toolName, agentId, routeId } = event;
    const call = `MCP ${toolName} · ${agentId} → ${routeId}.`;
    if (response.isError) {
      return { tone: 'red', headline: `MCP error · ${response.errorCode}`, code: true, sub: response.errorMessage, clause: null, source: null };
    }
    if (response.toolName === 'request_route' && !response.granted) {
      const view = blockedView(state, 'Refused by');
      return { ...view, sub: `${call} ${view.sub} No lever moved.` };
    }
    const thrown = frame.stepHistory
      .slice(event.before.frame.stepHistory.length)
      .filter((step) => step.outcome === 'APPLIED')
      .map((step) => actionCode(step.action.leverId, step.action.intent));
    return {
      tone: toolName === 'request_route' ? 'green' : 'brass',
      headline: toolName === 'request_route' ? `Route granted · ${routeId}` : `Route released · ${routeId}`,
      code: false,
      sub: `${call} ${thrown.length > 0 ? `The agent threw ${thrown.join(' · ')}.` : 'No lever needed to move.'} ${lockDiff(event.before, state)}`.trim(),
      clause: null,
      source: null,
    };
  }

  if (frame.lastOutcome === 'BLOCKED_BY_INTERLOCK') {
    return blockedView(state, 'Blocked by');
  }

  if (event.kind === 'lever') {
    const lever = leverDescriptor(event.leverId);
    const moved = event.intent === 'PULL' ? 'pulled' : 'put back';
    const routes = routeDiff(event.before.frame, frame);
    return {
      tone: routes.startsWith('Route set') ? 'green' : 'brass',
      headline: `#${lever.leverId} ${lever.name} ${moved}`,
      code: false,
      sub: [routes, lockDiff(event.before, state)].filter(Boolean).join(' ') || 'Nothing else in the frame changed.',
      clause: null,
      source: null,
    };
  }

  if (event.kind === 'preset') {
    const missing = missingRuleIds(event.presetId);
    const weakened = weakenedRuleIds(event.presetId);
    return missing.length === 0 && weakened.length === 0
      ? {
          tone: 'green',
          headline: `Rule table · ${event.presetId}`,
          code: false,
          sub: 'All eight EARS rules are back in the locking bed.',
          clause: null,
          source: null,
        }
      : {
          tone: 'red',
          headline: `Rule table · ${event.presetId}`,
          code: false,
          sub: `${missing.join(', ')} is missing${weakened.length > 0 ? ` and ${weakened.join(', ')} is weakened` : ''}. The frame still feels solid — so let the exorcist look for what this breaks.`,
          clause: null,
          source: null,
        };
  }

  if (event.kind === 'exorcism' && state.exorcismReport !== null) {
    const report = state.exorcismReport;
    const bundle = state.replayBundle;
    return report.passed || bundle === null
      ? {
          tone: 'green',
          headline: 'Exorcism passed',
          code: false,
          sub: `${report.numRunsExecuted} random runs · ${report.stepwiseAssertionsChecked} stepwise checks · 0 violations on ${report.presetId}.`,
          clause: null,
          source: null,
        }
      : {
          tone: 'red',
          headline: `Counterexample · ${bundle.originalLength} → ${bundle.shrunkActions.length} steps`,
          code: false,
          sub: `fast-check caught ${bundle.violatedProperty} on run ${report.numRunsExecuted} and shrank it to ${bundle.shrunkActions
            .map((a) => actionCode(a.leverId, a.intent))
            .join(' · ')}. Step the replay to watch it happen.`,
          clause: null,
          source: null,
        };
  }

  if (event.kind === 'replay' && state.replayBundle !== null && state.replayCursor !== null) {
    const action = state.replayBundle.shrunkActions[state.replayCursor];
    const lever = leverDescriptor(action.leverId);
    return {
      tone: 'brass',
      headline: `Replay ${state.replayCursor + 1} of ${state.replayBundle.shrunkActions.length} · ${actionCode(action.leverId, action.intent)}`,
      code: false,
      sub: `#${lever.leverId} ${lever.name} ${action.intent === 'PULL' ? 'pulled' : 'put back'} — the cursed table lets it through.`,
      clause: null,
      source: null,
    };
  }

  return {
    tone: 'idle',
    headline: 'All eight levers stand at normal.',
    code: false,
    sub: 'Every signal shows danger. Pull #3 to lock the facing points, then #1 to clear Builder onto the schema bridge.',
    clause: null,
    source: null,
  };
}

function nextHint(state: SignalBoxStoreState): string | null {
  const { frame, replayBundle, replayCursor, exorcismReport } = state;
  if (replayBundle !== null) {
    const last = replayBundle.shrunkActions.length - 1;
    return replayCursor === null || replayCursor < last ? 'Step the replay forward' : 'Switch back to STANDARD_SAFE';
  }
  if (frame.presetId === 'CURSED_MISSING_CROSSOVER_LOCK') {
    return exorcismReport === null ? 'Run the PBT exorcist' : null;
  }
  if (frame.lastOutcome === 'BLOCKED_BY_INTERLOCK' && frame.blockingRuleId === 'EARS-ILK-01') {
    return 'Try the cursed rule table';
  }
  if (frame.levers[1] === 'REVERSE' && frame.levers[3] === 'REVERSE' && frame.levers[4] === 'NORMAL') {
    return 'Now try #4 — Migrator wants the bridge';
  }
  if (LEVER_IDS.every((id) => frame.levers[id] === 'NORMAL') && exorcismReport === null) {
    return 'Pull #3, then #1';
  }
  return null;
}

// ─────────────────────────────── page ───────────────────────────────

interface DeskView {
  snapshot: SignalBoxStoreState;
  event: DeskEvent;
  jerk: LeverJerk | null;
  moveDelays: Partial<Record<LeverId, number>>;
}

const STAGGER_MS = 190;

export default function SignalBoxPage() {
  const storeRef = useRef<SignalBoxStore | null>(null);
  if (storeRef.current === null) {
    storeRef.current = createSignalBoxStore('STANDARD_SAFE');
  }
  const nonceRef = useRef(0);

  const [view, setView] = useState<DeskView>(() => ({
    snapshot: storeRef.current!.getState(),
    event: { kind: 'boot' },
    jerk: null,
    moveDelays: {},
  }));

  const commit = useCallback((before: SignalBoxStoreState, next: SignalBoxStoreState, event: DeskEvent, sound = true): void => {
    const fresh = next.frame.stepHistory.slice(before.frame.stepHistory.length);
    const moveDelays: Partial<Record<LeverId, number>> = {};
    fresh
      .filter((step) => step.outcome === 'APPLIED')
      .forEach((step, index) => {
        moveDelays[step.action.leverId] = index * STAGGER_MS;
      });
    // only a refusal this action produced may jerk a lever; a stale BLOCKED frame (e.g. after a mute toggle) must not
    const refused = fresh.length > 0 ? fresh[fresh.length - 1] : null;
    let jerk: LeverJerk | null = null;
    if (refused !== null && refused.outcome === 'BLOCKED_BY_INTERLOCK') {
      nonceRef.current += 1;
      jerk = { leverId: refused.action.leverId, intent: refused.action.intent, nonce: nonceRef.current };
    }
    setView({ snapshot: next, event, jerk, moveDelays });
    if (sound) {
      playMechanicalSound(next.lastSoundCue, next.audioMuted);
    }
  }, []);

  const toggleLever = useCallback(
    (leverId: LeverId): void => {
      const store = storeRef.current!;
      const before = store.getState();
      const intent = before.frame.levers[leverId] === 'NORMAL' ? 'PULL' : 'RELEASE';
      const next = intent === 'PULL' ? store.pullLever(leverId) : store.releaseLever(leverId);
      commit(before, next, { kind: 'lever', leverId, intent, before });
    },
    [commit],
  );

  const handleSwitchPreset = (presetId: PresetId): void => {
    const store = storeRef.current!;
    const before = store.getState();
    commit(before, store.switchPreset(presetId), { kind: 'preset', presetId });
  };

  const handleToggleAudioMute = (): void => {
    const store = storeRef.current!;
    const before = store.getState();
    const next = store.toggleAudioMute();
    commit(before, next, view.event, false);
    if (!next.audioMuted) {
      playMechanicalSound('BELL_CHIME', false);
    }
  };

  const handleRunExorcism = (): void => {
    const store = storeRef.current!;
    const before = store.getState();
    commit(before, store.runExorcism(), { kind: 'exorcism' });
  };

  const handleStepReplayForward = (): void => {
    const store = storeRef.current!;
    const before = store.getState();
    commit(before, store.stepReplayForward(), { kind: 'replay' });
  };

  const handleMcpRouteAction = (toolName: 'request_route' | 'release_route', agentId: CrewAgent, routeId: RouteId): void => {
    const store = storeRef.current!;
    const before = store.getState();
    const response = executeSignalBoxMcpTool(store, { toolName, agentId, routeId });
    commit(before, store.getState(), { kind: 'mcp', response, toolName, agentId, routeId, before });
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) {
        return;
      }
      const digit = Number(event.key);
      if (Number.isInteger(digit) && digit >= 1 && digit <= 8) {
        event.preventDefault();
        toggleLever(digit as LeverId);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleLever]);

  const { snapshot, event, jerk, moveDelays } = view;
  const { frame, topology, tappetBars, audioMuted, exorcismReport, trialReceipt, replayBundle, replayCursor } = snapshot;
  const register = describeRegister(snapshot, event);
  const hint = nextHint(snapshot);
  const recent = frame.stepHistory.slice(-10);

  return (
    <main className="sb" data-preset={frame.presetId}>
      <div className="sb-grid">
        <header className="sb-head">
          <p className="mh-eyebrow caps">Saxby &amp; Farmer · 1856 · Tappet interlocking</p>
          <h1 className="mh-title">
            <span className="mh-wordmark display">Signal Box</span>
            <span className="mh-frame caps">// LeverFrame</span>
          </h1>
          <p className="mh-tagline">Mechanical interlocking, resurrected for parallel AI agents.</p>
          <div className="mh-controls">
            <div className="mh-field">
              <span className="mh-label caps" id="rule-table-label">
                Rule table
              </span>
              <div className="switch" role="radiogroup" aria-labelledby="rule-table-label">
                {PRESETS.map(({ presetId, tone }) => (
                  <button
                    key={presetId}
                    type="button"
                    role="radio"
                    aria-checked={frame.presetId === presetId}
                    data-tone={tone}
                    className="switch-opt"
                    onClick={() => handleSwitchPreset(presetId)}
                  >
                    <span className="lamp" data-tone={frame.presetId === presetId ? tone : undefined} />
                    {presetId}
                  </button>
                ))}
              </div>
            </div>
            <button type="button" className="sound caps" aria-pressed={!audioMuted} onClick={handleToggleAudioMute}>
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="M8 2.2c-2.4 0-4 1.9-4 4.4v3.1L2.6 11.6h10.8L12 9.7V6.6C12 4.1 10.4 2.2 8 2.2Z" fill="none" stroke="currentColor" strokeWidth="1.3" />
                <path d="M6.5 13.2a1.6 1.6 0 0 0 3 0" fill="none" stroke="currentColor" strokeWidth="1.3" />
                {audioMuted && <path d="M2.5 2.5l11 11" stroke="currentColor" strokeWidth="1.3" />}
              </svg>
              {audioMuted ? 'Sound off' : 'Sound on'}
            </button>
          </div>
        </header>

        <section className="sb-machine" aria-label="The signal box">
          <div className={topology.safe ? 'board' : 'board is-alarm'}>
            <div className="board-head">
              <h2 className="board-title caps">Illuminated diagram</h2>
              <span className="oracle caps" data-tone={topology.safe ? undefined : 'red'}>
                <span className="lamp" data-tone={topology.safe ? 'green' : 'red'} />
                {topology.safe
                  ? 'Topology oracle · P1 · P2 hold'
                  : topology.collisionBlocks.length > 0
                    ? `Collision · ${topology.collisionBlocks.join(' × ')}`
                    : `Lock violation · signal #${topology.misalignedSignals.join(', #')}`}
              </span>
            </div>
            <TrackDiagram frame={frame} topology={topology} />
            <div className="crew" role="group" aria-label="Kiro Crew agents over MCP">
              {AGENT_ROUTE_SPECS.map((spec) => {
                const route = frame.activeRoutes.find((r) => r.routeId === spec.routeId);
                const hot = route !== undefined && route.occupiedBlocks.some((b) => topology.collisionBlocks.includes(b));
                const tone = hot ? 'red' : route ? 'green' : undefined;
                return (
                  <div key={spec.routeId} className="crew-key">
                    <div className="crew-name display">
                      <span className="lamp" data-tone={tone} />
                      {spec.agentId}
                      <span className="crew-state caps" data-tone={tone}>
                        {hot ? 'Colliding' : route ? 'Holds route' : 'Waiting'}
                      </span>
                    </div>
                    <span className="crew-route mono">{spec.routeId}</span>
                    <div className="crew-actions">
                      <button
                        type="button"
                        className="crew-btn"
                        aria-label={`${spec.agentId}: MCP request_route ${spec.routeId}`}
                        onClick={() => handleMcpRouteAction('request_route', spec.agentId, spec.routeId)}
                      >
                        request_route
                      </button>
                      <button
                        type="button"
                        className="crew-btn is-ghost"
                        aria-label={`${spec.agentId}: MCP release_route ${spec.routeId}`}
                        onClick={() => handleMcpRouteAction('release_route', spec.agentId, spec.routeId)}
                      >
                        release
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="frame-wrap">
            <LeverFrame frame={frame} tappetBars={tappetBars} jerk={jerk} moveDelays={moveDelays} onToggle={toggleLever} />
          </div>
          <div className="frame-foot caps">
            <span>
              Throw a lever: click it, or press <span className="kbd">1</span>–<span className="kbd">8</span>
            </span>
            <span>Red stop · yellow distant · black points · blue facing lock · brown clearance</span>
          </div>
        </section>

        <aside className="sb-desk" aria-label="Signalman's desk">
          <section className="reg" aria-live="polite">
            <div className="panel-head">
              <h2 className="panel-title caps">Register</h2>
              <span className="panel-meta mono">step {String(frame.stepHistory.length).padStart(2, '0')}</span>
            </div>
            <div className="reg-body">
              <span className="lamp" data-tone={register.tone === 'idle' ? undefined : register.tone} />
              <div>
                <p className={register.code ? 'reg-headline is-code' : 'reg-headline display'}>{register.headline}</p>
                <p className="reg-sub">{register.sub}</p>
                {register.clause !== null && <p className="reg-clause">{register.clause}</p>}
                {register.source !== null && (
                  <p className="reg-source">
                    <b>{register.source}</b> · {SPEC_SOURCE}
                  </p>
                )}
              </div>
            </div>
            <div className="reg-foot">
              <div className="steps" aria-label="Recent lever moves">
                {recent.map((step) => (
                  <span
                    key={step.stepIndex}
                    className="plate"
                    data-kind={step.outcome === 'BLOCKED_BY_INTERLOCK' ? 'blocked' : step.action.intent === 'PULL' ? 'pull' : 'release'}
                    title={`${step.outcome}${step.blockingRuleId ? ` · ${step.blockingRuleId}` : ''}`}
                  >
                    {actionCode(step.action.leverId, step.action.intent)}
                  </span>
                ))}
              </div>
              {hint !== null && (
                <span className="hint caps">
                  Next · <b>{hint}</b>
                </span>
              )}
            </div>
          </section>

          <Exorcist
            presetId={frame.presetId}
            report={exorcismReport}
            bundle={replayBundle}
            cursor={replayCursor}
            onRun={handleRunExorcism}
            onStep={handleStepReplayForward}
          />

          <TrialReceipt receipt={trialReceipt} />
        </aside>
      </div>
    </main>
  );
}

// ─────────────────────────────── the PBT exorcist ───────────────────────────────

interface ExorcistProps {
  presetId: PresetId;
  report: ExorcismReport | null;
  bundle: CounterexampleReplayBundle | null;
  cursor: number | null;
  onRun: () => void;
  onStep: () => void;
}

function Exorcist({ presetId, report, bundle, cursor, onRun, onStep }: ExorcistProps) {
  const cursed = presetId !== 'STANDARD_SAFE';

  return (
    <section className="exo" aria-labelledby="exo-title">
      <div className="exo-top">
        <div>
          <h2 id="exo-title" className="exo-title display">
            PBT Exorcist
          </h2>
          <p className="exo-sub mono">fast-check · P1 · P2 after every step</p>
        </div>
        <div className="exo-count">
          <span className="caps">Stepwise checks</span>
          <span className={report === null ? 'mono is-dim' : 'mono'}>
            {report === null ? '000' : String(report.stepwiseAssertionsChecked).padStart(3, '0')}
          </span>
        </div>
      </div>

      <div className="exo-run">
        <span className="exo-target" data-tone={cursed ? 'red' : undefined}>
          <span className="caps">Against</span>
          <span className="mono">{presetId}</span>
        </span>
        <button type="button" className="btn-brass" onClick={onRun}>
          Run PBT Exorcist
        </button>
      </div>

      <div className="exo-result">
        {report === null && (
          <p className="exo-idle">
            Up to 80 random lever sequences, each started from a fresh frame. The topology oracle checks for
            collisions after every single step — then fast-check shrinks whatever it catches.
          </p>
        )}

        {report !== null && (report.passed || bundle === null) && <ExorcismPassed report={report} />}
        {report !== null && !report.passed && bundle !== null && (
          <Counterexample report={report} bundle={bundle} cursor={cursor} onStep={onStep} />
        )}
      </div>
    </section>
  );
}

function ExorcismPassed({ report }: { report: ExorcismReport }) {
  return (
    <>
      <span className="exo-verdict caps" data-tone="green">
        <span className="lamp" data-tone="green" />
        Passed · P1 · P2 hold
      </span>
      <p className="exo-pass display">
        {report.numRunsExecuted} runs, 0 violations.
        <small>
          {report.stepwiseAssertionsChecked} stepwise checks · {report.reachabilityWitnesses.clearedSignalCount} cleared signals ·{' '}
          {report.reachabilityWitnesses.blockedInterlockCount} refused pulls on {report.presetId}
        </small>
      </p>
    </>
  );
}

interface CounterexampleProps {
  report: ExorcismReport;
  bundle: CounterexampleReplayBundle;
  cursor: number | null;
  onStep: () => void;
}

/**
 * The kernel reports the failing run only by its length, so its steps are drawn as empty slots; inventing their
 * contents would put a sequence on screen that fast-check never generated.
 */
function Counterexample({ report, bundle, cursor, onStep }: CounterexampleProps) {
  const total = bundle.shrunkActions.length;
  const finished = cursor === total - 1;
  const reduction = (bundle.originalLength / total).toFixed(2);

  return (
    <>
      <span className="exo-verdict caps" data-tone="red">
        <span className="lamp" data-tone="red" />
        Caught on run {report.numRunsExecuted} · {bundle.violatedProperty}
      </span>
      <div className="shrink">
        <div className="shrink-col">
          <span className="caps">Failing run</span>
          <div className="shrink-row" aria-hidden="true">
            {Array.from({ length: bundle.originalLength }, (_, i) => (
              // react-doctor-disable-next-line no-array-index-as-key -- empty slots have no identity but their position
              <span key={`slot-${i}`} className="plate" data-kind="ghost" style={{ '--i': i } as CSSProperties} />
            ))}
          </div>
          <p className="shrink-count display is-dim">{bundle.originalLength} steps</p>
        </div>
        <span className="shrink-arrow" aria-hidden="true">
          →
        </span>
        <div className="shrink-col">
          <span className="caps">Shrunk</span>
          <div className="shrink-row">
            {bundle.shrunkActions.map((action, i) => (
              <span
                // react-doctor-disable-next-line no-array-index-as-key -- a replay step is identified by its position; the list never reorders
                key={`step-${i}-${actionCode(action.leverId, action.intent)}`}
                className={`plate${cursor !== null && i <= cursor ? ' is-lit' : ''}`}
                data-kind={i === bundle.failingStepIndex ? 'fail' : action.intent === 'PULL' ? 'pull' : 'release'}
                style={{ '--i': i + 4 } as CSSProperties}
              >
                {actionCode(action.leverId, action.intent)}
              </span>
            ))}
          </div>
          <p className="shrink-count display">{total} steps</p>
        </div>
      </div>
      <p className="shrink-note caps">
        Shrunk {bundle.originalLength} → {total} · {reduction}× · replayable · seed {bundle.seed}
      </p>
      <div className="replay">
        <span className="replay-state" data-tone={finished ? 'red' : undefined}>
          {cursor === null ? (
            <>
              replay <b>ready</b> · {total} steps
            </>
          ) : finished ? (
            <>
              <b>{bundle.violatedProperty === 'P1_NO_CONFLICTING_ROUTES' ? 'collision' : 'lock violation'} reproduced</b> at
              step {cursor + 1}
            </>
          ) : (
            <>
              replay step <b>{cursor + 1}</b> / {total}
            </>
          )}
        </span>
        <button type="button" className="btn-steel" onClick={onStep} disabled={finished}>
          Step Replay Forward
        </button>
      </div>
    </>
  );
}

// ─────────────────────────────── the trial receipt ───────────────────────────────

interface Metric {
  key: string;
  value: string;
  note: string;
  tone?: 'green' | 'red';
}

function receiptMetrics(receipt: PbtTrialReceipt): Metric[] {
  const { safeReport, cursedReport } = receipt;
  const verdict = (passed: boolean) => (passed ? 'passes' : 'fails');
  return [
    {
      key: 'oracleDiscriminatesFault',
      value: String(receipt.oracleDiscriminatesFault),
      note: `SAFE ${verdict(safeReport.passed)} · CURSED ${verdict(cursedReport.passed)}`,
      tone: receipt.oracleDiscriminatesFault ? 'green' : 'red',
    },
    {
      key: 'reachabilityWitnesses',
      value: `${receipt.reachabilityWitnesses.clearedSignalCount} / ${receipt.reachabilityWitnesses.blockedInterlockCount}`,
      note: `cleared · blocked · ${receipt.reachabilityWitnesses.appliedActionCount} applied`,
    },
    {
      key: 'shrinkingRatio',
      value: `${receipt.shrinkingRatio.originalLength} → ${receipt.shrinkingRatio.shrunkLength}`,
      note: `${receipt.shrinkingRatio.reductionFactor}× smaller`,
    },
    {
      key: 'replayDeterministic',
      value: String(receipt.replayDeterministic),
      note: 'same failing step, replayed twice',
      tone: receipt.replayDeterministic ? 'green' : 'red',
    },
    {
      key: 'executionDurationMs',
      value: `${receipt.executionDurationMs} ms`,
      note: `both tables · ${safeReport.numRunsExecuted + cursedReport.numRunsExecuted} runs`,
    },
    {
      key: 'stepwiseAssertionsChecked',
      value: String(receipt.stepwiseAssertionsChecked),
      note: `${safeReport.stepwiseAssertionsChecked} safe · ${cursedReport.stepwiseAssertionsChecked} cursed`,
    },
  ];
}

function TrialReceipt({ receipt }: { receipt: PbtTrialReceipt | null }) {
  if (receipt === null) {
    return (
      <section className="ticket-empty" aria-label="PBT Trial Receipt">
        <span className="caps ticket-title">PBT Trial Receipt</span>
        <p>Printed when the exorcist runs: six measurements of whether the property tests actually did their job.</p>
      </section>
    );
  }
  const verified = receipt.oracleDiscriminatesFault && receipt.replayDeterministic;
  return (
    <section className="ticket" aria-label="PBT Trial Receipt">
      <div className="ticket-head">
        <h2 className="ticket-title caps">PBT Trial Receipt</h2>
        <span className="ticket-serial mono">
          six measurements · seed {receipt.cursedReport.counterexample?.seed ?? '—'}
        </span>
      </div>
      {verified && (
        <span className="stamp" aria-label="Verified">
          Verified
        </span>
      )}
      <ul className="ticket-grid">
        {receiptMetrics(receipt).map((metric, index) => (
          <li key={metric.key}>
            <span className="metric-key">
              <i>{index + 1}.</i> {metric.key}
            </span>
            <span className="metric-value" data-tone={metric.tone}>
              {metric.value}
            </span>
            <span className="metric-note">{metric.note}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
