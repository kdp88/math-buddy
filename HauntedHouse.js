import { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, useWindowDimensions, Animated } from 'react-native';
import GameLoader from './GameLoader';
import { Canvas, useFrame, useThree } from '@react-three/fiber/native';
import * as THREE from 'three';
import { useGLTF } from '@react-three/drei/native';

const NUM_GHOSTS = 4;

const GHOST_XS      = [-2.2, -0.75, 0.75, 2.2];
const GHOST_START_Z = [-3.8, -4.4, -4.0, -3.6];
const GHOST_SPEEDS  = [0.38, 0.44, 0.36, 0.41];

// ─── game logic ───────────────────────────────────────────────────────────────

function buildGhosts(answer) {
  const set = new Set([answer]);
  let tries = 0;
  while (set.size < NUM_GHOSTS && tries < 60) {
    const v = answer + ((Math.floor(Math.random() * 8) - 4) || 1);
    if (v >= 0) set.add(v);
    tries++;
  }
  for (let i = 1; set.size < NUM_GHOSTS; i++) {
    if (!set.has(answer + i))                            set.add(answer + i);
    else if (answer - i >= 0 && !set.has(answer - i))   set.add(answer - i);
  }
  const arr = [...set];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.map(num => ({ num, isCorrect: num === answer }));
}

// ─── Projects ghost 3D positions → 2D screen coords each frame ────────────────

const _vec = new THREE.Vector3();

function LabelProjector({ groupRefs, labelAnims }) {
  const { camera, size } = useThree();
  useFrame(() => {
    groupRefs.forEach((ref, i) => {
      if (!ref.current) return;
      _vec.copy(ref.current.position);
      _vec.project(camera);
      // _vec.x/_vec.y are NDC [-1,1]; convert to canvas pixels
      labelAnims[i].x.setValue((_vec.x  *  0.5 + 0.5) * size.width  - 18);
      labelAnims[i].y.setValue((-_vec.y *  0.5 + 0.5) * size.height - 18);
    });
  });
  return null;
}

// ─── Flickering candle ─────────────────────────────────────────────────────────

function Candle({ position }) {
  const flameRef = useRef();
  useFrame(({ clock }) => {
    if (!flameRef.current) return;
    const t = clock.elapsedTime;
    flameRef.current.scale.setScalar(
      0.88 + Math.sin(t * 13) * 0.13 + Math.sin(t * 7.4) * 0.07,
    );
  });
  return (
    <group position={position}>
      <mesh>
        <cylinderGeometry args={[0.04, 0.04, 0.22, 8]} />
        <meshStandardMaterial color="#e8e0d0" />
      </mesh>
      <group ref={flameRef} position={[0, 0.22, 0]}>
        <mesh scale={[0.45, 1.6, 0.45]}>
          <sphereGeometry args={[0.07, 8, 8]} />
          <meshStandardMaterial color="#fbbf24" emissive="#f97316" emissiveIntensity={4} transparent opacity={0.95} />
        </mesh>
      </group>
      <pointLight position={[0, 0.3, 0]} color="#f9de16" intensity={4.5} distance={5} />
    </group>
  );
}

// ─── Flickering torch ─────────────────────────────────────────────────────────

function Torch({ position }) {
  const flameRef = useRef();
  useFrame(({ clock }) => {
    if (!flameRef.current) return;
    const t = clock.elapsedTime;
    flameRef.current.scale.setScalar(
      0.88 + Math.sin(t * 13) * 0.13 + Math.sin(t * 7.4) * 0.07,
    );
  });
  return (
    <group position={position}>
      <mesh>
        <cylinderGeometry args={[0.04, 0.04, 0.3, 6]} />
        <meshStandardMaterial color="#5c3a1e" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.22, 0]}>
        <cylinderGeometry args={[0.07, 0.05, 0.09, 8]} />
        <meshStandardMaterial color="#7c5a2e" metalness={0.2} />
      </mesh>
      <mesh ref={flameRef} position={[0, 0.33, 0]}>
        <sphereGeometry args={[0.11, 8, 8]} />
        <meshStandardMaterial
          color="#fbbf24"
          emissive="#f97316"
          emissiveIntensity={4.0}
          transparent opacity={0.92}
        />
      </mesh>
    </group>
  );
}

