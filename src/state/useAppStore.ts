import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { refreshManagedSelectedCourse } from '@/data/course/managedCatalog';
import { getSetupNetScoringAvailability } from '@/domain/calculators/handicap';
import {
  findTeeById,
  selectDefaultTee,
  type SelectedCourse,
} from '@/domain/course';
import {
  ROUND_HOLE_COUNT,
  createDefaultRoundName,
  createDefaultSetupDraft,
  createEmptyHoleResult,
  createStandardNassauSegments,
  type ContestType,
  type GameConfig,
  type GameType,
  type HoleContests,
  type Player,
  type Round,
  type RoundId,
  type ScoringMode,
  type SetupDraft,
} from '@/domain/round';
import {
  applyPlayerHoleValue,
  seedHoleGamePoints,
  seedHolePlayerMetric,
} from '@/state/roundStateHelpers';
import { createJSONStorage, persist } from '@/state/zustandMiddleware';
import { createId } from '@/utils/id';

interface AppState {
  rounds: Round[];
  recentCourses: SelectedCourse[];
  setupDraft: SetupDraft;
  updateSetupDraft: (patch: Partial<SetupDraft>) => void;
  updatePlayerName: (index: number, name: string) => void;
  updatePlayerHandicap: (index: number, handicap: string) => void;
  updatePlayerTeeId: (index: number, teeId: string) => void;
  setSameTeeForAll: (sameTeeForAll: boolean) => void;
  applyTeeToAllPlayers: (teeId: string) => void;
  toggleDraftGame: (gameType: GameType) => void;
  toggleDraftContest: (contestType: ContestType) => void;
  setSelectedCourseForDraft: (course?: SelectedCourse) => void;
  createRoundFromDraft: () => Round;
  seedHoleScores: (
    roundId: RoundId,
    holeNumber: number,
    defaultScore: number,
  ) => void;
  seedHolePutts: (
    roundId: RoundId,
    holeNumber: number,
    defaultPutts: number,
  ) => void;
  moveWolfDraftPlayer: (playerIndex: number, direction: 'earlier' | 'later') => void;
  seedHoleGamePoints: (
    roundId: RoundId,
    holeNumber: number,
    gameId: string,
    defaultValue: number,
  ) => void;
  commitHole: (roundId: RoundId, holeNumber: number) => void;
  updateHolePlayerValue: (
    roundId: RoundId,
    holeNumber: number,
    playerId: string,
    field: 'strokes' | 'putts' | 'gir' | 'fir',
    value: number | boolean | undefined,
  ) => void;
  updateHoleContest: (
    roundId: RoundId,
    holeNumber: number,
    contestType: ContestType,
    playerId: string | null,
  ) => void;
  updateHoleGamePoints: (
    roundId: RoundId,
    holeNumber: number,
    gameId: string,
    playerId: string,
    value: number,
  ) => void;
  completeRound: (roundId: RoundId) => void;
}

const MAX_RECENT_COURSES = 6;

function requiresFirGirTracking(selectedGames: GameType[]): boolean {
  return selectedGames.includes('fir-gir');
}

function applyRequiredTrackingFlags<T extends Pick<SetupDraft, 'selectedGames' | 'trackPutts' | 'trackGir' | 'trackFir'>>(
  draft: T,
): T {
  if (!requiresFirGirTracking(draft.selectedGames)) {
    return draft;
  }

  return {
    ...draft,
    trackPutts: true,
    trackGir: true,
    trackFir: true,
  };
}

function fillPlayerTeeIds(
  playerCount: 2 | 4,
  teeId: string | undefined,
): string[] {
  return Array.from({ length: 4 }, (_, index) =>
    index < playerCount ? teeId ?? '' : '',
  );
}

function normalizePlayerTeeIds(
  playerCount: 2 | 4,
  teeIds: string[] | undefined,
): string[] {
  return Array.from({ length: 4 }, (_, index) =>
    index < playerCount ? teeIds?.[index] ?? '' : '',
  );
}

function getDefaultTeeId(course: SelectedCourse | undefined): string | undefined {
  return course ? selectDefaultTee(course)?.id : undefined;
}

function coerceDraftScoringMode(draft: SetupDraft): ScoringMode {
  if (draft.scoringMode === 'net' && !getSetupNetScoringAvailability(draft).eligible) {
    return 'gross';
  }

  return draft.scoringMode;
}

function getSupportedGames(playerCount: 2 | 4, useTeams: boolean): GameType[] {
  if (playerCount === 2) {
    return ['match-play', 'nassau', 'fir-gir'];
  }

  if (useTeams) {
    return ['match-play', 'nassau', 'wolf', 'fir-gir'];
  }

  return ['wolf', 'fir-gir'];
}

