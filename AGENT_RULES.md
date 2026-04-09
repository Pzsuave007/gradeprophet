# CRITICAL RULES FOR AGENTS - READ BEFORE ANY CHANGE
# ====================================================
# If you are an AI agent working on FlipSlab Engine, you MUST read this entire file
# BEFORE making any changes to the codebase. Failure to follow these rules has caused
# repeated production outages.
# ====================================================

## RULE 1: DO NOT TOUCH THE LOGIN / AUTH SYSTEM
- DO NOT modify `/app/backend/routers/auth.py`
- DO NOT modify `/app/frontend/src/components/AuthPage.jsx`
- DO NOT change Google OAuth endpoints, URLs, or redirect logic
- DO NOT modify `ensure_admin_password()` or `ensure_dev_token()` in `server.py`
- The auth system works. Leave it alone.

## RULE 2: NEVER BUILD FRONTEND WITH `craco build` OR `yarn build` DIRECTLY
- The `.env` file has the Emergent PREVIEW URL — this is for LOCAL TESTING ONLY
- Production URL is `https://flipslabengine.com`
- ALWAYS use: `bash /app/build_prod.sh`
- This script overrides REACT_APP_BACKEND_URL to the production URL
- If you run `craco build` directly, the production site will try to call the Emergent preview server and EVERYTHING BREAKS

## RULE 3: HOW TO TEST AUTHENTICATED ENDPOINTS (WITHOUT TOUCHING AUTH)
- A persistent dev token is automatically created on server startup
- Token: `dev_flipslab_access`
- To get a session cookie for testing, visit or curl:
  ```
  GET {REACT_APP_BACKEND_URL}/api/auth/dev-login?token=dev_flipslab_access
  ```
- For curl with authentication:
  ```bash
  API_URL=$(grep REACT_APP_BACKEND_URL /app/frontend/.env | cut -d '=' -f2)
  curl -s -b "session_token=dev_flipslab_access" "$API_URL/api/ebay/sell/store-promotions"
  ```
- For Playwright/screenshot testing:
  ```
  Navigate to: {PREVIEW_URL}/api/auth/dev-login?token=dev_flipslab_access
  This sets the session cookie. Then navigate to the app normally.
  ```
- DO NOT create new users, modify passwords, or change auth code to test things

## RULE 4: PRODUCTION DEPLOYMENT WORKFLOW
1. Make code changes
2. Build frontend: `bash /app/build_prod.sh` (NEVER `craco build` directly)
3. User clicks "Save to Github" in Emergent chat
4. User runs `bash fix.sh` on their production server
5. fix.sh pulls from git, copies backend + frontend build to production

## RULE 5: DO NOT MODIFY THESE FILES WITHOUT EXPLICIT USER REQUEST
- `/app/backend/routers/auth.py` — Auth system
- `/app/frontend/src/components/AuthPage.jsx` — Login UI
- `/app/backend/utils/auth.py` — Auth utilities
- `/app/fix.sh` — Production deploy script
- `/app/build_prod.sh` — Production build script
- `/app/backend/.env` — Backend environment (MONGO_URL, DB_NAME)
- Google Auth integration — Uses Emergent Auth service, this is CORRECT and INTENTIONAL

## RULE 6: KEY URLS
- Production: https://flipslabengine.com
- Emergent Preview: whatever is in /app/frontend/.env (FOR TESTING ONLY)
- eBay API: Uses user's eBay tokens stored in MongoDB `ebay_tokens` collection

## RULE 7: ADMIN ACCOUNT
- Email: pzsuave007@gmail.com
- Password: MXmedia007
- Auth: Google OAuth (primary) + password (backup)
- The server automatically ensures this password is correct on every startup
- DO NOT change this password or create new admin accounts

## PAST ISSUES CAUSED BY IGNORING THESE RULES
1. Login broken in production (10+ times) — agents changed auth endpoints or password hashing
2. Frontend calling Emergent preview instead of production — agents used `craco build` instead of `build_prod.sh`
3. Google OAuth redirect broken — agents modified redirect URLs in AuthPage.jsx
