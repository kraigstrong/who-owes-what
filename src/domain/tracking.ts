import type { Round } from '@/domain/round';

function hasTrackedMetric(
  round: Round,
  field: 'putts' | 'gir' | 'fir',
): boolean {
  return round.holes.some((hole) =>
    Object.values(hole.playerResults).some((playerResult) => {
      const value = playerResult[field];

      if (field === 'putts') {
        return typeof value === 'number';
      }

      return typeof value === 'boolean';
    }),
  );
}

function hasLegacyGame(round: Round, field: 'gir' | 'fir'): boolean {
  return round.activeGames.some((game) => game.type === field);
}

export interface RoundTrackingFlags {
  trackPutts: boolean;
  trackGir: boolean;
  trackFir: boolean;
}

export function getRoundTrackingFlags(round: Round): RoundTrackingFlags {
  return {
    trackPutts:
      typeof round.trackPutts === 'boolean'
        ? round.trackPutts
        : hasTrackedMetric(round, 'putts'),
    trackGir:
      typeof round.trackGir === 'boolean'
        ? round.trackGir
        : hasLegacyGame(round, 'gir') || hasTrackedMetric(round, 'gir'),
    trackFir:
      typeof round.trackFir === 'boolean'
        ? round.trackFir
        : hasLegacyGame(round, 'fir') || hasTrackedMetric(round, 'fir'),
  };
}