function buildSides(setupDraft: SetupDraft) {
  if (setupDraft.playerCount === 2) {
    return [
      { id: 'side-a', label: '', playerIndexes: [0] },
      { id: 'side-b', label: '', playerIndexes: [1] },
    ];
  }

  if (setupDraft.useTeams) {
    return [
      { id: 'side-a', label: '', playerIndexes: [0, 1] },
      { id: 'side-b', label: '', playerIndexes: [2, 3] },
    ];
  }

  return [
    { id: 'side-a', label: '', playerIndexes: [0] },
    { id: 'side-b', label: '', playerIndexes: [1] },
    { id: 'side-c', label: '', playerIndexes: [2] },
    { id: 'side-d', label: '', playerIndexes: [3] },
  ];
}

function buildPlayers(setupDraft: SetupDraft): Player[] {
  const sides = buildSides(setupDraft);
  const activeNames = setupDraft.playerNames.slice(0, setupDraft.playerCount);
  const activeHandicaps = setupDraft.playerHandicaps.slice(0, setupDraft.playerCount);

  return activeNames.map((name, index) => {
    const side = sides.find((entry) => entry.playerIndexes.includes(index));
    const rawHandicap = activeHandicaps[index]?.trim() ?? '';
    const handicap = rawHandicap.length > 0 ? Number.parseFloat(rawHandicap) : undefined;

    return {
      id: createId(`player-${index + 1}`),
      name: name.trim() || `Player ${index + 1}`,
      sideId: side?.id ?? 'side-a',
      handicap: Number.isFinite(handicap) ? handicap : undefined,
    };
  });
}

function resolveWolfRotationPlayerIds(players: Player[], setupDraft: SetupDraft) {
  const safeOrder = Array.isArray(setupDraft.wolfRotationPlayerIndexes)
    ? setupDraft.wolfRotationPlayerIndexes
    : [];
  const uniqueIndexes = safeOrder.filter(
    (index, position, indexes) =>
      index >= 0 &&
      index < players.length &&
      indexes.indexOf(index) === position,
  );
  const remainingIndexes = players
    .map((_, index) => index)
    .filter((index) => !uniqueIndexes.includes(index));

  return [...uniqueIndexes, ...remainingIndexes].map((index) => players[index]?.id).filter(Boolean);
}

function buildActiveGames(selectedGames: GameType[], players: Player[], setupDraft: SetupDraft): GameConfig[] {
  return selectedGames.reduce<GameConfig[]>((games, gameType) => {
    if (gameType === 'match-play') {
      games.push({
        id: createId('match-play'),
        type: 'match-play' as const,
        title: 'Match Play',
      });
      return games;
    }

    if (gameType === 'nassau') {
      games.push({
        id: createId('nassau'),
        type: 'nassau' as const,
        title: 'Nassau',
        segments: createStandardNassauSegments(),
      });

      return games;
    }

    if (gameType === 'wolf' && players.length === 4) {
      games.push({
        id: createId('wolf'),
        type: 'wolf' as const,
        title: 'Wolf',
        rotationOrderPlayerIds: resolveWolfRotationPlayerIds(players, setupDraft),
      });

      return games;
    }

    games.push({
      id: createId('fir-gir'),
      type: 'fir-gir' as const,
      title: 'FIR/GIR',
    });

    return games;
  }, []);
}

