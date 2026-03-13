import React, { useEffect, useState } from 'react';
import { Layers, RefreshCw, AlertCircle } from 'lucide-react';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

const AuthCallback = ({ onSuccess, onError }) => {
  const [status, setStatus] = useState('processing'); // processing, error

  useEffect(() => {
    const processCallback = async () => {
      const params = new URLSearchParams(window.location.search);
      const sessionId = params.get('session_id');
      if (!sessionId) {
        setStatus('error');
        onError?.('No session_id found');
        return;
      }
      try {
        const res = await axios.post(`${API}/api/auth/session`, { session_id: sessionId }, { withCredentials: true });
        localStorage.setItem('flipslab_user', JSON.stringify(res.data));
        // Clean URL
        window.history.replaceState({}, '', '/');
        onSuccess(res.data);
      } catch (err) {
        setStatus('error');
        onError?.(err.response?.data?.detail || 'Authentication failed');
      }
    };
    processCallback();
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center" data-testid="auth-callback">
      <div className="text-center">
        <div className="w-12 h-12 rounded-xl bg-[#3b82f6] flex items-center justify-center mx-auto mb-4">
          <Layers className="w-6 h-6 text-white" />
        </div>
        {status === 'processing' ? (
          <>
            <RefreshCw className="w-6 h-6 text-[#3b82f6] animate-spin mx-auto mb-3" />
            <p className="text-sm text-gray-400">Signing you in...</p>
          </>
        ) : (
          <>
            <AlertCircle className="w-6 h-6 text-red-400 mx-auto mb-3" />
            <p className="text-sm text-red-400">Authentication failed</p>
            <button onClick={() => window.location.href = '/'} className="text-xs text-[#3b82f6] mt-2 hover:underline">Go back</button>
          </>
        )}
      </div>
    </div>
  );
};

export default AuthCallback;
