import React, { createContext, useState, useEffect, useContext } from 'react';
import { authService } from '../services/authService';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadUser = async () => {
    if (authService.isAuthenticated()) {
      try {
        const userData = await authService.getCurrentUser();
        setUser(userData);
      } catch (error) {
        authService.logout();
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    loadUser();
  }, []);

  const login = async (username, password) => {
    await authService.login(username, password);
    const userData = await authService.getCurrentUser();
    setUser(userData);
  };

  const register = async (username, email, password, password2, profileData = {}) => {
    await authService.register(username, email, password, password2, profileData);
    await login(username, password);
  };

  const logout = () => {
    authService.logout();
    setUser(null);
  };

  const updateDisplayMode = async (displayMode) => {
    try {
      await authService.updateDisplayMode(displayMode);
      // ユーザー情報を再取得して最新の状態を反映
      const userData = await authService.getCurrentUser();
      setUser(userData);
    } catch (error) {
      console.error('表示モードの更新に失敗しました:', error);
      throw error;
    }
  };

  // ロールと表示モードのヘルパー関数
  const getRole = () => {
    return user?.profile?.role || 'general';
  };

  const getDisplayMode = () => {
    return user?.profile?.display_mode || 'business';
  };

  const isFortuneteller = () => {
    return getRole() === 'fortuneteller';
  };

  const isAdmin = () => {
    return getRole() === 'admin';
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      login, 
      register, 
      logout, 
      loading,
      updateDisplayMode,
      getRole,
      getDisplayMode,
      isFortuneteller,
      isAdmin,
      loadUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

