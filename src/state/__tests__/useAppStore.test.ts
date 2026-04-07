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

  it('forces FIR, GIR, and putts tracking when FIR/GIR is selected', () => {
    useAppStore.getState().toggleDraftGame('fir-gir');

    const draft = useAppStore.getState().setupDraft;

    expect(draft.selectedGames).toContain('fir-gir');
    expect(draft.trackPutts).toBe(true);
    expect(draft.trackGir).toBe(true);
    expect(draft.trackFir).toBe(true);
  });

  it('persists required FIR/GIR tracking on the created round', () => {
    useAppStore.getState().toggleDraftGame('fir-gir');

    const round = useAppStore.getState().createRoundFromDraft();

    expect(round.activeGames.some((game) => game.type === 'fir-gir')).toBe(true);
    expect(round.trackPutts).toBe(true);
    expect(round.trackGir).toBe(true);
    expect(round.trackFir).toBe(true);
  });
});
