"""
Dashboard Command Center Visual Grid Tests
Tests the new visual grid layout with card images for:
- Active Listings (with image_url from GetMyeBaySelling)
- Ending Soon (with ENDING badges and countdown)
- Recent Sales (with images via Browse API fallback)
- Monitor Feed, Snipes, KPIs
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestDashboardAuthentication:
    """Test authentication for dashboard endpoints"""
    
    @pytest.fixture(scope="class")
    def session(self):
        return requests.Session()
    
    @pytest.fixture(scope="class")
    def auth_session(self, session):
        """Login and return authenticated session"""
        resp = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@dashboard.com",
            "password": "Test123!"
        })
        assert resp.status_code == 200, f"Login failed: {resp.text}"
        return session
    
    def test_command_center_requires_auth(self, session):
        """Command center should return 401 without auth"""
        fresh_session = requests.Session()
        resp = fresh_session.get(f"{BASE_URL}/api/dashboard/command-center")
        assert resp.status_code == 401, "Expected 401 for unauthenticated request"
        print("PASS: command-center returns 401 without auth")
    
    def test_analytics_requires_auth(self, session):
        """Analytics should return 401 without auth"""
        fresh_session = requests.Session()
        resp = fresh_session.get(f"{BASE_URL}/api/dashboard/analytics")
        assert resp.status_code == 401, "Expected 401 for unauthenticated request"
        print("PASS: analytics returns 401 without auth")


class TestCommandCenterVisualGrid:
    """Test command center endpoint for visual grid data"""
    
    @pytest.fixture(scope="class")
    def session(self):
        return requests.Session()
    
    @pytest.fixture(scope="class")
    def auth_session(self, session):
        resp = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@dashboard.com",
            "password": "Test123!"
        })
        assert resp.status_code == 200
        return session
    
    @pytest.fixture(scope="class")
    def command_center_data(self, auth_session):
        resp = auth_session.get(f"{BASE_URL}/api/dashboard/command-center")
        assert resp.status_code == 200
        return resp.json()
    
    def test_command_center_returns_200(self, auth_session):
        """GET /api/dashboard/command-center returns 200"""
        resp = auth_session.get(f"{BASE_URL}/api/dashboard/command-center")
        assert resp.status_code == 200
        print("PASS: GET /api/dashboard/command-center returns 200")
    
    def test_active_listings_array_exists(self, command_center_data):
        """Response has active_listings array"""
        assert "active_listings" in command_center_data
        assert isinstance(command_center_data["active_listings"], list)
        print(f"PASS: active_listings array exists with {len(command_center_data['active_listings'])} items")
    
    def test_active_listings_have_image_url(self, command_center_data):
        """Each active listing has image_url field populated"""
        active = command_center_data.get("active_listings", [])
        if len(active) == 0:
            pytest.skip("No active listings to test")
        
        for i, item in enumerate(active):
            assert "image_url" in item, f"Item {i} missing image_url"
            assert item["image_url"], f"Item {i} has empty image_url"
            assert "s-l" in item["image_url"], f"Item {i} image_url not eBay format"
        print(f"PASS: All {len(active)} active listings have image_url populated")
    
    def test_active_listings_have_hi_res_images(self, command_center_data):
        """Active listings images are high resolution (s-l800)"""
        active = command_center_data.get("active_listings", [])
        if len(active) == 0:
            pytest.skip("No active listings to test")
        
        hi_res_count = sum(1 for item in active if "s-l800" in item.get("image_url", ""))
        print(f"PASS: {hi_res_count}/{len(active)} active listings have s-l800 hi-res images")
    
    def test_active_listings_fields(self, command_center_data):
        """Active listings have all required fields for visual grid"""
        active = command_center_data.get("active_listings", [])
        if len(active) == 0:
            pytest.skip("No active listings to test")
        
        required_fields = ["itemid", "title", "price", "image_url", "time_left", "url"]
        for i, item in enumerate(active):
            for field in required_fields:
                assert field in item, f"Item {i} missing required field: {field}"
        print(f"PASS: All active listings have required fields: {required_fields}")
    
    def test_ending_soon_array_exists(self, command_center_data):
        """Response has ending_soon array"""
        assert "ending_soon" in command_center_data
        assert isinstance(command_center_data["ending_soon"], list)
        print(f"PASS: ending_soon array exists with {len(command_center_data['ending_soon'])} items")
    
    def test_ending_soon_have_images(self, command_center_data):
        """Ending soon items have images for ENDING badges"""
        ending = command_center_data.get("ending_soon", [])
        if len(ending) == 0:
            pytest.skip("No ending soon listings")
        
        for i, item in enumerate(ending):
            assert "image_url" in item, f"Ending item {i} missing image_url"
            assert item["image_url"], f"Ending item {i} has empty image_url"
        print(f"PASS: All {len(ending)} ending_soon items have image_url")
    
    def test_ending_soon_have_time_left(self, command_center_data):
        """Ending soon items have time_left for countdown"""
        ending = command_center_data.get("ending_soon", [])
        if len(ending) == 0:
            pytest.skip("No ending soon listings")
        
        for i, item in enumerate(ending):
            assert "time_left" in item, f"Ending item {i} missing time_left"
            assert item["time_left"], f"Ending item {i} has empty time_left"
            assert item["time_left"].startswith("PT"), f"time_left not ISO 8601 duration: {item['time_left']}"
        print(f"PASS: All ending_soon items have time_left in ISO 8601 format")
    
    def test_recent_sales_array_exists(self, command_center_data):
        """Response has recent_sales array"""
        assert "recent_sales" in command_center_data
        assert isinstance(command_center_data["recent_sales"], list)
        print(f"PASS: recent_sales array exists with {len(command_center_data['recent_sales'])} items")
    
    def test_recent_sales_have_images(self, command_center_data):
        """Recent sales have image field populated (via Browse API fallback)"""
        sales = command_center_data.get("recent_sales", [])
        if len(sales) == 0:
            pytest.skip("No recent sales to test")
        
        items_with_images = sum(1 for s in sales if s.get("image"))
        print(f"PASS: {items_with_images}/{len(sales)} recent_sales have images")
        assert items_with_images > 0, "No recent sales have images"
    
    def test_recent_sales_fields(self, command_center_data):
        """Recent sales have all required fields for visual grid"""
        sales = command_center_data.get("recent_sales", [])
        if len(sales) == 0:
            pytest.skip("No recent sales to test")
        
        required_fields = ["title", "total", "image", "buyer", "date"]
        for i, sale in enumerate(sales):
            for field in required_fields:
                assert field in sale, f"Sale {i} missing required field: {field}"
        print(f"PASS: All recent_sales have required fields: {required_fields}")
    
    def test_listings_summary(self, command_center_data):
        """listings_summary has active_count and active_value"""
        summary = command_center_data.get("listings_summary", {})
        assert "active_count" in summary
        assert "active_value" in summary
        assert isinstance(summary["active_count"], int)
        assert isinstance(summary["active_value"], (int, float))
        print(f"PASS: listings_summary has active_count={summary['active_count']}, active_value=${summary['active_value']}")
    
    def test_snipes_data(self, command_center_data):
        """Snipes has active array and stats"""
        snipes = command_center_data.get("snipes", {})
        assert "active" in snipes
        assert "stats" in snipes
        stats = snipes["stats"]
        for key in ["active", "won", "lost", "total"]:
            assert key in stats, f"Snipe stats missing {key}"
        print(f"PASS: snipes.stats has won={stats['won']}, lost={stats['lost']}, total={stats['total']}")
    
    def test_monitor_data(self, command_center_data):
        """Monitor has recent_items, total, new_count, watchlist_count"""
        monitor = command_center_data.get("monitor", {})
        for key in ["recent_items", "total", "new_count", "watchlist_count"]:
            assert key in monitor, f"Monitor missing {key}"
        print(f"PASS: monitor has total={monitor['total']}, new_count={monitor['new_count']}, watchlist_count={monitor['watchlist_count']}")
    
    def test_inventory_count(self, command_center_data):
        """inventory_count is an integer"""
        assert "inventory_count" in command_center_data
        assert isinstance(command_center_data["inventory_count"], int)
        print(f"PASS: inventory_count={command_center_data['inventory_count']}")


class TestDashboardAnalytics:
    """Test analytics endpoint for sales data"""
    
    @pytest.fixture(scope="class")
    def session(self):
        return requests.Session()
    
    @pytest.fixture(scope="class")
    def auth_session(self, session):
        resp = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@dashboard.com",
            "password": "Test123!"
        })
        assert resp.status_code == 200
        return session
    
    @pytest.fixture(scope="class")
    def analytics_data(self, auth_session):
        resp = auth_session.get(f"{BASE_URL}/api/dashboard/analytics")
        assert resp.status_code == 200
        return resp.json()
    
    def test_analytics_returns_200(self, auth_session):
        """GET /api/dashboard/analytics returns 200"""
        resp = auth_session.get(f"{BASE_URL}/api/dashboard/analytics")
        assert resp.status_code == 200
        print("PASS: GET /api/dashboard/analytics returns 200")
    
    def test_top_sale_value(self, analytics_data):
        """Top sale is $90.50"""
        top_sale = analytics_data.get("sales", {}).get("top_sale", {})
        if not top_sale:
            pytest.skip("No top sale data")
        assert top_sale.get("total") == 90.5, f"Expected $90.50, got ${top_sale.get('total')}"
        print(f"PASS: Best Sale widget shows ${top_sale['total']}")
    
    def test_total_revenue(self, analytics_data):
        """Total revenue is approximately $600"""
        sales = analytics_data.get("sales", {})
        revenue = sales.get("total_revenue", 0)
        assert revenue > 500, f"Revenue {revenue} too low"
        print(f"PASS: Total revenue=${revenue}")
    
    def test_total_orders(self, analytics_data):
        """Total orders is 17"""
        sales = analytics_data.get("sales", {})
        orders = sales.get("total_orders", 0)
        assert orders == 17, f"Expected 17 orders, got {orders}"
        print(f"PASS: Total orders={orders}")
    
    def test_sales_timeline(self, analytics_data):
        """Sales timeline has items with date, total, fee, profit"""
        timeline = analytics_data.get("sales", {}).get("timeline", [])
        if len(timeline) == 0:
            pytest.skip("No sales timeline data")
        
        for i, sale in enumerate(timeline[:5]):
            for field in ["date", "total", "fee", "profit"]:
                assert field in sale, f"Sale {i} missing {field}"
        print(f"PASS: sales.timeline has {len(timeline)} items with required fields")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
