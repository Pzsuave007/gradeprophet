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
    claimed_chasers = [
        {
            "tier": s.get("chaser_tier"),
            "card_name": s.get("card_snapshot", {}).get("title", "Hidden"),
            "value": s.get("card_snapshot", {}).get("value", 0),
            "pull_number": s["pull_number"],
            "claimed_at": s.get("revealed_at"),
            "first_name": (s.get("shipping_address") or {}).get("first_name", "Anonymous"),
        }
        for s in spots if s["status"] == "claimed" and s.get("is_chaser")
    ]
    # Count remaining chasers by tier (for odds)
    chasers = game.get("chasers", [])
    blue_alive = not any(s.get("chaser_tier") == "blue" and s["status"] == "claimed" for s in spots)
    return {
        "id": game["id"],
        "name": game["name"],
        "status": game["status"],
        "total_pulls": game["total_pulls"],
        "pulls_remaining": remaining,
        "tiers": game.get("tiers", []),
        "chasers": chasers,  # visible chasers (card names + images + values)
        "claimed_chasers": claimed_chasers,
        "mega_box_cards": game.get("mega_box_cards", []),
        "mega_box_claimed_index": game.get("mega_box_claimed_index"),
        "blue_chase_alive": blue_alive,
        "created_at": game.get("created_at"),
        "spots": [
            {
                "pull_number": s["pull_number"],
                "price": s["price"],
                "status": s["status"],
                # Reveal card snapshot only when claimed
                "card": s.get("card_snapshot") if s["status"] == "claimed" else None,
                "is_chaser": s.get("is_chaser", False) if s["status"] == "claimed" else False,
                "chaser_tier": s.get("chaser_tier") if s["status"] == "claimed" else None,
            }
            for s in spots
        ],
    }


