import {
  buildRoundHandicapContext,
  getCompetitionStrokesForHole,
  getNetHoleScore,
} from '@/domain/calculators/handicap';
import type { MatchSegmentResult } from '@/domain/results';
import type {
  HoleResult,
  NassauSegmentConfig,
  Round,
  ScoringMode,
  Side,
  SideId,
} from '@/domain/round';

function getSideStrokeTotal(
  side: Side,
  hole: HoleResult,
  scoringMode: ScoringMode,
  handicapContext: ReturnType<typeof buildRoundHandicapContext> | null,
): number | null {
  let total = 0;

  for (const playerId of side.playerIds) {
    const strokes = hole.playerResults[playerId]?.strokes;

    if (typeof strokes !== 'number') {
      return null;
    }

    total +=
      scoringMode === 'net' && handicapContext?.eligible
        ? getNetHoleScore(
            strokes,
            getCompetitionStrokesForHole(
              handicapContext,
              playerId,
              hole.holeNumber,
            ),
          )
        : strokes;
  }

  return total;
}

function formatMatchStatus(margin: number, holesRemaining: number): string {
  if (margin === 0) {
    return holesRemaining === 0 ? 'Halved' : 'All square';
  }

  const absMargin = Math.abs(margin);
  const leaderPrefix = margin > 0 ? 'Side A' : 'Side B';

  if (holesRemaining === 0 || absMargin > holesRemaining) {
    return `${leaderPrefix} wins ${absMargin}&${holesRemaining}`;
  }

  return `${leaderPrefix} ${absMargin} up`;
}

export function calculateMatchSegment(
  round: Round,
  segment: NassauSegmentConfig,
  scoringMode: ScoringMode = 'gross',
): MatchSegmentResult {
  const [sideA, sideB] = round.sides;
  const handicapContext =
    scoringMode === 'net' ? buildRoundHandicapContext(round) : null;
  const relevantHoles = round.holes.filter(
    (hole) =>
      hole.holeNumber >= segment.startHole && hole.holeNumber <= segment.endHole,
  );

  let margin = 0;
  const holeStates = [];
  let completedHoles = 0;

  for (const hole of relevantHoles) {
    const sideATotal = getSideStrokeTotal(
      sideA,
      hole,
      scoringMode,
      handicapContext,
    );
    const sideBTotal = getSideStrokeTotal(
      sideB,
      hole,
      scoringMode,
      handicapContext,
    );

    if (sideATotal === null || sideBTotal === null) {
      continue;
    }

    completedHoles += 1;

    let winnerSideId: SideId | null = null;

    if (sideATotal < sideBTotal) {
      margin += 1;
      winnerSideId = sideA.id;
    } else if (sideBTotal < sideATotal) {
      margin -= 1;
      winnerSideId = sideB.id;
    }

    const holesRemaining = segment.endHole - hole.holeNumber;

    holeStates.push({
      holeNumber: hole.holeNumber,
      winnerSideId,
      marginAfterHole: margin,
      statusText: formatMatchStatus(margin, holesRemaining),
    });
  }

  const totalSegmentHoles = segment.endHole - segment.startHole + 1;
  const holesRemaining = totalSegmentHoles - completedHoles;
  const currentLeaderSideId =
    margin === 0 ? null : margin > 0 ? sideA.id : sideB.id;
  const winnerSideId =
    holesRemaining === 0 || Math.abs(margin) > holesRemaining
      ? currentLeaderSideId
      : null;

  return {
    segmentId: segment.id,
    label: segment.label,
    startHole: segment.startHole,
    endHole: segment.endHole,
    completedHoles,
    holesRemaining,
    currentLeaderSideId,
    currentMargin: margin,
    statusText: formatMatchStatus(margin, holesRemaining),
    winnerSideId,
    holeStates,
  };
}
