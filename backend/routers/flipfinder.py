from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime, timezone, timedelta
import uuid
import asyncio
import logging
import httpx
from database import db
from utils.auth import get_current_user
from utils.ebay import (
    get_ebay_app_token, get_ebay_user_token, ebay_browse_search,
    get_ebay_item_details, place_ebay_bid, extract_ebay_item_id,
    place_ebay_purchase, place_ebay_offer
)

logger = logging.getLogger(__name__)
router = APIRouter(tags=["flipfinder"])


# ---- Models ----

class WatchlistCard(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    search_query: str
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_searched: Optional[datetime] = None
    listings_found: int = 0

class WatchlistCardCreate(BaseModel):
    search_query: str
    notes: Optional[str] = None

class WatchlistCardResponse(BaseModel):
    id: str
    search_query: str
    notes: Optional[str] = None
    created_at: str
    last_searched: Optional[str] = None
    listings_found: int = 0

class EbayListing(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    watchlist_card_id: str
    ebay_item_id: str
    title: str
    price: str
    price_value: float
    listing_type: str
    buying_options: List[str] = []
    accepts_offers: bool = False
    time_left: Optional[str] = None
    image_url: str
    listing_url: str
    bids: Optional[int] = None
    found_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    status: str = "new"
    search_query: str

class EbayListingResponse(BaseModel):
    id: str
    watchlist_card_id: str
    ebay_item_id: str
    title: str
    price: str
    price_value: float
    listing_type: str
    time_left: Optional[str] = None
    image_url: str
    listing_url: str
    bids: Optional[int] = None
    found_at: str
    status: str
    search_query: str

class SearchResultSummary(BaseModel):
    total_cards_searched: int
    new_listings_found: int
    cards_with_results: List[str]


# ---- Helper ----

async def search_ebay_for_card(query: str, limit: int = 20, sort: str = "endingSoonest") -> list:
    """Search eBay for cards using Browse API"""
    try:
        items = await ebay_browse_search(query, limit=limit, sort=sort)
        results = []
        for item in items:
            # Use currentBidPrice for auctions, fallback to price for BIN
            price_info = item.get("currentBidPrice") or item.get("price", {})
            price_value = float(price_info.get("value", 0))
            price_str = f"${price_value:.2f}" if price_value else f"${item.get('price', {}).get('value', '0')}"

            buying_options = item.get("buyingOptions", [])
            listing_type = "auction" if "AUCTION" in buying_options else "buy_now"
            accepts_offers = "BEST_OFFER" in buying_options
            image_url = item.get("image", {}).get("imageUrl", "")

            # Get bid count and end date
            bid_count = item.get("bidCount", 0)
            end_date = item.get("itemEndDate")

            results.append({
                "ebay_item_id": item.get("itemId", ""),
                "title": item.get("title", ""),
                "price": price_str,
                "price_value": price_value,
                "listing_type": listing_type,
                "buying_options": buying_options,
                "accepts_offers": accepts_offers,
                "time_left": end_date,
                "image_url": image_url.replace("s-l225", "s-l500") if image_url else "",
                "listing_url": item.get("itemWebUrl", ""),
                "bids": bid_count,
            })
        return results
    except Exception as e:
        logger.error(f"eBay search for '{query}' failed: {e}")
        return []


# ---- Routes ----

@router.post("/watchlist", response_model=WatchlistCardResponse)
async def add_to_watchlist(data: WatchlistCardCreate, request: Request):
    """Add a card search to the watchlist"""
    user = await get_current_user(request)
    user_id = user["user_id"]
    card = WatchlistCard(search_query=data.search_query, notes=data.notes)
    doc = card.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['last_searched'] = doc['last_searched'].isoformat() if doc['last_searched'] else None
    doc['user_id'] = user_id
    await db.watchlist_cards.insert_one(doc)
    doc.pop("_id", None)
    return WatchlistCardResponse(**doc)


@router.get("/watchlist")
async def get_watchlist(request: Request):
    """Get all watchlist cards with their listings"""
    user = await get_current_user(request)
    cards = await db.watchlist_cards.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    result = []
    for card in cards:
        listings = await db.ebay_listings.find(
            {"watchlist_card_id": card["id"], "status": {"$ne": "deleted"}, "user_id": user["user_id"]},
            {"_id": 0}
        ).sort("found_at", -1).to_list(50)
        card["listings"] = listings
        card["listings_found"] = len(listings)
        result.append(card)
    return result


@router.delete("/watchlist/{card_id}")
async def remove_from_watchlist(card_id: str, request: Request):
    """Remove a card from watchlist and its listings"""
    user = await get_current_user(request)
    result = await db.watchlist_cards.delete_one({"id": card_id, "user_id": user["user_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Watchlist card not found")
    await db.ebay_listings.delete_many({"watchlist_card_id": card_id, "user_id": user["user_id"]})
    return {"message": "Card removed from watchlist"}


@router.put("/watchlist/{card_id}")
async def update_watchlist_card(card_id: str, request: Request):
    """Update watchlist card notes"""
    user = await get_current_user(request)
    body = await request.json()
    notes = body.get("notes")
    await db.watchlist_cards.update_one(
        {"id": card_id, "user_id": user["user_id"]},
        {"$set": {"notes": notes}}
    )
    return {"message": "Updated"}


@router.post("/watchlist/search", response_model=SearchResultSummary)
async def search_all_watchlist_cards(request: Request):
    """Search eBay for all cards in the watchlist"""
    user = await get_current_user(request)
    user_id = user["user_id"]

    body = {}
    try:
        body = await request.json()
    except Exception:
        pass
    sort = body.get("sort", "endingSoonest")
    valid_sorts = ["endingSoonest", "newlyListed", "price", "-price"]
    if sort not in valid_sorts:
        sort = "endingSoonest"

    cards = await db.watchlist_cards.find({"user_id": user_id}, {"_id": 0}).to_list(100)

    total_new = 0
    cards_with_results = []

    for card in cards:
        results = await search_ebay_for_card(card["search_query"], sort=sort)

        existing_ids = set()
        existing = await db.ebay_listings.find(
            {"watchlist_card_id": card["id"], "user_id": user_id},
            {"_id": 0, "ebay_item_id": 1}
        ).to_list(1000)
        existing_ids = {e["ebay_item_id"] for e in existing}

        new_count = 0
        for item in results:
            if not item["ebay_item_id"]:
                continue
            if item["ebay_item_id"] in existing_ids:
                # Update existing listing with fresh data
                await db.ebay_listings.update_one(
                    {"ebay_item_id": item["ebay_item_id"], "user_id": user_id},
                    {"$set": {
                        "price": item["price"],
                        "price_value": item["price_value"],
                        "bids": item.get("bids"),
                        "time_left": item.get("time_left"),
                        "buying_options": item.get("buying_options", []),
                        "accepts_offers": item.get("accepts_offers", False),
                    }}
                )
            else:
                listing = EbayListing(
                    watchlist_card_id=card["id"],
                    ebay_item_id=item["ebay_item_id"],
                    title=item["title"],
                    price=item["price"],
                    price_value=item["price_value"],
                    listing_type=item["listing_type"],
                    buying_options=item.get("buying_options", []),
                    accepts_offers=item.get("accepts_offers", False),
                    time_left=item.get("time_left"),
                    image_url=item["image_url"],
                    listing_url=item["listing_url"],
                    bids=item.get("bids"),
                    search_query=card["search_query"],
                )
                doc = listing.model_dump()
                doc['found_at'] = doc['found_at'].isoformat()
                doc['user_id'] = user_id
                await db.ebay_listings.insert_one(doc)
                doc.pop("_id", None)
                new_count += 1

        if new_count > 0:
            cards_with_results.append(card["search_query"])
            total_new += new_count

        await db.watchlist_cards.update_one(
            {"id": card["id"]},
            {"$set": {"last_searched": datetime.now(timezone.utc).isoformat(), "listings_found": len(results)}}
        )

    return SearchResultSummary(
        total_cards_searched=len(cards),
        new_listings_found=total_new,
        cards_with_results=cards_with_results
    )


@router.get("/listings")
async def get_listings(
    request: Request,
    watchlist_card_id: Optional[str] = None,
    status: Optional[str] = None,
    listing_type: Optional[str] = None,
    skip: int = 0,
    limit: int = 20
):
    """Get eBay listings"""
    user = await get_current_user(request)
    query = {"user_id": user["user_id"]}
    if watchlist_card_id:
        query["watchlist_card_id"] = watchlist_card_id
    if status:
        query["status"] = status
    else:
        query["status"] = {"$ne": "deleted"}
    if listing_type and listing_type != "all":
        if listing_type == "offers":
            query["accepts_offers"] = True
        else:
            query["listing_type"] = listing_type

    total = await db.ebay_listings.count_documents(query)
    listings = await db.ebay_listings.find(query, {"_id": 0}).sort("found_at", -1).skip(skip).limit(limit).to_list(limit)
    return {"total": total, "listings": listings}


@router.put("/listings/{listing_id}/status")
async def update_listing_status(listing_id: str, request: Request):
    """Update listing status"""
    user = await get_current_user(request)
    body = await request.json()
    new_status = body.get("status", "seen")
    valid = ["new", "seen", "interested", "ignored", "deleted"]
    if new_status not in valid:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be: {valid}")
    result = await db.ebay_listings.update_one(
        {"id": listing_id, "user_id": user["user_id"]},
        {"$set": {"status": new_status}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Listing not found")
    return {"message": f"Status updated to {new_status}"}


@router.delete("/listings/{listing_id}")
async def delete_listing(listing_id: str, request: Request):
    """Delete a listing"""
    user = await get_current_user(request)
    result = await db.ebay_listings.update_one(
        {"id": listing_id, "user_id": user["user_id"]},
        {"$set": {"status": "deleted"}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Listing not found")
    return {"message": "Listing deleted"}


@router.delete("/listings")
async def clear_listings(request: Request, watchlist_card_id: Optional[str] = None):
    """Clear all listings"""
    user = await get_current_user(request)
    query = {"user_id": user["user_id"]}
    if watchlist_card_id:
        query["watchlist_card_id"] = watchlist_card_id
    result = await db.ebay_listings.update_many(query, {"$set": {"status": "deleted"}})
    return {"message": f"Cleared {result.modified_count} listings"}


@router.get("/listings/stats")
async def get_listings_stats(request: Request):
    """Get listing statistics"""
    user = await get_current_user(request)
    uq = {"user_id": user["user_id"]}
    total = await db.ebay_listings.count_documents({**uq, "status": {"$ne": "deleted"}})
    new_count = await db.ebay_listings.count_documents({**uq, "status": "new"})
    interested = await db.ebay_listings.count_documents({**uq, "status": "interested"})
    return {"total": total, "new": new_count, "interested": interested}


@router.get("/test-ebay")
async def test_ebay_connection():
    """Test eBay API connection"""
    try:
        items = await ebay_browse_search("sports card PSA 10", limit=3)
        token = await get_ebay_user_token()
        return {
            "browse_api": "connected" if items else "no results",
            "items_found": len(items),
            "user_token": "connected" if token else "not connected",
            "sample_titles": [i.get("title", "")[:60] for i in items[:3]],
        }
    except Exception as e:
        return {"status": "error", "error": str(e)}


# ---- Snipe Models ----

class SnipeTaskCreate(BaseModel):
    ebay_url_or_id: str
    max_bid: float
    snipe_seconds_before: int = 3

class SnipeTaskResponse(BaseModel):
    id: str
    user_id: str
    ebay_item_id: str
    item_title: str
    item_image_url: str
    item_url: str
    current_price: float
    minimum_to_bid: float
    bid_count: int
    max_bid: float
    snipe_seconds_before: int
    auction_end_time: str
    status: str
    result_message: Optional[str] = None
    bid_placed_at: Optional[str] = None
    created_at: str
    updated_at: str


# ---- Snipe Routes ----

@router.post("/snipes")
async def create_snipe(data: SnipeTaskCreate, request: Request):
    """Create an auction snipe task"""
    user = await get_current_user(request)
    user_id = user["user_id"]

    # Validate max bid
    if data.max_bid <= 0:
        raise HTTPException(status_code=400, detail="Max bid must be greater than 0")
    if data.snipe_seconds_before < 2 or data.snipe_seconds_before > 30:
        raise HTTPException(status_code=400, detail="Snipe timing must be between 2-30 seconds")

    # Extract item ID
    item_id = extract_ebay_item_id(data.ebay_url_or_id)
    if not item_id:
        raise HTTPException(status_code=400, detail="Could not extract eBay item ID from input")

    # Check eBay connection
    token = await get_ebay_user_token()
    if not token:
        raise HTTPException(status_code=400, detail="eBay account not connected. Link your eBay account first.")

    # Get item details
    details = await get_ebay_item_details(item_id)
    if not details:
        raise HTTPException(status_code=400, detail="Could not fetch item details from eBay. Check the URL/ID.")

    if not details["is_auction"]:
        raise HTTPException(status_code=400, detail="This item is not an auction. Sniping only works on auction listings.")

    if not details["auction_end_time"]:
        raise HTTPException(status_code=400, detail="Could not determine auction end time.")

    # Check if auction has ended
    end_time = datetime.fromisoformat(details["auction_end_time"].replace("Z", "+00:00"))
    now = datetime.now(timezone.utc)
    if end_time <= now:
        raise HTTPException(status_code=400, detail="This auction has already ended.")

    # Check for duplicate
    existing = await db.snipe_tasks.find_one({
        "user_id": user_id,
        "ebay_item_id": item_id,
        "status": {"$in": ["scheduled", "monitoring"]}
    })
    if existing:
        raise HTTPException(status_code=400, detail="You already have an active snipe for this item.")

    snipe = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "ebay_item_id": item_id,
        "item_title": details["title"],
        "item_image_url": details["image_url"],
        "item_url": details["item_url"],
        "current_price": details["current_price"],
        "minimum_to_bid": details["minimum_to_bid"],
        "bid_count": details["bid_count"],
        "max_bid": data.max_bid,
        "snipe_seconds_before": data.snipe_seconds_before,
        "auction_end_time": details["auction_end_time"],
        "status": "scheduled",
        "result_message": None,
        "bid_placed_at": None,
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
    }

    await db.snipe_tasks.insert_one(snipe)
    snipe.pop("_id", None)
    return snipe


@router.get("/snipes")
async def get_snipes(request: Request):
    """Get all snipe tasks for the user"""
    user = await get_current_user(request)
    snipes = await db.snipe_tasks.find(
        {"user_id": user["user_id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return snipes


@router.get("/snipes/{snipe_id}")
async def get_snipe(snipe_id: str, request: Request):
    """Get a specific snipe task"""
    user = await get_current_user(request)
    snipe = await db.snipe_tasks.find_one(
        {"id": snipe_id, "user_id": user["user_id"]},
        {"_id": 0}
    )
    if not snipe:
        raise HTTPException(status_code=404, detail="Snipe not found")
    return snipe


@router.delete("/snipes/{snipe_id}")
async def cancel_snipe(snipe_id: str, request: Request):
    """Cancel a snipe task"""
    user = await get_current_user(request)
    result = await db.snipe_tasks.update_one(
        {"id": snipe_id, "user_id": user["user_id"], "status": {"$in": ["scheduled", "monitoring"]}},
        {"$set": {"status": "cancelled", "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Active snipe not found")
    return {"message": "Snipe cancelled"}


@router.post("/snipes/{snipe_id}/refresh")
async def refresh_snipe(snipe_id: str, request: Request):
    """Refresh item details for a snipe"""
    user = await get_current_user(request)
    snipe = await db.snipe_tasks.find_one(
        {"id": snipe_id, "user_id": user["user_id"]},
        {"_id": 0}
    )
    if not snipe:
        raise HTTPException(status_code=404, detail="Snipe not found")

    details = await get_ebay_item_details(snipe["ebay_item_id"])
    if not details:
        raise HTTPException(status_code=500, detail="Could not refresh item details")

    updates = {
        "current_price": details["current_price"],
        "minimum_to_bid": details["minimum_to_bid"],
        "bid_count": details["bid_count"],
        "auction_end_time": details["auction_end_time"],
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.snipe_tasks.update_one({"id": snipe_id}, {"$set": updates})

    snipe.update(updates)
    return snipe


@router.get("/snipes-stats")
async def get_snipe_stats(request: Request):
    """Get snipe statistics"""
    user = await get_current_user(request)
    uq = {"user_id": user["user_id"]}
    active = await db.snipe_tasks.count_documents({**uq, "status": {"$in": ["scheduled", "monitoring"]}})
    won = await db.snipe_tasks.count_documents({**uq, "status": "won"})
    lost = await db.snipe_tasks.count_documents({**uq, "status": {"$in": ["lost", "outbid"]}})
    total = await db.snipe_tasks.count_documents(uq)
    return {"active": active, "won": won, "lost": lost, "total": total}


@router.post("/snipes/check-item")
async def check_item_for_snipe(request: Request):
    """Check an eBay item before creating a snipe"""
    await get_current_user(request)
    body = await request.json()
    url_or_id = body.get("ebay_url_or_id", "")

    item_id = extract_ebay_item_id(url_or_id)
    if not item_id:
        raise HTTPException(status_code=400, detail="Could not extract eBay item ID")

    details = await get_ebay_item_details(item_id)
    if not details:
        raise HTTPException(status_code=400, detail="Could not fetch item details")

    return details


# ---- Buy Now & Make Offer ----

class BuyNowRequest(BaseModel):
    ebay_item_id: str
    price: float

class MakeOfferRequest(BaseModel):
    ebay_item_id: str
    offer_amount: float
    message: Optional[str] = ""


@router.post("/buy-now")
async def buy_now(data: BuyNowRequest, request: Request):
    """Buy It Now on an eBay listing"""
    user = await get_current_user(request)

    if data.price <= 0:
        raise HTTPException(status_code=400, detail="Price must be greater than 0")

    token = await get_ebay_user_token()
    if not token:
        raise HTTPException(status_code=400, detail="eBay account not connected.")

    # Get user IP for eBay requirement
    user_ip = request.client.host if request.client else "0.0.0.0"
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        user_ip = forwarded.split(",")[0].strip()

    item_id = extract_ebay_item_id(data.ebay_item_id)
    result = await place_ebay_purchase(item_id, data.price, user_ip)

    # Log the action
    await db.purchase_log.insert_one({
        "user_id": user["user_id"],
        "ebay_item_id": item_id,
        "action": "buy_now",
        "price": data.price,
        "success": result["success"],
        "result": result.get("error") or "success",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    if not result["success"]:
        raise HTTPException(status_code=400, detail=result.get("error", "Purchase failed"))

    return {"success": True, "message": f"Purchase initiated for ${data.price:.2f}", "order_id": result.get("order_id")}


@router.post("/make-offer")
async def make_offer(data: MakeOfferRequest, request: Request):
    """Make an offer on an eBay listing"""
    user = await get_current_user(request)

    if data.offer_amount <= 0:
        raise HTTPException(status_code=400, detail="Offer amount must be greater than 0")

    token = await get_ebay_user_token()
    if not token:
        raise HTTPException(status_code=400, detail="eBay account not connected.")

    item_id = extract_ebay_item_id(data.ebay_item_id)
    result = await place_ebay_offer(item_id, data.offer_amount, data.message or "")

    # Log the action
    await db.purchase_log.insert_one({
        "user_id": user["user_id"],
        "ebay_item_id": item_id,
        "action": "make_offer",
        "price": data.offer_amount,
        "message": data.message,
        "success": result["success"],
        "result": result.get("error") or "success",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    if not result["success"]:
        raise HTTPException(status_code=400, detail=result.get("error", "Offer failed"))

    return {"success": True, "message": f"Offer of ${data.offer_amount:.2f} sent successfully"}


# ---- Sniper Background Engine ----

_spawned_snipe_ids = set()


async def sniper_background_loop():
    """Background loop that monitors and executes snipe tasks"""
    logger.info("Sniper background engine started")
    while True:
        try:
            now = datetime.now(timezone.utc)
            active_snipes = await db.snipe_tasks.find(
                {"status": {"$in": ["scheduled", "monitoring"]}},
                {"_id": 0}
            ).to_list(200)

            for snipe in active_snipes:
                snipe_id = snipe["id"]

                # Skip already spawned
                if snipe_id in _spawned_snipe_ids:
                    continue

                try:
                    end_str = snipe.get("auction_end_time", "")
                    if not end_str:
                        continue
                    end_time = datetime.fromisoformat(end_str.replace("Z", "+00:00"))
                except (ValueError, TypeError):
                    continue

                fire_time = end_time - timedelta(seconds=snipe.get("snipe_seconds_before", 3))
                seconds_until_fire = (fire_time - now).total_seconds()

                # Auction already ended - mark as missed
                if (end_time - now).total_seconds() < -60:
                    await db.snipe_tasks.update_one(
                        {"id": snipe_id},
                        {"$set": {"status": "missed", "result_message": "Auction ended before snipe fired", "updated_at": now.isoformat()}}
                    )
                    continue

                # Within 90 seconds of fire time - spawn precise task
                if seconds_until_fire <= 90:
                    _spawned_snipe_ids.add(snipe_id)
                    asyncio.create_task(_execute_snipe_task(snipe, fire_time))
                    logger.info(f"Snipe {snipe_id} spawned - fires in {seconds_until_fire:.0f}s")

                # Within 5 minutes - update to monitoring
                elif seconds_until_fire <= 300:
                    if snipe["status"] != "monitoring":
                        await db.snipe_tasks.update_one(
                            {"id": snipe_id},
                            {"$set": {"status": "monitoring", "updated_at": now.isoformat()}}
                        )

        except Exception as e:
            logger.error(f"Sniper loop error: {e}")

        await asyncio.sleep(10)


async def _execute_snipe_task(snipe: dict, fire_time: datetime):
    """Execute a snipe at the precise time"""
    snipe_id = snipe["id"]
    try:
        now = datetime.now(timezone.utc)
        wait_seconds = (fire_time - now).total_seconds()

        if wait_seconds > 0:
            logger.info(f"Snipe {snipe_id}: waiting {wait_seconds:.1f}s before bidding")
            await db.snipe_tasks.update_one(
                {"id": snipe_id},
                {"$set": {"status": "monitoring", "updated_at": now.isoformat()}}
            )
            await asyncio.sleep(max(0, wait_seconds - 5))

            # Final refresh 5 seconds before
            details = await get_ebay_item_details(snipe["ebay_item_id"])
            if details:
                await db.snipe_tasks.update_one(
                    {"id": snipe_id},
                    {"$set": {
                        "current_price": details["current_price"],
                        "bid_count": details["bid_count"],
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }}
                )
                if details["current_price"] > snipe["max_bid"]:
                    await db.snipe_tasks.update_one(
                        {"id": snipe_id},
                        {"$set": {
                            "status": "skipped",
                            "result_message": f"Price ${details['current_price']:.2f} exceeds max bid ${snipe['max_bid']:.2f}",
                            "updated_at": datetime.now(timezone.utc).isoformat()
                        }}
                    )
                    _spawned_snipe_ids.discard(snipe_id)
                    return

            # Wait remaining time
            remaining = (fire_time - datetime.now(timezone.utc)).total_seconds()
            if remaining > 0:
                await asyncio.sleep(remaining)

        # FIRE THE BID
        logger.info(f"Snipe {snipe_id}: FIRING BID ${snipe['max_bid']:.2f} on item {snipe['ebay_item_id']}")
        await db.snipe_tasks.update_one(
            {"id": snipe_id},
            {"$set": {"status": "bidding", "updated_at": datetime.now(timezone.utc).isoformat()}}
        )

        result = await place_ebay_bid(snipe["ebay_item_id"], snipe["max_bid"])
        bid_time = datetime.now(timezone.utc).isoformat()

        if result["success"]:
            await db.snipe_tasks.update_one(
                {"id": snipe_id},
                {"$set": {
                    "status": "bid_placed",
                    "bid_placed_at": bid_time,
                    "result_message": "Bid placed successfully! Waiting for auction to end.",
                    "updated_at": bid_time
                }}
            )
            logger.info(f"Snipe {snipe_id}: bid placed successfully")

            # Wait for auction to end + check result
            await asyncio.sleep(30)
            details = await get_ebay_item_details(snipe["ebay_item_id"])
            if details:
                end_time = datetime.fromisoformat(details["auction_end_time"].replace("Z", "+00:00"))
                if datetime.now(timezone.utc) > end_time:
                    await db.snipe_tasks.update_one(
                        {"id": snipe_id},
                        {"$set": {
                            "status": "won" if details["current_price"] <= snipe["max_bid"] else "outbid",
                            "current_price": details["current_price"],
                            "bid_count": details["bid_count"],
                            "result_message": f"Final price: ${details['current_price']:.2f}",
                            "updated_at": datetime.now(timezone.utc).isoformat()
                        }}
                    )
        else:
            await db.snipe_tasks.update_one(
                {"id": snipe_id},
                {"$set": {
                    "status": "error",
                    "result_message": result.get("error", "Bid failed"),
                    "updated_at": bid_time
                }}
            )
            logger.warning(f"Snipe {snipe_id}: bid failed - {result.get('error')}")

    except Exception as e:
        logger.error(f"Snipe {snipe_id} execution error: {e}")
        await db.snipe_tasks.update_one(
            {"id": snipe_id},
            {"$set": {"status": "error", "result_message": str(e), "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
    finally:
        _spawned_snipe_ids.discard(snipe_id)
