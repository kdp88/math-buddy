import { useState, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  StyleSheet,
  Dimensions,
} from "react-native";
import { CANDY_SETS } from "./candySets";

const { height: SCREEN_H } = Dimensions.get("window");

// Compute key size so the full classic layout fits on screen.
// Budget: ~180px for header+question+feedback, 78px answerBox, 76px candy,
//         56px checkBtn, 20px pad margin, 20px pad row gaps (2×10).
const KEY = Math.min(72, Math.floor((SCREEN_H - 500) / 3));
const GAP = 10;

const CORRECT_MESSAGES = [
  "Great job!",
  "You got it!",
  "Awesome!",
  "Way to go!",
  "Brilliant!",
  "Superstar!",
  "Keep it up!",
];
const WRONG_MESSAGES = [
  "Try again!",
  "Almost!",
  "Not quite!",
  "Give it another go!",
];

function CandyPiece({ emoji, faded }) {
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
    <TouchableOpacity testID={`classic-candy-${emoji}`} onPress={handlePress} activeOpacity={0.9} accessible={true} accessibilityRole="button">
      <Animated.Text
        style={[
          styles.candy,
          { opacity: faded ? 0.25 : 1, transform: [{ scale: scaleAnim }] },
        ]}
      >
        {emoji}
      </Animated.Text>
    </TouchableOpacity>
  );
}

function CandyDisplay({ question }) {
  const { a, b, op } = question;
  const candyA = CANDY_SETS[a % CANDY_SETS.length];
  const candyB = CANDY_SETS[(a + b) % CANDY_SETS.length];

  if (op === "+") {
    return (
      <View testID="classic-candy-display" style={styles.candyDisplay}>
        <View testID="classic-candy-group-a" style={styles.candyGroup}>
          {Array.from({ length: a }).map((_, i) => (
            <CandyPiece key={i} emoji={candyA} />
          ))}
        </View>
        <Text testID="classic-candy-op" style={styles.candyOp}>+</Text>
        <View testID="classic-candy-group-b" style={styles.candyGroup}>
          {Array.from({ length: b }).map((_, i) => (
            <CandyPiece key={i} emoji={candyB} />
          ))}
        </View>
      </View>
    );
  }

  return (
    <View testID="classic-candy-display" style={styles.candyDisplay}>
      <View testID="classic-candy-group-a" style={styles.candyGroup}>
        {Array.from({ length: a }).map((_, i) => (
          <CandyPiece key={i} emoji={candyA} faded={i >= a - b} />
        ))}
      </View>
    </View>
  );
}

function NumberPad({ onPress, onDelete }) {
  const keys = [1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, "del"];
  return (
    <View testID="classic-number-pad" style={styles.pad}>
      {keys.map((key, i) => {
        if (key === null) return <View key={i} style={styles.padEmpty} />;
        return (
          <TouchableOpacity
            key={i}
            testID={key === "del" ? "classic-key-del" : `classic-key-${key}`}
            accessibilityLabel={key === "del" ? "Delete" : String(key)}
            accessibilityRole="button"
            accessible={true}
            style={styles.padKey}
            onPress={() => (key === "del" ? onDelete() : onPress(String(key)))}
            activeOpacity={0.7}
          >
            <Text style={styles.padKeyText}>{key === "del" ? "⌫" : key}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function ClassicGame({ question, onCorrect, onWrong }) {
  const [input, setInput] = useState("");
  const [answered, setAnswered] = useState(false);

  const shakeAnim = useRef(new Animated.Value(0)).current;

  // Reset when question changes
  const prevText = useRef(question.text);
  if (question.text !== prevText.current) {
    prevText.current = question.text;
    setInput("");
    setAnswered(false);
  }

  function handleNumberPress(num) {
    if (answered || input.length >= 3) return;
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

  return (
    <View testID="classic-container" style={styles.container}>
      {(question.op === "+" || question.op === "-") && (
        <CandyDisplay question={question} />
      )}

      <Animated.View
        testID="classic-answer-box"
        style={[styles.answerBox, { transform: [{ translateX: shakeAnim }] }]}
      >
        <Text testID="classic-answer-text" style={styles.answerText}>{input || " "}</Text>
      </Animated.View>

      <NumberPad onPress={handleNumberPress} onDelete={handleDelete} />

      <TouchableOpacity
        testID="classic-check-btn"
        accessibilityLabel="Check Answer"
        accessibilityRole="button"
        accessible={true}
        style={[styles.checkBtn, input === "" && styles.checkBtnDisabled]}
        onPress={handleCheck}
        activeOpacity={0.8}
        disabled={input === "" || answered}
      >
        <Text testID="classic-check-btn-text" style={styles.checkBtnText}>Check Answer</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
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
    width: KEY * 3 + GAP * 2,
    gap: GAP,
    justifyContent: "center",
    marginBottom: 16,
  },
  padKey: {
    width: KEY,
    height: KEY,
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
  padEmpty: { width: KEY, height: KEY },
  padKeyText: { fontSize: KEY * 0.4, fontWeight: "600", color: "#333" },

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
