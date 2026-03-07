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
const COCKPIT_H = 128;
const SPACE_H   = TOTAL_H - COCKPIT_H;

const TARGET_R   = 32;   // target bubble radius
const CROSS_SZ   = 54;   // crosshair visual diameter
const LOCK_DIST  = TARGET_R + 20;  // px from target center for lock/hit
const CROSS_SPD  = 9;

const NUM_T    = 4;
const T_COLORS = ['#7c3aed', '#0891b2', '#b45309', '#be185d'];

const STARS = Array.from({ length: 50 }, (_, i) => ({
  x: ((i * 73 + 17) % 97) / 97,
  y: ((i * 47 + 31) % 89) / 89,
  s: 1 + (i % 3),
  o: 0.25 + (i % 4) * 0.18,
}));

// A few slow-moving large "nebula" blobs for depth
const NEBULAE = [
  { x: 0.15, y: 0.2,  w: 120, h: 80,  color: 'rgba(124,58,237,0.07)' },
  { x: 0.65, y: 0.55, w: 140, h: 90,  color: 'rgba(8,145,178,0.07)'  },
  { x: 0.4,  y: 0.8,  w: 100, h: 60,  color: 'rgba(180,83,9,0.07)'   },
];

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
  const moveRef = useRef(null);
  const lockRef = useRef(null);

  useEffect(() => {
    // Reset
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

    // Game loop — updates target positions every frame
    function loop() {
      if (phaseRef.current === 'done') return;
      targetsRef.current.forEach((t, i) => {
        t.x += t.vx;
        t.y += t.vy;
        if (t.x <= TARGET_R || t.x >= GAME_W - TARGET_R) {
          t.vx *= -1;
          t.x = Math.max(TARGET_R, Math.min(GAME_W - TARGET_R, t.x));
        }
        if (t.y <= TARGET_R || t.y >= SPACE_H - TARGET_R) {
          t.vy *= -1;
          t.y = Math.max(TARGET_R, Math.min(SPACE_H - TARGET_R, t.y));
        }
        txAnims[i].setValue(t.x);
        tyAnims[i].setValue(t.y);
      });
      rafRef.current = requestAnimationFrame(loop);
    }
    rafRef.current = requestAnimationFrame(loop);

    // Lock detection at 20fps (cheap compared to 60fps game loop)
    lockRef.current = setInterval(() => {
      if (phaseRef.current === 'done') return;
      const { x, y } = crossRef.current;
      let found = -1;
      targetsRef.current.forEach((t, i) => {
        if (Math.hypot(t.x - x, t.y - y) < LOCK_DIST) found = i;
      });
      setLockedIdx(found);
    }, 50);

    return () => {
      cancelAnimationFrame(rafRef.current);
      clearInterval(lockRef.current);
      clearInterval(moveRef.current);
    };
  }, [question.text]);

  function startMove(dx, dy) {
    clearInterval(moveRef.current);
    moveRef.current = setInterval(() => {
      const c = crossRef.current;
      c.x = Math.max(CROSS_SZ / 2, Math.min(GAME_W  - CROSS_SZ / 2, c.x + dx * CROSS_SPD));
      c.y = Math.max(CROSS_SZ / 2, Math.min(SPACE_H - CROSS_SZ / 2, c.y + dy * CROSS_SPD));
      cxAnim.setValue(c.x);
      cyAnim.setValue(c.y);
    }, 16);
  }

  function stopMove() { clearInterval(moveRef.current); }

  function fire() {
    if (phaseRef.current !== 'playing' || hitState) return;
    clearInterval(moveRef.current);

    const { x, y } = crossRef.current;
    let hitIdx = -1;
    targetsRef.current.forEach((t, i) => {
      if (Math.hypot(t.x - x, t.y - y) < LOCK_DIST) hitIdx = i;
    });
    if (hitIdx === -1) return; // clean miss

    const isCorrect = targetsRef.current[hitIdx].isCorrect;
    setHitState({ idx: hitIdx, isCorrect });

    if (isCorrect) {
      phaseRef.current = 'done';
      cancelAnimationFrame(rafRef.current);
      setTimeout(() => onCorrect(), 900);
    } else {
      setTimeout(() => { setHitState(null); onWrong(); }, 800);
    }
  }

  const isLocked    = lockedIdx !== -1 && !hitState;
  const crossColor  = hitState
    ? (hitState.isCorrect ? '#4ade80' : '#f87171')
    : isLocked ? '#fde047' : 'rgba(253,224,71,0.45)';

  return (
    <View style={styles.container}>
      {/* Deep space background */}
      <View style={StyleSheet.absoluteFill}>
        {/* Nebulae */}
        {NEBULAE.map((n, i) => (
          <View
            key={i}
            style={{
              position:        'absolute',
              left:            n.x * GAME_W,
              top:             n.y * SPACE_H,
              width:           n.w,
              height:          n.h,
              borderRadius:    n.h,
              backgroundColor: n.color,
            }}
          />
        ))}
        {/* Stars */}
        {STARS.map((s, i) => (
          <View
            key={i}
            style={{
              position:        'absolute',
              left:            s.x * GAME_W,
              top:             s.y * SPACE_H,
              width:           s.s,
              height:          s.s,
              borderRadius:    s.s,
              backgroundColor: '#fff',
              opacity:         s.o,
            }}
          />
        ))}
      </View>

      {/* Drifting number targets */}
      {targets.map((t, i) => {
        const hit     = hitState?.idx === i;
        const locked  = lockedIdx === i && !hitState;
        return (
          <Animated.View
            key={i}
            style={[
              styles.target,
              {
                left:            tLefts[i],
                top:             tTops[i],
                backgroundColor: t.color,
              },
              locked && styles.targetLocked,
              hit && t.isCorrect  && styles.targetHitOk,
              hit && !t.isCorrect && styles.targetHitBad,
            ]}
          >
            <Text style={styles.targetNum}>{t.num}</Text>
            {hit && (
              <Text style={styles.hitIcon}>{t.isCorrect ? '✓' : '✗'}</Text>
            )}
          </Animated.View>
        );
      })}

      {/* Crosshair */}
      <Animated.View
        style={[styles.crosshair, { left: cLeft, top: cTop }]}
        pointerEvents="none"
      >
        {/* Horizontal arm */}
        <View style={[styles.chArm, styles.chArmH, { backgroundColor: crossColor }]} />
        {/* Vertical arm */}
        <View style={[styles.chArm, styles.chArmV, { backgroundColor: crossColor }]} />
        {/* Ring */}
        <View style={[styles.chRing, { borderColor: crossColor }]} />
        {/* Center dot */}
        <View style={[styles.chDot, { backgroundColor: crossColor }]} />
      </Animated.View>

      {/* Cockpit panel */}
      <View style={styles.cockpit}>
        {/* D-pad */}
        <View style={styles.dpad}>
          <View style={styles.dpadRow}>
            <TouchableOpacity
              style={styles.dpadBtn}
              onPressIn={() => startMove(0, -1)}
              onPressOut={stopMove}
              activeOpacity={0.6}
            >
              <Text style={styles.dpadTxt}>▲</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.dpadRow}>
            <TouchableOpacity
              style={styles.dpadBtn}
              onPressIn={() => startMove(-1, 0)}
              onPressOut={stopMove}
              activeOpacity={0.6}
            >
              <Text style={styles.dpadTxt}>◄</Text>
            </TouchableOpacity>
            <View style={styles.dpadGap} />
            <TouchableOpacity
              style={styles.dpadBtn}
              onPressIn={() => startMove(1, 0)}
              onPressOut={stopMove}
              activeOpacity={0.6}
            >
              <Text style={styles.dpadTxt}>►</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.dpadRow}>
            <TouchableOpacity
              style={styles.dpadBtn}
              onPressIn={() => startMove(0, 1)}
              onPressOut={stopMove}
              activeOpacity={0.6}
            >
              <Text style={styles.dpadTxt}>▼</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Mission screen */}
        <View style={styles.screen}>
          <Text style={styles.screenLabel}>MISSION</Text>
          <Text style={styles.screenQ}>{question.text} = ?</Text>
          <Text style={styles.screenHint}>
            {isLocked ? '🔒 LOCKED' : '— AIM —'}
          </Text>
        </View>

        {/* Fire button */}
        <TouchableOpacity
          style={[styles.fireBtn, !!hitState && styles.fireBtnCooldown]}
          onPress={fire}
          disabled={!!hitState}
          activeOpacity={0.8}
        >
          <Text style={styles.fireBtnTxt}>FIRE</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const DPAD_BTN = 36;

