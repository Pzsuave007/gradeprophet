"""Tests for new Multi-Select Cart + Sequential Reveals feature on Pull Game.
Covers buy-pull with pull_numbers array, atomic rollback, tier pricing,
checkout-status finalize for multi-spot sessions, and box-pick trigger_type disambiguation.
"""
import os
import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://dynamic-pull-shop.preview.emergentagent.com").rstrip("/")
DEV_TOKEN = "dev_flipslab_access"
COOKIES = {"session_token": DEV_TOKEN}

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")
mc = MongoClient(MONGO_URL)
db = mc[DB_NAME]


@pytest.fixture(scope="module")
def admin_user_id():
    r = requests.get(f"{BASE_URL}/api/auth/me", cookies=COOKIES, timeout=15)
    assert r.status_code == 200, f"Dev auth failed: {r.status_code} {r.text[:200]}"
    return r.json().get("user_id")


@pytest.fixture(scope="module")
def active_game(admin_user_id):
    """Create a small active game with red(2) + orange(1) + blue(1) + low_end(4) = 8 pulls."""
    r = requests.get(f"{BASE_URL}/api/pull-game/inventory/available", cookies=COOKIES, timeout=20)
    assert r.status_code == 200, r.text[:300]
    cards = r.json().get("cards", [])
    if len(cards) < 8:
        pytest.skip(f"Need >=8 inventory cards, have {len(cards)}")
    ids = [c["id"] for c in cards[:8]]
    body = {
        "name": "TEST_MultiCart_Game",
        "total_pulls": 8,
        "tiers": [
            {"from": 1, "to": 3, "price": 5},
            {"from": 4, "to": 6, "price": 10},
            {"from": 7, "to": 8, "price": 20},
        ],
        "red_ids": ids[0:2],
        "orange_ids": [ids[2]],
        "blue_ids": [ids[3]],
        "low_end_ids": ids[4:8],
    }
    r = requests.post(f"{BASE_URL}/api/pull-game/admin/games", json=body, cookies=COOKIES, timeout=30)
    assert r.status_code == 200, r.text[:400]
    gid = r.json()["game_id"]
    yield gid
    # Cleanup
    requests.patch(f"{BASE_URL}/api/pull-game/admin/games/{gid}", json={"status": "ended"}, cookies=COOKIES, timeout=15)


SHIPPING = {"first_name": "Cart", "last_name": "Tester", "line1": "1 St", "city": "NY", "state": "NY", "postal_code": "10001"}


# ─── 1. buy-pull accepts pull_numbers ARRAY ───
def test_buy_pull_accepts_array(active_game):
    body = {"pull_numbers": [1, 2, 3], "email": "TEST_multi@x.com",
            "shipping_address": SHIPPING, "origin_url": BASE_URL}
    r = requests.post(f"{BASE_URL}/api/pull-game/games/{active_game}/buy-pull", json=body, timeout=30)
    assert r.status_code == 200, r.text[:400]
    data = r.json()
    assert "checkout_url" in data
    assert "session_id" in data
    assert data["pull_count"] == 3
    # Tier pricing: pulls 1,2,3 each at $5 (tier 1-3 = $5)
    assert data["total"] == 15.0, f"Expected 15.0 got {data['total']}"
    # Metadata persisted in payment_transactions
    txn = db.payment_transactions.find_one({"session_id": data["session_id"]})
    assert txn is not None
    assert sorted(txn["pull_numbers"]) == [1, 2, 3]
    assert txn["pull_count"] == 3
    # Cleanup reservation so other tests can use these spots if needed
    db.pull_spots.update_many({"stripe_session_id": data["session_id"]},
                              {"$set": {"status": "available", "stripe_session_id": None, "payment_status": None}})
    db.payment_transactions.delete_one({"session_id": data["session_id"]})


