import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import {
  Search, Plus, Trash2, ExternalLink, Clock, Tag, Eye, Star, XCircle,
  Loader2, ChevronDown, ChevronUp, Gavel, DollarSign, AlertCircle,
  Edit2, Check, X
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';

const API = process.env.REACT_APP_BACKEND_URL;

const EbayMonitor = ({ onAnalyzeCard }) => {
  const apiBase = `${API}/api`;
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
  const [editingCard, setEditingCard] = useState(null);
  const [editQuery, setEditQuery] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [expandedListings, setExpandedListings] = useState({});

  const loadWatchlist = useCallback(async () => {
    try { setLoadingWatchlist(true); const r = await axios.get(`${apiBase}/watchlist`); setWatchlist(r.data); }
    catch (e) { console.error(e); } finally { setLoadingWatchlist(false); }
  }, []);

  const loadListings = useCallback(async () => {
    try {
      setLoadingListings(true);
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== 'all') params.append('status', statusFilter);
      if (selectedCard) params.append('watchlist_card_id', selectedCard);
      const r = await axios.get(`${apiBase}/listings?${params.toString()}`);
      setListings(r.data);
    } catch (e) { console.error(e); } finally { setLoadingListings(false); }
  }, [statusFilter, selectedCard]);

  useEffect(() => { loadWatchlist(); }, [loadWatchlist]);
  useEffect(() => { loadListings(); }, [loadListings]);

  const handleAddCard = async (e) => {
    e.preventDefault();
    if (!newCardQuery.trim()) return;
    try { await axios.post(`${apiBase}/watchlist`, { search_query: newCardQuery.trim(), notes: newCardNotes.trim() || null }); setNewCardQuery(''); setNewCardNotes(''); setShowAddForm(false); loadWatchlist(); }
    catch (e) { console.error(e); }
  };

  const handleRemoveCard = async (cardId) => {
    if (!window.confirm('Eliminar tarjeta y sus listings?')) return;
    try { await axios.delete(`${apiBase}/watchlist/${cardId}`); loadWatchlist(); loadListings(); } catch (e) { console.error(e); }
  };

  const handleStartEdit = (card) => { setEditingCard(card.id); setEditQuery(card.search_query); setEditNotes(card.notes || ''); };
  const handleSaveEdit = async () => { try { await axios.put(`${apiBase}/watchlist/${editingCard}`, { search_query: editQuery.trim(), notes: editNotes.trim() || null }); setEditingCard(null); loadWatchlist(); } catch (e) { console.error(e); } };
  const handleCancelEdit = () => { setEditingCard(null); };

  const handleSearchAll = async () => {
    if (watchlist.length === 0) { alert('Agrega tarjetas primero'); return; }
    try { setSearching(true); setSearchResult(null); const r = await axios.post(`${apiBase}/watchlist/search`); setSearchResult(r.data); loadWatchlist(); loadListings(); }
    catch (e) { console.error(e); alert('Error al buscar'); } finally { setSearching(false); }
  };

  const handleUpdateStatus = async (id, status) => { try { await axios.put(`${apiBase}/listings/${id}/status?status=${status}`); loadListings(); } catch (e) { console.error(e); } };
  const handleDeleteListing = async (id) => { try { await axios.delete(`${apiBase}/listings/${id}`); loadListings(); } catch (e) { console.error(e); } };

  const listingsByCard = listings.reduce((acc, l) => { const k = l.search_query; if (!acc[k]) acc[k] = []; acc[k].push(l); return acc; }, {});
  const stats = { totalCards: watchlist.length, newListings: listings.filter(l => l.status === 'new').length, interestedListings: listings.filter(l => l.status === 'interested').length };

  return (
    <div className="grid lg:grid-cols-5 gap-4">
      {/* LEFT: Watchlist Controls */}
      <div className="lg:col-span-2 space-y-3">
        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-[#111] border border-[#1a1a1a] rounded-lg p-2 text-center">
            <div className="text-lg font-bold text-white">{stats.totalCards}</div>
            <div className="text-[9px] text-gray-600 uppercase tracking-wider">Tarjetas</div>
          </div>
          <div className="bg-[#111] border border-[#1a1a1a] rounded-lg p-2 text-center">
            <div className="text-lg font-bold text-[#22c55e]">{stats.newListings}</div>
            <div className="text-[9px] text-gray-600 uppercase tracking-wider">Nuevos</div>
          </div>
          <div className="bg-[#111] border border-[#1a1a1a] rounded-lg p-2 text-center">
            <div className="text-lg font-bold text-[#eab308]">{stats.interestedListings}</div>
            <div className="text-[9px] text-gray-600 uppercase tracking-wider">Favoritos</div>
          </div>
        </div>

        {/* Search Button */}
        <Button onClick={handleSearchAll} disabled={searching || watchlist.length === 0}
          className="w-full bg-[#3b82f6] hover:bg-[#2563eb] text-white font-heading uppercase tracking-wider h-10" data-testid="search-all-btn">
          {searching ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Buscando...</> : <><Search className="w-4 h-4 mr-2" />Buscar Listings</>}
        </Button>

        {/* Search Result */}
        <AnimatePresence>
          {searchResult && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="bg-[#22c55e]/10 border border-[#22c55e]/30 rounded-lg p-3">
              <div className="flex items-center gap-2 text-[#22c55e] text-sm"><Check className="w-4 h-4" /><span className="font-semibold">{searchResult.new_listings_found} nuevos encontrados</span></div>
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
                    <Plus className="w-3 h-3 mr-1" />Agregar
                  </Button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>

          <div className="divide-y divide-[#1a1a1a] max-h-[400px] overflow-y-auto">
            {loadingWatchlist ? (
              <div className="p-6 text-center text-gray-600"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>
            ) : watchlist.length === 0 ? (
              <div className="p-6 text-center text-gray-600"><Tag className="w-6 h-6 mx-auto mb-1 opacity-50" /><p className="text-xs">Watchlist vacía</p></div>
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
        {/* Filter Tabs */}
        <div className="flex gap-1">
          {[
            { value: 'new', label: 'Nuevos', icon: AlertCircle },
            { value: 'interested', label: 'Favoritos', icon: Star },
            { value: 'all', label: 'Todos', icon: Eye }
          ].map(({ value, label, icon: Icon }) => (
            <button key={value} onClick={() => setStatusFilter(value)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded text-xs font-semibold uppercase tracking-wider transition-colors ${
                statusFilter === value ? 'bg-[#3b82f6] text-white' : 'bg-[#111] text-gray-500 hover:text-white border border-[#1a1a1a]'
              }`} data-testid={`filter-${value}`}>
              <Icon className="w-3.5 h-3.5" />{label}
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
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 p-3">
                        {cardListings.map((listing) => (
                          <div key={listing.id} className={`bg-[#0a0a0a] border rounded-lg overflow-hidden hover:border-[#3b82f6]/30 transition-all ${listing.status === 'interested' ? 'border-[#eab308]/30' : 'border-[#1a1a1a]'}`} data-testid={`listing-${listing.id}`}>
                            {/* Image */}
                            <div className="aspect-square bg-[#0a0a0a] relative">
                              <img src={listing.image_url} alt="" className="w-full h-full object-contain"
                                onError={(e) => { e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect fill="%23121212" width="200" height="200"/></svg>'; }} />
                              {/* Price Badge */}
                              <div className="absolute top-1.5 left-1.5">
                                <Badge variant="outline" className="border-[#22c55e] text-[#22c55e] bg-black/70 text-xs px-2 py-0.5">
                                  <DollarSign className="w-3 h-3 mr-0.5" />{listing.price}
                                </Badge>
                              </div>
                              {/* Type Badge */}
                              <div className="absolute top-1.5 right-1.5">
                                <Badge variant="outline" className={`bg-black/70 text-xs px-1.5 py-0.5 ${listing.listing_type === 'auction' ? 'border-[#f59e0b] text-[#f59e0b]' : 'border-[#3b82f6] text-[#3b82f6]'}`}>
                                  {listing.listing_type === 'auction' ? <><Gavel className="w-3 h-3" />{listing.bids !== null && <span className="ml-0.5">{listing.bids}</span>}</> : 'BIN'}
                                </Badge>
                              </div>
                            </div>
                            {/* Info */}
                            <div className="p-2.5">
                              <p className="text-xs text-white font-medium line-clamp-2 mb-2 leading-relaxed">{listing.title}</p>
                              {listing.time_left && <p className="text-[10px] text-gray-600 mb-2 flex items-center gap-1"><Clock className="w-2.5 h-2.5" />{listing.time_left}</p>}
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
                                  <Search className="w-2.5 h-2.5" />Analizar</button>}
                                <button onClick={() => handleDeleteListing(listing.id)}
                                  className="text-[10px] bg-red-500/10 text-red-500 px-2 py-1 rounded hover:bg-red-500/20 inline-flex items-center gap-0.5" data-testid={`delete-listing-${listing.id}`}>
                                  <Trash2 className="w-2.5 h-2.5" />Borrar</button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default EbayMonitor;
