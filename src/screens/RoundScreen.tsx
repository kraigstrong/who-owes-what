import { useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, Switch, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { refreshManagedSelectedCourse } from '@/data/course/managedCatalog';
import {
  buildRoundHandicapContext,
  getCompetitionStrokesForHole,
  getNetHoleScore,
} from '@/domain/calculators/handicap';
import { getWolfPlayerIdForHole } from '@/domain/calculators/manualPoints';
import {
  findTeeById,
  formatCourseDisplayName,
  formatTeeDisplayName,
  selectDefaultTee,
} from '@/domain/course';
import { getResumeHoleNumber } from '@/domain/roundProgress';
import { getRoundSideLabel } from '@/domain/sideLabels';
import { getRoundTrackingFlags } from '@/domain/tracking';
import type { ContestType, WolfGameConfig } from '@/domain/round';
import { useAppStore } from '@/state/useAppStore';

function contestLabel(contestType: ContestType): string {
  switch (contestType) {
    case 'kp':
      return 'KP';
    case 'longest-putt':
      return 'Longest putt';
    case 'longest-drive':
      return 'Longest drive';
  }
}

function scoreDecoration(score: number, par: number) {
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

function getSharedValue(values: Array<number | undefined>): number | undefined {
  const definedValues = values.filter((value): value is number => value !== undefined);

  if (definedValues.length === 0) {
    return undefined;
  }

  return definedValues.every((value) => value === definedValues[0]) ? definedValues[0] : undefined;
}

export function RoundScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ roundId: string }>();
  const round = useAppStore((state) =>
    state.rounds.find((entry) => entry.id === params.roundId),
  );
  const seedHoleScores = useAppStore((state) => state.seedHoleScores);
  const seedHolePutts = useAppStore((state) => state.seedHolePutts);
  const seedHoleGamePoints = useAppStore((state) => state.seedHoleGamePoints);
  const commitHole = useAppStore((state) => state.commitHole);
  const updateHolePlayerValue = useAppStore((state) => state.updateHolePlayerValue);
  const updateHoleContest = useAppStore((state) => state.updateHoleContest);
  const updateHoleGamePoints = useAppStore((state) => state.updateHoleGamePoints);

  const [holeNumber, setHoleNumber] = useState(1);

  useEffect(() => {
    if (!round) {
      return;
    }

    setHoleNumber(getResumeHoleNumber(round));
  }, [round?.id]);

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

  const effectiveCourse = refreshManagedSelectedCourse(round.course);
  const defaultTee = effectiveCourse ? selectDefaultTee(effectiveCourse) : undefined;
  const assignedTees = round.players.map(
    (player) => findTeeById(effectiveCourse, round.playerTeeIds[player.id]) ?? defaultTee,
  );
  const distinctTeeIds = Array.from(
    new Set(assignedTees.map((tee) => tee?.id).filter((teeId): teeId is string => Boolean(teeId))),
  );
  const sharedTee = distinctTeeIds.length === 1 ? assignedTees.find(Boolean) : undefined;
  const holeMetas = assignedTees
    .map((tee) => tee?.holes[holeNumber - 1])
    .filter((hole): hole is NonNullable<typeof hole> => Boolean(hole));
  const sharedPar =
    sharedTee?.holes[holeNumber - 1]?.par ?? getSharedValue(holeMetas.map((hole) => hole.par));
  const sharedYardage =
    sharedTee?.holes[holeNumber - 1]?.yardage ??
    getSharedValue(holeMetas.map((hole) => hole.yardage));
  const sharedStrokeIndex =
    sharedTee?.holes[holeNumber - 1]?.strokeIndex ??
    getSharedValue(holeMetas.map((hole) => hole.strokeIndex));
  const trackingFlags = getRoundTrackingFlags(round);
  const handicapContext = buildRoundHandicapContext(round);
  const currentHole = round.holes[holeNumber - 1];
  const defaultScore = sharedPar ?? 4;
  const defaultPutts = 2;
  const defaultWolfPoints = 0;
  const isTeamRound = round.sides.some((side) => side.playerIds.length > 1);
  const wolfGame = round.activeGames.find(
    (game): game is WolfGameConfig => game.type === 'wolf',
  );
  const currentWolfPlayerId = wolfGame
    ? getWolfPlayerIdForHole(wolfGame.rotationOrderPlayerIds, holeNumber)
    : null;
  const currentWolfName =
    round.players.find((player) => player.id === currentWolfPlayerId)?.name ?? 'Unknown';
  const showKp = round.activeContests.includes('kp') && sharedPar === 3;
  const showLongestDrive =
    round.activeContests.includes('longest-drive') && sharedPar !== 3;
  const visibleContests = [
    showKp ? ('kp' as const) : null,
    round.activeContests.includes('longest-putt')
      ? ('longest-putt' as const)
      : null,
    showLongestDrive ? ('longest-drive' as const) : null,
  ].filter((contestType): contestType is ContestType => Boolean(contestType));

  const courseSubtitle = useMemo(() => {
    const parts: string[] = [];

    if (effectiveCourse) {
      parts.push(
        `${formatCourseDisplayName(effectiveCourse)} / ${
          sharedTee
            ? `${formatTeeDisplayName(sharedTee.name, sharedTee.gender)} tee`
            : 'Mixed tees'
        }`,
      );
    } else {
      parts.push('Manual round');
    }

    if (sharedPar) {
      parts.push(`Par ${sharedPar}`);
    }

    if (sharedYardage) {
      parts.push(`${sharedYardage} yds`);
    }

    if (sharedStrokeIndex) {
      parts.push(`HCP ${sharedStrokeIndex}`);
    }

    parts.push(round.scoringMode === 'net' ? 'Net' : 'Gross');

    return parts.join('  •  ');
  }, [effectiveCourse, round.scoringMode, sharedPar, sharedStrokeIndex, sharedTee, sharedYardage]);

  useEffect(() => {
    seedHoleScores(round.id, holeNumber, defaultScore);
  }, [defaultScore, holeNumber, round.id, seedHoleScores]);

  useEffect(() => {
    if (!trackingFlags.trackPutts) {
      return;
    }

    seedHolePutts(round.id, holeNumber, defaultPutts);
  }, [defaultPutts, holeNumber, round.id, seedHolePutts, trackingFlags.trackPutts]);

  useEffect(() => {
    if (!wolfGame) {
      return;
    }

    seedHoleGamePoints(round.id, holeNumber, wolfGame.id, defaultWolfPoints);
  }, [defaultWolfPoints, holeNumber, round.id, seedHoleGamePoints, wolfGame]);

  const goToNextHole = () => {
    commitHole(round.id, holeNumber);
    setHoleNumber((current) => Math.min(round.holeCount, current + 1));
  };

  const goToSummaryAndCommitHole = () => {
    commitHole(round.id, holeNumber);
    router.push(`/round/${round.id}/summary`);
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>{round.name}</Text>
        <ScreenHeader
          title={`Hole ${holeNumber}`}
          subtitle={courseSubtitle}
          showBackButton
          rightAction={{
            label: 'Summary',
            onPress: () => router.push(`/round/${round.id}/summary`),
          }}
        />
        <View style={styles.row}>
          <Button
            label="Previous"
            variant="ghost"
            disabled={holeNumber === 1}
            onPress={() => setHoleNumber((current) => Math.max(1, current - 1))}
          />
          <Button
            label="Next"
            variant="ghost"
            disabled={holeNumber === round.holeCount}
            onPress={goToNextHole}
          />
        </View>
      </View>

      <Card>
        <Text style={styles.sectionTitle}>What happened on this hole?</Text>
        {round.players.map((player) => {
          const playerHole = currentHole.playerResults[player.id] ?? {};
          const score = playerHole.strokes ?? defaultScore;
          const putts = playerHole.putts ?? defaultPutts;
          const maxPutts = Math.max(0, score - 1);
          const canDecreasePutts = putts > 0;
          const canIncreasePutts = putts < maxPutts;
          const decoration = scoreDecoration(score, defaultScore);
          const competitionStrokes =
            round.scoringMode === 'net' && handicapContext.eligible
              ? getCompetitionStrokesForHole(handicapContext, player.id, holeNumber)
              : 0;
          const netScore = getNetHoleScore(score, competitionStrokes);

          return (
            <View key={player.id} style={styles.playerCard}>
              <View style={styles.playerHeader}>
                <Text style={styles.playerName}>{player.name}</Text>
                {isTeamRound ? (
                  <Text style={styles.helperText}>
                    {getRoundSideLabel(round, player.sideId)}
                  </Text>
                ) : null}
              </View>

              <View style={styles.scoreRow}>
                <Text style={styles.scoreLabel}>Score</Text>
                <View style={styles.scoreCluster}>
                  <Button
                    label="-"
                    variant="ghost"
                    style={styles.scoreAdjustButton}
                    onPress={() =>
                      updateHolePlayerValue(
                        round.id,
                        holeNumber,
                        player.id,
                        'strokes',
                        Math.max(1, score - 1),
                      )
                    }
                  />
                  <View style={styles.scoreBadgeFrame}>
                    {decoration === 'double-circle' ? (
                      <View style={[styles.scoreBadgeOuter, styles.circleOuter]}>
                        <View style={[styles.scoreBadgeInner, styles.circleInner]}>
                          <Text style={styles.scoreValue}>{score}</Text>
                        </View>
                      </View>
                    ) : null}
                    {decoration === 'circle' ? (
                      <View style={[styles.scoreBadgeInner, styles.circleInner]}>
                        <Text style={styles.scoreValue}>{score}</Text>
                      </View>
                    ) : null}
                    {decoration === 'double-box' ? (
                      <View style={[styles.scoreBadgeOuter, styles.boxOuter]}>
                        <View style={[styles.scoreBadgeInner, styles.boxInner]}>
                          <Text style={styles.scoreValue}>{score}</Text>
                        </View>
                      </View>
                    ) : null}
                    {decoration === 'box' ? (
                      <View style={[styles.scoreBadgeInner, styles.boxInner]}>
                        <Text style={styles.scoreValue}>{score}</Text>
                      </View>
                    ) : null}
                    {decoration === 'plain' ? (
                      <View style={styles.scorePlain}>
                        <Text style={styles.scoreValue}>{score}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Button
                    label="+"
                    variant="ghost"
                    style={styles.scoreAdjustButton}
                    onPress={() =>
                      updateHolePlayerValue(
                        round.id,
                        holeNumber,
                        player.id,
                        'strokes',
                        score + 1,
                      )
                    }
                  />
                </View>
              </View>

              {round.scoringMode === 'net' && handicapContext.eligible ? (
                <Text style={styles.netContextText}>
                  Net {netScore}
                  {competitionStrokes > 0 ? `  •  ${competitionStrokes} stroke` : ''}
                  {competitionStrokes > 1 ? 's' : ''}
                </Text>
              ) : null}

              {trackingFlags.trackFir || trackingFlags.trackGir ? (
                <View style={styles.switchRow}>
                  {trackingFlags.trackFir ? (
                    <>
                      <Text style={styles.helperText}>FIR</Text>
                      <Switch
                        value={Boolean(playerHole.fir)}
                        onValueChange={(value) =>
                          updateHolePlayerValue(round.id, holeNumber, player.id, 'fir', value)
                        }
                      />
                    </>
                  ) : null}
                  {trackingFlags.trackGir ? (
                    <>
                      <Text style={styles.helperText}>GIR</Text>
                      <Switch
                        value={Boolean(playerHole.gir)}
                        onValueChange={(value) =>
                          updateHolePlayerValue(round.id, holeNumber, player.id, 'gir', value)
                        }
                      />
                    </>
                  ) : null}
                </View>
              ) : null}

              {trackingFlags.trackPutts ? (
                <View style={styles.puttsRow}>
                  <Text style={styles.puttsLabel}>Putts</Text>
                  <View style={styles.puttsCluster}>
                    <Button
                      label="-"
                      variant="ghost"
                      style={styles.puttsAdjustButton}
                      disabled={!canDecreasePutts}
                      onPress={() =>
                        updateHolePlayerValue(
                          round.id,
                          holeNumber,
                          player.id,
                          'putts',
                          Math.max(0, putts - 1),
                        )
                      }
                    />
                    <View style={styles.puttsBadge}>
                      <Text style={styles.puttsValue}>{putts}</Text>
                    </View>
                    <Button
                      label="+"
                      variant="ghost"
                      style={styles.puttsAdjustButton}
                      disabled={!canIncreasePutts}
                      onPress={() =>
                        updateHolePlayerValue(
                          round.id,
                          holeNumber,
                          player.id,
                          'putts',
                          putts + 1,
                        )
                      }
                    />
                  </View>
                </View>
              ) : null}
            </View>
          );
        })}
      </Card>

      {visibleContests.length > 0 ? (
        <Card>
          <Text style={styles.sectionTitle}>Hole contests</Text>
          {visibleContests.map((contestType) => {
            const currentWinner =
              contestType === 'kp'
                ? currentHole.contests.kp
                : contestType === 'longest-putt'
                  ? currentHole.contests.longestPutt
                  : currentHole.contests.longestDrive;

            return (
              <View key={contestType} style={styles.contestBlock}>
                <Text style={styles.helperText}>{contestLabel(contestType)}</Text>
                <View style={styles.wrapRow}>
                  <Chip
                    label="None"
                    selected={!currentWinner}
                    onPress={() => updateHoleContest(round.id, holeNumber, contestType, null)}
                  />
                  {round.players.map((player) => (
                    <Chip
                      key={`${contestType}-${player.id}`}
                      label={player.name}
                      selected={currentWinner === player.id}
                      onPress={() =>
                        updateHoleContest(round.id, holeNumber, contestType, player.id)
                      }
                    />
                  ))}
                </View>
              </View>
            );
          })}
        </Card>
      ) : null}

      {wolfGame ? (
        <Card>
          <Text style={styles.sectionTitle}>Wolf</Text>
          <Text style={styles.wolfCurrentText}>Wolf: {currentWolfName}</Text>
          {round.players.map((player) => {
            const wolfPoints = currentHole.manualPoints?.[wolfGame.id]?.[player.id] ?? 0;

            return (
              <View key={`wolf-${player.id}`} style={styles.wolfPlayerRow}>
                <Text style={styles.wolfPlayerLabel}>{player.name}</Text>
                <View style={styles.wolfPointsCluster}>
                  <Button
                    label="-"
                    variant="ghost"
                    style={styles.wolfAdjustButton}
                    onPress={() =>
                      updateHoleGamePoints(
                        round.id,
                        holeNumber,
                        wolfGame.id,
                        player.id,
                        wolfPoints - 1,
                      )
                    }
                  />
                  <View style={styles.wolfPointsBadge}>
                    <Text style={styles.wolfPointsValue}>{wolfPoints}</Text>
                  </View>
                  <Button
                    label="+"
                    variant="ghost"
                    style={styles.wolfAdjustButton}
                    onPress={() =>
                      updateHoleGamePoints(
                        round.id,
                        holeNumber,
                        wolfGame.id,
                        player.id,
                        wolfPoints + 1,
                      )
                    }
                  />
                </View>
              </View>
            );
          })}
        </Card>
      ) : null}

      <Card>
        <View style={styles.bottomNavRow}>
          <Button
            label="Previous hole"
            variant="ghost"
            disabled={holeNumber === 1}
            onPress={() => setHoleNumber((current) => Math.max(1, current - 1))}
          />
          {holeNumber === round.holeCount ? (
            <Button
              label="View summary"
              onPress={goToSummaryAndCommitHole}
            />
          ) : (
            <Button
              label="Next hole"
              onPress={goToNextHole}
            />
          )}
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: 12,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: '#9a6b2f',
  },
  row: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#17352b',
  },
  wrapRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  playerCard: {
    gap: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#eadfca',
  },
  playerHeader: {
    gap: 4,
  },
  playerName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#17352b',
  },
  netContextText: {
    color: '#655945',
    lineHeight: 18,
    fontSize: 13,
  },
  helperText: {
    color: '#655945',
    lineHeight: 20,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  scoreLabel: {
    color: '#655945',
    fontSize: 13,
    fontWeight: '700',
  },
  scoreCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scoreAdjustButton: {
    minWidth: 44,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  scoreBadgeFrame: {
    minWidth: 58,
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreBadgeOuter: {
    width: 54,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreBadgeInner: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleOuter: {
    borderWidth: 1.5,
    borderColor: '#17352b',
    borderRadius: 27,
  },
  circleInner: {
    borderWidth: 1.5,
    borderColor: '#17352b',
    borderRadius: 23,
  },
  boxOuter: {
    borderWidth: 1.5,
    borderColor: '#17352b',
  },
  boxInner: {
    borderWidth: 1.5,
    borderColor: '#17352b',
  },
  scorePlain: {
    minWidth: 40,
    minHeight: 40,
    borderRadius: 12,
    backgroundColor: '#efe6d4',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  scoreValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#17352b',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  puttsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  puttsLabel: {
    color: '#655945',
    fontSize: 12,
    fontWeight: '700',
  },
  puttsCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  puttsAdjustButton: {
    minWidth: 36,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  puttsBadge: {
    minWidth: 34,
    minHeight: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d7c8ab',
    backgroundColor: '#fffdf8',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  puttsValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#17352b',
  },
  contestBlock: {
    gap: 10,
  },
  wolfCurrentText: {
    color: '#17352b',
    fontWeight: '600',
  },
  wolfPlayerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  wolfPlayerLabel: {
    flex: 1,
    color: '#17352b',
    fontWeight: '600',
  },
  wolfPointsCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  wolfAdjustButton: {
    minWidth: 36,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  wolfPointsBadge: {
    minWidth: 34,
    minHeight: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d7c8ab',
    backgroundColor: '#fffdf8',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  wolfPointsValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#17352b',
  },
  bottomNavRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
});
