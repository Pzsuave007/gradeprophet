from fastapi import APIRouter, Request, HTTPException
from database import db
from utils.auth import get_current_user
from emergentintegrations.payments.stripe.checkout import (
    StripeCheckout, CheckoutSessionRequest, CheckoutSessionResponse, CheckoutStatusResponse
)
import os
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/subscription", tags=["subscription"])

STRIPE_API_KEY = os.environ.get("STRIPE_API_KEY")

# ─── Plan Definitions (server-side only, never trust frontend amounts) ───
PLANS = {
    "rookie": {
        "id": "rookie",
        "name": "Rookie",
        "price": 0.0,
        "interval": "free",
        "limits": {
            "inventory": 30,
            "scans_per_month": 30,
            "listings": 30,
        },
        "features": {
            "dashboard_full": False,
            "flip_finder": False,
            "flip_finder_monitor": False,
            "flip_finder_alerts": False,
            "flip_finder_analyze": False,
            "flip_finder_ai": False,
            "market_full": False,
            "market_seasonal": False,
            "photo_editor": False,
            "photo_presets_premium": False,
            "export_reports": False,
            "priority_support": False,
            "multi_marketplace": False,
            "team_access": False,
            "scanner_software": False,
        },
    },
    "mvp": {
        "id": "mvp",
        "name": "MVP",
        "price": 14.99,
        "interval": "month",
        "popular": True,
        "limits": {
            "inventory": 250,
            "scans_per_month": 250,
            "listings": 250,
        },
        "features": {
            "dashboard_full": True,
            "flip_finder": True,
            "flip_finder_monitor": True,
            "flip_finder_alerts": True,
            "flip_finder_analyze": True,
            "flip_finder_ai": True,
            "market_full": True,
            "market_seasonal": True,
            "photo_editor": True,
            "photo_presets_premium": True,
            "export_reports": True,
            "priority_support": False,
            "multi_marketplace": False,
            "team_access": False,
            "scanner_software": False,
        },
    },
    "hall_of_famer": {
        "id": "hall_of_famer",
        "name": "Hall of Famer",
        "price": 19.99,
        "interval": "month",
        "limits": {
            "inventory": -1,
            "scans_per_month": -1,
            "listings": -1,
        },
        "features": {
            "dashboard_full": True,
            "flip_finder": True,
            "flip_finder_monitor": True,
            "flip_finder_alerts": True,
            "flip_finder_analyze": True,
            "flip_finder_ai": True,
            "market_full": True,
            "market_seasonal": True,
            "photo_editor": True,
            "photo_presets_premium": True,
            "export_reports": True,
            "priority_support": True,
            "multi_marketplace": True,
            "team_access": True,
            "scanner_software": True,
        },
    },
}

# Backward compatibility: map old plan IDs to new ones
PLAN_ALIASES = {
    "all_star": "mvp",
    "hall_of_fame": "hall_of_famer",
    "legend": "hall_of_famer",
}


def get_plan(plan_id: str):
    plan_id = PLAN_ALIASES.get(plan_id, plan_id)
    return PLANS.get(plan_id, PLANS["rookie"])


@router.get("/plans")
async def get_plans():
    return {"plans": list(PLANS.values())}


@router.get("/my-plan")
async def get_my_plan(request: Request):
    user = await get_current_user(request)
    user_sub = await db.subscriptions.find_one(
        {"user_id": user["user_id"]}, {"_id": 0}
    )
    if not user_sub:
        plan_id = "rookie"
        scans_used = 0
    else:
        plan_id = user_sub.get("plan_id", "rookie")
        plan_id = PLAN_ALIASES.get(plan_id, plan_id)
        scans_used = user_sub.get("scans_used", 0)

    plan = get_plan(plan_id)

    # Get current usage counts
    inv_count = await db.inventory.count_documents({"user_id": user["user_id"]})
    listing_count = await db.inventory.count_documents({"user_id": user["user_id"], "ebay_listing_id": {"$exists": True, "$ne": None}})

    return {
        "plan_id": plan_id,
        "plan": plan,
        "status": user_sub.get("status", "active") if user_sub else "active",
        "scans_used": scans_used,
        "usage": {
            "inventory": inv_count,
            "scans": scans_used,
            "listings": listing_count,
        },
        "started_at": user_sub.get("started_at") if user_sub else None,
    }


@router.post("/checkout")
async def create_checkout(request: Request):
    user = await get_current_user(request)
    body = await request.json()
    plan_id = body.get("plan_id")
    origin_url = body.get("origin_url")

    if not plan_id or plan_id not in PLANS:
        raise HTTPException(400, "Invalid plan")
    if plan_id == "rookie":
        raise HTTPException(400, "Cannot checkout for free plan")
    if not origin_url:
        raise HTTPException(400, "origin_url required")

    plan = PLANS[plan_id]
    amount = plan["price"]

    host_url = str(request.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)

    success_url = f"{origin_url}/dashboard?session_id={{CHECKOUT_SESSION_ID}}&plan={plan_id}"
    cancel_url = f"{origin_url}/dashboard?payment=cancelled"

    checkout_request = CheckoutSessionRequest(
        amount=float(amount),
        currency="usd",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            "user_id": user["user_id"],
            "plan_id": plan_id,
            "plan_name": plan["name"],
        },
    )

    session = await stripe_checkout.create_checkout_session(checkout_request)

    await db.payment_transactions.insert_one({
        "session_id": session.session_id,
        "user_id": user["user_id"],
        "plan_id": plan_id,
        "amount": amount,
        "currency": "usd",
        "payment_status": "pending",
        "status": "initiated",
        "metadata": {"plan_id": plan_id, "plan_name": plan["name"]},
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    return {"url": session.url, "session_id": session.session_id}


@router.get("/checkout/status/{session_id}")
async def check_status(session_id: str, request: Request):
    user = await get_current_user(request)

    txn = await db.payment_transactions.find_one(
        {"session_id": session_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not txn:
        raise HTTPException(404, "Transaction not found")

    if txn.get("payment_status") == "paid":
        return {
            "payment_status": "paid",
            "plan_id": txn.get("plan_id"),
            "already_processed": True,
        }

    host_url = str(request.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)

    status = await stripe_checkout.get_checkout_status(session_id)

    if status.payment_status == "paid":
        already = await db.payment_transactions.find_one(
            {"session_id": session_id, "payment_status": "paid"}
        )
        if not already:
            await db.payment_transactions.update_one(
                {"session_id": session_id},
                {"$set": {
                    "payment_status": "paid",
                    "status": "completed",
                    "paid_at": datetime.now(timezone.utc).isoformat(),
                }},
            )
            plan_id = txn["plan_id"]
            await db.subscriptions.update_one(
                {"user_id": user["user_id"]},
                {"$set": {
                    "plan_id": plan_id,
                    "status": "active",
                    "started_at": datetime.now(timezone.utc).isoformat(),
                    "scans_used": 0,
                }},
                upsert=True,
            )
            logger.info(f"User {user['user_id']} subscribed to {plan_id}")

    return {
        "payment_status": status.payment_status,
        "status": status.status,
        "plan_id": txn.get("plan_id"),
    }


@router.post("/downgrade-to-free")
async def downgrade_to_free(request: Request):
    user = await get_current_user(request)
    await db.subscriptions.update_one(
        {"user_id": user["user_id"]},
        {"$set": {
            "plan_id": "rookie",
            "status": "active",
            "downgraded_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True,
    )
    return {"success": True, "plan_id": "rookie"}
