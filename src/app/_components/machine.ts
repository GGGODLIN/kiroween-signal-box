import {
  getInterlockPreset,
  type AgentTrainId,
  type FrameState,
  type LeverId,
  type LeverState,
  type PresetId,
} from '../../lib/interlocking.ts';
import type { TappetBarState } from '../../lib/signal-box-store.ts';

export const LEVER_IDS: readonly LeverId[] = [1, 2, 3, 4, 5, 6, 7, 8];

export type LeverKind = 'SIGNAL' | 'POINT' | 'LOCK' | 'CLEARANCE';
export type LeverPaint = 'red' | 'black' | 'blue' | 'yellow' | 'brown';

export interface LeverDescriptor {
  leverId: LeverId;
  name: string;
  shortName: string;
  kind: LeverKind;
  // British lever-colour convention: red stop signals, yellow distants, black points, blue facing point locks
  paint: LeverPaint;
  agent: AgentTrainId | null;
}

export const LEVERS: readonly LeverDescriptor[] = [
  { leverId: 1, name: 'North Up Home Signal', shortName: 'North home', kind: 'SIGNAL', paint: 'red', agent: 'Builder' },
  { leverId: 2, name: 'Junction Crossover Points', shortName: 'Crossover', kind: 'POINT', paint: 'black', agent: null },
  { leverId: 3, name: 'Facing Point Lock', shortName: 'Facing lock', kind: 'LOCK', paint: 'blue', agent: null },
  { leverId: 4, name: 'South Branch Home Signal', shortName: 'South home', kind: 'SIGNAL', paint: 'red', agent: 'Migrator' },
  { leverId: 5, name: 'Bridge Distant Signal', shortName: 'Bridge distant', kind: 'SIGNAL', paint: 'yellow', agent: 'Deployer' },
  { leverId: 6, name: 'Audit Siding Dwarf Signal', shortName: 'Audit dwarf', kind: 'SIGNAL', paint: 'red', agent: 'Verifier' },
  { leverId: 7, name: 'Bridge Token Clearance', shortName: 'Bridge token', kind: 'CLEARANCE', paint: 'brown', agent: null },
  { leverId: 8, name: 'Maintenance Isolation Lock', shortName: 'Isolator', kind: 'CLEARANCE', paint: 'brown', agent: null },
];

export function leverDescriptor(leverId: LeverId): LeverDescriptor {
  return LEVERS[leverId - 1];
}

// Titles mirror the headings in .kiro/specs/signal-box/requirements.md so the UI cites the spec, not a paraphrase of it.
export const RULE_TITLES: Readonly<Record<string, string>> = {
  'EARS-ILK-01': 'Converging mainline mutual exclusion',
  'EARS-ILK-02': 'Facing point lock backlocking under clear signals',
  'EARS-ILK-03': 'Crossover point immobilization',
  'EARS-ILK-04': 'North Up Home #1 clearance prerequisites',
  'EARS-ILK-05': 'South Branch Home #4 clearance prerequisites',
  'EARS-ILK-06': 'Bridge Distant #5 and token backlock',
  'EARS-ILK-07': 'Audit Dwarf #6 and isolation backlock',
  'EARS-ILK-08': 'Maintenance isolation lock prerequisites',
  'EARS-VAL-01': 'Deterministic input validation',
};

export const SPEC_SOURCE = '.kiro/specs/signal-box/requirements.md';

export const shortRuleId = (ruleId: string): string => ruleId.replace('EARS-', '');

export const actionCode = (leverId: LeverId, intent: 'PULL' | 'RELEASE'): string =>
  `${intent === 'PULL' ? 'P' : 'R'}${leverId}`;

const heldStateFor = (intent: 'PULL' | 'RELEASE'): LeverState =>
  intent === 'PULL' ? 'NORMAL' : 'REVERSE';

/** Rules that would refuse this lever's next move right now — exactly the rules applyLeverAction would consult. */
export function locksHolding(
  leverId: LeverId,
  levers: Record<LeverId, LeverState>,
  bars: readonly TappetBarState[],
): TappetBarState[] {
  const intent = levers[leverId] === 'NORMAL' ? 'PULL' : 'RELEASE';
  return bars.filter(
    (bar) => bar.appliesToLever === leverId && bar.targetIntent === intent && bar.engaged,
  );
}

export function lockedLevers(
  levers: Record<LeverId, LeverState>,
  bars: readonly TappetBarState[],
): LeverId[] {
  return LEVER_IDS.filter((id) => locksHolding(id, levers, bars).length > 0);
}

// ─────────────────────────────── locking-bed model ───────────────────────────────

export interface BedDog {
  leverId: LeverId;
  side: 'left' | 'right';
  heldStates: LeverState[];
  seated: boolean;
}

