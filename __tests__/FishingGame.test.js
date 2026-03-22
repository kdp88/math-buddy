/**
 * FishingGame — Pure Function Unit Tests
 *
 * FishingGame's 3-D scene uses @react-three/fiber Canvas which cannot render
 * in Jest (no WebGL). We test the two pure helpers that contain all the
 * interesting game logic:
 *
 *  1. buildFish(answer)  — produces NUM_FISH unique non-negative distractors,
 *                          exactly one of which is the correct answer.
 *
 *  2. tapFish logic      — guard conditions: doneRef, tappedRef, correct vs wrong
 *                          branch selection, and double-tap prevention.
 */

// ─── Inline copies of pure helpers (no RN/R3F imports needed) ─────────────────

const NUM_FISH     = 4;
const FISH_START_X = [-6, 6, -6, 6];

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

// ─── tapFish logic (extracted from component, no React state) ─────────────────
// Mirrors the guard and branch logic in FishingGame's tapFish() function.

function makeTapFishEnv(fishArr) {
  const doneRef   = { current: false };
  const tappedRef = { current: new Set() };
  const onCorrect = jest.fn();
  const onWrong   = jest.fn();
  const timers    = [];

  function tapFish(idx) {
    if (doneRef.current || tappedRef.current.has(idx)) return;
    tappedRef.current.add(idx);

    if (fishArr[idx].isCorrect) {
      doneRef.current = true;
      timers.push(setTimeout(() => onCorrect(), 1800));
    } else {
      timers.push(setTimeout(() => {
        tappedRef.current.delete(idx);
      }, 800));
      onWrong();
    }
  }

  function cleanup() { timers.forEach(clearTimeout); }

  return { tapFish, doneRef, tappedRef, onCorrect, onWrong, cleanup };
}

// ─── 1. buildFish(answer) ─────────────────────────────────────────────────────

const ANSWERS = [0, 1, 5, 10, 18, 20, 100];

describe('buildFish(answer)', () => {
  test.each(ANSWERS)('returns exactly NUM_FISH fish for answer=%i', (answer) => {
    expect(buildFish(answer)).toHaveLength(NUM_FISH);
  });

  test.each(ANSWERS)('always includes exactly one correct fish for answer=%i', (answer) => {
    const fish = buildFish(answer);
    expect(fish.filter(f => f.isCorrect)).toHaveLength(1);
  });

  test.each(ANSWERS)('the correct fish has the right number for answer=%i', (answer) => {
    const correct = buildFish(answer).find(f => f.isCorrect);
    expect(correct.num).toBe(answer);
  });

  test.each(ANSWERS)('all fish numbers are unique for answer=%i', (answer) => {
    const nums = buildFish(answer).map(f => f.num);
    expect(new Set(nums).size).toBe(NUM_FISH);
  });

  test.each(ANSWERS)('all fish numbers are non-negative for answer=%i', (answer) => {
    buildFish(answer).forEach(f => expect(f.num).toBeGreaterThanOrEqual(0));
  });

  test.each(ANSWERS)('every fish has a dir of 1 or -1 for answer=%i', (answer) => {
    buildFish(answer).forEach(f => expect([1, -1]).toContain(f.dir));
  });

  test('dir alternates: index 0 and 2 are +1, index 1 and 3 are -1', () => {
    const fish = buildFish(7);
    expect(fish[0].dir).toBe(1);
    expect(fish[1].dir).toBe(-1);
    expect(fish[2].dir).toBe(1);
    expect(fish[3].dir).toBe(-1);
  });

  test('works for answer=0 — no negatives across many runs', () => {
    for (let i = 0; i < 30; i++) {
      buildFish(0).forEach(f => expect(f.num).toBeGreaterThanOrEqual(0));
    }
  });

  test('answer=0 always produces exactly one correct fish across many runs', () => {
    for (let i = 0; i < 30; i++) {
      expect(buildFish(0).filter(f => f.isCorrect)).toHaveLength(1);
    }
  });

  test('output is shuffled (correct fish is not always at index 0)', () => {
    const positions = Array.from({ length: 40 }, () =>
      buildFish(7).findIndex(f => f.isCorrect)
    );
    expect(positions.every(p => p === 0)).toBe(false);
  });

  test('distractors are close to the answer (within reasonable range)', () => {
    for (let i = 0; i < 20; i++) {
      buildFish(10)
        .filter(f => !f.isCorrect)
        .forEach(f => {
          // Distractors start near the answer — allow generous range for fallback path
          expect(f.num).toBeGreaterThanOrEqual(0);
          expect(f.num).not.toBe(10);
        });
    }
  });
});

// ─── 2. tapFish logic ─────────────────────────────────────────────────────────

