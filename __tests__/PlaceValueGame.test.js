/**
 * PlaceValueGame — Pure Function Unit Tests
 *
 * We test the two pure helpers that contain all the game logic:
 *
 *  1. generatePlaceValueQuestion(settings) — produces a question with repA
 *     (standard decomposition) and repB (correct alt or wrong).
 *
 *  2. tapCard / tapBothCorrect logic — guard conditions, correct vs wrong
 *     branch selection, and double-tap prevention.
 */

// ─── Inline copy of generatePlaceValueQuestion ───────────────────────────────

const PV_DIFFICULTY_MAX = { easy: 19, medium: 99, hard: 199 };
const PV_DIFFICULTY_MIN = 11;

function generatePlaceValueQuestion(settings = { difficulty: 'medium' }) {
  const max = PV_DIFFICULTY_MAX[settings.difficulty];
  const N   = Math.floor(Math.random() * (max - PV_DIFFICULTY_MIN + 1)) + PV_DIFFICULTY_MIN;

  const standardTens = Math.floor(N / 10);
  const standardOnes = N % 10;
  const repA = { tens: standardTens, ones: standardOnes };

  const bothCorrect = Math.random() < 0.5;
  let repB;

  if (bothCorrect) {
    // Pick t in [0, standardTens-1]; ones = N - t*10
    const t = Math.floor(Math.random() * standardTens); // 0 … standardTens-1
    repB = { tens: t, ones: N - t * 10 };
  } else {
    // Generate a wrong decomposition: shift N by 1–5, use standard breakdown
    let wrongN;
    let tries = 0;
    do {
      const delta = (Math.floor(Math.random() * 5) + 1) * (Math.random() < 0.5 ? 1 : -1);
      wrongN = N + delta;
      tries++;
    } while ((wrongN < PV_DIFFICULTY_MIN || wrongN > max + 10) && tries < 20);
    if (wrongN < PV_DIFFICULTY_MIN) wrongN = N + 1;
    repB = { tens: Math.floor(wrongN / 10), ones: wrongN % 10 };
  }

  return {
    text: `pv:${N}:${Date.now()}`,
    answer: N,
    repA,
    repB,
    bothCorrect,
  };
}

// ─── tapCard / tapBothCorrect logic ──────────────────────────────────────────

