"""
Pull Game Router - Interactive pull game for FlipSlab marketplace.
Admin creates a game with chasers + low-end pool; users buy numbered pulls.
Guaranteed physical card per pull. Blue Chase triggers Mega Box selection.
"""
from fastapi import APIRouter, Request, HTTPException
from database import db
from utils.auth import get_current_user
from emergentintegrations.payments.stripe.checkout import (
    StripeCheckout, CheckoutSessionRequest,
)
import os
import uuid
import random
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/pull-game", tags=["pull-game"])

STRIPE_API_KEY = os.environ.get("STRIPE_API_KEY")


# ───────────────────── Helpers ─────────────────────

def _now():
    return datetime.now(timezone.utc).isoformat()


async def _is_admin(user) -> bool:
    """Admin check - mirrors pattern used elsewhere."""
    return user.get("email", "").lower() in {"pzsuave007@gmail.com"} or user.get("is_admin") is True


def _public_game(game: dict, spots: list) -> dict:
    """Build public view of a game - hide hidden card assignments."""
    remaining = sum(1 for s in spots if s["status"] == "available")
    pulls_sold = sum(1 for s in spots if s["status"] == "claimed")
    tiers = game.get("tiers", [])
    current_price = _current_tier_price(pulls_sold, tiers)
    orange_done = game.get("orange_triggered_at") is not None
    blue_done = game.get("blue_triggered_at") is not None
    return {
        "id": game["id"],
        "name": game["name"],
        "status": game["status"],
        "total_pulls": game["total_pulls"],
        "pulls_remaining": remaining,
        "pulls_sold": pulls_sold,
        "current_price": current_price,
        "tiers": tiers,
        # Visible chasers
        "red_chases": game.get("red_chases", []),
        "orange_box_cards": game.get("orange_box_cards", []),
        "blue_box_cards": game.get("blue_box_cards", []),
        # Trigger state
        "orange_triggered": orange_done,
        "orange_picked_index": game.get("orange_picked_index"),
        "orange_picked_card": game.get("orange_picked_card"),
        "blue_triggered": blue_done,
        "blue_picked_index": game.get("blue_picked_index"),
        "blue_picked_card": game.get("blue_picked_card"),
        "created_at": game.get("created_at"),
        "spots": [
            {
                "pull_number": s["pull_number"],
                "price": s["price"] if s["status"] == "claimed" else current_price,
                "status": s["status"],
                # Reveal: claimed low-end/red show card; orange/blue triggers show card after box pick
                "card": s.get("card_snapshot") if s["status"] == "claimed" else None,
                "is_chaser": s.get("is_chaser", False) if s["status"] == "claimed" else False,
                "chaser_tier": s.get("chaser_tier") if s["status"] == "claimed" else None,
                "is_trigger": s.get("is_trigger", False),
                "trigger_type": s.get("trigger_type") if s["status"] == "claimed" else None,
            }
            for s in spots
        ],
    }


def _current_tier_price(pulls_sold: int, tiers: list) -> float:
    """Price for the NEXT pull based on how many have already been sold.
    Tiers are interpreted as 'first N pulls sold' ranges, e.g. tier {from:1,to:5,price:5}
    means the 1st through 5th pulls SOLD cost $5 each (regardless of pull number)."""
    next_pull_index = pulls_sold + 1
    for t in tiers:
        if t["from"] <= next_pull_index <= t["to"]:
            return float(t["price"])
    return float(tiers[-1]["price"]) if tiers else 5.0


def _price_for_pull(pull_number: int, tiers: list) -> float:
    """Legacy fallback: maps a fixed pull number to tier price (used only for display defaults)."""
    for t in tiers:
        if t["from"] <= pull_number <= t["to"]:
            return float(t["price"])
    return float(tiers[-1]["price"]) if tiers else 5.0


