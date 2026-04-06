import { deriveRoundState } from '@/domain/calculators';
import {
  calculateManualPointsTotals,
  getWolfPlayerIdForHole,
} from '@/domain/calculators/manualPoints';
import {
  calculatePuttTotals,
  calculateTrackedBooleanTotals,
} from '@/domain/calculators/stats';
import type { SelectedCourse, TeeOption } from '@/domain/course';
import { createEmptyHoleResult, createStandardNassauSegments, type Round } from '@/domain/round';

function buildRound(): Round {
  const players = [
    { id: 'alice', name: 'Alice', sideId: 'side-a' },
    { id: 'bob', name: 'Bob', sideId: 'side-b' },
  ];

  const round: Round = {
    id: 'round-1',
    name: 'Test round',
    createdAt: '2026-04-04T00:00:00.000Z',
    players,
    sides: [
      { id: 'side-a', label: 'Alice', playerIds: ['alice'] },
      { id: 'side-b', label: 'Bob', playerIds: ['bob'] },
    ],
    holeCount: 18,
    holes: Array.from({ length: 18 }, (_, index) => createEmptyHoleResult(index + 1, players)),
    activeGames: [
      { id: 'match-play-1', type: 'match-play', title: 'Match Play' },
      {
        id: 'nassau-1',
        type: 'nassau',
        title: 'Nassau',
        segments: createStandardNassauSegments(),
      },
    ],
    activeContests: ['kp', 'longest-putt', 'longest-drive'],
    trackPutts: false,
    trackGir: false,
    trackFir: false,
    scoringMode: 'gross',
    playerTeeIds: {},
    status: 'in-progress',
  };

  round.holes[0] = {
    ...round.holes[0],
    isCommitted: true,
    playerResults: {
      alice: { strokes: 4, fir: true, gir: true },
      bob: { strokes: 5, fir: false, gir: false },
    },
    contests: {
      longestDrive: 'alice',
    },
  };
  round.holes[1] = {
    ...round.holes[1],
    isCommitted: true,
    playerResults: {
      alice: { strokes: 4, fir: false, gir: false },
      bob: { strokes: 3, fir: true, gir: true },
    },
    contests: {
      longestPutt: 'bob',
    },
  };
  round.holes[2] = {
    ...round.holes[2],
    isCommitted: true,
    playerResults: {
      alice: { strokes: 2, fir: false, gir: true },
      bob: { strokes: 3, fir: false, gir: true },
    },
    contests: {
      kp: 'alice',
    },
  };

  return round;
}

function buildWolfRound(): Round {
  const players = [
    { id: 'kraig', name: 'Kraig', sideId: 'side-a' },
    { id: 'sam', name: 'Sam', sideId: 'side-a' },
    { id: 'alex', name: 'Alex', sideId: 'side-b' },
    { id: 'ben', name: 'Ben', sideId: 'side-b' },
  ];

  const round: Round = {
    id: 'round-wolf',
    name: 'Wolf round',
    createdAt: '2026-04-05T00:00:00.000Z',
    players,
    sides: [
      { id: 'side-a', label: 'Kraig / Sam', playerIds: ['kraig', 'sam'] },
      { id: 'side-b', label: 'Alex / Ben', playerIds: ['alex', 'ben'] },
    ],
    holeCount: 18,
    holes: Array.from({ length: 18 }, (_, index) => createEmptyHoleResult(index + 1, players)),
    activeGames: [
      {
        id: 'wolf-1',
        type: 'wolf',
        title: 'Wolf',
        rotationOrderPlayerIds: ['sam', 'alex', 'ben', 'kraig'],
      },
    ],
    activeContests: [],
    trackPutts: false,
    trackGir: false,
    trackFir: false,
    scoringMode: 'gross',
    playerTeeIds: {},
    status: 'in-progress',
  };

  round.holes[0].manualPoints = {
    ...round.holes[0].manualPoints,
    'wolf-1': {
      kraig: 0,
      sam: 2,
      alex: -1,
      ben: -1,
    },
  };
  round.holes[0].isCommitted = true;
  round.holes[1].manualPoints = {
    ...round.holes[1].manualPoints,
    'wolf-1': {
      kraig: 1,
      sam: 0,
      alex: 1,
      ben: -2,
    },
  };
  round.holes[1].isCommitted = true;

  return round;
}

