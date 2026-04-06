import type { DerivedRoundState } from '@/domain/results';
import type { MatchPlayResult, NassauResult, WolfResult } from '@/domain/results';
import type { ContestType, Round } from '@/domain/round';
import { calculateMatchSegment } from '@/domain/calculators/matchSegments';
import { deriveWolfResult } from '@/domain/calculators/manualPoints';
import { calculateContestTallies } from '@/domain/calculators/stats';
import { getCommittedHoles } from '@/domain/roundProgress';
import { getRoundSideLabel } from '@/domain/sideLabels';

function getScoringTitle(title: string, round: Round): string {
  return round.scoringMode === 'net' ? `${title} (Net)` : title;
}

function buildSettlementLines(
  round: Round,
  derived: Omit<DerivedRoundState, 'settlementLines'>,
): string[] {
  const lines: string[] = [];

  for (const game of derived.games) {
    if (game.kind === 'match-play') {
      lines.push(`${game.title}: ${game.segment.statusText}`);
    }

    if (game.kind === 'nassau') {
      for (const segment of game.segments) {
        lines.push(`${game.title} ${segment.label}: ${segment.statusText}`);
      }
    }

    if (game.kind === 'wolf') {
      lines.push(`${game.title}: ${game.leaderText}`);
    }
  }

  for (const contest of derived.contests) {
    lines.push(`${contest.title}: ${contest.leaderText}`);
  }

  return lines;
}

export function deriveRoundState(round: Round): DerivedRoundState {
  const scoringRound = {
    ...round,
    holes: getCommittedHoles(round),
  };
  const games = round.activeGames.reduce<Array<MatchPlayResult | NassauResult | WolfResult>>(
    (accumulator, game) => {
    if (game.type === 'match-play') {
      const segment = calculateMatchSegment(scoringRound, {
        id: game.id,
        label: game.title,
        startHole: 1,
        endHole: round.holeCount,
        kind: 'base',
      }, round.scoringMode);

      accumulator.push({
          kind: 'match-play' as const,
          gameId: game.id,
          title: getScoringTitle(game.title, round),
          segment: {
            ...segment,
            statusText:
              segment.currentLeaderSideId === null
                ? segment.statusText
                : segment.statusText.replace(
                    segment.currentLeaderSideId === round.sides[0]?.id
                      ? 'Side A'
                      : 'Side B',
                    getRoundSideLabel(round, segment.currentLeaderSideId),
                  ),
          },
        });

      return accumulator;
    }

    if (game.type === 'nassau') {
      accumulator.push({
          kind: 'nassau' as const,
          gameId: game.id,
          title: getScoringTitle(game.title, round),
          segments: game.segments.map((segment) => {
            const result = calculateMatchSegment(scoringRound, segment, round.scoringMode);

            return {
              ...result,
              statusText:
                result.currentLeaderSideId === null
                  ? result.statusText
                  : result.statusText.replace(
                      result.currentLeaderSideId === round.sides[0]?.id
                        ? 'Side A'
                        : 'Side B',
                      getRoundSideLabel(round, result.currentLeaderSideId),
                    ),
            };
          }),
        });
    }

    if (game.type === 'wolf') {
      accumulator.push(deriveWolfResult(scoringRound, game));
    }

      return accumulator;
    },
    [],
  );

  const contests = round.activeContests.map((contestType: ContestType) =>
    calculateContestTallies(round.players, scoringRound.holes, contestType),
  );

  const settlementLines = buildSettlementLines(round, { games, contests });

  return {
    games,
    contests,
    settlementLines,
  };
}
