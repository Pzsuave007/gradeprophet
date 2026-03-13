import "@/App.css";
import React, { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import LandingPage from "./components/LandingPage";
import AuthPage from "./components/AuthPage";
import AuthCallback from "./components/AuthCallback";
import { Toaster } from "./components/ui/sonner";
import axios from "axios";

const API = process.env.REACT_APP_BACKEND_URL;

const AppRoutes = () => {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [view, setView] = useState('landing'); // landing, auth, app
  const navigate = useNavigate();
  const location = useLocation();

  // Check for existing session on mount
  useEffect(() => {
    const checkSession = async () => {
      // Check if we're on the auth callback route
      if (location.pathname === '/auth/callback') {
        setChecking(false);
        return;
      }

      // Check localStorage first
      const stored = localStorage.getItem('flipslab_user');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          // Verify session is still valid
          const res = await axios.get(`${API}/api/auth/me`, { withCredentials: true });
          setUser(res.data);
          setView('app');
        } catch {
          // Session expired, clear storage
          localStorage.removeItem('flipslab_user');
        }
      }
      setChecking(false);
    };
    checkSession();
  }, []);

  const handleAuthSuccess = (userData) => {
    setUser(userData);
    setView('app');
    navigate('/');
  };

  const handleLogout = async () => {
    try {
      await axios.post(`${API}/api/auth/logout`, {}, { withCredentials: true });
    } catch {}
    localStorage.removeItem('flipslab_user');
    setUser(null);
    setView('landing');
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#3b82f6] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Auth callback route
  if (location.pathname === '/auth/callback') {
    return <AuthCallback onSuccess={handleAuthSuccess} onError={() => setView('auth')} />;
  }

  // Not authenticated
  if (!user) {
    if (view === 'auth') {
      return <AuthPage onSuccess={handleAuthSuccess} onBack={() => setView('landing')} />;
    }
    return <LandingPage onGetStarted={() => setView('auth')} />;
  }

  // Authenticated - show app
  return <Dashboard user={user} onLogout={handleLogout} />;
};

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="*" element={<AppRoutes />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="bottom-right" />
    </div>
  );
}

export default App;
