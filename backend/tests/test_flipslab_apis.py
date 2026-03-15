"""
Comprehensive API tests for FlipSlab Engine - Refactored Modular Backend
Tests all major API endpoints across the refactored router modules:
- Auth (register, login, me)
- Inventory CRUD + Stats
- Alerts CRUD
- Portfolio summary
- Settings
- Dashboard stats
- Market hot-cards & watchlist
- FlipFinder watchlist & listings
- eBay connection status
- Root API
- Multi-tenancy (user isolation)
"""
import pytest
import requests
import uuid
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    BASE_URL = "https://trader-dashboard-82.preview.emergentagent.com"


class TestRootAPI:
    """Root API endpoint tests"""
    
    def test_root_api_returns_status(self):
        """GET /api/ returns FlipSlab Engine status"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        assert "FlipSlab Engine" in data["status"]
        assert "modules" in data
        assert isinstance(data["modules"], list)
        assert len(data["modules"]) >= 5
        print(f"ROOT API: {data['status']}, modules: {data['modules']}")


class TestAuthEndpoints:
    """Auth module tests (routers/auth.py)"""
    
    @pytest.fixture(scope="class")
    def test_user(self):
        """Create a unique test user"""
        return {
            "email": f"test_{uuid.uuid4().hex[:8]}@example.com",
            "password": "Test123!",
            "name": "Test User"
        }
    
    def test_register_creates_user(self, test_user):
        """POST /api/auth/register creates new user with session cookie"""
        response = requests.post(f"{BASE_URL}/api/auth/register", json=test_user)
        assert response.status_code == 200
        data = response.json()
        assert "user_id" in data
        assert data["email"] == test_user["email"].lower()
        assert data["name"] == test_user["name"]
        assert "session_token" in response.cookies
        print(f"REGISTER: Created user {data['user_id']}")
    
    def test_login_returns_user_and_cookie(self, test_user):
        """POST /api/auth/login returns user info and sets session cookie"""
        # First register the user
        unique_user = {
            "email": f"login_test_{uuid.uuid4().hex[:8]}@example.com",
            "password": "Test123!",
            "name": "Login Test"
        }
        reg = requests.post(f"{BASE_URL}/api/auth/register", json=unique_user)
        assert reg.status_code == 200
        
        # Now login
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": unique_user["email"],
            "password": unique_user["password"]
        })
        assert response.status_code == 200
        data = response.json()
        assert "user_id" in data
        assert data["email"] == unique_user["email"].lower()
        assert "session_token" in response.cookies
        print(f"LOGIN: User {data['user_id']} logged in successfully")
    
    def test_login_invalid_credentials_returns_401(self):
        """POST /api/auth/login with invalid credentials returns 401"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "nonexistent@example.com",
            "password": "wrongpass"
        })
        assert response.status_code == 401
        print("LOGIN INVALID: Correctly returned 401")
    
    def test_auth_me_without_session_returns_401(self):
        """GET /api/auth/me without session returns 401"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 401
        print("AUTH ME NO SESSION: Correctly returned 401")
    
    def test_auth_me_with_session_returns_user(self):
        """GET /api/auth/me with valid session returns user info"""
        # Register new user
        user = {
            "email": f"me_test_{uuid.uuid4().hex[:8]}@example.com",
            "password": "Test123!",
            "name": "Me Test"
        }
        session = requests.Session()
        reg = session.post(f"{BASE_URL}/api/auth/register", json=user)
        assert reg.status_code == 200
        
        # Now check /me
        response = session.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 200
        data = response.json()
        assert "user_id" in data
        assert data["email"] == user["email"].lower()
        print(f"AUTH ME: User {data['user_id']} verified")


class TestInventoryEndpoints:
    """Inventory CRUD tests (routers/inventory.py)"""
    
    @pytest.fixture(scope="class")
    def auth_session(self):
        """Create authenticated session with new user"""
        session = requests.Session()
        user = {
            "email": f"inv_test_{uuid.uuid4().hex[:8]}@example.com",
            "password": "Test123!",
            "name": "Inventory Tester"
        }
        reg = session.post(f"{BASE_URL}/api/auth/register", json=user)
        assert reg.status_code == 200
        return session
    
    def test_get_inventory_empty_for_new_user(self, auth_session):
        """GET /api/inventory returns empty list for new user"""
        response = auth_session.get(f"{BASE_URL}/api/inventory")
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data
        print(f"INVENTORY GET: {data['total']} items for new user")
    
    def test_create_inventory_item(self, auth_session):
        """POST /api/inventory creates new card"""
        card = {
            "card_name": "TEST_2024 Topps Chrome Shohei Ohtani",
            "player": "Shohei Ohtani",
            "year": 2024,
            "set_name": "Topps Chrome",
            "condition": "Raw",
            "purchase_price": 25.00,
            "quantity": 1,
            "category": "collection"
        }
        response = auth_session.post(f"{BASE_URL}/api/inventory", json=card)
        assert response.status_code == 200
        data = response.json()
        assert data["card_name"] == card["card_name"]
        assert data["player"] == card["player"]
        assert "id" in data
        print(f"INVENTORY CREATE: Card {data['id']} created")
        return data["id"]
    
    def test_get_inventory_item(self, auth_session):
        """GET /api/inventory/{id} returns specific item"""
        # Create item first
        card = {
            "card_name": "TEST_Get Item Test Card",
            "player": "Test Player",
            "purchase_price": 10.00,
            "category": "collection"
        }
        create_res = auth_session.post(f"{BASE_URL}/api/inventory", json=card)
        item_id = create_res.json()["id"]
        
        # Get the item
        response = auth_session.get(f"{BASE_URL}/api/inventory/{item_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == item_id
        assert data["card_name"] == card["card_name"]
        print(f"INVENTORY GET BY ID: Item {item_id} retrieved")
    
    def test_update_inventory_item(self, auth_session):
        """PUT /api/inventory/{id} updates card"""
        # Create item first
        card = {
            "card_name": "TEST_Update Test Card",
            "player": "Original Player",
            "purchase_price": 15.00,
            "category": "collection"
        }
        create_res = auth_session.post(f"{BASE_URL}/api/inventory", json=card)
        item_id = create_res.json()["id"]
        
        # Update the item
        update = {"player": "Updated Player", "purchase_price": 20.00}
        response = auth_session.put(f"{BASE_URL}/api/inventory/{item_id}", json=update)
        assert response.status_code == 200
        data = response.json()
        assert data["player"] == "Updated Player"
        assert data["purchase_price"] == 20.00
        print(f"INVENTORY UPDATE: Item {item_id} updated")
    
    def test_delete_inventory_item(self, auth_session):
        """DELETE /api/inventory/{id} removes card"""
        # Create item first
        card = {
            "card_name": "TEST_Delete Test Card",
            "player": "Delete Me",
            "category": "collection"
        }
        create_res = auth_session.post(f"{BASE_URL}/api/inventory", json=card)
        item_id = create_res.json()["id"]
        
        # Delete the item
        response = auth_session.delete(f"{BASE_URL}/api/inventory/{item_id}")
        assert response.status_code == 200
        
        # Verify deletion
        get_res = auth_session.get(f"{BASE_URL}/api/inventory/{item_id}")
        assert get_res.status_code == 404
        print(f"INVENTORY DELETE: Item {item_id} deleted and verified")
    
    def test_inventory_stats(self, auth_session):
        """GET /api/inventory/stats returns statistics"""
        response = auth_session.get(f"{BASE_URL}/api/inventory/stats")
        assert response.status_code == 200
        data = response.json()
        assert "total_cards" in data
        assert "graded" in data
        assert "raw" in data
        assert "listed" in data
        assert "total_invested" in data
        print(f"INVENTORY STATS: {data['total_cards']} cards, ${data['total_invested']} invested")


class TestAlertsEndpoints:
    """Alerts CRUD tests (routers/alerts.py)"""
    
    @pytest.fixture(scope="class")
    def auth_session(self):
        session = requests.Session()
        user = {
            "email": f"alert_test_{uuid.uuid4().hex[:8]}@example.com",
            "password": "Test123!",
            "name": "Alert Tester"
        }
        reg = session.post(f"{BASE_URL}/api/auth/register", json=user)
        assert reg.status_code == 200
        return session
    
    def test_create_price_alert(self, auth_session):
        """POST /api/alerts creates new price alert"""
        alert = {
            "search_query": "TEST Kobe Bryant Rookie PSA 10",
            "player": "Kobe Bryant",
            "condition_type": "below",
            "target_price": 500.00,
            "notes": "Test alert"
        }
        response = auth_session.post(f"{BASE_URL}/api/alerts", json=alert)
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert data["search_query"] == alert["search_query"]
        assert data["target_price"] == alert["target_price"]
        print(f"ALERT CREATE: Alert {data['id']} created")
        return data["id"]
    
    def test_get_alerts(self, auth_session):
        """GET /api/alerts returns user's alerts"""
        response = auth_session.get(f"{BASE_URL}/api/alerts")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"ALERTS GET: {len(data)} alerts")
    
    def test_delete_alert(self, auth_session):
        """DELETE /api/alerts/{id} removes alert"""
        # Create alert first
        alert = {
            "search_query": "TEST Delete Alert",
            "condition_type": "below",
            "target_price": 100.00
        }
        create_res = auth_session.post(f"{BASE_URL}/api/alerts", json=alert)
        alert_id = create_res.json()["id"]
        
        # Delete
        response = auth_session.delete(f"{BASE_URL}/api/alerts/{alert_id}")
        assert response.status_code == 200
        print(f"ALERT DELETE: Alert {alert_id} deleted")


