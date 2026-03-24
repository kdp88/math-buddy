/**
 * SpaceshipGame — Unit & Component Tests
 *
 * Structure:
 *  1. buildChoices() — pure-function unit tests
 *  2. <SpaceshipGame /> — component interaction tests
 */

import { render, fireEvent, act } from '@testing-library/react-native';

import { buildAnswerChoices } from '../utils/buildAnswerChoices';

// Wrap with cx positioning for SpaceshipGame-specific pure tests
const SLOT = 100;
function buildChoices(correctAnswer) {
  return buildAnswerChoices(correctAnswer).map((c, i) => ({
    ...c,
    cx: SLOT * i + SLOT / 2,
  }));
}

// ─── 1. buildChoices() pure tests ─────────────────────────────────────────────

const ANSWERS = [0, 1, 5, 10, 18, 20, 100];

describe('buildChoices(answer)', () => {
  test.each(ANSWERS)('returns exactly 4 choices for answer=%i', (answer) => {
    expect(buildChoices(answer)).toHaveLength(4);
  });

  test.each(ANSWERS)('always includes the correct answer for answer=%i', (answer) => {
    const nums = buildChoices(answer).map(c => c.num);
    expect(nums).toContain(answer);
  });

  test.each(ANSWERS)('marks exactly one choice as correct for answer=%i', (answer) => {
    const count = buildChoices(answer).filter(c => c.isCorrect).length;
    expect(count).toBe(1);
  });

  test.each(ANSWERS)('all nums are non-negative for answer=%i', (answer) => {
    buildChoices(answer).forEach(c => expect(c.num).toBeGreaterThanOrEqual(0));
  });

  test.each(ANSWERS)('all nums are unique for answer=%i', (answer) => {
    const nums = buildChoices(answer).map(c => c.num);
    expect(new Set(nums).size).toBe(4);
  });

  test.each(ANSWERS)('the isCorrect choice has the right num for answer=%i', (answer) => {
    const correct = buildChoices(answer).find(c => c.isCorrect);
    expect(correct.num).toBe(answer);
  });

  test('each choice has a cx position', () => {
    buildChoices(5).forEach(c => expect(typeof c.cx).toBe('number'));
  });

  test('works for answer=0 (no negatives)', () => {
    for (let i = 0; i < 20; i++) {
      buildChoices(0).forEach(c => expect(c.num).toBeGreaterThanOrEqual(0));
    }
  });

  test('output order is randomised (not always answer-first)', () => {
    const positions = Array.from({ length: 20 }, () =>
      buildChoices(5).findIndex(c => c.isCorrect)
    );
    expect(positions.every(p => p === 0)).toBe(false);
  });
});

// ─── 2. <SpaceshipGame /> component tests ─────────────────────────────────────

import SpaceshipGame from '../SpaceshipGame';

const QUESTION = { text: '3 + 4', answer: 7, a: 3, b: 4, op: '+' };

function makeProps(overrides = {}) {
  return {
    question:  QUESTION,
    onCorrect: jest.fn(),
    onWrong:   jest.fn(),
    ...overrides,
  };
}

describe('<SpaceshipGame />', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    act(() => jest.runOnlyPendingTimers());
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  test('displays the correct answer among the asteroid numbers', () => {
    const { queryAllByText } = render(<SpaceshipGame {...makeProps()} />);
    expect(queryAllByText(String(QUESTION.answer)).length).toBeGreaterThanOrEqual(1);
  });

  test('renders 4 asteroid targets', () => {
    const { getAllByTestId } = render(<SpaceshipGame {...makeProps()} />);
    expect(getAllByTestId(/^spaceship-asteroid-\d+$/)).toHaveLength(4);
  });

  test('tapping the correct asteroid eventually calls onCorrect', () => {
    const props = makeProps();
    const { queryAllByText } = render(<SpaceshipGame {...props} />);
    const nodes = queryAllByText(String(QUESTION.answer));
    expect(nodes.length).toBeGreaterThan(0);
    fireEvent.press(nodes[0]);
    act(() => jest.advanceTimersByTime(2000));
    expect(props.onCorrect).toHaveBeenCalledTimes(1);
    expect(props.onWrong).not.toHaveBeenCalled();
  });

  test('tapping a wrong asteroid eventually calls onWrong', () => {
    const props = makeProps();
    const { getAllByTestId } = render(<SpaceshipGame {...props} />);
    const asteroids = getAllByTestId(/^spaceship-asteroid-\d+$/);
    const wrongBtn = asteroids.find(btn => btn.props.testID !== `spaceship-asteroid-${QUESTION.answer}`);
    expect(wrongBtn).toBeTruthy();
    fireEvent.press(wrongBtn);
    act(() => jest.advanceTimersByTime(2000));
    expect(props.onWrong).toHaveBeenCalledTimes(1);
    expect(props.onCorrect).not.toHaveBeenCalled();
  });

  test('re-renders with new targets when question changes', () => {
    const props = makeProps();
    const { rerender, queryAllByText } = render(<SpaceshipGame {...props} />);
    const newQ = { text: '2 + 2', answer: 4, a: 2, b: 2, op: '+' };
    rerender(<SpaceshipGame {...props} question={newQ} />);
    expect(queryAllByText('4').length).toBeGreaterThanOrEqual(1);
  });
});
