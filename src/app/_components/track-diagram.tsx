import type { AgentTrainId, FrameState, TopologyEvaluation } from '../../lib/interlocking.ts';

import { blockOccupancy } from './machine.ts';

interface TrackDiagramProps {
  frame: FrameState;
  topology: TopologyEvaluation;
}

type Point = readonly [number, number];

const MY = 56;
const SY = 126;

interface BlockSpec {
  a: Point;
  b: Point;
  label: string;
  lower: boolean;
}

const BLOCKS: Readonly<Record<string, BlockSpec>> = {
  'north-approach': { a: [78, MY], b: [290, MY], label: 'north-approach', lower: false },
  'junction-throat': { a: [290, MY], b: [500, MY], label: 'junction-throat', lower: false },
  'schema-bridge': { a: [500, MY], b: [712, MY], label: 'schema-bridge', lower: false },
  'prod-mainline': { a: [712, MY], b: [940, MY], label: 'prod-mainline', lower: false },
  'south-branch': { a: [78, SY], b: [238, SY], label: 'south-branch', lower: true },
  'audit-siding': { a: [548, SY], b: [940, SY], label: 'audit-siding', lower: true },
};

const CROSSOVER: readonly [Point, Point] = [[238, SY], [318, MY]];
const AUDIT_LEAD: readonly [Point, Point] = [[468, MY], [548, SY]];

const mid = (spec: BlockSpec): number => (spec.a[0] + spec.b[0]) / 2;

function lampColor(count: number): string | null {
  if (count >= 2) return 'var(--red)';
  if (count === 1) return 'var(--green)';
  return null;
}

interface TokenPlacement {
  agent: AgentTrainId;
  x: number;
  y: number;
  hot: boolean;
}

function placeTokens(frame: FrameState, collisionBlocks: readonly string[]): TokenPlacement[] {
  const active = new Set(frame.activeRoutes.map((route) => route.routeId));
  const hot = (blocks: readonly string[]) => blocks.some((block) => collisionBlocks.includes(block));
  const tokens: TokenPlacement[] = [];
  const bridgeX = mid(BLOCKS['schema-bridge']);

  for (const route of frame.activeRoutes) {
    const isHot = hot(route.occupiedBlocks);
    if (route.routeId === 'NORTH_TO_BRIDGE') {
      tokens.push({ agent: route.agentTrain, x: bridgeX, y: MY, hot: isHot });
    } else if (route.routeId === 'SOUTH_TO_BRIDGE') {
      // two trains converging on one bridge: the later one is caught in the throat
      const x = active.has('NORTH_TO_BRIDGE') ? mid(BLOCKS['junction-throat']) : bridgeX;
      tokens.push({ agent: route.agentTrain, x, y: MY, hot: isHot });
    } else if (route.routeId === 'BRIDGE_MAINLINE') {
      tokens.push({ agent: route.agentTrain, x: mid(BLOCKS['prod-mainline']), y: MY, hot: isHot });
    } else {
      tokens.push({ agent: route.agentTrain, x: mid(BLOCKS['audit-siding']), y: SY, hot: isHot });
    }
  }
  return tokens;
}

function Rail({ a, b, color, width, glow }: { a: Point; b: Point; color: string; width: number; glow: boolean }) {
  return (
    <line
      className="td-rail"
      x1={a[0]}
      y1={a[1]}
      x2={b[0]}
      y2={b[1]}
      stroke={color}
      strokeWidth={width}
      filter={glow ? 'url(#td-glow)' : undefined}
    />
  );
}

