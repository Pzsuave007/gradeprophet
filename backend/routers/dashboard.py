from fastapi import APIRouter, HTTPException, Request
from collections import defaultdict
from datetime import datetime, timezone, timedelta
import logging
import httpx
from database import db
from utils.auth import get_current_user
from utils.ebay import get_ebay_user_token, ebay_browse_search
from utils.market import detect_sport

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/analytics")
async def get_dashboard_analytics(request: Request):
    """Comprehensive dashboard analytics"""
    user = await get_current_user(request)
    user_id = user["user_id"]

    try:
        token = await get_ebay_user_token()
    except Exception:
        token = None

    sales_timeline = []
    sales_by_month = defaultdict(lambda: {"revenue": 0, "fees": 0, "count": 0})
    total_revenue = 0
    total_fees = 0
    total_profit = 0
    top_sale = None

    if token:
        try:
            async with httpx.AsyncClient(timeout=20.0) as http_client:
                resp = await http_client.get(
                    "https://api.ebay.com/sell/fulfillment/v1/order",
                    headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                    params={"limit": 100}
                )
            if resp.status_code == 200:
                orders = resp.json().get("orders", [])
                for o in orders:
                    date_str = o.get("creationDate", "")[:10]
                    pricing = o.get("pricingSummary", {})
                    order_total = float(pricing.get("total", {}).get("value", 0))
                    fee = float(o.get("totalMarketplaceFee", {}).get("value", 0))
                    profit = order_total - fee
                    line_items = o.get("lineItems", [])
                    title = line_items[0].get("title", "Unknown") if line_items else "Unknown"
                    img = ""
                    if line_items and line_items[0].get("legacyItemId"):
                        img = f"https://i.ebayimg.com/images/g/{line_items[0].get('legacyItemId', '')}/s-l140.jpg"

                    sale = {
                        "date": date_str, "total": order_total, "fee": fee,
                        "profit": round(profit, 2), "title": title, "image": img,
                        "status": o.get("orderFulfillmentStatus", ""),
                        "buyer": o.get("buyer", {}).get("username", ""),
                    }
                    sales_timeline.append(sale)
                    total_revenue += order_total
                    total_fees += fee
                    total_profit += profit

                    if not top_sale or order_total > top_sale["total"]:
                        top_sale = sale

                    month_key = date_str[:7]
                    sales_by_month[month_key]["revenue"] += order_total
                    sales_by_month[month_key]["fees"] += fee
                    sales_by_month[month_key]["count"] += 1

                sales_timeline.sort(key=lambda x: x["date"])
        except Exception as e:
            logger.warning(f"Analytics orders fetch failed: {e}")

    cumulative_chart = []
    running_total = 0
    running_profit = 0
    for sale in sales_timeline:
        running_total += sale["total"]
        running_profit += sale["profit"]
        cumulative_chart.append({
            "date": sale["date"], "revenue": round(running_total, 2),
            "profit": round(running_profit, 2), "sale": sale["total"],
        })

    monthly_chart = []
    for month in sorted(sales_by_month.keys()):
        d = sales_by_month[month]
        monthly_chart.append({
            "month": month, "revenue": round(d["revenue"], 2),
            "fees": round(d["fees"], 2), "profit": round(d["revenue"] - d["fees"], 2),
            "count": d["count"],
        })

    inventory_items = await db.inventory.find({"user_id": user_id}, {"_id": 0}).to_list(500)
    inv_by_sport = defaultdict(lambda: {"count": 0, "value": 0})
    inv_by_player = defaultdict(lambda: {"count": 0, "value": 0})
    inv_by_category = defaultdict(lambda: {"count": 0, "value": 0})

    for item in inventory_items:
        price = float(item.get("purchase_price", 0) or 0)
        sport = item.get("sport") or detect_sport(item.get("card_name", ""))
        player = item.get("player") or "Unknown"
        category = item.get("category", "collection")
        inv_by_sport[sport]["count"] += 1
        inv_by_sport[sport]["value"] += price
        inv_by_player[player]["count"] += 1
        inv_by_player[player]["value"] += price
        inv_by_category[category]["count"] += 1
        inv_by_category[category]["value"] += price

    sport_chart = [{"name": k, "count": v["count"], "value": round(v["value"], 2)} for k, v in sorted(inv_by_sport.items(), key=lambda x: -x[1]["value"])]
    player_chart = [{"name": k, "count": v["count"], "value": round(v["value"], 2)} for k, v in sorted(inv_by_player.items(), key=lambda x: -x[1]["value"])][:10]
    category_chart = [{"name": k, "count": v["count"], "value": round(v["value"], 2)} for k, v in inv_by_category.items()]

    active_count = 0
    active_value = 0
    listings_ending_soon = []
    if token:
        try:
            import xml.etree.ElementTree as ET
            xml_body = f'''<?xml version="1.0" encoding="utf-8"?>
<GetMyeBaySellingRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials><eBayAuthToken>{token}</eBayAuthToken></RequesterCredentials>
  <ActiveList><Sort>TimeLeft</Sort><Pagination><EntriesPerPage>10</EntriesPerPage></Pagination></ActiveList>
</GetMyeBaySellingRequest>'''
            async with httpx.AsyncClient(timeout=15.0) as http_client:
                resp = await http_client.post(
                    "https://api.ebay.com/ws/api.dll",
                    headers={"X-EBAY-API-SITEID": "0", "X-EBAY-API-COMPATIBILITY-LEVEL": "967",
                             "X-EBAY-API-CALL-NAME": "GetMyeBaySelling", "X-EBAY-API-IAF-TOKEN": token,
                             "Content-Type": "text/xml"},
                    content=xml_body
                )
            ns = {"e": "urn:ebay:apis:eBLBaseComponents"}
            root = ET.fromstring(resp.text)
            active_node = root.find(".//e:ActiveList", ns)
            if active_node:
                count_el = active_node.find("e:PaginationResult/e:TotalNumberOfEntries", ns)
                active_count = int(count_el.text) if count_el is not None else 0
                for item_el in active_node.findall(".//e:Item", ns):
                    title_el = item_el.find("e:Title", ns)
                    price_el = item_el.find(".//e:CurrentPrice", ns)
                    p = float(price_el.text) if price_el is not None else 0
                    active_value += p
                    tl = item_el.find("e:TimeLeft", ns)
                    listings_ending_soon.append({
                        "title": title_el.text[:50] if title_el is not None else "",
                        "price": p,
                        "time_left": tl.text if tl is not None else "",
                    })
        except Exception as e:
            logger.warning(f"Analytics active listings failed: {e}")

    return {
        "sales": {
            "timeline": sales_timeline, "cumulative_chart": cumulative_chart,
            "monthly_chart": monthly_chart, "total_revenue": round(total_revenue, 2),
            "total_fees": round(total_fees, 2), "total_profit": round(total_profit, 2),
            "total_orders": len(sales_timeline), "top_sale": top_sale,
            "avg_sale": round(total_revenue / len(sales_timeline), 2) if sales_timeline else 0,
        },
        "inventory": {
            "by_sport": sport_chart, "by_player": player_chart,
            "by_category": category_chart, "total_items": len(inventory_items),
            "total_invested": round(sum(float(i.get("purchase_price", 0) or 0) for i in inventory_items), 2),
        },
        "listings": {
            "active_count": active_count, "active_value": round(active_value, 2),
            "ending_soon": listings_ending_soon[:5],
        },
    }


