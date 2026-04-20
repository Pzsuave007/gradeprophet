from fastapi import APIRouter, HTTPException, Request
from database import db
from utils.auth import get_current_user
from utils.ebay import get_ebay_user_token
from datetime import datetime, timezone, timedelta
import logging
import uuid
import html
import httpx
import xml.etree.ElementTree as ET

logger = logging.getLogger("routers.schedule")
router = APIRouter(prefix="/schedule", tags=["schedule"])



def _calc_starting_bid(body: dict, card: dict) -> float:
    """Calculate starting bid from fixed amount or percentage of card value."""
    pct = body.get("starting_bid_pct")
    if pct:
        card_value = float(card.get("card_value") or card.get("listed_price") or card.get("purchase_price") or 0)
        if card_value > 0:
            return round(card_value * float(pct) / 100, 2)
    bid = body.get("starting_bid")
    if bid is not None:
        return float(bid)
    return 0.99


# ========== CRUD ENDPOINTS ==========

@router.get("/queue")
async def get_schedule_queue(request: Request):
    """Get all scheduled posts for the current user."""
    user = await get_current_user(request)
    posts = await db.scheduled_posts.find(
        {"user_id": user["user_id"]},
        {"_id": 0}
    ).sort("scheduled_at", 1).to_list(200)
    return {"posts": posts}


@router.post("/add")
async def add_to_schedule(request: Request):
    """Add a card to the schedule queue."""
    user = await get_current_user(request)
    body = await request.json()

    card_id = body.get("card_id")
    if not card_id:
        raise HTTPException(status_code=400, detail="card_id required")

    # Get card from inventory
    card = await db.inventory.find_one({"id": card_id, "user_id": user["user_id"]}, {"_id": 0})
    if not card:
        raise HTTPException(status_code=404, detail="Card not found in inventory")

    if card.get("listed"):
        raise HTTPException(status_code=400, detail="Card is already listed on eBay")

    # Check if already scheduled
    existing = await db.scheduled_posts.find_one(
        {"card_id": card_id, "user_id": user["user_id"], "status": "pending"}, {"_id": 0}
    )
    if existing:
        raise HTTPException(status_code=400, detail="Card is already scheduled")

    queue_type = body.get("queue_type", "fixed_price")  # fixed_price | auction
    scheduled_at = body.get("scheduled_at")

    if scheduled_at:
        scheduled_at = datetime.fromisoformat(scheduled_at.replace("Z", "+00:00"))
    else:
        # Default: next available slot at 7pm EST (midnight UTC)
        now = datetime.now(timezone.utc)
        next_slot = now.replace(hour=0, minute=0, second=0, microsecond=0)
        if now.hour >= 0:
            next_slot += timedelta(days=1)
        scheduled_at = next_slot

    # Get user settings for postal code / location
    settings = await db.user_settings.find_one({"user_id": user["user_id"]}, {"_id": 0}) or {}

    # Build listing title
    player = card.get("player", "")
    year = card.get("year", "")
    set_name = card.get("set_name", "")
    variation = card.get("variation", "")
    sport = card.get("sport", "Baseball")
    card_number = card.get("card_number", "")
    grading_company = card.get("grading_company", "")
    grade = card.get("grade", "")

    from routers.ebay import generate_listing_title
    title = generate_listing_title(card)

    # Sport category mapping
    cat_map = {"baseball": "261328", "basketball": "261329", "football": "261330", "soccer": "261331", "hockey": "261332", "wrestling": "261333", "golf": "261334", "tennis": "261335", "racing": "261336"}
    category_id = cat_map.get(sport.lower(), "261328")

    post = {
        "id": str(uuid.uuid4())[:12],
        "user_id": user["user_id"],
        "card_id": card_id,
        "queue_type": queue_type,
        "status": "pending",
        "scheduled_at": scheduled_at.isoformat(),
        # Card snapshot
        "title": body.get("title") or title,
        "player": player,
        "year": str(year),
        "set_name": set_name,
        "variation": variation,
        "sport": sport,
        "card_number": card_number,
        "grading_company": grading_company,
        "grade": str(grade) if grade else "",
        "image": card.get("image", ""),
        "back_image": card.get("back_image", ""),
        "category_id": category_id,
        # Config
        "price": float(body.get("price", card.get("listed_price") or card.get("card_value") or 9.99)),
        "starting_bid": float(body.get("starting_bid", 0.99)),
        "reserve_price": float(body.get("reserve_price", 0)) if body.get("reserve_price") else None,
        "buy_it_now": float(body.get("buy_it_now", 0)) if body.get("buy_it_now") else None,
        "auction_duration": body.get("auction_duration", "Days_7"),
        "shipping_option": body.get("shipping_option", "USPSFirstClass"),
        "shipping_cost": float(body.get("shipping_cost", 1.50)),
        "condition_id": int(body.get("condition_id", 400010)),
        "best_offer": body.get("best_offer", False),
        "postal_code": settings.get("postal_code", ""),
        "location": settings.get("location", ""),
        # Results
        "ebay_item_id": None,
        "error_message": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "posted_at": None,
    }

    await db.scheduled_posts.insert_one(post)
    post.pop("_id", None)

    # Mark card as scheduled in inventory
    await db.inventory.update_one(
        {"id": post["card_id"], "user_id": user["user_id"]},
        {"$set": {"scheduled": True}}
    )

    return {"success": True, "post": post}


