import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Header from '../Header';
import { AuthContext } from '../../context/AuthContext';

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

describe('Header Component', () => {
  const mockLogout = jest.fn();

  const renderWithAuth = (user = null) => {
    return render(
      <BrowserRouter>
        <AuthContext.Provider value={{ user, logout: mockLogout }}>
          <Header />
        </AuthContext.Provider>
      </BrowserRouter>
    );
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('renders app title', () => {
    renderWithAuth();
    expect(screen.getByText('四柱推命アプリ')).toBeInTheDocument();
  });

  test('displays login and register links when user is not logged in', () => {
    renderWithAuth(null);
    expect(screen.getByText('ログイン')).toBeInTheDocument();
    expect(screen.getByText('登録')).toBeInTheDocument();
  });

  test('displays user info and logout button when user is logged in', () => {
    const mockUser = { username: 'testuser', email: 'test@example.com' };
    renderWithAuth(mockUser);
    expect(screen.getByText('testuser')).toBeInTheDocument();
    expect(screen.getByText('ログアウト')).toBeInTheDocument();
    expect(screen.getByText('計算')).toBeInTheDocument();
    expect(screen.getByText('履歴')).toBeInTheDocument();
  });

  test('calls logout and navigates to login when logout button is clicked', () => {
    const mockUser = { username: 'testuser', email: 'test@example.com' };
    renderWithAuth(mockUser);
    const logoutButton = screen.getByText('ログアウト');
    fireEvent.click(logoutButton);
    expect(mockLogout).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });
});

