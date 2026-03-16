# FlipSlab Engine - Product Requirements Document

## Original Problem Statement
The user wants to expand their web app, "GradeProphet," into a full-fledged trading platform named "FlipSlab Engine" - an "Operating System for Sports Card Traders." A key high-priority request is a standalone desktop application for Windows ("FlipSlab Scanner") that interfaces with the user's Fujitsu fi-6130Z scanner for batch duplex (two-sided) scanning.

## Architecture
- **Web App:** React frontend + FastAPI backend + MongoDB
- **Desktop Scanner App:** Python + Tkinter (GUI) + Pillow/NumPy (Image Processing) + pywin32 (WIA) + NAPS2 CLI (duplex scanning)

## Core Files
- `scanner-app/scanner.py` - Main desktop scanner app (all logic, UI, scanning, image processing)
- `scanner-app/setup.bat` - Windows installer script
- `backend/` - FastAPI backend for web app
- `frontend/` - React frontend for web app

## What's Been Implemented

### Desktop Scanner App (scanner-app)
- [x] Full Tkinter GUI with dark theme
- [x] WIA scanner detection and selection
- [x] Advanced two-pass image cropping algorithm (variance detection)
- [x] Image enhancement (autocontrast, sharpness, color, contrast, brightness)
- [x] Gradient border effect on cropped cards
- [x] Batch scanning logic with front/back naming convention
- [x] NAPS2 CLI integration for duplex scanning (with `--device` flag)
- [x] NAPS2 path auto-detection + manual configuration UI
- [x] NAPS2 device name configuration (default: "fi-6130dj")
- [x] NAPS2 profile support (use named profiles from NAPS2 GUI)
- [x] Scrollable settings panel
- [x] Import from folder feature
- [x] Upload to FlipSlab server feature
- [x] Scan queue with preview
- [x] Error handling with full command display for debugging

### Web App
- [x] Authentication system
- [x] Dashboard
- [x] Auction alert system
- [x] User onboarding wizard
- [x] eBay API integration
- [x] OpenAI GPT-4o integration
- [x] Google Auth (Emergent)

## Date: Feb 2026 - Fixed NAPS2 CLI Integration
- Added `--device "fi-6130dj"` to NAPS2 command to prevent scanner selection dialog
- Added NAPS2 configuration section in UI (path, device name, profile)
- Added auto-detect and manual browse for NAPS2 path
- Added profile-based scanning support (use NAPS2 GUI profiles)
- Fixed broken `_on_paper_change` method (duplicate save button with undefined `frame`)
- Improved error handling: shows exact command + stdout/stderr on failure
- Made left panel scrollable to fit NAPS2 config section

## Pending - Awaiting User Testing
- P0: NAPS2 duplex scanning - user needs to test on their Windows machine

## Backlog
- P1: Whatnot Integration & Inventory Sync Engine (waiting for API access)
- P2: Auto-Refresh Portfolio Value
- P3: Flip Finder core logic
- P4: Stripe commercialization

## Abandoned Approaches
- Direct WIA duplex control (driver doesn't expose duplex settings)
- TWAIN via pytwain (TWAINDSM.DLL dependency issues on 64-bit Windows)

## User Language
Spanish - all communication must be in Spanish
