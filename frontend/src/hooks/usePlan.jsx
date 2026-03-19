import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

const PlanContext = createContext(null);

export const PlanProvider = ({ children }) => {
  const [planData, setPlanData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchPlan = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/subscription/my-plan`);
      setPlanData(res.data);
    } catch {
      setPlanData({ plan_id: 'rookie', plan: { features: {}, limits: { inventory: 30, scans_per_month: 30, listings: 30 } }, usage: { inventory: 0, scans: 0, listings: 0 } });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPlan(); }, [fetchPlan]);

  const value = {
    planId: planData?.plan_id || 'rookie',
    plan: planData?.plan || {},
    features: planData?.plan?.features || {},
    limits: planData?.plan?.limits || {},
    usage: planData?.usage || {},
    loading,
    refresh: fetchPlan,
    hasFeature: (key) => planData?.plan?.features?.[key] === true,
    isAtLimit: (key) => {
      const limit = planData?.plan?.limits?.[key];
      if (!limit || limit === -1) return false;
      const usage = planData?.usage?.[key === 'scans_per_month' ? 'scans' : key] || 0;
      return usage >= limit;
    },
    getUsage: (key) => {
      const limit = planData?.plan?.limits?.[key] || 0;
      const usage = planData?.usage?.[key === 'scans_per_month' ? 'scans' : key] || 0;
      return { current: usage, limit, unlimited: limit === -1 };
    },
  };

  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
};

export const usePlan = () => {
  const ctx = useContext(PlanContext);
  if (!ctx) return {
    planId: 'rookie', plan: {}, features: {}, limits: {}, usage: {},
    loading: true, refresh: () => {}, hasFeature: () => false,
    isAtLimit: () => false, getUsage: () => ({ current: 0, limit: 0, unlimited: false }),
  };
  return ctx;
};
