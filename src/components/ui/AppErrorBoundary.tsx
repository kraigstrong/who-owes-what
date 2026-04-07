import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/ui/Card';

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  error?: Error;
  componentStack?: string | null;
}

export class AppErrorBoundary extends Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = {};

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      componentStack: errorInfo.componentStack,
    });

    console.error('App render error', error, errorInfo.componentStack);
  }

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <View style={styles.screen}>
        <Card>
          <Text style={styles.title}>App failed to load</Text>
          <Text style={styles.message}>{this.state.error.message}</Text>
          {this.state.componentStack ? (
            <ScrollView horizontal style={styles.scroll}>
              <Text style={styles.stack}>{this.state.componentStack.trim()}</Text>
            </ScrollView>
          ) : null}
        </Card>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f3efe4',
    padding: 16,
    justifyContent: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#7d3126',
  },
  message: {
    fontSize: 16,
    lineHeight: 22,
    color: '#17352b',
  },
  scroll: {
    maxHeight: 220,
  },
  stack: {
    color: '#655945',
    fontFamily: 'Courier',
    fontSize: 12,
    lineHeight: 18,
  },
});
