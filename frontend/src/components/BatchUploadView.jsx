import React, { useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Upload, ChevronLeft, RefreshCw, Check,
  Image as ImageIcon, Loader2
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

const BatchUploadView = ({ onClose, onComplete }) => {
  const fileRef = useRef(null);
  const [files, setFiles] = useState([]);
  const [pairingMode, setPairingMode] = useState('alternating');
  const [category, setCategory] = useState('collection');
  const [uploading, setUploading] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [done, setDone] = useState(false);

  const previewCacheRef = useRef({});
  const getPreview = useCallback((file) => {
    const key = `${file.name}_${file.size}_${file.lastModified}`;
    if (previewCacheRef.current[key]) return previewCacheRef.current[key];
    const url = URL.createObjectURL(file);
    previewCacheRef.current[key] = url;
    return url;
  }, []);

  React.useEffect(() => {
    return () => {
      Object.values(previewCacheRef.current).forEach(url => URL.revokeObjectURL(url));
    };
  }, []);

  const handleFiles = async (newFiles) => {
    const imageFiles = Array.from(newFiles).filter(f =>
      f.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|heic|heif)$/i.test(f.name)
    );
    if (imageFiles.length === 0) { toast.error('No image files found'); return; }

    setBuffering(true);
    const buffered = [];
    for (const file of imageFiles) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const safeFile = new File([arrayBuffer], file.name, {
          type: file.type || 'image/jpeg',
          lastModified: file.lastModified,
        });
        buffered.push(safeFile);
      } catch (e) {
        console.error(`Failed to buffer ${file.name}:`, e);
      }
    }
    setBuffering(false);

    if (buffered.length === 0) { toast.error('Could not read image files'); return; }
    buffered.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    setFiles(prev => [...prev, ...buffered]);
    toast.success(`${buffered.length} images loaded`);
  };

  const removeFile = (idx) => setFiles(prev => prev.filter((_, i) => i !== idx));

  const getPairs = () => {
    const p = [];
    if (pairingMode === 'alternating') {
      for (let i = 0; i < files.length; i += 2) {
        p.push({ front: files[i], back: files[i + 1] || null });
      }
    } else {
      files.forEach(f => p.push({ front: f, back: null }));
    }
    return p;
  };

  const pairs = getPairs();
  const cardCount = pairs.length;

  // Fast upload — just sends files to server queue, no waiting for AI
  const handleUpload = async () => {
    if (files.length === 0) return;
    setUploading(true);
    setDone(false);

    const uploadPairs = [...pairs];
    const total = uploadPairs.length;
    let queued = 0;
    let errors = 0;

    for (let i = 0; i < uploadPairs.length; i++) {
      const pair = uploadPairs[i];
      setProgress({ current: i, total });

      try {
        const formData = new FormData();
        formData.append('category', category);
        formData.append('front', pair.front);
        if (pair.back) formData.append('back', pair.back);

        await axios.post(`${API}/api/cards/batch-upload-queue`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 60000, // 60s just for upload (no AI wait)
        });
        queued++;
      } catch (err) {
        console.error(`Card ${i + 1} upload failed:`, err.response?.data?.detail || err.message);
        errors++;
      }

      setProgress({ current: i + 1, total });
    }

    setUploading(false);
    setDone(true);

    if (queued > 0) {
      toast.success(`${queued} cards uploaded! AI is identifying them in the background.`);
    }
    if (errors > 0) {
      toast.warning(`${errors} cards failed to upload`);
    }
  };

  return (
    <div className="h-full flex flex-col" data-testid="batch-upload-view">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-[#1a1a1a]">
        <button onClick={onClose} className="text-gray-400 hover:text-white" data-testid="batch-close-btn">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-lg font-bold text-white">Batch Upload</h2>
          <p className="text-xs text-gray-500">Upload photos — AI identifies in background</p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* Done state */}
        {done ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <Check className="w-8 h-8 text-emerald-400" />
            </div>
            <h3 className="text-lg font-semibold text-white">Upload Complete!</h3>
            <p className="text-sm text-gray-400 text-center max-w-xs">
              Cards are being processed by AI in the background. They'll appear in your inventory shortly.
            </p>
            <button
              onClick={() => { onComplete(); }}
              className="mt-4 px-6 py-3 rounded-lg bg-[#3b82f6] text-white text-sm font-semibold hover:bg-[#2563eb] transition-colors"
              data-testid="batch-done-btn"
            >
              Go to Inventory
            </button>
          </div>
        ) : (
          <>
            {/* Upload area */}
            <div
              className={`border-2 border-dashed border-[#2a2a2a] rounded-xl p-6 text-center cursor-pointer hover:border-[#3b82f6]/50 transition-colors ${(buffering || uploading) ? 'opacity-60 pointer-events-none' : ''}`}
              onClick={() => !(buffering || uploading) && fileRef.current?.click()}
              onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('border-[#3b82f6]'); }}
              onDragLeave={e => e.currentTarget.classList.remove('border-[#3b82f6]')}
              onDrop={e => { e.preventDefault(); e.currentTarget.classList.remove('border-[#3b82f6]'); handleFiles(e.dataTransfer.files); }}
              data-testid="batch-dropzone"
            >
              <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
                onChange={e => { handleFiles(e.target.files); e.target.value = ''; }} />
              {buffering ? (
                <>
                  <Loader2 className="w-8 h-8 text-[#3b82f6] mx-auto mb-2 animate-spin" />
                  <p className="text-sm text-[#3b82f6]">Reading images...</p>
                </>
              ) : (
                <>
                  <Upload className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">Tap to select photos or drag & drop</p>
                  <p className="text-[10px] text-gray-600 mt-1">Front + Back pairs (alternating)</p>
                </>
              )}
            </div>

            {/* Options */}
            {files.length > 0 && !uploading && (
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Pairing:</span>
                  <select value={pairingMode} onChange={e => setPairingMode(e.target.value)}
                    className="bg-[#111] border border-[#2a2a2a] rounded-lg px-2 py-1.5 text-xs text-white"
                    data-testid="batch-pairing-select">
                    <option value="alternating">Front + Back (alternating)</option>
                    <option value="fronts_only">Front only</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Category:</span>
                  <select value={category} onChange={e => setCategory(e.target.value)}
                    className="bg-[#111] border border-[#2a2a2a] rounded-lg px-2 py-1.5 text-xs text-white"
                    data-testid="batch-category-select">
                    <option value="collection">Collection</option>
                    <option value="for_sale">Inventory</option>
                  </select>
                </div>
                <span className="text-xs text-gray-500 ml-auto">{files.length} images = {cardCount} cards</span>
              </div>
            )}

            {/* Paired previews */}
            {pairs.length > 0 && !uploading && (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                {pairs.map((pair, i) => (
                  <div key={i} className="bg-[#111] border border-[#1a1a1a] rounded-lg p-1.5" data-testid={`batch-pair-${i}`}>
                    <p className="text-[9px] text-gray-500 text-center mb-1">CARD {i + 1}</p>
                    <div className="flex gap-1">
                      <div className="flex-1 aspect-[3/4] bg-[#0a0a0a] rounded overflow-hidden relative">
                        <img src={getPreview(pair.front)} alt={`Front ${i+1}`} className="w-full h-full object-contain" />
                        <span className="absolute bottom-0.5 left-0.5 text-[6px] px-1 py-0.5 rounded bg-[#3b82f6]/80 text-white">F</span>
                      </div>
                      <div className="flex-1 aspect-[3/4] bg-[#0a0a0a] rounded overflow-hidden relative">
                        {pair.back ? (
                          <>
                            <img src={getPreview(pair.back)} alt={`Back ${i+1}`} className="w-full h-full object-contain" />
                            <span className="absolute bottom-0.5 left-0.5 text-[6px] px-1 py-0.5 rounded bg-amber-500/80 text-white">B</span>
                          </>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ImageIcon className="w-3 h-3 text-gray-700" />
                          </div>
                        )}
                      </div>
                    </div>
                    <button onClick={() => removeFile(i * (pairingMode === 'alternating' ? 2 : 1))}
                      className="w-full mt-1 text-[8px] text-red-400/60 hover:text-red-400 transition-colors">
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Upload progress */}
            {uploading && (
              <div className="space-y-3 p-4 bg-[#111] rounded-xl border border-[#1a1a1a]">
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-[#3b82f6]" />
                  <p className="text-sm text-white">Uploading {progress.current} of {progress.total} cards...</p>
                </div>
                <div className="w-full bg-[#0a0a0a] rounded-full h-2.5 overflow-hidden">
                  <motion.div
                    className="h-full bg-[#3b82f6] rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${(progress.current / progress.total) * 100}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
                <p className="text-[10px] text-gray-500">
                  Your phone can sleep after upload finishes — AI runs on the server
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      {!done && (
        <div className="flex items-center justify-between p-4 border-t border-[#1a1a1a]">
          <button onClick={onClose} className="text-sm text-gray-400 hover:text-white" data-testid="batch-cancel-btn">Cancel</button>
          <button onClick={handleUpload} disabled={uploading || buffering || files.length === 0}
            className="flex items-center gap-2 px-6 py-3 rounded-lg bg-[#3b82f6] text-white text-sm font-semibold hover:bg-[#2563eb] transition-colors disabled:opacity-50"
            data-testid="batch-upload-btn">
            {uploading ? <><RefreshCw className="w-4 h-4 animate-spin" /> Uploading...</> : <><Upload className="w-4 h-4" /> Upload {cardCount} Cards</>}
          </button>
        </div>
      )}
    </div>
  );
};

export default BatchUploadView;