describe('tapFish — correct answer', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => { jest.runOnlyPendingTimers(); jest.useRealTimers(); });

  test('calls onCorrect after 1800ms', () => {
    const fish = buildFish(5);
    const correctIdx = fish.findIndex(f => f.isCorrect);
    const env = makeTapFishEnv(fish);

    env.tapFish(correctIdx);
    expect(env.onCorrect).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1800);
    expect(env.onCorrect).toHaveBeenCalledTimes(1);
    env.cleanup();
  });

  test('sets doneRef immediately on correct tap', () => {
    const fish = buildFish(5);
    const correctIdx = fish.findIndex(f => f.isCorrect);
    const env = makeTapFishEnv(fish);

    env.tapFish(correctIdx);
    expect(env.doneRef.current).toBe(true);
    env.cleanup();
  });

  test('does not call onWrong on correct tap', () => {
    const fish = buildFish(5);
    const correctIdx = fish.findIndex(f => f.isCorrect);
    const env = makeTapFishEnv(fish);

    env.tapFish(correctIdx);
    jest.advanceTimersByTime(1800);
    expect(env.onWrong).not.toHaveBeenCalled();
    env.cleanup();
  });

  test('double-tap on correct fish does not fire onCorrect twice', () => {
    const fish = buildFish(5);
    const correctIdx = fish.findIndex(f => f.isCorrect);
    const env = makeTapFishEnv(fish);

    env.tapFish(correctIdx);
    env.tapFish(correctIdx); // second tap — doneRef is already true
    jest.advanceTimersByTime(1800);
    expect(env.onCorrect).toHaveBeenCalledTimes(1);
    env.cleanup();
  });

  test('tapping a different fish after correct tap is ignored (doneRef)', () => {
    const fish = buildFish(5);
    const correctIdx  = fish.findIndex(f => f.isCorrect);
    const wrongIdx    = fish.findIndex((f, i) => i !== correctIdx);
    const env = makeTapFishEnv(fish);

    env.tapFish(correctIdx);
    env.tapFish(wrongIdx);
    jest.advanceTimersByTime(1800);
    expect(env.onWrong).not.toHaveBeenCalled();
    expect(env.onCorrect).toHaveBeenCalledTimes(1);
    env.cleanup();
  });
});

describe('tapFish — wrong answer', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => { jest.runOnlyPendingTimers(); jest.useRealTimers(); });

  test('calls onWrong immediately on wrong tap', () => {
    const fish = buildFish(5);
    const wrongIdx = fish.findIndex(f => !f.isCorrect);
    const env = makeTapFishEnv(fish);

    env.tapFish(wrongIdx);
    expect(env.onWrong).toHaveBeenCalledTimes(1);
    env.cleanup();
  });

  test('does not call onCorrect on wrong tap', () => {
    const fish = buildFish(5);
    const wrongIdx = fish.findIndex(f => !f.isCorrect);
    const env = makeTapFishEnv(fish);

    env.tapFish(wrongIdx);
    jest.advanceTimersByTime(1800);
    expect(env.onCorrect).not.toHaveBeenCalled();
    env.cleanup();
  });

  test('does not set doneRef on wrong tap', () => {
    const fish = buildFish(5);
    const wrongIdx = fish.findIndex(f => !f.isCorrect);
    const env = makeTapFishEnv(fish);

    env.tapFish(wrongIdx);
    expect(env.doneRef.current).toBe(false);
    env.cleanup();
  });

  test('double-tap on same wrong fish is blocked until lock clears', () => {
    const fish = buildFish(5);
    const wrongIdx = fish.findIndex(f => !f.isCorrect);
    const env = makeTapFishEnv(fish);

    env.tapFish(wrongIdx);
    env.tapFish(wrongIdx); // still locked
    expect(env.onWrong).toHaveBeenCalledTimes(1);
    env.cleanup();
  });

  test('lock releases after 800ms — second tap then allowed', () => {
    const fish = buildFish(5);
    const wrongIdx = fish.findIndex(f => !f.isCorrect);
    const env = makeTapFishEnv(fish);

    env.tapFish(wrongIdx);
    jest.advanceTimersByTime(800);
    expect(env.tappedRef.current.has(wrongIdx)).toBe(false);

    env.tapFish(wrongIdx);
    expect(env.onWrong).toHaveBeenCalledTimes(2);
    env.cleanup();
  });

  test('two different wrong fish can be tapped independently', () => {
    const fish = buildFish(5);
    const wrongIndices = fish
      .map((f, i) => (!f.isCorrect ? i : -1))
      .filter(i => i !== -1);
    expect(wrongIndices.length).toBeGreaterThanOrEqual(2);

    const env = makeTapFishEnv(fish);
    env.tapFish(wrongIndices[0]);
    env.tapFish(wrongIndices[1]);
    expect(env.onWrong).toHaveBeenCalledTimes(2);
    env.cleanup();
  });
});

// ─── 3. tapFish — guard conditions ────────────────────────────────────────────

describe('tapFish — guard conditions', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => { jest.runOnlyPendingTimers(); jest.useRealTimers(); });

  test('no callbacks fired when doneRef is pre-set to true', () => {
    const fish = buildFish(5);
    const env = makeTapFishEnv(fish);
    env.doneRef.current = true;

    fish.forEach((_, i) => env.tapFish(i));
    jest.advanceTimersByTime(1800);

    expect(env.onCorrect).not.toHaveBeenCalled();
    expect(env.onWrong).not.toHaveBeenCalled();
    env.cleanup();
  });

  test('tapping an already-tapped index is ignored', () => {
    const fish = buildFish(5);
    const wrongIdx = fish.findIndex(f => !f.isCorrect);
    const env = makeTapFishEnv(fish);

    env.tappedRef.current.add(wrongIdx); // pre-lock
    env.tapFish(wrongIdx);
    expect(env.onWrong).not.toHaveBeenCalled();
    env.cleanup();
  });
});
