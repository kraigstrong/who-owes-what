import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Screen } from '@/components/ui/Screen';
import { getSetupNetScoringAvailability } from '@/domain/calculators/handicap';
import {
  findTeeById,
  formatCourseDisplayName,
  formatTeeDisplayName,
  selectDefaultTee,
  type SelectedCourse,
  type TeeOption,
} from '@/domain/course';
import {
  createDefaultRoundName,
  type ContestType,
  type GameType,
} from '@/domain/round';
import { useAppStore } from '@/state/useAppStore';

const GAME_OPTIONS: Array<{ type: GameType; label: string }> = [
  { type: 'match-play', label: 'Match Play' },
  { type: 'nassau', label: 'Nassau' },
  { type: 'wolf', label: 'Wolf' },
];

const CONTEST_OPTIONS: Array<{ type: ContestType; label: string }> = [
  { type: 'kp', label: 'KP' },
  { type: 'longest-putt', label: 'Longest Putt' },
  { type: 'longest-drive', label: 'Longest Drive' },
];

function getVisibleGameOptions(playerCount: 2 | 4, useTeams: boolean) {
  if (playerCount === 2) {
    return GAME_OPTIONS.filter((option) => option.type !== 'wolf');
  }

  if (useTeams) {
    return GAME_OPTIONS;
  }

  return GAME_OPTIONS.filter((option) => option.type === 'wolf');
}

function getWolfRotationIndexes(playerCount: 2 | 4, order: number[]) {
  const safeOrder = Array.isArray(order) ? order : [];
  const visibleIndexes = safeOrder.filter(
    (index, position, indexes) =>
      index < playerCount && indexes.indexOf(index) === position,
  );
  const missingIndexes = Array.from({ length: playerCount }, (_, index) => index).filter(
    (index) => !visibleIndexes.includes(index),
  );

  return [...visibleIndexes, ...missingIndexes];
}

function getPlayerLabel(index: number) {
  return `Player ${index + 1}`;
}

function getDisplayPlayerName(index: number, name: string | undefined) {
  return name?.trim() || getPlayerLabel(index);
}

function getTeeIndex(course: SelectedCourse, teeId: string | undefined): number {
  const matchIndex = course.tees.findIndex((tee) => tee.id === teeId);

  if (matchIndex >= 0) {
    return matchIndex;
  }

  const defaultTee = selectDefaultTee(course);
  return defaultTee ? course.tees.findIndex((tee) => tee.id === defaultTee.id) : 0;
}

function getAdjacentTee(
  course: SelectedCourse,
  teeId: string | undefined,
  direction: 'previous' | 'next',
): TeeOption | undefined {
  if (course.tees.length === 0) {
    return undefined;
  }

  const currentIndex = getTeeIndex(course, teeId);
  const nextIndex =
    direction === 'previous'
      ? Math.max(0, currentIndex - 1)
      : Math.min(course.tees.length - 1, currentIndex + 1);

  return course.tees[nextIndex];
}

function sanitizeHandicapInput(value: string) {
  const normalized = value.replace(/,/g, '.').replace(/[^0-9.-]/g, '');
  const leadingMinus = normalized.startsWith('-') ? '-' : '';
  const withoutMinus = normalized.replace(/-/g, '');
  const hasTrailingDecimal = withoutMinus.endsWith('.');
  const [integerPart = '', ...decimalParts] = withoutMinus.split('.');
  const decimalPart = decimalParts.join('');

  if (hasTrailingDecimal) {
    return `${leadingMinus}${integerPart}.`;
  }

  return decimalPart.length > 0
    ? `${leadingMinus}${integerPart}.${decimalPart}`
    : `${leadingMinus}${integerPart}`;
}

function formatCourseLocation(course: SelectedCourse) {
  return [course.city, course.state].filter(Boolean).join(', ') || 'No location';
}