export function TrackDiagram({ frame, topology }: TrackDiagramProps) {
  const occupancy = blockOccupancy(frame);
  const collision = topology.collisionBlocks;
  const tokens = placeTokens(frame, collision);
  const levers = frame.levers;
  const southLive = levers[4] === 'REVERSE';
  const auditLive = levers[6] === 'REVERSE';
  const throatColor = lampColor(occupancy['junction-throat'] ?? 0);

  return (
    <svg
      className="td"
      viewBox="0 0 1000 170"
      role="img"
      aria-label={`Illuminated track diagram. ${
        frame.activeRoutes.length === 0
          ? 'No routes set.'
          : `Routes set: ${frame.activeRoutes.map((r) => `${r.routeId} (${r.agentTrain})`).join(', ')}.`
      } ${topology.safe ? 'Topology oracle holds.' : topology.details}`}
    >
      <defs>
        {/* user-space region: a horizontal rail has a zero-height bounding box, which would clip a bbox-relative filter to nothing */}
        <filter id="td-glow" filterUnits="userSpaceOnUse" x={0} y={0} width={1000} height={170}>
          <feGaussianBlur stdDeviation="3.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* crossover and audit leads: bright when the points are set for them, lit when a train uses them */}
      <Rail
        a={CROSSOVER[0]}
        b={CROSSOVER[1]}
        color={
          southLive && throatColor !== null
            ? throatColor
            : levers[2] === 'REVERSE'
              ? 'rgba(239,232,214,0.82)'
              : 'rgba(239,232,214,0.22)'
        }
        width={southLive ? 4 : 3}
        glow={southLive}
      />
      <Rail
        a={AUDIT_LEAD[0]}
        b={AUDIT_LEAD[1]}
        color={auditLive && throatColor !== null ? throatColor : 'rgba(239,232,214,0.22)'}
        width={auditLive ? 4 : 3}
        glow={auditLive}
      />

      {Object.entries(BLOCKS).map(([blockId, spec]) => {
        const count = occupancy[blockId] ?? 0;
        const lit = lampColor(count);
        const lampY = spec.lower ? spec.a[1] - 16 : spec.a[1] + 16;
        const labelY = spec.lower ? spec.a[1] + 32 : spec.a[1] - 21;
        return (
          <g key={blockId} className={count >= 2 ? 'td-block is-hot' : 'td-block'}>
            {count >= 2 && (
              <rect
                key={`flash-${frame.stepHistory.length}`}
                className="td-flash"
                x={spec.a[0]}
                y={spec.a[1] - 17}
                width={spec.b[0] - spec.a[0]}
                height={34}
                rx={4}
              />
            )}
            <Rail
              a={[spec.a[0] + 4, spec.a[1]]}
              b={[spec.b[0] - 4, spec.b[1]]}
              color={lit ?? 'rgba(239,232,214,0.6)'}
              width={count >= 2 ? 5 : count === 1 ? 4 : 3}
              glow={lit !== null}
            />
            <circle
              className="td-lamp"
              cx={mid(spec)}
              cy={lampY}
              r={4.2}
              fill={lit ?? '#26302B'}
              filter={lit !== null ? 'url(#td-glow)' : undefined}
            />
            <text
              className="svg-caps td-label"
              x={mid(spec)}
              y={labelY}
              textAnchor="middle"
              fill={count >= 2 ? 'var(--red)' : count === 1 ? 'var(--ink)' : 'var(--mute)'}
            >
              {spec.label}
            </text>
          </g>
        );
      })}

      {/* home signals #1 and #4 at the left edge: red is "on", green is "off" (cleared) */}
      {([
        [1, MY],
        [4, SY],
      ] as const).map(([leverId, y]) => {
        const clear = levers[leverId] === 'REVERSE';
        const color = clear ? 'var(--green)' : 'var(--red)';
        return (
          <g key={leverId}>
            <rect x={42} y={y - 12} width={20} height={24} rx={3} fill="var(--iron)" stroke="rgba(201,163,91,0.35)" />
            <circle cx={52} cy={y} r={5.2} fill={color} filter="url(#td-glow)" />
            <text
              className="svg-mono"
              x={52}
              y={leverId === 1 ? y - 20 : y + 30}
              textAnchor="middle"
              fontSize={11}
              fill="var(--mute)"
            >
              #{leverId}
            </text>
          </g>
        );
      })}

      {/* the facing point lock sits on the crossover toe: brass when plunged */}
      <g transform={`translate(${CROSSOVER[1][0]} ${CROSSOVER[1][1]})`}>
        <rect
          x={-6}
          y={-6}
          width={12}
          height={12}
          rx={2}
          transform="rotate(45)"
          fill={levers[3] === 'REVERSE' ? 'var(--brass)' : 'var(--ground)'}
          stroke="var(--brass)"
          strokeWidth={1.2}
        />
      </g>

      {tokens.map((token) => {
        const width = 30 + token.agent.length * 7.6;
        const stroke = token.hot ? 'var(--red)' : 'var(--green)';
        return (
          <g
            key={token.agent}
            className={token.hot ? 'td-token is-hot' : 'td-token'}
            transform={`translate(${token.x} ${token.y})`}
          >
            <g className="td-token-body">
              <rect x={-width / 2} y={-11} width={width} height={22} rx={11} fill="#0B100E" stroke={stroke} strokeWidth={1.4} />
              <circle cx={-width / 2 + 12} cy={0} r={3.6} fill={stroke} />
              <text className="svg-caps" x={6} y={4.2} textAnchor="middle" fontSize={11.5} fill="var(--ink)">
                {token.agent}
              </text>
            </g>
          </g>
        );
      })}
    </svg>
  );
}
