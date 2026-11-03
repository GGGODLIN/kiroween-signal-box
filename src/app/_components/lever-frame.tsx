import type { KeyboardEvent } from 'react';

import type { FrameState, LeverId } from '../../lib/interlocking.ts';
import type { TappetBarState } from '../../lib/signal-box-store.ts';

import {
  ANG_N,
  ANG_R,
  BAR_X0,
  BED,
  BED_ROW_Y,
  DOG,
  FORE,
  FRAME_VIEW,
  LEVER_LEN,
  LEVERS,
  LX,
  PIV_Y,
  PITCH,
  PLATE,
  QUAD,
  TAPPET,
  buildBedRows,
  lastBlock,
  locksHolding,
  missingRuleIds,
  shortRuleId,
  type BedDog,
  type BedRow,
  type LeverDescriptor,
  type LeverPaint,
} from './machine.ts';

export interface LeverJerk {
  leverId: LeverId;
  intent: 'PULL' | 'RELEASE';
  nonce: number;
}

interface LeverFrameProps {
  frame: FrameState;
  tappetBars: readonly TappetBarState[];
  jerk: LeverJerk | null;
  moveDelays: Readonly<Partial<Record<LeverId, number>>>;
  onToggle: (leverId: LeverId) => void;
}

const PAINT_STOPS: Readonly<Record<LeverPaint, readonly [string, string, string]>> = {
  red: ['#69201A', '#A9342A', '#B2483F'],
  black: ['#141615', '#202422', '#363A38'],
  blue: ['#1D3B63', '#2F5F9F', '#446FA9'],
  yellow: ['#7D5F16', '#C99A24', '#CEA43A'],
  brown: ['#442F1D', '#6E4B2E', '#7D5D43'],
};

const TOP = -LEVER_LEN;
const STEEL_LEN = 69;
const PAINT_TOP = TOP + STEEL_LEN;
const BADGE_Y = PAINT_TOP + 34;
const BED_STATUS_Y = BED.y - 11;
// the hover hint needs ~16 units above the handles; anything higher is dead space the page pays for in height
const VIEW_TOP = 14;

function leverTransform(isReverse: boolean): string {
  const fore = isReverse ? 1 - FORE : 1;
  const angle = isReverse ? ANG_R : ANG_N;
  return `rotate(${angle}rad) scale(${(1 + 0.25 * (1 - fore)).toFixed(4)}, ${fore})`;
}

/** A flat painted iron bar with a worn steel top, a brass collar and badge, and the catch handle on its far side. */
function LeverArt({ leverId, paint }: { leverId: LeverId; paint: LeverPaint }) {
  return (
    <>
      <path
        d={`M-11 0 L-7.5 ${TOP + 4} L7.5 ${TOP + 4} L11 0 Z`}
        fill="#000"
        opacity={0.34}
        transform="translate(12 8)"
      />
      <line x1={10.5} y1={TOP + 48} x2={13.5} y2={-14} stroke="#323A3D" strokeWidth={2.2} />
      <rect x={9} y={-20} width={9} height={11} fill="var(--steel-lo)" />
      <path d={`M-11 0 L-7.6 ${PAINT_TOP} L7.6 ${PAINT_TOP} L11 0 Z`} fill={`url(#lf-paint-${paint})`} />
      <path d={`M-11 0 L-7.6 ${PAINT_TOP} L-5.4 ${PAINT_TOP} L-8.4 0 Z`} fill="rgba(255,240,215,0.16)" />
      <path d={`M11 0 L7.6 ${PAINT_TOP} L5.6 ${PAINT_TOP} L8.6 0 Z`} fill="rgba(0,0,0,0.32)" />
      <rect x={-8} y={BADGE_Y - 9} width={16} height={18} rx={2.5} fill="url(#lf-badge)" />
      <text className="svg-serif" x={0} y={BADGE_Y + 5} textAnchor="middle" fontSize={13} fill="#2A1E0C">
        {leverId}
      </text>
      <path
        className="lf-steel"
        d={`M-7.6 ${PAINT_TOP} L-7 ${TOP + 2} Q-7 ${TOP} -5 ${TOP} L5 ${TOP} Q7 ${TOP} 7 ${TOP + 2} L7.6 ${PAINT_TOP} Z`}
        fill="url(#lf-steel)"
      />
      <rect className="lf-steel-hi" x={-5.8} y={TOP + 5} width={2.2} height={STEEL_LEN - 11} fill="#fff" opacity={0.35} />
      <rect x={4.2} y={TOP + 3} width={2.6} height={STEEL_LEN - 6} fill="#000" opacity={0.28} />
      <rect x={-8.6} y={PAINT_TOP - 3} width={17.2} height={6} fill="url(#lf-collar)" />
      <g className="lf-catch">
        <polyline
          points={`6.5,${TOP + 12} 14.5,${TOP + 16} 14.5,${TOP + 48} 6.5,${TOP + 51}`}
          fill="none"
          stroke="#2D3437"
          strokeWidth={4.2}
        />
        <line x1={13.1} y1={TOP + 18} x2={13.1} y2={TOP + 46} stroke="rgba(220,228,230,0.55)" strokeWidth={1.1} />
      </g>
    </>
  );
}

