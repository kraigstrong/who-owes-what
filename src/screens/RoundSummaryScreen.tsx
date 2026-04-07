import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { deriveRoundState } from '@/domain/calculators';
import {
  buildRoundHandicapContext,
  getCompetitionStrokesForHole,
  getNetHoleScore,
} from '@/domain/calculators/handicap';
import {
  calculatePuttTotals,
  calculateTrackedBooleanTotals,
} from '@/domain/calculators/stats';
import { Chip } from '@/components/ui/Chip';
import { findTeeById, selectDefaultTee } from '@/domain/course';
import type { HoleResult, Player, Round } from '@/domain/round';
import { getCommittedHoles } from '@/domain/roundProgress';
import { getRoundTrackingFlags } from '@/domain/tracking';
import { useAppStore } from '@/state/useAppStore';

type ScorecardMode = 'gross' | 'net';

function scoreDecoration(score: number, par: number | undefined) {
  if (typeof par !== 'number') {
    return 'plain';
  }

  const diff = score - par;

  if (diff <= -2) {
    return 'double-circle';
  }

  if (diff === -1) {
    return 'circle';
  }

  if (diff === 1) {
    return 'box';
  }

  if (diff >= 2) {
    return 'double-box';
  }

  return 'plain';
}

function getPlayerPar(round: Round, player: Player, holeNumber: number): number | undefined {
  const course = round.course;

  if (!course) {
    return undefined;
  }

  const tee = findTeeById(course, round.playerTeeIds[player.id]) ?? selectDefaultTee(course);

  return tee?.holes[holeNumber - 1]?.par;
}

function getScorecardHoleScore(
  round: Round,
  player: Player,
  hole: HoleResult | undefined,
  mode: ScorecardMode,
  handicapContext: ReturnType<typeof buildRoundHandicapContext>,
) {
  const grossScore = hole?.playerResults[player.id]?.strokes;

  if (typeof grossScore !== 'number') {
    return undefined;
  }

  if (mode === 'net' && handicapContext.eligible && hole) {
    return getNetHoleScore(
      grossScore,
      getCompetitionStrokesForHole(handicapContext, player.id, hole.holeNumber),
    );
  }

  return grossScore;
}

function calculateScorecardSegmentTotal(
  round: Round,
  player: Player,
  holes: Array<HoleResult | undefined>,
  mode: ScorecardMode,
  handicapContext: ReturnType<typeof buildRoundHandicapContext>,
) {
  return holes.reduce((total, hole) => {
    const score = getScorecardHoleScore(round, player, hole, mode, handicapContext);
    return total + (typeof score === 'number' ? score : 0);
  }, 0);
}

function renderScoreValue(
  round: Round,
  player: Player,
  hole: HoleResult | undefined,
  mode: ScorecardMode,
  handicapContext: ReturnType<typeof buildRoundHandicapContext>,
) {
  const score = getScorecardHoleScore(round, player, hole, mode, handicapContext);

  if (typeof score !== 'number') {
    return <Text style={styles.scorecardEmpty}>-</Text>;
  }

  const decoration = scoreDecoration(score, getPlayerPar(round, player, hole?.holeNumber ?? 0));

  if (decoration === 'double-circle') {
    return (
      <View style={[styles.scorecardOuter, styles.circleOuter]}>
        <View style={[styles.scorecardInner, styles.circleInner]}>
          <Text style={styles.scorecardValue}>{score}</Text>
        </View>
      </View>
    );
  }

  if (decoration === 'circle') {
    return (
      <View style={[styles.scorecardInner, styles.circleInner]}>
        <Text style={styles.scorecardValue}>{score}</Text>
      </View>
    );
  }

  if (decoration === 'double-box') {
    return (
      <View style={[styles.scorecardOuter, styles.boxOuter]}>
        <View style={[styles.scorecardInner, styles.boxInner]}>
          <Text style={styles.scorecardValue}>{score}</Text>
        </View>
      </View>
    );
  }

  if (decoration === 'box') {
    return (
      <View style={[styles.scorecardInner, styles.boxInner]}>
        <Text style={styles.scorecardValue}>{score}</Text>
      </View>
    );
  }

  return (
    <View style={styles.scorecardPlain}>
      <Text style={styles.scorecardValue}>{score}</Text>
    </View>
  );
}

