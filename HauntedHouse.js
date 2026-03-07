import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  StyleSheet,
  Dimensions,
} from 'react-native';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

const GAME_W  = SCREEN_W - 32;
const GAME_H  = Math.round(SCREEN_H * 0.46);
const CTRL_H  = 72;
const TOTAL_H = GAME_H + CTRL_H;

const DOOR_W   = 58;
const DOOR_H   = 145;
const DOOR_TOP = 28;   // from container top
const FLOOR_Y  = DOOR_TOP + DOOR_H + 2;

const PLAYER_SIZE   = 36;
const PLAYER_BOTTOM = CTRL_H + 10; // from container bottom

const NUM_DOORS = 4;
const SLOT      = GAME_W / NUM_DOORS;

// Static star field (same trick as SpaceshipGame)
const STARS = Array.from({ length: 18 }, (_, i) => ({
  left:    ((i * 73 + 17) % 97) / 97,
  top:     ((i * 47 + 31) % 89) / 89 * (FLOOR_Y - 8),
  size:    1 + (i % 3),
  opacity: 0.3 + (i % 4) * 0.15,
}));

const DECOS = [
  { emoji: '🌕', top: 6,  left: GAME_W - 48 },
  { emoji: '🕷️', top: 10, left: 6            },
  { emoji: '🦇', top: DOOR_TOP - 20, left: Math.round(GAME_W * 0.3) },
  { emoji: '🎃', top: FLOOR_Y,       left: Math.round(GAME_W * 0.05) },
  { emoji: '🎃', top: FLOOR_Y,       left: Math.round(GAME_W * 0.87) },
];

function buildDoors(correctAnswer) {
  const set = new Set([correctAnswer]);
  let tries = 0;
  while (set.size < NUM_DOORS && tries < 60) {
    const offset = (Math.floor(Math.random() * 8) - 4) || 1;
    const val = correctAnswer + offset;
    if (val >= 0) set.add(val);
    tries++;
  }
  for (let i = 1; set.size < NUM_DOORS; i++) {
    if (!set.has(correctAnswer + i)) set.add(correctAnswer + i);
    else if (correctAnswer - i >= 0 && !set.has(correctAnswer - i))
      set.add(correctAnswer - i);
  }
  const arr = [...set];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.map((num, i) => ({
    num,
    isCorrect: num === correctAnswer,
    cx:    SLOT * i + SLOT / 2,
    state: 'closed', // 'closed' | 'open'
  }));
}

