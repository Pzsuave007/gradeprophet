# FlipSlab Engine - Product Requirements Document

## Vision
"Operating System for Sports Card Traders" - A full-fledged trading platform for sports card collectors and flippers.

## Core Components
1. **Web Application** (FlipSlab Engine) - React + FastAPI + MongoDB
2. **Desktop Scanner App** (FlipSlab Scanner) - Python + Tkinter + WIA

---

## Scanner App (Standalone Windows Desktop) - COMPLETE
- [x] WIA scanner integration with native driver UI
- [x] Programmatic WIA scanning (NAPS2-style) with fallback to dialog
- [x] NAPS2-style settings UI: Source, Paper Size, Color, DPI dropdowns
- [x] **Two-pass variance card detection algorithm** (v2.0 - Mar 16, 2026):
  - Pass 1: Detect card ROWS via per-row std (content vs uniform background)
  - Pass 2: Within card rows, detect COLUMNS via per-column std
  - Works for white/dark cards, any scanner background, any page size
- [x] 180 degree rotation for feeder scans
- [x] Auto color/contrast enhancement (autocontrast + sharpness + saturation)
- [x] Uniform 25px gray border (#CED4DA)
- [x] Upload to FlipSlab web app
- [x] One-click Windows installer (setup.bat)
- [x] User tested and confirmed working (Mar 16, 2026)

## Web Application Features - IMPLEMENTED
- [x] JWT + Google Auth authentication
- [x] Command Center dashboard (KPIs, watchlist, live monitor, recent sales, news)
- [x] Auction Alert system (1-min before auction end notifications)
- [x] New User Onboarding Wizard (multi-step setup)
- [x] Landing page
- [x] Deployment scripts (deploy.sh, quickdeploy.sh)

## Next Tasks
- P1: Whatnot API Integration (waiting for API access approval)
- P1: Inventory Sync Engine (cross-listing eBay + Whatnot)
- P2: Auto-Refresh Portfolio Value
- P2: Build Flip Finder Core Logic (profitable flip detection)
- P3: Commercialize with Stripe (Pro plan)

## Architecture
```
/app/
  backend/     - FastAPI + MongoDB
  frontend/    - React + Tailwind + Shadcn
  scanner-app/ - Python + Tkinter + WIA + PIL + NumPy
```

## Key Routes: landing -> auth -> onboarding -> dashboard
