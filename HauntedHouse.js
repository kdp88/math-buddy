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
const GAME_H  = Math.round(SCREEN_H * 0.54); // taller — no control bar
const TOTAL_H = GAME_H;

const DOOR_W   = 62;
const DOOR_H   = 155;
const DOOR_TOP = 36;
const FLOOR_Y  = DOOR_TOP + DOOR_H + 2;

const PLAYER_SIZE   = 36;
const PLAYER_BOTTOM = 18; // from container bottom

const NUM_DOORS = 4;
const SLOT      = GAME_W / NUM_DOORS;

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
    const val = correctAnswer + ((Math.floor(Math.random() * 8) - 4) || 1);
    if (val >= 0) set.add(val);
    tries++;
  }
  for (let i = 1; set.size < NUM_DOORS; i++) {
    if (!set.has(correctAnswer + i))                              set.add(correctAnswer + i);
    else if (correctAnswer - i >= 0 && !set.has(correctAnswer - i)) set.add(correctAnswer - i);
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
    state: 'closed',
  }));
}

export default function HauntedHouse({ question, onCorrect, onWrong }) {
  const [doors,   setDoors]   = useState(() => buildDoors(question.answer));
  const [flipX,   setFlipX]   = useState(1);
  const [done,    setDone]    = useState(false);

  const playerXAnim = useRef(new Animated.Value(GAME_W / 2)).current;
  const playerXRef  = useRef(GAME_W / 2);
  const doorAnims   = useRef(Array.from({ length: NUM_DOORS }, () => new Animated.Value(0))).current;
  const ghostAnims  = useRef(Array.from({ length: NUM_DOORS }, () => new Animated.Value(0))).current;
  const doneRef     = useRef(false);
  const walkingRef  = useRef(false);

  useEffect(() => {
    const id = playerXAnim.addListener(({ value }) => { playerXRef.current = value; });
    return () => playerXAnim.removeListener(id);
  }, []);

  useEffect(() => {
    setDoors(buildDoors(question.answer));
    playerXAnim.setValue(GAME_W / 2);
    playerXRef.current = GAME_W / 2;
    setFlipX(1);
    setDone(false);
    doneRef.current  = false;
    walkingRef.current = false;
    doorAnims.forEach(a => a.setValue(0));
    ghostAnims.forEach(a => a.setValue(0));
  }, [question.text]);

  function tapDoor(idx) {
    if (doneRef.current || walkingRef.current) return;

    const door   = doors[idx];
    if (door.state === 'open') return;

    const targetCx = door.cx;
    const dist     = Math.abs(targetCx - playerXRef.current);

    // Face the right direction
    setFlipX(targetCx >= playerXRef.current ? 1 : -1);

    walkingRef.current = true;

    Animated.timing(playerXAnim, {
      toValue:         targetCx,
      duration:        dist * 1.4 + 60,
      useNativeDriver: false,
    }).start(({ finished }) => {
      walkingRef.current = false;
      if (!finished) return;
      knockDoor(idx);
    });
  }

  function knockDoor(idx) {
    if (doneRef.current) return;
    const door = doors[idx];

    Animated.timing(doorAnims[idx], {
      toValue:         1,
      duration:        500,
      useNativeDriver: true,
    }).start(() => {
      setDoors(prev => prev.map((d, i) => i === idx ? { ...d, state: 'open' } : d));

      if (door.isCorrect) {
        doneRef.current = true;
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
            position:        'absolute',
            left:            s.left * GAME_W,
            top:             s.top,
            width:           s.size,
            height:          s.size,
            borderRadius:    s.size,
            backgroundColor: '#fff',
            opacity:         s.opacity,
          }}
        />
      ))}

      {/* Decorations */}
      {DECOS.map((d, i) => (
        <Text key={i} style={[styles.deco, { top: d.top, left: d.left }]}>
          {d.emoji}
        </Text>
      ))}

      <View style={styles.wall} />
      <View style={[styles.floor, { top: FLOOR_Y }]} />

      {/* Doors — tappable */}
      {doors.map((door, i) => (
        <TouchableOpacity
          key={i}
          activeOpacity={0.8}
          onPress={() => tapDoor(i)}
          disabled={done || door.state === 'open'}
          style={[
            styles.doorFrame,
            { left: door.cx - DOOR_W / 2 - 5, top: DOOR_TOP },
            door.state === 'closed' && !done && styles.doorFrameActive,
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
                <Text style={[styles.doorNum, door.isCorrect ? styles.doorNumCorrect : styles.doorNumWrong]}>
                  {door.num}
                </Text>
                <Text style={styles.doorResultIcon}>{door.isCorrect ? '⭐' : '💀'}</Text>
              </>
            )}
          </View>

          {/* Door face — slides up */}
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
            <Text style={styles.doorTapHint}>tap</Text>
          </Animated.View>
        </TouchableOpacity>
      ))}

      {/* Ghost fly-outs */}
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

      {/* Player — Animated.View owns position/flip; inner Text is static */}
      <Animated.View
        style={{
          position:  'absolute',
          bottom:    PLAYER_BOTTOM,
          left:      0,
          transform: [
            { translateX: Animated.subtract(playerXAnim, PLAYER_SIZE / 2) },
            { scaleX: flipX },
          ],
        }}
      >
        <Text style={styles.player}>🧟</Text>
      </Animated.View>

      {/* Hint */}
      <View style={styles.hintBar}>
        <Text style={styles.hintTxt}>
          {done ? '✅ Correct!' : '👆 Tap a door to knock'}
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
  doorFrameActive: {
    borderColor:   '#facc15',
    shadowColor:   '#facc15',
    shadowOpacity: 0.5,
    shadowRadius:  8,
    elevation:     6,
  },
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
  doorFace: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#5c2d00',
    alignItems:      'center',
    justifyContent:  'center',
    borderRadius:    4,
  },
  doorKnob:     { fontSize: 18, marginBottom: 6 },
  doorQuestion: { fontSize: 28, fontWeight: '800' },
  doorTapHint:  { fontSize: 10, color: 'rgba(255,255,255,0.45)', marginTop: 4 },
  player: {
    fontSize: PLAYER_SIZE - 4,
  },
  hintBar: {
    position:        'absolute',
    bottom:          0,
    left:            0,
    right:           0,
    height:          34,
    alignItems:      'center',
    justifyContent:  'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderTopWidth:  1,
    borderTopColor:  '#3d1a6e',
  },
  hintTxt: {
    fontSize:   13,
    color:      'rgba(255,255,255,0.6)',
    fontWeight: '600',
  },
});
