# FlipSlab Engine - Product Requirements Document

## Original Problem Statement
The user wants to expand their web app, "GradeProphet," into a full-fledged trading platform named "FlipSlab Engine" - an "Operating System for Sports Card Traders." A key high-priority request is a standalone desktop application for Windows ("FlipSlab Scanner") that interfaces with the user's Fujitsu fi-6130Z scanner for batch duplex (two-sided) scanning.

## Architecture
- **Web App:** React frontend + FastAPI backend + MongoDB
- **Desktop Scanner App:** Python + Tkinter (GUI) + Pillow/NumPy (Image Processing) + pywin32 (WIA) + NAPS2 CLI (duplex scanning)

## Core Files
- `scanner-app/scanner.py` - Main desktop scanner app
- `scanner-app/setup.bat` - Windows installer script
- `backend/routers/cards.py` - Scan upload endpoint with AI identification (front+back)
- `backend/routers/ebay.py` - eBay listing creation/management
- `backend/routers/inventory.py` - Inventory CRUD
- `backend/utils/ai.py` - AI analysis logic (GPT-4o)
- `backend/config.py` - OpenAI client config
- `frontend/src/components/LandingPage.jsx` - Landing page (updated Feb 2026)
- `frontend/src/components/InventoryModule.jsx` - Inventory UI (F+B badge)
- `frontend/src/components/BatchUploadView.jsx` - Batch card upload
- `frontend/src/components/ListingsModule.jsx` - eBay listing form
- `frontend/src/components/AccountModule.jsx` - Scanner token generation

## What's Been Implemented

### Desktop Scanner App - COMPLETE
- [x] Batch duplex scanning via NAPS2 CLI
- [x] NAPS2 config UI (path, device "fi-6130dj", profile)
- [x] 600 DPI default for high quality
- [x] Advanced auto-crop with variance detection
- [x] No console window (pythonw + VBS launcher)
- [x] Token-based login (for Google Auth users)
- [x] Upload with X-FlipSlab-Item-Id header for reliable front/back pairing
- [x] **Numeric sort fix** for NAPS2 output files (fixes front/back mixing with 5+ cards)
- [x] **"Swap front/back" option** for scanners that capture reverse side first

### Scan Upload Backend - COMPLETE
- [x] Front/back pairing via: item_id header > batch_key > fallback
- [x] AI re-identification with BOTH front+back images (GPT-4o)
- [x] Images stored at 1600px resolution
- [x] scan_batch_key for filename-based matching
- [x] **Accepts both `image_base64` and `front_image_base64`** field names for backwards compatibility

### Web App - COMPLETE
- [x] Authentication (Google Auth + email/password)
- [x] Scanner Token generation in Account page
- [x] Inventory with F+B badge for cards with both images
- [x] 3D card flip animation
- [x] eBay listing form with front + back images
- [x] Dashboard, Auction alerts, Onboarding wizard

### Landing Page - UPDATED Feb 2026
- [x] Hero: "A Trading Dashboard for Sports Cards" → TRACK. FLIP. SELL.
- [x] Workflow strip: "From Scan to Sale in Minutes" (Scan → AI Identifies → Inventory → List on eBay → Track P&L)
- [x] Features section: "Everything You Need to Flip" (6 feature cards, unchanged)
- [x] Removed old "Alert in 3 Steps" section
- [x] Pricing: Rookie (Free) and Hall of Fame ($9.99/mo)

## Bug Fixes (Feb 2026)
- [x] Fixed field name mismatch in `/api/cards/identify` — 400 error on production
- [x] Fixed alphabetical sort bug in scanner app that mixed front/back images with 5+ card batches
- [x] Added "swap front/back" toggle for scanner duplex orientation

## Backlog
- P1: Whatnot Integration & Inventory Sync Engine (waiting on user's API access)
- P2: Auto-Refresh Portfolio Value
- P3: Flip Finder core logic
- P4: Stripe commercialization

## User Language: Spanish
## IMPORTANT: Always consult user before making any changes