function dogPath(x: number, y: number, side: BedDog['side']): string {
  const h = DOG.h / 2;
  if (side === 'left') {
    return `M${x} ${y - h} L${x + DOG.w - 5} ${y - h} L${x + DOG.w} ${y} L${x + DOG.w - 5} ${y + h} L${x} ${y + h} Z`;
  }
  return `M${x + DOG.w} ${y - h} L${x + 5} ${y - h} L${x} ${y} L${x + 5} ${y + h} L${x + DOG.w} ${y + h} Z`;
}

// a left dog seats when its bar runs right (+slide), a right dog when the bar runs back (−slide)
const dogBaseX = (dog: BedDog): number =>
  dog.side === 'left' ? LX(dog.leverId) - 16 - DOG.slide : LX(dog.leverId) + 2 + DOG.slide;

export function LeverFrame({ frame, tappetBars, jerk, moveDelays, onToggle }: LeverFrameProps) {
  const { levers, presetId } = frame;
  const rows = buildBedRows(presetId, levers, tappetBars);
  const block = lastBlock(frame);
  const missing = missingRuleIds(presetId);
  const maxDelay = Math.max(0, ...Object.values(moveDelays).map((d) => d ?? 0));
  const barDelay = maxDelay + 140;
  const seatedDogs = rows.reduce((n, row) => n + row.dogs.filter((dog) => dog.seated).length, 0);
  const lockedCount = LEVERS.filter((d) => locksHolding(d.leverId, levers, tappetBars).length > 0).length;

  const bedStatus = block
    ? { text: `BLOCKED · ${block.ruleId} HOLDS #${block.leverId}`, tone: 'var(--red)' }
    : missing.length > 0
      ? { text: `${missing.join(' · ')} MISSING FROM THIS TABLE`, tone: 'var(--red)' }
      : { text: `${seatedDogs} DOGS SEATED · ${lockedCount} LEVERS LOCKED`, tone: 'var(--mute)' };

  return (
    <svg
      className="lf"
      viewBox={`0 ${VIEW_TOP} ${FRAME_VIEW.w} ${FRAME_VIEW.h - VIEW_TOP}`}
      role="group"
      aria-label="Eight-lever frame and tappet locking bed"
    >
      <defs>
        {(Object.entries(PAINT_STOPS) as Array<[LeverPaint, readonly [string, string, string]]>).map(
          ([paint, [dark, base, light]]) => (
            <linearGradient key={paint} id={`lf-paint-${paint}`} gradientUnits="userSpaceOnUse" x1={0} y1={0} x2={0} y2={PAINT_TOP}>
              <stop offset={0} stopColor={dark} />
              <stop offset={0.7} stopColor={base} />
              <stop offset={1} stopColor={light} />
            </linearGradient>
          ),
        )}
        <linearGradient id="lf-steel" gradientUnits="userSpaceOnUse" x1={0} y1={PAINT_TOP} x2={0} y2={TOP}>
          <stop offset={0} stopColor="#59646A" />
          <stop offset={0.55} stopColor="#B9C4C8" />
          <stop offset={0.85} stopColor="#E2E8EA" />
          <stop offset={1} stopColor="#C9D2D5" />
        </linearGradient>
        <linearGradient id="lf-collar" gradientUnits="userSpaceOnUse" x1={-9} y1={0} x2={9} y2={0}>
          <stop offset={0} stopColor="#76592A" />
          <stop offset={0.35} stopColor="#F4DDA0" />
          <stop offset={1} stopColor="#2E2210" />
        </linearGradient>
        <linearGradient id="lf-badge" x1={0} y1={0} x2={0} y2={1}>
          <stop offset={0} stopColor="#F4DDA0" />
          <stop offset={1} stopColor="#76592A" />
        </linearGradient>
        <linearGradient id="lf-plate" x1={0} y1={0} x2={0.6} y2={1}>
          <stop offset={0} stopColor="#F4DDA0" />
          <stop offset={0.35} stopColor="#C9A35B" />
          <stop offset={0.75} stopColor="#76592A" />
          <stop offset={1} stopColor="#5A4320" />
        </linearGradient>
        <linearGradient id="lf-tappet" x1={0} y1={0} x2={1} y2={0}>
          <stop offset={0} stopColor="#3B4448" />
          <stop offset={0.3} stopColor="#E2E8EA" />
          <stop offset={0.55} stopColor="#8C989E" />
          <stop offset={1} stopColor="#2A3135" />
        </linearGradient>
        <linearGradient id="lf-bar" x1={0} y1={0} x2={0} y2={1}>
          <stop offset={0} stopColor="#3B4448" />
          <stop offset={0.3} stopColor="#E2E8EA" />
          <stop offset={0.55} stopColor="#8C989E" />
          <stop offset={1} stopColor="#2A3135" />
        </linearGradient>
        <linearGradient id="lf-dog" x1={0} y1={0} x2={0} y2={1}>
          <stop offset={0} stopColor="#F4DDA0" />
          <stop offset={0.5} stopColor="#C9A35B" />
          <stop offset={1} stopColor="#76592A" />
        </linearGradient>
        <linearGradient id="lf-quad" x1={0} y1={0} x2={0} y2={1}>
          <stop offset={0} stopColor="#27302C" />
          <stop offset={1} stopColor="#0D110F" />
        </linearGradient>
        <radialGradient id="lf-lamp" cx={0.52} cy={0.42} r={0.6}>
          <stop offset={0} stopColor="rgba(201,163,91,0.13)" />
          <stop offset={1} stopColor="rgba(201,163,91,0)" />
        </radialGradient>
        <filter id="lf-glow-red" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <clipPath id="lf-bed-clip">
          <rect x={BED.x + 1} y={BED.y + 1} width={BED.w - 2} height={BED.h - 2} rx={6} />
        </clipPath>
      </defs>

      <rect x={0} y={0} width={FRAME_VIEW.w} height={BED.y} fill="url(#lf-lamp)" />

      {/* the quadrant the levers stand in */}
      <rect x={QUAD.x} y={QUAD.y} width={QUAD.w} height={QUAD.h} rx={3} fill="url(#lf-quad)" />
      <rect x={QUAD.x + 4} y={QUAD.y} width={QUAD.w - 8} height={1.6} fill="rgba(201,163,91,0.75)" />
      {LEVERS.map((d) => (
        <rect key={d.leverId} x={LX(d.leverId) - 44} y={QUAD.y + 7} width={88} height={6} fill="#050706" />
      ))}

      {LEVERS.map((d) => (
        <LeverColumn
          key={d.leverId}
          descriptor={d}
          levers={levers}
          holding={locksHolding(d.leverId, levers, tappetBars)}
          refused={block !== null && block.leverId === d.leverId}
          jerk={jerk !== null && jerk.leverId === d.leverId ? jerk : null}
          delay={moveDelays[d.leverId] ?? 0}
          lockDelay={barDelay + 120}
          onToggle={onToggle}
        />
      ))}

      <LockingBed
        presetId={presetId}
        levers={levers}
        rows={rows}
        block={block}
        nonce={jerk?.nonce ?? 0}
        moveDelays={moveDelays}
        barDelay={barDelay}
        status={bedStatus}
      />
    </svg>
  );
}