function buildNetCourse(): SelectedCourse {
  const whiteTee: TeeOption = {
    id: 'white',
    name: 'White',
    gender: 'male',
    totalYards: 6200,
    parTotal: 72,
    rating: 72,
    slope: 113,
    holes: Array.from({ length: 18 }, (_, index) => ({
      holeNumber: index + 1,
      par: 4,
      yardage: 350,
      strokeIndex: index + 1,
    })),
  };

  return {
    courseId: 'course-1',
    providerId: 'golf-course-api',
    clubName: 'Test Club',
    courseName: 'Test Course',
    city: 'Portland',
    state: 'OR',
    country: 'United States',
    tees: [whiteTee],
    cachedAt: '2026-04-06T00:00:00.000Z',
  };
}

function buildNetSinglesRound(): Round {
  const course = buildNetCourse();
  const players = [
    { id: 'alice', name: 'Alice', sideId: 'side-a', handicap: 10 },
    { id: 'bob', name: 'Bob', sideId: 'side-b', handicap: 18 },
  ];

  const round: Round = {
    id: 'round-net-singles',
    name: 'Net Singles',
    createdAt: '2026-04-06T00:00:00.000Z',
    players,
    sides: [
      { id: 'side-a', label: 'Alice', playerIds: ['alice'] },
      { id: 'side-b', label: 'Bob', playerIds: ['bob'] },
    ],
    holeCount: 18,
    holes: Array.from({ length: 18 }, (_, index) => createEmptyHoleResult(index + 1, players)),
    activeGames: [
      { id: 'match-play-1', type: 'match-play', title: 'Match Play' },
      {
        id: 'nassau-1',
        type: 'nassau',
        title: 'Nassau',
        segments: createStandardNassauSegments(),
      },
    ],
    activeContests: [],
    trackPutts: false,
    trackGir: false,
    trackFir: false,
    scoringMode: 'net',
    course,
    playerTeeIds: {
      alice: 'white',
      bob: 'white',
    },
    status: 'in-progress',
  };

  round.holes[0].playerResults = {
    ...round.holes[0].playerResults,
    alice: { strokes: 5 },
    bob: { strokes: 5 },
  };
  round.holes[0].isCommitted = true;
  round.holes[1].playerResults = {
    ...round.holes[1].playerResults,
    alice: { strokes: 4 },
    bob: { strokes: 5 },
  };
  round.holes[1].isCommitted = true;
  round.holes[2].playerResults = {
    ...round.holes[2].playerResults,
    alice: { strokes: 4 },
    bob: { strokes: 6 },
  };
  round.holes[2].isCommitted = true;

  return round;
}

function buildNetTeamRound(): Round {
  const course = buildNetCourse();
  const players = [
    { id: 'avery', name: 'Avery', sideId: 'side-a', handicap: 5 },
    { id: 'blair', name: 'Blair', sideId: 'side-a', handicap: 15 },
    { id: 'casey', name: 'Casey', sideId: 'side-b', handicap: 10 },
    { id: 'drew', name: 'Drew', sideId: 'side-b', handicap: 10 },
  ];
  const round: Round = {
    id: 'round-net-teams',
    name: 'Net Teams',
    createdAt: '2026-04-06T00:00:00.000Z',
    players,
    sides: [
      { id: 'side-a', label: 'Avery / Blair', playerIds: ['avery', 'blair'] },
      { id: 'side-b', label: 'Casey / Drew', playerIds: ['casey', 'drew'] },
    ],
    holeCount: 18,
    holes: Array.from({ length: 18 }, (_, index) => createEmptyHoleResult(index + 1, players)),
    activeGames: [
      { id: 'match-play-1', type: 'match-play', title: 'Match Play' },
      {
        id: 'nassau-1',
        type: 'nassau',
        title: 'Nassau',
        segments: createStandardNassauSegments(),
      },
    ],
    activeContests: [],
    trackPutts: false,
    trackGir: false,
    trackFir: false,
    scoringMode: 'net',
    course,
    playerTeeIds: {
      avery: 'white',
      blair: 'white',
      casey: 'white',
      drew: 'white',
    },
    status: 'in-progress',
  };

  round.holes[0].playerResults = {
    ...round.holes[0].playerResults,
    avery: { strokes: 4 },
    blair: { strokes: 5 },
    casey: { strokes: 4 },
    drew: { strokes: 4 },
  };
  round.holes[0].isCommitted = true;

  return round;
}