export default function HauntedHouse({ question, onCorrect, onWrong }) {
  const [doors,   setDoors]   = useState(() => buildDoors(question.answer));
  const [playerX, setPlayerX] = useState(GAME_W / 2);
  const [flipX,   setFlipX]   = useState(1);  // 1 = face right, -1 = face left
  const [done,    setDone]    = useState(false);

  const moveRef    = useRef(null);
  const doorAnims  = useRef(Array.from({ length: NUM_DOORS }, () => new Animated.Value(0))).current;
  const ghostAnims = useRef(Array.from({ length: NUM_DOORS }, () => new Animated.Value(0))).current;

  useEffect(() => {
    setDoors(buildDoors(question.answer));
    setPlayerX(GAME_W / 2);
    setFlipX(1);
    setDone(false);
    doorAnims.forEach(a => a.setValue(0));
    ghostAnims.forEach(a => a.setValue(0));
  }, [question.text]);

  useEffect(() => () => clearInterval(moveRef.current), []);

  function startMove(dir) {
    clearInterval(moveRef.current);
    setFlipX(dir > 0 ? 1 : -1);
    moveRef.current = setInterval(() => {
      setPlayerX(x =>
        Math.max(PLAYER_SIZE / 2, Math.min(GAME_W - PLAYER_SIZE / 2, x + dir * 9)),
      );
    }, 16);
  }

  function stopMove() { clearInterval(moveRef.current); }

  // Nearest unopened door within range
  const nearestIdx = (() => {
    if (done) return -1;
    let best = { idx: -1, dist: DOOR_W * 0.75 };
    doors.forEach((d, i) => {
      if (d.state === 'open') return;
      const dist = Math.abs(d.cx - playerX);
      if (dist < best.dist) best = { idx: i, dist };
    });
    return best.idx;
  })();

  function knock() {
    if (done || nearestIdx === -1) return;
    clearInterval(moveRef.current);
    const idx  = nearestIdx;
    const door = doors[idx];

    // Door face slides up to reveal what's behind
    Animated.timing(doorAnims[idx], {
      toValue:         1,
      duration:        500,
      useNativeDriver: true,
    }).start(() => {
      setDoors(prev => prev.map((d, i) => i === idx ? { ...d, state: 'open' } : d));

      if (door.isCorrect) {
        setDone(true);
        setTimeout(() => onCorrect(), 850);
      } else {
        ghostAnims[idx].setValue(0);
        Animated.timing(ghostAnims[idx], {
          toValue:         1,
          duration:        800,
          useNativeDriver: true,
        }).start();
        onWrong();
      }
    });
  }

  const ghostMidY = DOOR_TOP + DOOR_H / 2;

  return (
    <View style={styles.container}>
      {/* Night sky */}
      {STARS.map((s, i) => (
        <View
          key={i}
          style={{
            position:      'absolute',
            left:          s.left * GAME_W,
            top:           s.top,
            width:         s.size,
            height:        s.size,
            borderRadius:  s.size,
            backgroundColor: '#fff',
            opacity:       s.opacity,
          }}
        />
      ))}

      {/* Decorations */}
      {DECOS.map((d, i) => (
        <Text key={i} style={[styles.deco, { top: d.top, left: d.left }]}>
          {d.emoji}
        </Text>
      ))}

      {/* Wall behind doors */}
      <View style={styles.wall} />

      {/* Floor line */}
      <View style={[styles.floor, { top: FLOOR_Y }]} />

      {/* Doors */}
      {doors.map((door, i) => {
        const isNearest = nearestIdx === i;
        return (
          <View
            key={i}
            style={[
              styles.doorFrame,
              {
                left: door.cx - DOOR_W / 2 - 5,
                top:  DOOR_TOP,
              },
              isNearest && !done && styles.doorFrameNear,
            ]}
          >
            {/* Content revealed behind the door */}
            <View
              style={[
                styles.doorBack,
                door.state === 'open' && door.isCorrect  && styles.doorBackCorrect,
                door.state === 'open' && !door.isCorrect && styles.doorBackWrong,
              ]}
            >
              {door.state === 'open' && (
                <>
                  <Text
                    style={[
                      styles.doorNum,
                      door.isCorrect ? styles.doorNumCorrect : styles.doorNumWrong,
                    ]}
                  >
                    {door.num}
                  </Text>
                  <Text style={styles.doorResultIcon}>
                    {door.isCorrect ? '⭐' : '💀'}
                  </Text>
                </>
              )}
            </View>

            {/* Door face panel — slides up when knocked */}
            <Animated.View
              style={[
                styles.doorFace,
                {
                  transform: [{
                    translateY: doorAnims[i].interpolate({
                      inputRange:  [0, 1],
                      outputRange: [0, -(DOOR_H + 10)],
                    }),
                  }],
                },
              ]}
            >
              <Text style={styles.doorKnob}>🔮</Text>
              <Text style={styles.doorQuestion}>❓</Text>
            </Animated.View>
          </View>
        );
      })}

      {/* Ghost fly-outs — rendered at container level so they aren't clipped by doorFrame */}
      {doors.map((door, i) =>
        door.state === 'open' && !door.isCorrect ? (
          <Animated.Text
            key={`ghost-${i}`}
            style={{
              position: 'absolute',
              left:     door.cx - 14,
              opacity:  ghostAnims[i].interpolate({
                inputRange:  [0, 0.1, 0.8, 1],
                outputRange: [0, 1,   1,   0],
              }),
              transform: [{
                translateY: ghostAnims[i].interpolate({
                  inputRange:  [0, 1],
                  outputRange: [ghostMidY, ghostMidY - 85],
                }),
              }],
              fontSize: 26,
              zIndex:   20,
            }}
          >
            👻
          </Animated.Text>
        ) : null,
      )}

      {/* Player */}
      <Text
        style={[
          styles.player,
          {
            left:      playerX - PLAYER_SIZE / 2,
            bottom:    PLAYER_BOTTOM,
            transform: [{ scaleX: flipX }],
          },
        ]}
      >
        🧟
      </Text>

      {/* Controls */}
      <View style={styles.controls}>
        <TouchableOpacity
          style={styles.moveBtn}
          onPressIn={() => startMove(-1)}
          onPressOut={stopMove}
          activeOpacity={0.7}
        >
          <Text style={styles.moveBtnTxt}>◄</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.knockBtn, (nearestIdx === -1 || done) && styles.knockBtnOff]}
          onPress={knock}
          disabled={nearestIdx === -1 || done}
          activeOpacity={0.8}
        >
          <Text style={styles.knockBtnTxt}>🚪 Knock!</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.moveBtn}
          onPressIn={() => startMove(1)}
          onPressOut={stopMove}
          activeOpacity={0.7}
        >
          <Text style={styles.moveBtnTxt}>►</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width:           GAME_W,
    height:          TOTAL_H,
    borderRadius:    20,
    overflow:        'hidden',
    backgroundColor: '#160b2c',
    borderWidth:     1.5,
    borderColor:     '#3d1a6e',
    marginVertical:  8,
  },
  deco: {
    position: 'absolute',
    fontSize: 20,
  },
  wall: {
    position:        'absolute',
    left:            0,
    right:           0,
    top:             DOOR_TOP - 6,
    height:          DOOR_H + 12,
    backgroundColor: '#27104a',
  },
  floor: {
    position:        'absolute',
    left:            0,
    right:           0,
    height:          5,
    backgroundColor: '#3d1a6e',
    borderTopWidth:  1,
    borderTopColor:  '#6d28d9',
  },

  // Door frame
  doorFrame: {
    position:        'absolute',
    width:           DOOR_W + 10,
    height:          DOOR_H + 10,
    borderWidth:     3,
    borderColor:     '#4a2800',
    borderRadius:    6,
    overflow:        'hidden',
    backgroundColor: '#1a0a00',
  },
  doorFrameNear: {
    borderColor:   '#facc15',
    shadowColor:   '#facc15',
    shadowOpacity: 0.8,
    shadowRadius:  10,
    elevation:     8,
  },

  // Behind door (revealed content)
  doorBack: {
    ...StyleSheet.absoluteFillObject,
    alignItems:      'center',
    justifyContent:  'center',
    backgroundColor: '#1a0a00',
  },
  doorBackCorrect: { backgroundColor: '#052e16' },
  doorBackWrong:   { backgroundColor: '#1c0505' },
  doorNum: {
    fontSize:   24,
    fontWeight: '800',
  },
  doorNumCorrect: { color: '#4ade80' },
  doorNumWrong:   { color: '#f87171' },
  doorResultIcon: { fontSize: 22, marginTop: 4 },

  // Door face panel (animated — slides up)
  doorFace: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#5c2d00',
    alignItems:      'center',
    justifyContent:  'center',
    borderRadius:    4,
  },
  doorKnob:     { fontSize: 18, marginBottom: 8 },
  doorQuestion: { fontSize: 28, fontWeight: '800' },

  // Player
  player: {
    position: 'absolute',
    fontSize: PLAYER_SIZE - 4,
  },

  // Controls
  controls: {
    position:          'absolute',
    bottom:            0,
    left:              0,
    right:             0,
    height:            CTRL_H,
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-around',
    paddingHorizontal: 12,
    borderTopWidth:    1,
    borderTopColor:    '#3d1a6e',
    backgroundColor:   '#0d0619',
  },
  moveBtn: {
    width:           72,
    height:          52,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius:    12,
    alignItems:      'center',
    justifyContent:  'center',
    borderWidth:     1,
    borderColor:     'rgba(255,255,255,0.2)',
  },
  moveBtnTxt: {
    fontSize:   28,
    color:      '#fff',
    fontWeight: '700',
  },
  knockBtn: {
    backgroundColor:   '#7c3aed',
    borderRadius:      14,
    paddingHorizontal: 24,
    paddingVertical:   13,
    borderWidth:       1,
    borderColor:       '#a78bfa',
  },
  knockBtnOff: {
    backgroundColor: '#2e1065',
    borderColor:     '#2e1065',
    opacity:         0.55,
  },
  knockBtnTxt: {
    fontSize:      18,
    fontWeight:    '800',
    color:         '#fff',
    letterSpacing: 0.5,
  },
});
