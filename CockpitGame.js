import { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions, Animated, Easing } from 'react-native';

// ── Target layout (fraction of window area) ──────────────────────────────────
const TARGET_SLOTS = [
  { cx: 0.17, cy: 0.40 },
  { cx: 0.37, cy: 0.22 },
  { cx: 0.63, cy: 0.28 },
  { cx: 0.83, cy: 0.38 },
];
const NUM_COLORS = ['#7c3aed', '#0891b2', '#c2410c', '#be185d'];

// ── Starfield — 3 parallax layers (far/mid/near), each doubled for seamless wrap ──
function makeStars(count, minSize, maxSize, minOp, maxOp) {
  return Array.from({ length: count }, () => ({
    x:    Math.random(),
    y:    0.04 + Math.random() * 0.88,
    size: minSize + Math.random() * (maxSize - minSize),
    op:   minOp  + Math.random() * (maxOp  - minOp),
  }));
}
const FAR_STARS  = makeStars(32, 0.5, 1.4, 0.15, 0.45);
const MID_STARS  = makeStars(22, 1.0, 2.2, 0.30, 0.65);
const NEAR_STARS = makeStars(12, 2.0, 3.5, 0.55, 0.90);

// ── Flying planets ────────────────────────────────────────────────────────────
const PLANET_DEFS = [
  { emoji: '🌍', size: 40, yFrac: 0.18, duration: 28000, stagger:     0 },
  { emoji: '🪐', size: 56, yFrac: 0.62, duration: 20000, stagger:  8000 },
  { emoji: '🌕', size: 26, yFrac: 0.40, duration: 14000, stagger: 15000 },
];

