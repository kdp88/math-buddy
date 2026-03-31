/**
 * LoadingScreen — Component Tests
 */

import { render, act } from '@testing-library/react-native';
import LoadingScreen from '../LoadingScreen';

describe('<LoadingScreen />', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    act(() => jest.runOnlyPendingTimers());
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  test('renders the loading screen container', () => {
    const { getByTestId } = render(<LoadingScreen onComplete={jest.fn()} />);
    expect(getByTestId('loading-screen')).toBeTruthy();
  });

  test('renders the app title', () => {
    const { getByText } = render(<LoadingScreen onComplete={jest.fn()} />);
    expect(getByText('Math Buddy')).toBeTruthy();
  });

  test('calls onComplete after animation finishes', () => {
    const onComplete = jest.fn();
    render(<LoadingScreen onComplete={onComplete} />);
    expect(onComplete).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(2500)); // 2000ms progress + 200ms fade
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  test('does not call onComplete before animation ends', () => {
    const onComplete = jest.fn();
    render(<LoadingScreen onComplete={onComplete} />);
    act(() => jest.advanceTimersByTime(1000));
    expect(onComplete).not.toHaveBeenCalled();
  });
});
