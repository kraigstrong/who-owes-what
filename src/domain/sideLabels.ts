import type { Round } from '@/domain/round';

function isGenericSideLabel(label: string | undefined): boolean {
  if (!label) {
    return true;
  }

  return /^side\s+[ab]$/i.test(label.trim());
}

export function getRoundSideLabel(round: Round, sideId: string | null): string {
  if (!sideId) {
    return 'No side';
  }

  const side = round.sides.find((entry) => entry.id === sideId);

  if (!side) {
    return 'Unknown side';
  }

  if (!isGenericSideLabel(side.label)) {
    return side.label;
  }

  const playerNames = side.playerIds
    .map((playerId) => round.players.find((player) => player.id === playerId)?.name)
    .filter((name): name is string => Boolean(name));

  if (playerNames.length > 0) {
    return playerNames.join(' / ');
  }

  return 'Unknown side';
}
