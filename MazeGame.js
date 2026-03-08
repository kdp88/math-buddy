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

const COLS   = 7;
const ROWS   = 7;
// Reserve ~170px for header + chalkboard + padding; cap by both width and height
const SAFE_PERCENT = 0.42; // The maze will only take up 42% of the total screen height
const CELL = Math.min(
  Math.floor((SCREEN_W - 60) / COLS), // Width constraint (with more side padding)
  Math.floor((SCREEN_H * SAFE_PERCENT) / ROWS), // Strict height constraint
  50 // Maximum cap
);
const MAZE_W = CELL * COLS;
const MAZE_H = CELL * ROWS;
const WALL   = 1;

const NUM_COLORS = ['#7c3aed', '#0891b2', '#c2410c', '#be185d'];

// ── Helpers ──────────────────────────────────────────────────────────────────

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Maze generation (recursive backtracker) ──────────────────────────────────

function generateMaze() {
  const cells = Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => ({ n: false, s: false, e: false, w: false }))
  );
  const visited = Array.from({ length: ROWS }, () => Array(COLS).fill(false));

  function carve(r, c) {
    visited[r][c] = true;
    for (const [dr, dc, d1, d2] of shuffle([
      [-1, 0, 'n', 's'],
      [ 1, 0, 's', 'n'],
      [ 0,-1, 'w', 'e'],
      [ 0, 1, 'e', 'w'],
    ])) {
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && !visited[nr][nc]) {
        cells[r][c][d1]   = true;
        cells[nr][nc][d2] = true;
        carve(nr, nc);
      }
    }
  }
  carve(0, 0);
  return cells;
}

// Dead ends = cells with only one open passage
function findDeadEnds(cells, skipR, skipC) {
  const ends = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (r === skipR && c === skipC) continue;
      const { n, s, e, w } = cells[r][c];
      if ([n, s, e, w].filter(Boolean).length === 1) ends.push([r, c]);
    }
  }
  return ends;
}

// ── BFS pathfinder ───────────────────────────────────────────────────────────

function bfs(cells, fromR, fromC, toR, toC) {
  if (fromR === toR && fromC === toC) return [];
  const queue   = [[fromR, fromC, []]];
  const visited = new Set([`${fromR},${fromC}`]);
  while (queue.length) {
    const [r, c, path] = queue.shift();
    const cell = cells[r][c];
    for (const [dr, dc, dir] of [[-1,0,'n'],[1,0,'s'],[0,-1,'w'],[0,1,'e']]) {
      if (!cell[dir]) continue;
      const nr = r + dr, nc = c + dc;
      const key = `${nr},${nc}`;
      if (visited.has(key)) continue;
      const newPath = [...path, [nr, nc]];
      if (nr === toR && nc === toC) return newPath;
      visited.add(key);
      queue.push([nr, nc, newPath]);
    }
  }
  return [];
}

// ── Number set builder ───────────────────────────────────────────────────────

function buildNumbers(answer) {
  const set = new Set([answer]);
  let tries = 0;
  while (set.size < 4 && tries < 60) {
    const v = answer + ((Math.floor(Math.random() * 8) - 4) || 1);
    if (v >= 0) set.add(v);
    tries++;
  }
  for (let i = 1; set.size < 4; i++) {
    if (!set.has(answer + i))          set.add(answer + i);
    else if (answer - i >= 0 && !set.has(answer - i)) set.add(answer - i);
  }
  return shuffle([...set]);
}

// ── Component ────────────────────────────────────────────────────────────────

const START_R = 0;
const START_C = 0;
const STEP_MS = 130; // ms per cell during walk