@router.get("/stats")
async def get_dashboard_stats(request: Request):
    """Get main dashboard KPI statistics"""
    try:
        user = await get_current_user(request)
        uq = {"user_id": user["user_id"]}
        total_cards = await db.card_analyses.count_documents(uq)

        high_grade_cards = await db.card_analyses.find(
            {**uq, "grading_result.overall_grade": {"$gte": 8}},
            {"_id": 0, "grading_result.overall_grade": 1, "card_name": 1}
        ).to_list(1000)

        total_listings = await db.ebay_listings.count_documents({**uq, "status": {"$ne": "deleted"}})
        new_listings = await db.ebay_listings.count_documents({**uq, "status": "new"})
        interested_listings = await db.ebay_listings.count_documents({**uq, "status": "interested"})
        watchlist_count = await db.watchlist_cards.count_documents(uq)
        not_listed = await db.card_analyses.count_documents({**uq, "status": "pending"})
        flip_opportunities = interested_listings + len(high_grade_cards)

        interested_or_new = await db.ebay_listings.find(
            {**uq, "status": {"$in": ["new", "interested"]}},
            {"_id": 0, "price_value": 1}
        ).to_list(1000)
        estimated_value = sum(l.get("price_value", 0) for l in interested_or_new)

        return {
            "total_cards": total_cards, "high_grade_cards": len(high_grade_cards),
            "total_listings": total_listings, "new_listings": new_listings,
            "interested_listings": interested_listings, "watchlist_count": watchlist_count,
            "not_listed": not_listed, "flip_opportunities": flip_opportunities,
            "estimated_value": round(estimated_value, 2)
        }
    except Exception as e:
        logger.error(f"Dashboard stats failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/recent")
async def get_dashboard_recent(request: Request):
    """Get recently scanned/analyzed cards"""
    try:
        user = await get_current_user(request)
        recent = await db.card_analyses.find(
            {"user_id": user["user_id"]},
            {"_id": 0, "front_image_preview": 1, "card_name": 1,
             "grading_result.overall_grade": 1, "created_at": 1, "id": 1, "status": 1}
        ).sort("created_at", -1).to_list(8)
        return recent
    except Exception as e:
        logger.error(f"Dashboard recent failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/opportunities")