describe('deriveRoundState', () => {
  it('computes match play, Nassau, and contests from shared hole data', () => {
    const derived = deriveRoundState(buildRound());

    const matchPlay = derived.games.find((game) => game.kind === 'match-play');
    const nassau = derived.games.find((game) => game.kind === 'nassau');
    const kp = derived.contests.find((contest) => contest.contestType === 'kp');

    expect(matchPlay?.segment.statusText).toBe('Alice 1 up');
    expect(nassau?.segments[0]?.statusText).toBe('Alice 1 up');
    expect(kp?.totals[0]).toMatchObject({ label: 'Alice', total: 1 });
  });

  it('recomputes standings correctly after editing a prior hole', () => {
    const round = buildRound();
    round.holes[0] = {
      ...round.holes[0],
      playerResults: {
        alice: { strokes: 4, fir: true, gir: true },
        bob: { strokes: 3, fir: true, gir: true },
      },
    };

    const derived = deriveRoundState(round);
    const matchPlay = derived.games.find((game) => game.kind === 'match-play');
    const girTotals = calculateTrackedBooleanTotals(round.players, round.holes, 'gir');

    expect(matchPlay?.segment.statusText).toBe('Bob 1 up');
    expect(girTotals[0]).toMatchObject({ label: 'Bob', total: 3 });
  });

  it('falls back to player names when persisted rounds still have generic side labels', () => {
    const round = buildRound();
    round.sides = [
      { id: 'side-a', label: 'Side A', playerIds: ['alice'] },
      { id: 'side-b', label: 'Side B', playerIds: ['bob'] },
    ];

    const derived = deriveRoundState(round);
    const matchPlay = derived.games.find((game) => game.kind === 'match-play');

    expect(matchPlay?.segment.statusText).toBe('Alice 1 up');
    expect(derived.settlementLines).toContain('Match Play: Alice 1 up');
  });

  it('calculates putt totals for tracked rounds without affecting game state', () => {
    const round = buildRound();
    round.trackPutts = true;
    round.holes[0].playerResults.alice.putts = 2;
    round.holes[0].playerResults.bob.putts = 3;
    round.holes[1].playerResults.alice.putts = 1;
    round.holes[1].playerResults.bob.putts = 2;

    const totals = calculatePuttTotals(round.players, round.holes);
    const derived = deriveRoundState(round);

    expect(totals[0]).toMatchObject({ label: 'Bob', total: 5 });
    expect(totals[1]).toMatchObject({ label: 'Alice', total: 3 });
    expect(derived.games.find((game) => game.kind === 'match-play')?.segment.statusText).toBe(
      'Alice 1 up',
    );
  });

  it('calculates GIR and FIR totals as tracked stats instead of games', () => {
    const round = buildRound();
    round.trackGir = true;
    round.trackFir = true;

    const girTotals = calculateTrackedBooleanTotals(round.players, round.holes, 'gir');
    const firTotals = calculateTrackedBooleanTotals(round.players, round.holes, 'fir');
    const derived = deriveRoundState(round);

    expect(girTotals[0]).toMatchObject({ label: 'Alice', total: 2 });
    expect(firTotals[0]).toMatchObject({ label: 'Alice', total: 1 });
    expect(derived.games).toHaveLength(2);
    expect(derived.settlementLines.some((line) => line.startsWith('GIR:'))).toBe(false);
    expect(derived.settlementLines.some((line) => line.startsWith('FIR:'))).toBe(false);
  });

  it('ignores legacy GIR/FIR game entries when deriving standings', () => {
    const round = buildRound();
    round.activeGames = [
      ...round.activeGames,
      { id: 'gir-legacy', type: 'gir', title: 'GIR' },
      { id: 'fir-legacy', type: 'fir', title: 'FIR' },
    ];

    const derived = deriveRoundState(round);

    expect(derived.games).toHaveLength(2);
    expect(derived.settlementLines.some((line) => line.startsWith('GIR:'))).toBe(false);
    expect(derived.settlementLines.some((line) => line.startsWith('FIR:'))).toBe(false);
  });

  it('treats old rounds without tracking flags or putt values as compatible', () => {
    const round = buildRound() as Round & {
      trackPutts?: boolean;
      trackGir?: boolean;
      trackFir?: boolean;
    };
    const {
      trackPutts: _ignoredTrackPutts,
      trackGir: _ignoredTrackGir,
      trackFir: _ignoredTrackFir,
      ...legacyRound
    } = round;

    const totals = calculatePuttTotals(legacyRound.players, legacyRound.holes);

    expect(totals[0]).toMatchObject({ label: 'Alice', total: 0 });
    expect(totals[1]).toMatchObject({ label: 'Bob', total: 0 });
  });

  it('rotates the Wolf and totals manual per-hole points', () => {
    const round = buildWolfRound();
    const wolfGame = round.activeGames.find((game) => game.type === 'wolf');
    const derived = deriveRoundState(round);
    const wolf = derived.games.find((game) => game.kind === 'wolf');

    expect(getWolfPlayerIdForHole(wolfGame?.rotationOrderPlayerIds ?? [], 1)).toBe('sam');
    expect(getWolfPlayerIdForHole(wolfGame?.rotationOrderPlayerIds ?? [], 4)).toBe('kraig');
    expect(calculateManualPointsTotals(round.players, round.holes, 'wolf-1')[0]).toMatchObject({
      label: 'Sam',
      total: 2,
    });
    expect(wolf).toMatchObject({
      kind: 'wolf',
      leaderText: 'Sam leads with 2',
    });
    expect(derived.settlementLines).toContain('Wolf: Sam leads with 2');
  });

  it('recalculates Wolf totals after editing an earlier hole', () => {
    const round = buildWolfRound();
    round.holes[0].manualPoints['wolf-1'].kraig = 3;
    round.holes[0].manualPoints['wolf-1'].sam = 0;

    const wolf = deriveRoundState(round).games.find((game) => game.kind === 'wolf');

    expect(wolf?.totals[0]).toMatchObject({ label: 'Kraig', total: 4 });
  });

  it('applies net scoring to singles match play and Nassau', () => {
    const derived = deriveRoundState(buildNetSinglesRound());

    const matchPlay = derived.games.find((game) => game.kind === 'match-play');
    const nassau = derived.games.find((game) => game.kind === 'nassau');

    expect(matchPlay?.title).toBe('Match Play (Net)');
    expect(matchPlay?.segment.statusText).toBe('All square');
    expect(nassau?.segments[0]?.statusText).toBe('All square');
  });

  it('excludes an uncommitted current hole from derived standings', () => {
    const round = buildNetSinglesRound();
    round.holes[2].isCommitted = false;

    const matchPlay = deriveRoundState(round).games.find((game) => game.kind === 'match-play');

    expect(matchPlay?.segment.statusText).toBe('Bob 1 up');
  });

  it('recomputes net standings correctly after editing a prior hole', () => {
    const round = buildNetSinglesRound();
    round.holes[0].playerResults.bob.strokes = 6;

    const matchPlay = deriveRoundState(round).games.find((game) => game.kind === 'match-play');

    expect(matchPlay?.segment.statusText).toBe('Alice 1 up');
  });

  it('applies net scoring to current team match play and Nassau formats', () => {
    const derived = deriveRoundState(buildNetTeamRound());

    const matchPlay = derived.games.find((game) => game.kind === 'match-play');
    const nassau = derived.games.find((game) => game.kind === 'nassau');

    expect(matchPlay?.segment.statusText).toBe('Casey / Drew 1 up');
    expect(nassau?.segments[0]?.statusText).toBe('Casey / Drew 1 up');
  });
});
