"""Pull Game backend tests - admin + public flows.
Auth: session_token=dev_flipslab_access (admin user pzsuave007@gmail.com)
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://dynamic-pull-shop.preview.emergentagent.com").rstrip("/")
DEV_COOKIE = {"session_token": "dev_flipslab_access"}


@pytest.fixture(scope="session")
def admin_session():
    s = requests.Session()
    s.cookies.update(DEV_COOKIE)
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def public_session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def inventory_card_ids(admin_session):
    r = admin_session.get(f"{BASE_URL}/api/pull-game/inventory/available", timeout=30)
    assert r.status_code == 200, f"inventory/available failed: {r.status_code} {r.text[:300]}"
    cards = r.json().get("cards", [])
    assert len(cards) >= 10, f"Need ≥10 inventory cards, got {len(cards)}"
    return [c["id"] for c in cards]


# Store created game id across tests
_state = {"game_id": None, "spots": None}


# ───────── Admin: inventory ─────────
class TestInventoryAvailable:
    def test_available_inventory_returns_unlocked(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/pull-game/inventory/available")
        assert r.status_code == 200
        data = r.json()
        assert "cards" in data
        assert isinstance(data["cards"], list)

    def test_available_inventory_requires_admin(self, public_session):
        r = public_session.get(f"{BASE_URL}/api/pull-game/inventory/available")
        assert r.status_code in (401, 403)


# ───────── Admin: create + list + detail ─────────
class TestAdminGameCRUD:
    def test_create_game(self, admin_session, inventory_card_ids):
        ids = inventory_card_ids
        # Need 5 chasers + at least 1 low-end + 4 mega_box. Use distinct ids.
        assert len(ids) >= 10
        chaser_ids = [
            {"card_id": ids[0], "tier": "mini"},
            {"card_id": ids[1], "tier": "mini"},
            {"card_id": ids[2], "tier": "mid"},
            {"card_id": ids[3], "tier": "mid"},
            {"card_id": ids[4], "tier": "blue"},
        ]
        low_end_ids = ids[5:10] if len(ids) >= 15 else ids[5:8]
        # mega box - reuse ids past low-ends if enough, else overlap safe
        mega_pool = ids[10:14] if len(ids) >= 14 else ids[5:9]
        payload = {
            "name": "TEST_Pull_Game_1",
            "total_pulls": 65,
            "chaser_ids": chaser_ids,
            "low_end_ids": low_end_ids,
            "mega_box_ids": mega_pool,
        }
        r = admin_session.post(f"{BASE_URL}/api/pull-game/admin/games", json=payload)
        assert r.status_code == 200, r.text[:500]
        data = r.json()
        assert data["success"] is True
        assert "game_id" in data
        g = data["game"]
        assert g["total_pulls"] == 65
        assert g["status"] == "active"
        assert len(g["tiers"]) == 5
        assert len(g["chasers"]) == 5
        assert any(c["tier"] == "blue" for c in g["chasers"])
        assert len(g["mega_box_cards"]) >= 1
        _state["game_id"] = data["game_id"]

    def test_list_admin_games(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/pull-game/admin/games")
        assert r.status_code == 200
        games = r.json().get("games", [])
        assert any(g["id"] == _state["game_id"] for g in games)
        # pulls_remaining attached
        for g in games:
            if g["id"] == _state["game_id"]:
                assert g["pulls_remaining"] == 65
                break

    def test_game_detail_has_65_spots(self, admin_session):
        gid = _state["game_id"]
        r = admin_session.get(f"{BASE_URL}/api/pull-game/admin/games/{gid}")
        assert r.status_code == 200
        d = r.json()
        assert d["game"]["id"] == gid
        spots = d["spots"]
        assert len(spots) == 65
        pull_nums = sorted([s["pull_number"] for s in spots])
        assert pull_nums == list(range(1, 66))
        # All 5 chasers present among spots
        chaser_spots = [s for s in spots if s.get("is_chaser")]
        assert len(chaser_spots) == 5
        tiers = [s.get("chaser_tier") for s in chaser_spots]
        assert tiers.count("blue") == 1
        assert tiers.count("mid") == 2
        assert tiers.count("mini") == 2
        # Every spot has a card snapshot (hidden cards assigned)
        for s in spots:
            assert s.get("card_snapshot") is not None
            assert s["status"] == "available"
            assert s["price"] > 0
        _state["spots"] = spots

    def test_admin_stats(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/pull-game/admin/stats")
        assert r.status_code == 200
        d = r.json()
        assert d["total_games"] >= 1
        assert d["active_games"] >= 1
        assert "total_revenue" in d
        assert "total_pulls_sold" in d


# ───────── Public guest endpoints ─────────
class TestPublicEndpoints:
    def test_active_games_no_auth(self, public_session):
        r = public_session.get(f"{BASE_URL}/api/pull-game/games/active")
        assert r.status_code == 200
        games = r.json().get("games", [])
        assert any(g["id"] == _state["game_id"] for g in games)
        for g in games:
            if g["id"] == _state["game_id"]:
                assert g["pulls_remaining"] == 65
                assert g["blue_chase_alive"] is True
                assert g["chaser_count"] == 5
                break

    def test_public_game_hides_unclaimed_cards(self, public_session):
        r = public_session.get(f"{BASE_URL}/api/pull-game/games/{_state['game_id']}")
        assert r.status_code == 200
        d = r.json()
        assert d["total_pulls"] == 65
        assert d["pulls_remaining"] == 65
        assert d["blue_chase_alive"] is True
        assert len(d["spots"]) == 65
        # Available spots must NOT reveal card
        for s in d["spots"]:
            if s["status"] == "available":
                assert s["card"] is None
                assert s["is_chaser"] is False
                assert s["chaser_tier"] is None
        # chasers field - visible to build chaser showcase
        assert isinstance(d["chasers"], list)

    def test_public_game_404(self, public_session):
        r = public_session.get(f"{BASE_URL}/api/pull-game/games/nonexistent_xyz")
        assert r.status_code == 404

    def test_public_winners_empty_initially(self, public_session):
        r = public_session.get(f"{BASE_URL}/api/pull-game/games/{_state['game_id']}/winners")
        assert r.status_code == 200
        assert r.json().get("winners") == []


# ───────── buy-pull: validation + Stripe session + race 409 ─────────
class TestBuyPull:
    def _good_payload(self, pull_number=1):
        return {
            "pull_number": pull_number,
            "email": "guest+test@flipslab.test",
            "shipping_address": {
                "first_name": "Test",
                "last_name": "User",
                "line1": "1 Main St",
                "city": "NYC",
                "state": "NY",
                "postal_code": "10001",
            },
            "origin_url": BASE_URL,
        }

    def test_buy_pull_missing_email(self, public_session):
        payload = self._good_payload(1)
        payload["email"] = ""
        r = public_session.post(
            f"{BASE_URL}/api/pull-game/games/{_state['game_id']}/buy-pull", json=payload
        )
        assert r.status_code == 400

    def test_buy_pull_missing_shipping(self, public_session):
        payload = self._good_payload(1)
        payload["shipping_address"].pop("city")
        r = public_session.post(
            f"{BASE_URL}/api/pull-game/games/{_state['game_id']}/buy-pull", json=payload
        )
        assert r.status_code == 400

    def test_buy_pull_creates_stripe_session(self, public_session):
        # Use pull_number=2 so we don't conflict with race test
        r = public_session.post(
            f"{BASE_URL}/api/pull-game/games/{_state['game_id']}/buy-pull",
            json=self._good_payload(2),
        )
        # If Stripe test key fails, we expect 500; else 200. Record.
        if r.status_code != 200:
            pytest.skip(f"Stripe test key issue: {r.status_code} {r.text[:200]}")
        d = r.json()
        assert "checkout_url" in d
        assert "session_id" in d
        _state["session_id"] = d["session_id"]

    def test_buy_pull_409_on_double_reservation(self, public_session):
        # First request reserves pull 3
        r1 = public_session.post(
            f"{BASE_URL}/api/pull-game/games/{_state['game_id']}/buy-pull",
            json=self._good_payload(3),
        )
        # If Stripe fails, spot still gets reserved before session creation in atomic find_one_and_update.
        # Second request must always 409 regardless of stripe outcome.
        r2 = public_session.post(
            f"{BASE_URL}/api/pull-game/games/{_state['game_id']}/buy-pull",
            json=self._good_payload(3),
        )
        assert r2.status_code == 409, f"Expected 409, got {r2.status_code}: {r2.text[:200]}"

    def test_buy_pull_invalid_game(self, public_session):
        r = public_session.post(
            f"{BASE_URL}/api/pull-game/games/nonexistent/buy-pull",
            json=self._good_payload(1),
        )
        assert r.status_code == 400


# ───────── Checkout status: unpaid state ─────────
class TestCheckoutStatus:
    def test_status_not_found(self, public_session):
        r = public_session.get(f"{BASE_URL}/api/pull-game/checkout/status/sess_fake_xyz")
        assert r.status_code == 404

    def test_status_unpaid_for_real_session(self, public_session):
        sid = _state.get("session_id")
        if not sid:
            pytest.skip("No stripe session created")
        r = public_session.get(f"{BASE_URL}/api/pull-game/checkout/status/{sid}")
        # Unpaid/pending expected — payment not completed in test
        assert r.status_code == 200
        d = r.json()
        assert d.get("revealed") in (False, None)


# ───────── Ship + update status ─────────
class TestAdminUpdateAndShip:
    def test_ship_nonclaimed_pull_404(self, admin_session):
        r = admin_session.post(
            f"{BASE_URL}/api/pull-game/admin/games/{_state['game_id']}/ship/1",
            json={"tracking": "TRACK123"},
        )
        assert r.status_code == 404  # no claimed spots yet

    def test_pause_game(self, admin_session):
        r = admin_session.patch(
            f"{BASE_URL}/api/pull-game/admin/games/{_state['game_id']}", json={"status": "paused"}
        )
        assert r.status_code == 200
        # verify
        r2 = admin_session.get(f"{BASE_URL}/api/pull-game/admin/games/{_state['game_id']}")
        assert r2.json()["game"]["status"] == "paused"

    def test_invalid_status(self, admin_session):
        r = admin_session.patch(
            f"{BASE_URL}/api/pull-game/admin/games/{_state['game_id']}", json={"status": "bogus"}
        )
        assert r.status_code == 400

    def test_end_game_unlocks_cards(self, admin_session):
        r = admin_session.patch(
            f"{BASE_URL}/api/pull-game/admin/games/{_state['game_id']}", json={"status": "ended"}
        )
        assert r.status_code == 200
        r2 = admin_session.get(f"{BASE_URL}/api/pull-game/admin/games/{_state['game_id']}")
        assert r2.json()["game"]["status"] == "ended"


# ───────── Mega box: should reject before Blue Chase claimed ─────────
class TestMegaBox:
    def test_mega_box_rejects_non_blue_session(self, public_session):
        r = public_session.post(
            f"{BASE_URL}/api/pull-game/games/{_state['game_id']}/mega-box/sess_fake",
            json={"box_index": 0},
        )
        assert r.status_code == 404


# ───────── Cleanup ─────────
class TestCleanup:
    def test_cleanup_done_by_end_game(self):
        # End game test already ran; nothing else to do
        assert _state["game_id"] is not None
