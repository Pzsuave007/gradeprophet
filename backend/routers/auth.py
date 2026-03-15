from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel
from datetime import datetime, timezone
import uuid
import logging
import httpx
from database import db
from utils.auth import get_current_user, create_session_token

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    email: str
    password: str
    name: str


class LoginRequest(BaseModel):
    email: str
    password: str


@router.post("/register")
async def register(data: RegisterRequest, response: Response):
    """Register with email and password"""
    import bcrypt
    existing = await db.users.find_one({"email": data.email.lower()}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    hashed = bcrypt.hashpw(data.password.encode(), bcrypt.gensalt()).decode()
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    user = {
        "user_id": user_id,
        "email": data.email.lower(),
        "name": data.name,
        "password_hash": hashed,
        "picture": None,
        "auth_provider": "email",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(user)
    user.pop("_id", None)

    session_token = create_session_token()
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": datetime.now(timezone.utc).replace(day=datetime.now(timezone.utc).day + 7),
        "created_at": datetime.now(timezone.utc),
    })

    response.set_cookie("session_token", session_token, path="/", httponly=True, secure=True, samesite="none", max_age=7*24*3600)
    return {"user_id": user_id, "email": user["email"], "name": user["name"], "picture": None, "onboarding_completed": False}


@router.post("/login")
async def login(data: LoginRequest, response: Response):
    """Login with email and password"""
    import bcrypt
    user = await db.users.find_one({"email": data.email.lower()}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.get("password_hash"):
        raise HTTPException(status_code=401, detail="This account uses Google login. Please sign in with Google.")

    if not bcrypt.checkpw(data.password.encode(), user["password_hash"].encode()):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    session_token = create_session_token()
    await db.user_sessions.insert_one({
        "user_id": user["user_id"],
        "session_token": session_token,
        "expires_at": datetime.now(timezone.utc).replace(day=datetime.now(timezone.utc).day + 7),
        "created_at": datetime.now(timezone.utc),
    })

    response.set_cookie("session_token", session_token, path="/", httponly=True, secure=True, samesite="none", max_age=7*24*3600)
    return {"user_id": user["user_id"], "email": user["email"], "name": user["name"], "picture": user.get("picture"), "onboarding_completed": user.get("onboarding_completed", False)}


@router.post("/session")
async def process_google_session(request: Request, response: Response):
    """Process Google OAuth session_id from Emergent Auth"""
    body = await request.json()
    session_id = body.get("session_id")
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")

    logger.info(f"Google auth: exchanging session_id={session_id[:20]}...")

    try:
        async with httpx.AsyncClient(timeout=15.0) as client_http:
            res = await client_http.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": session_id},
            )
            logger.info(f"Google auth: Emergent response status={res.status_code}")
            if res.status_code != 200:
                logger.error(f"Google auth: Emergent error body={res.text}")
                raise HTTPException(status_code=401, detail=f"Google auth failed: {res.text}")
            google_data = res.json()
            logger.info(f"Google auth: got user data for {google_data.get('email', 'unknown')}")
    except httpx.RequestError as e:
        logger.error(f"Google auth: network error: {e}")
        raise HTTPException(status_code=500, detail=f"Could not connect to auth service: {str(e)}")

    email = google_data["email"].lower()
    name = google_data.get("name", email.split("@")[0])
    picture = google_data.get("picture")

    existing = await db.users.find_one({"email": email}, {"_id": 0})
    is_new_user = existing is None
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one({"email": email}, {"$set": {"name": name, "picture": picture}})
        onboarding_completed = existing.get("onboarding_completed", False)
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
            "password_hash": None,
            "auth_provider": "google",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        onboarding_completed = False

    session_token = create_session_token()
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": datetime.now(timezone.utc).replace(day=datetime.now(timezone.utc).day + 7),
        "created_at": datetime.now(timezone.utc),
    })

    response.set_cookie("session_token", session_token, path="/", httponly=True, secure=True, samesite="none", max_age=7*24*3600)
    return {"user_id": user_id, "email": email, "name": name, "picture": picture, "onboarding_completed": onboarding_completed}


@router.get("/me")
async def get_me(request: Request):
    """Get current authenticated user"""
    user = await get_current_user(request)
    return {
        "user_id": user.get("user_id"),
        "email": user.get("email"),
        "name": user.get("name"),
        "picture": user.get("picture"),
        "onboarding_completed": user.get("onboarding_completed", False),
    }


@router.post("/logout")
async def logout(request: Request, response: Response):
    """Logout: delete session and clear cookie"""
    token = request.cookies.get("session_token")
    if token:
        await db.user_sessions.delete_one({"session_token": token})
    response.delete_cookie("session_token", path="/", secure=True, samesite="none")
    return {"success": True}
