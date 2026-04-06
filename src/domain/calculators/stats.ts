import type { ContestResult, PlayerTally } from '@/domain/results';
import type { ContestType, HoleResult, Player } from '@/domain/round';

export function rankPlayerTotals(
  players: Player[],
  totalsByPlayerId: Record<string, number>,
): PlayerTally[] {
  const ranked = players
    .map((player) => ({
      playerId: player.id,
      label: player.name,
      total: totalsByPlayerId[player.id] ?? 0,
    }))
    .sort((left, right) => right.total - left.total || left.label.localeCompare(right.label));

  const leaderTotal = ranked[0]?.total ?? 0;

  return ranked.map((entry) => ({
    ...entry,
    trailingBy: leaderTotal - entry.total,
    isLeader: entry.total === leaderTotal,
  }));
}

export function calculatePuttTotals(
  players: Player[],
  holes: HoleResult[],
): PlayerTally[] {
  const totalsByPlayerId = Object.fromEntries(players.map((player) => [player.id, 0]));

  for (const hole of holes) {
    for (const player of players) {
      const putts = hole.playerResults[player.id]?.putts;

      if (typeof putts === 'number') {
        totalsByPlayerId[player.id] += putts;
      }
    }
  }

  return rankPlayerTotals(players, totalsByPlayerId);
}

function formatLeaderText(tallies: PlayerTally[], label: string): string {
  if (tallies.length === 0) {
    return `No ${label} data yet`;
  }

  const leaders = tallies.filter((entry) => entry.isLeader);

  if (leaders.length === tallies.length) {
    return `${label.toUpperCase()} tied`;
  }

  if (leaders.length > 1) {
    return `${leaders.map((entry) => entry.label).join(', ')} lead ${label.toUpperCase()}`;
  }

  return `${leaders[0]?.label ?? 'No one'} leads ${label.toUpperCase()}`;
}

export function calculateTrackedBooleanTotals(
  players: Player[],
  holes: HoleResult[],
  statType: 'gir' | 'fir',
): PlayerTally[] {
  const totalsByPlayerId = Object.fromEntries(players.map((player) => [player.id, 0]));

  for (const hole of holes) {
    for (const player of players) {
      const didEarnStat =
        statType === 'gir'
          ? hole.playerResults[player.id]?.gir
          : hole.playerResults[player.id]?.fir;

      if (didEarnStat) {
        totalsByPlayerId[player.id] += 1;
      }
    }
  }

  return rankPlayerTotals(players, totalsByPlayerId);
}

function getContestWinner(hole: HoleResult, contestType: ContestType): string | null | undefined {
  switch (contestType) {
    case 'kp':
      return hole.contests.kp;
    case 'longest-putt':
      return hole.contests.longestPutt;
    case 'longest-drive':
      return hole.contests.longestDrive;
  }
}

function getContestTitle(contestType: ContestType): string {
  switch (contestType) {
    case 'kp':
      return 'KP';
    case 'longest-putt':
      return 'Longest Putt';
    case 'longest-drive':
      return 'Longest Drive';
  }
}

export function calculateContestTallies(
  players: Player[],
  holes: HoleResult[],
  contestType: ContestType,
): ContestResult {
  const totalsByPlayerId = Object.fromEntries(players.map((player) => [player.id, 0]));

  for (const hole of holes) {
    const winnerId = getContestWinner(hole, contestType);

    if (winnerId) {
      totalsByPlayerId[winnerId] += 1;
    }
  }

  const totals = rankPlayerTotals(players, totalsByPlayerId);

  return {
    kind: 'contest',
    contestType,
    title: getContestTitle(contestType),
    totals,
    leaderText: formatLeaderText(totals, getContestTitle(contestType)),
  };
}