interface LeverColumnProps {
  descriptor: LeverDescriptor;
  levers: FrameState['levers'];
  holding: readonly TappetBarState[];
  refused: boolean;
  jerk: LeverJerk | null;
  delay: number;
  lockDelay: number;
  onToggle: (leverId: LeverId) => void;
}

/** One lever with its quadrant slot, brass plate, lock disc and names — and the hit area that throws it. */
function LeverColumn({ descriptor: d, levers, holding, refused, jerk, delay, lockDelay, onToggle }: LeverColumnProps) {
  const id = d.leverId;
  const x = LX(id);
  const isReverse = levers[id] === 'REVERSE';
  const locked = holding.length > 0;
  const hint = locked ? 'Locked' : isReverse ? 'Put back' : 'Pull';
  const label = `Lever ${id}, ${d.name}, ${levers[id]}. ${
    locked ? `Locked by ${holding.map((bar) => bar.ruleId).join(' and ')}. ` : ''
  }Press to ${isReverse ? 'put it back to NORMAL' : 'pull it to REVERSE'}.`;

  const handleKey = (event: KeyboardEvent<SVGGElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onToggle(id);
    }
  };

  return (
    <g
      className={`lf-lever${locked ? ' is-locked' : ''}${isReverse ? ' is-reverse' : ''}`}
      role="button"
      tabIndex={0}
      aria-pressed={isReverse}
      aria-label={label}
      onClick={() => onToggle(id)}
      onKeyDown={handleKey}
    >
      <rect className="lf-hit" x={x - PITCH / 2 + 2} y={VIEW_TOP + 2} width={PITCH - 4} height={398 - VIEW_TOP} rx={10} />
      <rect className="lf-ring" x={x - PITCH / 2 + 4} y={VIEW_TOP + 4} width={PITCH - 8} height={394 - VIEW_TOP} rx={10} />
      <text className="svg-caps lf-hint" x={x} y={VIEW_TOP + 16} textAnchor="middle" fontSize={10.5}>
        {hint}
      </text>
      <g transform={`translate(${x} ${PIV_Y})`}>
        <g className="lf-arm" style={{ transform: leverTransform(isReverse), transitionDelay: `${delay}ms` }}>
          <g
            key={jerk !== null ? `jerk-${jerk.nonce}` : 'still'}
            className={jerk !== null ? `lf-jerk lf-jerk-${jerk.intent === 'PULL' ? 'pull' : 'release'}` : undefined}
          >
            <LeverArt leverId={id} paint={d.paint} />
          </g>
        </g>
      </g>

      <LeverPlate descriptor={d} locked={locked} refused={refused} live={isReverse} nonce={jerk?.nonce ?? 0} lockDelay={lockDelay} />
    </g>
  );
}