class TestPortfolioEndpoints:
    """Portfolio tests (routers/portfolio.py)"""
    
    @pytest.fixture(scope="class")
    def auth_session(self):
        session = requests.Session()
        user = {
            "email": f"portfolio_test_{uuid.uuid4().hex[:8]}@example.com",
            "password": "Test123!",
            "name": "Portfolio Tester"
        }
        reg = session.post(f"{BASE_URL}/api/auth/register", json=user)
        assert reg.status_code == 200
        return session
    
    def test_portfolio_summary(self, auth_session):
        """GET /api/portfolio/summary returns portfolio metrics"""
        response = auth_session.get(f"{BASE_URL}/api/portfolio/summary")
        assert response.status_code == 200
        data = response.json()
        assert "total_invested" in data
        assert "total_market_value" in data
        assert "pnl" in data
        assert "roi" in data
        assert "total_cards" in data
        print(f"PORTFOLIO SUMMARY: ${data['total_invested']} invested, ROI: {data['roi']}%")


class TestSettingsEndpoints:
    """Settings tests (routers/settings.py)"""
    
    @pytest.fixture(scope="class")
    def auth_session(self):
        session = requests.Session()
        user = {
            "email": f"settings_test_{uuid.uuid4().hex[:8]}@example.com",
            "password": "Test123!",
            "name": "Settings Tester"
        }
        reg = session.post(f"{BASE_URL}/api/auth/register", json=user)
        assert reg.status_code == 200
        return session
    
    def test_get_settings(self, auth_session):
        """GET /api/settings returns user settings"""
        response = auth_session.get(f"{BASE_URL}/api/settings")
        assert response.status_code == 200
        data = response.json()
        assert "user_id" in data
        assert "default_shipping" in data
        print(f"SETTINGS GET: user_id={data['user_id']}, shipping={data['default_shipping']}")
    
    def test_update_settings(self, auth_session):
        """PUT /api/settings updates user settings"""
        update = {
            "display_name": "Updated Display Name",
            "postal_code": "12345",
            "default_sport": "Baseball"
        }
        response = auth_session.put(f"{BASE_URL}/api/settings", json=update)
        assert response.status_code == 200
        data = response.json()
        assert data["display_name"] == update["display_name"]
        assert data["postal_code"] == update["postal_code"]
        assert data["default_sport"] == update["default_sport"]
        print(f"SETTINGS UPDATE: Updated to {data['display_name']}")


