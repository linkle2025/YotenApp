import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ForgotPasswordPage from '../ForgotPasswordPage';
import ResetPasswordPage from '../ResetPasswordPage';
import { authService } from '../../services/authService';

jest.mock('../../services/authService', () => ({
  authService: {
    requestPasswordReset: jest.fn(),
    checkPasswordResetLink: jest.fn(),
    confirmPasswordReset: jest.fn(),
  },
}));

const renderReset = () =>
  render(
    <MemoryRouter initialEntries={['/password-reset/MQ/abc-123']}>
      <Routes>
        <Route path="/password-reset/:uid/:token" element={<ResetPasswordPage />} />
      </Routes>
    </MemoryRouter>
  );

const fillPasswords = (password, password2 = password) => {
  fireEvent.change(screen.getByLabelText('新しいパスワード'), { target: { value: password } });
  fireEvent.change(screen.getByLabelText('新しいパスワード（確認）'), { target: { value: password2 } });
};

describe('ForgotPasswordPage', () => {
  beforeEach(() => jest.clearAllMocks());

  test('sends email and shows the API message', async () => {
    authService.requestPasswordReset.mockResolvedValue({ message: '再設定用のメールを送信しました。' });
    render(<ForgotPasswordPage />, { wrapper: MemoryRouter });
    fireEvent.change(screen.getByLabelText('メールアドレス'), { target: { value: 'a@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: '再設定メールを送信' }));
    expect(await screen.findByText('再設定用のメールを送信しました。')).toBeInTheDocument();
    expect(authService.requestPasswordReset).toHaveBeenCalledWith('a@example.com');
    expect(screen.queryByLabelText('メールアドレス')).not.toBeInTheDocument();
  });

  test('shows a rate-limit message on 429', async () => {
    authService.requestPasswordReset.mockRejectedValue({ response: { status: 429, data: {} } });
    render(<ForgotPasswordPage />, { wrapper: MemoryRouter });
    fireEvent.change(screen.getByLabelText('メールアドレス'), { target: { value: 'a@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: '再設定メールを送信' }));
    expect(await screen.findByText(/一時的に受付を停止しています/)).toBeInTheDocument();
  });
});

describe('ResetPasswordPage', () => {
  beforeEach(() => jest.clearAllMocks());

  test('invalid link: shows message and re-apply link, no form', async () => {
    authService.checkPasswordResetLink.mockRejectedValue({ response: { status: 400, data: {} } });
    renderReset();
    expect(await screen.findByText(/有効期限が切れています/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /もう一度申し込む/ })).toHaveAttribute('href', '/password-reset');
    expect(screen.queryByLabelText('新しいパスワード')).not.toBeInTheDocument();
    expect(authService.checkPasswordResetLink).toHaveBeenCalledWith('MQ', 'abc-123');
  });

  test('valid link: resets password and links to login', async () => {
    authService.checkPasswordResetLink.mockResolvedValue({ valid: true });
    authService.confirmPasswordReset.mockResolvedValue({ message: 'パスワードを再設定しました。' });
    renderReset();
    await screen.findByLabelText('新しいパスワード');
    fillPasswords('NewPass456!');
    fireEvent.click(screen.getByRole('button', { name: 'パスワードを再設定' }));
    expect(await screen.findByText('パスワードを再設定しました。')).toBeInTheDocument();
    expect(authService.confirmPasswordReset).toHaveBeenCalledWith('MQ', 'abc-123', 'NewPass456!', 'NewPass456!');
    expect(screen.getByRole('link', { name: 'ログイン画面へ' })).toHaveAttribute('href', '/login');
  });

  test('mismatch is caught before calling the API', async () => {
    authService.checkPasswordResetLink.mockResolvedValue({ valid: true });
    renderReset();
    await screen.findByLabelText('新しいパスワード');
    fillPasswords('NewPass456!', 'Other456!');
    fireEvent.click(screen.getByRole('button', { name: 'パスワードを再設定' }));
    expect(await screen.findByText('パスワードが一致しません。')).toBeInTheDocument();
    expect(authService.confirmPasswordReset).not.toHaveBeenCalled();
  });

  test('shows password validation errors from the API', async () => {
    authService.checkPasswordResetLink.mockResolvedValue({ valid: true });
    authService.confirmPasswordReset.mockRejectedValue({
      response: { status: 400, data: { password: ['このパスワードは短すぎます。'] } },
    });
    renderReset();
    await screen.findByLabelText('新しいパスワード');
    fillPasswords('short');
    fireEvent.click(screen.getByRole('button', { name: 'パスワードを再設定' }));
    expect(await screen.findByText('このパスワードは短すぎます。')).toBeInTheDocument();
  });

  test('link that expires before submit switches to the invalid view', async () => {
    authService.checkPasswordResetLink.mockResolvedValue({ valid: true });
    authService.confirmPasswordReset.mockRejectedValue({
      response: { status: 400, data: { detail: 'このリンクは無効です' } },
    });
    renderReset();
    await screen.findByLabelText('新しいパスワード');
    fillPasswords('NewPass456!');
    fireEvent.click(screen.getByRole('button', { name: 'パスワードを再設定' }));
    expect(await screen.findByRole('link', { name: /もう一度申し込む/ })).toBeInTheDocument();
  });
});
