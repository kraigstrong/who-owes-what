import {
  buildRoundHandicapContext,
  calculateCourseHandicap,
  calculatePlayingHandicap,
  getHoleHandicapStrokes,
  getSetupNetScoringAvailability,
  isTeeEligibleForNet,
} from '@/domain/calculators/handicap';
import type { SelectedCourse, TeeOption } from '@/domain/course';
import { createDefaultSetupDraft, createEmptyHoleResult, type Round } from '@/domain/round';

function buildTee(overrides: Partial<TeeOption> = {}): TeeOption {
  return {
    id: overrides.id ?? 'white',
    name: overrides.name ?? 'White',
    gender: overrides.gender ?? 'male',
    totalYards: overrides.totalYards ?? 6200,
    parTotal: overrides.parTotal ?? 72,
    rating: overrides.rating ?? 72,
    slope: overrides.slope ?? 113,
    holes:
      overrides.holes ??
      Array.from({ length: 18 }, (_, index) => ({
        holeNumber: index + 1,
        par: 4,
        yardage: 350,
        strokeIndex: index + 1,
      })),
  };
}

function buildCourse(tees: TeeOption[]): SelectedCourse {
  return {
    courseId: 'course-1',
    providerId: 'golf-course-api',
    clubName: 'Test Club',
    courseName: 'Test Course',
    city: 'Portland',
    state: 'OR',
    country: 'United States',
    tees,
    cachedAt: '2026-04-06T00:00:00.000Z',
  };
}

describe('handicap helpers', () => {
  it('validates tees needed for net scoring', () => {
    expect(isTeeEligibleForNet(buildTee())).toBe(true);
    expect(
      isTeeEligibleForNet(
        buildTee({
          holes: [{ holeNumber: 1, par: 4, yardage: 350 }],
        }),
      ),
    ).toBe(false);
  });

  it('calculates course handicap and playing handicap from tee metadata', () => {
    const tee = buildTee({ slope: 128, rating: 71.4, parTotal: 72 });
    const courseHandicap = calculateCourseHandicap(12.9, tee);

    expect(courseHandicap).toBeCloseTo(14.01238938, 5);
    expect(calculatePlayingHandicap(courseHandicap, 1)).toBe(14);
  });

  it('allocates strokes across all 18 indexes for common playing handicaps', () => {
    const indexes = Array.from({ length: 18 }, (_, index) => index + 1);

    expect(indexes.map((index) => getHoleHandicapStrokes(0, index))).toEqual(
      Array(18).fill(0),
    );
    expect(indexes.map((index) => getHoleHandicapStrokes(1, index))).toEqual([
      1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ]);
    expect(indexes.map((index) => getHoleHandicapStrokes(18, index))).toEqual(
      Array(18).fill(1),
    );
    expect(indexes.map((index) => getHoleHandicapStrokes(19, index))).toEqual([
      2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    ]);
    expect(indexes.map((index) => getHoleHandicapStrokes(23, index))).toEqual([
      2, 2, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    ]);
    expect(indexes.map((index) => getHoleHandicapStrokes(36, index))).toEqual(
      Array(18).fill(2),
    );
  });

  it('handles plus handicaps by giving strokes back starting at stroke index 18', () => {
    const indexes = Array.from({ length: 18 }, (_, index) => index + 1);

    expect(indexes.map((index) => getHoleHandicapStrokes(-1, index))).toEqual([
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -1,
    ]);
    expect(indexes.map((index) => getHoleHandicapStrokes(-2, index))).toEqual([
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -1, -1,
    ]);
    expect(indexes.map((index) => getHoleHandicapStrokes(-20, index))).toEqual([
      -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -2, -2,
    ]);
  });

  it('checks setup eligibility for net scoring', () => {
    const draft = createDefaultSetupDraft();
    draft.playerCount = 2;
    draft.playerNames = ['Alice', 'Bob', '', ''];
    draft.playerHandicaps = ['12.9', '18.4', '', ''];
    draft.selectedCourse = buildCourse([buildTee()]);
    draft.playerTeeIds = ['white', 'white', '', ''];

    expect(getSetupNetScoringAvailability(draft).eligible).toBe(true);

    draft.playerHandicaps[1] = '';

    expect(getSetupNetScoringAvailability(draft)).toMatchObject({
      eligible: false,
      reason: 'Enter a handicap for every player to use net scoring.',
    });
  });

  it('builds round handicap context using each player tee and relative playing handicap', () => {
    const whiteTee = buildTee({ id: 'white', slope: 113, rating: 72, parTotal: 72 });
    const blueTee = buildTee({ id: 'blue', slope: 120, rating: 74, parTotal: 72 });
    const course = buildCourse([whiteTee, blueTee]);
    const players = [
      { id: 'alice', name: 'Alice', sideId: 'side-a', handicap: 10 },
      { id: 'bob', name: 'Bob', sideId: 'side-b', handicap: 12.9 },
    ];
    const round: Round = {
      id: 'round-1',
      name: 'Net round',
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
      scoringMode: 'net',
      course,
      playerTeeIds: {
        alice: 'white',
        bob: 'blue',
      },
      status: 'in-progress',
    };

    const context = buildRoundHandicapContext(round);

    expect(context.eligible).toBe(true);
    expect(context.playerContexts.alice.playingHandicap).toBe(10);
    expect(context.playerContexts.bob.playingHandicap).toBe(16);
    expect(context.playerContexts.alice.competitionHandicap).toBe(0);
    expect(context.playerContexts.bob.competitionHandicap).toBe(6);
    expect(context.playerContexts.bob.holeStrokesByHole[1]).toBe(1);
    expect(context.playerContexts.bob.holeStrokesByHole[7]).toBe(0);
  });
});
