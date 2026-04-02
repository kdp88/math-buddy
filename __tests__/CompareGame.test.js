/**
 * CompareGame — Unit & Component Tests
 */

import { render, fireEvent, act } from '@testing-library/react-native';

import CompareGame from '../CompareGame';

// ─── Question fixtures ─────────────────────────────────────────────────────────

const Q_LEFT_BIGGER  = { text: '7 ? 3', answer: '>', leftText: '7',  rightText: '3',  leftVal: 7, rightVal: 3 };
const Q_RIGHT_BIGGER = { text: '2 ? 9', answer: '<', leftText: '2',  rightText: '9',  leftVal: 2, rightVal: 9 };
const Q_EQUAL        = { text: '5 ? 5', answer: '=', leftText: '5',  rightText: '5',  leftVal: 5, rightVal: 5 };

function makeProps(overrides = {}) {
  return {
    question:  Q_LEFT_BIGGER,
    onCorrect: jest.fn(),
    onWrong:   jest.fn(),
    ...overrides,
  };
}

// ─── Component tests ───────────────────────────────────────────────────────────

describe('<CompareGame />', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    act(() => jest.runOnlyPendingTimers());
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  test('renders the compare container', () => {
    const { getByTestId } = render(<CompareGame {...makeProps()} />);
    expect(getByTestId('compare-container')).toBeTruthy();
  });

  test('renders < = > buttons', () => {
    const { getByTestId } = render(<CompareGame {...makeProps()} />);
    expect(getByTestId('compare-<')).toBeTruthy();
    expect(getByTestId('compare-=')).toBeTruthy();
    expect(getByTestId('compare->')).toBeTruthy();
  });

  test('tapping correct > calls onCorrect', () => {
    const props = makeProps(); // answer '>'
    const { getByTestId } = render(<CompareGame {...props} />);
    fireEvent.press(getByTestId('compare->'));
    act(() => jest.advanceTimersByTime(1000));
    expect(props.onCorrect).toHaveBeenCalledTimes(1);
    expect(props.onWrong).not.toHaveBeenCalled();
  });

  test('tapping wrong < calls onWrong', () => {
    const props = makeProps(); // answer '>', so < is wrong
    const { getByTestId } = render(<CompareGame {...props} />);
    fireEvent.press(getByTestId('compare-<'));
    act(() => jest.advanceTimersByTime(1000));
    expect(props.onWrong).toHaveBeenCalledTimes(1);
    expect(props.onCorrect).not.toHaveBeenCalled();
  });

  test('tapping wrong = calls onWrong', () => {
    const props = makeProps(); // answer '>'
    const { getByTestId } = render(<CompareGame {...props} />);
    fireEvent.press(getByTestId('compare-='));
    act(() => jest.advanceTimersByTime(1000));
    expect(props.onWrong).toHaveBeenCalledTimes(1);
  });

  test('right-bigger question: tapping < is correct', () => {
    const props = makeProps({ question: Q_RIGHT_BIGGER });
    const { getByTestId } = render(<CompareGame {...props} />);
    fireEvent.press(getByTestId('compare-<'));
    act(() => jest.advanceTimersByTime(1000));
    expect(props.onCorrect).toHaveBeenCalledTimes(1);
  });

  test('equal question: tapping = is correct', () => {
    const props = makeProps({ question: Q_EQUAL });
    const { getByTestId } = render(<CompareGame {...props} />);
    fireEvent.press(getByTestId('compare-='));
    act(() => jest.advanceTimersByTime(1000));
    expect(props.onCorrect).toHaveBeenCalledTimes(1);
  });

  test('double-tap does not fire twice', () => {
    const props = makeProps();
    const { getByTestId } = render(<CompareGame {...props} />);
    fireEvent.press(getByTestId('compare->'));
    fireEvent.press(getByTestId('compare->'));
    act(() => jest.advanceTimersByTime(1000));
    expect(props.onCorrect).toHaveBeenCalledTimes(1);
  });

  test('after wrong tap, re-enable allows another tap', () => {
    const props = makeProps();
    const { getByTestId } = render(<CompareGame {...props} />);
    fireEvent.press(getByTestId('compare-<')); // wrong
    act(() => jest.advanceTimersByTime(500));
    expect(props.onWrong).toHaveBeenCalledTimes(1);
    fireEvent.press(getByTestId('compare->'));
    act(() => jest.advanceTimersByTime(1000));
    expect(props.onCorrect).toHaveBeenCalledTimes(1);
  });

  test('new question resets disabled state', () => {
    const props = makeProps();
    const { getByTestId, rerender } = render(<CompareGame {...props} />);
    fireEvent.press(getByTestId('compare->'));
    act(() => jest.advanceTimersByTime(1000));
    expect(props.onCorrect).toHaveBeenCalledTimes(1);

    const props2 = makeProps({ question: Q_RIGHT_BIGGER });
    rerender(<CompareGame {...props2} />);
    fireEvent.press(getByTestId('compare-<'));
    act(() => jest.advanceTimersByTime(1000));
    expect(props2.onCorrect).toHaveBeenCalledTimes(1);
  });
});
