# FlipSlab Engine - Product Requirements Document

## Original Problem Statement
The user wants to expand their web app, "GradeProphet," into a full-fledged trading platform named "FlipSlab Engine" - an "Operating System for Sports Card Traders." A key high-priority request is a standalone desktop application for Windows ("FlipSlab Scanner") that interfaces with the user's Fujitsu fi-6130Z scanner for batch duplex (two-sided) scanning.

## Architecture
- **Web App:** React frontend + FastAPI backend + MongoDB
- **Desktop Scanner App:** Python + Tkinter (GUI) + Pillow/NumPy (Image Processing) + pywin32 (WIA) + NAPS2 CLI (duplex scanning)

## Core Files
- `scanner-app/scanner.pyw` - Main desktop scanner app
- `scanner-app/setup.bat` - Windows installer script
- `scanner-app/Launch.vbs` - No-console launcher
- `backend/routers/cards.py` - Scan upload endpoint with AI identification (front+back)
- `backend/routers/ebay.py` - eBay listing creation/management
- `backend/routers/inventory.py` - Inventory CRUD
- `backend/utils/ai.py` - AI analysis logic (GPT-4o)
- `backend/config.py` - OpenAI client config
- `frontend/src/components/InventoryModule.jsx` - Inventory UI (F+B badge)
- `frontend/src/components/BatchUploadView.jsx` - Batch card upload
- `frontend/src/components/ListingsModule.jsx` - eBay listing form
- `frontend/src/components/AccountModule.jsx` - Scanner token generation

## What's Been Implemented

### Desktop Scanner App - COMPLETE
- [x] Batch duplex scanning via NAPS2 CLI (tested: 4 cards, both sides)
- [x] NAPS2 config UI (path, device "fi-6130dj", profile)
- [x] 600 DPI default for high quality
- [x] Advanced auto-crop with variance detection
- [x] No console window (pythonw + VBS launcher)
- [x] Token-based login (for Google Auth users)
- [x] Upload with X-FlipSlab-Item-Id header for reliable front/back pairing

### Scan Upload Backend - COMPLETE
- [x] Front/back pairing via: item_id header > batch_key > fallback
- [x] AI re-identification with BOTH front+back images (GPT-4o)
- [x] Images stored at 1600px resolution (no server-side re-crop)
- [x] scan_batch_key for filename-based matching

### Web App - COMPLETE
- [x] Authentication (Google Auth + email/password)
- [x] Scanner Token generation in Account page
- [x] Inventory with F+B badge for cards with both images
- [x] 3D card flip animation to view back image
- [x] eBay listing form shows front + back images with status
- [x] eBay uploads both front and back images
- [x] Dashboard, Auction alerts, Onboarding wizard

### Bug Fixes
- [x] **Feb 2026**: Fixed field name mismatch in `/api/cards/identify` - backend now accepts both `image_base64` and `front_image_base64` for backwards compatibility with older frontend builds. Also fixed frontend (`InventoryModule.jsx`, `BatchUploadView.jsx`) to consistently use `front_image_base64`.

## Backlog
- P1: Whatnot Integration & Inventory Sync Engine (waiting on user's API access)
- P2: Auto-Refresh Portfolio Value
- P3: Flip Finder core logic
- P4: Stripe commercialization

## User Language: Spanish
