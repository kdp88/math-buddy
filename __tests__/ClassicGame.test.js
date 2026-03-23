/**
 * ClassicGame — Unit & Component Tests
 *
 * Structure:
 *  1. <ClassicGame /> rendering
 *  2. Number pad input behaviour
 *  3. Correct answer flow
 *  4. Wrong answer flow
 *  5. Edge cases
 */

import { render, fireEvent } from '@testing-library/react-native';
import ClassicGame from '../ClassicGame';

const QUESTION = { text: '3 + 4', answer: 7, a: 3, b: 4, op: '+' };

function makeProps(overrides = {}) {
  return {
    question:  QUESTION,
    onCorrect: jest.fn(),
    onWrong:   jest.fn(),
    ...overrides,
  };
}

// Helper — press number pad keys in sequence
function typeDigits(getByText, ...digits) {
  digits.forEach(d => fireEvent.press(getByText(String(d))));
}

// ─── 1. Rendering ─────────────────────────────────────────────────────────────

describe('<ClassicGame /> rendering', () => {
  test('renders the Check Answer button', () => {
    const { getByText } = render(<ClassicGame {...makeProps()} />);
    expect(getByText('Check Answer')).toBeTruthy();
  });

  test('renders all 10 digit keys (0-9)', () => {
    const { getByText } = render(<ClassicGame {...makeProps()} />);
    for (let d = 0; d <= 9; d++) {
      expect(getByText(String(d))).toBeTruthy();
    }
  });

  test('renders the delete key', () => {
    const { getByText } = render(<ClassicGame {...makeProps()} />);
    expect(getByText('⌫')).toBeTruthy();
  });
});

// ─── 2. Number pad input ──────────────────────────────────────────────────────

describe('<ClassicGame /> number pad input', () => {
  test('pressing a digit shows it in the answer box (two occurrences: pad + answer)', () => {
    // '5' appears once as a pad key. After pressing it, it also appears in the
    // answer box, so queryAllByText should find at least 2 nodes.
    const { getByText, queryAllByText } = render(<ClassicGame {...makeProps()} />);
    const before = queryAllByText('5').length;
    fireEvent.press(getByText('5'));
    expect(queryAllByText('5').length).toBeGreaterThan(before);
  });

  test('pressing multiple digits concatenates them', () => {
    const { getByText, queryByText } = render(<ClassicGame {...makeProps()} />);
    typeDigits(getByText, 1, 2);
    // '12' only appears in the answer box — not in the pad — so this is unambiguous
    expect(queryByText('12')).toBeTruthy();
  });

  test('delete removes the last digit', () => {
    const { getByText, queryByText } = render(<ClassicGame {...makeProps()} />);
    typeDigits(getByText, 1, 2);
    fireEvent.press(getByText('⌫'));
    expect(queryByText('12')).toBeNull();
    // '1' is still a pad key, so just verify '12' is gone
  });

  test('delete on empty input does nothing', () => {
    // Should not throw
    const { getByText } = render(<ClassicGame {...makeProps()} />);
    fireEvent.press(getByText('⌫'));
  });

  test('input is capped at 4 digits', () => {
    const { getByText } = render(<ClassicGame {...makeProps()} />);
    typeDigits(getByText, 1, 2, 3, 4, 5);
    expect(getByText('1234')).toBeTruthy();
  });
});

// ─── 3. Correct answer ────────────────────────────────────────────────────────

describe('<ClassicGame /> correct answer flow', () => {
  test('calls onCorrect when the right answer is submitted', () => {
    const props = makeProps();
    const { getByText } = render(<ClassicGame {...props} />);
    typeDigits(getByText, 7);
    fireEvent.press(getByText('Check Answer'));
    expect(props.onCorrect).toHaveBeenCalledTimes(1);
    expect(props.onWrong).not.toHaveBeenCalled();
  });

  test('does not call onWrong when correct answer submitted', () => {
    const props = makeProps();
    const { getByText } = render(<ClassicGame {...props} />);
    typeDigits(getByText, 7);
    fireEvent.press(getByText('Check Answer'));
    expect(props.onWrong).not.toHaveBeenCalled();
  });
});

// ─── 4. Wrong answer ──────────────────────────────────────────────────────────

describe('<ClassicGame /> wrong answer flow', () => {
  test('calls onWrong when the wrong answer is submitted', () => {
    const props = makeProps();
    const { getByText } = render(<ClassicGame {...props} />);
    typeDigits(getByText, 3);
    fireEvent.press(getByText('Check Answer'));
    expect(props.onWrong).toHaveBeenCalledTimes(1);
    expect(props.onCorrect).not.toHaveBeenCalled();
  });

  test('clears input after a wrong submission so player can retry', () => {
    const props = makeProps();
    const { getByText, queryAllByText } = render(<ClassicGame {...props} />);
    // Before typing: '3' only in pad (count=1)
    const before = queryAllByText('3').length;
    typeDigits(getByText, 3); // now also in answer box (count=2)
    fireEvent.press(getByText('Check Answer'));
    // After wrong submit, input cleared — back to pad-only count
    expect(queryAllByText('3').length).toBe(before);
  });
});

// ─── 5. Edge cases ────────────────────────────────────────────────────────────

describe('<ClassicGame /> edge cases', () => {
  test('Check Answer does nothing when input is empty', () => {
    const props = makeProps();
    const { getByText } = render(<ClassicGame {...props} />);
    fireEvent.press(getByText('Check Answer'));
    expect(props.onCorrect).not.toHaveBeenCalled();
    expect(props.onWrong).not.toHaveBeenCalled();
  });

  test('resets input when the question prop changes', () => {
    const props = makeProps();
    const { getByText, queryAllByText, rerender } = render(<ClassicGame {...props} />);
    const before = queryAllByText('7').length; // pad-only baseline
    typeDigits(getByText, 7); // now also in answer box
    expect(queryAllByText('7').length).toBeGreaterThan(before);
    const newQ = { text: '2 + 2', answer: 4, a: 2, b: 2, op: '+' };
    rerender(<ClassicGame {...props} question={newQ} />);
    // After question change, input cleared — back to pad-only count
    expect(queryAllByText('7').length).toBe(before);
  });

  test('two-digit correct answer works', () => {
    const props = makeProps({ question: { text: '8 + 5', answer: 13, a: 8, b: 5, op: '+' } });
    const { getByText } = render(<ClassicGame {...props} />);
    typeDigits(getByText, 1, 3);
    fireEvent.press(getByText('Check Answer'));
    expect(props.onCorrect).toHaveBeenCalledTimes(1);
  });

  test('subtraction question: correct answer calls onCorrect', () => {
    const props = makeProps({ question: { text: '9 - 4', answer: 5, a: 9, b: 4, op: '-' } });
    const { getByText } = render(<ClassicGame {...props} />);
    typeDigits(getByText, 5);
    fireEvent.press(getByText('Check Answer'));
    expect(props.onCorrect).toHaveBeenCalledTimes(1);
  });
});
