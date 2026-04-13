import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Package,
  Tag,
  User,
  Menu,
  X,
  Zap,
  LogOut,
  Camera,
  Crosshair,
  BarChart3,
  Flame,
  Calendar
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PlanProvider } from '../hooks/usePlan';
import DashboardHome from '../components/DashboardHome';
import InventoryModule from '../components/InventoryModule';
import AccountModule from '../components/AccountModule';
import ListingsModule from '../components/ListingsModule';
import FlipFinder from '../components/FlipFinder';
import MarketModule from '../components/MarketModule';
import QuickScan from '../components/QuickScan';
import ChasePacksModule from '../components/ChasePacksModule';
import ScheduleModule from '../components/ScheduleModule';

// Placeholder components for future modules
const PlaceholderModule = ({ title, description, icon: Icon }) => (
  <div className="flex flex-col items-center justify-center py-20">
    <div className="w-16 h-16 rounded-xl bg-[#3b82f6]/10 flex items-center justify-center mb-4">
      <Icon className="w-8 h-8 text-[#3b82f6]" />
    </div>
    <h2 className="text-xl font-bold text-white mb-2">{title}</h2>
    <p className="text-gray-500 text-sm text-center max-w-md">{description}</p>
    <div className="mt-6 px-4 py-2 bg-[#111] border border-[#1a1a1a] rounded-lg text-xs text-gray-600 uppercase tracking-wider">
      Proximamente
    </div>
  </div>
);

const Listings = () => (
  <PlaceholderModule title="Listings" description="List cards directly on eBay and manage your active listings." icon={Tag} />
);

const Account = () => (
  <PlaceholderModule title="Account" description="Account settings, integrations, and preferences." icon={User} />
);

const modules = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'inventory', label: 'Inventory', icon: Package },
  { id: 'listings', label: 'Listings', icon: Tag },
  { id: 'flipfinder', label: 'Flip Finder', icon: Crosshair },
  { id: 'chase-packs', label: 'Chase Packs', icon: Flame },
  { id: 'schedule', label: 'Schedule', icon: Calendar },
  { id: 'market', label: 'Market', icon: BarChart3 },
  { id: 'account', label: 'Account', icon: User },
];

