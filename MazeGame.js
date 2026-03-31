import { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated, useWindowDimensions } from 'react-native';
import { Canvas, useFrame, useThree } from '@react-three/fiber/native';
import * as THREE from 'three';
import { buildAnswerSet } from './utils/buildAnswerChoices';


const _v = new THREE.Vector3();

const COLS   = 7;
const ROWS   = 7;
const WALL_H = 0.55;
const WALL_T = 0.07;

const NUM_COLORS = ['#7c3aed', '#0891b2', '#c2410c', '#be185d'];
const START_R = 0;
const START_C = 0;
const STEP_MS = 140;

const CX = COLS / 2;   // world-space maze centre X
const CZ = ROWS / 2;   // world-space maze centre Z

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
      [-1, 0, 'n', 's'], [1, 0, 's', 'n'], [0, -1, 'w', 'e'], [0, 1, 'e', 'w'],
    ])) {
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && !visited[nr][nc]) {
        cells[r][c][d1] = true;
        cells[nr][nc][d2] = true;
        carve(nr, nc);
      }
    }
  }
  carve(0, 0);
  return cells;
}

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

// ── BFS ──────────────────────────────────────────────────────────────────────

function bfs(cells, fromR, fromC, toR, toC) {
  if (fromR === toR && fromC === toC) return [];
  const queue   = [[fromR, fromC, []]];
  const visited = new Set([`${fromR},${fromC}`]);
  while (queue.length) {
    const [r, c, path] = queue.shift();
    for (const [dr, dc, dir] of [[-1,0,'n'],[1,0,'s'],[0,-1,'w'],[0,1,'e']]) {
      if (!cells[r][c][dir]) continue;
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

// ── Number builder ────────────────────────────────────────────────────────────

function buildNumbers(answer) {
  return shuffle([...buildAnswerSet(answer)]);
}

// ── 3-D components ────────────────────────────────────────────────────────────

// Directly overhead, north = up on screen
function CameraRig() {
  useFrame(({ camera }) => {
    camera.up.set(0, 0, -1);
    camera.lookAt(CX, 0, CZ);
  });
  return null;
}

// Walls derived from maze cell data
function MazeWalls({ maze }) {
  const wallColor = '#3d2a1a';
  const walls = [];

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = maze[r][c];
      if (!cell.n) {
        walls.push(
          <mesh key={`n${r}${c}`} position={[c + 0.5, WALL_H / 2, r]}>
            <boxGeometry args={[1 + WALL_T, WALL_H, WALL_T]} />
            <meshStandardMaterial color={wallColor} roughness={0.85} />
          </mesh>
        );
      }
      if (!cell.w) {
        walls.push(
          <mesh key={`w${r}${c}`} position={[c, WALL_H / 2, r + 0.5]}>
            <boxGeometry args={[WALL_T, WALL_H, 1 + WALL_T]} />
            <meshStandardMaterial color={wallColor} roughness={0.85} />
          </mesh>
        );
      }
    }
  }
  // South border
  walls.push(
    <mesh key="bs" position={[CX, WALL_H / 2, ROWS]}>
      <boxGeometry args={[COLS + WALL_T, WALL_H, WALL_T]} />
      <meshStandardMaterial color={wallColor} roughness={0.85} />
    </mesh>
  );
  // East border
  walls.push(
    <mesh key="be" position={[COLS, WALL_H / 2, CZ]}>
      <boxGeometry args={[WALL_T, WALL_H, ROWS + WALL_T]} />
      <meshStandardMaterial color={wallColor} roughness={0.85} />
    </mesh>
  );

  return <>{walls}</>;
}

// Floor tiles — each is tappable
function MazeFloor({ maze, onCellTap }) {
  return (
    <>
      {/* Base floor slab */}
      <mesh position={[CX, -0.01, CZ]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[COLS, ROWS]} />
        <meshStandardMaterial color="#12102a" roughness={0.98} />
      </mesh>

      {/* Per-cell tap planes */}
      {maze.map((row, r) =>
        row.map((_, c) => (
          <mesh
            key={`f${r}${c}`}
            position={[c + 0.5, 0.001, r + 0.5]}
            rotation={[-Math.PI / 2, 0, 0]}
            onClick={(e) => { e.stopPropagation(); onCellTap(r, c); }}
          >
            <planeGeometry args={[0.97, 0.97]} />
            <meshStandardMaterial color="#1a1a30" roughness={0.97} transparent opacity={0.01} />
          </mesh>
        ))
      )}
    </>
  );
}

// Projects orb group refs → 2D screen coords each frame via Animated.Value
function LabelProjector({ orbRefs, labelAnims }) {
  const { camera, size } = useThree();
  useFrame(() => {
    orbRefs.forEach((ref, i) => {
      if (!ref.current) return;
      _v.copy(ref.current.position);
      _v.project(camera);
      labelAnims[i].x.setValue((_v.x  *  0.5 + 0.5) * size.width  - 16);
      labelAnims[i].y.setValue((-_v.y *  0.5 + 0.5) * size.height - 16);
    });
  });
  return null;
}

// Glowing number orb at a dead-end cell
function NumberOrb({ numCell, flash, groupRef }) {
  // Flash colour
  const isCorrect = flash === 'correct';
  const isWrong   = flash === 'wrong';
  const color     = isCorrect ? '#4ade80' : isWrong ? '#f87171' : numCell.color;
  const emissiveI = isCorrect ? 1.4 : isWrong ? 1.2 : 0.7;

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    groupRef.current.position.y = 0.32 + Math.sin(clock.elapsedTime * 1.6 + numCell.c * 1.3) * 0.07;
  });

  return (
    <group ref={groupRef} position={[numCell.c + 0.5, 0.32, numCell.r + 0.5]}>
      <mesh>
        <sphereGeometry args={[0.33, 16, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={emissiveI}
          transparent
          opacity={0.92}
        />
      </mesh>
    </group>
  );
}

// Player sphere that smoothly tracks the logical grid position
function Player({ playerPosRef, flashRef }) {
  const meshRef  = useRef();
  const curX = useRef(START_C + 0.5);
  const curZ = useRef(START_R + 0.5);

  useFrame(({ clock }, delta) => {
    if (!meshRef.current) return;
    const tx = playerPosRef.current.c + 0.5;
    const tz = playerPosRef.current.r + 0.5;
    curX.current += (tx - curX.current) * Math.min(1, delta * 12);
    curZ.current += (tz - curZ.current) * Math.min(1, delta * 12);
    const bob = Math.sin(clock.elapsedTime * 5) * 0.03;
    meshRef.current.position.set(curX.current, 0.24 + bob, curZ.current);

    const flash = flashRef.current;
    const mat   = meshRef.current.material;
    mat.color.set(flash === 'correct' ? '#4ade80' : flash === 'wrong' ? '#f87171' : '#fbbf24');
    mat.emissive.set(flash === 'correct' ? '#4ade80' : flash === 'wrong' ? '#f87171' : '#fbbf24');
  });

  return (
    <mesh ref={meshRef} position={[START_C + 0.5, 0.24, START_R + 0.5]}>
      <sphereGeometry args={[0.2, 16, 16]} />
      <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={0.7} />
    </mesh>
  );
}

// Start-cell marker (slightly lit pad)
function StartMarker() {
  return (
    <mesh position={[START_C + 0.5, 0.002, START_R + 0.5]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[0.8, 0.8]} />
      <meshStandardMaterial color="#7c3aed" emissive="#7c3aed" emissiveIntensity={0.3} transparent opacity={0.5} />
    </mesh>
  );
}

function Scene({ maze, numCells, playerPosRef, flashRef, onCellTap, hitNumIdx, orbRefs, labelAnims }) {
  return (
    <>
      <color attach="background" args={['#0a0814']} />
      <fog attach="fog" args={['#0a0814', 12, 22]} />

      <ambientLight intensity={0.7} color="#c084fc" />
      <directionalLight position={[CX, 9, CZ + 2]} intensity={1.8} color="#fff8e8" />
      <pointLight position={[CX, 3.5, CZ]} color="#a855f7" intensity={2.5} distance={14} />
      <pointLight position={[0.5, 2, 0.5]}           color="#f97316" intensity={1.2} distance={5} />
      <pointLight position={[COLS - 0.5, 2, ROWS - 0.5]} color="#f97316" intensity={1.2} distance={5} />

      <CameraRig />

      <MazeFloor maze={maze} onCellTap={onCellTap} />
      <MazeWalls maze={maze} />
      <StartMarker />

      {numCells.map((n, i) => (
        <NumberOrb
          key={i}
          numCell={n}
          flash={hitNumIdx === i ? flashRef.current : null}
          groupRef={orbRefs[i]}
        />
      ))}

      <Player playerPosRef={playerPosRef} flashRef={flashRef} />
      <LabelProjector orbRefs={orbRefs} labelAnims={labelAnims} />
    </>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function MazeGame({ question, onCorrect, onWrong }) {
  const { width: screenW, height: screenH } = useWindowDimensions();
  const gameW = screenW - 16;
  const gameH = Math.min(Math.round(screenH * 0.60), screenH - 240);

  const [maze,      setMaze]      = useState(null);
  const [numCells,  setNumCells]  = useState([]);
  const [hitNumIdx, setHitNumIdx] = useState(null);

  const posRef         = useRef({ r: START_R, c: START_C });
  const mazeRef        = useRef(null);
  const numRef         = useRef([]);
  const flashRef       = useRef(null);
  const walkingRef     = useRef(false);
  const mountedRef     = useRef(true);
  const walkTimerRef   = useRef(null);
  const flashTimerRef  = useRef(null);

  const orbRefsStore = useRef(null);
  if (!orbRefsStore.current) {
    orbRefsStore.current = Array.from({ length: 4 }, () => ({ current: null }));
  }
  const orbRefs = orbRefsStore.current;

  const labelAnimsStore = useRef(null);
  if (!labelAnimsStore.current) {
    labelAnimsStore.current = Array.from({ length: 4 }, () => ({
      x: new Animated.Value(-100),
      y: new Animated.Value(-100),
    }));
  }
  const labelAnims = labelAnimsStore.current;

  function resetGame() {
    clearTimeout(walkTimerRef.current);
    clearTimeout(flashTimerRef.current);
    walkingRef.current = false;

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

    mazeRef.current    = cells;
    numRef.current     = numData;
    posRef.current     = { r: START_R, c: START_C };
    flashRef.current   = null;
    walkingRef.current = false;

    setMaze(cells);
    setNumCells(numData);
    setHitNumIdx(null);
  }

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      clearTimeout(walkTimerRef.current);
      clearTimeout(flashTimerRef.current);
    };
  }, []);

  useEffect(() => { resetGame(); }, [question.text]);

  function walkPath(path) {
    if (!path.length || !mountedRef.current) { walkingRef.current = false; return; }
    if (flashRef.current) { walkingRef.current = false; return; }

    const [nr, nc] = path[0];
    walkTimerRef.current = setTimeout(() => {
      if (!mountedRef.current) return;
      posRef.current = { r: nr, c: nc };

      const hit = numRef.current.findIndex(n => n.r === nr && n.c === nc);
      if (hit !== -1) {
        walkingRef.current = false;
        const numCell = numRef.current[hit];
        if (numCell.isCorrect) {
          flashRef.current = 'correct';
          setHitNumIdx(hit);
          flashTimerRef.current = setTimeout(() => {
            if (mountedRef.current) onCorrect();
          }, 800);
        } else {
          flashRef.current = 'wrong';
          setHitNumIdx(hit);
          flashTimerRef.current = setTimeout(() => {
            if (!mountedRef.current) return;
            flashRef.current = null;
            setHitNumIdx(null);
            onWrong();
          }, 600);
        }
        return;
      }

      walkPath(path.slice(1));
    }, STEP_MS);
  }

  function handleCellTap(r, c) {
    if (walkingRef.current || flashRef.current || !mazeRef.current) return;
    const { r: pr, c: pc } = posRef.current;
    if (r === pr && c === pc) return;

    const path = bfs(mazeRef.current, pr, pc, r, c);
    if (!path.length) return;

    walkingRef.current = true;
    walkPath(path);
  }

  if (!maze) return null;

  return (
    <View testID="maze-container" style={styles.outer}>
      <View testID="maze-canvas-wrap" style={[styles.canvasWrap, { width: gameW, height: gameH }]}>
        <Canvas
          camera={{ position: [CX, 9, CZ], fov: 52 }}
          style={StyleSheet.absoluteFill}
          gl={{ antialias: true }}
        >
          <Scene
            maze={maze}
            numCells={numCells}
            playerPosRef={posRef}
            flashRef={flashRef}
            onCellTap={handleCellTap}
            hitNumIdx={hitNumIdx}
            orbRefs={orbRefs}
            labelAnims={labelAnims}
          />
        </Canvas>

        {/* RN overlay: number labels tracking orb screen positions */}
        <View testID="maze-labels-overlay" style={StyleSheet.absoluteFill} pointerEvents="none">
          {numCells.map((n, i) => {
            const isCorrect = hitNumIdx === i && flashRef.current === 'correct';
            const isWrong   = hitNumIdx === i && flashRef.current === 'wrong';
            const color = isCorrect ? '#4ade80' : isWrong ? '#f87171' : '#ffffff';
            return (
              <Animated.View
                key={i}
                testID={`maze-orb-label-${n.num}`}
                style={[styles.label, { left: labelAnims[i].x, top: labelAnims[i].y }]}
              >
                <Text testID={`maze-orb-num-${n.num}`} style={[styles.labelText, { color }]}>{n.num}</Text>
              </Animated.View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  outer: {
    alignItems: 'center',
  },
  canvasWrap: {
    borderRadius: 16,
    overflow:     'hidden',
    borderWidth:  1.5,
    borderColor:  '#3d1a6e',
  },
  label: {
    position:       'absolute',
    width:          32,
    height:         32,
    alignItems:     'center',
    justifyContent: 'center',
  },
  labelText: {
    fontSize:         15,
    fontWeight:       'bold',
    textShadowColor:  '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
});