function ScorecardRow({
  round,
  player,
  holes,
  mode,
  handicapContext,
}: {
  round: Round;
  player: Player;
  holes: Array<HoleResult | undefined>;
  mode: ScorecardMode;
  handicapContext: ReturnType<typeof buildRoundHandicapContext>;
}) {
  return (
    <View style={styles.scorecardRow}>
        <View style={styles.scorecardHoles}>
        {holes.map((hole, index) => (
          <View
            key={`scorecard-cell-${player.id}-${index}-${hole?.holeNumber ?? 'empty'}`}
            style={styles.scorecardCell}
          >
            <Text style={styles.scorecardHoleLabel}>{hole?.holeNumber ?? index + 1}</Text>
            {renderScoreValue(round, player, hole, mode, handicapContext)}
          </View>
        ))}
      </View>
    </View>
  );
}

export function RoundSummaryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ roundId: string }>();
  const round = useAppStore((state) =>
    state.rounds.find((entry) => entry.id === params.roundId),
  );
  const completeRound = useAppStore((state) => state.completeRound);
  const [scorecardMode, setScorecardMode] = useState<ScorecardMode>('gross');

  if (!round) {
    return (
      <Screen>
        <Card>
          <Text style={styles.sectionTitle}>Round not found</Text>
          <Button label="Back home" onPress={() => router.replace('/')} />
        </Card>
      </Screen>
    );
  }

  const derived = deriveRoundState(round);
  const trackingFlags = getRoundTrackingFlags(round);
  const committedHoles = getCommittedHoles(round);
  const handicapContext = buildRoundHandicapContext(round);
  const frontNine = Array.from({ length: 9 }, (_, index) =>
    committedHoles.find((hole) => hole.holeNumber === index + 1),
  );
  const backNine = Array.from({ length: 9 }, (_, index) =>
    committedHoles.find((hole) => hole.holeNumber === index + 10),
  );
  const puttTotals = trackingFlags.trackPutts
    ? calculatePuttTotals(round.players, committedHoles)
    : [];
  const girTotals = trackingFlags.trackGir
    ? calculateTrackedBooleanTotals(round.players, committedHoles, 'gir')
    : [];
  const firTotals = trackingFlags.trackFir
    ? calculateTrackedBooleanTotals(round.players, committedHoles, 'fir')
    : [];

  return (
    <Screen>
      <ScreenHeader
        title="Round summary"
        subtitle={`${round.name}${round.status === 'complete' ? '  •  Complete' : '  •  In progress'}  •  ${round.scoringMode === 'net' ? 'Net' : 'Gross'}`}
        showBackButton
      />

      <Card>
        <Text style={styles.sectionTitle}>
          Settlement snapshot (through {committedHoles.length})
        </Text>
        {derived.settlementLines.map((line, index) => (
          <Text key={`settlement-${index}-${line}`} style={styles.lineItem}>
            {line}
          </Text>
        ))}
      </Card>

      {derived.games.map((game) => (
        <Card key={game.gameId}>
          <Text style={styles.sectionTitle}>{game.title}</Text>
          {game.kind === 'match-play' ? (
            <Text style={styles.lineItem}>{game.segment.statusText}</Text>
          ) : null}
          {game.kind === 'nassau'
            ? game.segments.map((segment) => (
                <Text key={segment.segmentId} style={styles.lineItem}>
                  {segment.label}: {segment.statusText}
                </Text>
              ))
            : null}
          {game.kind === 'wolf' ? (
            <>
              <Text style={styles.lineItem}>{game.leaderText}</Text>
              {game.totals.map((entry) => (
                <Text key={`wolf-${game.gameId}-${entry.playerId}`} style={styles.lineItem}>
                  {entry.label}: {entry.total}
                </Text>
              ))}
            </>
          ) : null}
          {game.kind === 'fir-gir' ? (
            <>
              <Text style={styles.lineItem}>{game.leaderText}</Text>
              <Text style={styles.helperText}>5 for FIR+GIR, 4 for FIR or GIR, minus putts, floor 0</Text>
              {game.totals.map((entry) => (
                <Text key={`fir-gir-${game.gameId}-${entry.playerId}`} style={styles.lineItem}>
                  {entry.label}: {entry.total}
                </Text>
              ))}
            </>
          ) : null}
        </Card>
      ))}

      {derived.contests.map((contest) => (
        <Card key={contest.contestType}>
          <Text style={styles.sectionTitle}>{contest.title}</Text>
          {contest.totals.map((entry) => (
            <Text key={`contest-${contest.contestType}-${entry.playerId}`} style={styles.lineItem}>
              {entry.label}: {entry.total}
            </Text>
          ))}
        </Card>
      ))}

      {trackingFlags.trackGir ? (
        <Card>
          <Text style={styles.sectionTitle}>GIR</Text>
          {girTotals.map((entry) => (
            <Text key={`gir-${entry.playerId}`} style={styles.lineItem}>
              {entry.label}: {entry.total}
            </Text>
          ))}
        </Card>
      ) : null}

      {trackingFlags.trackFir ? (
        <Card>
          <Text style={styles.sectionTitle}>FIR</Text>
          {firTotals.map((entry) => (
            <Text key={`fir-${entry.playerId}`} style={styles.lineItem}>
              {entry.label}: {entry.total}
            </Text>
          ))}
        </Card>
      ) : null}

      {trackingFlags.trackPutts ? (
        <Card>
          <Text style={styles.sectionTitle}>Putts</Text>
          {puttTotals.map((entry) => (
            <Text key={`putts-${entry.playerId}`} style={styles.lineItem}>
              {entry.label}: {entry.total}
            </Text>
          ))}
        </Card>
      ) : null}

      <Card>
        <Text style={styles.sectionTitle}>Scorecards</Text>
        {handicapContext.eligible ? (
          <View style={styles.scorecardModeRow}>
            <Chip
              label="Gross"
              selected={scorecardMode === 'gross'}
              onPress={() => setScorecardMode('gross')}
            />
            <Chip
              label="Net"
              selected={scorecardMode === 'net'}
              onPress={() => setScorecardMode('net')}
            />
          </View>
        ) : null}
        {round.players.map((player) => {
          const outTotal = calculateScorecardSegmentTotal(
            round,
            player,
            frontNine,
            scorecardMode,
            handicapContext,
          );
          const inTotal = calculateScorecardSegmentTotal(
            round,
            player,
            backNine,
            scorecardMode,
            handicapContext,
          );

          return (
            <View key={`scorecard-${player.id}`} style={styles.scorecardPlayerBlock}>
              <Text style={styles.scorecardPlayerName}>{player.name}</Text>
              <Text style={styles.helperText}>Front 9</Text>
              <ScorecardRow
                round={round}
                player={player}
                holes={frontNine}
                mode={scorecardMode}
                handicapContext={handicapContext}
              />
              <Text style={styles.helperText}>Back 9</Text>
              <ScorecardRow
                round={round}
                player={player}
                holes={backNine}
                mode={scorecardMode}
                handicapContext={handicapContext}
              />
              <Text style={styles.scorecardTotals}>
                Out {outTotal}  •  In {inTotal}  •  Total {outTotal + inTotal}
              </Text>
            </View>
          );
        })}
      </Card>

      <View style={styles.actions}>
        {round.status === 'complete' ? (
          <Button label="Back home" onPress={() => router.replace('/')} />
        ) : (
          <>
            <Button
              label="Back to round"
              variant="secondary"
              onPress={() => router.back()}
            />
            <Button
              label="Mark round complete"
              onPress={() => {
                completeRound(round.id);
                router.replace('/');
              }}
            />
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#17352b',
  },
  lineItem: {
    color: '#17352b',
    lineHeight: 22,
  },
  helperText: {
    color: '#655945',
    lineHeight: 18,
  },
  scorecardRow: {
    gap: 6,
  },
  scorecardPlayerBlock: {
    gap: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#eadfca',
  },
  scorecardPlayerName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#17352b',
  },
  scorecardModeRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  scorecardHoles: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  scorecardCell: {
    width: 30,
    alignItems: 'center',
    gap: 3,
  },
  scorecardHoleLabel: {
    fontSize: 9,
    color: '#8c7f65',
    fontWeight: '700',
  },
  scorecardOuter: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scorecardInner: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleOuter: {
    borderWidth: 1.25,
    borderColor: '#17352b',
    borderRadius: 14,
  },
  circleInner: {
    borderWidth: 1.25,
    borderColor: '#17352b',
    borderRadius: 12,
  },
  boxOuter: {
    borderWidth: 1.25,
    borderColor: '#17352b',
  },
  boxInner: {
    borderWidth: 1.25,
    borderColor: '#17352b',
  },
  scorecardPlain: {
    width: 22,
    height: 22,
    borderRadius: 7,
    backgroundColor: '#efe6d4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scorecardValue: {
    fontSize: 10,
    fontWeight: '800',
    color: '#17352b',
  },
  scorecardEmpty: {
    fontSize: 10,
    fontWeight: '700',
    color: '#b4a48b',
    width: 22,
    textAlign: 'center',
  },
  scorecardTotals: {
    color: '#17352b',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  actions: {
    gap: 10,
  },
});
