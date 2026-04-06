import { Pressable, StyleSheet, Text } from 'react-native';

interface ChipProps {
  label: string;
  selected?: boolean;
  disabled?: boolean;
  onPress?: () => void;
}

export function Chip({ label, selected, disabled, onPress }: ChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: Boolean(selected), disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.chip, selected && styles.selectedChip, disabled && styles.disabledChip]}
    >
      <Text
        style={[
          styles.label,
          selected && styles.selectedLabel,
          disabled && styles.disabledLabel,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#cbbda2',
    backgroundColor: '#f8f2e7',
  },
  selectedChip: {
    backgroundColor: '#17352b',
    borderColor: '#17352b',
  },
  disabledChip: {
    opacity: 0.45,
  },
  label: {
    color: '#17352b',
    fontWeight: '600',
    fontSize: 13,
  },
  selectedLabel: {
    color: '#fffaf1',
  },
  disabledLabel: {
    color: '#6f6658',
  },
});
