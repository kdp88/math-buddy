import { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';

// ─── 3D extruded symbol via stacked text layers ────────────────────────────────

const DEPTH_LAYERS = [
  { color: '#5b0825', dx: 7, dy: 7 },
  { color: '#7b1035', dx: 5, dy: 5 },
  { color: '#9b1545', dx: 3, dy: 3 },
  { color: '#be185d', dx: 1, dy: 1 },
  { color: '#f472b6', dx: 0, dy: 0 },
];

function Symbol3D({ char }) {
  return (
    <View style={s3d.wrap}>
      {DEPTH_LAYERS.map(({ color, dx, dy }) => (
        <View
          key={color}
          style={[s3d.layer, { transform: [{ translateX: dx }, { translateY: dy }] }]}
        >
          <Text style={[s3d.sym, { color }]}>{char}</Text>
        </View>
      ))}
    </View>
  );
}

const s3d = StyleSheet.create({
  wrap: {
    width:  72,
    height: 72,
  },
  // Each layer fills the wrap and uses flex to center — works on both iOS and Android
  layer: {
    position:       'absolute',
    top:            0,
    left:           0,
    right:          0,
    bottom:         0,
    alignItems:     'center',
    justifyContent: 'center',
  },
  sym: {
    fontSize:         48,
    fontWeight:       '900',
    textShadowColor:  'rgba(0,0,0,0.15)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
});

// ─── Button data ───────────────────────────────────────────────────────────────

const SYMBOLS = [
  { tap: '<', hint: 'less than'    },
  { tap: '=', hint: 'equal to'     },
  { tap: '>', hint: 'greater than' },
];

// ─── Main component ────────────────────────────────────────────────────────────

export default function CompareGame({ question, onCorrect, onWrong }) {
  const disabledRef = useRef(false);
  const shakeAnim   = useRef(new Animated.Value(0)).current;
  const scaleAnim   = useRef(new Animated.Value(1)).current;
  const isFirst     = useRef(true);

  useEffect(() => {
    if (isFirst.current) { isFirst.current = false; return; }
    disabledRef.current = false;
    shakeAnim.setValue(0);
    scaleAnim.setValue(1);
  }, [question]);

  function handleTap(tap) {
    if (disabledRef.current) return;
    disabledRef.current = true;

    if (tap === question.answer) {
      Animated.sequence([
        Animated.spring(scaleAnim, { toValue: 1.15, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1,    useNativeDriver: true }),
      ]).start(() => onCorrect());
    } else {
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue:  10, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue:   0, duration: 60, useNativeDriver: true }),
      ]).start(() => {
        disabledRef.current = false;
        onWrong();
      });
    }
  }

  return (
    <View testID="compare-container" style={styles.container}>
      <Animated.View style={[styles.btnRow, { transform: [{ translateX: shakeAnim }, { scale: scaleAnim }] }]}>
        {SYMBOLS.map(({ tap, hint }) => (
          <TouchableOpacity
            key={tap}
            testID={`compare-${tap}`}
            accessibilityLabel={hint}
            accessibilityRole="button"
            style={styles.btn}
            onPress={() => handleTap(tap)}
            activeOpacity={0.75}
          >
            <Symbol3D char={tap} />
            <Text style={styles.btnHint}>{hint}</Text>
          </TouchableOpacity>
        ))}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
  },
  btnRow: {
    flexDirection: 'row',
    gap:           16,
  },
  btn: {
    backgroundColor:   '#fdf2f8',
    borderRadius:      16,
    borderWidth:       2,
    borderColor:       '#be185d',
    paddingHorizontal: 20,
    paddingVertical:   16,
    alignItems:        'center',
    gap:               6,
  },
  btnHint: {
    fontSize:   11,
    color:      '#be185d',
    fontWeight: '600',
    textAlign:  'center',
  },
});
