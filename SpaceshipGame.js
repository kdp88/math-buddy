import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { buildAnswerChoices } from './utils/buildAnswerChoices';

const NUM_CHOICES       = 4;
const COLORS            = ['#7c3aed', '#0891b2', '#b45309', '#be185d'];
const HIT_FEEDBACK_MS   = 850;
const LASER_DURATION_MS = 280;
const GAME_HEIGHT_RATIO = 0.54;

const STARS = Array.from({ length: 28 }, (_, i) => ({
  left:    ((i * 73  + 17) % 97) / 97,
  top:     ((i * 47  + 31) % 89) / 89,
  size:    1 + (i % 3),
  opacity: 0.35 + (i % 4) * 0.15,
}));

function buildChoices(correctAnswer, gameW) {
  const slot = gameW / NUM_CHOICES;
  return buildAnswerChoices(correctAnswer).map((c, i) => ({
    ...c,
    cx: slot * i + slot / 2,
  }));
}

export default function SpaceshipGame({ question, onCorrect, onWrong }) {
  const { width: screenW, height: screenH } = useWindowDimensions();
  const gameW = screenW - 32;
  const gameH = Math.round(screenH * GAME_HEIGHT_RATIO);

  // Scale game objects relative to screen width so they fit on any device
  const targetSize     = Math.round(Math.min(gameW / NUM_CHOICES * 0.72, 80));
  const shipSize       = Math.round(targetSize * 0.62);
  const targetTop      = Math.round(gameH * 0.05);
  const shipBottomPx   = Math.round(gameH * 0.09);
  const shipCenterBot  = shipBottomPx + shipSize / 2;
  const targetBotFromBot = gameH - targetTop - targetSize;
  const maxLaserH      = targetBotFromBot - shipCenterBot - 6;

  const [choices, setChoices] = useState(() => buildChoices(question.answer, gameW));
  const [phase,   setPhase]   = useState('aim'); // 'aim' | 'moving' | 'fire' | 'hit'
  const [hitIdx,  setHitIdx]  = useState(null);

  const shipXAnim    = useRef(new Animated.Value(gameW / 2)).current;
  const shipXRef     = useRef(gameW / 2);
  const laserH       = useRef(new Animated.Value(0)).current;
  const thrustAnim   = useRef(new Animated.Value(1)).current;
  const bobAnims     = useRef([0, 1, 2, 3].map(() => new Animated.Value(0))).current;
  const phaseRef     = useRef('aim');
  const activeAnimRef = useRef(null);
  const laserLeft    = useRef(Animated.subtract(shipXAnim, 3)).current;

  // Keep shipXRef in sync so laser position is accurate
  useEffect(() => {
    const id = shipXAnim.addListener(({ value }) => { shipXRef.current = value; });
    return () => shipXAnim.removeListener(id);
  }, []);

  // Stop all animations and block callbacks on unmount
  useEffect(() => {
    return () => {
      phaseRef.current = 'unmounted';
      activeAnimRef.current?.stop();
    };
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
    setChoices(buildChoices(question.answer, gameW));
    shipXAnim.setValue(gameW / 2);
    shipXRef.current = gameW / 2;
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
    const glideAnim = Animated.timing(shipXAnim, {
      toValue:         targetCx,
      duration:        Math.abs(targetCx - shipXRef.current) * 1.2 + 80,
      useNativeDriver: false,
    });
    activeAnimRef.current = glideAnim;
    glideAnim.start(({ finished }) => {
      if (!finished || phaseRef.current === 'unmounted') return;
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

    const laserAnim = Animated.timing(laserH, {
      toValue:         1,
      duration:        LASER_DURATION_MS,
      useNativeDriver: false,
    });
    activeAnimRef.current = laserAnim;
    laserAnim.start(({ finished }) => {
      if (!finished || phaseRef.current === 'unmounted') return;
      setHitIdx(idx);
      phaseRef.current = 'hit';
      setPhase('hit');

      if (choices[idx].isCorrect) {
        setTimeout(() => {
          if (phaseRef.current !== 'unmounted') onCorrect();
        }, HIT_FEEDBACK_MS);
      } else {
        setTimeout(() => {
          if (phaseRef.current === 'unmounted') return;
          setHitIdx(null);
          phaseRef.current = 'aim';
          setPhase('aim');
          laserH.setValue(0);
          onWrong();
        }, HIT_FEEDBACK_MS);
      }
    });
  }

  return (
    <View testID="spaceship-container" style={[styles.container, { width: gameW, height: gameH }]}>
      {/* Starfield */}
      {STARS.map((star, i) => (
        <View
          key={i}
          style={{
            position:        'absolute',
            left:            star.left * gameW,
            top:             star.top  * gameH,
            width:           star.size,
            height:          star.size,
            borderRadius:    star.size,
            backgroundColor: '#fff',
            opacity:         star.opacity,
          }}
        />
      ))}

      {/* Asteroids — tappable. TouchableOpacity owns the hit area; Animated.View is a non-absolute child. */}
      {choices.map((c, i) => (
        <TouchableOpacity
          key={i}
          testID={`spaceship-asteroid-${c.num}`}
          accessibilityLabel={`Asteroid ${c.num}`}
          accessibilityRole="button"
          accessible={true}
          activeOpacity={0.75}
          onPress={() => tapAsteroid(i)}
          disabled={phase !== 'aim'}
          style={{
            position: 'absolute',
            left:     c.cx - targetSize / 2,
            top:      targetTop,
            width:    targetSize,
            height:   targetSize,
          }}
        >
          <Animated.View
            style={[
              styles.asteroid,
              {
                width:           targetSize,
                height:          targetSize,
                borderRadius:    targetSize / 2,
                backgroundColor: COLORS[i],
                transform:       [{ translateY: bobAnims[i] }],
              },
              hitIdx === i && c.isCorrect  && styles.hitCorrect,
              hitIdx === i && !c.isCorrect && styles.hitWrong,
            ]}
          >
            <Text testID={`spaceship-asteroid-num-${c.num}`} style={styles.asteroidNum}>{c.num}</Text>
            {phase === 'aim' && (
              <Text style={styles.tapHint}>tap</Text>
            )}
          </Animated.View>
        </TouchableOpacity>
      ))}

      {/* Laser beam */}
      {(phase === 'fire' || phase === 'hit') && (
        <Animated.View
          testID="spaceship-laser"
          style={[
            styles.laser,
            {
              left:   laserLeft,
              bottom: shipCenterBot,
              height: laserH.interpolate({
                inputRange:  [0, 1],
                outputRange: [0, maxLaserH],
              }),
            },
          ]}
        />
      )}

      {/* Spaceship */}
      <Animated.View
        testID="spaceship-ship"
        style={[
          styles.ship,
          {
            width:     shipSize,
            height:    shipSize,
            left:      Animated.subtract(shipXAnim, shipSize / 2),
            bottom:    shipBottomPx,
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
          { left: Animated.subtract(shipXAnim, 8), bottom: shipBottomPx - 6 },
        ]}
      />

      {/* Hint label */}
      <View testID="spaceship-hint-bar" style={styles.hintBar}>
        <Text testID="spaceship-hint-text" style={styles.hintTxt}>
          {phase === 'aim' ? '👆 Tap the correct answer' : phase === 'moving' ? '🚀 Locking on…' : '🔥 Firing!'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius:    20,
    overflow:        'hidden',
    backgroundColor: '#06061a',
    borderWidth:     1.5,
    borderColor:     '#1e3a5f',
    marginVertical:  8,
  },
  asteroid: {
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
