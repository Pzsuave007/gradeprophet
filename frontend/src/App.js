import "@/App.css";
import React, { useState, useEffect, useRef } from "react";
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import AdminPage from "./pages/AdminPage";
import LandingPage from "./components/LandingPage";
import AuthPage from "./components/AuthPage";
import OnboardingWizard from "./components/OnboardingWizard";
import { Toaster } from "./components/ui/sonner";
import axios from "axios";

// Global axios config - send cookies with every request
axios.defaults.withCredentials = true;

const API = process.env.REACT_APP_BACKEND_URL;

function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [view, setView] = useState('landing'); // landing, auth, app, oauth, onboarding
  const oauthProcessed = useRef(false);

  const handleAuthSuccess = (u) => {
    setUser(u);
    if (u.onboarding_completed) {
      setView('app');
    } else {
      setView('onboarding');
    }
  };

  const handleOnboardingComplete = () => {
    setUser(prev => ({ ...prev, onboarding_completed: true }));
    localStorage.setItem('flipslab_user', JSON.stringify({ ...user, onboarding_completed: true }));
    setView('app');
  };

  const handleOnboardingSkip = async () => {
    try {
      await axios.post(`${API}/api/onboarding/skip`);
    } catch {}
    setUser(prev => ({ ...prev, onboarding_completed: true }));
    localStorage.setItem('flipslab_user', JSON.stringify({ ...user, onboarding_completed: true }));
    setView('app');
  };

  useEffect(() => {
    // CRITICAL: Check hash for session_id from Google OAuth
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    if (window.location.hash?.includes('session_id=') && !oauthProcessed.current) {
      oauthProcessed.current = true;
      setView('oauth');

      const match = window.location.hash.match(/session_id=([^&]+)/);
      const sessionId = match ? match[1] : null;

      if (sessionId) {
        axios.post(`${API}/api/auth/session`, { session_id: sessionId }, { withCredentials: true })
          .then(res => {
            localStorage.setItem('flipslab_user', JSON.stringify(res.data));
            window.history.replaceState({}, '', '/');
            setUser(res.data);
            if (res.data.onboarding_completed) {
              setView('app');
            } else {
              setView('onboarding');
            }
            setChecking(false);
          })
          .catch(err => {
            console.error('OAuth error:', err.response?.data || err.message);
            window.history.replaceState({}, '', '/');
            setView('auth');
            setChecking(false);
          });
        return;
      }
    }

    // Normal session check
    const checkSession = async () => {
      const stored = localStorage.getItem('flipslab_user');
      if (stored) {
        try {
          const res = await axios.get(`${API}/api/auth/me`, { withCredentials: true });
          setUser(res.data);
          if (res.data.onboarding_completed) {
            setView('app');
          } else {
            setView('onboarding');
          }
        } catch {
          localStorage.removeItem('flipslab_user');
        }
      }
      setChecking(false);
    };
    checkSession();
  }, []);

  const handleLogout = async () => {
    try {
      await axios.post(`${API}/api/auth/logout`, {}, { withCredentials: true });
    } catch {}
    localStorage.removeItem('flipslab_user');
    setUser(null);
    setView('landing');
  };

  // Loading spinner
  if (checking || view === 'oauth') {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#3b82f6] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    if (view === 'auth') {
      return (
        <>
          <AuthPage onSuccess={handleAuthSuccess} onBack={() => setView('landing')} />
          <Toaster position="bottom-right" />
        </>
      );
    }
    return (
      <>
        <LandingPage onGetStarted={() => setView('auth')} />
        <Toaster position="bottom-right" />
      </>
    );
  }

  // Onboarding
  if (view === 'onboarding') {
    return (
      <>
        <OnboardingWizard user={user} onComplete={handleOnboardingComplete} onSkip={handleOnboardingSkip} />
        <Toaster position="bottom-right" />
      </>
    );
  }

  // Authenticated
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/admin" element={<AdminRoute user={user} onLogout={handleLogout} />} />
        <Route path="*" element={<Dashboard user={user} onLogout={handleLogout} />} />
      </Routes>
      <Toaster position="bottom-right" />
    </BrowserRouter>
  );
}

function AdminRoute({ user, onLogout }) {
  const navigate = useNavigate();
  return <AdminPage onBack={() => navigate('/')} />;
}

export default App;
