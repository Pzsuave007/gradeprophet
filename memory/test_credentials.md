# Test Credentials

## IMPORTANT: DO NOT MODIFY GOOGLE AUTH. DO NOT CHANGE AUTH SYSTEM.
## READ /app/AGENT_RULES.md BEFORE MAKING ANY CHANGES.

## Admin User (primary account)
- Email: pzsuave007@gmail.com
- Password: MXmedia007
- Auth Provider: google (also has password login)
- Notes: Main user with eBay connected, 300+ active listings, inventory items

## Test User (empty)
- Email: test@flipslab.com
- Password: test123
- User ID: user_cffca5aaf534
- Auth Provider: email
- Notes: New user, no inventory data

## Dev Token (FOR AGENTS - USE THIS INSTEAD OF TOUCHING AUTH)
- Token: dev_flipslab_access
- Created automatically on every server startup
- Use with curl: `curl -b "session_token=dev_flipslab_access" {API_URL}/api/...`
- Use with browser: navigate to `{API_URL}/api/auth/dev-login?token=dev_flipslab_access` first
- DO NOT modify auth code to test — use this token

## Login Method
- Use POST /api/auth/login with email + password
- OR use dev token as session cookie directly
- DO NOT modify Google Auth integration
- DO NOT change any auth code

## CRITICAL: Frontend Build
- ALWAYS use `bash /app/build_prod.sh` to compile frontend
- NEVER use `craco build` or `yarn build` directly
- Production URL: https://flipslabengine.com
