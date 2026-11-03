'use client';

import { useRef, useState } from 'react';

import type { LeverId, PresetId, RouteId } from '../lib/interlocking.ts';
import {
  createSignalBoxStore,
  executeSignalBoxMcpTool,
  type SignalBoxMcpResponse,
  type SignalBoxStore,
  type SignalBoxStoreState,
  type SoundCue,
} from '../lib/signal-box-store.ts';

interface LeverDescriptor {
  leverId: LeverId;
  title: string;
  roleLabel: string;
  badgeColor: string;
}

const LEVER_DESCRIPTORS: readonly LeverDescriptor[] = [
  {
    leverId: 1,
    title: 'North Up Home',
    roleLabel: 'SIGNAL // BUILDER',
    badgeColor: '#dc2626',
  },
  {
    leverId: 2,
    title: 'Junction Crossover',
    roleLabel: 'POINT SWITCH',
    badgeColor: '#52525b',
  },
  {
    leverId: 3,
    title: 'Facing Point Lock',
    roleLabel: 'FPL PLUNGER',
    badgeColor: '#2563eb',
  },
  {
    leverId: 4,
    title: 'South Branch Home',
    roleLabel: 'SIGNAL // MIGRATOR',
    badgeColor: '#dc2626',
  },
  {
    leverId: 5,
    title: 'Bridge Distant',
    roleLabel: 'SIGNAL // DEPLOYER',
    badgeColor: '#d97706',
  },
  {
    leverId: 6,
    title: 'Audit Siding Dwarf',
    roleLabel: 'SIGNAL // VERIFIER',
    badgeColor: '#dc2626',
  },
  {
    leverId: 7,
    title: 'Bridge Token',
    roleLabel: 'CLEARANCE LOCK',
    badgeColor: '#b45309',
  },
  {
    leverId: 8,
    title: 'Maintenance Isolator',
    roleLabel: 'ISOLATION KEY',
    badgeColor: '#7c2d12',
  },
];

interface AgentRouteCardSpec {
  routeId: RouteId;
  agentId: 'Builder' | 'Migrator' | 'Deployer' | 'Verifier';
  corridorLabel: string;
  signalLever: LeverId;
}

const AGENT_ROUTE_SPECS: readonly AgentRouteCardSpec[] = [
  {
    routeId: 'NORTH_TO_BRIDGE',
    agentId: 'Builder',
    corridorLabel: 'North Up Main -> Throat -> Schema Bridge',
    signalLever: 1,
  },
  {
    routeId: 'SOUTH_TO_BRIDGE',
    agentId: 'Migrator',
    corridorLabel: 'South Branch -> Crossover #2 -> Schema Bridge',
    signalLever: 4,
  },
  {
    routeId: 'BRIDGE_MAINLINE',
    agentId: 'Deployer',
    corridorLabel: 'Schema Bridge -> Prod Mainline (Token #7)',
    signalLever: 5,
  },
  {
    routeId: 'AUDIT_SIDING',
    agentId: 'Verifier',
    corridorLabel: 'Junction Throat -> Audit Siding (Isolator #8)',
    signalLever: 6,
  },
];

let sharedAudioContext: AudioContext | null = null;

function playMechanicalSound(cue: SoundCue, muted: boolean): void {
  if (
    muted ||
    cue === 'NONE' ||
    typeof window === 'undefined' ||
    !('AudioContext' in window)
  ) {
    return;
  }

  try {
    if (!sharedAudioContext || sharedAudioContext.state === 'closed') {
      const AudioCtx = window.AudioContext;
      sharedAudioContext = new AudioCtx();
    }
    const ctx = sharedAudioContext;
    if (ctx.state === 'suspended') {
      void ctx.resume();
    }
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };

    if (cue === 'LEVER_LATCH') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(190, now);
      osc.frequency.exponentialRampToValueAtTime(340, now + 0.09);
      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
      osc.start(now);
      osc.stop(now + 0.12);
    } else if (cue === 'INTERLOCK_CLANK') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(110, now);
      osc.frequency.linearRampToValueAtTime(68, now + 0.16);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc.start(now);
      osc.stop(now + 0.19);
    } else if (cue === 'COLLISION_ALARM') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.setValueAtTime(390, now + 0.12);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      osc.start(now);
      osc.stop(now + 0.29);
    } else {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(660, now + 0.2);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.start(now);
      osc.stop(now + 0.23);
    }
  } catch {
    // WebAudio synthesis is best-effort in browsers that block autoplay prior to gesture
  }
}

