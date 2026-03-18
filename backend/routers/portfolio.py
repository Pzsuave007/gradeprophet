from fastapi import APIRouter, HTTPException, Request
from datetime import datetime, timezone
import logging
from database import db
from utils.auth import get_current_user
from utils.market import get_card_market_value

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/portfolio", tags=["portfolio"])


@router.post("/refresh-value/{item_id}")
async def refresh_single_card_value(item_id: str, request: Request):
    """Refresh market value for a single inventory card"""
    user = await get_current_user(request)
    item = await db.inventory.find_one({"id": item_id, "user_id": user["user_id"]}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    # Build query from card fields, fall back to card_name
    parts = []
    if item.get("year"):
        parts.append(str(item["year"]))
    if item.get("set_name"):
        parts.append(item["set_name"])
    if item.get("player"):
        parts.append(item["player"])
    if item.get("card_number"):
        cn = item["card_number"]
        parts.append(f"#{cn}" if not cn.startswith("#") else cn)
    # Include variation for specific parallel/variant searches
    if item.get("variation"):
        parts.append(item["variation"])
    if item.get("condition") == "Graded" and item.get("grading_company") and item.get("grade"):
        try:
            grade = str(float(item["grade"])).rstrip("0").rstrip(".")
        except (ValueError, TypeError):
            grade = str(item["grade"])
        parts.append(f"{item['grading_company']} {grade}")
    elif item.get("condition") != "Graded":
        # For raw cards, exclude graded results
        parts.append("-PSA -BGS -SGC -CGC")

    # Use individual fields if available, otherwise fall back to card_name
    if len(parts) >= 3:
        query = " ".join(parts)
    else:
        query = item.get("card_name", "")
        # Append variation if not already in card_name
        if item.get("variation") and item["variation"].lower() not in query.lower():
            query += f" {item['variation']}"
        # Append grade info to card_name if graded
        if item.get("condition") == "Graded" and item.get("grading_company") and item.get("grade"):
            try:
                grade = str(float(item["grade"])).rstrip("0").rstrip(".")
            except (ValueError, TypeError):
                grade = str(item["grade"])
            query += f" {item['grading_company']} {grade}"

    logger.info(f"Market query for '{item.get('card_name', '')}': '{query}'")

    try:
        value_data = await get_card_market_value(query)
        stats = value_data.get("primary", {}).get("stats", {})
        # Use weighted average (Card Ladder-inspired) instead of simple median
        market_value = stats.get("market_value", 0) or stats.get("median", 0)
        confidence = stats.get("confidence", 0)
        last_sold = stats.get("last_sold", 0)
        now = datetime.now(timezone.utc).isoformat()

        await db.inventory.update_one(
            {"id": item_id},
            {"$set": {
                "market_value": market_value,
                "market_value_date": now,
                "market_query_used": query,
                "market_confidence": confidence,
                "last_sold_price": last_sold,
                "market_stats": {
                    "avg": stats.get("avg", 0),
                    "median": stats.get("median", 0),
                    "weighted_avg": stats.get("weighted_avg", 0),
                    "min": stats.get("min", 0),
                    "max": stats.get("max", 0),
                    "count": stats.get("count", 0),
                    "outliers_removed": stats.get("outliers_removed", 0),
                }
            }}
        )

        return {
            "id": item_id,
            "market_value": market_value,
            "market_value_date": now,
            "query_used": query,
            "confidence": confidence,
            "last_sold_price": last_sold,
            "data_source": value_data.get("data_source", "unknown"),
            "items_found": stats.get("count", 0),
            "outliers_removed": stats.get("outliers_removed", 0),
            "stats": {
                "avg": stats.get("avg", 0),
                "median": stats.get("median", 0),
                "weighted_avg": stats.get("weighted_avg", 0),
                "min": stats.get("min", 0),
                "max": stats.get("max", 0),
            }
        }
    except Exception as e:
        logger.error(f"Refresh card value failed for {item_id}: {e}")
        return {"id": item_id, "market_value": 0, "error": str(e)}


@router.get("/summary")
async def get_portfolio_summary(request: Request):
    """Get collection summary: total value, invested, P&L, ROI — only 'collection' category cards"""
    user = await get_current_user(request)
    user_id = user["user_id"]
    items = await db.inventory.find({"user_id": user_id, "category": "collection"}, {"_id": 0}).to_list(500)

    total_invested = 0
    total_market_value = 0
    valued_count = 0
    unvalued_count = 0
    cards = []

    for item in items:
        cost = float(item.get("purchase_price") or 0)
        total_invested += cost
        mv = float(item.get("market_value") or 0)
        if mv > 0:
            total_market_value += mv
            valued_count += 1
        else:
            unvalued_count += 1
        cards.append({
            "id": item.get("id"),
            "card_name": item.get("card_name", ""),
            "player": item.get("player", ""),
            "year": item.get("year"),
            "purchase_price": cost,
            "market_value": mv,
            "market_value_date": item.get("market_value_date"),
            "condition": item.get("condition", "Raw"),
            "grade": item.get("grade"),
            "grading_company": item.get("grading_company"),
            "image": item.get("image", ""),
            "confidence": item.get("market_confidence", 0),
            "last_sold_price": float(item.get("last_sold_price") or 0),
            "market_stats": item.get("market_stats"),
        })

    pnl = total_market_value - total_invested if valued_count > 0 else 0
    roi = (pnl / total_invested * 100) if total_invested > 0 and valued_count > 0 else 0

    snapshots = await db.portfolio_snapshots.find({"user_id": user_id}, {"_id": 0}).sort("date", -1).to_list(90)

    return {
        "total_invested": round(total_invested, 2),
        "total_market_value": round(total_market_value, 2),
        "pnl": round(pnl, 2),
        "roi": round(roi, 1),
        "total_cards": len(items),
        "valued_cards": valued_count,
        "unvalued_cards": unvalued_count,
        "cards": sorted(cards, key=lambda c: c.get("market_value", 0), reverse=True),
        "snapshots": list(reversed(snapshots[:30])),
    }


@router.post("/snapshot")
async def save_portfolio_snapshot(request: Request):
    """Save a collection valuation snapshot for trend tracking"""
    user = await get_current_user(request)
    user_id = user["user_id"]
    items = await db.inventory.find({"user_id": user_id, "category": "collection"}, {"_id": 0}).to_list(500)
    total_invested = sum(float(i.get("purchase_price") or 0) for i in items)
    total_market_value = sum(float(i.get("market_value") or 0) for i in items if i.get("market_value"))
    valued = sum(1 for i in items if i.get("market_value"))
    now = datetime.now(timezone.utc)
    snapshot = {
        "date": now.strftime("%Y-%m-%d"),
        "timestamp": now.isoformat(),
        "total_invested": round(total_invested, 2),
        "total_market_value": round(total_market_value, 2),
        "pnl": round(total_market_value - total_invested, 2),
        "total_cards": len(items),
        "valued_cards": valued,
    }
    await db.portfolio_snapshots.update_one(
        {"date": snapshot["date"], "user_id": user_id},
        {"$set": {**snapshot, "user_id": user_id}},
        upsert=True,
    )
    return snapshot
