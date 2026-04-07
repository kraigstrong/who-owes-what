import { createEmptyHoleResult, type Round } from '@/domain/round';
import { getResumeHoleNumber } from '@/domain/roundProgress';

function buildRound(): Round {
  const players = [
    { id: 'alice', name: 'Alice', sideId: 'side-a' },
    { id: 'bob', name: 'Bob', sideId: 'side-b' },
  ];

  return {
    id: 'round-progress-test',
    name: 'Round progress',
    createdAt: '2026-04-06T00:00:00.000Z',
    players,
    sides: [
      { id: 'side-a', label: 'Alice', playerIds: ['alice'] },
      { id: 'side-b', label: 'Bob', playerIds: ['bob'] },
    ],
    holeCount: 18,
    holes: Array.from({ length: 18 }, (_, index) => createEmptyHoleResult(index + 1, players)),
    activeGames: [],
    activeContests: [],
    trackPutts: false,
    trackGir: false,
    trackFir: false,
    scoringMode: 'gross',
    playerTeeIds: {},
    status: 'in-progress',
  };
}

describe('getResumeHoleNumber', () => {
  it('starts on hole 1 when no holes are committed', () => {
    const round = buildRound();

    expect(getResumeHoleNumber(round)).toBe(1);
  });

  it('resumes on the next hole after the highest committed hole', () => {
    const round = buildRound();

    round.holes[0].isCommitted = true;
    round.holes[1].isCommitted = true;

    expect(getResumeHoleNumber(round)).toBe(3);
  });

  it('stays on the final hole when the round is fully committed', () => {
    const round = buildRound();

    round.holes.forEach((hole) => {
      hole.isCommitted = true;
    });

    expect(getResumeHoleNumber(round)).toBe(18);
  });
});
