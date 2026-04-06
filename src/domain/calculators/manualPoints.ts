import type { WolfResult } from '@/domain/results';
import type { HoleResult, Player, PlayerId, Round, WolfGameConfig } from '@/domain/round';
import { rankPlayerTotals } from '@/domain/calculators/stats';

export function getWolfPlayerIdForHole(
  rotationOrderPlayerIds: PlayerId[],
  holeNumber: number,
): PlayerId | null {
  if (rotationOrderPlayerIds.length === 0) {
    return null;
  }

  return rotationOrderPlayerIds[(holeNumber - 1) % rotationOrderPlayerIds.length] ?? null;
}

export function getHoleManualPoints(
  hole: HoleResult,
  gameId: string,
  playerId: PlayerId,
): number {
  return hole.manualPoints?.[gameId]?.[playerId] ?? 0;
}

export function getWolfPointsForHole(
  round: Round,
  gameId: string,
  holeNumber: number,
): Record<PlayerId, number> {
  const hole = round.holes.find((entry) => entry.holeNumber === holeNumber);

  return Object.fromEntries(
    round.players.map((player) => [player.id, hole ? getHoleManualPoints(hole, gameId, player.id) : 0]),
  ) as Record<PlayerId, number>;
}

export function calculateManualPointsTotals(
  players: Player[],
  holes: HoleResult[],
  gameId: string,
) {
  const totalsByPlayerId = Object.fromEntries(players.map((player) => [player.id, 0]));

  for (const hole of holes) {
    for (const player of players) {
      totalsByPlayerId[player.id] += getHoleManualPoints(hole, gameId, player.id);
    }
  }

  return rankPlayerTotals(players, totalsByPlayerId);
}

function formatWolfLeaderText(totals: ReturnType<typeof calculateManualPointsTotals>): string {
  if (totals.length === 0) {
    return 'No Wolf scoring yet';
  }

  const leaders = totals.filter((entry) => entry.isLeader);
  const leaderTotal = leaders[0]?.total ?? 0;

  if (leaders.length === totals.length) {
    return 'Wolf tied';
  }

  if (leaders.length > 1) {
    return `${leaders.map((entry) => entry.label).join(', ')} tied at ${leaderTotal}`;
  }

  return `${leaders[0]?.label ?? 'No one'} leads with ${leaderTotal}`;
}

export function deriveWolfResult(round: Round, game: WolfGameConfig): WolfResult {
  const totals = calculateManualPointsTotals(round.players, round.holes, game.id);

  return {
    kind: 'wolf',
    gameId: game.id,
    title: game.title,
    totals,
    leaderText: formatWolfLeaderText(totals),
    holeStates: round.holes.map((hole) => {
      const wolfPlayerId =
        getWolfPlayerIdForHole(game.rotationOrderPlayerIds, hole.holeNumber) ??
        round.players[0]?.id ??
        '';
      const wolfLabel =
        round.players.find((player) => player.id === wolfPlayerId)?.name ?? 'Unknown';

      return {
        holeNumber: hole.holeNumber,
        wolfPlayerId,
        wolfLabel,
        pointsByPlayerId: Object.fromEntries(
          round.players.map((player) => [player.id, getHoleManualPoints(hole, game.id, player.id)]),
        ) as Record<PlayerId, number>,
      };
    }),
  };
}
