import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, Text } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { formatCourseDisplayName } from '@/domain/course';
import { useAppStore } from '@/state/useAppStore';

function formatRoundDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function RoundHistoryScreen() {
  const router = useRouter();
  const rounds = useAppStore((state) => state.rounds);
  const completedRounds = useMemo(
    () =>
      rounds
        .filter((round) => round.status === 'complete')
        .sort(
          (left, right) =>
            Number(new Date(right.createdAt)) - Number(new Date(left.createdAt)),
        ),
    [rounds],
  );

  return (
    <Screen>
      <ScreenHeader
        title="Past rounds"
        subtitle="Completed rounds you can revisit anytime."
        showBackButton
      />

      {completedRounds.length === 0 ? (
        <Card>
          <Text style={styles.sectionTitle}>No past rounds yet</Text>
          <Text style={styles.helperText}>
            Completed rounds will show up here once you finish one.
          </Text>
        </Card>
      ) : (
        completedRounds.map((round) => (
          <Card key={round.id}>
            <Text style={styles.sectionTitle}>{round.name}</Text>
            <Text style={styles.helperText}>
              {formatRoundDate(round.createdAt)}
              {`  •  ${round.scoringMode === 'net' ? 'Net' : 'Gross'}`}
            </Text>
            <Text style={styles.helperText}>
              {round.course ? formatCourseDisplayName(round.course) : 'Manual round'}
            </Text>
            <Text style={styles.helperText}>
              {round.players.map((player) => player.name).join(', ')}
            </Text>
            <Button
              label="View summary"
              variant="secondary"
              onPress={() => router.push(`/round/${round.id}/summary`)}
            />
          </Card>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#17352b',
  },
  helperText: {
    color: '#655945',
    lineHeight: 20,
  },
});