// ─── Floating ghost ───────────────────────────────────────────────────────────

function FloatingGhost({ index, ghost, hitResult, onTap, groupRef }) {
  const bodyRef  = useRef();
  const zRef     = useRef(GHOST_START_Z[index]);
  const phaseRef = useRef(index * 1.3);

  useEffect(() => {
    zRef.current = GHOST_START_Z[index];
    if (groupRef.current) {
      groupRef.current.position.set(GHOST_XS[index], 0, GHOST_START_Z[index]);
      groupRef.current.scale.setScalar(1);
    }
    if (bodyRef.current) {
      bodyRef.current.material.opacity = 0.88;
    }
  }, [ghost.num]);

  useFrame(({ clock }, delta) => {
    if (!groupRef.current || !bodyRef.current) return;
    const t = clock.elapsedTime;

    if (hitResult === 'correct') {
      const s = groupRef.current.scale.x;
      if (s > 0) groupRef.current.scale.setScalar(Math.max(0, s - delta * 2.5));
      const op = bodyRef.current.material.opacity;
      if (op > 0) bodyRef.current.material.opacity = Math.max(0, op - delta * 2);
      return;
    }

    zRef.current = Math.min(zRef.current + GHOST_SPEEDS[index] * delta, 0.2);
    const sway = Math.sin(t * 0.55 + phaseRef.current * 1.4) * 0.18;
    const bob  = Math.sin(t * 1.5  + phaseRef.current)       * 0.16;
    groupRef.current.position.set(GHOST_XS[index] + sway, bob, zRef.current);
  });

  const isWrong   = hitResult === 'wrong';
  const isCorrect = hitResult === 'correct';
  const bodyColor = isCorrect ? '#ffffff' : isWrong ? '#f87171' : '#e9d5ff';
  const emissive  = isCorrect ? '#ffffff' : isWrong ? '#ef4444' : '#c4b5fd';
  const emissiveI = isCorrect ? 2.5       : isWrong ? 1.2       : 0.55;

  return (
    <group ref={groupRef} position={[GHOST_XS[index], 0, GHOST_START_Z[index]]}>
      <mesh ref={bodyRef} scale={[1, 1.3, 1]} onClick={onTap}>
        <sphereGeometry args={[0.38, 20, 20]} />
        <meshStandardMaterial
          color={bodyColor}
          emissive={emissive}
          emissiveIntensity={emissiveI}
          transparent
          opacity={0.88}
        />
      </mesh>
      <mesh position={[-0.13, 0.1, 0.34]}>
        <sphereGeometry args={[0.07, 8, 8]} />
        <meshStandardMaterial color="#1a0a2e" />
      </mesh>
      <mesh position={[0.13, 0.1, 0.34]}>
        <sphereGeometry args={[0.07, 8, 8]} />
        <meshStandardMaterial color="#1a0a2e" />
      </mesh>
    </group>
  );
}

// ─── Corridor scene ───────────────────────────────────────────────────────────

