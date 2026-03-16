# FlipSlab Engine - Product Requirements Document

## Original Problem Statement
The user wants to expand their web app, "GradeProphet," into a full-fledged trading platform named "FlipSlab Engine" - an "Operating System for Sports Card Traders." A key high-priority request is a standalone desktop application for Windows ("FlipSlab Scanner") that interfaces with the user's Fujitsu fi-6130Z scanner for batch duplex (two-sided) scanning.

## Architecture
- **Web App:** React frontend + FastAPI backend + MongoDB
- **Desktop Scanner App:** Python + Tkinter (GUI) + Pillow/NumPy (Image Processing) + pywin32 (WIA) + NAPS2 CLI (duplex scanning)

## Core Files
- `scanner-app/scanner.py` - Main desktop scanner app
- `scanner-app/setup.bat` - Windows installer script
- `backend/routers/cards.py` - Scan upload endpoint with AI identification
- `backend/routers/ebay.py` - eBay listing creation/management
- `backend/routers/inventory.py` - Inventory CRUD

## What's Been Implemented

### Desktop Scanner App (scanner-app) - COMPLETE
- [x] Full Tkinter GUI with dark theme
- [x] WIA scanner detection and selection
- [x] Advanced two-pass image cropping algorithm (variance detection)
- [x] Image enhancement (autocontrast, sharpness, color, contrast, brightness)
- [x] Gradient border effect on cropped cards
- [x] Batch duplex scanning via NAPS2 CLI (tested: 4 cards, both sides)
- [x] NAPS2 path auto-detection + manual configuration UI
- [x] NAPS2 device name configuration (default: "fi-6130dj")
- [x] NAPS2 profile support
- [x] 600 DPI default for high quality
- [x] No console window (pythonw + VBS launcher)
- [x] Import from folder feature
- [x] Upload to FlipSlab server
- [x] Scan queue with preview

### Batch Upload Backend - COMPLETE
- [x] Front/back image pairing (detects _front/_back in filename)
- [x] AI card identification via GPT-4o on front images
- [x] Correct field names matching inventory model
- [x] Back images auto-paired to matching front item

### Web App
- [x] Authentication system
- [x] Dashboard
- [x] Auction alert system
- [x] User onboarding wizard
- [x] eBay API integration (OAuth, listings, orders)
- [x] Inventory management (CRUD, search, filters)
- [x] eBay listing creation from inventory
- [x] OpenAI GPT-4o integration
- [x] Google Auth (Emergent)

## Backlog
- P1: Whatnot Integration & Inventory Sync Engine (waiting for API access)
- P2: Auto-Refresh Portfolio Value
- P3: Flip Finder core logic
- P4: Stripe commercialization

## User Language
Spanish - all communication must be in Spanish
