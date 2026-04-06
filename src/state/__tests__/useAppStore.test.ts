jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import { createDefaultSetupDraft } from '@/domain/round';
import { useAppStore } from '@/state/useAppStore';

describe('useAppStore round retention', () => {
  beforeEach(() => {
    useAppStore.setState({
      rounds: [],
      recentCourses: [],
      setupDraft: {
        ...createDefaultSetupDraft(),
        playerNames: ['Alice', 'Bob', '', ''],
      },
    });
  });

  it('keeps completed rounds when starting a new round', () => {
    const firstRound = useAppStore.getState().createRoundFromDraft();
    useAppStore.getState().completeRound(firstRound.id);

    useAppStore.getState().updateSetupDraft({
      roundName: 'Second round',
      playerNames: ['Avery', 'Blair', '', ''],
    });

    const secondRound = useAppStore.getState().createRoundFromDraft();
    const rounds = useAppStore.getState().rounds;

    expect(rounds).toHaveLength(2);
    expect(rounds.find((round) => round.id === firstRound.id)?.status).toBe('complete');
    expect(rounds.find((round) => round.id === secondRound.id)?.status).toBe('in-progress');
  });
});
