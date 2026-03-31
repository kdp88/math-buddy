/**
 * CompareGame — Unit & Component Tests
 *
 * Structure:
 *  1. generateComparisonQuestion() — pure-function unit tests
 *  2. <CompareGame /> — component interaction tests for each mechanic
 */

import { render, fireEvent, act } from '@testing-library/react-native';
import CompareGame from '../CompareGame';

// ─── 1. generateComparisonQuestion() pure tests ────────────────────────────────
// Inline copy — no App.js import needed

const DIFFICULTY_MAX = { easy: 5, medium: 10, hard: 20 };
const DIFFICULTY_MUL = { easy: 5, medium: 10, hard: 12 };
const DEFAULT_SETTINGS = { ops: ['+', '-'], difficulty: 'medium', mode: 'compare', playerName: '' };

function makeSide(ops, difficulty) {
  const max = DIFFICULTY_MAX[difficulty];
  const mul = DIFFICULTY_MUL[difficulty];
  if (difficulty === 'easy') {
    const n = Math.floor(Math.random() * max) + 1;
    return { text: String(n), val: n };
  }
  const op = ops[Math.floor(Math.random() * ops.length)];
  if (op === '+') {
    const a = Math.floor(Math.random() * max) + 1;
    const b = Math.floor(Math.random() * max) + 1;
    return { text: `${a} + ${b}`, val: a + b };
  }
  if (op === '-') {
    const a = Math.floor(Math.random() * max) + 1;
    const b = Math.floor(Math.random() * max) + 1;
    const big = Math.max(a, b), small = Math.min(a, b);
    return { text: `${big} - ${small}`, val: big - small };
  }
  if (op === '×') {
    const a = Math.floor(Math.random() * mul) + 1;
    const b = Math.floor(Math.random() * mul) + 1;
    return { text: `${a} × ${b}`, val: a * b };
  }
  const b = Math.floor(Math.random() * mul) + 1;
  const ans = Math.floor(Math.random() * mul) + 1;
  return { text: `${b * ans} ÷ ${b}`, val: ans };
}

function generateComparisonQuestion(settings = DEFAULT_SETTINGS) {
  const { ops, difficulty } = settings;
  let left, right;
  do { left = makeSide(ops, difficulty); right = makeSide(ops, difficulty); }
  while (left.val === right.val);
  return {
    text:      `${left.text} ? ${right.text}`,
    answer:    left.val > right.val ? '>' : '<',
    leftText:  left.text,
    rightText: right.text,
    leftVal:   left.val,
    rightVal:  right.val,
  };
}

describe('generateComparisonQuestion()', () => {
  const RUNS = 50;

  test('answer is always < or >', () => {
    for (let i = 0; i < RUNS; i++) {
      const q = generateComparisonQuestion();
      expect(['<', '>']).toContain(q.answer);
    }
  });

  test('answer matches actual comparison of leftVal and rightVal', () => {
    for (let i = 0; i < RUNS; i++) {
      const q = generateComparisonQuestion();
      const expected = q.leftVal > q.rightVal ? '>' : '<';
      expect(q.answer).toBe(expected);
    }
  });

  test('leftVal never equals rightVal', () => {
    for (let i = 0; i < RUNS; i++) {
      const q = generateComparisonQuestion();
      expect(q.leftVal).not.toBe(q.rightVal);
    }
  });

  test('easy mode: leftText and rightText are plain number strings', () => {
    const settings = { ...DEFAULT_SETTINGS, difficulty: 'easy' };
    for (let i = 0; i < RUNS; i++) {
      const q = generateComparisonQuestion(settings);
      expect(Number.isInteger(Number(q.leftText))).toBe(true);
      expect(Number.isInteger(Number(q.rightText))).toBe(true);
    }
  });

  test('easy mode: values stay within 1-5 range', () => {
    const settings = { ...DEFAULT_SETTINGS, difficulty: 'easy' };
    for (let i = 0; i < RUNS; i++) {
      const q = generateComparisonQuestion(settings);
      expect(q.leftVal).toBeGreaterThanOrEqual(1);
      expect(q.leftVal).toBeLessThanOrEqual(5);
      expect(q.rightVal).toBeGreaterThanOrEqual(1);
      expect(q.rightVal).toBeLessThanOrEqual(5);
    }
  });

  test('text includes ? separator', () => {
    const q = generateComparisonQuestion();
    expect(q.text).toContain('?');
  });

  test('has all required fields', () => {
    const q = generateComparisonQuestion();
    expect(q).toHaveProperty('text');
    expect(q).toHaveProperty('answer');
    expect(q).toHaveProperty('leftText');
    expect(q).toHaveProperty('rightText');
    expect(q).toHaveProperty('leftVal');
    expect(q).toHaveProperty('rightVal');
  });
});

