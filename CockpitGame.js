import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Animated,
  ImageBackground,
  StyleSheet,
  Dimensions,
} from 'react-native';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

const GAME_W    = SCREEN_W - 32;
const GAME_H    = Math.round(SCREEN_H * 0.46);
const CTRL_H    = 72;
const TOTAL_H   = GAME_H + CTRL_H;
const COCKPIT_H = 128;
const SPACE_H   = TOTAL_H - COCKPIT_H;

const TARGET_R   = 32;   // target bubble radius
const CROSS_SZ   = 54;   // crosshair visual diameter

const NUM_T    = 4;
const T_COLORS = ['#7c3aed', '#0891b2', '#b45309', '#be185d'];

const COCKPIT_BG = require('./assets/cockpit.png');

function buildTargets(answer) {
  const set = new Set([answer]);
  let tries = 0;
  while (set.size < NUM_T && tries < 60) {
    const v = answer + ((Math.floor(Math.random() * 8) - 4) || 1);
    if (v >= 0) set.add(v);
    tries++;
  }
  for (let i = 1; set.size < NUM_T; i++) {
    if (!set.has(answer + i)) set.add(answer + i);
    else if (answer - i >= 0 && !set.has(answer - i)) set.add(answer - i);
  }

  const arr = [...set];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }

  return arr.map((num, i) => {
    // Place in quadrants with jitter so they spread out
    const qx   = i % 2;
    const qy   = Math.floor(i / 2);
    const bx   = qx * GAME_W / 2 + GAME_W / 4;
    const by   = qy * SPACE_H / 2 + SPACE_H / 4;
    const jx   = (Math.random() - 0.5) * (GAME_W  * 0.25);
    const jy   = (Math.random() - 0.5) * (SPACE_H * 0.25);
    const x    = Math.max(TARGET_R + 8, Math.min(GAME_W  - TARGET_R - 8, bx + jx));
    const y    = Math.max(TARGET_R + 8, Math.min(SPACE_H - TARGET_R - 8, by + jy));
    const spd  = 0.45 + Math.random() * 0.6;
    const dir  = Math.random() * Math.PI * 2;
    return {
      num,
      isCorrect: num === answer,
      x, y,
      vx: Math.cos(dir) * spd,
      vy: Math.sin(dir) * spd,
      color: T_COLORS[i],
    };
  });
}

