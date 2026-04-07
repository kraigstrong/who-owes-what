import { formatLeaderText, rankPlayerTotals } from '@/domain/calculators/stats';
import type { FirGirResult } from '@/domain/results';
import type { FirGirGameConfig, PlayerHoleResult, Round } from '@/domain/round';

export function getFirGirHolePoints(playerResult: PlayerHoleResult): number {
  const basePoints = playerResult.fir && playerResult.gir
    ? 5
    : playerResult.fir || playerResult.gir
      ? 4
      : 0;
  const putts = typeof playerResult.putts === 'number' ? playerResult.putts : 0;

  return Math.max(0, basePoints - putts);
}

export function deriveFirGirResult(round: Round, game: FirGirGameConfig): FirGirResult {
  const totalsByPlayerId = Object.fromEntries(round.players.map((player) => [player.id, 0]));
  const holeStates = round.holes.map((hole) => {
    const pointsByPlayerId = Object.fromEntries(
      round.players.map((player) => {
        const points = getFirGirHolePoints(hole.playerResults[player.id] ?? {});
        totalsByPlayerId[player.id] += points;

        return [player.id, points];
      }),
    ) as Record<string, number>;

    return {
      holeNumber: hole.holeNumber,
      pointsByPlayerId,
    };
  });

  const totals = rankPlayerTotals(round.players, totalsByPlayerId);

  return {
    kind: 'fir-gir',
    gameId: game.id,
    title: game.title,
    totals,
    leaderText: formatLeaderText(totals, game.title),
    holeStates,
  };
}
