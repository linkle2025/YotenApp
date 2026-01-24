import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ErrorMessage from '../ErrorMessage';

describe('ErrorMessage Component', () => {
  test('renders error message', () => {
    render(<ErrorMessage message="エラーが発生しました" />);
    expect(screen.getByText('エラーが発生しました')).toBeInTheDocument();
  });

  test('displays retry button when onRetry is provided', () => {
    const onRetry = jest.fn();
    render(<ErrorMessage message="エラーが発生しました" onRetry={onRetry} />);
    const retryButton = screen.getByText('再試行');
    expect(retryButton).toBeInTheDocument();
  });

  test('calls onRetry when retry button is clicked', () => {
    const onRetry = jest.fn();
    render(<ErrorMessage message="エラーが発生しました" onRetry={onRetry} />);
    const retryButton = screen.getByText('再試行');
    fireEvent.click(retryButton);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  test('does not display retry button when onRetry is not provided', () => {
    render(<ErrorMessage message="エラーが発生しました" />);
    const retryButton = screen.queryByText('再試行');
    expect(retryButton).not.toBeInTheDocument();
  });
});