def _make_card_snapshot(card: dict) -> dict:
    """Snapshot an inventory card for pull assignment - small, no heavy image."""
    return {
        "card_id": card.get("id"),
        "title": card.get("card_name") or f"{card.get('player','')} {card.get('year','')} {card.get('set_name','')}".strip(),
        "player": card.get("player", ""),
        "year": str(card.get("year", "")),
        "set_name": card.get("set_name", ""),
        "card_number": card.get("card_number", ""),
        "variation": card.get("variation", ""),
        "grading_company": card.get("grading_company", ""),
        "grade": str(card.get("grade", "")) if card.get("grade") else "",
        "value": float(card.get("card_value") or card.get("listed_price") or 0),
        "thumbnail": card.get("store_thumbnail") or card.get("thumbnail", ""),
    }


async def _generate_spots(game_id: str, game: dict):
    """Generate pull spots:
    - 6 (or len(red_chases)) random spots → red chase (each gets a pre-assigned red card)
    - 1 random spot → orange trigger (card revealed via box pick)
    - 1 random spot → blue trigger (card revealed via box pick)
    - rest → low-end (random from pool)
    """
    total = game["total_pulls"]
    tiers = game["tiers"]
    red_chases = game.get("red_chases", [])  # list of card snapshots (1 per spot)
    has_orange = len(game.get("orange_box_cards", [])) > 0
    has_blue = len(game.get("blue_box_cards", [])) > 0
    low_end_pool = game.get("low_end_pool", [])

    # Reserve random unique spots for triggers + reds
    all_numbers = list(range(1, total + 1))
    random.shuffle(all_numbers)
    pos = 0
    red_numbers = all_numbers[pos:pos + len(red_chases)]; pos += len(red_chases)
    orange_number = all_numbers[pos] if has_orange else None
    if has_orange: pos += 1
    blue_number = all_numbers[pos] if has_blue else None
    if has_blue: pos += 1

    red_map = {num: card for num, card in zip(red_numbers, red_chases)}

    needed = total - len(red_chases) - (1 if has_orange else 0) - (1 if has_blue else 0)
    pool = list(low_end_pool)
    random.shuffle(pool)
    while len(pool) < needed:
        pool.extend(low_end_pool)
    pool = pool[:needed]
    pool_iter = iter(pool)

    spots = []
    for n in range(1, total + 1):
        base = {
            "id": str(uuid.uuid4())[:12],
            "game_id": game_id,
            "pull_number": n,
            "price": _price_for_pull(n, tiers),
            "status": "available",
            "claimed_by_user_id": None,
            "claimed_by_email": None,
            "shipping_address": None,
            "stripe_session_id": None,
            "payment_status": None,
            "revealed_at": None,
            "shipped_at": None,
            "is_trigger": False,
            "trigger_type": None,
        }
        if n in red_map:
            base.update({
                "card_snapshot": red_map[n],
                "is_chaser": True,
                "chaser_tier": "red",
            })
        elif n == orange_number:
            base.update({
                "card_snapshot": None,  # revealed after box pick
                "is_chaser": True,
                "chaser_tier": "orange",
                "is_trigger": True,
                "trigger_type": "orange",
            })
        elif n == blue_number:
            base.update({
                "card_snapshot": None,
                "is_chaser": True,
                "chaser_tier": "blue",
                "is_trigger": True,
                "trigger_type": "blue",
            })
        else:
            base.update({
                "card_snapshot": next(pool_iter),
                "is_chaser": False,
                "chaser_tier": None,
            })
        spots.append(base)
    await db.pull_spots.insert_many(spots)


# ───────────────────── ADMIN ENDPOINTS ─────────────────────

