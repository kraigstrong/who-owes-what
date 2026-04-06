import {
  findTeeById,
  selectDefaultTee,
  type SelectedCourse,
  type TeeOption,
} from '@/domain/course';
import type { Round, SetupDraft } from '@/domain/round';

export interface NetScoringAvailability {
  eligible: boolean;
  reason?: string;
}

export interface PlayerHandicapContext {
  playerId: string;
  teeId: string;
  tee: TeeOption;
  handicapIndex: number;
  courseHandicap: number;
  playingHandicap: number;
  competitionHandicap: number;
  holeStrokesByHole: Record<number, number>;
}

export interface RoundHandicapContext {
  eligible: boolean;
  playerContexts: Record<string, PlayerHandicapContext>;
  reason?: string;
}

function roundHalfAwayFromZero(value: number): number {
  return value >= 0 ? Math.floor(value + 0.5) : Math.ceil(value - 0.5);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function isTeeEligibleForNet(tee: TeeOption | undefined): boolean {
  if (!tee) {
    return false;
  }

  if (
    !isFiniteNumber(tee.slope) ||
    !isFiniteNumber(tee.rating) ||
    !isFiniteNumber(tee.parTotal)
  ) {
    return false;
  }

  return tee.holes.length > 0 && tee.holes.every((hole) => isFiniteNumber(hole.strokeIndex));
}

function getDraftPlayerTee(course: SelectedCourse, draft: SetupDraft, index: number) {
  const explicitTeeId = draft.playerTeeIds[index];
  const defaultTee = selectDefaultTee(course);

  return findTeeById(course, explicitTeeId) ?? defaultTee;
}

export function getSetupNetScoringAvailability(
  draft: SetupDraft,
): NetScoringAvailability {
  const playerIndexes = Array.from({ length: draft.playerCount }, (_, index) => index);

  if (!draft.selectedCourse) {
    return {
      eligible: false,
      reason: 'Select a course and tees for every player to use net scoring.',
    };
  }

  for (const index of playerIndexes) {
    const rawHandicap = draft.playerHandicaps[index]?.trim() ?? '';
    const handicapIndex = Number.parseFloat(rawHandicap);

    if (!rawHandicap || !Number.isFinite(handicapIndex)) {
      return {
        eligible: false,
        reason: 'Enter a handicap for every player to use net scoring.',
      };
    }

    const tee = getDraftPlayerTee(draft.selectedCourse, draft, index);

    if (!isTeeEligibleForNet(tee)) {
      return {
        eligible: false,
        reason: 'Each player needs a tee with rating, slope, par, and hole indexes.',
      };
    }
  }

  return { eligible: true };
}

export function calculateCourseHandicap(
  handicapIndex: number,
  tee: TeeOption,
): number {
  return (handicapIndex * (tee.slope ?? 0)) / 113 + ((tee.rating ?? 0) - (tee.parTotal ?? 0));
}

export function calculatePlayingHandicap(
  courseHandicap: number,
  allowance = 1,
): number {
  return roundHalfAwayFromZero(courseHandicap * allowance);
}

export function getHoleHandicapStrokes(
  playingHandicap: number,
  strokeIndex: number | undefined,
): number {
  if (!isFiniteNumber(strokeIndex) || playingHandicap === 0) {
    return 0;
  }

  if (playingHandicap > 0) {
    const fullRounds = Math.floor(playingHandicap / 18);
    const remainder = playingHandicap % 18;

    return fullRounds + (strokeIndex <= remainder ? 1 : 0);
  }

  const absoluteHandicap = Math.abs(playingHandicap);
  const fullRounds = Math.floor(absoluteHandicap / 18);
  const remainder = absoluteHandicap % 18;
  const extraGiveBack =
    remainder > 0 && strokeIndex >= 19 - remainder ? 1 : 0;
  const value = -(fullRounds + extraGiveBack);

  return value === 0 ? 0 : value;
}

export function buildRoundHandicapContext(round: Round): RoundHandicapContext {
  if (round.scoringMode !== 'net') {
    return {
      eligible: false,
      playerContexts: {},
      reason: 'Round is using gross scoring.',
    };
  }

  if (!round.course) {
    return {
      eligible: false,
      playerContexts: {},
      reason: 'Round is missing course data.',
    };
  }

  const course = round.course;
  const playerEntries = round.players.map((player) => {
    if (!isFiniteNumber(player.handicap)) {
      return null;
    }

    const tee =
      findTeeById(course, round.playerTeeIds[player.id]) ??
      selectDefaultTee(course);

    if (!tee) {
      return null;
    }

    if (!isTeeEligibleForNet(tee)) {
      return null;
    }

    const courseHandicap = calculateCourseHandicap(player.handicap, tee);
    const playingHandicap = calculatePlayingHandicap(courseHandicap, 1);

    return {
      playerId: player.id,
      teeId: tee.id,
      tee,
      handicapIndex: player.handicap,
      courseHandicap,
      playingHandicap,
    };
  });

  if (playerEntries.some((entry) => entry === null)) {
    return {
      eligible: false,
      playerContexts: {},
      reason: 'Round is missing handicap or tee data needed for net scoring.',
    };
  }

  const normalizedEntries = playerEntries as Array<
    NonNullable<(typeof playerEntries)[number]>
  >;
  const lowestPlayingHandicap = Math.min(
    ...normalizedEntries.map((entry) => entry.playingHandicap),
  );

  const playerContexts = Object.fromEntries(
    normalizedEntries.map((entry) => {
      const competitionHandicap = entry.playingHandicap - lowestPlayingHandicap;
      const holeStrokesByHole = Object.fromEntries(
        entry.tee.holes.map((hole) => [
          hole.holeNumber,
          getHoleHandicapStrokes(competitionHandicap, hole.strokeIndex),
        ]),
      ) as Record<number, number>;

      return [
        entry.playerId,
        {
          ...entry,
          competitionHandicap,
          holeStrokesByHole,
        } satisfies PlayerHandicapContext,
      ];
    }),
  ) as Record<string, PlayerHandicapContext>;

  return {
    eligible: true,
    playerContexts,
  };
}

export function getCompetitionStrokesForHole(
  context: RoundHandicapContext,
  playerId: string,
  holeNumber: number,
): number {
  return context.playerContexts[playerId]?.holeStrokesByHole[holeNumber] ?? 0;
}

export function getNetHoleScore(
  grossScore: number,
  competitionHoleStrokes: number,
): number {
  return grossScore - competitionHoleStrokes;
}
