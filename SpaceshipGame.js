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
const GAME_H    = Math.round(SCREEN_H * 0.54); // taller — no control bar
const TOTAL_H   = GAME_H;

const NUM_CHOICES = 4;

// Scale game objects relative to screen width so they fit on any device
const TARGET_SIZE = Math.round(Math.min(GAME_W / NUM_CHOICES * 0.72, 80));
const SHIP_SIZE   = Math.round(TARGET_SIZE * 0.62);

const TARGET_TOP        = Math.round(GAME_H * 0.05);
const SHIP_BOTTOM_PX    = Math.round(GAME_H * 0.09);   // from container bottom
const SHIP_CENTER_BOT   = SHIP_BOTTOM_PX + SHIP_SIZE / 2;
const TARGET_BOT_FROM_BOT = TOTAL_H - TARGET_TOP - TARGET_SIZE;
const MAX_LASER_H       = TARGET_BOT_FROM_BOT - SHIP_CENTER_BOT - 6;

const COLORS = ['#7c3aed', '#0891b2', '#b45309', '#be185d'];

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
    const val = correctAnswer + ((Math.floor(Math.random() * 8) - 4) || 1);
    if (val >= 0) set.add(val);
    tries++;
  }
  for (let i = 1; set.size < NUM_CHOICES; i++) {
    if (!set.has(correctAnswer + i))                         set.add(correctAnswer + i);
    else if (correctAnswer - i >= 0 && !set.has(correctAnswer - i)) set.add(correctAnswer - i);
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
    cx: slot * i + slot / 2,
  }));
}

