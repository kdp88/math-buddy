import { Suspense } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';

export default function GameLoader({ children, color = '#c084fc', background = '#0a0a1a' }) {
  return (
    <Suspense fallback={
      <View style={[styles.loader, { backgroundColor: background }]}>
        <ActivityIndicator size="large" color={color} />
      </View>
    }>
      {children}
    </Suspense>
  );
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
