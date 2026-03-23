/**
 * HauntedHouse — Pure Function Unit Tests
 *
 * The 3-D scene uses @react-three/fiber Canvas (no WebGL in Jest).
 * We test the two pure helpers that contain all the game logic:
 *
 *  1. buildGhosts(answer) — produces NUM_GHOSTS unique non-negative
 *                           distractors, exactly one of which is correct.
 *
 *  2. tapGhost logic      — guard conditions: doneRef, correct vs wrong
 *                           branch selection, and double-tap prevention.
 */

// ─── Inline copy of buildGhosts (no RN/R3F imports needed) ───────────────────

const NUM_GHOSTS = 4;

function buildGhosts(answer) {
  const set = new Set([answer]);
  let tries = 0;
  while (set.size < NUM_GHOSTS && tries < 60) {
    const v = answer + ((Math.floor(Math.random() * 8) - 4) || 1);
    if (v >= 0) set.add(v);
    tries++;
  }
  for (let i = 1; set.size < NUM_GHOSTS && i < 200; i++) {
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

// ─── tapGhost logic (extracted from component, no React state) ────────────────

function makeTapEnv(ghostArr) {
  const doneRef    = { current: false };
  const frozenRef  = { current: new Set() };
  const hitResults = Array(NUM_GHOSTS).fill('none');
  const onCorrect  = jest.fn();
  const onWrong    = jest.fn();
  const timers     = new Map(); // key: ghost idx or 'correct'

  function tapGhost(idx) {
    if (doneRef.current || frozenRef.current.has(idx)) return;
    frozenRef.current.add(idx);
    if (ghostArr[idx].isCorrect) {
      doneRef.current = true;
      hitResults[idx] = 'correct';
      timers.set('correct', setTimeout(onCorrect, 900));
    } else {
      hitResults[idx] = 'wrong';
      timers.set(idx, setTimeout(() => {
        frozenRef.current.delete(idx);
        hitResults[idx] = 'none';
      }, 700));
      setTimeout(onWrong, 0);
    }
  }

  function reset() {
    doneRef.current = false;
    frozenRef.current.clear();
    timers.forEach(clearTimeout);
    timers.clear();
    hitResults.fill('none');
  }

  function cleanup() { timers.forEach(clearTimeout); }

  return { tapGhost, doneRef, frozenRef, hitResults, onCorrect, onWrong, reset, cleanup };
}

// ─── buildGhosts ──────────────────────────────────────────────────────────────

describe('buildGhosts', () => {
  it('returns exactly NUM_GHOSTS ghosts', () => {
    expect(buildGhosts(7)).toHaveLength(NUM_GHOSTS);
  });

  it('includes exactly one correct ghost', () => {
    const ghosts = buildGhosts(7);
    expect(ghosts.filter(g => g.isCorrect)).toHaveLength(1);
    expect(ghosts.find(g => g.isCorrect).num).toBe(7);
  });

  it('all ghost numbers are unique', () => {
    const ghosts = buildGhosts(12);
    const nums = ghosts.map(g => g.num);
    expect(new Set(nums).size).toBe(NUM_GHOSTS);
  });

  it('all ghost numbers are non-negative', () => {
    // answer=0 is the hardest case — distractors must stay >= 0
    const ghosts = buildGhosts(0);
    ghosts.forEach(g => expect(g.num).toBeGreaterThanOrEqual(0));
  });

  it('works for answer=1 — distractor answer-1=0 hits non-negative boundary', () => {
    const ghosts = buildGhosts(1);
    expect(ghosts).toHaveLength(NUM_GHOSTS);
    ghosts.forEach(g => expect(g.num).toBeGreaterThanOrEqual(0));
    expect(new Set(ghosts.map(g => g.num)).size).toBe(NUM_GHOSTS);
    expect(ghosts.find(g => g.isCorrect).num).toBe(1);
  });

  it('works for answer=0 and still returns NUM_GHOSTS unique ghosts', () => {
    const ghosts = buildGhosts(0);
    expect(ghosts).toHaveLength(NUM_GHOSTS);
    const nums = ghosts.map(g => g.num);
    expect(new Set(nums).size).toBe(NUM_GHOSTS);
  });

  it('works for large answers (hard mode)', () => {
    const ghosts = buildGhosts(400);
    expect(ghosts).toHaveLength(NUM_GHOSTS);
    expect(ghosts.filter(g => g.isCorrect)).toHaveLength(1);
    expect(ghosts.find(g => g.isCorrect).num).toBe(400);
  });

  it('isCorrect is false for all distractor ghosts', () => {
    const ghosts = buildGhosts(5);
    ghosts.filter(g => !g.isCorrect).forEach(g => {
      expect(g.num).not.toBe(5);
    });
  });

  it('produces different orderings across calls (shuffle works)', () => {
    const runs = Array.from({ length: 20 }, () =>
      buildGhosts(10).findIndex(g => g.isCorrect)
    );
    const unique = new Set(runs);
    // Extremely unlikely all 20 runs place correct ghost in same position
    expect(unique.size).toBeGreaterThan(1);
  });
});

// ─── tapGhost logic ───────────────────────────────────────────────────────────

describe('tapGhost logic', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  function makeGhosts(correctIdx, answer = 7) {
    return Array.from({ length: NUM_GHOSTS }, (_, i) => ({
      num:       i === correctIdx ? answer : answer + i + 1,
      isCorrect: i === correctIdx,
    }));
  }

  it('calls onCorrect after 900ms when correct ghost is tapped', () => {
    const ghosts = makeGhosts(2);
    const { tapGhost, onCorrect, cleanup } = makeTapEnv(ghosts);

    tapGhost(2);
    expect(onCorrect).not.toHaveBeenCalled();

    jest.advanceTimersByTime(900);
    expect(onCorrect).toHaveBeenCalledTimes(1);
    cleanup();
  });

  it('sets hitResult to "correct" when correct ghost is tapped', () => {
    const ghosts = makeGhosts(1);
    const { tapGhost, hitResults, cleanup } = makeTapEnv(ghosts);

    tapGhost(1);
    expect(hitResults[1]).toBe('correct');
    cleanup();
  });

  it('sets doneRef after correct tap', () => {
    const ghosts = makeGhosts(0);
    const { tapGhost, doneRef, cleanup } = makeTapEnv(ghosts);

    tapGhost(0);
    expect(doneRef.current).toBe(true);
    cleanup();
  });

  it('calls onWrong when wrong ghost is tapped (deferred via setTimeout 0)', () => {
    const ghosts = makeGhosts(3);
    const { tapGhost, onWrong, cleanup } = makeTapEnv(ghosts);

    tapGhost(0); // index 0 is wrong
    expect(onWrong).not.toHaveBeenCalled(); // not yet — deferred
    jest.advanceTimersByTime(0);
    expect(onWrong).toHaveBeenCalledTimes(1);
    cleanup();
  });

  it('sets hitResult to "wrong" then resets to "none" after 700ms', () => {
    const ghosts = makeGhosts(3);
    const { tapGhost, hitResults, cleanup } = makeTapEnv(ghosts);

    tapGhost(0);
    expect(hitResults[0]).toBe('wrong');

    jest.advanceTimersByTime(700);
    expect(hitResults[0]).toBe('none');
    cleanup();
  });

  it('does not call onCorrect after wrong tap', () => {
    const ghosts = makeGhosts(3);
    const { tapGhost, onCorrect, cleanup } = makeTapEnv(ghosts);

    tapGhost(0);
    jest.advanceTimersByTime(1000);
    expect(onCorrect).not.toHaveBeenCalled();
    cleanup();
  });

  it('ignores taps when doneRef is true', () => {
    const ghosts = makeGhosts(0);
    const { tapGhost, onCorrect, onWrong, cleanup } = makeTapEnv(ghosts);

    tapGhost(0); // correct — sets doneRef
    tapGhost(1); // should be ignored
    tapGhost(2); // should be ignored

    jest.advanceTimersByTime(900);
    expect(onCorrect).toHaveBeenCalledTimes(1);
    expect(onWrong).not.toHaveBeenCalled();
    cleanup();
  });

  it('prevents double-tap on same ghost (hitResult guard)', () => {
    const ghosts = makeGhosts(3);
    const { tapGhost, onWrong, cleanup } = makeTapEnv(ghosts);

    tapGhost(0); // wrong ghost — frozenRef locks idx 0
    tapGhost(0); // second tap on same ghost — should be blocked
    jest.advanceTimersByTime(0); // flush deferred onWrong
    expect(onWrong).toHaveBeenCalledTimes(1);
    cleanup();
  });

  it('allows tapping a different wrong ghost after first wrong tap', () => {
    const ghosts = makeGhosts(3);
    const { tapGhost, onWrong, cleanup } = makeTapEnv(ghosts);

    tapGhost(0); // wrong
    tapGhost(1); // different wrong ghost — should go through
    jest.advanceTimersByTime(0); // flush both deferred onWrong calls
    expect(onWrong).toHaveBeenCalledTimes(2);
    cleanup();
  });

  it('wrong ghost becomes tappable again after 700ms reset', () => {
    const ghosts = makeGhosts(3);
    const { tapGhost, onWrong, cleanup } = makeTapEnv(ghosts);

    tapGhost(0);
    jest.advanceTimersByTime(0);
    expect(onWrong).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(700);
    tapGhost(0); // should be tappable again
    jest.advanceTimersByTime(0);
    expect(onWrong).toHaveBeenCalledTimes(2);
    cleanup();
  });

  it('frozenRef is cleared on question reset — frozen ghost becomes tappable on next question', () => {
    const ghosts = makeGhosts(3);
    const { tapGhost, frozenRef, onWrong, reset, cleanup } = makeTapEnv(ghosts);

    tapGhost(0); // wrong ghost — frozenRef gets idx 0
    expect(frozenRef.current.has(0)).toBe(true);

    // Simulate question reset before the 700ms timer fires
    reset();

    expect(frozenRef.current.has(0)).toBe(false);
    tapGhost(0); // should be tappable on new question
    jest.advanceTimersByTime(0);
    expect(onWrong).toHaveBeenCalledTimes(2);
    cleanup();
  });

  it('doneRef and frozenRef both cleared on reset — correct tap allowed on next question', () => {
    const ghosts = makeGhosts(0);
    const { tapGhost, doneRef, frozenRef, onCorrect, reset, cleanup } = makeTapEnv(ghosts);

    tapGhost(0); // correct — sets doneRef
    expect(doneRef.current).toBe(true);

    reset();

    expect(doneRef.current).toBe(false);
    expect(frozenRef.current.size).toBe(0);

    tapGhost(0); // correct again after reset; first timer was cleared so only this one fires
    jest.advanceTimersByTime(900);
    expect(onCorrect).toHaveBeenCalledTimes(1);
    cleanup();
  });

  it('reset clears state even when new question has the same answer as the old one', () => {
    // Simulates question.text changing while question.answer stays the same (e.g. 3+4 → 5+2)
    // The reset dep is question.text so this must still produce a clean slate
    const ghosts = makeGhosts(0); // ghost 0 is correct
    const { tapGhost, doneRef, frozenRef, hitResults, reset, cleanup } = makeTapEnv(ghosts);

    tapGhost(0); // correct — locks game
    expect(doneRef.current).toBe(true);

    // New question arrives with same answer — reset fires because question.text changed
    reset();

    expect(doneRef.current).toBe(false);
    expect(frozenRef.current.size).toBe(0);
    expect(hitResults.every(r => r === 'none')).toBe(true);
    cleanup();
  });
});