interface LeverPlateProps {
  descriptor: LeverDescriptor;
  locked: boolean;
  refused: boolean;
  live: boolean;
  nonce: number;
  lockDelay: number;
}

/** The engraved brass plate under a lever: its number and kind, the red lock disc, and the names beneath. */
function LeverPlate({ descriptor: d, locked, refused, live, nonce, lockDelay }: LeverPlateProps) {
  const x = LX(d.leverId);
  return (
    <>
      {refused && (
        <rect
          key={`refused-${nonce}`}
          className="lf-refused"
          x={x - PLATE.w / 2 - 4}
          y={PLATE.y - 4}
          width={PLATE.w + 8}
          height={PLATE.h + 8}
          rx={9}
        />
      )}
      <rect x={x - PLATE.w / 2} y={PLATE.y} width={PLATE.w} height={PLATE.h} rx={6} fill="url(#lf-plate)" />
      <rect x={x - PLATE.w / 2 + 3} y={PLATE.y + 3} width={PLATE.w - 6} height={PLATE.h - 6} rx={4} fill="none" stroke="rgba(46,34,16,0.55)" />
      <text className="svg-serif" x={x} y={PLATE.y + 34} textAnchor="middle" fontSize={29} fill="rgba(255,243,208,0.35)">
        {d.leverId}
      </text>
      <text className="svg-serif" x={x} y={PLATE.y + 33} textAnchor="middle" fontSize={29} fill="#2A1E0C">
        {d.leverId}
      </text>
      <text className="svg-caps" x={x} y={PLATE.y + PLATE.h - 6} textAnchor="middle" fontSize={7.5} fill="rgba(42,30,12,0.85)">
        {d.kind}
      </text>
      <g transform={`translate(${x + PLATE.w / 2 - 9} ${PLATE.y + 9})`}>
        <g className={locked ? 'lf-lockdisc is-on' : 'lf-lockdisc'} style={{ transitionDelay: locked ? `${lockDelay}ms` : '0ms' }}>
          <circle r={7.5} fill="var(--red)" />
          <rect x={-3.8} y={-1.2} width={7.6} height={2.4} fill="#FFF4EE" />
        </g>
      </g>
      <text className="svg-caps lf-name" x={x} y={PLATE.y + PLATE.h + 21} textAnchor="middle" fontSize={10.5}>
        {d.shortName}
      </text>
      {d.agent !== null && (
        <text className={`svg-caps lf-agent${live ? ' is-live' : ''}`} x={x} y={PLATE.y + PLATE.h + 37} textAnchor="middle" fontSize={10.5}>
          {d.agent}
        </text>
      )}
    </>
  );
}