export default function CockpitGame({ question, onCorrect, onWrong }) {
  // `targets` for React rendering (metadata: num, color, isCorrect)
  const [targets,   setTargets]   = useState(() => buildTargets(question.answer));
  const [hitState,  setHitState]  = useState(null); // { idx, isCorrect } | null
  const [lockedIdx, setLockedIdx] = useState(-1);

  // Mutable game-loop data (no re-renders)
  const phaseRef   = useRef('playing');
  const targetsRef = useRef(targets);  // holds live x, y, vx, vy
  const crossRef   = useRef({ x: GAME_W / 2, y: SPACE_H / 2 });

  // Animated values for rendering
  const txAnims = useRef(targets.map(t => new Animated.Value(t.x))).current;
  const tyAnims = useRef(targets.map(t => new Animated.Value(t.y))).current;
  const cxAnim  = useRef(new Animated.Value(GAME_W / 2)).current;
  const cyAnim  = useRef(new Animated.Value(SPACE_H / 2)).current;

  // Derived left/top for absolute positioning (computed once, never recreated)
  const tLefts = useRef(txAnims.map(a => Animated.subtract(a, TARGET_R))).current;
  const tTops  = useRef(tyAnims.map(a => Animated.subtract(a, TARGET_R))).current;
  const cLeft  = useRef(Animated.subtract(cxAnim, CROSS_SZ / 2)).current;
  const cTop   = useRef(Animated.subtract(cyAnim,  CROSS_SZ / 2)).current;

  const rafRef  = useRef(null);
  const lockRef = useRef(null);

  useEffect(() => {
    phaseRef.current = 'playing';
    const ts = buildTargets(question.answer);
    targetsRef.current = ts;
    setTargets(ts);
    setHitState(null);
    setLockedIdx(-1);
    ts.forEach((t, i) => { txAnims[i].setValue(t.x); tyAnims[i].setValue(t.y); });
    crossRef.current = { x: GAME_W / 2, y: SPACE_H / 2 };
    cxAnim.setValue(GAME_W / 2);
    cyAnim.setValue(SPACE_H / 2);

    function loop() {
      if (phaseRef.current === 'done') return;
      targetsRef.current.forEach((t, i) => {
        t.x += t.vx; t.y += t.vy;
        if (t.x <= TARGET_R || t.x >= GAME_W - TARGET_R) {
          t.vx *= -1; t.x = Math.max(TARGET_R, Math.min(GAME_W - TARGET_R, t.x));
        }
        if (t.y <= TARGET_R || t.y >= SPACE_H - TARGET_R) {
          t.vy *= -1; t.y = Math.max(TARGET_R, Math.min(SPACE_H - TARGET_R, t.y));
        }
        txAnims[i].setValue(t.x); tyAnims[i].setValue(t.y);
      });
      rafRef.current = requestAnimationFrame(loop);
    }
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
      clearInterval(lockRef.current);
    };
  }, [question.text]);

  // Tap on the game area → find nearest target → animate crosshair → fire
  function handleGameTap(e) {
    if (phaseRef.current !== 'playing' || hitState) return;
    const { locationX, locationY } = e.nativeEvent;
    if (!locationX && !locationY) return; // guard against bad events on Android

    // Find the nearest target (no radius threshold — always fire at nearest)
    let hitIdx = 0, bestDist = Infinity;
    targetsRef.current.forEach((t, i) => {
      const d = Math.hypot(t.x - locationX, t.y - locationY);
      if (d < bestDist) { bestDist = d; hitIdx = i; }
    });

    const t = targetsRef.current[hitIdx];

    // Animate crosshair to target's current position, then fire
    crossRef.current = { x: t.x, y: t.y };
    Animated.parallel([
      Animated.timing(cxAnim, { toValue: t.x, duration: 180, useNativeDriver: false }),
      Animated.timing(cyAnim, { toValue: t.y, duration: 180, useNativeDriver: false }),
    ]).start(() => {
      if (phaseRef.current !== 'playing') return;
      const isCorrect = targetsRef.current[hitIdx].isCorrect;
      setHitState({ idx: hitIdx, isCorrect });
      setLockedIdx(hitIdx);

      if (isCorrect) {
        phaseRef.current = 'done';
        cancelAnimationFrame(rafRef.current);
        setTimeout(() => onCorrect(), 900);
      } else {
        setTimeout(() => { setHitState(null); setLockedIdx(-1); onWrong(); }, 800);
      }
    });
  }

  const isLocked   = lockedIdx !== -1 && !hitState;
  const crossColor = hitState
    ? (hitState.isCorrect ? '#4ade80' : '#f87171')
    : isLocked ? '#fde047' : 'rgba(253,224,71,0.45)';

  return (
    <ImageBackground
      source={COCKPIT_BG}
      style={styles.container}
      imageStyle={styles.bgImage}
      resizeMode="cover"
    >
      {/* Tap zone — explicit width/height, touch-down responder for Android reliability */}
      <View
        style={{ position: 'absolute', top: 0, left: 0, width: GAME_W, height: SPACE_H }}
        onStartShouldSetResponder={() => true}
        onResponderGrant={handleGameTap}
      />

      {/* Drifting number targets */}
      {targets.map((t, i) => {
        const hit    = hitState?.idx === i;
        const locked = lockedIdx === i && !hitState;
        return (
          <Animated.View
            key={i}
            pointerEvents="none"
            style={[
              styles.target,
              { left: tLefts[i], top: tTops[i], backgroundColor: t.color },
              locked && styles.targetLocked,
              hit && t.isCorrect  && styles.targetHitOk,
              hit && !t.isCorrect && styles.targetHitBad,
            ]}
          >
            <Text style={styles.targetNum}>{t.num}</Text>
            {hit && <Text style={styles.hitIcon}>{t.isCorrect ? '✓' : '✗'}</Text>}
          </Animated.View>
        );
      })}

      {/* Crosshair */}
      <Animated.View
        style={[styles.crosshair, { left: cLeft, top: cTop }]}
        pointerEvents="none"
      >
        <View style={[styles.chArm, styles.chArmH, { backgroundColor: crossColor }]} />
        <View style={[styles.chArm, styles.chArmV, { backgroundColor: crossColor }]} />
        <View style={[styles.chRing, { borderColor: crossColor }]} />
        <View style={[styles.chDot, { backgroundColor: crossColor }]} />
      </Animated.View>

      {/* Cockpit panel — mission info only */}
      <View style={styles.cockpit}>
        <View style={styles.screen}>
          <Text style={styles.screenLabel}>MISSION</Text>
          <Text style={styles.screenQ}>{question.text} = ?</Text>
          <Text style={styles.screenHint}>
            {hitState ? (hitState.isCorrect ? '✓ HIT' : '✗ MISS') : '👆 TAP THE ANSWER'}
          </Text>
        </View>
      </View>
    </ImageBackground>
  );
}