export default function MazeGame({ question, onCorrect, onWrong }) {
  const [maze,     setMaze]     = useState(null);
  const [numCells, setNumCells] = useState([]);
  const [flash,    setFlash]    = useState(null);   // null | 'correct' | 'wrong'
  const [dest,     setDest]     = useState(null);   // [r,c] tapped destination

  // Current grid position (for BFS / hit detection)
  const posRef      = useRef({ r: START_R, c: START_C });
  const mazeRef     = useRef(null);
  const numRef      = useRef([]);
  const flashRef    = useRef(null);
  const walkingRef  = useRef(false);  // prevent overlapping walks

  // Smooth animated position (translate from top-left of maze)
  const transX = useRef(new Animated.Value(START_C * CELL)).current;
  const transY = useRef(new Animated.Value(START_R * CELL)).current;

  function resetGame() {
    const cells    = generateMaze();
    const deadEnds = shuffle(findDeadEnds(cells, START_R, START_C));
    const nums     = buildNumbers(question.answer);

    let positions = deadEnds.slice(0, 4);
    if (positions.length < 4) {
      for (let r = 0; r < ROWS && positions.length < 4; r++) {
        for (let c = 0; c < COLS && positions.length < 4; c++) {
          if (r === START_R && c === START_C) continue;
          if (!positions.some(([pr, pc]) => pr === r && pc === c))
            positions.push([r, c]);
        }
      }
    }

    const numData = nums.map((num, i) => ({
      r: positions[i][0], c: positions[i][1],
      num, color: NUM_COLORS[i],
      isCorrect: num === question.answer,
    }));

    mazeRef.current  = cells;
    numRef.current   = numData;
    posRef.current   = { r: START_R, c: START_C };
    flashRef.current = null;
    walkingRef.current = false;

    transX.setValue(START_C * CELL);
    transY.setValue(START_R * CELL);

    setMaze(cells);
    setNumCells(numData);
    setFlash(null);
    setDest(null);
  }

  useEffect(() => {
    resetGame();
  }, [question.text]);

  // Walk the player along a pre-computed path, one cell at a time
  function walkPath(path) {
    if (!path.length) { walkingRef.current = false; return; }
    if (flashRef.current) { walkingRef.current = false; return; }

    const [nr, nc] = path[0];

    Animated.parallel([
      Animated.timing(transX, { toValue: nc * CELL, duration: STEP_MS, useNativeDriver: true }),
      Animated.timing(transY, { toValue: nr * CELL, duration: STEP_MS, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (!finished) { walkingRef.current = false; return; }

      posRef.current = { r: nr, c: nc };

      // Check for number hit
      const hit = numRef.current.find(n => n.r === nr && n.c === nc);
      if (hit) {
        walkingRef.current = false;
        setDest(null);
        if (hit.isCorrect) {
          flashRef.current = 'correct';
          setFlash('correct');
          setTimeout(() => onCorrect(), 800);
        } else {
          flashRef.current = 'wrong';
          setFlash('wrong');
          setTimeout(() => {
            Animated.parallel([
              Animated.spring(transX, { toValue: posRef.current.c * CELL, useNativeDriver: true, speed: 30, bounciness: 8 }),
              Animated.spring(transY, { toValue: posRef.current.r * CELL, useNativeDriver: true, speed: 30, bounciness: 8 }),
            ]).start();
            flashRef.current = null;
            setFlash(null);
            onWrong();
          }, 500);
        }
        return;
      }

      walkPath(path.slice(1));
    });
  }

  function handleCellTap(r, c) {
    if (flashRef.current || !mazeRef.current) return;

    const { r: pr, c: pc } = posRef.current;
    if (r === pr && c === pc) return;

    // Stop any ongoing walk
    transX.stopAnimation();
    transY.stopAnimation();

    const path = bfs(mazeRef.current, pr, pc, r, c);
    if (!path.length) return;

    setDest([r, c]);
    walkingRef.current = true;
    walkPath(path);
  }

  if (!maze) return null;

  return (
    <View style={styles.container}>
      {/* Chalkboard */}
      <View style={styles.chalkboard}>
        <Text style={styles.chalkTitle}>📋  FIND THE ANSWER</Text>
        <Text style={styles.chalkQ}>{question.text} = ?</Text>
        <Text style={styles.chalkHint}>Tap anywhere in the maze to move</Text>
      </View>

      {/* Maze — outer dims include border so content area = exactly MAZE_W × MAZE_H */}
      <View style={[styles.mazeWrap, { width: MAZE_W + WALL * 2, height: MAZE_H + WALL * 2 }]}>

        {/* Walls + tap targets */}
        {maze.map((row, r) =>
          row.map((cell, c) => {
            const isDestCell = dest && dest[0] === r && dest[1] === c;
            return (
              <TouchableOpacity
                key={`${r}-${c}`}
                activeOpacity={0.7}
                onPress={() => handleCellTap(r, c)}
                style={[
                  styles.cell,
                  {
                    left:              c * CELL,
                    top:               r * CELL,
                    width:             CELL,
                    height:            CELL,
                    borderTopWidth:    cell.n ? 0 : WALL,
                    borderBottomWidth: cell.s ? 0 : WALL,
                    borderLeftWidth:   cell.w ? 0 : WALL,
                    borderRightWidth:  cell.e ? 0 : WALL,
                  },
                  isDestCell && styles.cellDest,
                ]}
              />
            );
          })
        )}

        {/* Number bubbles */}
        {numCells.map((n, i) => (
          <TouchableOpacity
            key={`num-${i}`}
            activeOpacity={0.8}
            onPress={() => handleCellTap(n.r, n.c)}
            style={[
              styles.numBubble,
              {
                left:            n.c * CELL + (CELL - (CELL - 10)) / 2,
                top:             n.r * CELL + (CELL - (CELL - 10)) / 2,
                width:           CELL - 10,
                height:          CELL - 10,
                borderRadius:    (CELL - 10) / 2,
                backgroundColor: n.color,
              },
            ]}
          >
            <Text style={styles.numText}>{n.num}</Text>
          </TouchableOpacity>
        ))}

        {/* Player — smoothly translated */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.player,
            { width: CELL, height: CELL },
            { transform: [{ translateX: transX }, { translateY: transY }] },
            flash === 'correct' && styles.playerCorrect,
            flash === 'wrong'   && styles.playerWrong,
          ]}
        >
          <Text style={styles.playerEmoji}>🧒</Text>
        </Animated.View>
      </View>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1, // Allow it to fill the parent
    alignItems: 'center',
    justifyContent: 'center', // Centers the maze vertically in the available space
    paddingHorizontal: 20,
  },

  // Chalkboard
  chalkboard: {
    width:           MAZE_W + WALL * 2,
    backgroundColor: '#2d5a27',
    borderRadius:    12,
    borderWidth:     4,
    borderColor:     '#5a3e1b',
    alignItems:      'center',
    paddingVertical: 10,
    marginBottom:    10,
    shadowColor:     '#000',
    shadowOpacity:   0.3,
    shadowRadius:    6,
    elevation:       4,
  },
  chalkTitle: {
    fontSize:      10,
    color:         'rgba(255,255,255,0.6)',
    fontWeight:    '700',
    letterSpacing: 3,
    marginBottom:  2,
  },
  chalkQ: {
    fontSize:    28,
    fontWeight:  '800',
    color:       '#fff',
    letterSpacing: 2,
    fontFamily:  'monospace',
  },
  chalkHint: {
    fontSize:  11,
    color:     'rgba(255,255,255,0.55)',
    marginTop: 3,
    fontStyle: 'italic',
  },

  // Maze
  mazeWrap: {
    position:        'relative',
    backgroundColor: '#1a1a2e',
    borderWidth:     WALL,
    borderColor:     '#4a3728',
    borderRadius:    4,
    overflow:        'hidden',
  },
  cell: {
    position:    'absolute',
    borderColor: '#4a3728',
  },
  cellDest: {
    backgroundColor: 'rgba(255,255,255,0.06)',
  },

  // Number bubbles
  numBubble: {
    position:       'absolute',
    alignItems:     'center',
    justifyContent: 'center',
    borderWidth:    2,
    borderColor:    'rgba(255,255,255,0.3)',
    shadowColor:    '#000',
    shadowOpacity:  0.4,
    shadowRadius:   4,
    elevation:      4,
  },
  numText: {
    fontSize:   CELL > 50 ? 18 : 14,
    fontWeight: '800',
    color:      '#fff',
  },

  // Player
  player: {
    position:       'absolute',
    top:            0,
    left:           0,
    alignItems:     'center',
    justifyContent: 'center',
  },
  playerCorrect: {
    backgroundColor: 'rgba(74,222,128,0.25)',
    borderRadius:    CELL / 2,
  },
  playerWrong: {
    backgroundColor: 'rgba(248,113,113,0.25)',
    borderRadius:    CELL / 2,
  },
  playerEmoji: {
    fontSize: CELL > 50 ? 26 : 20,
  },
});