// correctPos: which card index holds the correct representation (0 or 1)
function makeTapEnv(bothCorrect, correctPos = 0) {
  const doneRef    = { current: false };
  const frozenRef  = { current: new Set() };
  const hitResults = ['none', 'none'];
  const onCorrect  = jest.fn();
  const onWrong    = jest.fn();
  const timers     = new Map();

  function tapCard(idx) {
    if (doneRef.current || frozenRef.current.has(idx)) return;
    frozenRef.current.add(idx);

    const isCorrect = bothCorrect || idx === correctPos;

    if (isCorrect) {
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

  return { tapCard, doneRef, frozenRef, hitResults, onCorrect, onWrong, reset, cleanup };
}

// ─── generatePlaceValueQuestion ──────────────────────────────────────────────

describe('generatePlaceValueQuestion', () => {
  it('returns the required fields', () => {
    const q = generatePlaceValueQuestion({ difficulty: 'medium' });
    expect(q).toHaveProperty('text');
    expect(q).toHaveProperty('answer');
    expect(q).toHaveProperty('repA');
    expect(q).toHaveProperty('repB');
    expect(q).toHaveProperty('bothCorrect');
  });

  it('repA is always the standard decomposition', () => {
    for (let i = 0; i < 50; i++) {
      const q = generatePlaceValueQuestion({ difficulty: 'medium' });
      const N = q.answer;
      expect(q.repA.tens).toBe(Math.floor(N / 10));
      expect(q.repA.ones).toBe(N % 10);
    }
  });

  it('repB is a valid decomposition when bothCorrect=true', () => {
    // Run enough times to hit bothCorrect=true cases
    let checked = 0;
    for (let i = 0; i < 200; i++) {
      const q = generatePlaceValueQuestion({ difficulty: 'medium' });
      if (!q.bothCorrect) continue;
      expect(q.repB.tens * 10 + q.repB.ones).toBe(q.answer);
      expect(q.repB.tens).not.toBe(q.repA.tens); // must be a different decomposition
      checked++;
      if (checked >= 20) break;
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('repB does NOT equal the answer when bothCorrect=false', () => {
    let checked = 0;
    for (let i = 0; i < 200; i++) {
      const q = generatePlaceValueQuestion({ difficulty: 'medium' });
      if (q.bothCorrect) continue;
      expect(q.repB.tens * 10 + q.repB.ones).not.toBe(q.answer);
      checked++;
      if (checked >= 20) break;
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('easy: answer is in 11–19', () => {
    for (let i = 0; i < 30; i++) {
      const q = generatePlaceValueQuestion({ difficulty: 'easy' });
      expect(q.answer).toBeGreaterThanOrEqual(11);
      expect(q.answer).toBeLessThanOrEqual(19);
    }
  });

  it('medium: answer is in 11–99', () => {
    for (let i = 0; i < 30; i++) {
      const q = generatePlaceValueQuestion({ difficulty: 'medium' });
      expect(q.answer).toBeGreaterThanOrEqual(11);
      expect(q.answer).toBeLessThanOrEqual(99);
    }
  });

  it('hard: answer is in 11–199', () => {
    for (let i = 0; i < 30; i++) {
      const q = generatePlaceValueQuestion({ difficulty: 'hard' });
      expect(q.answer).toBeGreaterThanOrEqual(11);
      expect(q.answer).toBeLessThanOrEqual(199);
    }
  });

  it('text always starts with "pv:"', () => {
    const q = generatePlaceValueQuestion({ difficulty: 'easy' });
    expect(q.text).toMatch(/^pv:/);
  });

  it('repB always has non-negative tens and ones', () => {
    for (let i = 0; i < 100; i++) {
      const q = generatePlaceValueQuestion({ difficulty: 'easy' });
      expect(q.repB.tens).toBeGreaterThanOrEqual(0);
      expect(q.repB.ones).toBeGreaterThanOrEqual(0);
    }
  });

  it('produces different bothCorrect values across many calls (random alternates)', () => {
    const values = Array.from({ length: 40 }, () =>
      generatePlaceValueQuestion({ difficulty: 'medium' }).bothCorrect
    );
    const unique = new Set(values);
    expect(unique.size).toBe(2); // should see both true and false
  });
});

// ─── tapCard logic ────────────────────────────────────────────────────────────

describe('tapCard logic', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  // correctPos=0 means card 0 is correct; card 1 is wrong
  it('tapping the correct card calls onCorrect after 900ms', () => {
    const { tapCard, onCorrect, cleanup } = makeTapEnv(false, 0);
    tapCard(0);
    expect(onCorrect).not.toHaveBeenCalled();
    jest.advanceTimersByTime(900);
    expect(onCorrect).toHaveBeenCalledTimes(1);
    cleanup();
  });

  it('tapping the correct card sets hitResult to "correct"', () => {
    const { tapCard, hitResults, cleanup } = makeTapEnv(false, 0);
    tapCard(0);
    expect(hitResults[0]).toBe('correct');
    cleanup();
  });

  it('tapping the correct card sets doneRef', () => {
    const { tapCard, doneRef, cleanup } = makeTapEnv(false, 0);
    tapCard(0);
    expect(doneRef.current).toBe(true);
    cleanup();
  });

  it('tapping the wrong card calls onWrong (deferred)', () => {
    const { tapCard, onWrong, cleanup } = makeTapEnv(false, 0);
    tapCard(1); // card 1 is wrong when correctPos=0
    expect(onWrong).not.toHaveBeenCalled();
    jest.advanceTimersByTime(0);
    expect(onWrong).toHaveBeenCalledTimes(1);
    cleanup();
  });

  it('correct card works at position 1 too', () => {
    const { tapCard, onCorrect, cleanup } = makeTapEnv(false, 1);
    tapCard(1);
    jest.advanceTimersByTime(900);
    expect(onCorrect).toHaveBeenCalledTimes(1);
    cleanup();
  });

  it('tapping either card when bothCorrect=true calls onCorrect', () => {
    const { tapCard, onCorrect, cleanup } = makeTapEnv(true, 0);
    tapCard(1); // either card is correct
    jest.advanceTimersByTime(900);
    expect(onCorrect).toHaveBeenCalledTimes(1);
    cleanup();
  });

  it('hitResult resets to "none" after 700ms (wrong tap)', () => {
    const { tapCard, hitResults, cleanup } = makeTapEnv(false, 0);
    tapCard(1); // wrong tap
    expect(hitResults[1]).toBe('wrong');
    jest.advanceTimersByTime(700);
    expect(hitResults[1]).toBe('none');
    cleanup();
  });

  it('doneRef prevents further taps', () => {
    const { tapCard, onCorrect, onWrong, cleanup } = makeTapEnv(false, 0);
    tapCard(0); // correct — locks game
    tapCard(1); // should be ignored
    jest.advanceTimersByTime(900);
    expect(onCorrect).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(0);
    expect(onWrong).not.toHaveBeenCalled();
    cleanup();
  });

  it('frozenRef prevents double-tap on same card', () => {
    const { tapCard, onWrong, cleanup } = makeTapEnv(false, 0);
    tapCard(1); // wrong tap — frozenRef locks card 1
    tapCard(1); // second tap — blocked
    jest.advanceTimersByTime(0);
    expect(onWrong).toHaveBeenCalledTimes(1);
    cleanup();
  });

  it('card becomes tappable again after 700ms', () => {
    const { tapCard, onWrong, cleanup } = makeTapEnv(false, 0);
    tapCard(1); // wrong tap
    jest.advanceTimersByTime(0);
    expect(onWrong).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(700);
    tapCard(1); // should be tappable again
    jest.advanceTimersByTime(0);
    expect(onWrong).toHaveBeenCalledTimes(2);
    cleanup();
  });
});


// ─── reset logic ──────────────────────────────────────────────────────────────

describe('reset logic', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('reset clears doneRef and frozenRef', () => {
    const { tapCard, doneRef, frozenRef, reset, cleanup } = makeTapEnv(false, 0);
    tapCard(0); // correct tap — sets doneRef
    expect(doneRef.current).toBe(true);
    reset();
    expect(doneRef.current).toBe(false);
    expect(frozenRef.current.size).toBe(0);
    cleanup();
  });

  it('reset clears hitResults', () => {
    const { tapCard, hitResults, reset, cleanup } = makeTapEnv(false, 0);
    tapCard(1); // wrong tap
    expect(hitResults[1]).toBe('wrong');
    reset();
    expect(hitResults.every(r => r === 'none')).toBe(true);
    cleanup();
  });

  it('reset clears pending timers — onCorrect not called after reset', () => {
    const { tapCard, onCorrect, reset, cleanup } = makeTapEnv(false, 0);
    tapCard(0); // correct tap — starts 900ms timer
    reset();
    jest.advanceTimersByTime(900);
    expect(onCorrect).not.toHaveBeenCalled();
    cleanup();
  });

  it('allows correct answer on next question after reset', () => {
    const { tapCard, onCorrect, reset, cleanup } = makeTapEnv(false, 0);
    tapCard(0); // correct
    reset();
    tapCard(0); // correct again on new question
    jest.advanceTimersByTime(900);
    expect(onCorrect).toHaveBeenCalledTimes(1); // first timer was cleared
    cleanup();
  });
});
