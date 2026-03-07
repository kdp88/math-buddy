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

const GAME_W    = SCREEN_W - 32;
const GAME_H    = Math.round(SCREEN_H * 0.46);
const CTRL_H    = 72;
const TOTAL_H   = GAME_H + CTRL_H;

const TARGET_SIZE = 64;
const SHIP_SIZE   = 44;
const NUM_CHOICES = 4;

// Fixed layout anchors
const TARGET_TOP       = 22;                          // top of asteroid row from container top
const SHIP_BOTTOM      = CTRL_H + 28;                 // ship bottom edge from container bottom
const SHIP_CENTER_BOT  = SHIP_BOTTOM + SHIP_SIZE / 2; // ship center from container bottom
const TARGET_BOT_FROM_BOT =
  TOTAL_H - TARGET_TOP - TARGET_SIZE;                 // target top edge from container bottom
const MAX_LASER_H = TARGET_BOT_FROM_BOT - SHIP_CENTER_BOT - 6;

const COLORS = ['#7c3aed', '#0891b2', '#b45309', '#be185d'];

// Deterministic-looking star field (no Math.random so it's stable across renders)
const STARS = Array.from({ length: 28 }, (_, i) => ({
  left:    ((i * 73  + 17) % 97) / 97,
  top:     ((i * 47  + 31) % 89) / 89,
  size:    1 + (i % 3),
  opacity: 0.35 + (i % 4) * 0.15,
}));

function buildChoices(correctAnswer) {
  const set = new Set([correctAnswer]);
  let tries = 0;
  while (set.size < NUM_CHOICES && tries < 60) {
    const offset = (Math.floor(Math.random() * 8) - 4) || 1;
    const val = correctAnswer + offset;
    if (val >= 0) set.add(val);
    tries++;
  }
  // Fallback: fill with sequential values
  for (let i = 1; set.size < NUM_CHOICES; i++) {
    if (!set.has(correctAnswer + i)) set.add(correctAnswer + i);
    else if (correctAnswer - i >= 0 && !set.has(correctAnswer - i))
      set.add(correctAnswer - i);
  }

  const arr = [...set];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }

  const slot = GAME_W / NUM_CHOICES;
  return arr.map((num, i) => ({
    num,
    isCorrect: num === correctAnswer,
    cx: slot * i + slot / 2, // horizontal center
  }));
}