@router.post("/add-bulk")
async def add_bulk_to_schedule(request: Request):
    """Add multiple cards to the schedule queue."""
    try:
        user = await get_current_user(request)
        body = await request.json()
    except Exception as e:
        logger.error(f"add_bulk parse error: {e}")
        raise HTTPException(status_code=400, detail=str(e))

    card_ids = body.get("card_ids", [])
    queue_type = body.get("queue_type", "fixed_price")

    if not card_ids:
        raise HTTPException(status_code=400, detail="card_ids required")

    settings = await db.user_settings.find_one({"user_id": user["user_id"]}, {"_id": 0}) or {}
    cat_map = {"baseball": "261328", "basketball": "261329", "football": "261330", "soccer": "261331", "hockey": "261332"}

    # Calculate start time from user's selected date/hour
    post_hour_central = int(body.get("post_hour", 19))
    post_minute = int(body.get("post_minute", 0))
    start_date_str = body.get("start_date")  # "YYYY-MM-DD" — interpreted as CT calendar date
    batch_size = int(body.get("batch_size", 5))

    # Build start_day in CT then convert to UTC. Tolerates the old frontend cache that
    # sent UTC-today as start_date (which in CT is still yesterday) by detecting the mismatch.
    ct_tz = timezone(timedelta(hours=-5))  # CDT (UTC-5)
    now = datetime.now(timezone.utc)
    now_ct = now.astimezone(ct_tz)

    if start_date_str:
        parts = start_date_str.split("-")
        y, m, d = int(parts[0]), int(parts[1]), int(parts[2])
        from datetime import date as _date_type
        sent_date = _date_type(y, m, d)
        # Old frontend bug: if the sent date matches UTC-today but CT is still yesterday,
        # the user actually meant "today in CT" (one day earlier).
        if sent_date == now.date() and sent_date > now_ct.date():
            y, m, d = now_ct.year, now_ct.month, now_ct.day
        start_ct = datetime(y, m, d, post_hour_central, post_minute, 0, tzinfo=ct_tz)
        start_day = start_ct.astimezone(timezone.utc)
        # Safety: if still in the past, roll forward by 1 day at a time.
        while start_day <= now:
            start_day += timedelta(days=1)
    else:
        today_ct = now_ct.replace(hour=post_hour_central, minute=post_minute, second=0, microsecond=0)
        start_day = today_ct.astimezone(timezone.utc)
        if now >= start_day:
            start_day += timedelta(days=1)

    # Look up already-scheduled posts of the same queue_type so we don't collide
    # on the exact same scheduled_at across separate add-bulk calls.
    existing_same_queue = await db.scheduled_posts.find(
        {"user_id": user["user_id"], "queue_type": queue_type, "status": {"$in": ["pending", "processing"]}},
        {"_id": 0, "scheduled_at": 1}
    ).to_list(5000)

    occupied_slots = set()
    for ep in existing_same_queue:
        try:
            ed = datetime.fromisoformat(ep["scheduled_at"].replace("Z", "+00:00")) if isinstance(ep.get("scheduled_at"), str) else ep["scheduled_at"]
            occupied_slots.add(ed.isoformat())
        except Exception:
            continue

    # Starting offset: respect the user's chosen time on each call. We only push the
    # user's chosen slot forward when it's literally already occupied. Multiple cards
    # in a single bulk call get spaced 10 minutes apart.
    added = []
    skipped = []
    call_offset = 0  # cards added IN THIS call (for intra-call 10-min spacing)

    for idx, card_id in enumerate(card_ids):
        card = await db.inventory.find_one({"id": card_id, "user_id": user["user_id"]}, {"_id": 0})
        if not card:
            skipped.append(card_id)
            continue
        if card.get("listed"):
            skipped.append(card_id)
            continue

        existing = await db.scheduled_posts.find_one(
            {"card_id": card_id, "user_id": user["user_id"], "status": "pending"}, {"_id": 0}
        )
        if existing:
            skipped.append(card_id)
            continue

        # Start at the user's chosen slot (+ 10 min per prior card in this call)
        scheduled_at = start_day + timedelta(minutes=call_offset * 10)
        # If slot already taken by any existing pending post, push forward 10 min at a time
        while scheduled_at.isoformat() in occupied_slots:
            scheduled_at += timedelta(minutes=10)
        occupied_slots.add(scheduled_at.isoformat())
        call_offset += 1

        player = card.get("player", "")
        year = card.get("year", "")
        set_name = card.get("set_name", "")
        variation = card.get("variation", "")
        sport = card.get("sport", "Baseball")
        grading_company = card.get("grading_company", "")
        grade = card.get("grade", "")
        from routers.ebay import generate_listing_title
        title = generate_listing_title(card)

        post = {
            "id": str(uuid.uuid4())[:12],
            "user_id": user["user_id"],
            "card_id": card_id,
            "queue_type": queue_type,
            "status": "pending",
            "scheduled_at": scheduled_at.isoformat(),
            "title": title,
            "player": player,
            "year": str(year),
            "set_name": set_name,
            "variation": variation,
            "sport": sport,
            "card_number": card.get("card_number", ""),
            "grading_company": grading_company,
            "grade": str(grade) if grade else "",
            "image": card.get("image", ""),
            "back_image": card.get("back_image", ""),
            "category_id": cat_map.get(sport.lower(), "261328"),
            "price": float(body.get("price") or card.get("listed_price") or card.get("card_value") or 9.99),
            "starting_bid": _calc_starting_bid(body, card),
            "reserve_price": float(body.get("reserve_price")) if body.get("reserve_price") else None,
            "buy_it_now": float(body.get("buy_it_now")) if body.get("buy_it_now") else None,
            "auction_duration": body.get("auction_duration", "Days_7"),
            "shipping_option": body.get("shipping_option", "USPSFirstClass"),
            "shipping_cost": float(body.get("shipping_cost", 1.50)),
            "condition_id": 2750 if card.get("condition") == "Graded" else 400010,
            "condition": card.get("condition", ""),
            "card_condition": card.get("card_condition", "Near Mint or Better"),
            "best_offer": body.get("best_offer", False),
            "postal_code": settings.get("postal_code", ""),
            "location": settings.get("location", ""),
            "ebay_item_id": None,
            "error_message": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "posted_at": None,
        }
        await db.scheduled_posts.insert_one(post)
        post.pop("_id", None)
        added.append(post)
        # Mark card as scheduled
        await db.inventory.update_one({"id": card_id, "user_id": user["user_id"]}, {"$set": {"scheduled": True}})

    return {"success": True, "added": len(added), "skipped": len(skipped), "posts": added}


