import React from 'react';
import { render, screen } from '@testing-library/react';
import Loading from '../Loading';

describe('Loading Component', () => {
  test('renders default loading message', () => {
    render(<Loading />);
    expect(screen.getByText('読み込み中...')).toBeInTheDocument();
  });

  test('renders custom loading message', () => {
    render(<Loading message="データを取得中..." />);
    expect(screen.getByText('データを取得中...')).toBeInTheDocument();
  });

  test('displays loading spinner', () => {
    const { container } = render(<Loading />);
    const spinner = container.querySelector('.loading-spinner');
    expect(spinner).toBeInTheDocument();
  });
});

