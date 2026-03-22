import { useState, useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import { View, Text, StyleSheet, useWindowDimensions, Animated } from 'react-native';
import GameLoader from './GameLoader';
import { Canvas, useFrame, useThree } from '@react-three/fiber/native';
import { useGLTF } from '@react-three/drei/native';
import * as THREE from 'three';

const NUM_FISH   = 4;
const FISH_COLORS  = ['#7c3aed', '#16a34a', '#f97316', '#be185d'];
const FISH_DEPTHS  = [-1.2, -1.8, -2.4, -1.5];   // Y positions below water
const FISH_Z       = [-1.0, -2.5, -1.8, -3.5];   // Z lanes so fish don't overlap
const FISH_SPEEDS  = [0.6,   0.4,   0.8,   0.5];  // swim speed multiplier
const FISH_START_X = [-6,    6,    -6,     6];     // alternating entry sides
const WATER_Y      = 0;                             // world Y of water surface

// ─── Game logic ───────────────────────────────────────────────────────────────

function buildFish(answer) {
  const set = new Set([answer]);
  let tries = 0;
  while (set.size < NUM_FISH && tries < 60) {
    const v = answer + ((Math.floor(Math.random() * 8) - 4) || 1);
    if (v >= 0) set.add(v);
    tries++;
  }
  for (let i = 1; set.size < NUM_FISH; i++) {
    if (!set.has(answer + i))                           set.add(answer + i);
    else if (answer - i >= 0 && !set.has(answer - i))  set.add(answer - i);
  }
  const arr = [...set];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.map((num, idx) => ({
    num,
    isCorrect: num === answer,
    dir: FISH_START_X[idx] < 0 ? 1 : -1,
  }));
}

// ─── Label projector ──────────────────────────────────────────────────────────

const _vec = new THREE.Vector3();

function LabelProjector({ fishRefs, labelAnims }) {
  const { camera, size } = useThree();
  useFrame(() => {
    if (!fishRefs || !labelAnims) return;
    fishRefs.forEach((ref, i) => {
      if (!ref || !ref.current || !labelAnims[i]) return;
      _vec.copy(ref.current.position);
      _vec.project(camera);
      labelAnims[i].x.setValue((_vec.x *  0.5 + 0.5) * size.width  - 18);
      labelAnims[i].y.setValue((-_vec.y * 0.5 + 0.5) * size.height - 18);
    });
  });
  return null;
}

// ─── Single fish ──────────────────────────────────────────────────────────────

function Fish({ index, fish, hitResult, onTap, groupRef, posTracker }) {
  const xRef     = useRef(FISH_START_X[index]);
  const phaseRef = useRef(index * 1.7);

  useEffect(() => {
    xRef.current = FISH_START_X[index];
    if (groupRef.current) {
      groupRef.current.position.set(FISH_START_X[index], FISH_DEPTHS[index], FISH_Z[index]);
      groupRef.current.scale.setScalar(1);
      groupRef.current.rotation.y = fish.dir > 0 ? 0 : Math.PI;
    }
  }, [fish.num]);

  useFrame(({ clock }, delta) => {
    if (!groupRef.current) return;
    const t = clock.elapsedTime;

    if (hitResult === 'correct') return; // just glow, stay in water

    // Swim across screen
    xRef.current += fish.dir * FISH_SPEEDS[index] * delta * 3;
    // Wrap around when off screen
    if (xRef.current > 8)  xRef.current = -8;
    if (xRef.current < -8) xRef.current =  8;

    const bob = Math.sin(t * 1.4 + phaseRef.current) * 0.12;
    groupRef.current.position.set(xRef.current, FISH_DEPTHS[index] + bob, FISH_Z[index]);
    groupRef.current.rotation.y = fish.dir > 0 ? 0 : Math.PI;
    // Track live position for bobber targeting
    if (posTracker) { posTracker.x = xRef.current; posTracker.z = FISH_Z[index]; }
  });

  const isWrong   = hitResult === 'wrong';
  const isCorrect = hitResult === 'correct';
  const color     = isCorrect ? '#4ade80' : isWrong ? '#f87171' : FISH_COLORS[index];
  const emissive  = isCorrect ? '#22c55e' : isWrong ? '#ef4444' : FISH_COLORS[index];
  const emissiveI = isCorrect ? 1.5       : isWrong ? 1.2       : 0.3;

  return (
    <group ref={groupRef} position={[FISH_START_X[index], FISH_DEPTHS[index], FISH_Z[index]]}>
      {/* Body */}
      <mesh onClick={onTap} scale={[1, 0.55, 0.4]}>
        <sphereGeometry args={[0.8, 16, 12]} />
        <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={emissiveI} />
      </mesh>
      {/* Tail */}
      <mesh position={[-0.85, 0, 0]} rotation={[0, 0, Math.PI / 4]} scale={[0.55, 0.55, 0.25]}>
        <coneGeometry args={[0.65, 0.85, 4]} />
        <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={emissiveI} />
      </mesh>
      {/* Eyes */}
      <mesh position={[0.52, 0.22, 0.28]}>
        <sphereGeometry args={[0.1, 8, 8]} />
        <meshStandardMaterial color="#000" roughness={0.1} metalness={0.2} />
      </mesh>
      <mesh position={[0.52, 0.22, -0.28]}>
        <sphereGeometry args={[0.1, 8, 8]} />
        <meshStandardMaterial color="#000" roughness={0.1} metalness={0.2} />
      </mesh>
    </group>
  );
}

// ─── Fisherman character (GLB) ─────────────────────────────────────────────────

const FISHERMAN_IDLE_GLB = require('./assets/models/fisherman_idle.glb');
const FISHERMAN_CAST_GLB = require('./assets/models/fisherman_cast.glb');
const SAILBOAT_GLB       = require('./assets/models/sailboat.glb');

const Fisherman = forwardRef(function Fisherman(_, ref) {
  const { scene, animations: idleAnims } = useGLTF(FISHERMAN_IDLE_GLB);
  const { animations: castAnims }        = useGLTF(FISHERMAN_CAST_GLB);
  const mixerRef   = useRef();
  const idleRef    = useRef();
  const castRef    = useRef();
  const poleGroupRef = useRef();
  const lineTipRef   = useRef();

  useEffect(() => {
    scene.traverse(obj => {
      obj.visible = true;
      obj.frustumCulled = false;
    });

    mixerRef.current = new THREE.AnimationMixer(scene);

    if (idleAnims.length > 0) {
      const clip = idleAnims[0].clone();
      const idle = mixerRef.current.clipAction(clip);
      idle.setLoop(THREE.LoopRepeat).play();
      idleRef.current = idle;
    }
    if (castAnims.length > 0) {
      const clip = castAnims[0].clone();
      const cast = mixerRef.current.clipAction(clip);
      cast.setLoop(THREE.LoopOnce, 1);
      cast.timeScale = 3.0;
      cast.clampWhenFinished = true;
      castRef.current = cast;
    }

    // Attach fishing pole to right hand bone.
    // Bone space is Mixamo's cm scale — the Armature root has scale=0.01,
    // so 1 bone-space unit = 0.01 world units → need ~200 bone-space units for a 2m pole.
    const handBone = scene.getObjectByName('mixamorigRightHand');
    if (handBone) {
      const noFrustum = obj => { obj.frustumCulled = false; };

      // Clear any poles left from previous mounts (cached GLB scene persists)
      while (handBone.children.length > 0) handBone.remove(handBone.children[0]);

      const pole = new THREE.Group();
      pole.name = 'fishingPole';
      pole.rotation.set(0.3, 0, 0.2);

      // Rod (tapered cylinder, pointing up along Y in hand space)
      const rod = new THREE.Mesh(
        new THREE.CylinderGeometry(1, 3, 200, 7),
        new THREE.MeshStandardMaterial({ color: '#5c3a1e', roughness: 0.8 }),
      );
      rod.position.set(0, 100, 0);
      noFrustum(rod);
      pole.add(rod);


      // Line hanging from pole tip
      const line = new THREE.Mesh(
        new THREE.CylinderGeometry(0.3, 0.3, 140, 4),
        new THREE.MeshStandardMaterial({ color: '#cccccc', roughness: 0.2 }),
      );
      line.position.set(0, 165, 30);
      line.rotation.set(0.6, 0, 0);
      noFrustum(line);
      pole.add(line);

      // Invisible marker at line tip — world position drives idle bobber
      const tip = new THREE.Object3D();
      tip.position.set(0, 95, 30 + 140 * Math.sin(0.6) * 0.5); // bottom of line
      noFrustum(tip);
      pole.add(tip);
      lineTipRef.current = tip;

      poleGroupRef.current = pole;
      handBone.add(pole);
    }

    return () => {
      mixerRef.current?.stopAllAction();
      if (poleGroupRef.current) {
        poleGroupRef.current.parent?.remove(poleGroupRef.current);
        poleGroupRef.current = null;
      }
    };
  }, [scene, idleAnims, castAnims]);

  useImperativeHandle(ref, () => ({
    getLineTip(target) {
      lineTipRef.current?.getWorldPosition(target);
    },
    cast(fishX = 0, fishZ = -2) {
      const idle = idleRef.current;
      const cast = castRef.current;
      if (!idle || !cast) return;

      // Swing pole toward the fish using actual fish position
      if (poleGroupRef.current) {
        const dz = 5.5 - fishZ; // fisherman z=5.5, fish z is negative
        const angle = Math.atan2(fishX, dz);
        poleGroupRef.current.rotation.set(0.3, -angle, 0.2);
      }

      idle.fadeOut(0.1);
      cast.reset().setEffectiveWeight(1).fadeIn(0.05).play();
      const duration = (cast.getClip().duration / cast.timeScale) * 1000;
      setTimeout(() => {
        cast.fadeOut(0.2);
        idle.reset().setEffectiveWeight(1).fadeIn(0.2).play();
      }, duration);
    },
  }), []);

  useFrame((_, delta) => mixerRef.current?.update(delta));

  return (
    <primitive object={scene} dispose={null} position={[0, 0.24, 5.5]} rotation={[0, Math.PI, 0]} />
  );
});

// ─── Sailboat ─────────────────────────────────────────────────────────────────

function Sailboat() {
  const { scene } = useGLTF(SAILBOAT_GLB);
  useEffect(() => {
    scene.traverse(obj => { obj.frustumCulled = false; });
  }, [scene]);
  return (
    <primitive object={scene} dispose={null} position={[-2, -0.2, -2]} rotation={[0, 1.4, 0]} scale={[1.4, 1.4, 1.4]} />
  );
}

// ─── Water surface ─────────────────────────────────────────────────────────────

function Water() {
  const matRef = useRef();
  useFrame(({ clock }) => {
    if (matRef.current) {
      matRef.current.opacity = 0.72 + Math.sin(clock.elapsedTime * 1.2) * 0.04;
    }
  });
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, WATER_Y, 0]}>
      <planeGeometry args={[20, 20]} />
      <meshStandardMaterial
        ref={matRef}
        color="#1e6fa8"
        transparent
        opacity={0.74}
        roughness={0.1}
        metalness={0.3}
      />
    </mesh>
  );
}