// ── Dashboard button definitions ──────────────────────────────────────────────
const L_BTNS = [
  ['#22c55e','#ef4444','#f59e0b'],
  ['#3b82f6','#a855f7','#06b6d4'],
];
const R_BTNS = [
  ['#f59e0b','#ef4444','#3b82f6'],
  ['#a855f7','#22c55e','#f97316'],
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function buildTargets(answer) {
  const set = new Set([answer]);
  let tries = 0;
  while (set.size < 4 && tries < 60) {
    const v = answer + ((Math.floor(Math.random() * 8) - 4) || 1);
    if (v >= 0) set.add(v);
    tries++;
  }
  for (let i = 1; set.size < 4; i++) {
    if (!set.has(answer + i))                          set.add(answer + i);
    else if (answer - i >= 0 && !set.has(answer - i)) set.add(answer - i);
  }
  const arr = [...set];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.map((num, i) => ({ num, isCorrect: num === answer, colorIdx: i }));
}

// ── Blinking button ───────────────────────────────────────────────────────────
function BlinkButton({ color, square, delay }) {
  const anim = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const dur = 700 + Math.random() * 1100;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay ?? 0),
        Animated.timing(anim, { toValue: 1,    duration: 180, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.35, duration: dur, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <View style={[s.btnBase, square ? s.btnSquareBase : s.btnCircleBase]}>
      <Animated.View style={[
        s.btnGlow,
        square ? s.btnSquareGlow : s.btnCircleGlow,
        { backgroundColor: color, opacity: anim },
      ]} />
    </View>
  );
}

// ── Floating number target ────────────────────────────────────────────────────
function NumberTarget({ target, onTap, hit, px, py }) {
  const bobY  = useRef(new Animated.Value(0)).current;
  const bobX  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const yd = 1300 + Math.random() * 700;
    const xd = 2000 + Math.random() * 1200;
    const loopY = Animated.loop(Animated.sequence([
      Animated.timing(bobY, { toValue:  1, duration: yd, useNativeDriver: true }),
      Animated.timing(bobY, { toValue: -1, duration: yd, useNativeDriver: true }),
    ]));
    const loopX = Animated.loop(Animated.sequence([
      Animated.timing(bobX, { toValue:  1, duration: xd, useNativeDriver: true }),
      Animated.timing(bobX, { toValue: -1, duration: xd, useNativeDriver: true }),
    ]));
    loopY.start();
    loopX.start();
    return () => { loopY.stop(); loopX.stop(); };
  }, []);

  const ty = bobY.interpolate({ inputRange: [-1, 1], outputRange: [-9, 9] });
  const tx = bobX.interpolate({ inputRange: [-1, 1], outputRange: [-6, 6] });

  const isCorrect = hit === 'correct';
  const isWrong   = hit === 'wrong';
  const bg = isCorrect ? 'rgba(74,222,128,0.95)'
           : isWrong   ? 'rgba(248,113,113,0.95)'
           : NUM_COLORS[target.colorIdx] + 'ee';
  const glowColor = NUM_COLORS[target.colorIdx];

  return (
    <Animated.View style={[s.targetWrap, { left: px - 30, top: py - 30, transform: [{ translateX: tx }, { translateY: ty }] }]}>
      {/* Outer glow ring */}
      <View style={[s.targetGlowRing, { borderColor: glowColor + '66' }]} />
      <TouchableOpacity
        onPress={onTap}
        disabled={hit !== 'none'}
        style={[s.targetBtn, { backgroundColor: bg, shadowColor: glowColor }]}
        activeOpacity={0.75}
      >
        <Text style={s.targetNum}>{target.num}</Text>
        {hit !== 'none' && <Text style={s.hitIcon}>{isCorrect ? '✓' : '✗'}</Text>}
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── Steering wheel ────────────────────────────────────────────────────────────
function SteeringWheel({ dashH }) {
  const WR = Math.min(dashH * 0.55, 64); // rim radius
  return (
    <View style={s.wheelWrap}>
      {/* Rim */}
      <View style={[s.wheelRim, { width: WR * 2, height: WR * 2, borderRadius: WR }]}>
        {/* 4 spokes */}
        {[0, 45, 90, 135].map(deg => (
          <View key={deg} style={[s.spoke, { transform: [{ rotate: `${deg}deg` }] }]} />
        ))}
        {/* Hub */}
        <View style={s.wheelHub} />
      </View>
      <View style={s.wheelColumn} />
    </View>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function CockpitGame({ question, onCorrect, onWrong }) {
  const { width: screenW, height: screenH } = useWindowDimensions();
  const gameW = screenW - 16;
  const gameH = Math.min(Math.round(screenH * 0.62), screenH - 220);
  const winH  = Math.round(gameH * 0.60);
  const dashH = gameH - winH;

  const [targets,    setTargets]    = useState(() => buildTargets(question.answer));
  const [hitResults, setHitResults] = useState(['none','none','none','none']);
  const doneRef = useRef(false);

  const farScroll  = useRef(new Animated.Value(0)).current;
  const midScroll  = useRef(new Animated.Value(0)).current;
  const nearScroll = useRef(new Animated.Value(0)).current;
  const planetXRefs = useRef(PLANET_DEFS.map(() => new Animated.Value(-9999)));

  useEffect(() => {
    farScroll.setValue(0);
    midScroll.setValue(0);
    nearScroll.setValue(0);
    const anims = [
      Animated.loop(Animated.timing(farScroll,  { toValue: -gameW, duration: 18000, useNativeDriver: true, easing: Easing.linear })),
      Animated.loop(Animated.timing(midScroll,  { toValue: -gameW, duration:  9000, useNativeDriver: true, easing: Easing.linear })),
      Animated.loop(Animated.timing(nearScroll, { toValue: -gameW, duration:  4500, useNativeDriver: true, easing: Easing.linear })),
    ];
    anims.forEach(a => a.start());
    return () => anims.forEach(a => a.stop());
  }, [gameW]);

  useEffect(() => {
    const timers = [];
    PLANET_DEFS.forEach((p, i) => {
      const anim = planetXRefs.current[i];
      const runLoop = () => {
        anim.setValue(gameW + p.size);
        Animated.timing(anim, {
          toValue:         -p.size * 2,
          duration:        p.duration,
          useNativeDriver: true,
          easing:          Easing.linear,
        }).start(({ finished }) => { if (finished) runLoop(); });
      };
      timers.push(setTimeout(runLoop, p.stagger));
    });
    return () => {
      timers.forEach(t => clearTimeout(t));
      planetXRefs.current.forEach(a => a.stopAnimation());
    };
  }, [gameW]);

  useEffect(() => {
    setTargets(buildTargets(question.answer));
    setHitResults(['none','none','none','none']);
    doneRef.current = false;
  }, [question.text]);

  function handleTap(idx) {
    if (doneRef.current || hitResults[idx] !== 'none') return;
    if (targets[idx].isCorrect) {
      doneRef.current = true;
      setHitResults(h => h.map((v, i) => i === idx ? 'correct' : v));
      setTimeout(() => onCorrect(), 900);
    } else {
      setHitResults(h => h.map((v, i) => i === idx ? 'wrong' : v));
      setTimeout(() => setHitResults(h => h.map((v, i) => i === idx ? 'none' : v)), 700);
      onWrong();
    }
  }

  return (
    <View style={[s.container, { width: gameW, height: gameH }]}>

      {/* ══ SPACE WINDOW ══════════════════════════════════════════════════════ */}
      <View style={[s.spaceWin, { width: gameW, height: winH }]}>

        {/* Scrolling starfield — 3 parallax layers, each doubled for seamless wrap */}
        {[
          [FAR_STARS,  farScroll],
          [MID_STARS,  midScroll],
          [NEAR_STARS, nearScroll],
        ].map(([stars, scroll], li) => (
          <Animated.View key={li} pointerEvents="none"
            style={[StyleSheet.absoluteFill, { transform: [{ translateX: scroll }] }]}>
            {stars.flatMap((star, i) => {
              const top = star.y * (winH - 24) + 8;
              const sz  = { width: star.size, height: star.size };
              return [
                <View key={i}     style={[s.star, { left: star.x * gameW,             top, ...sz, opacity: star.op }]} />,
                <View key={i+'b'} style={[s.star, { left: (star.x + 1) * gameW,       top, ...sz, opacity: star.op }]} />,
              ];
            })}
          </Animated.View>
        ))}

        {/* Galaxy blob (soft glow) */}
        <View style={[s.galaxyOuter, { left: gameW * 0.32, top: winH * 0.06, width: gameW * 0.38, height: winH * 0.52 }]}>
          <View style={s.galaxyInner} />
        </View>

        {/* Flying planets */}
        {PLANET_DEFS.map((p, i) => (
          <Animated.View key={`planet-${i}`} pointerEvents="none" style={{
            position: 'absolute',
            top:      p.yFrac * winH - p.size / 2,
            transform: [{ translateX: planetXRefs.current[i] }],
          }}>
            <Text style={{ fontSize: p.size, lineHeight: p.size * 1.3 }}>{p.emoji}</Text>
          </Animated.View>
        ))}

        {/* Windshield frame — pillars + top bar */}
        <View style={[s.framePillar, { left: 0 }]} />
        <View style={[s.framePillar, { right: 0 }]} />
        <View style={s.frameTop} />
        {/* Corner bevels */}
        <View style={[s.cornerBevel, { left: 14, top: 12 }]} />
        <View style={[s.cornerBevel, { right: 14, top: 12, transform: [{ scaleX: -1 }] }]} />

        {/* Number targets */}
        {targets.map((t, i) => (
          <NumberTarget
            key={i}
            target={t}
            onTap={() => handleTap(i)}
            hit={hitResults[i]}
            px={TARGET_SLOTS[i].cx * gameW}
            py={TARGET_SLOTS[i].cy * winH}
          />
        ))}
      </View>

      {/* ══ DASHBOARD ═════════════════════════════════════════════════════════ */}
      <View style={s.dashboard}>
        {/* Blue accent glow strip */}
        <View style={s.accentStrip} />

        <View style={s.dashRow}>

          {/* ── Left button cluster ── */}
          <View style={s.btnPanel}>
            <Text style={s.panelLabel}>SYS</Text>
            {L_BTNS.map((row, ri) => (
              <View key={ri} style={s.btnRow}>
                {row.map((c, ci) => (
                  <BlinkButton key={ci} color={c} square={false} delay={(ri * 3 + ci) * 220} />
                ))}
              </View>
            ))}
            {/* Small gauge display */}
            <View style={s.miniGauge}>
              <View style={[s.gaugeBar, { width: '72%', backgroundColor: '#3b82f6' }]} />
            </View>
          </View>

          {/* ── Center steering wheel + column ── */}
          <SteeringWheel dashH={dashH} />

          {/* ── Right button cluster ── */}
          <View style={s.btnPanel}>
            <Text style={s.panelLabel}>NAV</Text>
            {R_BTNS.map((row, ri) => (
              <View key={ri} style={s.btnRow}>
                {row.map((c, ci) => (
                  <BlinkButton key={ci} color={c} square={true} delay={(ri * 3 + ci + 6) * 220} />
                ))}
              </View>
            ))}
            {/* Small gauge display */}
            <View style={s.miniGauge}>
              <View style={[s.gaugeBar, { width: '55%', backgroundColor: '#22c55e' }]} />
            </View>
          </View>

        </View>

        {/* Bottom grill line */}
        <View style={s.grillLine} />
      </View>

      {/* Outer frame highlight */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={s.frameHighlight} />
      </View>

    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: {
    borderRadius:  14,
    overflow:      'hidden',
    borderWidth:   2.5,
    borderColor:   '#1a2a40',
    backgroundColor: '#000010',
  },

  // Space window
  spaceWin: {
    backgroundColor: '#00050f',
    overflow:        'hidden',
  },
  star: {
    position:     'absolute',
    borderRadius: 9999,
    backgroundColor: '#ffffff',
  },
  galaxyOuter: {
    position:        'absolute',
    borderRadius:    9999,
    backgroundColor: 'rgba(80,60,160,0.13)',
  },
  galaxyInner: {
    position:        'absolute',
    left:            '20%',
    top:             '20%',
    width:           '60%',
    height:          '60%',
    borderRadius:    9999,
    backgroundColor: 'rgba(120,100,220,0.18)',
  },
  // Window frame
  framePillar: {
    position:        'absolute',
    top:             0,
    bottom:          0,
    width:           22,
    backgroundColor: '#13202e',
    borderRightWidth: 1,
    borderRightColor: '#2a3f58',
  },
  frameTop: {
    position:        'absolute',
    top:             0,
    left:            0,
    right:           0,
    height:          16,
    backgroundColor: '#13202e',
    borderBottomWidth: 1,
    borderBottomColor: '#2a3f58',
  },
  cornerBevel: {
    position:     'absolute',
    width:        18,
    height:       18,
    borderTopLeftRadius: 8,
    borderWidth:  1,
    borderColor:  '#3a5a78',
    borderRightWidth: 0,
    borderBottomWidth: 0,
    backgroundColor: 'transparent',
  },

  // Targets
  targetWrap: {
    position: 'absolute',
    width:    60,
    height:   60,
  },
  targetGlowRing: {
    position:     'absolute',
    inset:        -6,
    borderRadius: 36,
    borderWidth:  2,
  },
  targetBtn: {
    width:           60,
    height:          60,
    borderRadius:    30,
    alignItems:      'center',
    justifyContent:  'center',
    borderWidth:     2.5,
    borderColor:     'rgba(255,255,255,0.45)',
    shadowOpacity:   0.85,
    shadowRadius:    10,
    shadowOffset:    { width: 0, height: 0 },
    elevation:       10,
  },
  targetNum: {
    fontSize:   23,
    fontWeight: '900',
    color:      '#fff',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowRadius: 4,
    textShadowOffset: { width: 0, height: 1 },
  },
  hitIcon: {
    position:   'absolute',
    fontSize:   15,
    fontWeight: '900',
    color:      '#fff',
    top:        2,
    right:      4,
  },

  // Dashboard
  dashboard: {
    flex:            1,
    backgroundColor: '#0d1520',
    borderTopWidth:  2,
    borderTopColor:  '#1e3048',
  },
  accentStrip: {
    height:          3,
    marginHorizontal: 20,
    marginTop:       6,
    borderRadius:    2,
    backgroundColor: '#3b82f6',
    shadowColor:     '#3b82f6',
    shadowOpacity:   1,
    shadowRadius:    10,
    shadowOffset:    { width: 0, height: 0 },
    elevation:       6,
  },
  dashRow: {
    flex:           1,
    flexDirection:  'row',
    alignItems:     'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  grillLine: {
    height:          2,
    marginHorizontal: 16,
    marginBottom:    6,
    backgroundColor: '#1e3048',
    borderRadius:    1,
  },

  // Button panels
  btnPanel: {
    flex:           1,
    alignItems:     'center',
    gap:            5,
  },
  panelLabel: {
    fontSize:    9,
    fontWeight:  '700',
    color:       '#4a7a9b',
    letterSpacing: 2,
    marginBottom: 1,
  },
  btnRow: {
    flexDirection: 'row',
    gap:           6,
  },
  btnBase: {
    backgroundColor: '#1e2e3e',
    alignItems:      'center',
    justifyContent:  'center',
    borderWidth:     1,
    borderColor:     '#2a4060',
    padding:         3,
  },
  btnCircleBase: {
    width:        30,
    height:       30,
    borderRadius: 15,
  },
  btnSquareBase: {
    width:        28,
    height:       28,
    borderRadius: 4,
  },
  btnGlow: {},
  btnCircleGlow: {
    width:        20,
    height:       20,
    borderRadius: 10,
  },
  btnSquareGlow: {
    width:        18,
    height:       18,
    borderRadius: 3,
  },
  miniGauge: {
    width:           '80%',
    height:          5,
    backgroundColor: '#1a2a3a',
    borderRadius:    3,
    overflow:        'hidden',
    marginTop:       3,
    borderWidth:     1,
    borderColor:     '#2a4060',
  },
  gaugeBar: {
    height: '100%',
    borderRadius: 3,
    opacity: 0.85,
  },

  // Steering wheel
  wheelWrap: {
    alignItems:      'center',
    justifyContent:  'flex-end',
    paddingBottom:   6,
  },
  wheelRim: {
    borderWidth:     6,
    borderColor:     '#3a5068',
    alignItems:      'center',
    justifyContent:  'center',
    backgroundColor: 'transparent',
  },
  spoke: {
    position:        'absolute',
    width:           5,
    height:          '70%',
    borderRadius:    3,
    backgroundColor: '#2a3e52',
  },
  wheelHub: {
    width:           16,
    height:          16,
    borderRadius:    8,
    backgroundColor: '#3b82f6',
    shadowColor:     '#3b82f6',
    shadowOpacity:   0.9,
    shadowRadius:    8,
    shadowOffset:    { width: 0, height: 0 },
    elevation:       6,
  },
  wheelColumn: {
    width:           8,
    height:          14,
    backgroundColor: '#1e2e3e',
    borderRadius:    4,
  },

  // Outer frame highlight (subtle rim light)
  frameHighlight: {
    position:     'absolute',
    inset:        0,
    borderRadius: 14,
    borderWidth:  1,
    borderColor:  'rgba(80,140,220,0.18)',
  },
});