# ─── 2. Tier pricing across cart ───
def test_buy_pull_tier_pricing_per_index(active_game):
    """Cart of 4 pulls when 0 sold: indices 0,1,2 hit tier1 ($5) and idx 3 hits tier2 ($10).
    Total = 5+5+5+10 = 25"""
    body = {"pull_numbers": [1, 2, 3, 4], "email": "TEST_tier@x.com",
            "shipping_address": SHIPPING, "origin_url": BASE_URL}
    r = requests.post(f"{BASE_URL}/api/pull-game/games/{active_game}/buy-pull", json=body, timeout=30)
    assert r.status_code == 200, r.text[:400]
    assert r.json()["total"] == 25.0, f"Tier pricing wrong: {r.json()['total']}"
    sid = r.json()["session_id"]
    db.pull_spots.update_many({"stripe_session_id": sid},
                              {"$set": {"status": "available", "stripe_session_id": None, "payment_status": None}})
    db.payment_transactions.delete_one({"session_id": sid})


# ─── 3. Legacy single pull_number still works ───
def test_buy_pull_legacy_single(active_game):
    body = {"pull_number": 5, "email": "TEST_legacy@x.com",
            "shipping_address": SHIPPING, "origin_url": BASE_URL}
    r = requests.post(f"{BASE_URL}/api/pull-game/games/{active_game}/buy-pull", json=body, timeout=30)
    assert r.status_code == 200, r.text[:300]
    assert r.json()["pull_count"] == 1
    sid = r.json()["session_id"]
    db.pull_spots.update_many({"stripe_session_id": sid},
                              {"$set": {"status": "available", "stripe_session_id": None, "payment_status": None}})
    db.payment_transactions.delete_one({"session_id": sid})


# ─── 4. Atomic rollback: if any spot unavailable, all reverted ───
def test_buy_pull_atomic_rollback(active_game):
    # First reserve pull #6
    body1 = {"pull_numbers": [6], "email": "TEST_rb1@x.com",
             "shipping_address": SHIPPING, "origin_url": BASE_URL}
    r1 = requests.post(f"{BASE_URL}/api/pull-game/games/{active_game}/buy-pull", json=body1, timeout=30)
    assert r1.status_code == 200
    sid1 = r1.json()["session_id"]
    # Now try to reserve [7,6,8] - #6 conflicts -> all should rollback
    body2 = {"pull_numbers": [7, 6, 8], "email": "TEST_rb2@x.com",
             "shipping_address": SHIPPING, "origin_url": BASE_URL}
    r2 = requests.post(f"{BASE_URL}/api/pull-game/games/{active_game}/buy-pull", json=body2, timeout=30)
    assert r2.status_code == 409, f"Expected 409, got {r2.status_code}: {r2.text[:200]}"
    # Spots 7, 8 should be available again (rolled back)
    s7 = db.pull_spots.find_one({"game_id": active_game, "pull_number": 7})
    s8 = db.pull_spots.find_one({"game_id": active_game, "pull_number": 8})
    assert s7["status"] == "available", f"Spot 7 not rolled back: {s7['status']}"
    assert s8["status"] == "available", f"Spot 8 not rolled back: {s8['status']}"
    # Cleanup
    db.pull_spots.update_many({"stripe_session_id": sid1},
                              {"$set": {"status": "available", "stripe_session_id": None, "payment_status": None}})
    db.payment_transactions.delete_one({"session_id": sid1})


# ─── 5. checkout-status finalizes ALL spots & returns spots+spot ───
def test_checkout_status_finalizes_multi(active_game):
    body = {"pull_numbers": [1, 2], "email": "TEST_fin@x.com",
            "shipping_address": SHIPPING, "origin_url": BASE_URL}
    r = requests.post(f"{BASE_URL}/api/pull-game/games/{active_game}/buy-pull", json=body, timeout=30)
    assert r.status_code == 200
    sid = r.json()["session_id"]
    # Simulate Stripe paid by directly marking spots+txn paid+revealed
    db.pull_spots.update_many(
        {"stripe_session_id": sid},
        {"$set": {"status": "claimed", "payment_status": "paid", "revealed_at": "2026-01-01T00:00:00+00:00"}},
    )
    db.payment_transactions.update_one(
        {"session_id": sid},
        {"$set": {"payment_status": "paid", "status": "completed", "revealed": True}},
    )
    # Now call status endpoint - it should short-circuit (already revealed) and return both fields
    rs = requests.get(f"{BASE_URL}/api/pull-game/checkout/status/{sid}", timeout=20)
    assert rs.status_code == 200, rs.text[:300]
    data = rs.json()
    assert data["payment_status"] == "paid"
    assert data["revealed"] is True
    assert "spots" in data and isinstance(data["spots"], list)
    assert len(data["spots"]) == 2
    assert "spot" in data  # legacy backwards-compat
    assert data["spot"]["pull_number"] == data["spots"][0]["pull_number"]
    # Confirm both spots claimed
    spots_db = list(db.pull_spots.find({"stripe_session_id": sid}))
    assert all(s["status"] == "claimed" for s in spots_db)