export default function SpaceshipGame({ question, onCorrect, onWrong }) {
  const [choices, setChoices] = useState(() => buildChoices(question.answer));
  const [shipX,   setShipX]   = useState(GAME_W / 2);
  // phase: 'aim' | 'fire' | 'hit'
  const [phase,   setPhase]   = useState('aim');
  const [hitIdx,  setHitIdx]  = useState(null);

  const laserH   = useRef(new Animated.Value(0)).current;
  const bobAnims = useRef([0, 1, 2, 3].map(() => new Animated.Value(0))).current;
  const moveRef  = useRef(null);
  const thrustAnim = useRef(new Animated.Value(1)).current;

  // Bobbing animation for asteroids
  useEffect(() => {
    const loops = bobAnims.map((anim, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, { toValue: -7, duration: 900 + i * 190, useNativeDriver: true }),
          Animated.timing(anim, { toValue:  7, duration: 900 + i * 190, useNativeDriver: true }),
        ]),
      ),
    );
    loops.forEach(l => l.start());
    return () => loops.forEach(l => l.stop());
  }, []);

  // Reset when question changes
  useEffect(() => {
    setChoices(buildChoices(question.answer));
    setShipX(GAME_W / 2);
    setPhase('aim');
    setHitIdx(null);
    laserH.setValue(0);
  }, [question.text]);

  useEffect(() => () => clearInterval(moveRef.current), []);

  function startMove(dir) {
    clearInterval(moveRef.current);
    moveRef.current = setInterval(() => {
      setShipX(x =>
        Math.max(SHIP_SIZE / 2, Math.min(GAME_W - SHIP_SIZE / 2, x + dir * 9)),
      );
    }, 16);
  }

  function stopMove() {
    clearInterval(moveRef.current);
  }

  // Which asteroid is the ship locked onto (within half a target width)?
  const lockedIdx = (() => {
    let best = { idx: -1, dist: TARGET_SIZE * 0.7 };
    choices.forEach((c, i) => {
      const d = Math.abs(c.cx - shipX);
      if (d < best.dist) best = { idx: i, dist: d };
    });
    return best.idx;
  })();

  function fire() {
    if (phase !== 'aim') return;
    clearInterval(moveRef.current);
    setPhase('fire');
    laserH.setValue(0);

    // Thrust pulse on the ship
    Animated.sequence([
      Animated.timing(thrustAnim, { toValue: 1.18, duration: 80, useNativeDriver: true }),
      Animated.timing(thrustAnim, { toValue: 1,    duration: 120, useNativeDriver: true }),
    ]).start();

    Animated.timing(laserH, {
      toValue: 1,
      duration: 300,
      useNativeDriver: false,
    }).start(() => {
      if (lockedIdx === -1) {
        // Miss — reset
        setPhase('aim');
        laserH.setValue(0);
        return;
      }

      setHitIdx(lockedIdx);
      setPhase('hit');

      if (choices[lockedIdx].isCorrect) {
        setTimeout(() => onCorrect(), 850);
      } else {
        setTimeout(() => {
          setHitIdx(null);
          setPhase('aim');
          laserH.setValue(0);
          onWrong();
        }, 850);
      }
    });
  }

  return (
    <View style={styles.container}>
      {/* Starfield */}
      {STARS.map((s, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            left:    s.left * GAME_W,
            top:     s.top  * GAME_H,
            width:   s.size,
            height:  s.size,
            borderRadius: s.size,
            backgroundColor: '#fff',
            opacity: s.opacity,
          }}
        />
      ))}

      {/* Asteroids */}
      {choices.map((c, i) => (
        <Animated.View
          key={i}
          style={[
            styles.asteroid,
            {
              left:            c.cx - TARGET_SIZE / 2,
              top:             TARGET_TOP,
              backgroundColor: COLORS[i],
              transform:       [{ translateY: bobAnims[i] }],
            },
            lockedIdx === i && phase === 'aim' && styles.locked,
            hitIdx === i && c.isCorrect          && styles.hitCorrect,
            hitIdx === i && !c.isCorrect         && styles.hitWrong,
          ]}
        >
          <Text style={styles.asteroidNum}>{c.num}</Text>
        </Animated.View>
      ))}

      {/* Aim guide — subtle vertical line when locked on */}
      {phase === 'aim' && lockedIdx !== -1 && (
        <View
          style={[
            styles.aimGuide,
            {
              left:   shipX - 1,
              bottom: SHIP_CENTER_BOT,
              height: MAX_LASER_H,
            },
          ]}
        />
      )}

      {/* Laser beam */}
      {(phase === 'fire' || phase === 'hit') && (
        <Animated.View
          style={[
            styles.laser,
            {
              left:   shipX - 3,
              bottom: SHIP_CENTER_BOT,
              height: laserH.interpolate({
                inputRange:  [0, 1],
                outputRange: [0, MAX_LASER_H],
              }),
            },
          ]}
        />
      )}

      {/* Spaceship */}
      <Animated.View
        style={[
          styles.ship,
          {
            left:   shipX - SHIP_SIZE / 2,
            bottom: SHIP_BOTTOM,
            transform: [{ scale: thrustAnim }],
          },
        ]}
      >
        <Text style={styles.shipEmoji}>🚀</Text>
      </Animated.View>

      {/* Engine glow */}
      <View
        style={[
          styles.engineGlow,
          { left: shipX - 8, bottom: SHIP_BOTTOM - 6 },
        ]}
      />

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
          style={[styles.fireBtn, phase !== 'aim' && styles.fireBtnOff]}
          onPress={fire}
          disabled={phase !== 'aim'}
          activeOpacity={0.8}
        >
          <Text style={styles.fireBtnTxt}>FIRE!</Text>
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
    backgroundColor: '#06061a',
    borderWidth:     1.5,
    borderColor:     '#1e3a5f',
    marginVertical:  8,
  },
  asteroid: {
    position:      'absolute',
    width:         TARGET_SIZE,
    height:        TARGET_SIZE,
    borderRadius:  TARGET_SIZE / 2,
    alignItems:    'center',
    justifyContent:'center',
    borderWidth:   2,
    borderColor:   'rgba(255,255,255,0.2)',
  },
  asteroidNum: {
    fontSize:   24,
    fontWeight: '800',
    color:      '#fff',
  },
  locked: {
    borderColor: '#facc15',
    borderWidth: 3,
    shadowColor: '#facc15',
    shadowOpacity: 0.9,
    shadowRadius: 10,
    elevation:   8,
  },
  hitCorrect: {
    borderColor:   '#4ade80',
    borderWidth:   3,
    shadowColor:   '#4ade80',
    shadowOpacity: 1,
    shadowRadius:  16,
    elevation:     12,
  },
  hitWrong: {
    borderColor:   '#f87171',
    borderWidth:   3,
    shadowColor:   '#f87171',
    shadowOpacity: 1,
    shadowRadius:  16,
    elevation:     12,
  },
  aimGuide: {
    position:        'absolute',
    width:           2,
    backgroundColor: 'rgba(250,204,21,0.25)',
    borderRadius:    1,
  },
  laser: {
    position:      'absolute',
    width:         6,
    borderRadius:  3,
    backgroundColor: '#fb923c',
    shadowColor:   '#fb923c',
    shadowOpacity: 1,
    shadowRadius:  10,
    elevation:     6,
  },
  ship: {
    position:      'absolute',
    width:         SHIP_SIZE,
    height:        SHIP_SIZE,
    alignItems:    'center',
    justifyContent:'center',
  },
  shipEmoji: {
    fontSize:  34,
    transform: [{ rotate: '-45deg' }],
  },
  engineGlow: {
    position:      'absolute',
    width:         16,
    height:        10,
    borderRadius:  8,
    backgroundColor: '#fb923c',
    opacity:       0.45,
  },
  controls: {
    position:        'absolute',
    bottom:          0,
    left:            0,
    right:           0,
    height:          CTRL_H,
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-around',
    paddingHorizontal: 12,
    borderTopWidth:  1,
    borderTopColor:  '#1e3a5f',
    backgroundColor: '#0a0a2e',
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
  fireBtn: {
    backgroundColor: '#dc2626',
    borderRadius:    14,
    paddingHorizontal: 32,
    paddingVertical:   14,
    borderWidth:     1,
    borderColor:     '#fca5a5',
  },
  fireBtnOff: {
    backgroundColor: '#7f1d1d',
    borderColor:     '#7f1d1d',
    opacity:         0.55,
  },
  fireBtnTxt: {
    fontSize:   20,
    fontWeight: '800',
    color:      '#fff',
    letterSpacing: 1,
  },
});