@router.post("/admin/games")
async def create_game(request: Request):
    user = await get_current_user(request)
    if not await _is_admin(user):
        raise HTTPException(403, "Admin only")

    body = await request.json()
    name = body.get("name", f"Pull Game {datetime.now().strftime('%b %d')}")
    total_pulls = int(body.get("total_pulls", 65))
    tiers = body.get("tiers") or [
        {"from": 1, "to": 10, "price": 5},
        {"from": 11, "to": 25, "price": 8},
        {"from": 26, "to": 40, "price": 12},
        {"from": 41, "to": 55, "price": 18},
        {"from": 56, "to": 65, "price": 25},
    ]
    chaser_ids = body.get("chaser_ids", [])  # legacy support
    red_ids = body.get("red_ids", [])  # 6 card_ids for direct red chases
    orange_ids = body.get("orange_ids", [])  # 4 card_ids for orange box
    blue_ids = body.get("blue_ids", [])  # 4 card_ids for blue box
    low_end_ids = body.get("low_end_ids", [])  # list of card_id
    mega_box_ids = body.get("mega_box_ids", [])  # legacy compat

    # Load inventory cards
    all_ids = list(set(red_ids + orange_ids + blue_ids + low_end_ids + mega_box_ids + [c.get("card_id") for c in chaser_ids if c.get("card_id")]))
    cards_cursor = db.inventory.find({"id": {"$in": all_ids}, "user_id": user["user_id"]}, {"_id": 0})
    cards_map = {c["id"]: c async for c in cards_cursor}

    red_chases = [_make_card_snapshot(cards_map[cid]) for cid in red_ids if cid in cards_map]
    orange_box_cards = [_make_card_snapshot(cards_map[cid]) for cid in orange_ids if cid in cards_map]
    blue_box_cards = [_make_card_snapshot(cards_map[cid]) for cid in blue_ids if cid in cards_map]

    low_end_pool = [_make_card_snapshot(cards_map[cid]) for cid in low_end_ids if cid in cards_map]
    if not low_end_pool:
        raise HTTPException(400, "No valid low-end cards provided")

    game_id = str(uuid.uuid4())[:12]
    game = {
        "id": game_id,
        "admin_user_id": user["user_id"],
        "name": name,
        "status": "active",  # active | paused | ended
        "total_pulls": total_pulls,
        "tiers": tiers,
        "red_chases": red_chases,
        "orange_box_cards": orange_box_cards,
        "blue_box_cards": blue_box_cards,
        "low_end_pool": low_end_pool,
        # Trigger state
        "orange_triggered_at": None,
        "orange_picked_index": None,
        "orange_picked_card": None,
        "orange_session_id": None,
        "blue_triggered_at": None,
        "blue_picked_index": None,
        "blue_picked_card": None,
        "blue_session_id": None,
        "created_at": _now(),
        "ended_at": None,
        "stats": {"pulls_sold": 0, "revenue": 0.0},
    }
    await db.pull_games.insert_one(game)

    # Lock cards in inventory
    locked_ids = list(set(red_ids + orange_ids + blue_ids + low_end_ids))
    if locked_ids:
        await db.inventory.update_many(
            {"id": {"$in": locked_ids}, "user_id": user["user_id"]},
            {"$set": {"pull_game_id": game_id, "pull_game_locked": True}},
        )

    await _generate_spots(game_id, game)
    game.pop("_id", None)
    return {"success": True, "game_id": game_id, "game": game}