export interface BedRow {
  ruleId: string;
  dogs: BedDog[];
  missing: boolean;
  weakened: boolean;
  offset: -1 | 0 | 1;
}

const STANDARD_RULES = getInterlockPreset('STANDARD_SAFE');

/**
 * One steel bar per EARS rule, built from the STANDARD_SAFE table so a rule the cursed table drops still has a
 * place in the bed — it shows as an empty dog instead of silently vanishing.
 */
export function buildBedRows(
  presetId: PresetId,
  levers: Record<LeverId, LeverState>,
  bars: readonly TappetBarState[],
): BedRow[] {
  const currentRules = getInterlockPreset(presetId);
  const ruleIds = [...new Set(STANDARD_RULES.map((rule) => rule.ruleId))];

  return ruleIds.map((ruleId) => {
    const standardOfRule = STANDARD_RULES.filter((rule) => rule.ruleId === ruleId);
    const currentOfRule = currentRules.filter((rule) => rule.ruleId === ruleId);
    const targets = [...new Set(standardOfRule.map((rule) => rule.appliesToLever))];

    const dogs: BedDog[] = targets.map((leverId, index) => {
      const heldStates = standardOfRule
        .filter((rule) => rule.appliesToLever === leverId)
        .map((rule) => heldStateFor(rule.targetIntent));
      const seated = bars.some(
        (bar) =>
          bar.ruleId === ruleId &&
          bar.appliesToLever === leverId &&
          bar.engaged &&
          levers[leverId] === heldStateFor(bar.targetIntent),
      );
      // a second dog on the same bar faces the other way: it seats when the bar runs back
      return { leverId, side: index === 0 ? 'left' : 'right', heldStates, seated };
    });

    const weakened =
      currentOfRule.length > 0 &&
      currentOfRule.some(
        (rule, i) => rule.earsClause !== standardOfRule[i]?.earsClause,
      );
    const offset = dogs[0]?.seated ? 1 : dogs[1]?.seated ? -1 : 0;

    return {
      ruleId,
      dogs,
      missing: currentOfRule.length === 0,
      weakened,
      offset,
    };
  });
}

export function missingRuleIds(presetId: PresetId): string[] {
  const current = new Set(getInterlockPreset(presetId).map((rule) => rule.ruleId));
  return [...new Set(STANDARD_RULES.map((rule) => rule.ruleId))].filter((id) => !current.has(id));
}

export function weakenedRuleIds(presetId: PresetId): string[] {
  const current = getInterlockPreset(presetId);
  return [...new Set(STANDARD_RULES.map((rule) => rule.ruleId))].filter((ruleId) => {
    const std = STANDARD_RULES.filter((rule) => rule.ruleId === ruleId);
    const cur = current.filter((rule) => rule.ruleId === ruleId);
    return cur.length > 0 && cur.some((rule, i) => rule.earsClause !== std[i]?.earsClause);
  });
}

/** The lever and rule of the most recent refused move, so the bed can light the exact dog that held it. */
export function lastBlock(frame: FrameState): { leverId: LeverId; ruleId: string } | null {
  if (frame.lastOutcome !== 'BLOCKED_BY_INTERLOCK' || frame.blockingRuleId === null) {
    return null;
  }
  const last = frame.stepHistory[frame.stepHistory.length - 1];
  if (!last) {
    return null;
  }
  return { leverId: last.action.leverId, ruleId: frame.blockingRuleId };
}

export function blockOccupancy(frame: FrameState): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const route of frame.activeRoutes) {
    for (const block of route.occupiedBlocks) {
      counts[block] = (counts[block] ?? 0) + 1;
    }
  }
  return counts;
}

// ─────────────────────────────── frame geometry (SVG user units) ───────────────────────────────

export const FRAME_VIEW = { w: 1000, h: 600 } as const;
export const PITCH = 104;
export const LX = (leverId: LeverId): number => 156 + (leverId - 1) * PITCH;
export const PIV_Y = 262;
export const LEVER_LEN = 224;
export const ANG_N = -0.12;
export const ANG_R = 0.12;
// a pulled lever comes toward the signalman, so its top drops as it foreshortens
export const FORE = 0.15;
export const QUAD = { x: LX(1) - 52, y: PIV_Y, w: LX(8) - LX(1) + 104, h: 20 } as const;
export const PLATE = { y: 300, w: 76, h: 50 } as const;
export const BED = { x: 40, y: 432, w: 920, h: 164 } as const;
export const BED_ROW_Y = (row: number): number => 457 + row * 17;
export const TAPPET = { w: 22, top: 440, h: 150, drop: 15 } as const;
export const DOG = { w: 14, h: 11, slide: 12 } as const;
export const BAR_X0 = 108;