// ─── Dock ──────────────────────────────────────────────────────────────────────

function Dock({ wide = false }) {
  const plankColor = '#8B5E3C';
  const plankDark  = '#6b4423';
  const halfCount  = wide ? 13 : 8;   // planks per side — 17 portrait, 27 landscape
  const dockHalf   = halfCount * 0.4; // half-width in world units
  const planks     = Array.from({ length: halfCount * 2 + 1 }, (_, i) => -halfCount * 0.4 + i * 0.4);
  return (
    <group position={[0, 0.2, 5.5]}>
      {planks.map((x, i) => (
        <mesh key={i} position={[x, 0, 0]} rotation={[0, 0.08, 0]}>
          <boxGeometry args={[0.35, 0.08, 3.5]} />
          <meshStandardMaterial color={i % 2 === 0 ? plankColor : plankDark} roughness={0.95} />
        </mesh>
      ))}
      {/* Support beams */}
      <mesh position={[0, -0.35, -0.6]}>
        <boxGeometry args={[dockHalf * 2 + 0.4, 0.6, 0.12]} />
        <meshStandardMaterial color={plankDark} roughness={0.9} />
      </mesh>
      <mesh position={[0, -0.35, 0.6]}>
        <boxGeometry args={[dockHalf * 2 + 0.4, 0.6, 0.12]} />
        <meshStandardMaterial color={plankDark} roughness={0.9} />
      </mesh>
      {/* Legs */}
      {[-dockHalf, dockHalf].map((x, i) => (
        <group key={i}>
          <mesh position={[x, -0.9, -0.5]}>
            <cylinderGeometry args={[0.06, 0.08, 1.2, 6]} />
            <meshStandardMaterial color={plankDark} roughness={0.9} />
          </mesh>
          <mesh position={[x, -0.9, 0.5]}>
            <cylinderGeometry args={[0.06, 0.08, 1.2, 6]} />
            <meshStandardMaterial color={plankDark} roughness={0.9} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ─── Distant shoreline + hills ────────────────────────────────────────────────

const BACK_CLOUDS  = [
  { x: -5,   y: 4.8, z: -9,  s: 1.0, spd: 0.4  },
  { x: -3,   y: 5.3, z: -9,  s: 0.7, spd: 0.25 },
  { x: -6,   y: 4.6, z: -9,  s: 0.6, spd: 0.55 },
  { x:  1,   y: 5.8, z: -11, s: 1.1, spd: 0.3  },
  { x:  3,   y: 5.6, z: -11, s: 0.75,spd: 0.45 },
  { x:  0,   y: 5.3, z: -11, s: 0.6, spd: 0.35 },
  { x: -1,   y: 4.3, z: -8,  s: 0.8, spd: 0.5  },
  { x:  0.8, y: 4.6, z: -8,  s: 0.55,spd: 0.2  },
];

const SIDE_CLOUDS = [
  { y: 3.2, z: -3, s: 1.0,  spd: 0.3  },
  { y: 3.6, z: -1, s: 0.7,  spd: 0.45 },
  { y: 2.9, z: -5, s: 0.6,  spd: 0.55 },
  { y: 3.4, z:  1, s: 0.85, spd: 0.25 },
  { y: 2.7, z:  3, s: 0.65, spd: 0.4  },
  { y: 3.8, z: -7, s: 0.9,  spd: 0.35 },
  { y: 3.0, z:  5, s: 0.75, spd: 0.5  },
  { y: 3.5, z:  0, s: 1.1,  spd: 0.2  },
];

function AnimatedCloud({ position, scale, speed, axis }) {
  const ref  = useRef();
  const base = useRef(position[axis === 'x' ? 0 : 2]);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const drift = Math.sin(clock.elapsedTime * speed * 0.5) * 1.8;
    if (axis === 'x') ref.current.position.x = base.current + drift;
    else              ref.current.position.z = base.current + drift;
  });

  return (
    <mesh ref={ref} position={position} scale={scale}>
      <sphereGeometry args={[0.7, 10, 8]} />
      <meshStandardMaterial color="#ffffff" roughness={1} />
    </mesh>
  );
}

function Sky() {
  return (
    <>
      {/* Sun */}
      <mesh position={[6, 5.5, -10]}>
        <sphereGeometry args={[0.9, 16, 16]} />
        <meshStandardMaterial color="#ffe566" emissive="#ffdd00" emissiveIntensity={1.2} />
      </mesh>

      {BACK_CLOUDS.map(({ x, y, z, s, spd }, i) => (
        <AnimatedCloud key={`back-${i}`} position={[x, y, z]} scale={[s * 1.6, s, s]} speed={spd} axis="x" />
      ))}

      {SIDE_CLOUDS.map(({ y, z, s, spd }, i) => (
        <AnimatedCloud key={`left-${i}`} position={[-11, y, z]} scale={[s, s, s * 1.6]} speed={spd} axis="z" />
      ))}

      {SIDE_CLOUDS.map(({ y, z, s, spd }, i) => (
        <AnimatedCloud key={`right-${i}`} position={[11, y, z]} scale={[s, s, s * 1.6]} speed={spd} axis="z" />
      ))}
    </>
  );
}

function Scenery() {
  return (
    <>
      {/* Far lake floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -3.5, 0]}>
        <planeGeometry args={[30, 30]} />
        <meshStandardMaterial color="#1a3a1a" roughness={1} />
      </mesh>
      {/* Lily pads */}
      {[[-2, 0.05, 2], [1.5, 0.05, -1], [-3.5, 0.05, -0.5]].map(([x, y, z], i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, i * 1.2]} position={[x, y, z]}>
          <circleGeometry args={[0.3, 8]} />
          <meshStandardMaterial color="#2d7a2d" roughness={0.8} />
        </mesh>
      ))}
    </>
  );
}


// ─── World-space bobber (lands where the fish is) ─────────────────────────────

const _tipVec = new THREE.Vector3();

function CastBobber({ target, fishermanRef }) {
  const outerRef = useRef();
  const bobRef   = useRef();

  useFrame(({ clock }) => {
    if (!bobRef.current) return;
    bobRef.current.position.y = Math.sin(clock.elapsedTime * 2.5) * 0.04;
    if (!target && outerRef.current && fishermanRef?.current) {
      fishermanRef.current.getLineTip(_tipVec);
      outerRef.current.position.copy(_tipVec);
    }
  });

  const pos = target ?? { x: 0, z: 0 };

  return (
    <group ref={outerRef} position={[pos.x, 0.08, pos.z]}>
      <group ref={bobRef}>
        <mesh position={[0, 0.07, 0]}>
          <sphereGeometry args={[0.07, 8, 8]} />
          <meshStandardMaterial color="#e53e3e" roughness={0.4} />
        </mesh>
        <mesh position={[0, -0.07, 0]}>
          <sphereGeometry args={[0.07, 8, 8]} />
          <meshStandardMaterial color="#ffffff" roughness={0.4} />
        </mesh>
      </group>
    </group>
  );
}

// ─── Scene ready signal ───────────────────────────────────────────────────────

function SceneReady({ onReady }) {
  useEffect(() => { onReady(); }, []);
  return null;
}

// ─── Full 3D scene ────────────────────────────────────────────────────────────

function Scene({ fish, hitResults, fishRefs, fishPositions, labelAnims, onTapFish, fishermanRef, castTarget, onReady, wide }) {
  return (
    <>
      <SceneReady onReady={onReady} />

      <color attach="background" args={['#87ceeb']} />
      <fog attach="fog" args={['#b0d8e8', 12, 26]} />

      {/* Lighting */}
      <ambientLight intensity={1.2} color="#b0d0e8" />
      <directionalLight
        position={[-5, 8, 4]}
        color="#fff8e8"
        intensity={2.5}
        castShadow
      />
      <pointLight position={[0, -0.5, 0]} color="#4488ff" intensity={1.2} distance={10} />

      <Sky />
      <Scenery />
      <Sailboat />
      <Water />
      <Dock wide={wide} />
      <Fisherman ref={fishermanRef} />
      <CastBobber target={castTarget} fishermanRef={fishermanRef} />

      {fish.map((f, i) => (
        <Fish
          key={i}
          index={i}
          fish={f}
          hitResult={hitResults[i]}
          onTap={() => onTapFish(i)}
          groupRef={fishRefs[i]}
          posTracker={fishPositions?.[i]}
        />
      ))}

      <LabelProjector fishRefs={fishRefs} labelAnims={labelAnims} />
    </>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function FishingGame({ question, onCorrect, onWrong }) {
  const { width: SCREEN_W, height: SCREEN_H } = useWindowDimensions();
  const GAME_W = SCREEN_W - 32;
  const GAME_H = Math.min(Math.round(SCREEN_H * 0.54), SCREEN_H - 260);

  const [fish,        setFish]        = useState(() => buildFish(question.answer));
  const [hitResults,  setHitResults]  = useState(Array(NUM_FISH).fill('none'));
  const [castTarget,  setCastTarget]  = useState(null);

  const doneRef       = useRef(false);
  const tappedRef     = useRef(new Set());
  const timersRef     = useRef([]);
  const fishermanRef  = useRef();

  // Clear all pending timers on unmount
  useEffect(() => () => timersRef.current.forEach(clearTimeout), []);
  const fishRefs      = useRef(Array.from({ length: NUM_FISH }, () => ({ current: null }))).current;
  const fishPositions = useRef(Array.from({ length: NUM_FISH }, (_, i) => ({ x: FISH_START_X[i], z: FISH_Z[i] }))).current;
  const labelAnims = useRef(Array.from({ length: NUM_FISH }, () => ({
    x: new Animated.Value(0),
    y: new Animated.Value(0),
  }))).current;

  useEffect(() => {
    setFish(buildFish(question.answer));
    setHitResults(Array(NUM_FISH).fill('none'));
    setCastTarget(null);
    doneRef.current = false;
    tappedRef.current.clear();
  }, [question.text]);

  function tapFish(idx) {
    if (doneRef.current || tappedRef.current.has(idx)) return;
    tappedRef.current.add(idx);

    const fx = fishPositions[idx].x;
    const fz = fishPositions[idx].z;
    const fy = FISH_DEPTHS[idx];

    // Project fish position through camera onto water surface (y=0)
    // so the bobber visually aligns with the fish from the camera's POV
    const camX = 0, camY = 3, camZ = 8;
    const t  = camY / (camY - fy);          // t where ray camera→fish hits y=0
    const sx = camX + t * (fx - camX);
    const sz = camZ + t * (fz - camZ);

    const track = id => { timersRef.current.push(id); return id; };

    fishermanRef.current?.cast(fx, fz);
    setCastTarget({ x: sx, z: sz });
    track(setTimeout(() => setCastTarget(null), 1600));

    if (fish[idx].isCorrect) {
      doneRef.current = true;
      setHitResults(h => h.map((v, i) => i === idx ? 'correct' : v));
      track(setTimeout(() => onCorrect(), 1800));
    } else {
      setHitResults(h => h.map((v, i) => i === idx ? 'wrong' : v));
      track(setTimeout(() => {
        setHitResults(h => h.map((v, i) => i === idx ? 'none' : v));
        tappedRef.current.delete(idx);
      }, 800));
      onWrong();
    }
  }

  return (
    <View testID="fishing-container" style={[styles.container, { width: GAME_W, height: GAME_H }]}>
      <GameLoader color="#1e90ff" background="#87ceeb">
        <Canvas
          camera={{ position: [0, 3, 8], fov: 65 }}
          style={StyleSheet.absoluteFill}
          gl={{ antialias: true }}
        >
          <Scene
            fish={fish}
            hitResults={hitResults}
            fishRefs={fishRefs}
            fishPositions={fishPositions}
            labelAnims={labelAnims}
            onTapFish={tapFish}
            fishermanRef={fishermanRef}
            castTarget={castTarget}
            onReady={() => {}}
            wide={GAME_W > GAME_H}
          />
        </Canvas>

        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {fish.map((f, i) => {
            const isWrong   = hitResults[i] === 'wrong';
            const isCorrect = hitResults[i] === 'correct';
            return (
              <Animated.View
                key={i}
                testID={`fishing-fish-label-${f.num}`}
                style={[styles.label, {
                  transform: [
                    { translateX: labelAnims[i].x },
                    { translateY: labelAnims[i].y },
                  ],
                }]}
              >
                <Text style={[styles.labelText, isCorrect && { color: '#86efac' }, isWrong && { color: '#fca5a5' }]}>
                  {f.num}
                </Text>
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
    borderRadius: 16,
    overflow: 'hidden',
    alignSelf: 'center',
  },
  label: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 16,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
});