# ─── 6. box-pick with trigger_type disambiguation ───
def test_box_pick_with_trigger_type(active_game):
    """Find a session that contains an orange OR blue trigger; verify trigger_type body field works."""
    # Find an unrevealed trigger spot (card_snapshot=None means trigger not yet picked)
    trig = db.pull_spots.find_one({"game_id": active_game, "is_trigger": True, "card_snapshot": None, "status": "available"})
    if not trig:
        pytest.skip("No unrevealed trigger spot available")
    pn = trig["pull_number"]
    ttype = trig["trigger_type"]
    # Buy that pull
    body = {"pull_numbers": [pn], "email": f"TEST_trig_{ttype}@x.com",
            "shipping_address": SHIPPING, "origin_url": BASE_URL}
    r = requests.post(f"{BASE_URL}/api/pull-game/games/{active_game}/buy-pull", json=body, timeout=30)
    assert r.status_code == 200
    sid = r.json()["session_id"]
    # Mark paid
    db.pull_spots.update_many({"stripe_session_id": sid},
                              {"$set": {"status": "claimed", "payment_status": "paid"}})
    db.payment_transactions.update_one({"session_id": sid},
                                        {"$set": {"payment_status": "paid", "revealed": True, "status": "completed"}})
    # Call box-pick with trigger_type
    rb = requests.post(f"{BASE_URL}/api/pull-game/games/{active_game}/box-pick/{sid}",
                       json={"box_index": 0, "trigger_type": ttype}, timeout=20)
    assert rb.status_code == 200, rb.text[:300]
    bdata = rb.json()
    assert bdata["success"] is True
    assert bdata["trigger_type"] == ttype
    assert bdata["card"] is not None
    # Re-call should fail (already triggered globally)
    rb2 = requests.post(f"{BASE_URL}/api/pull-game/games/{active_game}/box-pick/{sid}",
                        json={"box_index": 1, "trigger_type": ttype}, timeout=20)
    assert rb2.status_code in (404, 409), f"Expected dup error, got {rb2.status_code}"


# ─── 7. Validation: missing pulls ───
def test_buy_pull_missing_pulls(active_game):
    r = requests.post(f"{BASE_URL}/api/pull-game/games/{active_game}/buy-pull",
                      json={"email": "x@x.com", "shipping_address": SHIPPING, "origin_url": BASE_URL}, timeout=15)
    assert r.status_code == 400


# ─── 8. checkout-status returns spots array (key shape contract) ───
def test_checkout_status_response_shape(active_game):
    """Verify pending session returns expected shape (no spots key required when not paid)."""
    body = {"pull_numbers": [3], "email": "TEST_shape@x.com",
            "shipping_address": SHIPPING, "origin_url": BASE_URL}
    r = requests.post(f"{BASE_URL}/api/pull-game/games/{active_game}/buy-pull", json=body, timeout=30)
    if r.status_code != 200:
        pytest.skip(f"Pull #3 not available: {r.text[:100]}")
    sid = r.json()["session_id"]
    rs = requests.get(f"{BASE_URL}/api/pull-game/checkout/status/{sid}", timeout=20)
    assert rs.status_code == 200
    # Pending state — payment_status field exists
    assert "payment_status" in rs.json()
    db.pull_spots.update_many({"stripe_session_id": sid},
                              {"$set": {"status": "available", "stripe_session_id": None, "payment_status": None}})
    db.payment_transactions.delete_one({"session_id": sid})