@router.get("/admin/games")
async def admin_list_games(request: Request):
    user = await get_current_user(request)
    if not await _is_admin(user):
        raise HTTPException(403, "Admin only")
    games = await db.pull_games.find({"admin_user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    # Attach live stats
    for g in games:
        remaining = await db.pull_spots.count_documents({"game_id": g["id"], "status": "available"})
        g["pulls_remaining"] = remaining
    return {"games": games}


@router.get("/admin/games/{game_id}")
async def admin_game_detail(game_id: str, request: Request):
    user = await get_current_user(request)
    if not await _is_admin(user):
        raise HTTPException(403, "Admin only")
    game = await db.pull_games.find_one({"id": game_id, "admin_user_id": user["user_id"]}, {"_id": 0})
    if not game:
        raise HTTPException(404, "Game not found")
    spots = await db.pull_spots.find({"game_id": game_id}, {"_id": 0}).sort("pull_number", 1).to_list(1000)
    return {"game": game, "spots": spots}


@router.patch("/admin/games/{game_id}")
async def admin_update_game(game_id: str, request: Request):
    user = await get_current_user(request)
    if not await _is_admin(user):
        raise HTTPException(403, "Admin only")
    body = await request.json()
    status = body.get("status")
    if status not in ("active", "paused", "ended"):
        raise HTTPException(400, "Invalid status")
    updates = {"status": status}
    if status == "ended":
        updates["ended_at"] = _now()
    result = await db.pull_games.update_one(
        {"id": game_id, "admin_user_id": user["user_id"]}, {"$set": updates}
    )
    if result.matched_count == 0:
        raise HTTPException(404, "Game not found")
    # If ended, unlock unsold cards
    if status == "ended":
        sold_cards = await db.pull_spots.find(
            {"game_id": game_id, "status": "claimed"}, {"_id": 0, "card_snapshot.card_id": 1}
        ).to_list(1000)
        sold_card_ids = {s["card_snapshot"]["card_id"] for s in sold_cards if s.get("card_snapshot")}
        await db.inventory.update_many(
            {"pull_game_id": game_id, "id": {"$nin": list(sold_card_ids)}},
            {"$set": {"pull_game_locked": False}, "$unset": {"pull_game_id": ""}},
        )
    return {"success": True}


@router.post("/admin/games/{game_id}/ship/{pull_number}")
async def admin_mark_shipped(game_id: str, pull_number: int, request: Request):
    user = await get_current_user(request)
    if not await _is_admin(user):
        raise HTTPException(403, "Admin only")
    body = await request.json() if await request.body() else {}
    tracking = body.get("tracking", "")
    result = await db.pull_spots.update_one(
        {"game_id": game_id, "pull_number": pull_number, "status": "claimed"},
        {"$set": {"shipped_at": _now(), "tracking_number": tracking}},
    )
    if result.matched_count == 0:
        raise HTTPException(404, "Pull not found or not claimed")
    return {"success": True}


@router.get("/admin/stats")
async def admin_stats(request: Request):
    user = await get_current_user(request)
    if not await _is_admin(user):
        raise HTTPException(403, "Admin only")
    games = await db.pull_games.find({"admin_user_id": user["user_id"]}, {"_id": 0}).to_list(1000)
    total_revenue = sum(g.get("stats", {}).get("revenue", 0) for g in games)
    total_pulls_sold = sum(g.get("stats", {}).get("pulls_sold", 0) for g in games)
    return {
        "total_games": len(games),
        "active_games": sum(1 for g in games if g["status"] == "active"),
        "total_revenue": round(total_revenue, 2),
        "total_pulls_sold": total_pulls_sold,
    }


# ───────────────────── PUBLIC (GUEST OK) ENDPOINTS ─────────────────────

@router.get("/games/active")
async def list_active_games():
    games = await db.pull_games.find({"status": "active"}, {"_id": 0}).sort("created_at", -1).to_list(50)
    results = []
    for g in games:
        remaining = await db.pull_spots.count_documents({"game_id": g["id"], "status": "available"})
        blue_claimed = await db.pull_spots.count_documents(
            {"game_id": g["id"], "chaser_tier": "blue", "status": "claimed"}
        )
        results.append({
            "id": g["id"],
            "name": g["name"],
            "total_pulls": g["total_pulls"],
            "pulls_remaining": remaining,
            "tiers": g.get("tiers", []),
            "chaser_count": len(g.get("chasers", [])),
            "blue_chase_alive": blue_claimed == 0,
            "created_at": g.get("created_at"),
        })
    return {"games": results}


@router.get("/games/{game_id}")
async def public_game(game_id: str):
    game = await db.pull_games.find_one({"id": game_id}, {"_id": 0})
    if not game:
        raise HTTPException(404, "Game not found")
    spots = await db.pull_spots.find({"game_id": game_id}, {"_id": 0}).sort("pull_number", 1).to_list(1000)
    return _public_game(game, spots)


@router.get("/games/{game_id}/winners")
async def public_winners(game_id: str):
    spots = await db.pull_spots.find(
        {"game_id": game_id, "status": "claimed", "is_chaser": True},
        {"_id": 0, "pull_number": 1, "card_snapshot": 1, "revealed_at": 1, "shipping_address": 1, "chaser_tier": 1},
    ).sort("revealed_at", -1).to_list(50)
    return {
        "winners": [
            {
                "pull_number": s["pull_number"],
                "card_name": (s.get("card_snapshot") or {}).get("title", ""),
                "value": (s.get("card_snapshot") or {}).get("value", 0),
                "tier": s.get("chaser_tier"),
                "first_name": (s.get("shipping_address") or {}).get("first_name", "Collector"),
                "claimed_at": s.get("revealed_at"),
            }
            for s in spots
        ]
    }


@router.post("/games/{game_id}/buy-pull")
async def buy_pull(game_id: str, request: Request):
    """Initiate Stripe checkout for one or many pull numbers in a single transaction.
    Body: {pull_number: int} OR {pull_numbers: [int, int, ...]}, email, shipping_address, origin_url, user_id?"""
    body = await request.json()
    pull_numbers = body.get("pull_numbers")
    if pull_numbers is None:
        # Legacy single-pull support
        single = body.get("pull_number")
        pull_numbers = [int(single)] if single is not None else []
    pull_numbers = sorted(set(int(n) for n in pull_numbers))
    if not pull_numbers:
        raise HTTPException(400, "At least one pull required")
    email = (body.get("email") or "").strip().lower()
    shipping = body.get("shipping_address") or {}
    origin_url = body.get("origin_url", "")
    user_id = body.get("user_id")

    if not email:
        raise HTTPException(400, "Email required")
    for field in ("first_name", "last_name", "line1", "city", "state", "postal_code"):
        if not shipping.get(field):
            raise HTTPException(400, f"Shipping field '{field}' required")

    game = await db.pull_games.find_one({"id": game_id}, {"_id": 0})
    if not game or game["status"] != "active":
        raise HTTPException(400, "Game not available")

    pulls_sold = await db.pull_spots.count_documents({"game_id": game_id, "status": "claimed"})
    tiers = game.get("tiers", [])

    # Reserve all spots atomically — if any fails, rollback the rest
    reserved = []
    total_amount = 0.0
    try:
        for idx, pn in enumerate(pull_numbers):
            # Each subsequent pull's price reflects the prior pulls also being sold
            price = _current_tier_price(pulls_sold + idx, tiers)
            spot = await db.pull_spots.find_one_and_update(
                {"game_id": game_id, "pull_number": pn, "status": "available"},
                {"$set": {"status": "reserved", "reserved_at": _now(), "price": price}},
            )
            if not spot:
                # Rollback everything we already reserved
                for r in reserved:
                    await db.pull_spots.update_one(
                        {"id": r["id"]},
                        {"$set": {"status": "available", "stripe_session_id": None, "payment_status": None}},
                    )
                raise HTTPException(409, f"Pull #{pn} already claimed or reserved")
            spot["price"] = price
            reserved.append(spot)
            total_amount += price
    except HTTPException:
        raise
    except Exception as e:
        for r in reserved:
            await db.pull_spots.update_one(
                {"id": r["id"]},
                {"$set": {"status": "available"}},
            )
        raise HTTPException(500, str(e))

    host_url = str(request.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    success_url = f"{origin_url}/pull-game/{game_id}/reveal?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin_url}/pull-game/{game_id}?cancelled=1"

    checkout_request = CheckoutSessionRequest(
        amount=float(round(total_amount, 2)),
        currency="usd",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            "type": "pull_game",
            "game_id": game_id,
            "pull_numbers": ",".join(str(n) for n in pull_numbers),
            "pull_count": str(len(pull_numbers)),
            "email": email,
            "user_id": user_id or "",
        },
    )
    session = await stripe_checkout.create_checkout_session(checkout_request)

    # Attach session to all reserved spots
    spot_ids = [r["id"] for r in reserved]
    await db.pull_spots.update_many(
        {"id": {"$in": spot_ids}},
        {"$set": {
            "stripe_session_id": session.session_id,
            "claimed_by_email": email,
            "claimed_by_user_id": user_id,
            "shipping_address": shipping,
            "payment_status": "pending",
        }},
    )
    await db.payment_transactions.insert_one({
        "session_id": session.session_id,
        "user_id": user_id,
        "type": "pull_game",
        "game_id": game_id,
        "pull_numbers": pull_numbers,
        "pull_count": len(pull_numbers),
        "amount": float(round(total_amount, 2)),
        "currency": "usd",
        "payment_status": "pending",
        "status": "initiated",
        "email": email,
        "created_at": _now(),
    })

    return {
        "checkout_url": session.url,
        "session_id": session.session_id,
        "total": float(round(total_amount, 2)),
        "pull_count": len(pull_numbers),
    }


@router.get("/checkout/status/{session_id}")
async def checkout_status(session_id: str, request: Request):
    """Poll Stripe; on paid, finalize ALL pulls in this session."""
    txn = await db.payment_transactions.find_one({"session_id": session_id, "type": "pull_game"}, {"_id": 0})
    if not txn:
        raise HTTPException(404, "Session not found")

    # Already revealed
    if txn.get("payment_status") == "paid" and txn.get("revealed"):
        spots = await db.pull_spots.find({"stripe_session_id": session_id}, {"_id": 0}).sort("pull_number", 1).to_list(50)
        return {
            "payment_status": "paid", "revealed": True,
            "spots": spots,
            "spot": spots[0] if spots else None,  # legacy
        }

    host_url = str(request.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    status = await stripe_checkout.get_checkout_status(session_id)

    if status.payment_status == "paid":
        # Finalize ALL spots for this session
        await db.pull_spots.update_many(
            {"stripe_session_id": session_id, "status": "reserved"},
            {"$set": {
                "status": "claimed",
                "payment_status": "paid",
                "revealed_at": _now(),
            }},
        )
        spots = await db.pull_spots.find({"stripe_session_id": session_id}, {"_id": 0}).sort("pull_number", 1).to_list(50)
        if spots:
            game_id = spots[0]["game_id"]
            total_revenue = sum(s["price"] for s in spots)
            await db.pull_games.update_one(
                {"id": game_id},
                {"$inc": {"stats.pulls_sold": len(spots), "stats.revenue": total_revenue}},
            )
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$set": {"payment_status": "paid", "status": "completed", "revealed": True, "paid_at": _now()}},
        )
        return {
            "payment_status": "paid", "revealed": True,
            "spots": spots,
            "spot": spots[0] if spots else None,  # legacy
        }

    if status.status == "expired" or status.payment_status == "unpaid":
        # Release all reservations for this session
        await db.pull_spots.update_many(
            {"stripe_session_id": session_id, "status": "reserved"},
            {"$set": {"status": "available", "stripe_session_id": None, "payment_status": None}},
        )
        return {"payment_status": "failed", "revealed": False}

    return {"payment_status": status.payment_status, "revealed": False}


@router.post("/games/{game_id}/box-pick/{session_id}")
async def open_box(game_id: str, session_id: str, request: Request):
    """Open one of the 4 boxes after hitting an Orange or Blue trigger spot.
    Reveals the chosen card and assigns it to the spot.
    Game ends automatically when BOTH orange and blue triggers have been picked."""
    body = await request.json()
    box_index = int(body.get("box_index", 0))
    trigger_type_req = body.get("trigger_type")  # 'orange' or 'blue' to disambiguate when multi-pull

    # Find the trigger spot in this session matching the requested type (if specified)
    spot_query = {"stripe_session_id": session_id, "status": "claimed", "is_trigger": True, "card_snapshot": None}
    if trigger_type_req in ("orange", "blue"):
        spot_query["trigger_type"] = trigger_type_req
    spot = await db.pull_spots.find_one(spot_query, {"_id": 0})
    if not spot:
        raise HTTPException(404, "Trigger session not found or not paid (or already picked)")

    trigger_type = spot.get("trigger_type")  # 'orange' | 'blue'
    if trigger_type not in ("orange", "blue"):
        raise HTTPException(400, "Invalid trigger type")

    game = await db.pull_games.find_one({"id": game_id}, {"_id": 0})
    if not game:
        raise HTTPException(404, "Game not found")

    # Already triggered globally?
    if trigger_type == "orange" and game.get("orange_triggered_at"):
        raise HTTPException(409, "Orange already triggered for this game")
    if trigger_type == "blue" and game.get("blue_triggered_at"):
        raise HTTPException(409, "Blue already triggered for this game")

    pool = game.get("orange_box_cards" if trigger_type == "orange" else "blue_box_cards", [])
    if box_index < 0 or box_index >= len(pool):
        raise HTTPException(400, "Invalid box index")
    chosen = pool[box_index]

    # Assign card to spot + mark trigger
    await db.pull_spots.update_one(
        {"id": spot["id"]},
        {"$set": {"card_snapshot": chosen}},
    )
    update_fields = {
        f"{trigger_type}_triggered_at": _now(),
        f"{trigger_type}_picked_index": box_index,
        f"{trigger_type}_picked_card": chosen,
        f"{trigger_type}_session_id": session_id,
    }
    await db.pull_games.update_one({"id": game_id}, {"$set": update_fields})

    # Re-fetch to check if both done
    fresh_game = await db.pull_games.find_one({"id": game_id}, {"_id": 0})
    game_ended = False
    has_orange = len(fresh_game.get("orange_box_cards", [])) > 0
    has_blue = len(fresh_game.get("blue_box_cards", [])) > 0
    orange_done = (not has_orange) or fresh_game.get("orange_triggered_at")
    blue_done = (not has_blue) or fresh_game.get("blue_triggered_at")
    if orange_done and blue_done:
        await db.pull_games.update_one(
            {"id": game_id},
            {"$set": {"status": "ended", "ended_at": _now()}},
        )
        await db.pull_spots.update_many(
            {"game_id": game_id, "status": "available"},
            {"$set": {"status": "disabled"}},
        )
        game_ended = True

    return {"success": True, "card": chosen, "trigger_type": trigger_type, "game_ended": game_ended}


@router.get("/inventory/available")
async def list_available_inventory(request: Request):
    """Admin helper: list inventory cards that aren't locked in another game."""
    user = await get_current_user(request)
    if not await _is_admin(user):
        raise HTTPException(403, "Admin only")
    cards = await db.inventory.find(
        {"user_id": user["user_id"], "listed": {"$ne": True}, "sold": {"$ne": True},
         "$or": [{"pull_game_locked": {"$ne": True}}, {"pull_game_locked": {"$exists": False}}]},
        {"_id": 0, "id": 1, "player": 1, "year": 1, "set_name": 1, "card_number": 1,
         "card_value": 1, "listed_price": 1, "thumbnail": 1, "store_thumbnail": 1,
         "grading_company": 1, "grade": 1, "variation": 1, "card_name": 1},
    ).limit(500).to_list(500)
    return {"cards": cards}
