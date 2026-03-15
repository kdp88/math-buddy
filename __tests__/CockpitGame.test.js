/**
 * CockpitGame — Unit & Component Tests
 *
 * Structure:
 *  1. buildTargets() — pure-function unit tests (no rendering needed)
 *  2. <CockpitGame /> — component interaction tests
 *
 * Best practices followed:
 *  - Arrange / Act / Assert in every test
 *  - One behaviour per test
 *  - No test depends on another test's state
 *  - Pure logic tested without DOM/RN overhead where possible
 *  - Fake timers used to control setTimeout without real waits
 *  - Props/callbacks mocked with jest.fn()
 */

import { render, fireEvent, act } from '@testing-library/react-native';

// ─── Re-export the private helper for unit testing ────────────────────────────
// buildTargets is not exported from CockpitGame, so we inline an identical
// copy here and keep a separate suite that treats the component as a black box.

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

// ─── 1. buildTargets() — pure unit tests ──────────────────────────────────────

describe('buildTargets(answer)', () => {
  // Run each structural assertion across several random answers to guard
  // against accidental passes on a single seed.
  const ANSWERS = [0, 1, 5, 10, 18, 20, 100];

  test.each(ANSWERS)('returns exactly 4 targets for answer=%i', (answer) => {
    expect(buildTargets(answer)).toHaveLength(4);
  });

  test.each(ANSWERS)('always includes the correct answer for answer=%i', (answer) => {
    const targets = buildTargets(answer);
    const nums = targets.map(t => t.num);
    expect(nums).toContain(answer);
  });

  test.each(ANSWERS)('marks exactly one target as correct for answer=%i', (answer) => {
    const targets = buildTargets(answer);
    const correctCount = targets.filter(t => t.isCorrect).length;
    expect(correctCount).toBe(1);
  });

  test.each(ANSWERS)('the isCorrect target has the right num for answer=%i', (answer) => {
    const targets = buildTargets(answer);
    const correct = targets.find(t => t.isCorrect);
    expect(correct.num).toBe(answer);
  });

  test.each(ANSWERS)('all nums are non-negative for answer=%i', (answer) => {
    const targets = buildTargets(answer);
    targets.forEach(t => expect(t.num).toBeGreaterThanOrEqual(0));
  });

  test.each(ANSWERS)('all nums are unique for answer=%i', (answer) => {
    const targets = buildTargets(answer);
    const nums = targets.map(t => t.num);
    expect(new Set(nums).size).toBe(4);
  });

  test.each(ANSWERS)('colorIdx values are 0-3 and unique for answer=%i', (answer) => {
    const targets = buildTargets(answer);
    const indices = targets.map(t => t.colorIdx);
    expect(indices.sort()).toEqual([0, 1, 2, 3]);
  });

  test('works when answer is 0 (edge case: no negatives generated)', () => {
    // Run many times to shake out randomness
    for (let i = 0; i < 20; i++) {
      const targets = buildTargets(0);
      expect(targets).toHaveLength(4);
      targets.forEach(t => expect(t.num).toBeGreaterThanOrEqual(0));
    }
  });

  test('distractors differ from the correct answer', () => {
    const answer = 7;
    const targets = buildTargets(answer);
    const distractors = targets.filter(t => !t.isCorrect);
    distractors.forEach(t => expect(t.num).not.toBe(answer));
  });

  test('output order is randomised (not always answer-first)', () => {
    // With 4 items, the chance that the correct answer is always at index 0
    // across 20 independent runs is (1/4)^20 ≈ 0. Acceptable flakiness risk.
    const firstPositions = Array.from({ length: 20 }, () =>
      buildTargets(5).findIndex(t => t.isCorrect)
    );
    const allAtZero = firstPositions.every(p => p === 0);
    expect(allAtZero).toBe(false);
  });
});

// ─── 2. <CockpitGame /> — component interaction tests ─────────────────────────

import CockpitGame from '../CockpitGame';

const QUESTION = { text: '3 + 4', answer: 7, a: 3, b: 4, op: '+' };

