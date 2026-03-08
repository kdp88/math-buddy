import { useState, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Animated,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import SpaceshipGame from './SpaceshipGame';
import HauntedHouse from './HauntedHouse';
import CockpitGame from './CockpitGame';
import MazeGame from './MazeGame';
import SettingsModal from './SettingsModal';

const DEFAULT_SETTINGS = { ops: ['+', '-'], difficulty: 'medium', mode: 'classic' };

const DIFFICULTY_MAX = { easy: 5, medium: 10, hard: 20 };
const DIFFICULTY_MUL = { easy: 5, medium: 10, hard: 12 };

const CANDY_SETS = ['🍬', '🍭', '🍫', '🍩', '🍪'];

function CandyPiece({ emoji, faded }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  function handlePress() {
    Animated.sequence([
      Animated.spring(scaleAnim, { toValue: 1.5, useNativeDriver: true, speed: 40 }),
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 20 }),
    ]).start();
  }

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.9}>
      <Animated.Text
        style={[styles.candy, { opacity: faded ? 0.25 : 1, transform: [{ scale: scaleAnim }] }]}
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

  if (op === '+') {
    return (
      <View style={styles.candyDisplay}>
        <View style={styles.candyGroup}>
          {Array.from({ length: a }).map((_, i) => (
            <CandyPiece key={`${candyA}-${i}`} emoji={candyA} />
          ))}
        </View>
        <Text style={styles.candyOp}>+</Text>
        <View style={styles.candyGroup}>
          {Array.from({ length: b }).map((_, i) => (
            <CandyPiece key={`${candyB}-${i}`} emoji={candyB} />
          ))}
        </View>
      </View>
    );
  }

  // Subtraction: show `a` candies, last `b` are faded (taken away)
  return (
    <View style={styles.candyDisplay}>
      <View style={styles.candyGroup}>
        {Array.from({ length: a }).map((_, i) => (
          <CandyPiece key={`${candyA}-${i}`} emoji={candyA} faded={i >= a - b} />
        ))}
      </View>
    </View>
  );
}

// --- Question Generator ---
function generateQuestion(settings = DEFAULT_SETTINGS) {
  const { ops, difficulty } = settings;
  const max = DIFFICULTY_MAX[difficulty];
  const mul = DIFFICULTY_MUL[difficulty];
  const op  = ops[Math.floor(Math.random() * ops.length)];

  if (op === '+') {
    const a = Math.floor(Math.random() * max) + 1;
    const b = Math.floor(Math.random() * max) + 1;
    return { text: `${a} + ${b}`, answer: a + b, a, b, op };
  }
  if (op === '-') {
    const a = Math.floor(Math.random() * max) + 1;
    const b = Math.floor(Math.random() * max) + 1;
    const big = Math.max(a, b), small = Math.min(a, b);
    return { text: `${big} - ${small}`, answer: big - small, a: big, b: small, op };
  }
  if (op === '×') {
    const a = Math.floor(Math.random() * mul) + 1;
    const b = Math.floor(Math.random() * mul) + 1;
    return { text: `${a} × ${b}`, answer: a * b, a, b, op };
  }
  // op === '÷'
  const b      = Math.floor(Math.random() * mul) + 1;
  const answer = Math.floor(Math.random() * mul) + 1;
  const a      = b * answer;
  return { text: `${a} ÷ ${b}`, answer, a, b, op };
}

const CORRECT_MESSAGES = [
  'Great job!',
  'You got it!',
  'Awesome!',
  'Way to go!',
  'Brilliant!',
  'Superstar!',
  'Keep it up!',
];

const WRONG_MESSAGES = [
  'Try again!',
  'Almost!',
  'Not quite!',
  'Give it another go!',
];