function updateContests(
  current: HoleContests,
  contestType: ContestType,
  playerId: string | null,
): HoleContests {
  if (contestType === 'kp') {
    return {
      ...current,
      kp: playerId,
    };
  }

  if (contestType === 'longest-putt') {
    return {
      ...current,
      longestPutt: playerId,
    };
  }

  return {
    ...current,
    longestDrive: playerId,
  };
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      rounds: [],
      recentCourses: [],
      setupDraft: createDefaultSetupDraft(),
      updateSetupDraft: (patch) =>
        set((state) => {
          const nextPlayerCount = patch.playerCount ?? state.setupDraft.playerCount;
          const nextUseTeams = patch.useTeams ?? state.setupDraft.useTeams;
          const nextSelectedCourse =
            patch.selectedCourse !== undefined
              ? patch.selectedCourse
              : state.setupDraft.selectedCourse;
          const nextSameTeeForAll =
            patch.sameTeeForAll ?? state.setupDraft.sameTeeForAll;
          const selectedGames =
            patch.playerCount || patch.useTeams !== undefined
              ? state.setupDraft.selectedGames.filter((game) =>
                  getSupportedGames(nextPlayerCount, nextUseTeams).includes(game),
                )
              : state.setupDraft.selectedGames;
          const nextPlayerTeeIds =
            patch.playerCount || patch.useTeams !== undefined || patch.selectedCourse
              ? nextSameTeeForAll
                ? fillPlayerTeeIds(nextPlayerCount, getDefaultTeeId(nextSelectedCourse))
                : normalizePlayerTeeIds(nextPlayerCount, state.setupDraft.playerTeeIds)
              : patch.playerTeeIds ?? state.setupDraft.playerTeeIds;
          const normalizedDraft = applyRequiredTrackingFlags({
            ...state.setupDraft,
            ...patch,
            selectedGames,
            selectedCourse: nextSelectedCourse,
            sameTeeForAll: nextSameTeeForAll,
            playerTeeIds: nextPlayerTeeIds,
          });

          return {
            setupDraft: {
              ...normalizedDraft,
              scoringMode: coerceDraftScoringMode(normalizedDraft),
            },
          };
        }),
      updatePlayerName: (index, name) =>
        set((state) => {
          const nextNames = [...state.setupDraft.playerNames];
          nextNames[index] = name;

          return {
            setupDraft: {
              ...state.setupDraft,
              playerNames: nextNames,
              scoringMode: coerceDraftScoringMode({
                ...state.setupDraft,
                playerNames: nextNames,
              }),
            },
          };
        }),
      updatePlayerHandicap: (index, handicap) =>
        set((state) => {
          const nextHandicaps = [...(state.setupDraft.playerHandicaps ?? ['', '', '', ''])];
          nextHandicaps[index] = handicap;

          return {
            setupDraft: {
              ...state.setupDraft,
              playerHandicaps: nextHandicaps,
              scoringMode: coerceDraftScoringMode({
                ...state.setupDraft,
                playerHandicaps: nextHandicaps,
              }),
            },
          };
        }),
      updatePlayerTeeId: (index, teeId) =>
        set((state) => {
          const nextTeeIds = normalizePlayerTeeIds(
            state.setupDraft.playerCount,
            state.setupDraft.playerTeeIds,
          );
          nextTeeIds[index] = teeId;

          return {
            setupDraft: {
              ...state.setupDraft,
              playerTeeIds: nextTeeIds,
              sameTeeForAll: nextTeeIds
                .slice(0, state.setupDraft.playerCount)
                .every((value) => value === nextTeeIds[0]),
              scoringMode: coerceDraftScoringMode({
                ...state.setupDraft,
                playerTeeIds: nextTeeIds,
                sameTeeForAll: nextTeeIds
                  .slice(0, state.setupDraft.playerCount)
                  .every((value) => value === nextTeeIds[0]),
              }),
            },
          };
        }),
      setSameTeeForAll: (sameTeeForAll) =>
        set((state) => {
          const nextTeeIds = normalizePlayerTeeIds(
            state.setupDraft.playerCount,
            state.setupDraft.playerTeeIds,
          );
          const defaultTeeId = nextTeeIds[0] || getDefaultTeeId(state.setupDraft.selectedCourse);

          return {
            setupDraft: {
              ...state.setupDraft,
              sameTeeForAll,
              playerTeeIds: sameTeeForAll
                ? fillPlayerTeeIds(state.setupDraft.playerCount, defaultTeeId)
                : nextTeeIds,
              scoringMode: coerceDraftScoringMode({
                ...state.setupDraft,
                sameTeeForAll,
                playerTeeIds: sameTeeForAll
                  ? fillPlayerTeeIds(state.setupDraft.playerCount, defaultTeeId)
                  : nextTeeIds,
              }),
            },
          };
        }),
      applyTeeToAllPlayers: (teeId) =>
        set((state) => ({
          setupDraft: {
            ...state.setupDraft,
            sameTeeForAll: true,
            playerTeeIds: fillPlayerTeeIds(state.setupDraft.playerCount, teeId),
            scoringMode: coerceDraftScoringMode({
              ...state.setupDraft,
              sameTeeForAll: true,
              playerTeeIds: fillPlayerTeeIds(state.setupDraft.playerCount, teeId),
            }),
          },
        })),
      toggleDraftGame: (gameType) =>
        set((state) => {
          const supportedGames = getSupportedGames(
            state.setupDraft.playerCount,
            state.setupDraft.useTeams,
          );

          if (!supportedGames.includes(gameType)) {
            return state;
          }

          const selectedGames = state.setupDraft.selectedGames.includes(gameType)
            ? state.setupDraft.selectedGames.filter((value) => value !== gameType)
            : [...state.setupDraft.selectedGames, gameType];
          const normalizedDraft = applyRequiredTrackingFlags({
            ...state.setupDraft,
            selectedGames,
          });

          return {
            setupDraft: {
              ...normalizedDraft,
              scoringMode: coerceDraftScoringMode(normalizedDraft),
            },
          };
        }),
      toggleDraftContest: (contestType) =>
        set((state) => {
          const selectedContests = state.setupDraft.selectedContests.includes(contestType)
            ? state.setupDraft.selectedContests.filter((value) => value !== contestType)
            : [...state.setupDraft.selectedContests, contestType];

          return {
            setupDraft: {
              ...state.setupDraft,
              selectedContests,
              scoringMode: coerceDraftScoringMode({
                ...state.setupDraft,
                selectedContests,
              }),
            },
          };
        }),
      moveWolfDraftPlayer: (playerIndex, direction) =>
        set((state) => {
          const order = Array.isArray(state.setupDraft.wolfRotationPlayerIndexes)
            ? [...state.setupDraft.wolfRotationPlayerIndexes]
            : [0, 1, 2, 3];
          const currentIndex = order.indexOf(playerIndex);

          if (currentIndex === -1) {
            return state;
          }

          const targetIndex =
            direction === 'earlier' ? currentIndex - 1 : currentIndex + 1;

          if (targetIndex < 0 || targetIndex >= order.length) {
            return state;
          }

          [order[currentIndex], order[targetIndex]] = [
            order[targetIndex],
            order[currentIndex],
          ];

          return {
            setupDraft: {
              ...state.setupDraft,
              wolfRotationPlayerIndexes: order,
              scoringMode: coerceDraftScoringMode({
                ...state.setupDraft,
                wolfRotationPlayerIndexes: order,
              }),
            },
          };
        }),
      setSelectedCourseForDraft: (course) =>
        set((state) => {
          const refreshedCourse = refreshManagedSelectedCourse(course);
          const defaultTeeId = getDefaultTeeId(refreshedCourse);

          return {
            setupDraft: {
              ...state.setupDraft,
              selectedCourse: refreshedCourse,
              sameTeeForAll: true,
              playerTeeIds: fillPlayerTeeIds(state.setupDraft.playerCount, defaultTeeId),
              scoringMode: coerceDraftScoringMode({
                ...state.setupDraft,
                selectedCourse: refreshedCourse,
                sameTeeForAll: true,
                playerTeeIds: fillPlayerTeeIds(state.setupDraft.playerCount, defaultTeeId),
              }),
            },
          };
        }),
      createRoundFromDraft: () => {
        const setupDraft = get().setupDraft;
        const players = buildPlayers(setupDraft);
        const sideTemplates = buildSides(setupDraft);
        const supportedGames = getSupportedGames(
          setupDraft.playerCount,
          setupDraft.useTeams,
        );
        const selectedCourse = refreshManagedSelectedCourse(setupDraft.selectedCourse);
        const defaultTeeId = getDefaultTeeId(selectedCourse);
        const normalizedDraft = applyRequiredTrackingFlags(setupDraft);
        const round: Round = {
          id: createId('round'),
          name:
            setupDraft.roundName.trim() ||
            createDefaultRoundName(),
          createdAt: new Date().toISOString(),
          players,
          sides: sideTemplates.map((side) => {
            const sidePlayers = players.filter((player, index) =>
              side.playerIndexes.includes(index),
            );

            return {
              id: side.id,
              label: sidePlayers.map((player) => player.name).join(' / '),
              playerIds: sidePlayers.map((player) => player.id),
            };
          }),
          holeCount: ROUND_HOLE_COUNT,
          holes: Array.from({ length: ROUND_HOLE_COUNT }, (_, index) =>
            createEmptyHoleResult(index + 1, players),
          ),
          activeGames: buildActiveGames(
            normalizedDraft.selectedGames.filter((game) => supportedGames.includes(game)),
            players,
            normalizedDraft,
          ),
          activeContests: setupDraft.selectedContests,
          trackPutts: normalizedDraft.trackPutts,
          trackGir: normalizedDraft.trackGir,
          trackFir: normalizedDraft.trackFir,
          scoringMode: getSetupNetScoringAvailability(setupDraft).eligible
            ? setupDraft.scoringMode
            : 'gross',
          course: selectedCourse,
          playerTeeIds: Object.fromEntries(
            players.map((player, index) => {
              const explicitTeeId = setupDraft.playerTeeIds[index];
              const resolvedTeeId =
                findTeeById(selectedCourse, explicitTeeId)?.id ?? defaultTeeId;

              return [player.id, resolvedTeeId];
            }),
          ) as Record<Player['id'], string | undefined>,
          status: 'in-progress',
        };

        const recentCourses = selectedCourse
          ? [
              selectedCourse,
              ...get()
                .recentCourses
                .filter((course) => course.courseId !== selectedCourse.courseId),
            ].slice(0, MAX_RECENT_COURSES)
          : get().recentCourses;

        set((state) => ({
          rounds: [
            round,
            ...state.rounds.filter((existingRound) => existingRound.status === 'complete'),
          ],
          recentCourses,
          setupDraft: state.setupDraft,
        }));

        return round;
      },
      seedHoleScores: (roundId, holeNumber, defaultScore) =>
        set((state) => ({
          rounds: state.rounds.map((round) => {
            if (round.id !== roundId) {
              return round;
            }

            return seedHolePlayerMetric(round, holeNumber, 'strokes', defaultScore);
          }),
        })),
      seedHolePutts: (roundId, holeNumber, defaultPutts) =>
        set((state) => ({
          rounds: state.rounds.map((round) => {
            if (round.id !== roundId) {
              return round;
            }

            if (!round.trackPutts) {
              return round;
            }

            return seedHolePlayerMetric(round, holeNumber, 'putts', defaultPutts);
          }),
        })),
      seedHoleGamePoints: (roundId, holeNumber, gameId, defaultValue) =>
        set((state) => ({
          rounds: state.rounds.map((round) => {
            if (round.id !== roundId) {
              return round;
            }

            return seedHoleGamePoints(
              round,
              holeNumber,
              gameId,
              round.players.map((player) => player.id),
              defaultValue,
            );
          }),
        })),
      commitHole: (roundId, holeNumber) =>
        set((state) => ({
          rounds: state.rounds.map((round) => {
            if (round.id !== roundId) {
              return round;
            }

            return {
              ...round,
              holes: round.holes.map((hole) =>
                hole.holeNumber === holeNumber
                  ? {
                      ...hole,
                      isCommitted: true,
                    }
                  : hole,
              ),
            };
          }),
        })),
      updateHolePlayerValue: (roundId, holeNumber, playerId, field, value) =>
        set((state) => ({
          rounds: state.rounds.map((round) => {
            if (round.id !== roundId) {
              return round;
            }

            return {
              ...round,
              holes: round.holes.map((hole) => {
                if (hole.holeNumber !== holeNumber) {
                  return hole;
                }

                return {
                  ...hole,
                  playerResults: {
                    ...hole.playerResults,
                    [playerId]: applyPlayerHoleValue(
                      hole.playerResults[playerId] ?? {},
                      field,
                      value,
                    ),
                  },
                };
              }),
            };
          }),
        })),
      updateHoleContest: (roundId, holeNumber, contestType, playerId) =>
        set((state) => ({
          rounds: state.rounds.map((round) => {
            if (round.id !== roundId) {
              return round;
            }

            return {
              ...round,
              holes: round.holes.map((hole) => {
                if (hole.holeNumber !== holeNumber) {
                  return hole;
                }

                return {
                  ...hole,
                  contests: updateContests(hole.contests, contestType, playerId),
                };
              }),
            };
          }),
        })),
      updateHoleGamePoints: (roundId, holeNumber, gameId, playerId, value) =>
        set((state) => ({
          rounds: state.rounds.map((round) => {
            if (round.id !== roundId) {
              return round;
            }

            return {
              ...round,
              holes: round.holes.map((hole) => {
                if (hole.holeNumber !== holeNumber) {
                  return hole;
                }

                return {
                  ...hole,
                  manualPoints: {
                    ...hole.manualPoints,
                    [gameId]: {
                      ...(hole.manualPoints?.[gameId] ?? {}),
                      [playerId]: value,
                    },
                  },
                };
              }),
            };
          }),
        })),
      completeRound: (roundId) =>
        set((state) => ({
          rounds: state.rounds.map((round) =>
            round.id === roundId
              ? {
                  ...round,
                  status: 'complete' as const,
                }
              : round,
          ).sort(
            (left, right) =>
              Number(new Date(right.createdAt)) - Number(new Date(left.createdAt)),
          ),
        })),
    }),
    {
      name: 'who-owes-what-store-v1',
      storage: createJSONStorage(() => AsyncStorage),
      version: 6,
      migrate: () =>
        ({
          rounds: [],
          recentCourses: [],
          setupDraft: createDefaultSetupDraft(),
        }) satisfies Pick<AppState, 'rounds' | 'recentCourses' | 'setupDraft'>,
    },
  ),
);
