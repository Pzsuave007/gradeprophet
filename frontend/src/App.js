import "@/App.css";
import React, { useState, useEffect, useRef } from "react";
import { BrowserRouter } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import LandingPage from "./components/LandingPage";
import AuthPage from "./components/AuthPage";
import { Toaster } from "./components/ui/sonner";
import axios from "axios";

// Global axios config - send cookies with every request
axios.defaults.withCredentials = true;

const API = process.env.REACT_APP_BACKEND_URL;

function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [view, setView] = useState('landing'); // landing, auth, app, oauth
  const oauthProcessed = useRef(false);

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
            setView('app');
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
          setView('app');
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
          <AuthPage onSuccess={(u) => { setUser(u); setView('app'); }} onBack={() => setView('landing')} />
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

  // Authenticated
  return (
    <BrowserRouter>
      <Dashboard user={user} onLogout={handleLogout} />
      <Toaster position="bottom-right" />
    </BrowserRouter>
  );
}

export default App;