function getBlockStrokeColor(
  blockId: string,
  occupiedBlocks: readonly string[],
  collisionBlocks: readonly string[],
): string {
  if (collisionBlocks.includes(blockId)) {
    return '#ef4444';
  }
  if (occupiedBlocks.includes(blockId)) {
    return '#10b981';
  }
  return '#57534e';
}

export default function SignalBoxPage() {
  const storeRef = useRef<SignalBoxStore | null>(null);
  if (storeRef.current === null) {
    storeRef.current = createSignalBoxStore('STANDARD_SAFE');
  }

  const [snapshot, setSnapshot] = useState<SignalBoxStoreState>(() =>
    storeRef.current!.getState(),
  );
  const [lastMcpResponse, setLastMcpResponse] =
    useState<SignalBoxMcpResponse | null>(null);

  const commitStoreUpdate = (next: SignalBoxStoreState): void => {
    setSnapshot({ ...next });
    playMechanicalSound(next.lastSoundCue, next.audioMuted);
  };

  const handlePullLever = (leverId: LeverId): void => {
    const next = storeRef.current!.pullLever(leverId);
    commitStoreUpdate(next);
  };

  const handleReleaseLever = (leverId: LeverId): void => {
    const next = storeRef.current!.releaseLever(leverId);
    commitStoreUpdate(next);
  };

  const handleSwitchPreset = (presetId: PresetId): void => {
    const next = storeRef.current!.switchPreset(presetId);
    setLastMcpResponse(null);
    commitStoreUpdate(next);
  };

  const handleToggleAudioMute = (): void => {
    const next = storeRef.current!.toggleAudioMute();
    setSnapshot({ ...next });
  };

  const handleRunExorcism = (): void => {
    const next = storeRef.current!.runExorcism();
    commitStoreUpdate(next);
  };

  const handleStepReplayForward = (): void => {
    const next = storeRef.current!.stepReplayForward();
    commitStoreUpdate(next);
  };

  const handleMcpRouteAction = (
    toolName: 'request_route' | 'release_route',
    agentId: string,
    routeId: RouteId,
  ): void => {
    const res = executeSignalBoxMcpTool(storeRef.current!, {
      toolName,
      agentId,
      routeId,
    });
    setLastMcpResponse(res);
    const next = storeRef.current!.getState();
    commitStoreUpdate(next);
  };

  const {
    frame,
    topology,
    tappetBars,
    audioMuted,
    exorcismReport,
    trialReceipt,
    replayBundle,
    replayCursor,
    collisionBanner,
  } = snapshot;

  return (
    <main
      style={{
        minHeight: '100vh',
        backgroundColor: '#0c0b09',
        color: '#ede3ce',
        padding: '20px 24px 40px',
      }}
    >
      {/* Top Victorian Brass Header Bar */}
      <header
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '16px',
          padding: '16px 20px',
          backgroundColor: '#171411',
          border: '1px solid #85683a',
          borderRadius: '6px',
          marginBottom: '18px',
        }}
      >
        <div>
          <div
            style={{
              fontSize: '11px',
              letterSpacing: '0.16em',
              color: '#d4af37',
              textTransform: 'uppercase',
            }}
          >
            SAXBY & FARMER 1856 TAPPET INTERLOCKING // KIRO FORMAL PBT HARNESS
          </div>
          <h1
            style={{
              margin: '4px 0 0',
              fontSize: '20px',
              fontWeight: 700,
              color: '#fef3c7',
            }}
          >
            SIGNAL BOX // LEVERFRAME
          </h1>
        </div>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <button
            type="button"
            onClick={() => handleSwitchPreset('STANDARD_SAFE')}
            style={{
              padding: '8px 12px',
              borderRadius: '4px',
              border:
                frame.presetId === 'STANDARD_SAFE'
                  ? '2px solid #10b981'
                  : '1px solid #57534e',
              backgroundColor:
                frame.presetId === 'STANDARD_SAFE' ? '#064e3b' : '#1c1917',
              color: '#ecfdf5',
              fontWeight: 600,
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            PRESET: STANDARD_SAFE
          </button>

          <button
            type="button"
            onClick={() =>
              handleSwitchPreset('CURSED_MISSING_CROSSOVER_LOCK')
            }
            style={{
              padding: '8px 12px',
              borderRadius: '4px',
              border:
                frame.presetId === 'CURSED_MISSING_CROSSOVER_LOCK'
                  ? '2px solid #ef4444'
                  : '1px solid #57534e',
              backgroundColor:
                frame.presetId === 'CURSED_MISSING_CROSSOVER_LOCK'
                  ? '#7f1d1d'
                  : '#1c1917',
              color: '#fef2f2',
              fontWeight: 600,
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            PRESET: CURSED_MISSING_CROSSOVER_LOCK
          </button>

          <button
            type="button"
            onClick={handleToggleAudioMute}
            style={{
              padding: '8px 12px',
              borderRadius: '4px',
              border: '1px solid #85683a',
              backgroundColor: '#262118',
              color: '#fde68a',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            {audioMuted ? 'AUDIO: MUTED' : 'AUDIO: WEBAUDIO SYNTH'}
          </button>

          <button
            type="button"
            onClick={handleRunExorcism}
            style={{
              padding: '8px 14px',
              borderRadius: '4px',
              border: '1px solid #f59e0b',
              backgroundColor: '#b45309',
              color: '#fffbeb',
              fontWeight: 700,
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            RUN PBT EXORCIST (fast-check)
          </button>
        </div>
      </header>

      {/* Active Collision Banner or Mechanical Interlock Block Banner */}
      {collisionBanner !== null && (
        <section
          role="alert"
          style={{
            padding: '12px 16px',
            marginBottom: '16px',
            backgroundColor: '#450a0a',
            border: '2px solid #ef4444',
            borderRadius: '6px',
            color: '#fecaca',
          }}
        >
          <strong>
            PHYSICAL TOPOLOGY VIOLATION ({topology.violatedProperty}) — MISSING{' '}
            {topology.missingRuleId}:
          </strong>{' '}
          {collisionBanner}
        </section>
      )}

      {frame.lastOutcome === 'BLOCKED_BY_INTERLOCK' && (
        <section
          role="status"
          style={{
            padding: '12px 16px',
            marginBottom: '16px',
            backgroundColor: '#291d0e',
            border: '1px solid #f59e0b',
            borderRadius: '6px',
            color: '#fde68a',
          }}
        >
          <div>
            <strong>
              MECHANICAL TAPPET LOCK ENGAGED [{frame.blockingRuleId}]:
            </strong>{' '}
            {frame.blockingReason}
          </div>
          <div style={{ fontSize: '12px', marginTop: '4px', color: '#fcd34d' }}>
            EARS Spec: {frame.blockingEarsClause}
          </div>
        </section>
      )}

      {/* Illuminated Track Diagram & Kiro Crew Agent Trains */}
      <section
        style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr',
          gap: '16px',
          marginBottom: '18px',
        }}
      >
        <div
          style={{
            backgroundColor: '#14120f',
            border: '1px solid #57462b',
            borderRadius: '6px',
            padding: '16px',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '10px',
            }}
          >
            <h2 style={{ margin: 0, fontSize: '14px', color: '#fcd34d' }}>
              ILLUMINATED TRACK DIAGRAM & JUNCTION TOPOLOGY ORACLE
            </h2>
            <span
              style={{
                fontSize: '12px',
                padding: '3px 8px',
                borderRadius: '4px',
                backgroundColor: topology.safe ? '#064e3b' : '#7f1d1d',
                color: topology.safe ? '#6ee7b7' : '#fca5a5',
                fontWeight: 700,
              }}
            >
              {topology.safe
                ? 'ORACLE: P1 & P2 INVARIANTS HOLD'
                : topology.collisionBlocks.length > 0
                  ? `COLLISION: ${topology.collisionBlocks.join(', ')}`
                  : `LOCK VIOLATION: SIGNAL #${topology.misalignedSignals.join(', #')}`}
            </span>
          </div>

          <svg
            viewBox="0 0 760 220"
            style={{
              width: '100%',
              height: 'auto',
              backgroundColor: '#090807',
              border: '1px solid #3f3422',
              borderRadius: '4px',
            }}
          >
            {/* North Approach Block */}
            <line
              x1="30"
              y1="65"
              x2="230"
              y2="65"
              stroke={getBlockStrokeColor(
                'north-approach',
                frame.occupiedBlocks,
                topology.collisionBlocks,
              )}
              strokeWidth="8"
            />
            <text x="35" y="45" fill="#d6d3d1" fontSize="11">
              north-approach (Signal #1 // Builder)
            </text>

            {/* South Branch Block */}
            <line
              x1="30"
              y1="155"
              x2="180"
              y2="155"
              stroke={getBlockStrokeColor(
                'south-branch',
                frame.occupiedBlocks,
                topology.collisionBlocks,
              )}
              strokeWidth="8"
            />
            <text x="35" y="182" fill="#d6d3d1" fontSize="11">
              south-branch (Signal #4 // Migrator)
            </text>

            {/* Crossover Point #2 & FPL #3 */}
            <line
              x1="180"
              y1="155"
              x2="245"
              y2="65"
              stroke={
                frame.levers[2] === 'REVERSE' ? '#f59e0b' : '#44403c'
              }
              strokeWidth="6"
              strokeDasharray={frame.levers[2] === 'REVERSE' ? '0' : '6 4'}
            />
            <text x="165" y="118" fill="#fbbf24" fontSize="10">
              Point #2: {frame.levers[2]} | FPL #3: {frame.levers[3]}
            </text>

            {/* Junction Throat Block */}
            <line
              x1="230"
              y1="65"
              x2="410"
              y2="65"
              stroke={getBlockStrokeColor(
                'junction-throat',
                frame.occupiedBlocks,
                topology.collisionBlocks,
              )}
              strokeWidth="10"
            />
            <text x="260" y="45" fill="#fde68a" fontSize="11">
              junction-throat
            </text>

            {/* Audit Siding Branch */}
            <line
              x1="360"
              y1="65"
              x2="460"
              y2="155"
              stroke={getBlockStrokeColor(
                'audit-siding',
                frame.occupiedBlocks,
                topology.collisionBlocks,
              )}
              strokeWidth="7"
            />
            <line
              x1="460"
              y1="155"
              x2="690"
              y2="155"
              stroke={getBlockStrokeColor(
                'audit-siding',
                frame.occupiedBlocks,
                topology.collisionBlocks,
              )}
              strokeWidth="7"
            />
            <text x="465" y="180" fill="#d6d3d1" fontSize="11">
              audit-siding (Signal #6 + Isolator #8 // Verifier)
            </text>

            {/* Schema Bridge Block */}
            <line
              x1="410"
              y1="65"
              x2="575"
              y2="65"
              stroke={getBlockStrokeColor(
                'schema-bridge',
                frame.occupiedBlocks,
                topology.collisionBlocks,
              )}
              strokeWidth="10"
            />
            <text x="445" y="45" fill="#fde68a" fontSize="11">
              schema-bridge
            </text>

            {/* Prod Mainline Block */}
            <line
              x1="575"
              y1="65"
              x2="730"
              y2="65"
              stroke={getBlockStrokeColor(
                'prod-mainline',
                frame.occupiedBlocks,
                topology.collisionBlocks,
              )}
              strokeWidth="8"
            />
            <text x="580" y="45" fill="#d6d3d1" fontSize="11">
              prod-mainline (#5 + #7 // Deployer)
            </text>
          </svg>
        </div>

        {/* Kiro Crew MCP Agent Train Dispatcher */}
        <div
          style={{
            backgroundColor: '#14120f',
            border: '1px solid #57462b',
            borderRadius: '6px',
            padding: '16px',
          }}
        >
          <h2
            style={{
              margin: '0 0 10px',
              fontSize: '14px',
              color: '#fcd34d',
            }}
          >
            KIRO CREW MCP ROUTE DISPATCHER
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {AGENT_ROUTE_SPECS.map((spec) => {
              const isRouteActive = frame.activeRoutes.some(
                (r) => r.routeId === spec.routeId,
              );
              return (
                <div
                  key={spec.routeId}
                  style={{
                    padding: '8px 10px',
                    backgroundColor: '#1c1917',
                    border: isRouteActive
                      ? '1px solid #10b981'
                      : '1px solid #3f3422',
                    borderRadius: '4px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '12px',
                      fontWeight: 700,
                    }}
                  >
                    <span>
                      {spec.agentId} ({spec.routeId})
                    </span>
                    <span
                      style={{
                        color: isRouteActive ? '#34d399' : '#a8a29e',
                      }}
                    >
                      {isRouteActive ? 'CLEAR' : 'HELD'}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: '11px',
                      color: '#a8a29e',
                      margin: '3px 0 6px',
                    }}
                  >
                    {spec.corridorLabel}
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={() =>
                        handleMcpRouteAction(
                          'request_route',
                          spec.agentId,
                          spec.routeId,
                        )
                      }
                      style={{
                        padding: '4px 8px',
                        fontSize: '11px',
                        backgroundColor: '#065f46',
                        color: '#ecfdf5',
                        border: '1px solid #10b981',
                        borderRadius: '3px',
                        cursor: 'pointer',
                      }}
                    >
                      MCP request_route
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleMcpRouteAction(
                          'release_route',
                          spec.agentId,
                          spec.routeId,
                        )
                      }
                      style={{
                        padding: '4px 8px',
                        fontSize: '11px',
                        backgroundColor: '#292524',
                        color: '#e7e5e4',
                        border: '1px solid #57534e',
                        borderRadius: '3px',
                        cursor: 'pointer',
                      }}
                    >
                      MCP release_route
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          {lastMcpResponse !== null && (
            <div
              style={{
                marginTop: '8px',
                padding: '6px 8px',
                fontSize: '11px',
                backgroundColor: '#090807',
                border: '1px solid #44403c',
                borderRadius: '4px',
                color: '#d6d3d1',
              }}
            >
              {!lastMcpResponse.isError &&
              lastMcpResponse.toolName === 'request_route'
                ? `MCP ${lastMcpResponse.agentId} -> ${lastMcpResponse.routeId}: ${
                    lastMcpResponse.granted
                      ? 'GRANTED'
                      : `BLOCKED (${lastMcpResponse.blockingRuleId})`
                  }`
                : 'MCP tool executed'}
            </div>
          )}
        </div>
      </section>

      {/* 8-Lever Victorian Brass Frame */}
      <section
        style={{
          backgroundColor: '#14120f',
          border: '1px solid #85683a',
          borderRadius: '6px',
          padding: '16px',
          marginBottom: '18px',
        }}
      >
        <h2
          style={{
            margin: '0 0 12px',
            fontSize: '14px',
            color: '#fcd34d',
          }}
        >
          8-LEVER VICTORIAN BRASS INTERLOCKING FRAME
        </h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(8, minmax(110px, 1fr))',
            gap: '10px',
            overflowX: 'auto',
          }}
        >
          {LEVER_DESCRIPTORS.map((desc) => {
            const leverState = frame.levers[desc.leverId];
            const isReverse = leverState === 'REVERSE';
            return (
              <div
                key={desc.leverId}
                style={{
                  backgroundColor: '#1c1814',
                  border: isReverse
                    ? '2px solid #f59e0b'
                    : '1px solid #44403c',
                  borderRadius: '6px',
                  padding: '10px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '15px',
                        fontWeight: 800,
                        color: '#fef3c7',
                      }}
                    >
                      #{desc.leverId}
                    </span>
                    <span
                      style={{
                        fontSize: '10px',
                        padding: '2px 5px',
                        borderRadius: '3px',
                        backgroundColor: desc.badgeColor,
                        color: '#ffffff',
                        fontWeight: 700,
                      }}
                    >
                      {leverState}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: '12px',
                      fontWeight: 700,
                      marginTop: '6px',
                      color: '#f5f5f4',
                    }}
                  >
                    {desc.title}
                  </div>
                  <div
                    style={{
                      fontSize: '10px',
                      color: '#a8a29e',
                      marginTop: '2px',
                    }}
                  >
                    {desc.roleLabel}
                  </div>
                </div>

                {/* Mechanical Brass Lever Handle Visualization */}
                <div
                  style={{
                    height: '58px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '10px 0',
                  }}
                >
                  <div
                    style={{
                      width: '8px',
                      height: '48px',
                      borderRadius: '4px',
                      backgroundColor: isReverse ? '#f59e0b' : '#a8a29e',
                      transform: isReverse ? 'rotate(18deg)' : 'rotate(-18deg)',
                      transition: 'transform 150ms ease',
                      border: '1px solid #fef3c7',
                    }}
                  />
                </div>

                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '5px',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => handlePullLever(desc.leverId)}
                    style={{
                      padding: '5px 6px',
                      fontSize: '11px',
                      fontWeight: 700,
                      backgroundColor: '#78350f',
                      color: '#fef3c7',
                      border: '1px solid #d97706',
                      borderRadius: '3px',
                      cursor: 'pointer',
                    }}
                  >
                    PULL (REV)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleReleaseLever(desc.leverId)}
                    style={{
                      padding: '5px 6px',
                      fontSize: '11px',
                      backgroundColor: '#292524',
                      color: '#d6d3d1',
                      border: '1px solid #57534e',
                      borderRadius: '3px',
                      cursor: 'pointer',
                    }}
                  >
                    RELEASE (NRM)
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Bottom Grid: Tappet Locking Matrix & PBT Exorcist + Trial Receipt */}
      <section
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '16px',
        }}
      >
        {/* Mechanical Tappet Locking Matrix */}
        <div
          style={{
            backgroundColor: '#14120f',
            border: '1px solid #57462b',
            borderRadius: '6px',
            padding: '16px',
          }}
        >
          <h2
            style={{
              margin: '0 0 10px',
              fontSize: '14px',
              color: '#fcd34d',
            }}
          >
            MECHANICAL TAPPET LOCKING BED ({frame.presetId})
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {tappetBars.map((bar) => (
              <div
                key={`${bar.ruleId}-L${bar.appliesToLever}-${bar.targetIntent}`}
                style={{
                  padding: '8px 10px',
                  backgroundColor: '#1c1917',
                  border: bar.engaged
                    ? '1px solid #f59e0b'
                    : '1px solid #292524',
                  borderRadius: '4px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '12px',
                    fontWeight: 700,
                  }}
                >
                  <span>
                    {bar.ruleId} (Lever #{bar.appliesToLever}{' '}
                    {bar.targetIntent})
                  </span>
                  <span
                    style={{
                      color: bar.engaged ? '#fbbf24' : '#34d399',
                    }}
                  >
                    {bar.engaged ? 'TAPPET LOCKED' : 'TAPPET FREE'}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: '11px',
                    color: '#a8a29e',
                    marginTop: '3px',
                  }}
                >
                  {bar.earsClause}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* PBT Exorcist & Shrinking Counterexample Replay + Trial Receipt Card */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          <div
            style={{
              backgroundColor: '#14120f',
              border: '1px solid #57462b',
              borderRadius: '6px',
              padding: '16px',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '10px',
              }}
            >
              <h2 style={{ margin: 0, fontSize: '14px', color: '#fcd34d' }}>
                PBT EXORCIST & SHRUNKEN COUNTEREXAMPLE REPLAY
              </h2>
              {replayBundle !== null && (
                <button
                  type="button"
                  onClick={handleStepReplayForward}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: '#991b1b',
                    color: '#fef2f2',
                    border: '1px solid #f87171',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Step Replay Forward (stepReplayForward)
                </button>
              )}
            </div>

            {exorcismReport === null ? (
              <div style={{ fontSize: '12px', color: '#a8a29e' }}>
                Click &quot;RUN PBT EXORCIST (fast-check)&quot; to execute 80
                stepwise property sequences against {frame.presetId}.
              </div>
            ) : (
              <div>
                <div
                  style={{
                    fontSize: '12px',
                    marginBottom: '8px',
                    color: exorcismReport.passed ? '#6ee7b7' : '#fca5a5',
                    fontWeight: 700,
                  }}
                >
                  {exorcismReport.passed
                    ? `EXORCISM PASSED: ${exorcismReport.numRunsExecuted} runs (${exorcismReport.stepwiseAssertionsChecked} stepwise checks) verified P1 & P2.`
                    : `COUNTEREXAMPLE ISOLATED: Shrunk ${replayBundle?.originalLength} steps -> ${replayBundle?.shrunkActions.length} minimal steps (Missing ${replayBundle?.missingRuleId}).`}
                </div>

                {replayBundle !== null && (
                  <div
                    style={{
                      display: 'flex',
                      gap: '8px',
                      flexWrap: 'wrap',
                      marginTop: '8px',
                    }}
                  >
                    {replayBundle.shrunkActions.map((act, stepIdx) => {
                      const isCurrentStep = replayCursor === stepIdx;
                      return (
                        <div
                          key={`shrunk-step-${act.leverId}-${act.intent}-${String(stepIdx)}`}
                          style={{
                            padding: '6px 10px',
                            borderRadius: '4px',
                            border: isCurrentStep
                              ? '2px solid #ef4444'
                              : '1px solid #57534e',
                            backgroundColor: isCurrentStep
                              ? '#7f1d1d'
                              : '#1c1917',
                            fontSize: '12px',
                          }}
                        >
                          Step {stepIdx + 1}: Lever #{act.leverId} {act.intent}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Post-Hackathon PBT Trial Receipt Card */}
          <div
            style={{
              backgroundColor: '#14120f',
              border: '1px solid #85683a',
              borderRadius: '6px',
              padding: '16px',
            }}
          >
            <h2
              style={{
                margin: '0 0 10px',
                fontSize: '14px',
                color: '#fcd34d',
              }}
            >
              PBT TRIAL RECEIPT (6 GPT-6 PRO EVALUATION METRICS)
            </h2>
            {trialReceipt === null ? (
              <div style={{ fontSize: '12px', color: '#a8a29e' }}>
                Run PBT Exorcist to populate the 6 formal trial evaluation
                metrics (`oracleDiscriminatesFault`, `reachabilityWitnesses`,
                `shrinkingRatio`, `replayDeterministic`, `executionDurationMs`,
                `stepwiseAssertionsChecked`).
              </div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '8px',
                  fontSize: '12px',
                }}
              >
                <div
                  style={{
                    padding: '8px',
                    backgroundColor: '#1c1917',
                    borderRadius: '4px',
                  }}
                >
                  <div style={{ color: '#a8a29e', fontSize: '11px' }}>
                    1. oracleDiscriminatesFault
                  </div>
                  <div style={{ fontWeight: 700, color: '#34d399' }}>
                    {String(trialReceipt.oracleDiscriminatesFault)} (SAFE=PASS,
                    CURSED=FAIL)
                  </div>
                </div>

                <div
                  style={{
                    padding: '8px',
                    backgroundColor: '#1c1917',
                    borderRadius: '4px',
                  }}
                >
                  <div style={{ color: '#a8a29e', fontSize: '11px' }}>
                    2. reachabilityWitnesses
                  </div>
                  <div style={{ fontWeight: 700 }}>
                    cleared={trialReceipt.reachabilityWitnesses.clearedSignalCount}{' '}
                    | blocked=
                    {trialReceipt.reachabilityWitnesses.blockedInterlockCount}
                  </div>
                </div>

                <div
                  style={{
                    padding: '8px',
                    backgroundColor: '#1c1917',
                    borderRadius: '4px',
                  }}
                >
                  <div style={{ color: '#a8a29e', fontSize: '11px' }}>
                    3. shrinkingRatio
                  </div>
                  <div style={{ fontWeight: 700 }}>
                    {trialReceipt.shrinkingRatio.originalLength} -&gt;{' '}
                    {trialReceipt.shrinkingRatio.shrunkLength} steps (
                    {trialReceipt.shrinkingRatio.reductionFactor}x)
                  </div>
                </div>

                <div
                  style={{
                    padding: '8px',
                    backgroundColor: '#1c1917',
                    borderRadius: '4px',
                  }}
                >
                  <div style={{ color: '#a8a29e', fontSize: '11px' }}>
                    4. replayDeterministic
                  </div>
                  <div style={{ fontWeight: 700, color: '#34d399' }}>
                    {String(trialReceipt.replayDeterministic)}
                  </div>
                </div>

                <div
                  style={{
                    padding: '8px',
                    backgroundColor: '#1c1917',
                    borderRadius: '4px',
                  }}
                >
                  <div style={{ color: '#a8a29e', fontSize: '11px' }}>
                    5. executionDurationMs
                  </div>
                  <div style={{ fontWeight: 700 }}>
                    {trialReceipt.executionDurationMs} ms
                  </div>
                </div>

                <div
                  style={{
                    padding: '8px',
                    backgroundColor: '#1c1917',
                    borderRadius: '4px',
                  }}
                >
                  <div style={{ color: '#a8a29e', fontSize: '11px' }}>
                    6. stepwiseAssertionsChecked
                  </div>
                  <div style={{ fontWeight: 700 }}>
                    {trialReceipt.stepwiseAssertionsChecked} assertions
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
