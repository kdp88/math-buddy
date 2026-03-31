import { useRef, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';

const MECHANICS = ['croc', 'scale', 'archery'];

function pickNext(current) {
  const opts = MECHANICS.filter(m => m !== current);
  return opts[Math.floor(Math.random() * opts.length)];
}

export default function CompareGame({ question, onCorrect, onWrong }) {
  const [mechanic, setMechanic] = useState(
    () => MECHANICS[Math.floor(Math.random() * MECHANICS.length)]
  );
  // useRef guard prevents double-fire on rapid taps (state update is async)
  const disabledRef = useRef(false);
  const [faded, setFaded]       = useState(false);

  const crocBounce = useRef(new Animated.Value(1)).current;
  const leftPan    = useRef(new Animated.Value(0)).current;
  const rightPan   = useRef(new Animated.Value(0)).current;
  const arrowX     = useRef(new Animated.Value(0)).current;
  const isFirst    = useRef(true);

  // On new question (after correct): rotate mechanic + reset
  useEffect(() => {
    if (isFirst.current) { isFirst.current = false; return; }
    disabledRef.current = false;
    setFaded(false);
    setMechanic(m => pickNext(m));
    crocBounce.setValue(1);
    leftPan.setValue(0);
    rightPan.setValue(0);
    arrowX.setValue(0);
  }, [question]);

  function enable() {
    disabledRef.current = false;
    setFaded(false);
  }

  function handleTap(tap) {
    if (disabledRef.current) return;
    disabledRef.current = true;
    setFaded(true);

    // tap: 'left'|'right' for croc/scale, '<'|'>' for archery
    const correct =
      mechanic === 'archery'
        ? tap === question.answer
        : tap === (question.answer === '>' ? 'left' : 'right');

    if (mechanic === 'croc') {
      Animated.sequence([
        Animated.spring(crocBounce, { toValue: 1.6, useNativeDriver: true }),
        Animated.spring(crocBounce, { toValue: 1,   useNativeDriver: true }),
      ]).start(() => {
        if (correct) { onCorrect(); }
        else { crocBounce.setValue(1); enable(); onWrong(); }
      });

    } else if (mechanic === 'scale') {
      const heavy = tap === 'left' ? leftPan : rightPan;
      const light = tap === 'left' ? rightPan : leftPan;
      if (correct) {
        Animated.parallel([
          Animated.spring(heavy, { toValue:  28, useNativeDriver: true }),
          Animated.spring(light, { toValue: -28, useNativeDriver: true }),
        ]).start(() => onCorrect());
      } else {
        Animated.parallel([
          Animated.sequence([
            Animated.timing(leftPan,  { toValue: -12, duration: 70, useNativeDriver: true }),
            Animated.timing(leftPan,  { toValue:  12, duration: 70, useNativeDriver: true }),
            Animated.timing(leftPan,  { toValue:   0, duration: 70, useNativeDriver: true }),
          ]),
          Animated.sequence([
            Animated.timing(rightPan, { toValue:  12, duration: 70, useNativeDriver: true }),
            Animated.timing(rightPan, { toValue: -12, duration: 70, useNativeDriver: true }),
            Animated.timing(rightPan, { toValue:   0, duration: 70, useNativeDriver: true }),
          ]),
        ]).start(() => { leftPan.setValue(0); rightPan.setValue(0); enable(); onWrong(); });
      }

    } else { // archery
      Animated.timing(arrowX, {
        toValue:  tap === '<' ? -110 : 110,
        duration: 350,
        useNativeDriver: true,
      }).start(() => {
        if (correct) { onCorrect(); }
        else { arrowX.setValue(0); enable(); onWrong(); }
      });
    }
  }

  return (
    <View testID="compare-container" style={styles.container}>

      {/* ── CROCODILE ── */}
      {mechanic === 'croc' && (
        <View testID="compare-croc" style={styles.mechanic}>
          <Text style={styles.hint}>Tap the bigger number 🐊</Text>
          <View style={styles.cardRow}>
            <TouchableOpacity
              testID="compare-left"
              accessibilityLabel={`Left value: ${question.leftText}`}
              accessibilityRole="button"
              style={[styles.numCard, faded && styles.faded]}
              onPress={() => handleTap('left')}
              disabled={faded}
              activeOpacity={0.75}
            >
              <Text style={styles.numText}>{question.leftText}</Text>
            </TouchableOpacity>
            <Animated.Text style={[styles.crocEmoji, { transform: [{ scale: crocBounce }] }]}>
              🐊
            </Animated.Text>
            <TouchableOpacity
              testID="compare-right"
              accessibilityLabel={`Right value: ${question.rightText}`}
              accessibilityRole="button"
              style={[styles.numCard, faded && styles.faded]}
              onPress={() => handleTap('right')}
              disabled={faded}
              activeOpacity={0.75}
            >
              <Text style={styles.numText}>{question.rightText}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── BALANCE SCALE ── */}
      {mechanic === 'scale' && (
        <View testID="compare-scale" style={styles.mechanic}>
          <Text style={styles.scaleIcon}>⚖️</Text>
          <Text style={styles.hint}>Tap the heavier side!</Text>
          <View style={styles.cardRow}>
            <Animated.View style={{ transform: [{ translateY: leftPan }] }}>
              <TouchableOpacity
                testID="compare-left"
                accessibilityLabel={`Left value: ${question.leftText}`}
                accessibilityRole="button"
                style={[styles.numCard, faded && styles.faded]}
                onPress={() => handleTap('left')}
                disabled={faded}
                activeOpacity={0.75}
              >
                <Text style={styles.numText}>{question.leftText}</Text>
              </TouchableOpacity>
            </Animated.View>
            <Animated.View style={{ transform: [{ translateY: rightPan }] }}>
              <TouchableOpacity
                testID="compare-right"
                accessibilityLabel={`Right value: ${question.rightText}`}
                accessibilityRole="button"
                style={[styles.numCard, faded && styles.faded]}
                onPress={() => handleTap('right')}
                disabled={faded}
                activeOpacity={0.75}
              >
                <Text style={styles.numText}>{question.rightText}</Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </View>
      )}

      {/* ── ARCHERY ── */}
      {mechanic === 'archery' && (
        <View testID="compare-archery" style={styles.mechanic}>
          <View style={styles.archeryQuestion}>
            <Text style={styles.archeryNum}>{question.leftText}</Text>
            <Text style={styles.archeryQ}>?</Text>
            <Text style={styles.archeryNum}>{question.rightText}</Text>
          </View>
          <Animated.Text style={[styles.arrow, { transform: [{ translateX: arrowX }] }]}>
            →
          </Animated.Text>
          <View style={styles.cardRow}>
            <TouchableOpacity
              testID="compare-less"
              accessibilityLabel="Less than"
              accessibilityRole="button"
              style={[styles.symbolBtn, faded && styles.faded]}
              onPress={() => handleTap('<')}
              disabled={faded}
              activeOpacity={0.75}
            >
              <Text style={styles.symbolTxt}>{'<'}</Text>
              <Text style={styles.symbolHint}>Less than</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="compare-greater"
              accessibilityLabel="Greater than"
              accessibilityRole="button"
              style={[styles.symbolBtn, faded && styles.faded]}
              onPress={() => handleTap('>')}
              disabled={faded}
              activeOpacity={0.75}
            >
              <Text style={styles.symbolTxt}>{'>'}</Text>
              <Text style={styles.symbolHint}>Greater than</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex:              1,
    alignItems:        'center',
    justifyContent:    'center',
    paddingHorizontal: 24,
    gap:               28,
  },
  mechanic: {
    alignItems: 'center',
    gap:        28,
  },
  hint: {
    fontSize:   16,
    fontWeight: '600',
    color:      '#888',
  },
  cardRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           20,
  },
  numCard: {
    backgroundColor:   '#fff',
    borderRadius:      16,
    borderWidth:       2,
    borderColor:       '#ddd',
    paddingHorizontal: 28,
    paddingVertical:   22,
    alignItems:        'center',
    minWidth:          110,
    shadowColor:       '#000',
    shadowOpacity:     0.07,
    shadowRadius:      6,
    shadowOffset:      { width: 0, height: 2 },
    elevation:         2,
  },
  faded: { opacity: 0.55 },
  numText: {
    fontSize:   28,
    fontWeight: '800',
    color:      '#222',
  },
  crocEmoji: { fontSize: 52 },
  scaleIcon: { fontSize: 72 },

  // Archery
  archeryQuestion: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           16,
  },
  archeryNum: {
    fontSize:   36,
    fontWeight: '800',
    color:      '#222',
  },
  archeryQ: {
    fontSize:   36,
    fontWeight: '800',
    color:      '#be185d',
  },
  arrow: {
    fontSize: 52,
    color:    '#be185d',
  },
  symbolBtn: {
    backgroundColor:   '#fdf2f8',
    borderRadius:      16,
    borderWidth:       2,
    borderColor:       '#be185d',
    paddingHorizontal: 36,
    paddingVertical:   20,
    alignItems:        'center',
    gap:               4,
  },
  symbolTxt: {
    fontSize:   40,
    fontWeight: '900',
    color:      '#be185d',
    lineHeight: 48,
  },
  symbolHint: {
    fontSize:   11,
    color:      '#be185d',
    fontWeight: '600',
  },
});
