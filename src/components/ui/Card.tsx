import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

interface CardProps {
  children: ReactNode;
}

export function Card({ children }: CardProps) {
  return <View style={styles.card}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fffaf1',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#ddd1ba',
    gap: 12,
    shadowColor: '#5b4a24',
    shadowOpacity: 0.07,
    shadowRadius: 12,
    shadowOffset: {
      width: 0,
      height: 6,
    },
    elevation: 2,
  },
});