// --- Number Pad ---
function NumberPad({ onPress, onDelete }) {
  const keys = [1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, 'del'];

  return (
    <View style={styles.pad}>
      {keys.map((key, i) => {
        if (key === null) return <View key={i} style={styles.padEmpty} />;
        return (
          <TouchableOpacity
            key={i}
            style={styles.padKey}
            onPress={() => (key === 'del' ? onDelete() : onPress(String(key)))}
            activeOpacity={0.7}
          >
            <Text style={styles.padKeyText}>{key === 'del' ? '⌫' : key}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// --- Main App ---
export default function App() {
  const [settings, setSettings]               = useState(DEFAULT_SETTINGS);
  const [settingsVisible, setSettingsVisible] = useState(true); // open on launch
  const [question, setQuestion]               = useState(() => generateQuestion(DEFAULT_SETTINGS));
  const [input, setInput]                     = useState('');
  const [score, setScore]                     = useState(0);
  const [streak, setStreak]                   = useState(0);
  const [feedback, setFeedback]               = useState(null); // null | 'correct' | 'wrong'
  const [message, setMessage]                 = useState('');
  const [answered, setAnswered]               = useState(false);

  const shakeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  function handleNumberPress(num) {
    if (answered) return;
    if (input.length >= 3) return; // max 3 digits (multiplication can reach 144)
    setInput(prev => prev + num);
  }

  function handleDelete() {
    if (answered) return;
    setInput(prev => prev.slice(0, -1));
  }

  function handleCheck() {
    if (answered || input === '') return;

    const isCorrect = parseInt(input, 10) === question.answer;

    if (isCorrect) {
      const msg = CORRECT_MESSAGES[Math.floor(Math.random() * CORRECT_MESSAGES.length)];
      setFeedback('correct');
      setMessage(msg);
      setScore(s => s + 1);
      setStreak(s => s + 1);
      setAnswered(true);

      Animated.sequence([
        Animated.spring(scaleAnim, { toValue: 1.15, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }),
      ]).start();

      setTimeout(() => nextQuestion(), 1500);
    } else {
      const msg = WRONG_MESSAGES[Math.floor(Math.random() * WRONG_MESSAGES.length)];
      setFeedback('wrong');
      setMessage(msg);
      setStreak(0);
      setInput('');

      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
      ]).start();

      setTimeout(() => setFeedback(null), 1200);
    }
  }

  function handleArcadeCorrect() {
    const msg = CORRECT_MESSAGES[Math.floor(Math.random() * CORRECT_MESSAGES.length)];
    setFeedback('correct');
    setMessage(msg);
    setScore(s => s + 1);
    setStreak(s => s + 1);
    Animated.sequence([
      Animated.spring(scaleAnim, { toValue: 1.15, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1,    useNativeDriver: true }),
    ]).start();
    setTimeout(() => nextQuestion(), 1500);
  }

  function handleArcadeWrong() {
    const msg = WRONG_MESSAGES[Math.floor(Math.random() * WRONG_MESSAGES.length)];
    setFeedback('wrong');
    setMessage(msg);
    setStreak(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue:  10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue:  10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue:   0, duration: 60, useNativeDriver: true }),
    ]).start();
    setTimeout(() => setFeedback(null), 1200);
  }

  function nextQuestion(nextSettings) {
    setQuestion(generateQuestion(nextSettings ?? settings));
    setInput('');
    setFeedback(null);
    setMessage('');
    setAnswered(false);
  }

  function handleSaveSettings(newSettings) {
    setSettings(newSettings);
    nextQuestion(newSettings);
    setStreak(0);
  }

  const bgColor =
    feedback === 'correct' ? '#d4edda' :
    feedback === 'wrong'   ? '#f8d7da' :
    '#fff9f0';

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: bgColor }]}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.scoreBadge}>
          <Text style={styles.scoreIcon}>⭐</Text>
          <Text style={styles.scoreText}>{score}</Text>
        </View>
        {streak >= 2 && (
          <View style={styles.streakBadge}>
            <Text style={styles.streakText}>🔥 {streak} streak!</Text>
          </View>
        )}
        <TouchableOpacity
          style={[styles.iconBtn, styles.headerRight]}
          onPress={() => setSettingsVisible(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.iconBtnTxt}>⚙️</Text>
        </TouchableOpacity>
      </View>

      <SettingsModal
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
        settings={settings}
        onSave={handleSaveSettings}
      />

      {/* Question */}
      <Animated.View
        style={[
          styles.questionBox,
          { transform: [{ translateX: shakeAnim }, { scale: scaleAnim }] },
        ]}
      >
        <Text style={styles.questionLabel}>What is</Text>
        <Text style={styles.questionText}>{question.text} = ?</Text>
      </Animated.View>

      {/* Feedback message */}
      <View style={styles.feedbackBox}>
        {feedback === 'correct' && <Text style={styles.correctMsg}>{message}</Text>}
        {feedback === 'wrong'   && <Text style={styles.wrongMsg}>{message}</Text>}
      </View>

      {settings.mode === 'classic' ? (
        <>
          {/* Candy pieces — only for + and - */}
          {(question.op === '+' || question.op === '-') && (
            <CandyDisplay question={question} />
          )}

          {/* Answer display */}
          <View style={styles.answerBox}>
            <Text style={styles.answerText}>{input || ' '}</Text>
          </View>

          {/* Number pad */}
          <NumberPad onPress={handleNumberPress} onDelete={handleDelete} />

          {/* Check button */}
          <TouchableOpacity
            style={[styles.checkBtn, input === '' && styles.checkBtnDisabled]}
            onPress={handleCheck}
            activeOpacity={0.8}
            disabled={input === '' || answered}
          >
            <Text style={styles.checkBtnText}>Check Answer</Text>
          </TouchableOpacity>
        </>
      ) : settings.mode === 'spaceship' ? (
        <SpaceshipGame
          question={question}
          onCorrect={handleArcadeCorrect}
          onWrong={handleArcadeWrong}
        />
      ) : settings.mode === 'cockpit' ? (
        <CockpitGame
          question={question}
          onCorrect={handleArcadeCorrect}
          onWrong={handleArcadeWrong}
        />
      ) : settings.mode === 'maze' ? (
        <MazeGame
          question={question}
          onCorrect={handleArcadeCorrect}
          onWrong={handleArcadeWrong}
        />
      ) : (
        <HauntedHouse
          question={question}
          onCorrect={handleArcadeCorrect}
          onWrong={handleArcadeWrong}
        />
      )}
    </SafeAreaView>
  );
}

