import type { ContestType, GameId, PlayerId, SideId } from '@/domain/round';

export interface MatchHoleState {
  holeNumber: number;
  winnerSideId: SideId | null;
  marginAfterHole: number;
  statusText: string;
}

export interface MatchSegmentResult {
  segmentId: string;
  label: string;
  startHole: number;
  endHole: number;
  completedHoles: number;
  holesRemaining: number;
  currentLeaderSideId: SideId | null;
  currentMargin: number;
  statusText: string;
  winnerSideId: SideId | null;
  holeStates: MatchHoleState[];
}

export interface MatchPlayResult {
  kind: 'match-play';
  gameId: GameId;
  title: string;
  segment: MatchSegmentResult;
}

export interface NassauResult {
  kind: 'nassau';
  gameId: GameId;
  title: string;
  segments: MatchSegmentResult[];
}

export interface WolfHoleState {
  holeNumber: number;
  wolfPlayerId: PlayerId;
  wolfLabel: string;
  pointsByPlayerId: Record<PlayerId, number>;
}

export interface PlayerTally {
  playerId: PlayerId;
  label: string;
  total: number;
  trailingBy: number;
  isLeader: boolean;
}

export interface WolfResult {
  kind: 'wolf';
  gameId: GameId;
  title: string;
  totals: PlayerTally[];
  leaderText: string;
  holeStates: WolfHoleState[];
}

export interface FirGirHoleState {
  holeNumber: number;
  pointsByPlayerId: Record<PlayerId, number>;
}

export interface FirGirResult {
  kind: 'fir-gir';
  gameId: GameId;
  title: string;
  totals: PlayerTally[];
  leaderText: string;
  holeStates: FirGirHoleState[];
}

export interface ContestResult {
  kind: 'contest';
  contestType: ContestType;
  title: string;
  totals: PlayerTally[];
  leaderText: string;
}

export interface DerivedRoundState {
  games: Array<MatchPlayResult | NassauResult | WolfResult | FirGirResult>;
  contests: ContestResult[];
  settlementLines: string[];
}