function Table({ position, rotation }) {
  const [x, y, z] = position;
  const wood     = '#3b1f0e';
  const darkWood = '#2a1508';
  const knob     = '#1a0d04';
  return (
    <group position={[x, y, z]} rotation={rotation}>
      {/* Table top */}
      <mesh position={[0, 0.82, 0]}>
        <boxGeometry args={[1.1, 0.07, 0.65]} />
        <meshStandardMaterial color={wood} roughness={0.85} />
      </mesh>
      {/* Left side panel */}
      <mesh position={[-0.52, 0.41, 0]}>
        <boxGeometry args={[0.06, 0.82, 0.65]} />
        <meshStandardMaterial color={darkWood} roughness={0.9} />
      </mesh>
      {/* Right side panel */}
      <mesh position={[0.52, 0.41, 0]}>
        <boxGeometry args={[0.06, 0.82, 0.65]} />
        <meshStandardMaterial color={darkWood} roughness={0.9} />
      </mesh>
      {/* Back panel */}
      <mesh position={[0, 0.41, -0.3]}>
        <boxGeometry args={[1.1, 0.82, 0.05]} />
        <meshStandardMaterial color={darkWood} roughness={0.9} />
      </mesh>
      {/* Bottom panel */}
      <mesh position={[0, 0.04, 0]}>
        <boxGeometry args={[1.1, 0.06, 0.65]} />
        <meshStandardMaterial color={darkWood} roughness={0.9} />
      </mesh>
      {/* Top drawer front */}
      <mesh position={[0, 0.65, 0.315]}>
        <boxGeometry args={[0.92, 0.28, 0.04]} />
        <meshStandardMaterial color={wood} roughness={0.8} />
      </mesh>
      {/* Bottom drawer front */}
      <mesh position={[0, 0.34, 0.315]}>
        <boxGeometry args={[0.92, 0.28, 0.04]} />
        <meshStandardMaterial color={wood} roughness={0.8} />
      </mesh>
      {/* Drawer knobs */}
      <mesh position={[0, 0.65, 0.345]}>
        <sphereGeometry args={[0.035, 8, 8]} />
        <meshStandardMaterial color={knob} metalness={0.4} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.34, 0.345]}>
        <sphereGeometry args={[0.035, 8, 8]} />
        <meshStandardMaterial color={knob} metalness={0.4} roughness={0.5} />
      </mesh>
      {/* Candle placed via <Candle> in Scene for flickering */}
      {/* Skull */}
      <mesh position={[-0.2, 0.92, 0.05]}>
        <sphereGeometry args={[0.12, 10, 10]} />
        <meshStandardMaterial color="#d4c9a8" roughness={0.8} />
      </mesh>
    </group>
  );
}

function Bookcase({ position }) {
  const [x, y, z] = position;
  const wood     = '#2a1508';
  const darkWood = '#1a0d04';
  const spines   = ['#4a1942', '#1a3a1a', '#1a2a4a', '#3a2a0a', '#3a0a0a', '#0a2a3a'];
  // Overall: 1.2 wide × 3.6 tall × 0.38 deep — nearly floor-to-ceiling
  return (
    <group position={[x, y, z]} rotation={[0, Math.PI / 2, 0]}>
      {/* Left side */}
      <mesh position={[-0.59, 1.8, 0]}>
        <boxGeometry args={[0.06, 3.6, 0.38]} />
        <meshStandardMaterial color={wood} roughness={0.9} />
      </mesh>
      {/* Right side */}
      <mesh position={[0.59, 1.8, 0]}>
        <boxGeometry args={[0.06, 3.6, 0.38]} />
        <meshStandardMaterial color={wood} roughness={0.9} />
      </mesh>
      {/* Back panel */}
      <mesh position={[0, 1.8, -0.17]}>
        <boxGeometry args={[1.18, 3.6, 0.04]} />
        <meshStandardMaterial color={darkWood} roughness={1} />
      </mesh>
      {/* Top cap */}
      <mesh position={[0, 3.57, 0]}>
        <boxGeometry args={[1.24, 0.06, 0.38]} />
        <meshStandardMaterial color={wood} roughness={0.85} />
      </mesh>
      {/* Bottom base */}
      <mesh position={[0, 0.03, 0]}>
        <boxGeometry args={[1.24, 0.06, 0.42]} />
        <meshStandardMaterial color={darkWood} roughness={0.9} />
      </mesh>
      {/* Shelves at y = 0.9, 1.65, 2.4, 3.15 */}
      {[0.9, 1.65, 2.4, 3.15].map((sy, i) => (
        <mesh key={i} position={[0, sy, 0]}>
          <boxGeometry args={[1.18, 0.05, 0.36]} />
          <meshStandardMaterial color={wood} roughness={0.85} />
        </mesh>
      ))}
      {/* Books — 5 shelves × a few books each */}
      {[0.0, 0.9, 1.65, 2.4, 3.15].map((shelfY, si) =>
        [-0.38, -0.18, 0.0, 0.18, 0.36].map((bx, bi) => {
          const h   = 0.55 + ((si * 3 + bi) % 4) * 0.07;
          const col = spines[(si * 5 + bi) % spines.length];
          return (
            <mesh key={`${si}-${bi}`} position={[bx, shelfY + 0.05 + h / 2, 0.03]}>
              <boxGeometry args={[0.13, h, 0.29]} />
              <meshStandardMaterial color={col} roughness={0.9} />
            </mesh>
          );
        })
      )}
    </group>
  );
}