const styles = StyleSheet.create({
  container: {
    width:           GAME_W,
    height:          TOTAL_H,
    borderRadius:    20,
    overflow:        'hidden',
    backgroundColor: '#00000f',
    borderWidth:     1.5,
    borderColor:     '#1e3a5f',
    marginVertical:  8,
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
    backgroundColor:   '#080f1a',
    borderTopWidth:    2,
    borderTopColor:    '#1e4976',
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: 14,
  },

  // D-pad
  dpad: {
    alignItems: 'center',
    gap:        3,
  },
  dpadRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            3,
  },
  dpadBtn: {
    width:           DPAD_BTN,
    height:          DPAD_BTN,
    backgroundColor: '#112233',
    borderRadius:    8,
    alignItems:      'center',
    justifyContent:  'center',
    borderWidth:     1,
    borderColor:     '#1e4976',
  },
  dpadGap: { width: DPAD_BTN, height: DPAD_BTN },
  dpadTxt: {
    fontSize:   16,
    color:      '#60a5fa',
    fontWeight: '700',
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

  // Fire button
  fireBtn: {
    width:           68,
    height:          68,
    borderRadius:    34,
    backgroundColor: '#dc2626',
    alignItems:      'center',
    justifyContent:  'center',
    borderWidth:     3,
    borderColor:     '#fca5a5',
    shadowColor:     '#dc2626',
    shadowOpacity:   0.7,
    shadowRadius:    12,
    elevation:       8,
  },
  fireBtnCooldown: {
    backgroundColor: '#450a0a',
    borderColor:     '#450a0a',
    shadowOpacity:   0,
    elevation:       0,
  },
  fireBtnTxt: {
    fontSize:      14,
    fontWeight:    '900',
    color:         '#fff',
    letterSpacing: 2,
  },
});
