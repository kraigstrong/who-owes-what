import type { SelectedCourse } from '@/domain/course';

export type PlayerId = string;
export type SideId = string;
export type RoundId = string;
export type GameId = string;
export type ScoringMode = 'gross' | 'net';

export type GameType = 'match-play' | 'nassau' | 'wolf';
export type ContestType = 'kp' | 'longest-putt' | 'longest-drive';

export interface Player {
  id: PlayerId;
  name: string;
  sideId: SideId;
  handicap?: number;
}

export interface Side {
  id: SideId;
  label: string;
  playerIds: PlayerId[];
}

export interface PlayerHoleResult {
  strokes?: number;
  putts?: number;
  fir?: boolean;
  gir?: boolean;
}

export interface HoleContests {
  kp?: PlayerId | null;
  longestPutt?: PlayerId | null;
  longestDrive?: PlayerId | null;
}

export type HoleManualPoints = Record<GameId, Record<PlayerId, number>>;

export interface HoleResult {
  holeNumber: number;
  isCommitted: boolean;
  playerResults: Record<PlayerId, PlayerHoleResult>;
  contests: HoleContests;
  manualPoints: HoleManualPoints;
}

export interface MatchPlayGameConfig {
  id: GameId;
  type: 'match-play';
  title: string;
}

export interface NassauSegmentConfig {
  id: string;
  label: string;
  startHole: number;
  endHole: number;
  kind: 'base' | 'press';
  parentSegmentId?: string;
  createdAfterHole?: number;
}

export interface NassauGameConfig {
  id: GameId;
  type: 'nassau';
  title: string;
  segments: NassauSegmentConfig[];
}

export interface WolfGameConfig {
  id: GameId;
  type: 'wolf';
  title: string;
  rotationOrderPlayerIds: PlayerId[];
}

export interface LegacyStatGameConfig {
  id: GameId;
  type: 'gir' | 'fir';
  title: string;
}

export type GameConfig =
  | MatchPlayGameConfig
  | NassauGameConfig
  | WolfGameConfig
  | LegacyStatGameConfig;

export interface Round {
  id: RoundId;
  name: string;
  createdAt: string;
  players: Player[];
  sides: Side[];
  holeCount: number;
  holes: HoleResult[];
  activeGames: GameConfig[];
  activeContests: ContestType[];
  trackPutts: boolean;
  trackGir: boolean;
  trackFir: boolean;
  scoringMode: ScoringMode;
  course?: SelectedCourse;
  playerTeeIds: Record<PlayerId, string | undefined>;
  status: 'in-progress' | 'complete';
}

export interface SetupDraft {
  roundName: string;
  playerCount: 2 | 4;
  useTeams: boolean;
  playerNames: string[];
  playerHandicaps: string[];
  selectedGames: GameType[];
  selectedContests: ContestType[];
  trackPutts: boolean;
  trackGir: boolean;
  trackFir: boolean;
  scoringMode: ScoringMode;
  wolfRotationPlayerIndexes: number[];
  selectedCourse?: SelectedCourse;
  sameTeeForAll: boolean;
  playerTeeIds: string[];
}

export const ROUND_HOLE_COUNT = 18;

export function createDefaultRoundName(date = new Date()): string {
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function createDefaultSetupDraft(): SetupDraft {
  return {
    roundName: createDefaultRoundName(),
    playerCount: 2,
    useTeams: true,
    playerNames: ['', '', '', ''],
    playerHandicaps: ['', '', '', ''],
    selectedGames: ['match-play', 'nassau'],
    selectedContests: ['kp', 'longest-putt'],
    trackPutts: false,
    trackGir: false,
    trackFir: false,
    scoringMode: 'gross',
    wolfRotationPlayerIndexes: [0, 1, 2, 3],
    sameTeeForAll: true,
    playerTeeIds: ['', '', '', ''],
  };
}

export function createEmptyHoleResult(
  holeNumber: number,
  players: Player[],
): HoleResult {
  return {
    holeNumber,
    isCommitted: false,
    playerResults: Object.fromEntries(
      players.map((player) => [player.id, {} satisfies PlayerHoleResult]),
    ) as Record<PlayerId, PlayerHoleResult>,
    contests: {},
    manualPoints: {},
  };
}

export function createStandardNassauSegments(): NassauSegmentConfig[] {
  return [
    {
      id: 'nassau-front',
      label: 'Front 9',
      startHole: 1,
      endHole: 9,
      kind: 'base',
    },
    {
      id: 'nassau-back',
      label: 'Back 9',
      startHole: 10,
      endHole: 18,
      kind: 'base',
    },
    {
      id: 'nassau-overall',
      label: 'Overall 18',
      startHole: 1,
      endHole: 18,
      kind: 'base',
    },
  ];
}
