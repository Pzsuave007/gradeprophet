"""
Dashboard Command Center Tests
- Tests GET /api/dashboard/command-center endpoint
- Tests GET /api/dashboard/analytics endpoint
- Verifies response structure for the new dashboard redesign
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "test@dashboard.com"
TEST_PASSWORD = "Test123!"


@pytest.fixture(scope="module")
def session():
    """Create authenticated session"""
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    
    # Login to get session cookie
    resp = s.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    
    if resp.status_code != 200:
        pytest.skip(f"Login failed: {resp.status_code} - {resp.text}")
    
    return s


class TestCommandCenterEndpoint:
    """Tests for GET /api/dashboard/command-center"""
    
    def test_command_center_returns_200(self, session):
        """Command center endpoint returns 200 OK"""
        resp = session.get(f"{BASE_URL}/api/dashboard/command-center")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
    
    def test_command_center_has_snipes_field(self, session):
        """Response contains snipes object with active and stats"""
        resp = session.get(f"{BASE_URL}/api/dashboard/command-center")
        assert resp.status_code == 200
        data = resp.json()
        
        assert "snipes" in data, "Missing 'snipes' field in response"
        assert "active" in data["snipes"], "Missing 'snipes.active' field"
        assert "stats" in data["snipes"], "Missing 'snipes.stats' field"
        
        # Stats structure
        stats = data["snipes"]["stats"]
        assert "active" in stats, "Missing 'snipes.stats.active'"
        assert "won" in stats, "Missing 'snipes.stats.won'"
        assert "lost" in stats, "Missing 'snipes.stats.lost'"
        assert "total" in stats, "Missing 'snipes.stats.total'"
    
    def test_command_center_has_monitor_field(self, session):
        """Response contains monitor object with items and counts"""
        resp = session.get(f"{BASE_URL}/api/dashboard/command-center")
        assert resp.status_code == 200
        data = resp.json()
        
        assert "monitor" in data, "Missing 'monitor' field in response"
        monitor = data["monitor"]
        
        assert "recent_items" in monitor, "Missing 'monitor.recent_items'"
        assert "total" in monitor, "Missing 'monitor.total'"
        assert "new_count" in monitor, "Missing 'monitor.new_count'"
        assert "watchlist_count" in monitor, "Missing 'monitor.watchlist_count'"
    
    def test_command_center_has_recent_actions(self, session):
        """Response contains recent_actions list"""
        resp = session.get(f"{BASE_URL}/api/dashboard/command-center")
        assert resp.status_code == 200
        data = resp.json()
        
        assert "recent_actions" in data, "Missing 'recent_actions' field"
        assert isinstance(data["recent_actions"], list), "'recent_actions' should be a list"
    
    def test_command_center_has_inventory_count(self, session):
        """Response contains inventory_count"""
        resp = session.get(f"{BASE_URL}/api/dashboard/command-center")
        assert resp.status_code == 200
        data = resp.json()
        
        assert "inventory_count" in data, "Missing 'inventory_count' field"
        assert isinstance(data["inventory_count"], int), "'inventory_count' should be an integer"
    
    def test_command_center_requires_auth(self):
        """Command center endpoint requires authentication"""
        resp = requests.get(f"{BASE_URL}/api/dashboard/command-center")
        assert resp.status_code == 401, f"Expected 401, got {resp.status_code}"


class TestAnalyticsEndpoint:
    """Tests for GET /api/dashboard/analytics (existing endpoint)"""
    
    def test_analytics_returns_200(self, session):
        """Analytics endpoint returns 200 OK"""
        resp = session.get(f"{BASE_URL}/api/dashboard/analytics")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
    
    def test_analytics_has_sales_data(self, session):
        """Response contains sales object with timeline, charts, and totals"""
        resp = session.get(f"{BASE_URL}/api/dashboard/analytics")
        assert resp.status_code == 200
        data = resp.json()
        
        assert "sales" in data, "Missing 'sales' field"
        sales = data["sales"]
        
        # Check sales structure
        assert "timeline" in sales, "Missing 'sales.timeline'"
        assert "cumulative_chart" in sales, "Missing 'sales.cumulative_chart'"
        assert "monthly_chart" in sales, "Missing 'sales.monthly_chart'"
        assert "total_revenue" in sales, "Missing 'sales.total_revenue'"
        assert "total_fees" in sales, "Missing 'sales.total_fees'"
        assert "total_profit" in sales, "Missing 'sales.total_profit'"
        assert "total_orders" in sales, "Missing 'sales.total_orders'"
        assert "avg_sale" in sales, "Missing 'sales.avg_sale'"
    
    def test_analytics_has_inventory_data(self, session):
        """Response contains inventory breakdown"""
        resp = session.get(f"{BASE_URL}/api/dashboard/analytics")
        assert resp.status_code == 200
        data = resp.json()
        
        assert "inventory" in data, "Missing 'inventory' field"
        inv = data["inventory"]
        
        assert "by_sport" in inv, "Missing 'inventory.by_sport'"
        assert "by_player" in inv, "Missing 'inventory.by_player'"
        assert "by_category" in inv, "Missing 'inventory.by_category'"
        assert "total_items" in inv, "Missing 'inventory.total_items'"
        assert "total_invested" in inv, "Missing 'inventory.total_invested'"
    
    def test_analytics_has_listings_data(self, session):
        """Response contains listings info with ending_soon"""
        resp = session.get(f"{BASE_URL}/api/dashboard/analytics")
        assert resp.status_code == 200
        data = resp.json()
        
        assert "listings" in data, "Missing 'listings' field"
        lst = data["listings"]
        
        assert "active_count" in lst, "Missing 'listings.active_count'"
        assert "active_value" in lst, "Missing 'listings.active_value'"
        assert "ending_soon" in lst, "Missing 'listings.ending_soon'"
        assert isinstance(lst["ending_soon"], list), "'ending_soon' should be a list"
    
    def test_analytics_requires_auth(self):
        """Analytics endpoint requires authentication"""
        resp = requests.get(f"{BASE_URL}/api/dashboard/analytics")
        assert resp.status_code == 401, f"Expected 401, got {resp.status_code}"
    
    def test_analytics_timeline_structure(self, session):
        """Sales timeline items have expected fields"""
        resp = session.get(f"{BASE_URL}/api/dashboard/analytics")
        assert resp.status_code == 200
        data = resp.json()
        
        timeline = data["sales"]["timeline"]
        if len(timeline) > 0:
            sale = timeline[0]
            assert "date" in sale, "Missing 'date' in timeline item"
            assert "total" in sale, "Missing 'total' in timeline item"
            assert "fee" in sale, "Missing 'fee' in timeline item"
            assert "profit" in sale, "Missing 'profit' in timeline item"
            assert "title" in sale, "Missing 'title' in timeline item"
    
    def test_analytics_ending_soon_structure(self, session):
        """Ending soon items have expected fields"""
        resp = session.get(f"{BASE_URL}/api/dashboard/analytics")
        assert resp.status_code == 200
        data = resp.json()
        
        ending_soon = data["listings"]["ending_soon"]
        if len(ending_soon) > 0:
            item = ending_soon[0]
            assert "title" in item, "Missing 'title' in ending_soon item"
            assert "price" in item, "Missing 'price' in ending_soon item"
            assert "time_left" in item, "Missing 'time_left' in ending_soon item"


class TestDashboardStats:
    """Tests for GET /api/dashboard/stats"""
    
    def test_stats_returns_200(self, session):
        """Stats endpoint returns 200 OK"""
        resp = session.get(f"{BASE_URL}/api/dashboard/stats")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
    
    def test_stats_structure(self, session):
        """Stats response has expected fields"""
        resp = session.get(f"{BASE_URL}/api/dashboard/stats")
        assert resp.status_code == 200
        data = resp.json()
        
        expected_fields = [
            "total_cards", "high_grade_cards", "total_listings",
            "new_listings", "interested_listings", "watchlist_count",
            "not_listed", "flip_opportunities", "estimated_value"
        ]
        
        for field in expected_fields:
            assert field in data, f"Missing '{field}' in stats response"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