// --- Styles ---
const styles = StyleSheet.create({
  safe: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
    paddingHorizontal: 20,
    width: '100%',
  },
  scoreBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff3cd',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 6,
  },
  scoreIcon: { fontSize: 22 },
  scoreText: { fontSize: 22, fontWeight: '700', color: '#856404' },
  streakBadge: {
    backgroundColor: '#fff0e6',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  streakText: { fontSize: 18, fontWeight: '600', color: '#c85000' },
  headerRight: {
    marginLeft: 'auto',
  },
  iconBtn: {
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  iconBtnTxt: { fontSize: 20 },

  questionBox: {
    alignItems: 'center',
    marginVertical: 20,
  },
  questionLabel: {
    fontSize: 26,
    color: '#555',
    fontWeight: '500',
  },
  questionText: {
    fontSize: 64,
    fontWeight: '800',
    color: '#222',
    letterSpacing: 2,
  },

  answerBox: {
    width: 120,
    height: 70,
    borderBottomWidth: 3,
    borderBottomColor: '#aaa',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  answerText: {
    fontSize: 48,
    fontWeight: '700',
    color: '#333',
  },

  feedbackBox: {
    height: 36,
    justifyContent: 'center',
    marginBottom: 12,
  },
  correctMsg: { fontSize: 24, fontWeight: '700', color: '#198754' },
  wrongMsg:   { fontSize: 24, fontWeight: '700', color: '#dc3545' },

  pad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 300,
    gap: 10,
    justifyContent: 'center',
    marginBottom: 20,
  },
  padKey: {
    width: 85,
    height: 85,
    backgroundColor: '#f0f0f0',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  padEmpty: { width: 85, height: 85 },
  padKeyText: { fontSize: 34, fontWeight: '600', color: '#333' },

  candyDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 16,
    minHeight: 60,
  },
  candyGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    maxWidth: 220,
    gap: 4,
  },
  candy: {
    fontSize: 32,
  },
  candyOp: {
    fontSize: 32,
    fontWeight: '700',
    color: '#555',
  },

  checkBtn: {
    backgroundColor: '#4c6ef5',
    borderRadius: 16,
    paddingHorizontal: 50,
    paddingVertical: 18,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  checkBtnDisabled: { backgroundColor: '#b0b8f0' },
  checkBtnText: { fontSize: 22, fontWeight: '700', color: '#fff' },
});
