import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link2, CheckCircle, XCircle, RefreshCw, ExternalLink } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

const AccountModule = () => {
  const [ebayStatus, setEbayStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkStatus = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/api/ebay/oauth/status`);
      setEbayStatus(res.data);
    } catch { setEbayStatus({ connected: false }); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    checkStatus();
    // Check URL params for OAuth callback result
    const params = new URLSearchParams(window.location.search);
    const authResult = params.get('ebay_auth');
    if (authResult === 'success') {
      toast.success('eBay account connected successfully!');
      window.history.replaceState({}, '', window.location.pathname);
      checkStatus();
    } else if (authResult && authResult !== 'success') {
      toast.error(`eBay connection failed: ${authResult}`);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const handleConnect = async () => {
    try {
      const res = await axios.get(`${API}/api/ebay/oauth/authorize`);
      window.location.href = res.data.auth_url;
    } catch (err) {
      toast.error('Failed to generate eBay authorization URL');
    }
  };

  return (
    <div className="space-y-6 pb-8" data-testid="account-page">
      <div>
        <h1 className="text-xl font-bold text-white tracking-tight">Account</h1>
        <p className="text-xs text-gray-500 mt-0.5">Integrations and settings</p>
      </div>

      {/* eBay Integration */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="bg-[#111] border border-[#1a1a1a] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#1a1a1a]">
          <h2 className="text-sm font-bold text-white">eBay Integration</h2>
          <p className="text-xs text-gray-500 mt-0.5">Connect your eBay seller account to manage listings and track sales</p>
        </div>

        <div className="p-5">
          {loading ? (
            <div className="flex items-center gap-2 text-gray-500">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span className="text-sm">Checking connection...</span>
            </div>
          ) : ebayStatus?.connected ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-emerald-400">eBay Connected</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">Last updated: {ebayStatus.updated_at ? new Date(ebayStatus.updated_at).toLocaleString() : 'N/A'}</p>
                </div>
              </div>
              <button onClick={handleConnect}
                className="text-xs text-[#3b82f6] hover:text-[#60a5fa] transition-colors"
                data-testid="ebay-reconnect-btn">
                Reconnect account
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-red-400">Not Connected</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">Connect your eBay account to access your listings, sales, and orders</p>
                </div>
              </div>
              <button onClick={handleConnect}
                className="flex items-center gap-2 px-5 py-3 rounded-lg bg-[#3b82f6] text-white text-sm font-semibold hover:bg-[#2563eb] transition-colors"
                data-testid="ebay-connect-btn">
                <Link2 className="w-4 h-4" />
                Connect eBay Account
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default AccountModule;