const styles = StyleSheet.create({
  container: {
    width:          GAME_W,
    height:         TOTAL_H,
    borderRadius:   20,
    overflow:       'hidden',
    borderWidth:    1.5,
    borderColor:    '#1e3a5f',
    marginVertical: 8,
  },
  bgImage: {
    borderRadius: 20,
  },

  // Targets
  target: {
    position:        'absolute',
    width:           TARGET_R * 2,
    height:          TARGET_R * 2,
    borderRadius:    TARGET_R,
    alignItems:      'center',
    justifyContent:  'center',
    borderWidth:     2,
    borderColor:     'rgba(255,255,255,0.25)',
  },
  targetLocked: {
    borderColor:   '#fde047',
    borderWidth:   3,
    shadowColor:   '#fde047',
    shadowOpacity: 0.9,
    shadowRadius:  12,
    elevation:     8,
  },
  targetHitOk: {
    borderColor:   '#4ade80',
    shadowColor:   '#4ade80',
    shadowOpacity: 1,
    shadowRadius:  18,
    elevation:     12,
  },
  targetHitBad: {
    borderColor:   '#f87171',
    shadowColor:   '#f87171',
    shadowOpacity: 1,
    shadowRadius:  18,
    elevation:     12,
  },
  targetNum: {
    fontSize:   22,
    fontWeight: '800',
    color:      '#fff',
  },
  hitIcon: {
    position:   'absolute',
    fontSize:   20,
    fontWeight: '900',
    color:      '#fff',
  },

  // Crosshair
  crosshair: {
    position:        'absolute',
    width:           CROSS_SZ,
    height:          CROSS_SZ,
    alignItems:      'center',
    justifyContent:  'center',
  },
  chArm: {
    position:     'absolute',
    borderRadius: 1,
  },
  chArmH: { width: CROSS_SZ, height: 2 },
  chArmV: { width: 2, height: CROSS_SZ },
  chRing: {
    position:     'absolute',
    width:        38,
    height:       38,
    borderRadius: 19,
    borderWidth:  2,
  },
  chDot: {
    position:     'absolute',
    width:        6,
    height:       6,
    borderRadius: 3,
  },

  // Cockpit panel
  cockpit: {
    position:          'absolute',
    bottom:            0,
    left:              0,
    right:             0,
    height:            COCKPIT_H,
    backgroundColor:   'rgba(4,10,22,0.82)',
    borderTopWidth:    2,
    borderTopColor:    '#1e4976',
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: 14,
  },

  // Mission screen
  screen: {
    flex:              1,
    alignItems:        'center',
    justifyContent:    'center',
    backgroundColor:   '#040d18',
    borderRadius:      10,
    marginHorizontal:  10,
    height:            COCKPIT_H - 20,
    borderWidth:       1,
    borderColor:       '#1e4976',
    gap:               2,
  },
  screenLabel: {
    fontSize:      9,
    color:         '#3b82f6',
    fontWeight:    '700',
    letterSpacing: 3,
  },
  screenQ: {
    fontSize:      20,
    fontWeight:    '800',
    color:         '#4ade80',
    letterSpacing: 1,
  },
  screenHint: {
    fontSize:  10,
    color:     '#fde047',
    fontWeight:'600',
  },

});
