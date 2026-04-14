import React, { useState, useRef, useCallback } from 'react';
import ReactCrop from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { Check, X, Crop } from 'lucide-react';

const ImageCropper = ({ imageSrc, onCropDone, onCancel }) => {
  const [crop, setCrop] = useState({ unit: '%', x: 10, y: 10, width: 80, height: 80 });
  const imgRef = useRef(null);

  const getCroppedImage = useCallback(() => {
    const image = imgRef.current;
    if (!image || !crop.width || !crop.height) return;

    const canvas = document.createElement('canvas');
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    const pixelCrop = {
      x: crop.x * scaleX,
      y: crop.y * scaleY,
      width: crop.width * scaleX,
      height: crop.height * scaleY,
    };

    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, pixelCrop.width, pixelCrop.height);

    const croppedDataUrl = canvas.toDataURL('image/webp', 0.85);
    canvas.width = 0;
    canvas.height = 0;
    onCropDone(croppedDataUrl);
  }, [crop, onCropDone]);

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4" data-testid="image-cropper-modal">
      <div className="bg-[#111] border border-[#222] rounded-xl p-4 max-w-[90vw] max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Crop className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-bold text-white">Crop Image</span>
          </div>
          <span className="text-[10px] text-gray-500">Drag to select area</span>
        </div>

        <div className="flex-1 overflow-auto flex items-center justify-center min-h-0">
          <ReactCrop crop={crop} onChange={c => setCrop(c)} className="max-h-[65vh]">
            <img ref={imgRef} src={imageSrc} alt="Crop" style={{ maxHeight: '65vh', maxWidth: '80vw' }} />
          </ReactCrop>
        </div>

        <div className="flex items-center justify-end gap-3 mt-4 pt-3 border-t border-[#222]">
          <button onClick={onCancel}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1a1a1a] text-gray-400 text-sm font-bold hover:text-white transition-colors"
            data-testid="crop-cancel-btn">
            <X className="w-4 h-4" /> Cancel
          </button>
          <button onClick={getCroppedImage}
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-amber-500 text-black text-sm font-bold hover:bg-amber-400 transition-colors"
            data-testid="crop-apply-btn">
            <Check className="w-4 h-4" /> Apply Crop
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImageCropper;
