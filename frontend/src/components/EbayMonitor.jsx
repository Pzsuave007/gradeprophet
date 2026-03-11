import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import {
  Search,
  Plus,
  Trash2,
  ExternalLink,
  Clock,
  Tag,
  Eye,
  Star,
  XCircle,
  RefreshCw,
  Loader2,
  ChevronDown,
  ChevronUp,
  Gavel,
  DollarSign,
  AlertCircle,
  Edit2,
  Check,
  X
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';

const API = process.env.REACT_APP_BACKEND_URL;

const EbayMonitor = ({ onAnalyzeCard }) => {
  // API base path
  const apiBase = `${API}/api`;
  // Watchlist state
  const [watchlist, setWatchlist] = useState([]);
  const [newCardQuery, setNewCardQuery] = useState('');
  const [newCardNotes, setNewCardNotes] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [loadingWatchlist, setLoadingWatchlist] = useState(true);
  
  // Listings state
  const [listings, setListings] = useState([]);
  const [loadingListings, setLoadingListings] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState(null);
  
  // Filter state
  const [selectedCard, setSelectedCard] = useState(null); // null = all cards
  const [statusFilter, setStatusFilter] = useState('new'); // new, all, interested
  
  // Edit state
  const [editingCard, setEditingCard] = useState(null);
  const [editQuery, setEditQuery] = useState('');
  const [editNotes, setEditNotes] = useState('');
  
  // Expanded cards state
  const [expandedListings, setExpandedListings] = useState({});

  // Load watchlist
  const loadWatchlist = useCallback(async () => {
    try {
      setLoadingWatchlist(true);
      const response = await axios.get(`${apiBase}/watchlist`);
      setWatchlist(response.data);
    } catch (error) {
      console.error('Error loading watchlist:', error);
    } finally {
      setLoadingWatchlist(false);
    }
  }, []);

  // Load listings
  const loadListings = useCallback(async () => {
    try {
      setLoadingListings(true);
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== 'all') {
        params.append('status', statusFilter);
      }
      if (selectedCard) {
        params.append('watchlist_card_id', selectedCard);
      }
      const response = await axios.get(`${apiBase}/listings?${params.toString()}`);
      setListings(response.data);
    } catch (error) {
      console.error('Error loading listings:', error);
    } finally {
      setLoadingListings(false);
    }
  }, [statusFilter, selectedCard]);

  useEffect(() => {
    loadWatchlist();
  }, [loadWatchlist]);

  useEffect(() => {
    loadListings();
  }, [loadListings]);

  // Add card to watchlist
  const handleAddCard = async (e) => {
    e.preventDefault();
    if (!newCardQuery.trim()) return;

    try {
      await axios.post(`${apiBase}/watchlist`, {
        search_query: newCardQuery.trim(),
        notes: newCardNotes.trim() || null
      });
      setNewCardQuery('');
      setNewCardNotes('');
      setShowAddForm(false);
      loadWatchlist();
    } catch (error) {
      console.error('Error adding card:', error);
    }
  };

  // Remove card from watchlist
  const handleRemoveCard = async (cardId) => {
    if (!window.confirm('¿Eliminar esta tarjeta de la watchlist? También se eliminarán todos sus listings.')) return;
    
    try {
      await axios.delete(`${apiBase}/watchlist/${cardId}`);
      loadWatchlist();
      loadListings();
    } catch (error) {
      console.error('Error removing card:', error);
    }
  };

  // Edit card
  const handleStartEdit = (card) => {
    setEditingCard(card.id);
    setEditQuery(card.search_query);
    setEditNotes(card.notes || '');
  };

  const handleSaveEdit = async () => {
    try {
      await axios.put(`${apiBase}/watchlist/${editingCard}`, {
        search_query: editQuery.trim(),
        notes: editNotes.trim() || null
      });
      setEditingCard(null);
      loadWatchlist();
    } catch (error) {
      console.error('Error updating card:', error);
    }
  };

  const handleCancelEdit = () => {
    setEditingCard(null);
    setEditQuery('');
    setEditNotes('');
  };

  // Search all watchlist
  const handleSearchAll = async () => {
    if (watchlist.length === 0) {
      alert('Agrega tarjetas a tu watchlist primero');
      return;
    }

    try {
      setSearching(true);
      setSearchResult(null);
      const response = await axios.post(`${apiBase}/watchlist/search`);
      setSearchResult(response.data);
      loadWatchlist();
      loadListings();
    } catch (error) {
      console.error('Error searching:', error);
      alert('Error al buscar. Intenta de nuevo.');
    } finally {
      setSearching(false);
    }
  };

  // Update listing status
  const handleUpdateStatus = async (listingId, newStatus) => {
    try {
      await axios.put(`${apiBase}/listings/${listingId}/status?status=${newStatus}`);
      loadListings();
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  // Group listings by card
  const listingsByCard = listings.reduce((acc, listing) => {
    const key = listing.search_query;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(listing);
    return acc;
  }, {});

  // Stats
  const stats = {
    totalCards: watchlist.length,
    newListings: listings.filter(l => l.status === 'new').length,
    interestedListings: listings.filter(l => l.status === 'interested').length
  };

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-[#121212] border border-[#27272a] rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-white">{stats.totalCards}</div>
          <div className="text-xs text-gray-500 uppercase tracking-wider">Tarjetas</div>
        </div>
        <div className="bg-[#121212] border border-[#27272a] rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-[#22c55e]">{stats.newListings}</div>
          <div className="text-xs text-gray-500 uppercase tracking-wider">Nuevos</div>
        </div>
        <div className="bg-[#121212] border border-[#27272a] rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-[#eab308]">{stats.interestedListings}</div>
          <div className="text-xs text-gray-500 uppercase tracking-wider">Interesantes</div>
        </div>
      </div>

      {/* Search Button */}
      <Button
        onClick={handleSearchAll}
        disabled={searching || watchlist.length === 0}
        className="w-full bg-[#3b82f6] hover:bg-[#2563eb] text-white font-heading uppercase tracking-wider"
        data-testid="search-all-btn"
      >
        {searching ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Buscando en eBay...
          </>
        ) : (
          <>
            <Search className="w-4 h-4 mr-2" />
            Buscar Nuevos Listings
          </>
        )}
      </Button>

      {/* Search Result */}
      <AnimatePresence>
        {searchResult && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-[#22c55e]/10 border border-[#22c55e]/30 rounded-lg p-4"
          >
            <div className="flex items-center gap-2 text-[#22c55e]">
              <Check className="w-5 h-5" />
              <span className="font-semibold">Búsqueda completada</span>
            </div>
            <p className="text-sm text-gray-400 mt-1">
              Se buscaron {searchResult.total_cards_searched} tarjetas. 
              Se encontraron <span className="text-white font-semibold">{searchResult.new_listings_found}</span> nuevos listings.
            </p>
            {searchResult.cards_with_results.length > 0 && (
              <p className="text-xs text-gray-500 mt-2">
                Resultados para: {searchResult.cards_with_results.join(', ')}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Watchlist Section */}
      <div className="bg-[#121212] border border-[#27272a] rounded-lg overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-[#27272a]">
          <h3 className="font-heading text-sm font-semibold uppercase tracking-wider text-white flex items-center gap-2">
            <Tag className="w-4 h-4 text-[#3b82f6]" />
            Mi Watchlist
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAddForm(!showAddForm)}
            className="text-[#3b82f6]"
            data-testid="add-card-toggle"
          >
            {showAddForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          </Button>
        </div>

        {/* Add Card Form */}
        <AnimatePresence>
          {showAddForm && (
            <motion.form
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              onSubmit={handleAddCard}
              className="p-4 bg-[#0a0a0a] border-b border-[#27272a] overflow-hidden"
            >
              <div className="space-y-3">
                <Input
                  placeholder="ej: 1996 Topps Kobe Bryant #138"
                  value={newCardQuery}
                  onChange={(e) => setNewCardQuery(e.target.value)}
                  className="bg-[#121212] border-[#27272a] text-white"
                  data-testid="new-card-input"
                />
                <Input
                  placeholder="Notas (opcional)"
                  value={newCardNotes}
                  onChange={(e) => setNewCardNotes(e.target.value)}
                  className="bg-[#121212] border-[#27272a] text-white text-sm"
                  data-testid="new-card-notes"
                />
                <Button
                  type="submit"
                  disabled={!newCardQuery.trim()}
                  className="w-full bg-[#22c55e] hover:bg-[#16a34a]"
                  data-testid="add-card-btn"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Agregar a Watchlist
                </Button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>

        {/* Watchlist Cards */}
        <div className="divide-y divide-[#27272a] max-h-64 overflow-y-auto">
          {loadingWatchlist ? (
            <div className="p-8 text-center text-gray-500">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
              Cargando...
            </div>
          ) : watchlist.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Tag className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No hay tarjetas en tu watchlist</p>
              <p className="text-xs mt-1">Agrega tarjetas para empezar a monitorear</p>
            </div>
          ) : (
            watchlist.map((card) => (
              <div
                key={card.id}
                className={`p-3 hover:bg-white/5 transition-colors ${
                  selectedCard === card.id ? 'bg-[#3b82f6]/10 border-l-2 border-[#3b82f6]' : ''
                }`}
              >
                {editingCard === card.id ? (
                  // Edit mode
                  <div className="space-y-2">
                    <Input
                      value={editQuery}
                      onChange={(e) => setEditQuery(e.target.value)}
                      className="bg-[#0a0a0a] border-[#27272a] text-white text-sm"
                      data-testid="edit-card-input"
                    />
                    <Input
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      placeholder="Notas"
                      className="bg-[#0a0a0a] border-[#27272a] text-white text-xs"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleSaveEdit} className="bg-[#22c55e] hover:bg-[#16a34a]">
                        <Check className="w-3 h-3" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={handleCancelEdit}>
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  // View mode
                  <div className="flex items-start justify-between gap-2">
                    <div 
                      className="flex-1 cursor-pointer"
                      onClick={() => setSelectedCard(selectedCard === card.id ? null : card.id)}
                    >
                      <p className="text-sm text-white font-medium">{card.search_query}</p>
                      {card.notes && (
                        <p className="text-xs text-gray-500 mt-0.5">{card.notes}</p>
                      )}
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                        <span>{card.listings_found} listings</span>
                        {card.last_searched && (
                          <span>
                            <Clock className="w-3 h-3 inline mr-1" />
                            {new Date(card.last_searched).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleStartEdit(card)}
                        className="text-gray-500 hover:text-white p-1 h-auto"
                      >
                        <Edit2 className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveCard(card.id)}
                        className="text-red-500 hover:text-red-400 p-1 h-auto"
                        data-testid={`remove-card-${card.id}`}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {[
          { value: 'new', label: 'Nuevos', icon: AlertCircle },
          { value: 'interested', label: 'Interesantes', icon: Star },
          { value: 'all', label: 'Todos', icon: Eye }
        ].map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            onClick={() => setStatusFilter(value)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors ${
              statusFilter === value
                ? 'bg-[#3b82f6] text-white'
                : 'bg-[#121212] text-gray-400 hover:text-white border border-[#27272a]'
            }`}
            data-testid={`filter-${value}`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Listings */}
      <div className="space-y-4">
        {loadingListings ? (
          <div className="text-center py-8 text-gray-500">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
            Cargando listings...
          </div>
        ) : listings.length === 0 ? (
          <div className="text-center py-8 text-gray-500 bg-[#121212] border border-[#27272a] rounded-lg">
            <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No hay listings {statusFilter !== 'all' ? statusFilter === 'new' ? 'nuevos' : 'interesantes' : ''}</p>
            <p className="text-xs mt-1">Haz clic en "Buscar Nuevos Listings" para actualizar</p>
          </div>
        ) : (
          Object.entries(listingsByCard).map(([cardName, cardListings]) => (
            <div key={cardName} className="bg-[#121212] border border-[#27272a] rounded-lg overflow-hidden">
              {/* Card Header */}
              <button
                onClick={() => setExpandedListings(prev => ({ ...prev, [cardName]: !prev[cardName] }))}
                className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
                data-testid={`expand-${cardName}`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-[#3b82f6]/20 rounded flex items-center justify-center">
                    <Tag className="w-4 h-4 text-[#3b82f6]" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium text-white">{cardName}</p>
                    <p className="text-xs text-gray-500">{cardListings.length} listings</p>
                  </div>
                </div>
                {expandedListings[cardName] ? (
                  <ChevronUp className="w-5 h-5 text-gray-500" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-500" />
                )}
              </button>

              {/* Listings */}
              <AnimatePresence>
                {(expandedListings[cardName] !== false) && (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: 'auto' }}
                    exit={{ height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="divide-y divide-[#27272a]">
                      {cardListings.map((listing) => (
                        <div
                          key={listing.id}
                          className={`p-4 hover:bg-white/5 transition-colors ${
                            listing.status === 'interested' ? 'bg-[#eab308]/5' : ''
                          }`}
                          data-testid={`listing-${listing.id}`}
                        >
                          <div className="flex gap-4">
                            {/* Image */}
                            <div className="w-20 h-20 flex-shrink-0 bg-[#0a0a0a] rounded overflow-hidden">
                              <img
                                src={listing.image_url}
                                alt={listing.title}
                                className="w-full h-full object-cover"
                                onError={(e) => { e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect fill="%23121212"/></svg>'; }}
                              />
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-white font-medium line-clamp-2 mb-2">
                                {listing.title}
                              </p>
                              
                              <div className="flex flex-wrap items-center gap-2 mb-2">
                                {/* Price */}
                                <Badge variant="outline" className="border-[#22c55e] text-[#22c55e]">
                                  <DollarSign className="w-3 h-3 mr-0.5" />
                                  {listing.price}
                                </Badge>

                                {/* Type */}
                                <Badge 
                                  variant="outline" 
                                  className={listing.listing_type === 'auction' 
                                    ? 'border-[#f59e0b] text-[#f59e0b]' 
                                    : 'border-[#3b82f6] text-[#3b82f6]'
                                  }
                                >
                                  {listing.listing_type === 'auction' ? (
                                    <>
                                      <Gavel className="w-3 h-3 mr-0.5" />
                                      Subasta
                                      {listing.bids !== null && ` (${listing.bids} pujas)`}
                                    </>
                                  ) : (
                                    <>
                                      <DollarSign className="w-3 h-3 mr-0.5" />
                                      Compra Directa
                                    </>
                                  )}
                                </Badge>

                                {/* Time Left */}
                                {listing.time_left && (
                                  <Badge variant="outline" className="border-gray-500 text-gray-400">
                                    <Clock className="w-3 h-3 mr-0.5" />
                                    {listing.time_left}
                                  </Badge>
                                )}
                              </div>

                              {/* Actions */}
                              <div className="flex items-center gap-2">
                                <a
                                  href={listing.listing_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-xs text-[#3b82f6] hover:underline"
                                  data-testid={`view-listing-${listing.id}`}
                                >
                                  <ExternalLink className="w-3 h-3" />
                                  Ver en eBay
                                </a>

                                <span className="text-gray-600">|</span>

                                {listing.status !== 'interested' && (
                                  <button
                                    onClick={() => handleUpdateStatus(listing.id, 'interested')}
                                    className="inline-flex items-center gap-1 text-xs text-[#eab308] hover:underline"
                                    data-testid={`mark-interested-${listing.id}`}
                                  >
                                    <Star className="w-3 h-3" />
                                    Interesante
                                  </button>
                                )}

                                {listing.status !== 'seen' && listing.status !== 'interested' && (
                                  <button
                                    onClick={() => handleUpdateStatus(listing.id, 'seen')}
                                    className="inline-flex items-center gap-1 text-xs text-gray-500 hover:underline"
                                  >
                                    <Eye className="w-3 h-3" />
                                    Visto
                                  </button>
                                )}

                                {listing.status === 'interested' && (
                                  <button
                                    onClick={() => handleUpdateStatus(listing.id, 'seen')}
                                    className="inline-flex items-center gap-1 text-xs text-gray-500 hover:underline"
                                  >
                                    <XCircle className="w-3 h-3" />
                                    Quitar de interesantes
                                  </button>
                                )}

                                {onAnalyzeCard && (
                                  <>
                                    <span className="text-gray-600">|</span>
                                    <button
                                      onClick={() => onAnalyzeCard(listing)}
                                      className="inline-flex items-center gap-1 text-xs text-[#22c55e] hover:underline"
                                      data-testid={`analyze-listing-${listing.id}`}
                                    >
                                      <Search className="w-3 h-3" />
                                      Analizar
                                    </button>
                                  </>
                                )}
                              </div>
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
  );
};

export default EbayMonitor;
