import { useRef, useEffect } from 'react';
import { View, Text, Image, Animated, Easing, StyleSheet } from 'react-native';

export default function LoadingScreen({ onComplete }) {
  const progress = useRef(new Animated.Value(0)).current;
  const opacity  = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: 2000,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => onComplete());
    });
  }, []);

  const barWidth = progress.interpolate({
    inputRange:  [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <Animated.View testID="loading-screen" style={[styles.container, { opacity }]}>
      <Image source={require('./assets/math_bro.png')} style={styles.logo} resizeMode="contain" />
      <Text style={styles.title}>Math Buddy</Text>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, { width: barWidth }]} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#00050f',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  logo: {
    width: 160,
    height: 160,
  },
  title: {
    fontSize: 40,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 1,
  },
  track: {
    width: '60%',
    height: 10,
    backgroundColor: '#1a1a2e',
    borderRadius: 5,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: '#c084fc',
    borderRadius: 5,
  },
});