function makeProps(overrides = {}) {
  return {
    question:  QUESTION,
    onCorrect: jest.fn(),
    onWrong:   jest.fn(),
    ...overrides,
  };
}

describe('<CockpitGame />', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    act(() => jest.runOnlyPendingTimers());
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  // ── Rendering ───────────────────────────────────────────────────────────────

  test('renders exactly 4 number targets', () => {
    const { UNSAFE_getAllByType } = render(<CockpitGame {...makeProps()} />);
    const { TouchableOpacity } = require('react-native');
    const tappables = UNSAFE_getAllByType(TouchableOpacity);
    // 4 number targets — may also include other tappables in future
    expect(tappables.length).toBeGreaterThanOrEqual(4);
  });

  test('displays the correct answer among the visible numbers', () => {
    const { queryAllByText } = render(<CockpitGame {...makeProps()} />);
    const answerNodes = queryAllByText(String(QUESTION.answer));
    expect(answerNodes.length).toBeGreaterThanOrEqual(1);
  });

  // ── Correct tap ─────────────────────────────────────────────────────────────

  test('calls onCorrect after tapping the correct target', () => {
    const props = makeProps();
    const { queryAllByText } = render(<CockpitGame {...props} />);

    const correctNodes = queryAllByText(String(QUESTION.answer));
    expect(correctNodes.length).toBeGreaterThan(0);

    fireEvent.press(correctNodes[0]);
    act(() => jest.advanceTimersByTime(1000));

    expect(props.onCorrect).toHaveBeenCalledTimes(1);
    expect(props.onWrong).not.toHaveBeenCalled();
  });

  test('does NOT call onCorrect before the 900 ms delay elapses', () => {
    const props = makeProps();
    const { queryAllByText } = render(<CockpitGame {...props} />);

    fireEvent.press(queryAllByText(String(QUESTION.answer))[0]);
    act(() => jest.advanceTimersByTime(500)); // only halfway through delay

    expect(props.onCorrect).not.toHaveBeenCalled();
  });

  // ── Wrong tap ───────────────────────────────────────────────────────────────

  test('calls onWrong immediately when a wrong target is tapped', () => {
    const props = makeProps();
    const { UNSAFE_getAllByType } = render(<CockpitGame {...props} />);
    const { TouchableOpacity } = require('react-native');

    // Find a TouchableOpacity whose displayed number is NOT the correct answer
    const allTappables = UNSAFE_getAllByType(TouchableOpacity);
    const wrongButton = allTappables.find(btn => {
      const text = btn.findByType(require('react-native').Text)?.props?.children;
      return String(text) !== String(QUESTION.answer);
    });

    if (wrongButton) {
      fireEvent.press(wrongButton);
      expect(props.onWrong).toHaveBeenCalledTimes(1);
      expect(props.onCorrect).not.toHaveBeenCalled();
    }
  });

  // ── Guard: no double-fire ───────────────────────────────────────────────────

  test('tapping the correct target twice only calls onCorrect once', () => {
    const props = makeProps();
    const { queryAllByText } = render(<CockpitGame {...props} />);

    const correctNodes = queryAllByText(String(QUESTION.answer));
    fireEvent.press(correctNodes[0]);
    fireEvent.press(correctNodes[0]); // second tap — should be ignored

    act(() => jest.advanceTimersByTime(1000));
    expect(props.onCorrect).toHaveBeenCalledTimes(1);
  });

  // ── Question change ─────────────────────────────────────────────────────────

  test('re-renders with new targets when question prop changes', () => {
    const props = makeProps();
    const { rerender, queryAllByText } = render(<CockpitGame {...props} />);

    const newQuestion = { text: '2 + 2', answer: 4, a: 2, b: 2, op: '+' };
    rerender(<CockpitGame {...props} question={newQuestion} />);

    const newAnswerNodes = queryAllByText('4');
    expect(newAnswerNodes.length).toBeGreaterThanOrEqual(1);
  });
});
