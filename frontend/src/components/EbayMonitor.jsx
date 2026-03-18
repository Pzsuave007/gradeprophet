import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import {
  Search, Plus, Trash2, ExternalLink, Clock, Tag, Eye, Star, XCircle,
  Loader2, ChevronDown, ChevronUp, Gavel, DollarSign, AlertCircle,
  Edit2, Check, X, ShoppingCart, MessageSquare, Filter, Crosshair, CheckCircle2
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { ViewToggle } from './ViewToggle';

const API = process.env.REACT_APP_BACKEND_URL;

// Action Modal Component
function ActionModal({ isOpen, onClose, title, children }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-[#111] border border-[#1a1a1a] rounded-xl p-5 w-full max-w-md mx-4 shadow-2xl"
        onClick={e => e.stopPropagation()} data-testid="action-modal">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">{title}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X className="w-4 h-4" /></button>
        </div>
        {children}
      </motion.div>
    </div>
  );
}

const EbayMonitor = ({ onAnalyzeCard, onSnipeCard }) => {
  const apiBase = `${API}/api`;

  // Format time left from ISO date
  const formatTimeLeft = (isoDate) => {
    if (!isoDate) return null;
    try {
      const end = new Date(isoDate);
      const now = new Date();
      const diff = end - now;
      if (diff <= 0) return 'Ended';
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      if (d > 0) return `${d}d ${h}h`;
      if (h > 0) return `${h}h ${m}m`;
      return `${m}m`;
    } catch { return isoDate; }
  };
  const [watchlist, setWatchlist] = useState([]);
  const [newCardQuery, setNewCardQuery] = useState('');
  const [newCardNotes, setNewCardNotes] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [loadingWatchlist, setLoadingWatchlist] = useState(true);
  const [listings, setListings] = useState([]);
  const [loadingListings, setLoadingListings] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState(null);
  const [selectedCard, setSelectedCard] = useState(null);
  const [statusFilter, setStatusFilter] = useState('new');
  const [typeFilter, setTypeFilter] = useState('all');
  const [editingCard, setEditingCard] = useState(null);
  const [editQuery, setEditQuery] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [expandedListings, setExpandedListings] = useState({});
  const [viewMode, setViewMode] = useState('grid');

  // Action modal states
  const [buyModal, setBuyModal] = useState(null);
  const [offerModal, setOfferModal] = useState(null);
  const [offerAmount, setOfferAmount] = useState('');
  const [offerMessage, setOfferMessage] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionResult, setActionResult] = useState(null);
  const [searchSort, setSearchSort] = useState('endingSoonest');

  const loadWatchlist = useCallback(async () => {
    try { setLoadingWatchlist(true); const r = await axios.get(`${apiBase}/watchlist`); setWatchlist(r.data); }
    catch (e) { console.error(e); } finally { setLoadingWatchlist(false); }
  }, [apiBase]);

  const loadListings = useCallback(async () => {
    try {
      setLoadingListings(true);
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== 'all') params.append('status', statusFilter);
      if (selectedCard) params.append('watchlist_card_id', selectedCard);
      if (typeFilter && typeFilter !== 'all') params.append('listing_type', typeFilter);
      const r = await axios.get(`${apiBase}/listings?${params.toString()}`);
      const data = r.data;
      setListings(Array.isArray(data) ? data : (data.listings || []));
    } catch (e) { console.error(e); } finally { setLoadingListings(false); }
  }, [apiBase, statusFilter, selectedCard, typeFilter]);

  useEffect(() => { loadWatchlist(); }, [loadWatchlist]);
  useEffect(() => { loadListings(); }, [loadListings]);

  const handleAddCard = async (e) => {
    e.preventDefault();
    if (!newCardQuery.trim()) return;
    try { await axios.post(`${apiBase}/watchlist`, { search_query: newCardQuery.trim(), notes: newCardNotes.trim() || null }); setNewCardQuery(''); setNewCardNotes(''); setShowAddForm(false); loadWatchlist(); }
    catch (e) { console.error(e); }
  };

  const handleRemoveCard = async (cardId) => {
    if (!window.confirm('Delete card and its listings?')) return;
    try { await axios.delete(`${apiBase}/watchlist/${cardId}`); loadWatchlist(); loadListings(); } catch (e) { console.error(e); }
  };

  const handleStartEdit = (card) => { setEditingCard(card.id); setEditQuery(card.search_query); setEditNotes(card.notes || ''); };
  const handleSaveEdit = async () => { try { await axios.put(`${apiBase}/watchlist/${editingCard}`, { search_query: editQuery.trim(), notes: editNotes.trim() || null }); setEditingCard(null); loadWatchlist(); } catch (e) { console.error(e); } };
  const handleCancelEdit = () => { setEditingCard(null); };

  const handleSearchAll = async () => {
    if (watchlist.length === 0) { alert('Add cards first'); return; }
    try { setSearching(true); setSearchResult(null); const r = await axios.post(`${apiBase}/watchlist/search`, { sort: searchSort }); setSearchResult(r.data); loadWatchlist(); loadListings(); }
    catch (e) { console.error(e); alert('Search failed'); } finally { setSearching(false); }
  };

  const handleUpdateStatus = async (id, status) => { try { await axios.put(`${apiBase}/listings/${id}/status?status=${status}`); loadListings(); } catch (e) { console.error(e); } };
  const handleDeleteListing = async (id) => { try { await axios.delete(`${apiBase}/listings/${id}`); loadListings(); } catch (e) { console.error(e); } };

  // Buy Now
  const handleBuyNow = async () => {
    if (!buyModal) return;
    setActionLoading(true);
    setActionResult(null);
    try {
      const itemId = buyModal.ebay_item_id;
      const r = await axios.post(`${apiBase}/buy-now`, { ebay_item_id: itemId, price: buyModal.price_value });
      setActionResult({ success: true, message: r.data.message });
    } catch (e) {
      const msg = e.response?.data?.detail || 'Purchase failed';
      // If eBay API restricted, offer redirect
      if (msg.includes('restricted') || msg.includes('not supported') || msg.includes('not available')) {
        setActionResult({ success: false, message: 'Direct purchase requires eBay app approval. Complete on eBay instead.', redirect: true });
      } else {
        setActionResult({ success: false, message: msg, redirect: true });
      }
    } finally { setActionLoading(false); }
  };

  // Make Offer
  const handleMakeOffer = async () => {
    if (!offerModal || !offerAmount) return;
    setActionLoading(true);
    setActionResult(null);
    try {
      const itemId = offerModal.ebay_item_id;
      const r = await axios.post(`${apiBase}/make-offer`, {
        ebay_item_id: itemId,
        offer_amount: parseFloat(offerAmount),
        message: offerMessage
      });
      setActionResult({ success: true, message: r.data.message });
    } catch (e) {
      const msg = e.response?.data?.detail || 'Offer failed';
      if (msg.includes('restricted') || msg.includes('not supported') || msg.includes('invalid')) {
        setActionResult({ success: false, message: 'Direct offers require eBay app approval. Make your offer on eBay instead.', redirect: true });
      } else {
        setActionResult({ success: false, message: msg, redirect: true });
      }
    } finally { setActionLoading(false); }
  };

  const closeModals = () => { setBuyModal(null); setOfferModal(null); setOfferAmount(''); setOfferMessage(''); setActionResult(null); };

  const listingsByCard = listings.reduce((acc, l) => { const k = l.search_query; if (!acc[k]) acc[k] = []; acc[k].push(l); return acc; }, {});
  const stats = { totalCards: watchlist.length, newListings: listings.filter(l => l.status === 'new').length, interestedListings: listings.filter(l => l.status === 'interested').length };

  // Action buttons for a listing
  const ListingActions = ({ listing, isGrid }) => {
    const isAuction = listing.listing_type === 'auction';
    const isBuyNow = listing.listing_type === 'buy_now';
    const acceptsOffers = listing.accepts_offers;

    if (isGrid) {
      return (
        <div className="flex flex-wrap gap-1.5">
          <a href={listing.listing_url} target="_blank" rel="noopener noreferrer"
            className="text-[10px] bg-[#3b82f6]/10 text-[#3b82f6] px-2 py-1 rounded hover:bg-[#3b82f6]/20 inline-flex items-center gap-0.5" data-testid={`view-listing-${listing.id}`}>
            <ExternalLink className="w-2.5 h-2.5" />eBay</a>
          {listing.status !== 'interested' && <button onClick={() => handleUpdateStatus(listing.id, 'interested')}
            className="text-[10px] bg-[#eab308]/10 text-[#eab308] px-2 py-1 rounded hover:bg-[#eab308]/20 inline-flex items-center gap-0.5" data-testid={`mark-interested-${listing.id}`}>
            <Star className="w-2.5 h-2.5" />Fav</button>}
          {listing.status === 'interested' && <button onClick={() => handleUpdateStatus(listing.id, 'seen')}
            className="text-[10px] bg-gray-500/10 text-gray-400 px-2 py-1 rounded hover:bg-gray-500/20 inline-flex items-center gap-0.5">
            <XCircle className="w-2.5 h-2.5" />Quitar</button>}
          {onAnalyzeCard && <button onClick={() => onAnalyzeCard(listing)}
            className="text-[10px] bg-[#22c55e]/10 text-[#22c55e] px-2 py-1 rounded hover:bg-[#22c55e]/20 inline-flex items-center gap-0.5" data-testid={`analyze-listing-${listing.id}`}>
            <Search className="w-2.5 h-2.5" />Analyze</button>}
          {isAuction && onSnipeCard && <button onClick={() => onSnipeCard(listing)}
            className="text-[10px] bg-[#f59e0b]/10 text-[#f59e0b] px-2 py-1 rounded hover:bg-[#f59e0b]/20 inline-flex items-center gap-0.5" data-testid={`snipe-listing-${listing.id}`}>
            <Crosshair className="w-2.5 h-2.5" />Alert</button>}
          {isBuyNow && <button onClick={() => setBuyModal(listing)}
            className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded hover:bg-emerald-500/20 inline-flex items-center gap-0.5" data-testid={`buy-listing-${listing.id}`}>
            <ShoppingCart className="w-2.5 h-2.5" />Buy</button>}
          {acceptsOffers && <button onClick={() => setOfferModal(listing)}
            className="text-[10px] bg-purple-500/10 text-purple-400 px-2 py-1 rounded hover:bg-purple-500/20 inline-flex items-center gap-0.5" data-testid={`offer-listing-${listing.id}`}>
            <MessageSquare className="w-2.5 h-2.5" />Offer</button>}
          <button onClick={() => handleDeleteListing(listing.id)}
            className="text-[10px] bg-red-500/10 text-red-500 px-2 py-1 rounded hover:bg-red-500/20 inline-flex items-center gap-0.5" data-testid={`delete-listing-${listing.id}`}>
            <Trash2 className="w-2.5 h-2.5" />Del</button>
        </div>
      );
    }

    // List view actions (icons only)
    return (
      <div className="flex items-center gap-1 flex-shrink-0">
        <a href={listing.listing_url} target="_blank" rel="noopener noreferrer"
          className="p-1.5 rounded hover:bg-white/5 text-gray-500 hover:text-[#3b82f6]" data-testid={`view-listing-${listing.id}`}>
          <ExternalLink className="w-3.5 h-3.5" /></a>
        {listing.status !== 'interested' && <button onClick={() => handleUpdateStatus(listing.id, 'interested')}
          className="p-1.5 rounded hover:bg-white/5 text-gray-500 hover:text-[#eab308]" data-testid={`mark-interested-${listing.id}`}>
          <Star className="w-3.5 h-3.5" /></button>}
        {listing.status === 'interested' && <button onClick={() => handleUpdateStatus(listing.id, 'seen')}
          className="p-1.5 rounded hover:bg-white/5 text-[#eab308] hover:text-gray-400">
          <Star className="w-3.5 h-3.5 fill-current" /></button>}
        {onAnalyzeCard && <button onClick={() => onAnalyzeCard(listing)}
          className="p-1.5 rounded hover:bg-white/5 text-gray-500 hover:text-[#22c55e]" data-testid={`analyze-listing-${listing.id}`}>
          <Search className="w-3.5 h-3.5" /></button>}
        {isAuction && onSnipeCard && <button onClick={() => onSnipeCard(listing)}
          className="p-1.5 rounded hover:bg-white/5 text-gray-500 hover:text-[#f59e0b]" data-testid={`snipe-listing-${listing.id}`}>
          <Crosshair className="w-3.5 h-3.5" /></button>}
        {isBuyNow && <button onClick={() => setBuyModal(listing)}
          className="p-1.5 rounded hover:bg-white/5 text-gray-500 hover:text-emerald-400" data-testid={`buy-listing-${listing.id}`}>
          <ShoppingCart className="w-3.5 h-3.5" /></button>}
        {acceptsOffers && <button onClick={() => setOfferModal(listing)}
          className="p-1.5 rounded hover:bg-white/5 text-gray-500 hover:text-purple-400" data-testid={`offer-listing-${listing.id}`}>
          <MessageSquare className="w-3.5 h-3.5" /></button>}
        <button onClick={() => handleDeleteListing(listing.id)}
          className="p-1.5 rounded hover:bg-white/5 text-gray-500 hover:text-red-400" data-testid={`delete-listing-${listing.id}`}>
          <Trash2 className="w-3.5 h-3.5" /></button>
      </div>
    );
  };

  return (
    <>
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
      {/* LEFT: Watchlist Controls */}
      <div className="lg:col-span-2 space-y-3">
        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-[#111] border border-[#1a1a1a] rounded-lg p-2 text-center">
            <div className="text-base sm:text-lg font-bold text-white">{stats.totalCards}</div>
            <div className="text-[8px] sm:text-[9px] text-gray-600 uppercase tracking-wider">Cards</div>
          </div>
          <div className="bg-[#111] border border-[#1a1a1a] rounded-lg p-2 text-center">
            <div className="text-base sm:text-lg font-bold text-[#22c55e]">{stats.newListings}</div>
            <div className="text-[8px] sm:text-[9px] text-gray-600 uppercase tracking-wider">New</div>
          </div>
          <div className="bg-[#111] border border-[#1a1a1a] rounded-lg p-2 text-center">
            <div className="text-base sm:text-lg font-bold text-[#eab308]">{stats.interestedListings}</div>
            <div className="text-[8px] sm:text-[9px] text-gray-600 uppercase tracking-wider">Favorites</div>
          </div>
        </div>

        {/* Sort + Search */}
        <div className="flex gap-2">
          <select value={searchSort} onChange={(e) => setSearchSort(e.target.value)}
            className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg text-white text-[11px] sm:text-xs px-2 h-9 sm:h-10 w-[120px] sm:min-w-[140px] flex-shrink-0"
            data-testid="search-sort-select">
            <option value="endingSoonest">Ending Soonest</option>
            <option value="newlyListed">Newly Listed</option>
            <option value="price">Price: Low</option>
            <option value="-price">Price: High</option>
          </select>
          <Button onClick={handleSearchAll} disabled={searching || watchlist.length === 0}
            className="flex-1 bg-[#3b82f6] hover:bg-[#2563eb] text-white font-heading uppercase tracking-wider h-9 sm:h-10 text-xs sm:text-sm" data-testid="search-all-btn">
            {searching ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" />...</> : <><Search className="w-4 h-4 mr-1" />Search</>}
          </Button>
        </div>

        {/* Search Result */}
        <AnimatePresence>
          {searchResult && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="bg-[#22c55e]/10 border border-[#22c55e]/30 rounded-lg p-3">
              <div className="flex items-center gap-2 text-[#22c55e] text-sm"><Check className="w-4 h-4" /><span className="font-semibold">{searchResult.new_listings_found} new found</span></div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Watchlist */}
        <div className="bg-[#111] border border-[#1a1a1a] rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-[#1a1a1a]">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2"><Tag className="w-3.5 h-3.5 text-[#3b82f6]" />Watchlist</h3>
            <button onClick={() => setShowAddForm(!showAddForm)} className="text-[#3b82f6] p-1 hover:bg-white/5 rounded" data-testid="add-card-toggle">
              {showAddForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            </button>
          </div>

          <AnimatePresence>
            {showAddForm && (
              <motion.form initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
                onSubmit={handleAddCard} className="overflow-hidden">
                <div className="p-3 bg-[#0a0a0a] border-b border-[#1a1a1a] space-y-2">
                  <Input placeholder="ej: 1996 Topps Kobe Bryant #138" value={newCardQuery} onChange={(e) => setNewCardQuery(e.target.value)}
                    className="bg-[#111] border-[#1a1a1a] text-white h-8 text-sm" data-testid="new-card-input" />
                  <Input placeholder="Notas (opcional)" value={newCardNotes} onChange={(e) => setNewCardNotes(e.target.value)}
                    className="bg-[#111] border-[#1a1a1a] text-white h-8 text-xs" data-testid="new-card-notes" />
                  <Button type="submit" disabled={!newCardQuery.trim()} className="w-full bg-[#22c55e] hover:bg-[#16a34a] h-8 text-sm" data-testid="add-card-btn">
                    <Plus className="w-3 h-3 mr-1" />Add
                  </Button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>

          <div className="divide-y divide-[#1a1a1a] max-h-[250px] sm:max-h-[400px] overflow-y-auto">
            {loadingWatchlist ? (
              <div className="p-6 text-center text-gray-600"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>
            ) : watchlist.length === 0 ? (
              <div className="p-6 text-center text-gray-600"><Tag className="w-6 h-6 mx-auto mb-1 opacity-50" /><p className="text-xs">Empty watchlist</p></div>
            ) : (
              watchlist.map((card) => (
                <div key={card.id} className={`p-2.5 hover:bg-white/5 transition-colors ${selectedCard === card.id ? 'bg-[#3b82f6]/10 border-l-2 border-[#3b82f6]' : ''}`}>
                  {editingCard === card.id ? (
                    <div className="space-y-1.5">
                      <Input value={editQuery} onChange={(e) => setEditQuery(e.target.value)} className="bg-[#0a0a0a] border-[#1a1a1a] text-white text-xs h-7" data-testid="edit-card-input" />
                      <Input value={editNotes} onChange={(e) => setEditNotes(e.target.value)} placeholder="Notas" className="bg-[#0a0a0a] border-[#1a1a1a] text-white text-xs h-7" />
                      <div className="flex gap-1">
                        <Button size="sm" onClick={handleSaveEdit} className="bg-[#22c55e] h-6 px-2 text-xs"><Check className="w-3 h-3" /></Button>
                        <Button size="sm" variant="ghost" onClick={handleCancelEdit} className="h-6 px-2"><X className="w-3 h-3" /></Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-1">
                      <div className="flex-1 cursor-pointer min-w-0" onClick={() => setSelectedCard(selectedCard === card.id ? null : card.id)}>
                        <p className="text-sm text-white font-medium truncate">{card.search_query}</p>
                        {card.notes && <p className="text-xs text-gray-500 truncate">{card.notes}</p>}
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-600">
                          <span>{card.listings_found} listings</span>
                          {card.last_searched && <span><Clock className="w-2.5 h-2.5 inline mr-0.5" />{new Date(card.last_searched).toLocaleDateString()}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5 flex-shrink-0">
                        <button onClick={() => handleStartEdit(card)} className="text-gray-600 hover:text-white p-1"><Edit2 className="w-3 h-3" /></button>
                        <button onClick={() => handleRemoveCard(card.id)} className="text-red-500 hover:text-red-400 p-1" data-testid={`remove-card-${card.id}`}><Trash2 className="w-3 h-3" /></button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* RIGHT: Listings */}
      <div className="lg:col-span-3 space-y-3">
        {/* Status Filter Tabs + View Toggle */}
        <div className="flex gap-1.5 sm:gap-2 items-center">
          <div className="flex gap-1 flex-1 overflow-x-auto scrollbar-hide">
            {[
              { value: 'new', label: 'New', icon: AlertCircle },
              { value: 'interested', label: 'Favs', icon: Star },
              { value: 'all', label: 'All', icon: Eye }
            ].map(({ value, label, icon: Icon }) => (
              <button key={value} onClick={() => setStatusFilter(value)}
                className={`flex-1 flex items-center justify-center gap-1 py-1.5 sm:py-2 rounded text-[10px] sm:text-xs font-semibold uppercase tracking-wider transition-colors whitespace-nowrap ${
                  statusFilter === value ? 'bg-[#3b82f6] text-white' : 'bg-[#111] text-gray-500 hover:text-white border border-[#1a1a1a]'
                }`} data-testid={`filter-${value}`}>
                <Icon className="w-3 h-3 sm:w-3.5 sm:h-3.5" />{label}
              </button>
            ))}
          </div>
          <ViewToggle view={viewMode} onChange={setViewMode} />
        </div>

        {/* Listing Type Filter */}
        <div className="flex gap-1 items-center overflow-x-auto scrollbar-hide pb-0.5">
          <Filter className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-gray-600 mr-0.5 flex-shrink-0" />
          {[
            { value: 'all', label: 'All', color: 'bg-[#3b82f6]' },
            { value: 'auction', label: 'Auction', color: 'bg-[#f59e0b]' },
            { value: 'buy_now', label: 'BIN', color: 'bg-[#22c55e]' },
            { value: 'offers', label: 'Offer', color: 'bg-purple-500' },
          ].map(({ value, label, color }) => (
            <button key={value} onClick={() => setTypeFilter(value)}
              className={`px-2 sm:px-2.5 py-1 rounded text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider transition-colors whitespace-nowrap flex-shrink-0 ${
                typeFilter === value ? `${color} text-white` : 'bg-[#0a0a0a] text-gray-500 hover:text-white border border-[#1a1a1a]'
              }`} data-testid={`type-filter-${value}`}>
              {label}
            </button>
          ))}
        </div>

        {/* Listings Content */}
        <div className="space-y-3">
          {loadingListings ? (
            <div className="text-center py-8 text-gray-600"><Loader2 className="w-5 h-5 animate-spin mx-auto mb-1" /><p className="text-xs">Cargando...</p></div>
          ) : listings.length === 0 ? (
            <div className="text-center py-8 text-gray-600 bg-[#111] border border-[#1a1a1a] rounded-lg">
              <Search className="w-6 h-6 mx-auto mb-1 opacity-50" /><p className="text-xs">No hay listings</p>
            </div>
          ) : (
            Object.entries(listingsByCard).map(([cardName, cardListings]) => (
              <div key={cardName} className="bg-[#111] border border-[#1a1a1a] rounded-lg overflow-hidden">
                <button onClick={() => setExpandedListings(prev => ({ ...prev, [cardName]: !prev[cardName] }))}
                  className="w-full flex items-center justify-between px-3 py-2 hover:bg-white/5" data-testid={`expand-${cardName}`}>
                  <div className="flex items-center gap-2">
                    <Tag className="w-3.5 h-3.5 text-[#3b82f6]" />
                    <span className="text-sm font-medium text-white">{cardName}</span>
                    <span className="text-xs text-gray-600">{cardListings.length}</span>
                  </div>
                  {expandedListings[cardName] ? <ChevronUp className="w-4 h-4 text-gray-600" /> : <ChevronDown className="w-4 h-4 text-gray-600" />}
                </button>

                <AnimatePresence>
                  {(expandedListings[cardName] !== false) && (
                    <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                      {viewMode === 'grid' ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-3 p-2.5 sm:p-3">
                          {cardListings.map((listing) => (
                            <div key={listing.id} className={`bg-[#0a0a0a] border rounded-lg overflow-hidden hover:border-[#3b82f6]/30 transition-all ${listing.status === 'interested' ? 'border-[#eab308]/30' : 'border-[#1a1a1a]'}`} data-testid={`listing-${listing.id}`}>
                              <div className="aspect-square bg-[#0a0a0a] relative">
                                <img src={listing.image_url} alt="" className="w-full h-full object-contain"
                                  onError={(e) => { e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect fill="%23121212" width="200" height="200"/></svg>'; }} />
                                <div className="absolute top-1.5 left-1.5">
                                  <Badge variant="outline" className="border-[#22c55e] text-[#22c55e] bg-black/70 text-xs px-2 py-0.5">
                                    <DollarSign className="w-3 h-3 mr-0.5" />{listing.price}
                                  </Badge>
                                </div>
                                <div className="absolute top-1.5 right-1.5 flex gap-1">
                                  <Badge variant="outline" className={`bg-black/70 text-xs px-1.5 py-0.5 ${listing.listing_type === 'auction' ? 'border-[#f59e0b] text-[#f59e0b]' : 'border-[#3b82f6] text-[#3b82f6]'}`}>
                                    {listing.listing_type === 'auction' ? <><Gavel className="w-3 h-3" />{listing.bids !== null && <span className="ml-0.5">{listing.bids}</span>}</> : 'BIN'}
                                  </Badge>
                                  {listing.accepts_offers && (
                                    <Badge variant="outline" className="bg-black/70 text-xs px-1.5 py-0.5 border-purple-400 text-purple-400">
                                      <MessageSquare className="w-3 h-3" />
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              <div className="p-2.5">
                                <p className="text-xs text-white font-medium line-clamp-2 mb-2 leading-relaxed">{listing.title}</p>
                                {listing.time_left && <p className="text-[10px] text-gray-600 mb-2 flex items-center gap-1"><Clock className="w-2.5 h-2.5" />{formatTimeLeft(listing.time_left)}</p>}
                                <ListingActions listing={listing} isGrid={true} />
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="divide-y divide-[#1a1a1a]">
                          {cardListings.map((listing) => (
                            <div key={listing.id} className={`flex items-start sm:items-center gap-2.5 sm:gap-3 p-2.5 sm:p-3 hover:bg-white/[0.02] transition-colors ${listing.status === 'interested' ? 'bg-[#eab308]/5' : ''}`} data-testid={`listing-${listing.id}`}>
                              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded bg-[#0a0a0a] border border-[#1a1a1a] overflow-hidden flex-shrink-0">
                                <img src={listing.image_url} alt="" className="w-full h-full object-contain"
                                  onError={(e) => { e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect fill="%23121212" width="200" height="200"/></svg>'; }} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[11px] sm:text-xs text-white font-medium truncate">{listing.title}</p>
                                <div className="flex items-center gap-1.5 sm:gap-2 mt-0.5 flex-wrap">
                                  <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${listing.listing_type === 'auction' ? 'border-[#f59e0b] text-[#f59e0b]' : 'border-[#3b82f6] text-[#3b82f6]'}`}>
                                    {listing.listing_type === 'auction' ? 'Auction' : 'BIN'}
                                  </Badge>
                                  {listing.accepts_offers && (
                                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-purple-400 text-purple-400">Offers</Badge>
                                  )}
                                  {listing.time_left && <span className="text-[10px] text-gray-600 flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" />{formatTimeLeft(listing.time_left)}</span>}
                                </div>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <p className="text-sm font-bold text-[#22c55e]">{listing.price}</p>
                                {listing.bids !== null && listing.listing_type === 'auction' && <p className="text-[10px] text-gray-500">{listing.bids} bids</p>}
                              </div>
                              <ListingActions listing={listing} isGrid={false} />
                            </div>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))
          )}
        </div>
      </div>
    </div>

    {/* Buy Now Modal */}
    <ActionModal isOpen={!!buyModal} onClose={closeModals} title="Buy It Now">
      {buyModal && (
        <div className="space-y-4">
          <div className="flex gap-3 bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-3">
            {buyModal.image_url && <img src={buyModal.image_url} alt="" className="w-16 h-16 rounded object-contain bg-[#111]" />}
            <div className="flex-1 min-w-0">
              <p className="text-xs text-white font-medium line-clamp-2">{buyModal.title}</p>
              <p className="text-lg font-bold text-[#22c55e] mt-1">{buyModal.price}</p>
            </div>
          </div>
          {actionResult ? (
            <div className={`space-y-2`}>
              <div className={`p-3 rounded-lg border ${actionResult.success ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-orange-500/10 border-orange-500/30 text-orange-400'}`}>
                <p className="text-sm flex items-center gap-2">
                  {actionResult.success ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                  {actionResult.message}
                </p>
              </div>
              {actionResult.redirect && buyModal?.listing_url && (
                <a href={buyModal.listing_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-2.5 bg-[#3b82f6] hover:bg-[#2563eb] text-white rounded-lg text-sm font-semibold transition-colors" data-testid="buy-ebay-redirect">
                  <ExternalLink className="w-4 h-4" />Complete on eBay
                </a>
              )}
            </div>
          ) : (
            <>
              <p className="text-xs text-gray-400">This will purchase the item at the listed price. Make sure your eBay payment method is set up.</p>
              <div className="flex gap-2">
                <Button onClick={closeModals} variant="ghost" className="flex-1 text-gray-400" data-testid="buy-cancel-btn">Cancel</Button>
                <Button onClick={handleBuyNow} disabled={actionLoading}
                  className="flex-1 bg-[#22c55e] hover:bg-[#16a34a] text-white" data-testid="buy-confirm-btn">
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><ShoppingCart className="w-4 h-4 mr-2" />Buy Now</>}
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </ActionModal>

    {/* Make Offer Modal */}
    <ActionModal isOpen={!!offerModal} onClose={closeModals} title="Make an Offer">
      {offerModal && (
        <div className="space-y-4">
          <div className="flex gap-3 bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-3">
            {offerModal.image_url && <img src={offerModal.image_url} alt="" className="w-16 h-16 rounded object-contain bg-[#111]" />}
            <div className="flex-1 min-w-0">
              <p className="text-xs text-white font-medium line-clamp-2">{offerModal.title}</p>
              <p className="text-sm text-gray-400 mt-1">Listed: <span className="text-white font-medium">{offerModal.price}</span></p>
            </div>
          </div>
          {actionResult ? (
            <div className="space-y-2">
              <div className={`p-3 rounded-lg border ${actionResult.success ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-orange-500/10 border-orange-500/30 text-orange-400'}`}>
                <p className="text-sm flex items-center gap-2">
                  {actionResult.success ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                  {actionResult.message}
                </p>
              </div>
              {actionResult.redirect && offerModal?.listing_url && (
                <a href={offerModal.listing_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-semibold transition-colors" data-testid="offer-ebay-redirect">
                  <ExternalLink className="w-4 h-4" />Make Offer on eBay
                </a>
              )}
            </div>
          ) : (
            <>
              <div>
                <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Your Offer ($)</label>
                <div className="relative">
                  <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
                  <Input type="number" step="0.01" min="0.01" placeholder="0.00" value={offerAmount}
                    onChange={(e) => setOfferAmount(e.target.value)}
                    className="bg-[#0a0a0a] border-[#1a1a1a] text-white h-10 text-lg pl-8 font-bold"
                    data-testid="offer-amount-input" />
                </div>
              </div>
              <div>
                <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Message (optional)</label>
                <Input placeholder="I'm interested in this card..." value={offerMessage}
                  onChange={(e) => setOfferMessage(e.target.value)}
                  className="bg-[#0a0a0a] border-[#1a1a1a] text-white h-9 text-sm"
                  data-testid="offer-message-input" />
              </div>
              <div className="flex gap-2">
                <Button onClick={closeModals} variant="ghost" className="flex-1 text-gray-400" data-testid="offer-cancel-btn">Cancel</Button>
                <Button onClick={handleMakeOffer} disabled={actionLoading || !offerAmount}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 text-white" data-testid="offer-confirm-btn">
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><MessageSquare className="w-4 h-4 mr-2" />Send Offer</>}
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </ActionModal>
    </>
  );
};

export default EbayMonitor;
