import { useState, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import { CANDY_SETS } from "./candySets";

const GAP = 10;


function CandyPiece({ emoji, faded, size = 28 }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  function handlePress() {
    Animated.sequence([
      Animated.spring(scaleAnim, {
        toValue: 1.5,
        useNativeDriver: true,
        speed: 40,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        speed: 20,
      }),
    ]).start();
  }

  return (
    <TouchableOpacity testID={`classic-candy-${emoji}`} onPress={handlePress} activeOpacity={0.9} accessibilityLabel={emoji} accessibilityRole="button">
      <Animated.Text
        style={[
          styles.candy,
          { fontSize: size, opacity: faded ? 0.25 : 1, transform: [{ scale: scaleAnim }] },
        ]}
      >
        {emoji}
      </Animated.Text>
    </TouchableOpacity>
  );
}

// Cap candy shown per group — beyond 10 the visual isn't useful
const MAX_CANDY = 10;

function CandyDisplay({ question, compact }) {
  const { a, b, op } = question;
  const candyA = CANDY_SETS[a % CANDY_SETS.length];
  const candyB = CANDY_SETS[(a + b) % CANDY_SETS.length];
  const emojiSize  = compact ? 20 : 28;
  const groupWidth = compact ? 160 : 220;

  if (op === "+") {
    return (
      <View testID="classic-candy-display" style={styles.candyDisplay}>
        <View testID="classic-candy-group-a" style={[styles.candyGroup, { maxWidth: groupWidth }]}>
          {Array.from({ length: Math.min(a, MAX_CANDY) }).map((_, i) => (
            <CandyPiece key={i} emoji={candyA} size={emojiSize} />
          ))}
          {a > MAX_CANDY && <Text style={[styles.candyOp, { fontSize: emojiSize }]}>+{a - MAX_CANDY}</Text>}
        </View>
        <Text testID="classic-candy-op" style={[styles.candyOp, { fontSize: emojiSize + 4 }]}>+</Text>
        <View testID="classic-candy-group-b" style={[styles.candyGroup, { maxWidth: groupWidth }]}>
          {Array.from({ length: Math.min(b, MAX_CANDY) }).map((_, i) => (
            <CandyPiece key={i} emoji={candyB} size={emojiSize} />
          ))}
          {b > MAX_CANDY && <Text style={[styles.candyOp, { fontSize: emojiSize }]}>+{b - MAX_CANDY}</Text>}
        </View>
      </View>
    );
  }

  return (
    <View testID="classic-candy-display" style={styles.candyDisplay}>
      <View testID="classic-candy-group-a" style={[styles.candyGroup, { maxWidth: groupWidth * 2 }]}>
        {Array.from({ length: Math.min(a, MAX_CANDY) }).map((_, i) => (
          <CandyPiece key={i} emoji={candyA} size={emojiSize} faded={i >= Math.min(a, MAX_CANDY) - Math.min(b, a)} />
        ))}
        {a > MAX_CANDY && <Text style={[styles.candyOp, { fontSize: emojiSize }]}>+{a - MAX_CANDY}</Text>}
      </View>
    </View>
  );
}

function NumberPad({ onPress, onDelete, keySize }) {
  const keys = [1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, "del"];
  return (
    <View testID="classic-number-pad" style={[styles.pad, { width: keySize * 3 + GAP * 2 }]}>
      {keys.map((key, i) => {
        if (key === null) return <View key={i} style={{ width: keySize, height: keySize }} />;
        return (
          <TouchableOpacity
            key={i}
            testID={key === "del" ? "classic-key-del" : `classic-key-${key}`}
            accessibilityLabel={key === "del" ? "Delete" : String(key)}
            accessibilityRole="button"
            style={[styles.padKey, { width: keySize, height: keySize }]}
            onPress={() => (key === "del" ? onDelete() : onPress(String(key)))}
            activeOpacity={0.7}
          >
            <Text style={[styles.padKeyText, { fontSize: keySize * 0.4 }]}>{key === "del" ? "⌫" : key}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function ClassicGame({ question, onCorrect, onWrong }) {
  const { width: SCREEN_W, height: SCREEN_H } = useWindowDimensions();
  const landscape = SCREEN_W > SCREEN_H;
  const KEY = Math.max(48, Math.min(72, Math.floor((SCREEN_H - 500) / 3)));
  const compact = !landscape && (question.a > 10 || question.b > 10);

  const [input, setInput] = useState("");
  const [answered, setAnswered] = useState(false);

  const shakeAnim = useRef(new Animated.Value(0)).current;

  // Reset when question changes
  const prevAnswer = useRef(question.answer);
  if (question.answer !== prevAnswer.current) {
    prevAnswer.current = question.answer;
    setInput("");
    setAnswered(false);
  }

  function handleNumberPress(num) {
    if (answered || input.length >= 4) return;
    setInput((prev) => prev + num);
  }

  function handleDelete() {
    if (answered) return;
    setInput((prev) => prev.slice(0, -1));
  }

  function handleCheck() {
    if (answered || input === "") return;

    const isCorrect = parseInt(input, 10) === question.answer;

    if (isCorrect) {
      setAnswered(true);
      onCorrect();
    } else {
      setInput("");
      Animated.sequence([
        Animated.timing(shakeAnim, {
          toValue: 10,
          duration: 60,
          useNativeDriver: true,
        }),
        Animated.timing(shakeAnim, {
          toValue: -10,
          duration: 60,
          useNativeDriver: true,
        }),
        Animated.timing(shakeAnim, {
          toValue: 10,
          duration: 60,
          useNativeDriver: true,
        }),
        Animated.timing(shakeAnim, {
          toValue: 0,
          duration: 60,
          useNativeDriver: true,
        }),
      ]).start();
      onWrong();
    }
  }

  const showCandy = question.op === "+" || question.op === "-";

  const padAndControls = (
    <>
      <Animated.View
        testID="classic-answer-box"
        style={[styles.answerBox, { transform: [{ translateX: shakeAnim }] }]}
      >
        <Text testID="classic-answer-text" style={styles.answerText}>{input || " "}</Text>
      </Animated.View>
      <NumberPad onPress={handleNumberPress} onDelete={handleDelete} keySize={KEY} />
      <TouchableOpacity
        testID="classic-check-btn"
        accessibilityLabel="Check Answer"
        accessibilityRole="button"
        style={[styles.checkBtn, input === "" && styles.checkBtnDisabled]}
        onPress={handleCheck}
        activeOpacity={0.8}
        disabled={input === "" || answered}
      >
        <Text testID="classic-check-btn-text" style={styles.checkBtnText}>Check Answer</Text>
      </TouchableOpacity>
    </>
  );

  if (landscape && showCandy) {
    return (
      <View testID="classic-container" style={styles.containerLandscape}>
        <View style={styles.candySide}>
          <CandyDisplay question={question} compact={false} />
        </View>
        <View style={styles.padSide}>
          {padAndControls}
        </View>
      </View>
    );
  }

  return (
    <View testID="classic-container" style={styles.container}>
      {showCandy && <CandyDisplay question={question} compact={compact} />}
      {padAndControls}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
  },
  containerLandscape: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 24,
    paddingHorizontal: 16,
  },
  candySide: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  padSide: {
    alignItems: "center",
  },

  // Candy
  candyDisplay: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    marginBottom: 6,
    minHeight: 40,
  },
  candyGroup: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    maxWidth: 220,
    gap: 4,
  },
  candy: { fontSize: 28 },
  candyOp: { fontSize: 28, fontWeight: "700", color: "#555" },

  // Answer display
  answerBox: {
    width: 120,
    height: 54,
    borderBottomWidth: 3,
    borderBottomColor: "#aaa",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  answerText: {
    fontSize: 42,
    fontWeight: "700",
    color: "#333",
  },

  // Number pad
  pad: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: GAP,
    justifyContent: "center",
    marginBottom: 16,
  },
  padKey: {
    backgroundColor: "#f0f0f0",
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  padKeyText: { fontWeight: "600", color: "#333" },

  // Check button
  checkBtn: {
    backgroundColor: "#4c6ef5",
    borderRadius: 16,
    paddingHorizontal: 50,
    paddingVertical: 12,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  checkBtnDisabled: { backgroundColor: "#b0b8f0" },
  checkBtnText: { fontSize: 20, fontWeight: "700", color: "#fff" },
});
