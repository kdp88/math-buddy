import { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Animated,
  StatusBar,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import ClassicGame   from './ClassicGame';
import SpaceshipGame from './SpaceshipGame';
import HauntedHouse  from './HauntedHouse';
import CockpitGame   from './CockpitGame';
import MazeGame      from './MazeGame';
import SettingsModal from './SettingsModal';
import HighScoreModal from './HighScoreModal';

const DEFAULT_SETTINGS = { ops: ['+', '-'], difficulty: 'medium', mode: 'classic', playerName: '' };
const HS_KEY = 'mathbuddy_highscores';

const DIFFICULTY_MAX = { easy: 5, medium: 10, hard: 20 };
const DIFFICULTY_MUL = { easy: 5, medium: 10, hard: 12 };

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
  const b      = Math.floor(Math.random() * mul) + 1;
  const answer = Math.floor(Math.random() * mul) + 1;
  const a      = b * answer;
  return { text: `${a} ÷ ${b}`, answer, a, b, op };
}

const CORRECT_MESSAGES = ['Great job!', 'You got it!', 'Awesome!', 'Way to go!', 'Brilliant!', 'Superstar!', 'Keep it up!'];
const WRONG_MESSAGES   = ['Try again!', 'Almost!', 'Not quite!', 'Give it another go!'];

export default function App() {
  const [settings,          setSettings]          = useState(DEFAULT_SETTINGS);
  const [settingsVisible,   setSettingsVisible]   = useState(true);
  const [highScoresVisible, setHighScoresVisible] = useState(false);
  const [question,          setQuestion]          = useState(() => generateQuestion(DEFAULT_SETTINGS));
  const [score,             setScore]             = useState(0);
  const [streak,            setStreak]            = useState(0);
  const [feedback,          setFeedback]          = useState(null);
  const [message,           setMessage]           = useState('');
  const [highScores,        setHighScores]        = useState({});

  const shakeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    AsyncStorage.getItem(HS_KEY).then(raw => {
      if (raw) setHighScores(JSON.parse(raw));
    });
  }, []);

  function saveHighScore(name, newScore) {
    if (!name) return;
    setHighScores(prev => {
      if (newScore <= (prev[name] ?? 0)) return prev;
      const updated = { ...prev, [name]: newScore };
      AsyncStorage.setItem(HS_KEY, JSON.stringify(updated));
      return updated;
    });
  }

  function nextQuestion(nextSettings) {
    setQuestion(generateQuestion(nextSettings ?? settings));
    setFeedback(null);
    setMessage('');
  }

  function handleCorrect() {
    const msg = CORRECT_MESSAGES[Math.floor(Math.random() * CORRECT_MESSAGES.length)];
    setFeedback('correct');
    setMessage(msg);
    setScore(s => {
      const next = s + 1;
      saveHighScore(settings.playerName, next);
      return next;
    });
    setStreak(s => s + 1);
    Animated.sequence([
      Animated.spring(scaleAnim, { toValue: 1.15, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1,    useNativeDriver: true }),
    ]).start();
    setTimeout(() => nextQuestion(), 1500);
  }

  function handleWrong() {
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

  function handleSaveSettings(newSettings) {
    setSettings(newSettings);
    nextQuestion(newSettings);
    setScore(0);
    setStreak(0);
  }

  const bgColor =
    feedback === 'correct' ? '#d4edda' :
    feedback === 'wrong'   ? '#f8d7da' :
    '#fff9f0';

  const gameProps = { question, onCorrect: handleCorrect, onWrong: handleWrong };

  return (
    <SafeAreaProvider>
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
        <View style={styles.headerButtons}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => setHighScoresVisible(true)} activeOpacity={0.8}>
            <Text style={styles.iconBtnTxt}>🏆</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={() => setSettingsVisible(true)} activeOpacity={0.8}>
            <Text style={styles.iconBtnTxt}>⚙️</Text>
          </TouchableOpacity>
        </View>
      </View>

      <SettingsModal
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
        settings={settings}
        onSave={handleSaveSettings}
      />
      <HighScoreModal
        visible={highScoresVisible}
        onClose={() => setHighScoresVisible(false)}
        highScores={highScores}
      />

      {/* Question */}
      <Animated.View style={[styles.questionBox, { transform: [{ translateX: shakeAnim }, { scale: scaleAnim }] }]}>
        <Text style={styles.questionLabel}>What is</Text>
        <Text style={styles.questionText}>{question.text} = ?</Text>
      </Animated.View>

      {/* Feedback */}
      <View style={styles.feedbackBox}>
        {feedback === 'correct' && <Text style={styles.correctMsg}>{message}</Text>}
        {feedback === 'wrong'   && <Text style={styles.wrongMsg}>{message}</Text>}
      </View>

      {/* Game */}
      {settings.mode === 'classic'       && <ClassicGame   {...gameProps} />}
      {settings.mode === 'spaceship'     && <SpaceshipGame {...gameProps} />}
      {settings.mode === 'cockpit'       && <CockpitGame   {...gameProps} />}
      {settings.mode === 'maze'          && <MazeGame      {...gameProps} />}
      {settings.mode === 'haunted-house' && <HauntedHouse  {...gameProps} />}
    </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex:       1,
    alignItems: 'center',
    paddingTop: 10,
  },
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               12,
    marginBottom:      12,
    paddingHorizontal: 20,
    width:             '100%',
  },
  scoreBadge: {
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   '#fff3cd',
    borderRadius:      20,
    paddingHorizontal: 16,
    paddingVertical:   8,
    gap:               6,
  },
  scoreIcon: { fontSize: 20 },
  scoreText: { fontSize: 20, fontWeight: '700', color: '#856404' },
  streakBadge: {
    backgroundColor:   '#fff0e6',
    borderRadius:      20,
    paddingHorizontal: 14,
    paddingVertical:   8,
  },
  streakText: { fontSize: 16, fontWeight: '600', color: '#c85000' },
  headerButtons: {
    marginLeft:    'auto',
    flexDirection: 'row',
    gap:           8,
  },
  iconBtn: {
    backgroundColor:   '#f0f0f0',
    borderRadius:      20,
    paddingHorizontal: 12,
    paddingVertical:   8,
  },
  iconBtnTxt: { fontSize: 20 },

  questionBox: {
    alignItems:    'center',
    marginVertical: 6,
  },
  questionLabel: {
    fontSize:   13,
    color:      '#888',
    fontWeight: '500',
  },
  questionText: {
    fontSize:      34,
    fontWeight:    '800',
    color:         '#222',
    letterSpacing: 2,
  },

  feedbackBox: {
    height:       26,
    justifyContent: 'center',
    marginBottom: 4,
  },
  correctMsg: { fontSize: 17, fontWeight: '700', color: '#198754' },
  wrongMsg:   { fontSize: 17, fontWeight: '700', color: '#dc3545' },
});