function BearCarpet({ position }) {
  const { scene } = useGLTF(require('./assets/models/bear_skin_rug.glb'));
  const groupRef = useRef();

  useEffect(() => {
    if (!groupRef.current) return;
    const box = new THREE.Box3().setFromObject(groupRef.current);
    const bottomY = box.min.y;
    // Shift the inner primitive up so its bottom sits exactly at y=0 of the group
    groupRef.current.children[0].position.y -= bottomY;
  }, [scene]);

  return (
    <group ref={groupRef} position={position} rotation={[0, Math.PI, 0]} scale={0.015}>
      <primitive object={scene} />
    </group>
  );
}

function Corridor() {
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.4, 0]}>
        <planeGeometry args={[10, 14]} />
        <meshStandardMaterial color="#2e1a44" roughness={0.97} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 2.8, 0]}>
        <planeGeometry args={[10, 14]} />
        <meshStandardMaterial color="#160830" roughness={1} />
      </mesh>
      <mesh rotation={[0, Math.PI / 2, 0]} position={[-4.4, 0.7, 0]}>
        <planeGeometry args={[14, 4.2]} />
        <meshStandardMaterial color="#3b1a5e" roughness={0.9} />
      </mesh>
      <mesh rotation={[0, -Math.PI / 2, 0]} position={[4.4, 0.7, 0]}>
        <planeGeometry args={[14, 4.2]} />
        <meshStandardMaterial color="#3b1a5e" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.7, -5.0]}>
        <planeGeometry args={[10, 4.2]} />
        <meshStandardMaterial color="#2d1048" roughness={0.88} />
      </mesh>
      {[-1, 1, 3].map((bz, i) => (
        <mesh key={i} position={[0, 2.72, bz]}>
          <boxGeometry args={[10, 0.18, 0.26]} />
          <meshStandardMaterial color="#301908" roughness={0.9} />
        </mesh>
      ))}
      <mesh position={[-4.38, -1.28, 0]}>
        <boxGeometry args={[0.08, 0.16, 14]} />
        <meshStandardMaterial color="#301908" />
      </mesh>
      <mesh position={[4.38, -1.28, 0]}>
        <boxGeometry args={[0.08, 0.16, 14]} />
        <meshStandardMaterial color="#3e1f0a" />
      </mesh>
      <Table position={[3.7, -1.4, -2.0]} rotation={[0, Math.PI / 2, 0]} />
      <Bookcase position={[-4.25, -1.4, -2.0]} />
    </>
  );
}

