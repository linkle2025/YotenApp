import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/authService';
import './AdminPage.css';

const AdminPage = () => {
  const { isAdmin } = useAuth();
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
                    <td>{new Date(user.date_joined).toLocaleDateString('ja-JP')}</td>
                    <td>
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
                    <td>{new Date(user.date_joined).toLocaleDateString('ja-JP')}</td>
                    <td>
                      <button
                        onClick={() => handleEdit(user)}
                        className="edit-button"
                      >
                        編集
                      </button>
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

