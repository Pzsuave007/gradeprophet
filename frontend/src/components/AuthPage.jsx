import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Layers, Mail, Lock, User, ArrowLeft, RefreshCw, Eye, EyeOff } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

const AuthPage = ({ onSuccess, onBack }) => {
  const [mode, setMode] = useState('login'); // login or register
  const [form, setForm] = useState({ email: '', password: '', name: '' });
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) { toast.error('Email and password required'); return; }
    if (mode === 'register' && !form.name) { toast.error('Name required'); return; }

    setLoading(true);
    try {
      const endpoint = mode === 'register' ? '/api/auth/register' : '/api/auth/login';
      const payload = mode === 'register'
        ? { email: form.email, password: form.password, name: form.name }
        : { email: form.email, password: form.password };
      const res = await axios.post(`${API}${endpoint}`, payload, { withCredentials: true });
      localStorage.setItem('flipslab_user', JSON.stringify(res.data));
      toast.success(mode === 'register' ? 'Account created!' : 'Welcome back!');
      onSuccess(res.data);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + '/';
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  const inputCls = "w-full bg-[#0a0a0a] border border-[#222] rounded-xl px-4 py-3 pl-11 text-sm text-white placeholder-gray-600 focus:border-[#3b82f6] focus:outline-none transition-colors";

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4 relative" data-testid="auth-page">
      {/* Background effects */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-[#3b82f6]/[0.04] blur-[150px] pointer-events-none" />

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md relative z-10">
        {/* Back button */}
        <button onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-white mb-8 transition-colors"
          data-testid="auth-back-btn">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        {/* Logo */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-[#3b82f6] flex items-center justify-center">
            <Layers className="w-5 h-5 text-white" strokeWidth={2.5} />
          </div>
          <div>
            <span className="text-xl font-black tracking-tight">FlipSlab</span>
            <span className="text-[10px] uppercase tracking-[0.3em] text-[#3b82f6] ml-1.5 font-bold">ENGINE</span>
          </div>
        </div>

        {/* Title */}
        <h1 className="text-2xl font-black tracking-tight text-white mb-1">
          {mode === 'login' ? 'Welcome back' : 'Create your account'}
        </h1>
        <p className="text-sm text-gray-500 mb-8">
          {mode === 'login' ? 'Sign in to manage your collection' : 'Start tracking your card empire'}
        </p>

        {/* Google button */}
        <button onClick={handleGoogle}
          className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl bg-white/[0.06] border border-white/[0.08] text-sm font-medium text-white hover:bg-white/[0.1] transition-colors mb-5"
          data-testid="google-login-btn">
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          Continue with Google
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-5">
          <div className="flex-1 h-px bg-white/[0.06]" />
          <span className="text-[10px] uppercase tracking-widest text-gray-600 font-medium">or</span>
          <div className="flex-1 h-px bg-white/[0.06]" />
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === 'register' && (
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
              <input className={inputCls} placeholder="Your name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} data-testid="auth-name-input" />
            </div>
          )}
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
            <input className={inputCls} type="email" placeholder="Email address" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} data-testid="auth-email-input" />
          </div>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
            <input className={inputCls} type={showPw ? 'text' : 'password'} placeholder="Password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} data-testid="auth-password-input" />
            <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400">
              {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <button type="submit" disabled={loading}
            className="w-full py-3.5 rounded-xl bg-[#3b82f6] text-white text-sm font-bold hover:bg-[#2563eb] disabled:opacity-50 transition-all shadow-lg shadow-[#3b82f6]/20 mt-2"
            data-testid="auth-submit-btn">
            {loading ? <RefreshCw className="w-4 h-4 animate-spin mx-auto" /> : (mode === 'login' ? 'Sign In' : 'Create Account')}
          </button>
        </form>

        {/* Toggle mode */}
        <p className="text-center text-sm text-gray-500 mt-6">
          {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}
          <button onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
            className="ml-1.5 text-[#3b82f6] font-semibold hover:underline"
            data-testid="auth-toggle-mode">
            {mode === 'login' ? 'Sign up' : 'Sign in'}
          </button>
        </p>
      </motion.div>
    </div>
  );
};

export default AuthPage;