function Scene({ ghosts, onTap, hitResults, groupRefs, labelAnims }) {
  return (
    <>
      <color attach="background" args={['#1e0a3c']} />
      <fog attach="fog" args={['#1e0a3c', 9, 16]} />

      <ambientLight intensity={2.2} color="#c084fc" />
      <pointLight position={[0, 3, 2]}   color="#ffffff" intensity={3.5} distance={12} />
      <pointLight position={[ 4, 1.4, -1.8]} color="#f97316" intensity={3.0} distance={8} />
      <pointLight position={[-4, 1.4, -3.5]} color="#f97316" intensity={2.5} distance={7} />
      <pointLight position={[ 4, 1.4, -3.5]} color="#f97316" intensity={2.5} distance={7} />
      <pointLight position={[0, 1.5, -3.5]} color="#a855f7" intensity={2.0} distance={6} />
      <pointLight position={[-2.5, 1.8, 0.5]} color="#ffe4b5" intensity={5.0} distance={6} />

      <Corridor />
      <BearCarpet position={[0, -1.5, 1.5]} />

      <Torch position={[ 4.2, 1.2, -1.8]} />
      <Torch position={[-4.2, 1.2, -3.5]} />
      <Torch position={[ 4.2, 1.2, -3.5]} />

      <Candle position={[3.7, -0.39, -2.0]} />

      {ghosts.map((ghost, i) => (
        <FloatingGhost
          key={i}
          index={i}
          ghost={ghost}
          hitResult={hitResults[i]}
          onTap={() => onTap(i)}
          groupRef={groupRefs[i]}
        />
      ))}

      <LabelProjector groupRefs={groupRefs} labelAnims={labelAnims} />
    </>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function HauntedHouse({ question, onCorrect, onWrong }) {
  const { width: SCREEN_W, height: SCREEN_H } = useWindowDimensions();
  const GAME_W = SCREEN_W - 32;
  const GAME_H = Math.min(Math.round(SCREEN_H * 0.54), SCREEN_H - 260);

  const [ghosts,     setGhosts]     = useState(() => buildGhosts(question.answer));
  const [hitResults, setHitResults] = useState(['none', 'none', 'none', 'none']);
  const doneRef = useRef(false);

  // One ref per ghost for 3D group; one Animated.ValueXY per ghost for label position
  const groupRefs  = useRef(Array.from({ length: NUM_GHOSTS }, () => ({ current: null }))).current;
  const labelAnims = useRef(Array.from({ length: NUM_GHOSTS }, () => ({
    x: new Animated.Value(0),
    y: new Animated.Value(0),
  }))).current;

  useEffect(() => {
    setGhosts(buildGhosts(question.answer));
    setHitResults(['none', 'none', 'none', 'none']);
    doneRef.current = false;
  }, [question.text]);

  function tapGhost(idx) {
    if (doneRef.current || hitResults[idx] !== 'none') return;
    if (ghosts[idx].isCorrect) {
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
    <View style={[styles.container, { width: GAME_W, height: GAME_H }]}>
      <GameLoader color="#c084fc" background="#1e0a3c">
        <Canvas
          camera={{ position: [0, 0.2, 4.5], fov: 72 }}
          style={StyleSheet.absoluteFill}
          gl={{ antialias: true }}
        >
          <Scene
            ghosts={ghosts}
            onTap={tapGhost}
            hitResults={hitResults}
            groupRefs={groupRefs}
            labelAnims={labelAnims}
          />
        </Canvas>

        {/* RN overlay: number labels that track ghost positions via Animated */}
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {ghosts.map((ghost, i) => {
            const isWrong   = hitResults[i] === 'wrong';
            const isCorrect = hitResults[i] === 'correct';
            const color = isCorrect ? '#4ade80' : isWrong ? '#f87171' : '#ffffff';
            return (
              <Animated.View
                key={i}
                style={[
                  styles.label,
                  { left: labelAnims[i].x, top: labelAnims[i].y },
                ]}
              >
                <Text style={[styles.labelText, { color }]}>{ghost.num}</Text>
              </Animated.View>
            );
          })}
        </View>
      </GameLoader>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius:   20,
    overflow:       'hidden',
    borderWidth:    1.5,
    borderColor:    '#3d1a6e',
    marginVertical: 8,
  },
  label: {
    position:  'absolute',
    width:     36,
    height:    36,
    alignItems:     'center',
    justifyContent: 'center',
  },
  labelText: {
    fontSize:   18,
    fontWeight: 'bold',
    textShadowColor:  '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
});