def _price_for_pull(pull_number: int, tiers: list) -> float:
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
    """Generate all pull spots with hidden random card assignments.
    Chasers are placed at random unique pull_numbers; everything else draws from low_end_pool."""
    total = game["total_pulls"]
    tiers = game["tiers"]
    chasers = game.get("chasers", [])  # each: {card_id, tier, card_snapshot}
    low_end_pool = game.get("low_end_pool", [])  # list of card snapshots

    # Reserve random spots for chasers
    all_numbers = list(range(1, total + 1))
    random.shuffle(all_numbers)
    chaser_numbers = all_numbers[:len(chasers)]
    chaser_map = {num: ch for num, ch in zip(chaser_numbers, chasers)}

    # Shuffle low-ends; repeat if pool < (total - chasers)
    needed = total - len(chasers)
    pool = list(low_end_pool)
    random.shuffle(pool)
    while len(pool) < needed:
        pool.extend(low_end_pool)  # recycle pool
    pool = pool[:needed]
    pool_iter = iter(pool)

    spots = []
    for n in range(1, total + 1):
        if n in chaser_map:
            ch = chaser_map[n]
            spots.append({
                "id": str(uuid.uuid4())[:12],
                "game_id": game_id,
                "pull_number": n,
                "price": _price_for_pull(n, tiers),
                "status": "available",
                "card_snapshot": ch["card_snapshot"],
                "is_chaser": True,
                "chaser_tier": ch["tier"],
                "claimed_by_user_id": None,
                "claimed_by_email": None,
                "shipping_address": None,
                "stripe_session_id": None,
                "payment_status": None,
                "revealed_at": None,
                "shipped_at": None,
            })
        else:
            card_snap = next(pool_iter)
            spots.append({
                "id": str(uuid.uuid4())[:12],
                "game_id": game_id,
                "pull_number": n,
                "price": _price_for_pull(n, tiers),
                "status": "available",
                "card_snapshot": card_snap,
                "is_chaser": False,
                "chaser_tier": None,
                "claimed_by_user_id": None,
                "claimed_by_email": None,
                "shipping_address": None,
                "stripe_session_id": None,
                "payment_status": None,
                "revealed_at": None,
                "shipped_at": None,
            })
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
    chaser_ids = body.get("chaser_ids", [])  # [{card_id, tier: mini|mid|blue}]
    low_end_ids = body.get("low_end_ids", [])  # list of card_id
    mega_box_ids = body.get("mega_box_ids", [])  # 4 card_ids for the Mega Box reward

    # Load inventory cards
    all_ids = [c["card_id"] for c in chaser_ids] + low_end_ids + mega_box_ids
    cards_cursor = db.inventory.find({"id": {"$in": all_ids}, "user_id": user["user_id"]}, {"_id": 0})
    cards_map = {c["id"]: c async for c in cards_cursor}

    chasers = []
    for c in chaser_ids:
        card = cards_map.get(c["card_id"])
        if not card:
            continue
        chasers.append({
            "card_id": c["card_id"],
            "tier": c["tier"],  # mini | mid | blue
            "card_snapshot": _make_card_snapshot(card),
        })

    low_end_pool = [_make_card_snapshot(cards_map[cid]) for cid in low_end_ids if cid in cards_map]
    if not low_end_pool:
        raise HTTPException(400, "No valid low-end cards provided")
    if not any(c["tier"] == "blue" for c in chasers):
        logger.warning(f"Game {name} created without Blue Chase — Mega Box won't trigger")

    mega_box_snapshots = [_make_card_snapshot(cards_map[cid]) for cid in mega_box_ids if cid in cards_map]

    game_id = str(uuid.uuid4())[:12]
    game = {
        "id": game_id,
        "admin_user_id": user["user_id"],
        "name": name,
        "status": "active",  # active | paused | ended
        "total_pulls": total_pulls,
        "tiers": tiers,
        "chasers": chasers,
        "low_end_pool": low_end_pool,
        "mega_box_cards": mega_box_snapshots,
        "mega_box_claimed_index": None,
        "blue_chase_triggered_at": None,
        "created_at": _now(),
        "ended_at": None,
        "stats": {"pulls_sold": 0, "revenue": 0.0},
    }
    await db.pull_games.insert_one(game)

    # Lock cards in inventory
    locked_ids = [c["card_id"] for c in chasers] + low_end_ids + mega_box_ids
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
    """Initiate Stripe checkout for a specific pull number. Guest or logged-in."""
    body = await request.json()
    pull_number = int(body.get("pull_number"))
    email = (body.get("email") or "").strip().lower()
    shipping = body.get("shipping_address") or {}
    origin_url = body.get("origin_url", "")
    user_id = body.get("user_id")  # optional if logged in

    if not email:
        raise HTTPException(400, "Email required")
    for field in ("first_name", "last_name", "line1", "city", "state", "postal_code"):
        if not shipping.get(field):
            raise HTTPException(400, f"Shipping field '{field}' required")

    game = await db.pull_games.find_one({"id": game_id}, {"_id": 0})
    if not game or game["status"] != "active":
        raise HTTPException(400, "Game not available")

    # Atomically reserve the spot
    spot = await db.pull_spots.find_one_and_update(
        {"game_id": game_id, "pull_number": pull_number, "status": "available"},
        {"$set": {"status": "reserved", "reserved_at": _now()}},
    )
    if not spot:
        raise HTTPException(409, "Pull already claimed or reserved")

    host_url = str(request.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)

    success_url = f"{origin_url}/pull-game/{game_id}/reveal?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin_url}/pull-game/{game_id}?cancelled=1&pull={pull_number}"

    checkout_request = CheckoutSessionRequest(
        amount=float(spot["price"]),
        currency="usd",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            "type": "pull_game",
            "game_id": game_id,
            "pull_number": str(pull_number),
            "email": email,
            "user_id": user_id or "",
        },
    )
    session = await stripe_checkout.create_checkout_session(checkout_request)

    # Update spot with session + shipping info
    await db.pull_spots.update_one(
        {"id": spot["id"]},
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
        "pull_number": pull_number,
        "amount": float(spot["price"]),
        "currency": "usd",
        "payment_status": "pending",
        "status": "initiated",
        "email": email,
        "created_at": _now(),
    })

    return {"checkout_url": session.url, "session_id": session.session_id}


