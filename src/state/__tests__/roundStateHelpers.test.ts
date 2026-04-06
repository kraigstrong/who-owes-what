import {
  applyPlayerHoleValue,
  seedHoleGamePoints,
  seedHolePlayerMetric,
} from '@/state/roundStateHelpers';
import { createEmptyHoleResult, type Round } from '@/domain/round';

function buildRound(trackPutts: boolean): Round {
  const players = [
    { id: 'alice', name: 'Alice', sideId: 'side-a' },
    { id: 'bob', name: 'Bob', sideId: 'side-b' },
  ];

  return {
    id: 'round-1',
    name: 'Test round',
    createdAt: '2026-04-05T00:00:00.000Z',
    players,
    sides: [
      { id: 'side-a', label: 'Alice', playerIds: ['alice'] },
      { id: 'side-b', label: 'Bob', playerIds: ['bob'] },
    ],
    holeCount: 18,
    holes: Array.from({ length: 18 }, (_, index) => createEmptyHoleResult(index + 1, players)),
    activeGames: [],
    activeContests: [],
    trackPutts,
    trackGir: false,
    trackFir: false,
    scoringMode: 'gross',
    playerTeeIds: {},
    status: 'in-progress',
  };
}

describe('seedHolePlayerMetric', () => {
  it('seeds undefined putts to 2 and preserves existing putt values', () => {
    const round = buildRound(true);
    round.holes[0].playerResults.alice.putts = 1;

    const nextRound = seedHolePlayerMetric(round, 1, 'putts', 2);

    expect(nextRound.holes[0].playerResults.alice.putts).toBe(1);
    expect(nextRound.holes[0].playerResults.bob.putts).toBe(2);
  });

  it('can seed strokes independently without touching putts', () => {
    const round = buildRound(false);
    round.holes[0].playerResults.alice.putts = 3;

    const nextRound = seedHolePlayerMetric(round, 1, 'strokes', 4);

    expect(nextRound.holes[0].playerResults.alice.strokes).toBe(4);
    expect(nextRound.holes[0].playerResults.alice.putts).toBe(3);
  });

  it('seeds manual game points to 0 and preserves existing values', () => {
    const round = buildRound(false);
    round.holes[0].manualPoints = {
      wolf: {
        alice: 2,
      },
    };

    const nextRound = seedHoleGamePoints(round, 1, 'wolf', ['alice', 'bob'], 0);

    expect(nextRound.holes[0].manualPoints.wolf.alice).toBe(2);
    expect(nextRound.holes[0].manualPoints.wolf.bob).toBe(0);
  });
});

describe('applyPlayerHoleValue', () => {
  it('caps putts at strokes minus one', () => {
    const result = applyPlayerHoleValue({ strokes: 4 }, 'putts', 6);

    expect(result.putts).toBe(3);
  });

  it('clamps existing putts down when strokes are lowered', () => {
    const result = applyPlayerHoleValue({ strokes: 5, putts: 4 }, 'strokes', 3);

    expect(result.strokes).toBe(3);
    expect(result.putts).toBe(2);
  });

  it('allows zero putts on a hole-in-one', () => {
    const result = applyPlayerHoleValue({ strokes: 4, putts: 2 }, 'strokes', 1);

    expect(result.strokes).toBe(1);
    expect(result.putts).toBe(0);
  });
});