const Dashboard = ({ user, onLogout }) => {
  const [activeModule, setActiveModule] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [quickScanOpen, setQuickScanOpen] = useState(false);
  const [pendingDetailCard, setPendingDetailCard] = useState(null);
  const [pendingAddCategory, setPendingAddCategory] = useState(null);
  const navigate = useNavigate();

  const token = localStorage.getItem('flipslab_token');

  // Handle Stripe redirect - poll payment status
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');
    const planId = params.get('plan');
    const cancelled = params.get('payment');

    if (cancelled === 'cancelled') {
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }

    if (sessionId) {
      const pollStatus = async (attempts = 0) => {
        if (attempts >= 6) {
          window.history.replaceState({}, '', window.location.pathname);
          return;
        }
        try {
          const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/subscription/checkout/status/${sessionId}`, { credentials: 'include' });
          const data = await res.json();
          if (data.payment_status === 'paid') {
            window.history.replaceState({}, '', window.location.pathname);
            setActiveModule('account');
            return;
          }
          setTimeout(() => pollStatus(attempts + 1), 2000);
        } catch {
          setTimeout(() => pollStatus(attempts + 1), 2000);
        }
      };
      pollStatus();
    }
  }, []);

  const renderModule = () => {
    switch (activeModule) {
      case 'dashboard': return <DashboardHome onNavigate={setActiveModule} />;
      case 'inventory': return <InventoryModule pendingDetailCard={pendingDetailCard} onDetailCardConsumed={() => setPendingDetailCard(null)} pendingAddCategory={pendingAddCategory} onAddCategoryConsumed={() => setPendingAddCategory(null)} />;
      case 'listings': return <ListingsModule />;
      case 'flipfinder': return <FlipFinder onNavigateToAccount={() => setActiveModule('account')} />;
      case 'chase-packs': return <ChasePacksModule />;
      case 'schedule': return <ScheduleModule />;
      case 'market': return <MarketModule onNavigateToAccount={() => setActiveModule('account')} />;
      case 'account': return <AccountModule />;
      default: return <DashboardHome onNavigate={setActiveModule} />;
    }
  };

  return (
    <PlanProvider>
    <div className="min-h-screen bg-[#0a0a0a] flex">
      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex flex-col w-56 bg-[#0a0a0a] border-r border-[#1a1a1a] fixed h-full z-40">
        {/* Logo */}
        <div className="px-4 py-4 border-b border-[#1a1a1a]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#3b82f6] rounded flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white tracking-wide">FlipSlab</h1>
              <p className="text-[9px] text-gray-600 uppercase tracking-widest">Engine</p>
            </div>
          </div>
        </div>

        {/* Nav Links */}
        <nav className="flex-1 py-3 px-2 space-y-0.5">
          {modules.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setActiveModule(id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeModule === id
                  ? 'bg-[#3b82f6] text-white'
                  : 'text-gray-500 hover:text-white hover:bg-white/5'
              }`} data-testid={`nav-${id}`}>
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </nav>

        {/* Marketplace Link */}
        <div className="px-3 mb-2">
          <button onClick={() => navigate('/marketplace')}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[11px] font-semibold bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 transition-colors"
            data-testid="nav-marketplace">
            <Zap className="w-4 h-4" /> Marketplace
          </button>
        </div>

        {/* Sidebar Footer */}
        <div className="px-3 py-3 border-t border-[#1a1a1a]">
          <div className="flex items-center gap-2.5 mb-2">
            {user?.picture ? (
              <img src={user.picture} alt="" className="w-7 h-7 rounded-full" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-[#3b82f6]/20 flex items-center justify-center">
                <User className="w-3.5 h-3.5 text-[#3b82f6]" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-medium text-white truncate">{user?.name || 'User'}</p>
              <p className="text-[9px] text-gray-600 truncate">{user?.email}</p>
            </div>
          </div>
          <button onClick={onLogout}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] text-gray-600 hover:text-red-400 hover:bg-red-500/5 transition-colors"
            data-testid="logout-btn">
            <LogOut className="w-3 h-3" /> Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-[#0a0a0a]/95 backdrop-blur-md border-b border-[#1a1a1a]">
        <div className="flex items-center justify-between px-4 h-12">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-[#3b82f6] rounded flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-bold text-white">FlipSlab Engine</span>
          </div>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1.5 hover:bg-white/5 rounded" data-testid="mobile-menu-toggle">
            {sidebarOpen ? <X className="w-5 h-5 text-white" /> : <Menu className="w-5 h-5 text-white" />}
          </button>
        </div>
      </header>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="lg:hidden fixed inset-0 bg-black/60 z-40" onClick={() => setSidebarOpen(false)} />
            <motion.aside initial={{ x: -256 }} animate={{ x: 0 }} exit={{ x: -256 }} transition={{ type: 'tween', duration: 0.2 }}
              className="lg:hidden fixed left-0 top-0 h-full w-56 bg-[#0a0a0a] border-r border-[#1a1a1a] z-50">
              <div className="px-4 py-4 border-b border-[#1a1a1a] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 bg-[#3b82f6] rounded flex items-center justify-center">
                    <Zap className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-sm font-bold text-white">FlipSlab</span>
                </div>
                <button onClick={() => setSidebarOpen(false)} className="p-1"><X className="w-4 h-4 text-gray-500" /></button>
              </div>
              <nav className="py-3 px-2 space-y-0.5">
                {modules.map(({ id, label, icon: Icon }) => (
                  <button key={id} onClick={() => { setActiveModule(id); setSidebarOpen(false); }}
                    data-testid={`mobile-nav-${id}`}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      activeModule === id ? 'bg-[#3b82f6] text-white' : 'text-gray-500 hover:text-white hover:bg-white/5'
                    }`}>
                    <Icon className="w-4 h-4" />{label}
                  </button>
                ))}
                <div className="border-t border-[#1a1a1a] my-2" />
                <button onClick={() => { setQuickScanOpen(true); setSidebarOpen(false); }}
                  data-testid="mobile-nav-quickscan"
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-[#3b82f6] hover:bg-[#3b82f6]/10 transition-all">
                  <Camera className="w-4 h-4" /> Quick Scan
                </button>
                <button onClick={() => { navigate('/marketplace'); setSidebarOpen(false); }}
                  data-testid="mobile-nav-marketplace"
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-semibold text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 transition-all">
                  <Zap className="w-4 h-4" /> Marketplace
                </button>
              </nav>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 lg:ml-56 min-h-screen overflow-x-hidden">
        <div className="pt-14 lg:pt-0 px-4 sm:px-6 py-4 pb-24 lg:pb-4 max-w-full">
          <AnimatePresence mode="wait">
            <motion.div key={activeModule} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              {renderModule()}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Bottom Navigation Bar - Mobile only */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0a0a0a]/95 backdrop-blur-lg border-t border-[#1a1a1a] safe-area-bottom" data-testid="mobile-bottom-nav">
        <div className="flex items-stretch justify-around">
          {[
            { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
            { id: 'inventory', label: 'Inventory', icon: Package },
            { id: 'quickscan', label: 'Scan', icon: Camera, special: true },
            { id: 'listings', label: 'Listings', icon: Tag },
            { id: 'flipfinder', label: 'Flip', icon: Crosshair },
          ].map(({ id, label, icon: Icon, special }) => (
            special ? (
              <button key={id} onClick={() => setQuickScanOpen(true)}
                className="flex flex-col items-center justify-center gap-0.5 py-2 px-1 -mt-4"
                data-testid="bottom-nav-quickscan">
                <div className="w-12 h-12 rounded-full bg-[#3b82f6] flex items-center justify-center shadow-lg shadow-[#3b82f6]/30">
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <span className="text-[9px] font-bold text-[#3b82f6]">{label}</span>
              </button>
            ) : (
              <button key={id} onClick={() => setActiveModule(id)}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 transition-colors ${
                  activeModule === id ? 'text-[#3b82f6]' : 'text-gray-600'
                }`}
                data-testid={`bottom-nav-${id}`}>
                <Icon className="w-5 h-5" />
                <span className="text-[9px] font-bold">{label}</span>
              </button>
            )
          ))}
        </div>
      </nav>

      {/* Quick Scan Overlay */}
      <AnimatePresence>
        {quickScanOpen && (
          <QuickScan
            token={token}
            onClose={() => {
              setQuickScanOpen(false);
              // Navigate to inventory when done scanning
              setActiveModule('inventory');
            }}
            onCardAdded={(newCard) => {
              if (newCard) {
                setPendingDetailCard(newCard);
              }
            }}
          />
        )}
      </AnimatePresence>
    </div>
    </PlanProvider>
  );
};

export default Dashboard;