@router.get("/checkout/status/{session_id}")
async def checkout_status(session_id: str, request: Request):
    """Poll Stripe; on paid, finalize the pull reveal."""
    txn = await db.payment_transactions.find_one({"session_id": session_id, "type": "pull_game"}, {"_id": 0})
    if not txn:
        raise HTTPException(404, "Session not found")

    # Already revealed
    if txn.get("payment_status") == "paid" and txn.get("revealed"):
        spot = await db.pull_spots.find_one({"stripe_session_id": session_id}, {"_id": 0})
        return {"payment_status": "paid", "revealed": True, "spot": spot}

    host_url = str(request.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    status = await stripe_checkout.get_checkout_status(session_id)

    if status.payment_status == "paid":
        # Finalize: mark spot claimed and reveal
        spot = await db.pull_spots.find_one_and_update(
            {"stripe_session_id": session_id, "status": "reserved"},
            {"$set": {
                "status": "claimed",
                "payment_status": "paid",
                "revealed_at": _now(),
            }},
        )
        if spot:
            # Update game stats
            await db.pull_games.update_one(
                {"id": spot["game_id"]},
                {
                    "$inc": {"stats.pulls_sold": 1, "stats.revenue": spot["price"]},
                    "$set": {
                        **({"blue_chase_triggered_at": _now()} if spot.get("chaser_tier") == "blue" else {}),
                    },
                },
            )
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$set": {"payment_status": "paid", "status": "completed", "revealed": True, "paid_at": _now()}},
        )
        fresh_spot = await db.pull_spots.find_one({"stripe_session_id": session_id}, {"_id": 0})
        return {"payment_status": "paid", "revealed": True, "spot": fresh_spot}

    if status.status == "expired" or status.payment_status == "unpaid":
        # Release the reservation
        await db.pull_spots.update_one(
            {"stripe_session_id": session_id, "status": "reserved"},
            {"$set": {"status": "available", "stripe_session_id": None, "payment_status": None}},
        )
        return {"payment_status": "failed", "revealed": False}

    return {"payment_status": status.payment_status, "revealed": False}


@router.post("/games/{game_id}/mega-box/{session_id}")
async def open_mega_box(game_id: str, session_id: str, request: Request):
    """Open one of the 4 Mega Boxes after hitting Blue Chase. Game resets after."""
    body = await request.json()
    box_index = int(body.get("box_index", 0))

    spot = await db.pull_spots.find_one({
        "stripe_session_id": session_id, "status": "claimed", "chaser_tier": "blue",
    }, {"_id": 0})
    if not spot:
        raise HTTPException(404, "Blue Chase session not found")

    game = await db.pull_games.find_one({"id": game_id}, {"_id": 0})
    if not game:
        raise HTTPException(404, "Game not found")
    if game.get("mega_box_claimed_index") is not None:
        raise HTTPException(409, "Mega Box already claimed for this game")

    mega_cards = game.get("mega_box_cards", [])
    if box_index < 0 or box_index >= len(mega_cards):
        raise HTTPException(400, "Invalid box index")
    chosen = mega_cards[box_index]

    # Record the mega box win + end the game (reset)
    await db.pull_games.update_one(
        {"id": game_id},
        {"$set": {
            "mega_box_claimed_index": box_index,
            "mega_box_claimed_card": chosen,
            "mega_box_claimed_by_session": session_id,
            "status": "ended",
            "ended_at": _now(),
        }},
    )
    # Disable remaining available spots
    await db.pull_spots.update_many(
        {"game_id": game_id, "status": "available"},
        {"$set": {"status": "disabled"}},
    )
    return {"success": True, "mega_card": chosen, "game_reset": True}


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