export default function SpaceshipGame({ question, onCorrect, onWrong }) {
  const [choices, setChoices] = useState(() => buildChoices(question.answer));
  const [phase,   setPhase]   = useState('aim'); // 'aim' | 'moving' | 'fire' | 'hit'
  const [hitIdx,  setHitIdx]  = useState(null);

  const shipXAnim  = useRef(new Animated.Value(GAME_W / 2)).current;
  const shipXRef   = useRef(GAME_W / 2);
  const laserH     = useRef(new Animated.Value(0)).current;
  const thrustAnim = useRef(new Animated.Value(1)).current;
  const bobAnims   = useRef([0, 1, 2, 3].map(() => new Animated.Value(0))).current;
  const phaseRef   = useRef('aim');

  // Keep shipXRef in sync so laser position is accurate
  useEffect(() => {
    const id = shipXAnim.addListener(({ value }) => { shipXRef.current = value; });
    return () => shipXAnim.removeListener(id);
  }, []);

  // Bobbing asteroids
  useEffect(() => {
    const loops = bobAnims.map((anim, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, { toValue: -8, duration: 900 + i * 190, useNativeDriver: true }),
          Animated.timing(anim, { toValue:  8, duration: 900 + i * 190, useNativeDriver: true }),
        ]),
      ),
    );
    loops.forEach(l => l.start());
    return () => loops.forEach(l => l.stop());
  }, []);

  useEffect(() => {
    setChoices(buildChoices(question.answer));
    shipXAnim.setValue(GAME_W / 2);
    shipXRef.current = GAME_W / 2;
    phaseRef.current = 'aim';
    setPhase('aim');
    setHitIdx(null);
    laserH.setValue(0);
  }, [question.text]);

  function tapAsteroid(idx) {
    if (phaseRef.current !== 'aim') return;
    phaseRef.current = 'moving';
    setPhase('moving');

    const targetCx = choices[idx].cx;

    // Glide ship to align
    Animated.timing(shipXAnim, {
      toValue:         targetCx,
      duration:        Math.abs(targetCx - shipXRef.current) * 1.2 + 80,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (!finished) return;
      fireAt(idx);
    });
  }

  function fireAt(idx) {
    phaseRef.current = 'fire';
    setPhase('fire');
    laserH.setValue(0);

    Animated.sequence([
      Animated.timing(thrustAnim, { toValue: 1.18, duration: 80,  useNativeDriver: false }),
      Animated.timing(thrustAnim, { toValue: 1,    duration: 120, useNativeDriver: false }),
    ]).start();

    Animated.timing(laserH, {
      toValue:         1,
      duration:        280,
      useNativeDriver: false,
    }).start(() => {
      setHitIdx(idx);
      phaseRef.current = 'hit';
      setPhase('hit');

      if (choices[idx].isCorrect) {
        setTimeout(() => onCorrect(), 850);
      } else {
        setTimeout(() => {
          setHitIdx(null);
          phaseRef.current = 'aim';
          setPhase('aim');
          laserH.setValue(0);
          onWrong();
        }, 850);
      }
    });
  }

  // Laser left tracks the animated ship position
  const laserLeft = Animated.subtract(shipXAnim, 3);

  return (
    <View style={styles.container}>
      {/* Starfield */}
      {STARS.map((s, i) => (
        <View
          key={i}
          style={{
            position:        'absolute',
            left:            s.left * GAME_W,
            top:             s.top  * GAME_H,
            width:           s.size,
            height:          s.size,
            borderRadius:    s.size,
            backgroundColor: '#fff',
            opacity:         s.opacity,
          }}
        />
      ))}

      {/* Asteroids — tappable. TouchableOpacity owns the hit area; Animated.View is a non-absolute child. */}
      {choices.map((c, i) => (
        <TouchableOpacity
          key={i}
          activeOpacity={0.75}
          onPress={() => tapAsteroid(i)}
          disabled={phase !== 'aim'}
          style={{
            position: 'absolute',
            left:     c.cx - TARGET_SIZE / 2,
            top:      TARGET_TOP,
            width:    TARGET_SIZE,
            height:   TARGET_SIZE,
          }}
        >
          <Animated.View
            style={[
              styles.asteroid,
              {
                backgroundColor: COLORS[i],
                transform:       [{ translateY: bobAnims[i] }],
              },
              hitIdx === i && c.isCorrect  && styles.hitCorrect,
              hitIdx === i && !c.isCorrect && styles.hitWrong,
            ]}
          >
            <Text style={styles.asteroidNum}>{c.num}</Text>
            {phase === 'aim' && (
              <Text style={styles.tapHint}>tap</Text>
            )}
          </Animated.View>
        </TouchableOpacity>
      ))}

      {/* Laser beam */}
      {(phase === 'fire' || phase === 'hit') && (
        <Animated.View
          style={[
            styles.laser,
            {
              left:   laserLeft,
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
            left:      Animated.subtract(shipXAnim, SHIP_SIZE / 2),
            bottom:    SHIP_BOTTOM_PX,
            transform: [{ scale: thrustAnim }],
          },
        ]}
      >
        <Text style={styles.shipEmoji}>🚀</Text>
      </Animated.View>

      {/* Engine glow */}
      <Animated.View
        style={[
          styles.engineGlow,
          { left: Animated.subtract(shipXAnim, 8), bottom: SHIP_BOTTOM_PX - 6 },
        ]}
      />

      {/* Hint label */}
      <View style={styles.hintBar}>
        <Text style={styles.hintTxt}>
          {phase === 'aim' ? '👆 Tap the correct answer' : phase === 'moving' ? '🚀 Locking on…' : '🔥 Firing!'}
        </Text>
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
    width:          TARGET_SIZE,
    height:         TARGET_SIZE,
    borderRadius:   TARGET_SIZE / 2,
    alignItems:     'center',
    justifyContent: 'center',
    borderWidth:    2,
    borderColor:    'rgba(255,255,255,0.2)',
  },
  asteroidNum: {
    fontSize:   26,
    fontWeight: '800',
    color:      '#fff',
  },
  tapHint: {
    fontSize:   9,
    color:      'rgba(255,255,255,0.5)',
    fontWeight: '600',
    marginTop:  1,
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
  laser: {
    position:        'absolute',
    width:           6,
    borderRadius:    3,
    backgroundColor: '#fb923c',
    shadowColor:     '#fb923c',
    shadowOpacity:   1,
    shadowRadius:    10,
    elevation:       6,
  },
  ship: {
    position:       'absolute',
    width:          SHIP_SIZE,
    height:         SHIP_SIZE,
    alignItems:     'center',
    justifyContent: 'center',
  },
  shipEmoji: {
    fontSize:  34,
    transform: [{ rotate: '-45deg' }],
  },
  engineGlow: {
    position:        'absolute',
    width:           16,
    height:          10,
    borderRadius:    8,
    backgroundColor: '#fb923c',
    opacity:         0.45,
  },
  hintBar: {
    position:          'absolute',
    bottom:            0,
    left:              0,
    right:             0,
    height:            36,
    alignItems:        'center',
    justifyContent:    'center',
    backgroundColor:   'rgba(0,0,15,0.6)',
    borderTopWidth:    1,
    borderTopColor:    '#1e3a5f',
  },
  hintTxt: {
    fontSize:   13,
    color:      'rgba(255,255,255,0.65)',
    fontWeight: '600',
  },
});
