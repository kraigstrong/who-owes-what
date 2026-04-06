import type { PlayerHoleResult, PlayerId, Round } from '@/domain/round';

function getMaxPutts(strokes: number | undefined): number | undefined {
  return typeof strokes === 'number' ? Math.max(0, strokes - 1) : undefined;
}

export function applyPlayerHoleValue(
  playerResult: PlayerHoleResult,
  field: keyof PlayerHoleResult,
  value: number | boolean | undefined,
): PlayerHoleResult {
  const nextResult: PlayerHoleResult = {
    ...playerResult,
    [field]: value,
  };

  if (field === 'strokes' && typeof value === 'number' && typeof nextResult.putts === 'number') {
    nextResult.putts = Math.min(nextResult.putts, Math.max(0, value - 1));
  }

  if (field === 'putts' && typeof value === 'number') {
    const maxPutts = getMaxPutts(nextResult.strokes);
    nextResult.putts = maxPutts === undefined ? value : Math.min(value, maxPutts);
  }

  return nextResult;
}

export function seedHolePlayerMetric(
  round: Round,
  holeNumber: number,
  field: keyof PlayerHoleResult,
  defaultValue: number,
): Round {
  return {
    ...round,
    holes: round.holes.map((hole) => {
      if (hole.holeNumber !== holeNumber) {
        return hole;
      }

      return {
        ...hole,
        playerResults: Object.fromEntries(
          Object.entries(hole.playerResults).map(([playerId, playerResult]) => [
            playerId,
            typeof playerResult[field] === 'number'
              ? playerResult
              : {
                  ...playerResult,
                  [field]: defaultValue,
                },
          ]),
        ) as typeof hole.playerResults,
      };
    }),
  };
}

export function seedHoleGamePoints(
  round: Round,
  holeNumber: number,
  gameId: string,
  playerIds: PlayerId[],
  defaultValue: number,
): Round {
  return {
    ...round,
    holes: round.holes.map((hole) => {
      if (hole.holeNumber !== holeNumber) {
        return hole;
      }

      const currentGamePoints = hole.manualPoints?.[gameId] ?? {};

      return {
        ...hole,
        manualPoints: {
          ...hole.manualPoints,
          [gameId]: Object.fromEntries(
            playerIds.map((playerId) => [
              playerId,
              typeof currentGamePoints[playerId] === 'number'
                ? currentGamePoints[playerId]
                : defaultValue,
            ]),
          ) as Record<PlayerId, number>,
        },
      };
    }),
  };
}
