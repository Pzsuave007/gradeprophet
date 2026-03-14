from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime, timezone
import uuid
import logging
from database import db
from utils.auth import get_current_user
from utils.market import get_card_market_value

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/alerts", tags=["alerts"])


class PriceAlertCreate(BaseModel):
    search_query: str
    player: Optional[str] = None
    condition_type: str = "below"
    target_price: float
    notes: Optional[str] = None


class PriceAlertResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    search_query: str
    player: Optional[str] = None
    condition_type: str
    target_price: float
    notes: Optional[str] = None
    active: bool = True
    triggered: bool = False
    last_checked: Optional[str] = None
    last_price: Optional[float] = None
    created_at: str


@router.post("")
async def create_price_alert(data: PriceAlertCreate, request: Request):
    """Create a new price alert"""
    user = await get_current_user(request)
    alert = {
        "id": str(uuid.uuid4()),
        "user_id": user["user_id"],
        "search_query": data.search_query,
        "player": data.player,
        "condition_type": data.condition_type,
        "target_price": data.target_price,
        "notes": data.notes,
        "active": True,
        "triggered": False,
        "last_checked": None,
        "last_price": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.price_alerts.insert_one(alert)
    alert.pop("_id", None)
    return alert


@router.get("")
async def get_price_alerts(request: Request):
    """Get all price alerts"""
    user = await get_current_user(request)
    alerts = await db.price_alerts.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return alerts


@router.delete("/{alert_id}")
async def delete_price_alert(alert_id: str, request: Request):
    """Delete a price alert"""
    user = await get_current_user(request)
    result = await db.price_alerts.delete_one({"id": alert_id, "user_id": user["user_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Alert not found")
    return {"success": True}


@router.post("/check")
async def check_all_alerts(request: Request):
    """Check all active price alerts against current market prices"""
    user = await get_current_user(request)
    alerts = await db.price_alerts.find({"active": True, "user_id": user["user_id"]}, {"_id": 0}).to_list(100)
    results = []
    now = datetime.now(timezone.utc).isoformat()

    for alert in alerts:
        try:
            value_data = await get_card_market_value(alert["search_query"])
            median = value_data.get("primary", {}).get("stats", {}).get("median", 0)

            triggered = False
            if median > 0:
                if alert["condition_type"] == "below" and median <= alert["target_price"]:
                    triggered = True
                elif alert["condition_type"] == "above" and median >= alert["target_price"]:
                    triggered = True

            await db.price_alerts.update_one(
                {"id": alert["id"]},
                {"$set": {"last_checked": now, "last_price": median, "triggered": triggered}}
            )

            results.append({
                "id": alert["id"],
                "search_query": alert["search_query"],
                "target_price": alert["target_price"],
                "condition_type": alert["condition_type"],
                "current_price": median,
                "triggered": triggered,
            })
        except Exception as e:
            logger.error(f"Alert check failed for {alert['id']}: {e}")
            results.append({"id": alert["id"], "error": str(e)})

    return {"checked": len(results), "results": results}
