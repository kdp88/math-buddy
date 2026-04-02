import { useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';

// ─── BlockDisplay ─────────────────────────────────────────────────────────────
// Renders base-10 block visuals: rod icons for tens, small squares for ones.
// Tens rods wrap at TENS_PER_ROW per row; ones squares wrap at 5 per row.

const TENS_PER_ROW = 5;

function BlockDisplay({ tens, ones, blockSize }) {
  const rodW   = Math.round(blockSize * 0.55);
  const rodH   = blockSize;
  const sqSize = Math.round(blockSize * 0.42);
  const gap    = Math.max(2, Math.round(blockSize * 0.08));

  // Max width so rods wrap at TENS_PER_ROW per row
  const tensMaxW = rodW * TENS_PER_ROW + gap * (TENS_PER_ROW - 1);
  const onesMaxW = sqSize * 5 + gap * 4;

  return (
    <View style={styles.blockDisplay}>
      {/* Tens rods — wrap into grid */}
      <View style={[styles.blockGroup, { gap, flexWrap: 'wrap', maxWidth: tensMaxW }]}>
        {Array.from({ length: tens }).map((_, i) => (
          <View
            key={i}
            style={[styles.rod, { width: rodW, height: rodH, borderRadius: Math.round(rodW / 3) }]}
          />
        ))}
      </View>

      {/* Ones squares */}
      <View style={[styles.blockGroup, { gap, flexWrap: 'wrap', maxWidth: onesMaxW }]}>
        {Array.from({ length: ones }).map((_, i) => (
          <View
            key={i}
            style={[styles.square, { width: sqSize, height: sqSize, borderRadius: Math.round(sqSize * 0.2) }]}
          />
        ))}
      </View>

      {/* Text label */}
      <Text style={[styles.blockLabel, { fontSize: Math.round(blockSize * 0.38) }]}>
        {tens} tens + {ones} ones
      </Text>
    </View>
  );
}

// ─── PlaceValueGame ───────────────────────────────────────────────────────────

export default function PlaceValueGame({ question, onCorrect, onWrong }) {
  const { width: SCREEN_W, height: SCREEN_H } = useWindowDimensions();
  const wide = SCREEN_W > SCREEN_H;

  // Block sizing: scale with available space
  // In landscape, height budget is tighter — use smaller blocks
  const blockSize = wide
    ? Math.round(Math.max(22, Math.min(36, SCREEN_H * 0.065)))
    : Math.round(Math.max(32, Math.min(56, SCREEN_H * 0.075)));

  const doneRef   = useRef(false);
  const frozenRef = useRef(new Set());
  const timersRef = useRef(new Map());
  // Randomly place repA (correct) at position 0 or 1 each question
  const correctPosRef = useRef(Math.random() < 0.5 ? 0 : 1);

  const [hitResults, setHitResults] = useState(['none', 'none']);

  // Reset on each new question
  useEffect(() => {
    doneRef.current = false;
    frozenRef.current.clear();
    timersRef.current.forEach(clearTimeout);
    timersRef.current.clear();
    correctPosRef.current = Math.random() < 0.5 ? 0 : 1;
    setHitResults(['none', 'none']);
  }, [question.text]);

  function tapCard(idx) {
    if (doneRef.current || frozenRef.current.has(idx)) return;
    frozenRef.current.add(idx);

    const isCorrect = question.bothCorrect || idx === correctPosRef.current;

    if (isCorrect) {
      doneRef.current = true;
      setHitResults(h => h.map((v, i) => i === idx ? 'correct' : v));
      timersRef.current.set('correct', setTimeout(onCorrect, 900));
    } else {
      setHitResults(h => h.map((v, i) => i === idx ? 'wrong' : v));
      timersRef.current.set(idx, setTimeout(() => {
        frozenRef.current.delete(idx);
        setHitResults(h => h.map((v, i) => i === idx ? 'none' : v));
      }, 700));
      setTimeout(onWrong, 0);
    }
  }

  // Place repA at correctPosRef position so it's randomised each question
  const reps = correctPosRef.current === 0
    ? [{ ...question.repA, idx: 0 }, { ...question.repB, idx: 1 }]
    : [{ ...question.repB, idx: 0 }, { ...question.repA, idx: 1 }];

  const cardStyle = (idx) => {
    const result = hitResults[idx];
    return [
      styles.card,
      wide && styles.cardWide,
      result === 'correct' && styles.cardCorrect,
      result === 'wrong'   && styles.cardWrong,
    ];
  };

  return (
    <View style={styles.container}>
      <Text style={styles.instruction}>
        {`Tap the card that shows ${question.answer}!`}
      </Text>

      <View style={[styles.cardsRow, wide && styles.cardsRowWide]}>
        {reps.map(({ tens, ones, idx }) => (
          <TouchableOpacity
            key={idx}
            testID={`pv-card-${idx}`}
            accessibilityLabel={`Card ${idx + 1}: ${tens} tens and ${ones} ones`}
            accessibilityRole="button"
            activeOpacity={0.85}
            style={cardStyle(idx)}
            onPress={() => tapCard(idx)}
          >
            <BlockDisplay tens={tens} ones={ones} blockSize={blockSize} />
          </TouchableOpacity>
        ))}
      </View>

    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
  instruction: {
    fontSize:     15,
    fontWeight:   '600',
    color:        '#555',
    textAlign:    'center',
    marginBottom: 14,
    paddingHorizontal: 8,
  },

  cardsRow: {
    flex:           1,
    flexDirection:  'row',
    gap:            16,
    width:          '100%',
    paddingHorizontal: 8,
    justifyContent: 'space-between',
  },
  cardsRowWide: {
    gap: 24,
    paddingHorizontal: 16,
  },

  card: {
    flex:            1,
    backgroundColor: '#ffffff',
    borderRadius:    20,
    borderWidth:     3,
    borderColor:     '#ddd',
    padding:         20,
    alignItems:      'center',
    justifyContent:  'center',
    elevation:       3,
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: 2 },
    shadowOpacity:   0.10,
    shadowRadius:    4,
  },
  cardWide: {},
  cardCorrect: {
    borderColor:     '#198754',
    backgroundColor: '#d1e7dd',
  },
  cardWrong: {
    borderColor:     '#dc3545',
    backgroundColor: '#f8d7da',
  },

  blockDisplay: {
    alignItems: 'center',
    gap:        6,
  },
  blockGroup: {
    flexDirection: 'row',
    alignItems:    'flex-end',
    flexWrap:      'wrap',
    justifyContent: 'center',
    minHeight:     8,
  },
  rod: {
    backgroundColor: '#3b82f6',
  },
  square: {
    backgroundColor: '#f59e0b',
  },
  blockLabel: {
    fontWeight: '700',
    color:      '#333',
    marginTop:  4,
  },

});
