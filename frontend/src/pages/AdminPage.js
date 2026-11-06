import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/authService';
import './AdminPage.css';

const AdminPage = () => {
  const { isAdmin, user: currentUser } = useAuth();
  const navigate = useNavigate();
  
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({
    username: '',
    email: '',
    role: 'general',
    is_active: true,
  });

  useEffect(() => {
    if (!isAdmin()) {
      navigate('/');
      return;
    }
    loadUsers();
  }, [isAdmin, navigate]);

  const loadUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await authService.getAdminUserList();
      setUsers(data);
    } catch (err) {
      setError('ユーザー一覧の取得に失敗しました。');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (user) => {
    setEditingUser(user.id);
    setEditForm({
      username: user.username,
      email: user.email,
      role: user.profile?.role || 'general',
      is_active: user.is_active !== undefined ? user.is_active : true,
    });
  };

  const handleCancelEdit = () => {
    setEditingUser(null);
    setEditForm({
      username: '',
      email: '',
      role: 'general',
      is_active: true,
    });
  };

  const handleSave = async (userId) => {
    setError('');
    setMessage('');
    
    try {
      await authService.updateAdminUser(userId, {
        username: editForm.username,
        email: editForm.email,
        profile: {
          role: editForm.role,
        },
        is_active: editForm.is_active,
      });
      setMessage('ユーザー情報を更新しました。');
      setEditingUser(null);
      await loadUsers();
    } catch (err) {
      const errorData = err.response?.data;
      if (errorData?.username) {
        setError(errorData.username[0]);
      } else if (errorData?.email) {
        setError(errorData.email[0]);
      } else {
        setError('ユーザー情報の更新に失敗しました。');
      }
    }
  };

  const handleDelete = async (user) => {
    setError('');
    setMessage('');
    const count = user.calculation_count || 0;
    const lines = [
      `ユーザー「${user.username}」を削除します。`,
      count > 0
        ? `このユーザーの鑑定記録 ${count} 件（判定の要点を含む）も一緒に削除されます。`
        : 'このユーザーの鑑定記録はありません。',
      '削除すると元に戻せません。よろしいですか？',
      '',
      '※ ログインだけ止めたい場合は、削除せずに「編集」で状態を無効にしてください。',
    ];
    if (!window.confirm(lines.join('\n'))) {
      return;
    }
    try {
      await authService.deleteAdminUser(user.id);
      setMessage(`ユーザー「${user.username}」を削除しました。`);
      if (editingUser === user.id) {
        handleCancelEdit();
      }
      await loadUsers();
    } catch (err) {
      setError(err.response?.data?.error || 'ユーザーの削除に失敗しました。');
    }
  };

  const formatDate = (value) => (value ? new Date(value).toLocaleDateString('ja-JP') : '—');

  const formatDateTime = (value) => {
    if (!value) {
      return '—';
    }
    return new Date(value).toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getRoleLabel = (role) => {
    const roleMap = {
      'general': '一般ユーザー',
      'fortuneteller': '占者ユーザー',
      'admin': '管理者',
    };
    return roleMap[role] || role;
  };

  if (!isAdmin()) {
    return null;
  }

  if (loading) {
    return <div className="admin-container">読み込み中...</div>;
  }

  return (
    <div className="admin-container">
      <h1>ユーザー管理</h1>
      
      {message && <div className="message">{message}</div>}
      {error && <div className="error">{error}</div>}

      <div className="admin-table-container">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>ユーザー名</th>
              <th>メールアドレス</th>
              <th>ロール</th>
              <th>状態</th>
              <th>登録日</th>
              <th>最終ログイン</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                {editingUser === user.id ? (
                  <>
                    <td>{user.id}</td>
                    <td>
                      <input
                        type="text"
                        value={editForm.username}
                        onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                        className="edit-input"
                      />
                    </td>
                    <td>
                      <input
                        type="email"
                        value={editForm.email}
                        onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                        className="edit-input"
                      />
                    </td>
                    <td>
                      <select
                        value={editForm.role}
                        onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                        className="edit-select"
                      >
                        <option value="general">一般ユーザー</option>
                        <option value="fortuneteller">占者ユーザー</option>
                        <option value="admin">管理者</option>
                      </select>
                    </td>
                    <td>
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={editForm.is_active}
                          onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })}
                        />
                        有効
                      </label>
                    </td>
                    <td>{formatDate(user.date_joined)}</td>
                    <td className="nowrap">{formatDateTime(user.last_login)}</td>
                    <td className="nowrap">
                      <button
                        onClick={() => handleSave(user.id)}
                        className="save-button"
                      >
                        保存
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="cancel-button"
                      >
                        キャンセル
                      </button>
                    </td>
                  </>
                ) : (
                  <>
                    <td>{user.id}</td>
                    <td>{user.username}</td>
                    <td>{user.email}</td>
                    <td>{getRoleLabel(user.profile?.role || 'general')}</td>
                    <td>
                      <span className={user.is_active ? 'status-active' : 'status-inactive'}>
                        {user.is_active ? '有効' : '無効'}
                      </span>
                    </td>
                    <td>{formatDate(user.date_joined)}</td>
                    <td className="nowrap">{formatDateTime(user.last_login)}</td>
                    <td className="nowrap">
                      <button
                        onClick={() => handleEdit(user)}
                        className="edit-button"
                      >
                        編集
                      </button>
                      {currentUser?.id !== user.id && (
                        <button
                          onClick={() => handleDelete(user)}
                          className="delete-button"
                        >
                          削除
                        </button>
                      )}
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminPage;