class TestDashboardEndpoints:
    """Dashboard tests (routers/dashboard.py)"""
    
    @pytest.fixture(scope="class")
    def auth_session(self):
        session = requests.Session()
        user = {
            "email": f"dashboard_test_{uuid.uuid4().hex[:8]}@example.com",
            "password": "Test123!",
            "name": "Dashboard Tester"
        }
        reg = session.post(f"{BASE_URL}/api/auth/register", json=user)
        assert reg.status_code == 200
        return session
    
    def test_dashboard_stats(self, auth_session):
        """GET /api/dashboard/stats returns KPI statistics"""
        response = auth_session.get(f"{BASE_URL}/api/dashboard/stats")
        assert response.status_code == 200
        data = response.json()
        assert "total_cards" in data
        assert "high_grade_cards" in data
        assert "flip_opportunities" in data
        print(f"DASHBOARD STATS: {data['total_cards']} cards, {data['flip_opportunities']} flip opportunities")


class TestMarketEndpoints:
    """Market tests (routers/market.py)"""
    
    @pytest.fixture(scope="class")
    def auth_session(self):
        session = requests.Session()
        user = {
            "email": f"market_test_{uuid.uuid4().hex[:8]}@example.com",
            "password": "Test123!",
            "name": "Market Tester"
        }
        reg = session.post(f"{BASE_URL}/api/auth/register", json=user)
        assert reg.status_code == 200
        return session
    
    def test_hot_cards(self, auth_session):
        """GET /api/market/hot-cards returns trending cards"""
        response = auth_session.get(f"{BASE_URL}/api/market/hot-cards")
        assert response.status_code == 200
        data = response.json()
        assert "trending" in data
        assert "user_sports" in data
        print(f"HOT CARDS: {len(data['trending'])} trending cards")
    
    def test_market_watchlist_get(self, auth_session):
        """GET /api/market/watchlist returns user's market watchlist"""
        response = auth_session.get(f"{BASE_URL}/api/market/watchlist")
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        print(f"MARKET WATCHLIST: {len(data['items'])} items")
    
    def test_market_watchlist_add(self, auth_session):
        """POST /api/market/watchlist adds to market watchlist"""
        response = auth_session.post(f"{BASE_URL}/api/market/watchlist", json={
            "name": "TEST LeBron James",
            "type": "player"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["status"] in ["added", "already_exists"]
        print(f"MARKET WATCHLIST ADD: status={data['status']}")
    
    def test_market_watchlist_delete(self, auth_session):
        """DELETE /api/market/watchlist/{name} removes from watchlist"""
        # Add first
        auth_session.post(f"{BASE_URL}/api/market/watchlist", json={
            "name": "TEST_DeletePlayer",
            "type": "player"
        })
        
        # Delete
        response = auth_session.delete(f"{BASE_URL}/api/market/watchlist/TEST_DeletePlayer")
        assert response.status_code == 200
        print("MARKET WATCHLIST DELETE: Removed")


class TestFlipFinderEndpoints:
    """FlipFinder tests (routers/flipfinder.py)"""
    
    @pytest.fixture(scope="class")
    def auth_session(self):
        session = requests.Session()
        user = {
            "email": f"flipfinder_test_{uuid.uuid4().hex[:8]}@example.com",
            "password": "Test123!",
            "name": "FlipFinder Tester"
        }
        reg = session.post(f"{BASE_URL}/api/auth/register", json=user)
        assert reg.status_code == 200
        return session
    
    def test_watchlist_add(self, auth_session):
        """POST /api/watchlist adds card to flipfinder watchlist"""
        response = auth_session.post(f"{BASE_URL}/api/watchlist", json={
            "search_query": "TEST Kobe Bryant Prizm Silver",
            "notes": "Looking for deals"
        })
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert data["search_query"] == "TEST Kobe Bryant Prizm Silver"
        print(f"FLIPFINDER WATCHLIST ADD: Card {data['id']} added")
        return data["id"]
    
    def test_watchlist_get(self, auth_session):
        """GET /api/watchlist returns flipfinder watchlist"""
        response = auth_session.get(f"{BASE_URL}/api/watchlist")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"FLIPFINDER WATCHLIST GET: {len(data)} cards")
    
    def test_watchlist_delete(self, auth_session):
        """DELETE /api/watchlist/{id} removes from flipfinder watchlist"""
        # Add first
        add_res = auth_session.post(f"{BASE_URL}/api/watchlist", json={
            "search_query": "TEST Delete Card",
            "notes": "To be deleted"
        })
        card_id = add_res.json()["id"]
        
        # Delete
        response = auth_session.delete(f"{BASE_URL}/api/watchlist/{card_id}")
        assert response.status_code == 200
        print(f"FLIPFINDER WATCHLIST DELETE: Card {card_id} deleted")
    
    def test_listings_get(self, auth_session):
        """GET /api/listings returns eBay listings"""
        response = auth_session.get(f"{BASE_URL}/api/listings")
        assert response.status_code == 200
        data = response.json()
        assert "listings" in data
        assert "total" in data
        print(f"FLIPFINDER LISTINGS: {data['total']} listings")
    
    def test_listings_stats(self, auth_session):
        """GET /api/listings/stats returns listing statistics"""
        response = auth_session.get(f"{BASE_URL}/api/listings/stats")
        assert response.status_code == 200
        data = response.json()
        assert "total" in data
        assert "new" in data
        assert "interested" in data
        print(f"LISTINGS STATS: {data['total']} total, {data['new']} new")


class TestEbayEndpoints:
    """eBay integration tests (routers/ebay.py)"""
    
    def test_ebay_oauth_status(self):
        """GET /api/ebay/oauth/status returns connection status"""
        response = requests.get(f"{BASE_URL}/api/ebay/oauth/status")
        assert response.status_code == 200
        data = response.json()
        assert "connected" in data
        print(f"EBAY OAUTH STATUS: connected={data['connected']}")
    
    def test_test_ebay_no_auth(self):
        """GET /api/test-ebay works without auth"""
        response = requests.get(f"{BASE_URL}/api/test-ebay")
        assert response.status_code == 200
        data = response.json()
        assert "browse_api" in data or "status" in data
        print(f"TEST EBAY: {data}")


class TestMultiTenancy:
    """Multi-tenancy / User isolation tests"""
    
    def test_user_data_isolation(self):
        """Users can only see their own data"""
        # Create User A
        session_a = requests.Session()
        user_a = {
            "email": f"user_a_{uuid.uuid4().hex[:8]}@example.com",
            "password": "Test123!",
            "name": "User A"
        }
        reg_a = session_a.post(f"{BASE_URL}/api/auth/register", json=user_a)
        assert reg_a.status_code == 200
        user_a_id = reg_a.json()["user_id"]
        
        # User A creates inventory item
        card_a = {
            "card_name": "TEST_UserA_Exclusive_Card",
            "player": "User A Player",
            "purchase_price": 100.00,
            "category": "collection"
        }
        create_a = session_a.post(f"{BASE_URL}/api/inventory", json=card_a)
        assert create_a.status_code == 200
        card_a_id = create_a.json()["id"]
        
        # Create User B
        session_b = requests.Session()
        user_b = {
            "email": f"user_b_{uuid.uuid4().hex[:8]}@example.com",
            "password": "Test456!",
            "name": "User B"
        }
        reg_b = session_b.post(f"{BASE_URL}/api/auth/register", json=user_b)
        assert reg_b.status_code == 200
        user_b_id = reg_b.json()["user_id"]
        
        # User B should NOT see User A's card
        inv_b = session_b.get(f"{BASE_URL}/api/inventory")
        assert inv_b.status_code == 200
        items_b = inv_b.json()["items"]
        card_names_b = [item["card_name"] for item in items_b]
        assert "TEST_UserA_Exclusive_Card" not in card_names_b, "User B should NOT see User A's card!"
        
        # User A should see their card
        inv_a = session_a.get(f"{BASE_URL}/api/inventory")
        assert inv_a.status_code == 200
        items_a = inv_a.json()["items"]
        card_names_a = [item["card_name"] for item in items_a]
        assert "TEST_UserA_Exclusive_Card" in card_names_a, "User A should see their own card!"
        
        print(f"MULTI-TENANCY: User A ({user_a_id}) has {len(items_a)} items, User B ({user_b_id}) has {len(items_b)} items - ISOLATED!")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
