import type { HoleResult, Round } from '@/domain/round';

function holeHasAnyEntry(hole: HoleResult): boolean {
  const hasPlayerEntry = Object.values(hole.playerResults).some((playerResult) =>
    Object.values(playerResult).some((value) => value !== undefined),
  );
  const hasContestEntry = Object.values(hole.contests).some((value) => value !== undefined);
  const hasManualPoints = Object.keys(hole.manualPoints ?? {}).length > 0;

  return hasPlayerEntry || hasContestEntry || hasManualPoints;
}

export function getCommittedHoles(round: Round): HoleResult[] {
  if (round.status === 'complete') {
    return round.holes.filter((hole) => hole.isCommitted || holeHasAnyEntry(hole));
  }

  const explicitlyCommitted = round.holes.filter((hole) => hole.isCommitted);

  if (explicitlyCommitted.length > 0) {
    return explicitlyCommitted;
  }

  const touchedHoles = round.holes.filter((hole) => holeHasAnyEntry(hole));

  if (touchedHoles.length <= 1) {
    return [];
  }

  return touchedHoles.slice(0, -1);
}

export function getResumeHoleNumber(round: Round): number {
  const committedHoles = getCommittedHoles(round);

  if (committedHoles.length === 0) {
    return 1;
  }

  const highestCommittedHoleNumber = committedHoles.reduce(
    (highestHoleNumber, hole) => Math.max(highestHoleNumber, hole.holeNumber),
    0,
  );

  return Math.min(round.holeCount, highestCommittedHoleNumber + 1);
}