async def get_dashboard_opportunities(request: Request):
    """Get flip opportunities"""
    try:
        user = await get_current_user(request)
        opportunities = await db.ebay_listings.find(
            {"user_id": user["user_id"], "status": {"$in": ["new", "interested"]}, "price_value": {"$gt": 0}},
            {"_id": 0}
        ).sort("found_at", -1).to_list(10)
        return opportunities
    except Exception as e:
        logger.error(f"Dashboard opportunities failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/movers")
async def get_dashboard_movers(request: Request):
    """Get market movers"""
    try:
        user = await get_current_user(request)
        watchlist = await db.watchlist_cards.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(20)

        movers = []
        for card in watchlist:
            listings = await db.ebay_listings.find(
                {"watchlist_card_id": card["id"], "status": {"$ne": "deleted"}},
                {"_id": 0, "price_value": 1, "found_at": 1, "title": 1, "image_url": 1}
            ).sort("found_at", -1).to_list(20)

            if len(listings) < 2:
                continue

            prices = [l["price_value"] for l in listings if l.get("price_value", 0) > 0]
            if not prices:
                continue

            avg_price = sum(prices) / len(prices)
            latest_price = prices[0]
            price_change = ((latest_price - avg_price) / avg_price * 100) if avg_price > 0 else 0

            movers.append({
                "search_query": card["search_query"],
                "latest_price": latest_price,
                "avg_price": round(avg_price, 2),
                "price_change_pct": round(price_change, 1),
                "listings_count": len(listings),
                "image_url": listings[0].get("image_url", ""),
                "title": listings[0].get("title", card["search_query"])
            })

        movers.sort(key=lambda x: abs(x["price_change_pct"]), reverse=True)
        return movers[:8]
    except Exception as e:
        logger.error(f"Dashboard movers failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/ebay-market")
async def get_ebay_market_data(query: str = "sports card PSA"):
    """Get live eBay market data using Browse API"""
    try:
        items = await ebay_browse_search(query, limit=6, sort="newlyListed")

        results = []
        for item in items:
            price_info = item.get("price", {})
            image_info = item.get("image", {})
            results.append({
                "title": item.get("title", ""),
                "price": price_info.get("value", "0"),
                "currency": price_info.get("currency", "USD"),
                "image_url": image_info.get("imageUrl", ""),
                "item_web_url": item.get("itemWebUrl", ""),
                "condition": item.get("condition", ""),
                "buying_options": item.get("buyingOptions", []),
            })

        return {"items": results, "total": len(results)}
    except Exception as e:
        logger.error(f"eBay market data failed: {e}")
        return {"items": [], "total": 0, "error": str(e)}


@router.get("/command-center")
async def get_command_center(request: Request):
    """Aggregated command center data for the dashboard"""
    user = await get_current_user(request)
    user_id = user["user_id"]
    now = datetime.now(timezone.utc)

    # 1. Active snipes
    active_snipes = await db.snipe_tasks.find(
        {"user_id": user_id, "status": {"$in": ["scheduled", "monitoring", "bidding"]}},
        {"_id": 0}
    ).sort("auction_end_time", 1).to_list(10)

    # 2. Snipe stats
    snipe_won = await db.snipe_tasks.count_documents({"user_id": user_id, "status": "won"})
    snipe_lost = await db.snipe_tasks.count_documents({"user_id": user_id, "status": {"$in": ["lost", "outbid"]}})
    snipe_active = len(active_snipes)
    snipe_total = await db.snipe_tasks.count_documents({"user_id": user_id})

    # 3. Recent monitor items (newest from ebay_listings)
    recent_monitor = await db.ebay_listings.find(
        {"user_id": user_id, "status": {"$ne": "deleted"}},
        {"_id": 0}
    ).sort("found_at", -1).to_list(8)

    # 4. Recent purchases/offers from purchase_log
    recent_actions = await db.purchase_log.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(10)

    # 5. Watchlist summary
    watchlist_count = await db.watchlist_cards.count_documents({"user_id": user_id})
    monitor_total = await db.ebay_listings.count_documents({"user_id": user_id, "status": {"$ne": "deleted"}})
    monitor_new = await db.ebay_listings.count_documents({"user_id": user_id, "status": "new"})

    # 6. Inventory quick count
    inv_count = await db.inventory.count_documents({"user_id": user_id})

    return {
        "snipes": {
            "active": active_snipes,
            "stats": {"active": snipe_active, "won": snipe_won, "lost": snipe_lost, "total": snipe_total}
        },
        "monitor": {
            "recent_items": recent_monitor,
            "total": monitor_total,
            "new_count": monitor_new,
            "watchlist_count": watchlist_count,
        },
        "recent_actions": recent_actions,
        "inventory_count": inv_count,
    }
