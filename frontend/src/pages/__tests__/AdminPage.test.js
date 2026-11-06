import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminPage from '../AdminPage';
import { authService } from '../../services/authService';

jest.mock('../../services/authService', () => ({
  authService: {
    getAdminUserList: jest.fn(),
    updateAdminUser: jest.fn(),
    deleteAdminUser: jest.fn(),
  },
}));

const mockIsAdmin = () => true;
jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ isAdmin: mockIsAdmin, user: { id: 1, username: 'admin' } }),
}));

const USERS = [
  {
    id: 1, username: 'admin', email: 'admin@example.com', is_active: true, profile: { role: 'admin' },
    date_joined: '2026-01-10T00:00:00Z', last_login: '2026-11-05T01:30:00Z', calculation_count: 0,
  },
  {
    id: 2, username: 'taro', email: 'taro@example.com', is_active: true, profile: { role: 'general' },
    date_joined: '2026-02-01T00:00:00Z', last_login: null, calculation_count: 3,
  },
];

const row = (name) => screen.getByText(name).closest('tr');

describe('AdminPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authService.getAdminUserList.mockResolvedValue(USERS);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('shows last login column, with a dash for users who never logged in', async () => {
    render(<AdminPage />, { wrapper: MemoryRouter });
    expect(await screen.findByText('taro')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: '最終ログイン' })).toBeInTheDocument();
    expect(within(row('taro')).getByText('—')).toBeInTheDocument();
    expect(within(row('admin')).getByText(/2026\/11\/05/)).toBeInTheDocument();
  });

  test('does not offer deleting yourself', async () => {
    render(<AdminPage />, { wrapper: MemoryRouter });
    await screen.findByText('taro');
    expect(within(row('admin')).queryByRole('button', { name: '削除' })).not.toBeInTheDocument();
    expect(within(row('taro')).getByRole('button', { name: '削除' })).toBeInTheDocument();
  });

  test('deletes after confirmation that mentions the records', async () => {
    const confirm = jest.spyOn(window, 'confirm').mockReturnValue(true);
    authService.deleteAdminUser.mockResolvedValue();
    render(<AdminPage />, { wrapper: MemoryRouter });
    await screen.findByText('taro');
    authService.getAdminUserList.mockResolvedValue([USERS[0]]);
    fireEvent.click(within(row('taro')).getByRole('button', { name: '削除' }));
    expect(confirm.mock.calls[0][0]).toContain('鑑定記録 3 件');
    expect(await screen.findByText('ユーザー「taro」を削除しました。')).toBeInTheDocument();
    expect(authService.deleteAdminUser).toHaveBeenCalledWith(2);
    expect(screen.queryByText('taro@example.com')).not.toBeInTheDocument();
  });

  test('does nothing when confirmation is cancelled', async () => {
    jest.spyOn(window, 'confirm').mockReturnValue(false);
    render(<AdminPage />, { wrapper: MemoryRouter });
    await screen.findByText('taro');
    fireEvent.click(within(row('taro')).getByRole('button', { name: '削除' }));
    expect(authService.deleteAdminUser).not.toHaveBeenCalled();
  });

  test('shows the API error message when deletion fails', async () => {
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    authService.deleteAdminUser.mockRejectedValue({ response: { data: { error: '自分自身のアカウントは削除できません。' } } });
    render(<AdminPage />, { wrapper: MemoryRouter });
    await screen.findByText('taro');
    fireEvent.click(within(row('taro')).getByRole('button', { name: '削除' }));
    expect(await screen.findByText('自分自身のアカウントは削除できません。')).toBeInTheDocument();
  });
});