interface LockingBedProps {
  presetId: FrameState['presetId'];
  levers: FrameState['levers'];
  rows: readonly BedRow[];
  block: { leverId: LeverId; ruleId: string } | null;
  nonce: number;
  moveDelays: Readonly<Partial<Record<LeverId, number>>>;
  barDelay: number;
  status: { text: string; tone: string };
}

/** The locking bed: tappets driven by the levers, one steel bar per EARS rule, brass dogs that seat in notches. */
function LockingBed({ presetId, levers, rows, block, nonce, moveDelays, barDelay, status }: LockingBedProps) {
  return (
    <>
      <text className="svg-caps" x={BED.x + 4} y={BED_STATUS_Y} fontSize={11} fill="var(--brass)">
        Locking bed
      </text>
      <text
        className="svg-mono"
        x={BED.x + 112}
        y={BED_STATUS_Y}
        fontSize={11}
        fill={presetId === 'STANDARD_SAFE' ? 'var(--mute)' : 'var(--red)'}
      >
        {presetId}
      </text>
      <text className="svg-mono lf-bed-status" x={BED.x + BED.w - 4} y={BED_STATUS_Y} fontSize={11} textAnchor="end" fill={status.tone}>
        {status.text}
      </text>

      <rect x={BED.x} y={BED.y} width={BED.w} height={BED.h} rx={6} fill="#0E1311" />
      <rect
        x={BED.x + 0.5}
        y={BED.y + 0.5}
        width={BED.w - 1}
        height={BED.h - 1}
        rx={6}
        fill="none"
        stroke="rgba(140,152,158,0.2)"
      />
      {[
        [BED.x + 12, BED.y + 12],
        [BED.x + BED.w - 12, BED.y + 12],
        [BED.x + 12, BED.y + BED.h - 12],
        [BED.x + BED.w - 12, BED.y + BED.h - 12],
      ].map(([rx, ry]) => (
        <g key={`${rx}-${ry}`}>
          <circle cx={rx} cy={ry} r={3.2} fill="var(--steel-lo)" />
          <circle cx={rx - 0.8} cy={ry - 0.8} r={1.2} fill="var(--steel-hi)" />
        </g>
      ))}

      <g clipPath="url(#lf-bed-clip)">
        {/* channels the bars run in */}
        {rows.map((row, r) => (
          <rect key={row.ruleId} x={BAR_X0 - 6} y={BED_ROW_Y(r) - 5.5} width={BED.x + BED.w - BAR_X0 - 10} height={11} fill="#080B0A" />
        ))}

        {LEVERS.map((d) => {
          const id = d.leverId;
          const isReverse = levers[id] === 'REVERSE';
          const notches = rows.flatMap((row, r) =>
            row.dogs
              .filter((dog) => dog.leverId === id)
              .flatMap((dog) =>
                dog.heldStates.map((held) => ({
                  key: `${row.ruleId}-${held}`,
                  y: BED_ROW_Y(r) - (held === 'REVERSE' ? TAPPET.drop : 0),
                  side: dog.side,
                })),
              ),
          );
          return (
            <g
              key={id}
              className="lf-tappet"
              style={{
                transform: `translateY(${isReverse ? TAPPET.drop : 0}px)`,
                transitionDelay: `${(moveDelays[id] ?? 0) + 60}ms`,
              }}
            >
              <rect x={LX(id) - TAPPET.w / 2} y={TAPPET.top} width={TAPPET.w} height={TAPPET.h} fill="url(#lf-tappet)" />
              {notches.map((notch) => (
                <rect
                  key={notch.key}
                  x={notch.side === 'left' ? LX(id) - TAPPET.w / 2 - 0.5 : LX(id) + 2}
                  y={notch.y - 6}
                  width={9.5}
                  height={12}
                  rx={1.5}
                  fill="#1C2326"
                  opacity={0.9}
                />
              ))}
            </g>
          );
        })}

        {rows.map((row, r) => (
          <BedBar
            key={row.ruleId}
            row={row}
            y={BED_ROW_Y(r)}
            hitLever={block !== null && block.ruleId === row.ruleId ? block.leverId : null}
            barDelay={barDelay}
          />
        ))}
      </g>

      {rows.map((row, r) => {
        const hitRow = block !== null && block.ruleId === row.ruleId;
        const anySeated = row.dogs.some((dog) => dog.seated);
        const fill = row.missing || hitRow ? 'var(--red)' : row.weakened ? 'var(--amber)' : anySeated ? 'var(--brass)' : 'var(--mute)';
        const y = BED_ROW_Y(r);
        return (
          <g key={row.ruleId}>
            <text className="svg-mono" x={BED.x + 11} y={y + 3.6} fontSize={10.5} fill={fill}>
              {shortRuleId(row.ruleId)}
            </text>
            {row.missing && <line x1={BED.x + 9} y1={y} x2={BED.x + 52} y2={y} stroke="var(--red)" strokeWidth={1.1} />}
          </g>
        );
      })}

      {block !== null && <BedCallout key={`callout-${nonce}`} rows={rows} block={block} />}
    </>
  );
}