function formatTeeMeta(tee: TeeOption | undefined) {
  if (!tee) {
    return '';
  }

  const parts = [
    tee.totalYards ? `${tee.totalYards} yds` : null,
    tee.rating ? `Rating ${tee.rating}` : null,
    tee.slope ? `Slope ${tee.slope}` : null,
  ].filter(Boolean);

  return parts.join('  •  ');
}

export function StartRoundScreen() {
  const router = useRouter();
  const scrollRef = useRef<ScrollView | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const rounds = useAppStore((state) => state.rounds);
  const setupDraft = useAppStore((state) => state.setupDraft);
  const updateSetupDraft = useAppStore((state) => state.updateSetupDraft);
  const updatePlayerName = useAppStore((state) => state.updatePlayerName);
  const updatePlayerHandicap = useAppStore((state) => state.updatePlayerHandicap);
  const updatePlayerTeeId = useAppStore((state) => state.updatePlayerTeeId);
  const setSameTeeForAll = useAppStore((state) => state.setSameTeeForAll);
  const applyTeeToAllPlayers = useAppStore((state) => state.applyTeeToAllPlayers);
  const toggleDraftGame = useAppStore((state) => state.toggleDraftGame);
  const toggleDraftContest = useAppStore((state) => state.toggleDraftContest);
  const moveWolfDraftPlayer = useAppStore((state) => state.moveWolfDraftPlayer);
  const setSelectedCourseForDraft = useAppStore((state) => state.setSelectedCourseForDraft);
  const createRoundFromDraft = useAppStore((state) => state.createRoundFromDraft);

  const activePlayers = setupDraft.playerNames.slice(0, setupDraft.playerCount);
  const activeHandicaps = (setupDraft.playerHandicaps ?? ['', '', '', '']).slice(
    0,
    setupDraft.playerCount,
  );
  const activePlayerTeeIds = (setupDraft.playerTeeIds ?? ['', '', '', '']).slice(
    0,
    setupDraft.playerCount,
  );
  const selectedCourse = setupDraft.selectedCourse;
  const defaultCourseTee = selectedCourse ? selectDefaultTee(selectedCourse) : undefined;
  const effectiveSelectedGames =
    setupDraft.playerCount === 2
      ? setupDraft.selectedGames.filter((game) => game !== 'wolf')
      : setupDraft.useTeams
        ? setupDraft.selectedGames
        : setupDraft.selectedGames.filter((game) => game === 'wolf');
  const visibleGameOptions = getVisibleGameOptions(
    setupDraft.playerCount,
    setupDraft.useTeams,
  );
  const wolfSelected = effectiveSelectedGames.includes('wolf');
  const wolfRotationIndexes = getWolfRotationIndexes(
    setupDraft.playerCount,
    setupDraft.wolfRotationPlayerIndexes ?? [],
  );
  const inProgressRounds = rounds.filter((round) => round.status === 'in-progress');
  const latestInProgressRound = inProgressRounds[0];
  const completedRounds = rounds
    .filter((round) => round.status === 'complete')
    .sort(
      (left, right) =>
        Number(new Date(right.createdAt)) - Number(new Date(left.createdAt)),
    );
  const latestCompletedRound = completedRounds[0];
  const netScoringAvailability = getSetupNetScoringAvailability(setupDraft);
  const hasSelectedScoring =
    effectiveSelectedGames.length > 0 ||
    setupDraft.selectedContests.length > 0 ||
    setupDraft.trackPutts ||
    setupDraft.trackGir ||
    setupDraft.trackFir;
  const canStartRound =
    activePlayers.every((name) => name.trim().length > 0) &&
    hasSelectedScoring &&
    (!selectedCourse || activePlayerTeeIds.every((teeId) => teeId.trim().length > 0));

  useFocusEffect(
    useCallback(() => {
      scrollRef.current?.scrollTo({
        x: 0,
        y: 0,
        animated: false,
      });
    }, []),
  );

  const startRound = useCallback(() => {
    const round = createRoundFromDraft();
    router.push(`/round/${round.id}`);
  }, [createRoundFromDraft, router]);

  const handleStartRound = useCallback(() => {
    if (!latestInProgressRound) {
      startRound();
      return;
    }

    Alert.alert(
      'Start new round?',
      'Your previously in progress game will be lost.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Start round',
          style: 'destructive',
          onPress: startRound,
        },
      ],
    );
  }, [latestInProgressRound, startRound]);

  const openMenu = useCallback(() => {
    setMenuOpen((current) => !current);
  }, []);

  const renderPlayerEntryRow = (index: number) => (
    <View key={`player-input-${index + 1}`} style={styles.playerEntryRow}>
      <TextInput
        placeholder={getPlayerLabel(index)}
        placeholderTextColor="#8c7f65"
        style={styles.playerEntryInput}
        value={activePlayers[index] ?? ''}
        onChangeText={(nextName) => updatePlayerName(index, nextName)}
      />
      <TextInput
        placeholder="HCP"
        placeholderTextColor="#8c7f65"
        style={styles.playerHcpInput}
        value={activeHandicaps[index] ?? ''}
        keyboardType="decimal-pad"
        onChangeText={(nextValue) =>
          updatePlayerHandicap(index, sanitizeHandicapInput(nextValue))
        }
      />
    </View>
  );

  const renderTeeSelectorRow = (
    label: string,
    teeId: string | undefined,
    onChange: (teeId: string) => void,
  ) => {
    if (!selectedCourse || selectedCourse.tees.length === 0) {
      return null;
    }

    const tee = findTeeById(selectedCourse, teeId) ?? defaultCourseTee ?? selectedCourse.tees[0];
    const previousTee = getAdjacentTee(selectedCourse, tee?.id, 'previous');
    const nextTee = getAdjacentTee(selectedCourse, tee?.id, 'next');

    return (
      <View key={label} style={styles.teeSelectorRow}>
        <Text style={styles.teeSelectorLabel}>{label}</Text>
        <View style={styles.teeSelectorControls}>
          <Button
            label="←"
            variant="ghost"
            style={styles.teeArrowButton}
            disabled={!previousTee || previousTee.id === tee?.id}
            onPress={() => previousTee && onChange(previousTee.id)}
          />
          <View style={styles.teeValueCard}>
            <Text style={styles.teeValueName}>
              {tee ? formatTeeDisplayName(tee.name, tee.gender) : 'No tee'}
            </Text>
            {tee ? <Text style={styles.teeValueMeta}>{formatTeeMeta(tee)}</Text> : null}
          </View>
          <Button
            label="→"
            variant="ghost"
            style={styles.teeArrowButton}
            disabled={!nextTee || nextTee.id === tee?.id}
            onPress={() => nextTee && onChange(nextTee.id)}
          />
        </View>
      </View>
    );
  };

  return (
    <Screen scrollRef={scrollRef}>
      <View style={styles.hero}>
        <View style={styles.heroRow}>
          <Text style={styles.title}>Side Bets</Text>
          <View style={styles.menuAnchor}>
            <View style={[styles.menuWrap, menuOpen && styles.menuWrapOpen]}>
              <Button
                label="≡"
                variant="ghost"
                style={styles.menuButton}
                onPress={openMenu}
              />
            </View>
            {menuOpen ? (
              <Pressable
                style={styles.menuItem}
                onPress={() => {
                  setMenuOpen(false);
                  router.push('/round-history');
                }}
              >
                <Text style={styles.menuItemText}>Past rounds</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>

      {latestInProgressRound ? (
        <Card>
          <Text style={styles.sectionTitle}>Continue current round</Text>
          <Text style={styles.savedRoundTitle}>{latestInProgressRound.name}</Text>
          <Text style={styles.helperText}>
            {latestInProgressRound.course
              ? `${latestInProgressRound.course.courseName}  •  `
              : ''}
            {latestInProgressRound.players.map((player) => player.name).join(', ')}
          </Text>
          <Button
            label="Resume latest round"
            onPress={() => router.push(`/round/${latestInProgressRound.id}`)}
          />
        </Card>
      ) : latestCompletedRound ? (
        <Card>
          <Text style={styles.sectionTitle}>Most recent round</Text>
          <Text style={styles.savedRoundTitle}>{latestCompletedRound.name}</Text>
          <Text style={styles.helperText}>
            {latestCompletedRound.course
              ? `${latestCompletedRound.course.courseName}  •  `
              : ''}
            {latestCompletedRound.players.map((player) => player.name).join(', ')}
          </Text>
          <Button
            label="View summary"
            onPress={() => router.push(`/round/${latestCompletedRound.id}/summary`)}
          />
        </Card>
      ) : null}

      <Card>
        <Text style={styles.sectionTitle}>Course</Text>
        {selectedCourse ? (
          <>
            <Text style={styles.courseName}>
              {formatCourseDisplayName(selectedCourse)}
            </Text>
            <Text style={styles.helperText}>
              {formatCourseLocation(selectedCourse)}
              {`  •  ${selectedCourse.tees.length} tees`}
            </Text>
            <View style={styles.row}>
              <Button
                label="Change course"
                variant="secondary"
                onPress={() => router.push('/course-picker')}
              />
              <Button
                label="Clear"
                variant="ghost"
                onPress={() => setSelectedCourseForDraft(undefined)}
              />
            </View>
          </>
        ) : (
          <>
            <Text style={styles.helperText}>
              Pick a course first, then choose tees for each player.
            </Text>
            <Button
              label="Choose course"
              variant="secondary"
              onPress={() => router.push('/course-picker')}
            />
          </>
        )}
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Round setup</Text>
        <TextInput
          placeholder={createDefaultRoundName()}
          placeholderTextColor="#8c7f65"
          style={styles.input}
          value={setupDraft.roundName}
          onChangeText={(roundName) => updateSetupDraft({ roundName })}
        />
        <View style={styles.row}>
          <Chip
            label="2 players"
            selected={setupDraft.playerCount === 2}
            onPress={() =>
              updateSetupDraft({
                playerCount: 2,
                useTeams: true,
                selectedGames: setupDraft.selectedGames.filter((game) => game !== 'wolf'),
              })
            }
          />
          <Chip
            label="4 players"
            selected={setupDraft.playerCount === 4}
            onPress={() => updateSetupDraft({ playerCount: 4 })}
          />
          {setupDraft.playerCount === 4 ? (
            <Chip
              label="Teams"
              selected={setupDraft.useTeams}
              onPress={() =>
                updateSetupDraft({
                  useTeams: !setupDraft.useTeams,
                  selectedGames: setupDraft.useTeams
                    ? setupDraft.selectedGames.filter((game) => game === 'wolf')
                    : setupDraft.selectedGames,
                })
              }
            />
          ) : null}
        </View>

        {setupDraft.playerCount === 4 && setupDraft.useTeams ? (
          <View style={styles.teamStack}>
            <View style={styles.teamBlock}>
              <Text style={styles.teamTitle}>Team 1</Text>
              <View style={styles.playerEntryStack}>
                {renderPlayerEntryRow(0)}
                {renderPlayerEntryRow(1)}
              </View>
            </View>
            <View style={styles.teamBlock}>
              <Text style={styles.teamTitle}>Team 2</Text>
              <View style={styles.playerEntryStack}>
                {renderPlayerEntryRow(2)}
                {renderPlayerEntryRow(3)}
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.playerEntryStack}>
            {activePlayers.map((_, index) => renderPlayerEntryRow(index))}
          </View>
        )}
      </Card>

      {selectedCourse ? (
        <Card>
          <Text style={styles.sectionTitle}>Tee assignments</Text>
          <View style={styles.row}>
            <Chip
              label="Same tee for everyone"
              selected={setupDraft.sameTeeForAll}
              onPress={() => setSameTeeForAll(!setupDraft.sameTeeForAll)}
            />
          </View>

          {selectedCourse.tees.length === 0 ? (
            <Text style={styles.helperText}>No tee data available for this course.</Text>
          ) : setupDraft.sameTeeForAll ? (
            renderTeeSelectorRow(
              'Everyone',
              activePlayerTeeIds[0] || defaultCourseTee?.id,
              (teeId) => applyTeeToAllPlayers(teeId),
            )
          ) : (
            <View style={styles.teeAssignmentStack}>
              {activePlayers.map((name, index) =>
                renderTeeSelectorRow(
                  getDisplayPlayerName(index, name),
                  activePlayerTeeIds[index] || defaultCourseTee?.id,
                  (teeId) => updatePlayerTeeId(index, teeId),
                ),
              )}
            </View>
          )}
        </Card>
      ) : null}

      <Card>
        <Text style={styles.sectionTitle}>Games</Text>
        <Text style={styles.subsectionTitle}>Scoring</Text>
        <View style={styles.wrapRow}>
          <Chip
            label="Gross"
            selected={setupDraft.scoringMode === 'gross'}
            onPress={() => updateSetupDraft({ scoringMode: 'gross' })}
          />
          <Chip
            label="Net"
            selected={setupDraft.scoringMode === 'net'}
            disabled={!netScoringAvailability.eligible}
            onPress={() =>
              netScoringAvailability.eligible
                ? updateSetupDraft({ scoringMode: 'net' })
                : undefined
            }
          />
        </View>
        {!netScoringAvailability.eligible ? (
          <Text style={styles.helperText}>{netScoringAvailability.reason}</Text>
        ) : null}

        <Text style={styles.subsectionTitle}>Formats</Text>
        <View style={styles.wrapRow}>
          {visibleGameOptions.map((option) => (
            <Chip
              key={option.type}
              label={option.label}
              selected={setupDraft.selectedGames.includes(option.type)}
              onPress={() => toggleDraftGame(option.type)}
            />
          ))}
        </View>

        {wolfSelected && setupDraft.playerCount === 4 ? (
          <>
            <Text style={styles.subsectionTitle}>Wolf order</Text>
            <View style={styles.wolfOrderStack}>
              {wolfRotationIndexes.map((playerIndex, orderIndex) => (
                <View key={`wolf-order-${playerIndex}`} style={styles.wolfOrderRow}>
                  <View style={styles.wolfOrderLabelGroup}>
                    <Text style={styles.wolfOrderNumber}>{orderIndex + 1}</Text>
                    <Text style={styles.wolfOrderName}>
                      {getDisplayPlayerName(playerIndex, activePlayers[playerIndex])}
                    </Text>
                  </View>
                  <View style={styles.wolfOrderControls}>
                    <Button
                      label="↑"
                      variant="ghost"
                      style={styles.wolfOrderButton}
                      disabled={orderIndex === 0}
                      onPress={() => moveWolfDraftPlayer(playerIndex, 'earlier')}
                    />
                    <Button
                      label="↓"
                      variant="ghost"
                      style={styles.wolfOrderButton}
                      disabled={orderIndex === wolfRotationIndexes.length - 1}
                      onPress={() => moveWolfDraftPlayer(playerIndex, 'later')}
                    />
                  </View>
                </View>
              ))}
            </View>
          </>
        ) : null}

        <Text style={styles.subsectionTitle}>Hole contests</Text>
        <View style={styles.wrapRow}>
          {CONTEST_OPTIONS.map((option) => (
            <Chip
              key={option.type}
              label={option.label}
              selected={setupDraft.selectedContests.includes(option.type)}
              onPress={() => toggleDraftContest(option.type)}
            />
          ))}
        </View>

        <Text style={styles.subsectionTitle}>Stats Tracked</Text>
        <View style={styles.wrapRow}>
          <Chip
            label="Putts"
            selected={setupDraft.trackPutts}
            onPress={() =>
              updateSetupDraft({
                trackPutts: !setupDraft.trackPutts,
              })
            }
          />
          <Chip
            label="GIR"
            selected={setupDraft.trackGir}
            onPress={() =>
              updateSetupDraft({
                trackGir: !setupDraft.trackGir,
              })
            }
          />
          <Chip
            label="FIR"
            selected={setupDraft.trackFir}
            onPress={() =>
              updateSetupDraft({
                trackFir: !setupDraft.trackFir,
              })
            }
          />
        </View>
      </Card>

      <Button
        label="Start round"
        onPress={handleStartRound}
        disabled={!canStartRound}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    gap: 10,
    position: 'relative',
    zIndex: 20,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  menuAnchor: {
    position: 'relative',
    alignItems: 'flex-end',
    zIndex: 30,
  },
  menuWrap: {
    minWidth: 52,
    borderWidth: 1,
    borderColor: '#d4c3a4',
    borderRadius: 16,
    backgroundColor: '#fffdf8',
    overflow: 'visible',
    shadowColor: '#17352b',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 6,
    },
    elevation: 6,
  },
  menuWrapOpen: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  menuItem: {
    position: 'absolute',
    top: 40,
    right: 0,
    minWidth: 180,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#d4c3a4',
    borderRadius: 16,
    backgroundColor: '#fffdf8',
    shadowColor: '#17352b',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 6,
    },
    elevation: 6,
  },
  menuItemText: {
    color: '#17352b',
    fontSize: 14,
    fontWeight: '700',
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: '#9a6b2f',
  },
  title: {
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '800',
    color: '#17352b',
  },
  menuButton: {
    minWidth: 50,
    paddingHorizontal: 12,
    borderRadius: 0,
    backgroundColor: 'transparent',
  },
  subtitle: {
    color: '#655945',
    lineHeight: 22,
    fontSize: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#17352b',
  },
  subsectionTitle: {
    marginTop: 6,
    fontSize: 15,
    fontWeight: '700',
    color: '#17352b',
  },
  row: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  wrapRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  helperText: {
    color: '#655945',
    lineHeight: 20,
  },
  savedRoundTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#17352b',
  },
  courseName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#17352b',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d4c3a4',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fffdf8',
    color: '#17352b',
  },
  teamStack: {
    gap: 12,
  },
  teamBlock: {
    gap: 8,
    borderWidth: 1,
    borderColor: '#e0d4bc',
    borderRadius: 16,
    padding: 12,
    backgroundColor: '#fbf6ec',
  },
  teamTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#17352b',
  },
  playerEntryStack: {
    gap: 8,
  },
  playerEntryRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  playerEntryInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d4c3a4',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: '#fffdf8',
    color: '#17352b',
  },
  playerHcpInput: {
    width: 72,
    borderWidth: 1,
    borderColor: '#d4c3a4',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 14,
    textAlign: 'center',
    backgroundColor: '#fffdf8',
    color: '#17352b',
  },
  teeAssignmentStack: {
    gap: 10,
  },
  teeSelectorRow: {
    gap: 8,
  },
  teeSelectorLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#655945',
  },
  teeSelectorControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  teeArrowButton: {
    minWidth: 42,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  teeValueCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d9ccb2',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fffdf8',
    gap: 2,
  },
  teeValueName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#17352b',
  },
  teeValueMeta: {
    fontSize: 12,
    color: '#655945',
  },
  wolfOrderStack: {
    gap: 8,
  },
  wolfOrderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 4,
  },
  wolfOrderLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  wolfOrderNumber: {
    width: 22,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '700',
    color: '#9a6b2f',
  },
  wolfOrderName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#17352b',
  },
  wolfOrderControls: {
    flexDirection: 'row',
    gap: 6,
  },
  wolfOrderButton: {
    minWidth: 40,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
});
