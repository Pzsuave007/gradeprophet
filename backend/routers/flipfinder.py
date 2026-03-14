from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime, timezone
import uuid
import logging
import httpx
from database import db
from utils.auth import get_current_user
from utils.ebay import get_ebay_app_token, get_ebay_user_token, ebay_browse_search

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

async def search_ebay_for_card(query: str, limit: int = 20) -> list:
    """Search eBay for cards using Browse API"""
    try:
        items = await ebay_browse_search(query, limit=limit, sort="newlyListed")
        results = []
        for item in items:
            price_info = item.get("price", {})
            price_str = f"${price_info.get('value', '0')}"
            price_value = float(price_info.get("value", 0))
            buying_options = item.get("buyingOptions", [])
            listing_type = "auction" if "AUCTION" in buying_options else "buy_now"
            image_url = item.get("image", {}).get("imageUrl", "")

            results.append({
                "ebay_item_id": item.get("itemId", ""),
                "title": item.get("title", ""),
                "price": price_str,
                "price_value": price_value,
                "listing_type": listing_type,
                "time_left": None,
                "image_url": image_url.replace("s-l225", "s-l500") if image_url else "",
                "listing_url": item.get("itemWebUrl", ""),
                "bids": None,
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
    cards = await db.watchlist_cards.find({"user_id": user_id}, {"_id": 0}).to_list(100)

    total_new = 0
    cards_with_results = []

    for card in cards:
        results = await search_ebay_for_card(card["search_query"])

        existing_ids = set()
        existing = await db.ebay_listings.find(
            {"watchlist_card_id": card["id"], "user_id": user_id},
            {"_id": 0, "ebay_item_id": 1}
        ).to_list(1000)
        existing_ids = {e["ebay_item_id"] for e in existing}

        new_count = 0
        for item in results:
            if item["ebay_item_id"] and item["ebay_item_id"] not in existing_ids:
                listing = EbayListing(
                    watchlist_card_id=card["id"],
                    ebay_item_id=item["ebay_item_id"],
                    title=item["title"],
                    price=item["price"],
                    price_value=item["price_value"],
                    listing_type=item["listing_type"],
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

    total = await db.ebay_listings.count_documents(query)
    listings = await db.ebay_listings.find(query, {"_id": 0}).sort("found_at", -1).skip(skip).limit(limit).to_list(limit)
    return listings


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