interface BedBarProps {
  row: BedRow;
  y: number;
  hitLever: LeverId | null;
  barDelay: number;
}

function BedBar({ row, y, hitLever, barDelay }: BedBarProps) {
  const x1 = Math.max(...row.dogs.map((dog) => LX(dog.leverId) + (dog.side === 'right' ? 42 : 34)));
  return (
    <g
      className={`lf-bar${row.missing ? ' is-missing' : ''}${hitLever !== null ? ' is-hit' : ''}`}
      style={{ transform: `translateX(${row.offset * DOG.slide}px)`, transitionDelay: `${barDelay}ms` }}
    >
      {row.missing ? (
        <rect x={BAR_X0} y={y - 3} width={x1 - BAR_X0} height={6} fill="none" stroke="rgba(232,80,63,0.45)" strokeDasharray="4 4" />
      ) : (
        <>
          <rect x={BAR_X0} y={y - 3} width={x1 - BAR_X0} height={6} fill="url(#lf-bar)" />
          <rect x={BAR_X0} y={y + 3} width={x1 - BAR_X0} height={1.5} fill="rgba(0,0,0,0.35)" />
        </>
      )}
      {row.dogs.map((dog) => {
        const d = dogPath(dogBaseX(dog), y, dog.side);
        if (row.missing) {
          return <path key={dog.leverId} className="lf-ghost" d={d} fill="none" stroke="var(--red)" strokeWidth={1.2} strokeDasharray="3 2.5" />;
        }
        const hit = hitLever === dog.leverId;
        return (
          <g key={dog.leverId} className={`lf-dog${dog.seated ? ' is-seated' : ''}${hit ? ' is-hit' : ''}`}>
            <path d={d} fill="url(#lf-dog)" stroke="rgba(30,20,8,0.6)" strokeWidth={0.8} />
            {hit && <path d={d} className="lf-dog-hit" fill="var(--red)" filter="url(#lf-glow-red)" />}
          </g>
        );
      })}
    </g>
  );
}

/** The refusal, named at the dog that made it. */
function BedCallout({ rows, block }: { rows: readonly BedRow[]; block: { leverId: LeverId; ruleId: string } }) {
  const r = rows.findIndex((row) => row.ruleId === block.ruleId);
  const dog = r >= 0 ? rows[r].dogs.find((d) => d.leverId === block.leverId) : undefined;
  if (r < 0 || dog === undefined) {
    return null;
  }
  const cx = LX(dog.leverId) + (dog.side === 'left' ? -9 : 9);
  const cy = BED_ROW_Y(r) - 17;
  const w = block.ruleId.length * 6.6 + 16;
  return (
    <g transform={`translate(${cx} ${cy})`}>
      <g className="lf-callout">
        <rect x={-w / 2} y={-8} width={w} height={15} rx={7.5} fill="var(--red)" />
        <path d="M-4 7 L0 11 L4 7 Z" fill="var(--red)" />
        <text className="svg-mono" x={0} y={3.4} textAnchor="middle" fontSize={10} fill="#FFF4EE">
          {block.ruleId}
        </text>
      </g>
    </g>
  );
}