// ─── 2. <CompareGame /> component tests ───────────────────────────────────────

// Question fixtures with known answers
const Q_LEFT_BIGGER  = { text: '7 ? 3', answer: '>', leftText: '7', rightText: '3', leftVal: 7, rightVal: 3 };
const Q_RIGHT_BIGGER = { text: '2 ? 9', answer: '<', leftText: '2', rightText: '9', leftVal: 2, rightVal: 9 };

function makeProps(overrides = {}) {
  return {
    question:  Q_LEFT_BIGGER,
    onCorrect: jest.fn(),
    onWrong:   jest.fn(),
    ...overrides,
  };
}

// Force a specific mechanic by controlling Math.random
function forceMechanic(mechanic) {
  const idx = { croc: 0, scale: 1, archery: 2 }[mechanic];
  // MECHANICS[Math.floor(random * 3)] === mechanic when random = idx/3
  jest.spyOn(Math, 'random').mockReturnValueOnce(idx / 3 + 0.01);
}

describe('<CompareGame />', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    act(() => jest.runOnlyPendingTimers());
    jest.useRealTimers();
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  test('renders the compare container', () => {
    const { getByTestId } = render(<CompareGame {...makeProps()} />);
    expect(getByTestId('compare-container')).toBeTruthy();
  });

  test('shows left and right values', () => {
    const { queryAllByText } = render(<CompareGame {...makeProps()} />);
    expect(queryAllByText('7').length).toBeGreaterThanOrEqual(1);
    expect(queryAllByText('3').length).toBeGreaterThanOrEqual(1);
  });

  // ── Croc mechanic ──

  describe('croc mechanic', () => {
    function renderCroc(props = {}) {
      forceMechanic('croc');
      return render(<CompareGame {...makeProps(props)} />);
    }

    test('renders croc section', () => {
      const { getByTestId } = renderCroc();
      expect(getByTestId('compare-croc')).toBeTruthy();
    });

    test('tapping correct (bigger) side calls onCorrect', () => {
      const props = makeProps(); // Q_LEFT_BIGGER: answer '>', left is bigger
      forceMechanic('croc');
      const { getByTestId } = render(<CompareGame {...props} />);
      fireEvent.press(getByTestId('compare-left'));
      act(() => jest.advanceTimersByTime(1500));
      expect(props.onCorrect).toHaveBeenCalledTimes(1);
      expect(props.onWrong).not.toHaveBeenCalled();
    });

    test('tapping wrong side calls onWrong', () => {
      const props = makeProps(); // left is bigger, so tapping right is wrong
      forceMechanic('croc');
      const { getByTestId } = render(<CompareGame {...props} />);
      fireEvent.press(getByTestId('compare-right'));
      act(() => jest.advanceTimersByTime(1500));
      expect(props.onWrong).toHaveBeenCalledTimes(1);
      expect(props.onCorrect).not.toHaveBeenCalled();
    });

    test('double-tap does not fire twice', () => {
      const props = makeProps();
      forceMechanic('croc');
      const { getByTestId } = render(<CompareGame {...props} />);
      fireEvent.press(getByTestId('compare-left'));
      fireEvent.press(getByTestId('compare-left'));
      act(() => jest.advanceTimersByTime(1500));
      expect(props.onCorrect).toHaveBeenCalledTimes(1);
    });
  });

  // ── Scale mechanic ──

  describe('scale mechanic', () => {
    function renderScale(props = {}) {
      forceMechanic('scale');
      return render(<CompareGame {...makeProps(props)} />);
    }

    test('renders scale section', () => {
      const { getByTestId } = renderScale();
      expect(getByTestId('compare-scale')).toBeTruthy();
    });

    test('tapping correct (heavier) side calls onCorrect', () => {
      const props = makeProps(); // left is bigger
      forceMechanic('scale');
      const { getByTestId } = render(<CompareGame {...props} />);
      fireEvent.press(getByTestId('compare-left'));
      act(() => jest.advanceTimersByTime(1500));
      expect(props.onCorrect).toHaveBeenCalledTimes(1);
    });

    test('tapping lighter side calls onWrong', () => {
      const props = makeProps();
      forceMechanic('scale');
      const { getByTestId } = render(<CompareGame {...props} />);
      fireEvent.press(getByTestId('compare-right'));
      act(() => jest.advanceTimersByTime(1500));
      expect(props.onWrong).toHaveBeenCalledTimes(1);
    });
  });

  // ── Archery mechanic ──

  describe('archery mechanic', () => {
    function renderArchery(props = {}) {
      forceMechanic('archery');
      return render(<CompareGame {...makeProps(props)} />);
    }

    test('renders archery section', () => {
      const { getByTestId } = renderArchery();
      expect(getByTestId('compare-archery')).toBeTruthy();
    });

    test('tapping correct symbol calls onCorrect', () => {
      const props = makeProps(); // answer '>'
      forceMechanic('archery');
      const { getByTestId } = render(<CompareGame {...props} />);
      fireEvent.press(getByTestId('compare-greater')); // tap '>'
      act(() => jest.advanceTimersByTime(1000));
      expect(props.onCorrect).toHaveBeenCalledTimes(1);
      expect(props.onWrong).not.toHaveBeenCalled();
    });

    test('tapping wrong symbol calls onWrong', () => {
      const props = makeProps(); // answer '>', tapping '<' is wrong
      forceMechanic('archery');
      const { getByTestId } = render(<CompareGame {...props} />);
      fireEvent.press(getByTestId('compare-less'));
      act(() => jest.advanceTimersByTime(1000));
      expect(props.onWrong).toHaveBeenCalledTimes(1);
      expect(props.onCorrect).not.toHaveBeenCalled();
    });

    test('right-bigger question: tapping < is correct', () => {
      const props = makeProps({ question: Q_RIGHT_BIGGER }); // answer '<'
      forceMechanic('archery');
      const { getByTestId } = render(<CompareGame {...props} />);
      fireEvent.press(getByTestId('compare-less'));
      act(() => jest.advanceTimersByTime(1000));
      expect(props.onCorrect).toHaveBeenCalledTimes(1);
    });
  });

  // ── Mechanic rotation ──

  test('new question prop causes mechanic to rotate', () => {
    forceMechanic('croc');
    const props = makeProps();
    const { getByTestId, rerender, queryByTestId } = render(<CompareGame {...props} />);
    expect(getByTestId('compare-croc')).toBeTruthy();

    // New question arrives (simulate correct → App sends new question)
    rerender(<CompareGame {...props} question={Q_RIGHT_BIGGER} />);
    // Mechanic should have changed (no longer croc, or croc with different content)
    // We can't know which mechanic, but compare-container is still present
    expect(getByTestId('compare-container')).toBeTruthy();
    expect(queryByTestId('compare-croc')).toBeNull();
  });
});