@router.put("/{post_id}")
async def update_scheduled_post(post_id: str, request: Request):
    """Update a scheduled post."""
    user = await get_current_user(request)
    body = await request.json()

    post = await db.scheduled_posts.find_one(
        {"id": post_id, "user_id": user["user_id"], "status": "pending"}, {"_id": 0}
    )
    if not post:
        raise HTTPException(status_code=404, detail="Scheduled post not found or already posted")

    updates = {}
    for field in ["title", "price", "starting_bid", "reserve_price", "buy_it_now",
                  "auction_duration", "shipping_option", "shipping_cost", "condition_id",
                  "best_offer", "scheduled_at", "queue_type"]:
        if field in body:
            val = body[field]
            if field in ("price", "starting_bid", "reserve_price", "buy_it_now", "shipping_cost"):
                val = float(val) if val else None
            elif field == "condition_id":
                val = int(val)
            updates[field] = val

    if updates:
        await db.scheduled_posts.update_one({"id": post_id}, {"$set": updates})

    return {"success": True}


@router.delete("/{post_id}")
async def delete_scheduled_post(post_id: str, request: Request):
    """Remove a post from the schedule."""
    user = await get_current_user(request)
    post = await db.scheduled_posts.find_one({"id": post_id, "user_id": user["user_id"]}, {"_id": 0, "card_id": 1})
    result = await db.scheduled_posts.delete_one({"id": post_id, "user_id": user["user_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Scheduled post not found")
    # Unmark card if no other pending schedules exist for it
    if post and post.get("card_id"):
        remaining = await db.scheduled_posts.find_one({"card_id": post["card_id"], "user_id": user["user_id"], "status": {"$in": ["pending", "processing"]}})
        if not remaining:
            await db.inventory.update_one({"id": post["card_id"], "user_id": user["user_id"]}, {"$set": {"scheduled": False}})
    return {"success": True}


@router.delete("/clear/{queue_type}")
async def clear_queue(queue_type: str, request: Request):
    """Clear all pending posts in a queue."""
    user = await get_current_user(request)
    result = await db.scheduled_posts.delete_many(
        {"user_id": user["user_id"], "queue_type": queue_type, "status": "pending"}
    )
    return {"success": True, "deleted": result.deleted_count}


@router.post("/{post_id}/retry")
async def retry_scheduled_post(post_id: str, request: Request):
    """Retry a failed post by resetting it to pending and rescheduling it for soon."""
    user = await get_current_user(request)
    post = await db.scheduled_posts.find_one(
        {"id": post_id, "user_id": user["user_id"], "status": "failed"}, {"_id": 0}
    )
    if not post:
        raise HTTPException(status_code=404, detail="Failed post not found")

    # Reschedule 2 minutes from now so the worker picks it up in the next cycle
    new_time = (datetime.now(timezone.utc) + timedelta(minutes=2)).isoformat()
    await db.scheduled_posts.update_one(
        {"id": post_id},
        {"$set": {
            "status": "pending",
            "scheduled_at": new_time,
            "error_message": None,
            "posted_at": None,
        }}
    )
    # Re-mark inventory as scheduled (in case it was unflagged)
    if post.get("card_id"):
        await db.inventory.update_one(
            {"id": post["card_id"], "user_id": user["user_id"]},
            {"$set": {"scheduled": True}}
        )
    return {"success": True, "scheduled_at": new_time}


@router.delete("/bulk/clear-failed")
async def clear_failed_posts(request: Request):
    """Delete all failed posts from history (optionally for a specific queue_type)."""
    user = await get_current_user(request)
    queue_type = request.query_params.get("queue_type")
    query = {"user_id": user["user_id"], "status": "failed"}
    if queue_type in ("auction", "fixed_price"):
        query["queue_type"] = queue_type

    # Grab card_ids before deletion to potentially unflag inventory
    failed_docs = await db.scheduled_posts.find(query, {"_id": 0, "card_id": 1}).to_list(5000)
    card_ids = list({d["card_id"] for d in failed_docs if d.get("card_id")})

    result = await db.scheduled_posts.delete_many(query)

    # For each card, unflag scheduled if no remaining pending/processing/failed post exists
    for cid in card_ids:
        remaining = await db.scheduled_posts.find_one(
            {"card_id": cid, "user_id": user["user_id"], "status": {"$in": ["pending", "processing", "failed"]}}
        )
        if not remaining:
            await db.inventory.update_one(
                {"id": cid, "user_id": user["user_id"]},
                {"$set": {"scheduled": False}}
            )

    return {"success": True, "deleted": result.deleted_count}


@router.post("/sync-scheduled-flags")
async def sync_scheduled_flags(request: Request):
    """Sync the 'scheduled' field on inventory items based on pending scheduled posts."""
    user = await get_current_user(request)
    user_id = user["user_id"]
    pending = await db.scheduled_posts.find(
        {"user_id": user_id, "status": {"$in": ["pending", "processing", "failed"]}},
        {"_id": 0, "card_id": 1}
    ).to_list(5000)
    card_ids = list(set(p["card_id"] for p in pending if p.get("card_id")))

    # Reset all scheduled flags first
    await db.inventory.update_many({"user_id": user_id}, {"$set": {"scheduled": False}})
    # Mark cards that are actually scheduled
    if card_ids:
        result = await db.inventory.update_many(
            {"user_id": user_id, "id": {"$in": card_ids}},
            {"$set": {"scheduled": True}}
        )
        return {"success": True, "marked": result.modified_count, "total_pending": len(card_ids)}
    return {"success": True, "marked": 0, "total_pending": 0}


@router.post("/bulk-change-time")
async def bulk_change_time(request: Request):
    """Change the posting time for all pending posts, keeping their relative spacing within each day."""
    user = await get_current_user(request)
    user_id = user["user_id"]
    body = await request.json()

    new_hour = int(body.get("hour", 19))  # Central time hour
    new_minute = int(body.get("minute", 0))
    queue_type = body.get("queue_type")  # optional: 'auction', 'fixed_price', or None for all

    query = {"user_id": user_id, "status": "pending"}
    if queue_type:
        query["queue_type"] = queue_type

    posts = await db.scheduled_posts.find(query, {"_id": 0, "id": 1, "scheduled_at": 1}).sort("scheduled_at", 1).to_list(5000)
    if not posts:
        raise HTTPException(status_code=404, detail="No pending posts found")

    # Convert Central to UTC (CDT = UTC-5)
    utc_hour = (new_hour + 5) % 24

    # Group posts by day to preserve spacing within each day
    from collections import defaultdict
    day_groups = defaultdict(list)
    for post in posts:
        dt = datetime.fromisoformat(post["scheduled_at"].replace("Z", "+00:00")) if isinstance(post["scheduled_at"], str) else post["scheduled_at"]
        day_key = dt.strftime("%Y-%m-%d")
        day_groups[day_key].append((post, dt))

    updated = 0
    for day_key, group in day_groups.items():
        group.sort(key=lambda x: x[1])
        for i, (post, old_dt) in enumerate(group):
            # First post at the new time, subsequent posts spaced 10 minutes apart
            offset_minutes = new_minute + (i * 10)
            new_dt = old_dt.replace(hour=utc_hour, minute=0, second=0, microsecond=0) + timedelta(minutes=offset_minutes)
            await db.scheduled_posts.update_one(
                {"id": post["id"]},
                {"$set": {"scheduled_at": new_dt.isoformat()}}
            )
            updated += 1

    return {"success": True, "updated": updated, "new_time_ct": f"{new_hour}:{new_minute:02d}"}


# ========== STRATEGY LAUNCHER ==========

@router.post("/launch-strategy")
async def launch_strategy(request: Request):
    """Launch the eBay 150 Strategy: schedule auctions (1/day) + fixed price (5-6/day batches)."""
    user = await get_current_user(request)
    user_id = user["user_id"]
    body = await request.json()

    auction_ids = body.get("auction_card_ids", [])
    fixed_ids = body.get("fixed_card_ids", [])
    auction_start_pct = float(body.get("auction_start_pct", 50))
    auto_decline_pct = float(body.get("auto_decline_pct", 70))
    auto_accept_pct = float(body.get("auto_accept_pct", 10))
    shipping_option = body.get("shipping_option", "USPSFirstClass")
    shipping_cost = float(body.get("shipping_cost", 1.50))
    batch_size = int(body.get("batch_size", 5))
    auction_duration = body.get("auction_duration", "Days_7")
    post_hour_central = int(body.get("post_hour", 19))
    # Convert Central Time to UTC (CDT = UTC-5). Late-CT hours (e.g. 7pm+) roll into next UTC day.
    post_hour_utc = (post_hour_central + 5) % 24
    day_shift = (post_hour_central + 5) // 24

    all_ids = auction_ids + fixed_ids
    if not all_ids:
        raise HTTPException(status_code=400, detail="No cards selected")

    settings = await db.user_settings.find_one({"user_id": user_id}, {"_id": 0}) or {}
    cat_map = {"baseball": "261328", "basketball": "261329", "football": "261330", "soccer": "261331", "hockey": "261332"}

    # Fetch all cards from inventory
    cards_map = {}
    for cid in all_ids:
        card = await db.inventory.find_one({"id": cid, "user_id": user_id}, {"_id": 0})
        if card and not card.get("listed"):
            existing = await db.scheduled_posts.find_one({"card_id": cid, "user_id": user_id, "status": {"$in": ["pending", "processing"]}}, {"_id": 0})
            if not existing:
                cards_map[cid] = card

    # Use prices provided by frontend (market values looked up client-side)
    price_overrides = body.get("prices", {})

    # Schedule start: today if before post hour, otherwise tomorrow
    now = datetime.now(timezone.utc)
    today_post = now.replace(hour=post_hour_utc, minute=0, second=0, microsecond=0) + timedelta(days=day_shift)
    if now < today_post:
        start_day = today_post
    else:
        start_day = today_post + timedelta(days=1)

    added_auctions = []
    added_fixed = []
    needs_price = []
    auction_day = 0
    fixed_day = 0
    fixed_in_batch = 0

    def build_title(card):
        from routers.ebay import generate_listing_title
        return generate_listing_title(card)

    # --- Schedule AUCTIONS: 1 per day ---
    for cid in auction_ids:
        card = cards_map.get(cid)
        if not card:
            continue
        price = price_overrides.get(cid)
        if not price or float(price) <= 0:
            needs_price.append({"card_id": cid, "player": card.get("player", ""), "type": "auction"})
            continue

        starting_bid = round(float(price) * (auction_start_pct / 100), 2)
        scheduled_at = start_day + timedelta(days=auction_day)
        sport = card.get("sport", "Baseball")

        post = {
            "id": str(uuid.uuid4())[:12],
            "user_id": user_id,
            "card_id": cid,
            "queue_type": "auction",
            "status": "pending",
            "scheduled_at": scheduled_at.isoformat(),
            "title": build_title(card),
            "player": card.get("player", ""),
            "year": str(card.get("year", "")),
            "set_name": card.get("set_name", ""),
            "variation": card.get("variation", ""),
            "sport": sport,
            "card_number": card.get("card_number", ""),
            "grading_company": card.get("grading_company", ""),
            "grade": str(card.get("grade", "")) if card.get("grade") else "",
            "image": card.get("image", ""),
            "back_image": card.get("back_image", ""),
            "category_id": cat_map.get(sport.lower(), "261328"),
            "price": float(price),
            "starting_bid": starting_bid,
            "reserve_price": None,
            "buy_it_now": None,
            "auction_duration": auction_duration,
            "shipping_option": shipping_option,
            "shipping_cost": shipping_cost,
            "condition_id": 2750 if card.get("condition") == "Graded" else 400010,
            "condition": card.get("condition", ""),
            "card_condition": card.get("card_condition", "Near Mint or Better"),
            "best_offer": False,
            "postal_code": settings.get("postal_code", ""),
            "location": settings.get("location", ""),
            "ebay_item_id": None,
            "error_message": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "posted_at": None,
        }
        await db.scheduled_posts.insert_one(post)
        post.pop("_id", None)
        added_auctions.append(post)
        auction_day += 1

    # --- Schedule FIXED PRICE: batches of 5-6 per day ---
    for cid in fixed_ids:
        card = cards_map.get(cid)
        if not card:
            continue
        price = price_overrides.get(cid)
        if not price or float(price) <= 0:
            needs_price.append({"card_id": cid, "player": card.get("player", ""), "type": "fixed"})
            continue

        # Within each day, space items 10 minutes apart
        scheduled_at = start_day + timedelta(days=fixed_day, minutes=fixed_in_batch * 10)
        sport = card.get("sport", "Baseball")

        post = {
            "id": str(uuid.uuid4())[:12],
            "user_id": user_id,
            "card_id": cid,
            "queue_type": "fixed_price",
            "status": "pending",
            "scheduled_at": scheduled_at.isoformat(),
            "title": build_title(card),
            "player": card.get("player", ""),
            "year": str(card.get("year", "")),
            "set_name": card.get("set_name", ""),
            "variation": card.get("variation", ""),
            "sport": sport,
            "card_number": card.get("card_number", ""),
            "grading_company": card.get("grading_company", ""),
            "grade": str(card.get("grade", "")) if card.get("grade") else "",
            "image": card.get("image", ""),
            "back_image": card.get("back_image", ""),
            "category_id": cat_map.get(sport.lower(), "261328"),
            "price": float(price),
            "starting_bid": 0.99,
            "reserve_price": None,
            "buy_it_now": None,
            "auction_duration": "Days_7",
            "shipping_option": shipping_option,
            "shipping_cost": shipping_cost,
            "condition_id": 2750 if card.get("condition") == "Graded" else 400010,
            "condition": card.get("condition", ""),
            "card_condition": card.get("card_condition", "Near Mint or Better"),
            "best_offer": True,
            "postal_code": settings.get("postal_code", ""),
            "location": settings.get("location", ""),
            "ebay_item_id": None,
            "error_message": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "posted_at": None,
        }
        await db.scheduled_posts.insert_one(post)
        post.pop("_id", None)
        added_fixed.append(post)

        fixed_in_batch += 1
        if fixed_in_batch >= batch_size:
            fixed_in_batch = 0
            fixed_day += 1

    # Save best offer settings
    if auto_decline_pct or auto_accept_pct:
        await db.user_settings.update_one(
            {"user_id": user_id},
            {"$set": {
                "best_offer_auto_decline_pct": auto_decline_pct,
                "best_offer_auto_accept_pct": auto_accept_pct,
            }},
            upsert=True,
        )

    # Mark all scheduled cards in inventory
    all_scheduled_ids = [p["card_id"] for p in added_auctions + added_fixed]
    if all_scheduled_ids:
        await db.inventory.update_many(
            {"id": {"$in": all_scheduled_ids}, "user_id": user_id},
            {"$set": {"scheduled": True}}
        )

    total_days = max(auction_day, fixed_day + (1 if fixed_in_batch > 0 else 0))
    return {
        "success": True,
        "auctions_scheduled": len(added_auctions),
        "fixed_scheduled": len(added_fixed),
        "total_days": total_days,
        "needs_price": needs_price,
        "note": f"Strategy launched! {len(added_auctions)} auctions + {len(added_fixed)} fixed price over {total_days} days",
    }


# ========== BACKGROUND SCHEDULER ==========

async def _create_ebay_listing(post: dict, token: str) -> dict:
    """Create an eBay listing (fixed price or auction) from a scheduled post."""
    from routers.ebay import _upload_image_to_ebay, build_item_specifics, build_best_offer_xml

    # Upload images
    picture_urls = []
    for img_field in ["image", "back_image"]:
        img_b64 = post.get(img_field, "")
        if img_b64:
            try:
                url = await _upload_image_to_ebay(token, img_b64, img_field, post.get("title", "card"))
                if url:
                    picture_urls.append(url)
            except Exception as e:
                logger.warning(f"Schedule: image upload failed ({img_field}): {e}")

    if not picture_urls:
        return {"success": False, "error": "Failed to upload images to eBay"}

    pics_xml = "".join(f"<PictureURL>{url}</PictureURL>" for url in picture_urls)

    # Build condition
    grading_co = post.get("grading_company", "")
    grade_val = post.get("grade", "")
    is_graded = bool(grading_co and grade_val)

    GRADER_IDS = {"PSA": "275010", "BCCG": "275011", "BVG": "275012", "BGS": "275013", "CSG": "275014", "CGC": "275015", "SGC": "275016", "KSA": "275017", "GMA": "275018", "HGA": "275019", "ISA": "2750110", "Other": "2750123"}
    GRADE_IDS = {"10": "275020", "9.5": "275021", "9": "275022", "8.5": "275023", "8": "275024", "7.5": "275025", "7": "275026", "6.5": "275027", "6": "275028", "5.5": "275029", "5": "2750210", "4.5": "2750211", "4": "2750212", "3.5": "2750213", "3": "2750214", "2.5": "2750215", "2": "2750216", "1.5": "2750217", "1": "2750218", "Authentic": "2750219"}

    if is_graded:
        condition_id = 2750
        grader_id = GRADER_IDS.get(grading_co, "2750123")
        grade_normalized = str(grade_val).rstrip('0').rstrip('.') if '.' in str(grade_val) else str(grade_val)
        grade_id = GRADE_IDS.get(grade_normalized, "275022")
        cond_xml = f'<ConditionDescriptors><ConditionDescriptor><Name>27501</Name><Value>{grader_id}</Value></ConditionDescriptor><ConditionDescriptor><Name>27502</Name><Value>{grade_id}</Value></ConditionDescriptor></ConditionDescriptors>'
    else:
        condition_id = 4000
        card_cond = str(post.get("condition_id", 400010))
        cond_xml = f'<ConditionDescriptors><ConditionDescriptor><Name>40001</Name><Value>{card_cond}</Value></ConditionDescriptor></ConditionDescriptors>'

    # Build item specifics
    specifics = build_item_specifics(post)
    specifics_xml = "<ItemSpecifics>" + "".join(specifics) + "</ItemSpecifics>"

    # Shipping
    ship_opt = post.get("shipping_option", "USPSFirstClass")
    ship_cost = post.get("shipping_cost", 1.50)
    ship_map = {
        "FreeShipping": '<ShippingServiceOptions><ShippingService>USPSMedia</ShippingService><ShippingServiceCost>0.00</ShippingServiceCost><FreeShipping>true</FreeShipping></ShippingServiceOptions>',
        "PWEEnvelope": f'<ShippingServiceOptions><ShippingService>USPSFirstClass</ShippingService><ShippingServiceCost>{ship_cost:.2f}</ShippingServiceCost></ShippingServiceOptions>',
        "USPSFirstClass": f'<ShippingServiceOptions><ShippingService>USPSFirstClass</ShippingService><ShippingServiceCost>{ship_cost:.2f}</ShippingServiceCost></ShippingServiceOptions>',
        "USPSPriority": f'<ShippingServiceOptions><ShippingService>USPSPriority</ShippingService><ShippingServiceCost>{ship_cost:.2f}</ShippingServiceCost></ShippingServiceOptions>',
    }
    ship_xml = f"<ShippingDetails><ShippingType>Flat</ShippingType>{ship_map.get(ship_opt, ship_map['USPSFirstClass'])}</ShippingDetails>"

    safe_title = html.escape(post.get("title", "Card")[:80])
    postal = html.escape(post.get("postal_code", ""))
    location = html.escape(post.get("location", ""))

    # Determine listing type
    is_auction = post.get("queue_type") == "auction"

    if is_auction:
        api_call = "AddItem"
        listing_type = "Chinese"
        duration = post.get("auction_duration", "Days_7")
        start_price = post.get("starting_bid", 0.99)

        # Optional auction fields
        extra_xml = ""
        if post.get("reserve_price") and float(post["reserve_price"]) > 0:
            extra_xml += f'<ReservePrice currencyID="USD">{float(post["reserve_price"]):.2f}</ReservePrice>'
        if post.get("buy_it_now") and float(post["buy_it_now"]) > 0:
            extra_xml += f'<BuyItNowPrice currencyID="USD">{float(post["buy_it_now"]):.2f}</BuyItNowPrice>'
    else:
        api_call = "AddFixedPriceItem"
        listing_type = "FixedPriceItem"
        duration = "GTC"
        start_price = post.get("price", 9.99)
        extra_xml = ""
        if post.get("best_offer"):
            sched_user_settings = await db.user_settings.find_one({"user_id": post.get("user_id")}, {"_id": 0}) or {}
            extra_xml = build_best_offer_xml(start_price, sched_user_settings)

    xml_body = f'''<?xml version="1.0" encoding="utf-8"?>
<{api_call}Request xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials><eBayAuthToken>{token}</eBayAuthToken></RequesterCredentials>
  <Item>
    <Title>{safe_title}</Title><Description>{safe_title}</Description>
    <PrimaryCategory><CategoryID>{post.get("category_id", "261328")}</CategoryID></PrimaryCategory>
    <StartPrice currencyID="USD">{start_price:.2f}</StartPrice>
    <Quantity>1</Quantity>
    <CategoryMappingAllowed>true</CategoryMappingAllowed>
    <ConditionID>{condition_id}</ConditionID>{cond_xml}
    <Country>US</Country><Currency>USD</Currency>
    <PostalCode>{postal}</PostalCode><Location>{location}</Location>
    <DispatchTimeMax>1</DispatchTimeMax>
    <ListingDuration>{duration}</ListingDuration><ListingType>{listing_type}</ListingType>
    <PictureDetails>{pics_xml}</PictureDetails>
    {ship_xml}{specifics_xml}{extra_xml}
    <ReturnPolicy><ReturnsAcceptedOption>ReturnsAccepted</ReturnsAcceptedOption><RefundOption>MoneyBack</RefundOption><ReturnsWithinOption>Days_30</ReturnsWithinOption><ShippingCostPaidByOption>Buyer</ShippingCostPaidByOption></ReturnPolicy>
  </Item>
</{api_call}Request>'''

    try:
        async with httpx.AsyncClient(timeout=60.0) as http_client:
            resp = await http_client.post("https://api.ebay.com/ws/api.dll", headers={
                "X-EBAY-API-SITEID": "0", "X-EBAY-API-COMPATIBILITY-LEVEL": "967",
                "X-EBAY-API-CALL-NAME": api_call, "X-EBAY-API-IAF-TOKEN": token,
                "Content-Type": "text/xml",
            }, content=xml_body)

        ns = {"e": "urn:ebay:apis:eBLBaseComponents"}
        root = ET.fromstring(resp.text)
        ack = root.find("e:Ack", ns)

        if ack is not None and ack.text in ("Success", "Warning"):
            item_id_el = root.find(".//e:ItemID", ns)
            ebay_item_id = item_id_el.text if item_id_el is not None else ""
            return {"success": True, "ebay_item_id": ebay_item_id}
        else:
            errors = [e.find("e:LongMessage", ns).text for e in root.findall(".//e:Errors", ns)
                      if e.find("e:SeverityCode", ns) is not None and e.find("e:SeverityCode", ns).text == "Error"
                      and e.find("e:LongMessage", ns) is not None]
            return {"success": False, "error": "; ".join(errors) if errors else "Unknown eBay error"}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def run_schedule_worker():
    """Background worker — checks every 60 seconds for posts to publish."""
    import asyncio
    logger.info("Schedule Worker started")

    while True:
        try:
            now = datetime.now(timezone.utc).isoformat()
            pending = await db.scheduled_posts.find(
                {"status": "pending", "scheduled_at": {"$lte": now}},
                {"_id": 0}
            ).to_list(10)

            for post in pending:
                user_id = post["user_id"]
                # Atomically mark as processing to prevent double-posting
                lock = await db.scheduled_posts.find_one_and_update(
                    {"id": post["id"], "status": "pending"},
                    {"$set": {"status": "processing"}},
                )
                if not lock:
                    continue  # Already picked up by another cycle
                try:
                    token = await get_ebay_user_token(user_id)
                    if not token:
                        await db.scheduled_posts.update_one(
                            {"id": post["id"]},
                            {"$set": {"status": "failed", "error_message": "No eBay token — please reconnect eBay"}}
                        )
                        continue

                    result = await _create_ebay_listing(post, token)

                    if result["success"]:
                        ebay_item_id = result["ebay_item_id"]
                        await db.scheduled_posts.update_one(
                            {"id": post["id"]},
                            {"$set": {
                                "status": "posted",
                                "ebay_item_id": ebay_item_id,
                                "posted_at": datetime.now(timezone.utc).isoformat(),
                            }}
                        )
                        # Mark card as listed and clear scheduled flag
                        await db.inventory.update_one(
                            {"id": post["card_id"], "user_id": user_id},
                            {"$set": {"listed": True, "scheduled": False, "ebay_item_id": ebay_item_id}}
                        )
                        logger.info(f"Schedule: posted {post['title']} -> {ebay_item_id}")
                    else:
                        await db.scheduled_posts.update_one(
                            {"id": post["id"]},
                            {"$set": {"status": "failed", "error_message": result.get("error", "Unknown error")}}
                        )
                        logger.warning(f"Schedule: failed {post['title']} -> {result.get('error')}")

                except Exception as e:
                    logger.error(f"Schedule: error processing {post['id']}: {e}")
                    await db.scheduled_posts.update_one(
                        {"id": post["id"]},
                        {"$set": {"status": "failed", "error_message": str(e)}}
                    )

        except Exception as e:
            logger.error(f"Schedule Worker error: {e}")

        await asyncio.sleep(60)
