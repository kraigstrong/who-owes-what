import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  showBackButton?: boolean;
  rightAction?: {
    label: string;
    onPress: () => void;
  };
}

export function ScreenHeader({
  title,
  subtitle,
  showBackButton,
  rightAction,
}: ScreenHeaderProps) {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        {showBackButton ? (
          <Button label="Back" variant="ghost" onPress={() => router.back()} />
        ) : (
          <View />
        )}
        {rightAction ? (
          <Button
            label={rightAction.label}
            variant="secondary"
            onPress={rightAction.onPress}
          />
        ) : (
          <View />
        )}
      </View>
      <View style={styles.textBlock}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  textBlock: {
    gap: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#17352b',
  },
  subtitle: {
    color: '#655945',
    lineHeight: 20,
  },
});
