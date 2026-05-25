import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import Header from './components/Header';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import CalculatePage from './pages/CalculatePage';
import HistoryPage from './pages/HistoryPage';
import DetailPage from './pages/DetailPage';
import StemsPage from './pages/StemsPage';
import StarsPage from './pages/StarsPage';
import MyPage from './pages/MyPage';
import AdminPage from './pages/AdminPage';
import KimonTonkouPage from './pages/KimonTonkouPage';
import KimonTonkouDailyPage from './pages/KimonTonkouDailyPage';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <Header />
          <main className="main-content">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/stems" element={<StemsPage />} />
              <Route path="/stars" element={<StarsPage />} />
              <Route
                path="/calculate"
                element={
                  <PrivateRoute>
                    <CalculatePage />
                  </PrivateRoute>
                }
              />
              <Route
                path="/history"
                element={
                  <PrivateRoute>
                    <HistoryPage />
                  </PrivateRoute>
                }
              />
              <Route
                path="/fortune/:id"
                element={
                  <PrivateRoute>
                    <DetailPage />
                  </PrivateRoute>
                }
              />
              <Route
                path="/mypage"
                element={
                  <PrivateRoute>
                    <MyPage />
                  </PrivateRoute>
                }
              />
              <Route
                path="/admin"
                element={
                  <PrivateRoute>
                    <AdminPage />
                  </PrivateRoute>
                }
              />
              <Route
                path="/kimon-tonkou/daily"
                element={
                  <PrivateRoute>
                    <KimonTonkouDailyPage />
                  </PrivateRoute>
                }
              />
              <Route
                path="/kimon-tonkou"
                element={
                  <PrivateRoute>
                    <KimonTonkouPage />
                  </PrivateRoute>
                }
              />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </main>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;

