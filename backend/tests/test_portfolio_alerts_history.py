"""
Test cases for Portfolio Value Tracker, Price Alerts, and Price History features
- Portfolio endpoints: GET /api/portfolio/summary, POST /api/portfolio/refresh-value/{id}, POST /api/portfolio/snapshot
- Alert endpoints: POST /api/alerts, GET /api/alerts, DELETE /api/alerts/{id}, POST /api/alerts/check
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session

# =========================
# PORTFOLIO SUMMARY TESTS
# =========================

class TestPortfolioSummary:
    """Test GET /api/portfolio/summary endpoint"""

    def test_portfolio_summary_returns_200(self, api_client):
        """Test that portfolio summary endpoint returns 200"""
        response = api_client.get(f"{BASE_URL}/api/portfolio/summary")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("PASS: GET /api/portfolio/summary returns 200")

    def test_portfolio_summary_has_required_fields(self, api_client):
        """Test that portfolio summary returns all required fields"""
        response = api_client.get(f"{BASE_URL}/api/portfolio/summary")
        assert response.status_code == 200
        data = response.json()

        # Check all required fields
        required_fields = ["total_invested", "total_market_value", "pnl", "roi", "total_cards", "valued_cards", "unvalued_cards", "cards", "snapshots"]
        for field in required_fields:
            assert field in data, f"Missing required field: {field}"

        # Validate data types
        assert isinstance(data["total_invested"], (int, float)), "total_invested should be numeric"
        assert isinstance(data["total_market_value"], (int, float)), "total_market_value should be numeric"
        assert isinstance(data["pnl"], (int, float)), "pnl should be numeric"
        assert isinstance(data["roi"], (int, float)), "roi should be numeric"
        assert isinstance(data["total_cards"], int), "total_cards should be integer"
        assert isinstance(data["valued_cards"], int), "valued_cards should be integer"
        assert isinstance(data["unvalued_cards"], int), "unvalued_cards should be integer"
        assert isinstance(data["cards"], list), "cards should be a list"
        assert isinstance(data["snapshots"], list), "snapshots should be a list"
        print(f"PASS: Portfolio summary has all required fields: {required_fields}")

    def test_portfolio_summary_cards_have_required_fields(self, api_client):
        """Test that cards in portfolio summary have required fields"""
        response = api_client.get(f"{BASE_URL}/api/portfolio/summary")
        assert response.status_code == 200
        data = response.json()

        if len(data["cards"]) > 0:
            card = data["cards"][0]
            card_fields = ["id", "card_name", "player", "purchase_price", "market_value"]
            for field in card_fields:
                assert field in card, f"Card missing required field: {field}"
            print(f"PASS: Portfolio cards have required fields: {card_fields}")
        else:
            print("SKIP: No cards in portfolio to test field structure")


# =========================
# PORTFOLIO REFRESH VALUE TESTS
# =========================

class TestPortfolioRefreshValue:
    """Test POST /api/portfolio/refresh-value/{item_id} endpoint"""

    def test_refresh_value_nonexistent_item_returns_404(self, api_client):
        """Test that refresh value for non-existent item returns 404"""
        fake_id = str(uuid.uuid4())
        response = api_client.post(f"{BASE_URL}/api/portfolio/refresh-value/{fake_id}")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"
        print("PASS: POST /api/portfolio/refresh-value for non-existent item returns 404")

    def test_refresh_value_existing_item(self, api_client):
        """Test refresh value for an existing inventory item"""
        # First get inventory to find an existing item
        summary_response = api_client.get(f"{BASE_URL}/api/portfolio/summary")
        assert summary_response.status_code == 200
        cards = summary_response.json().get("cards", [])

        if len(cards) > 0:
            item_id = cards[0]["id"]
            response = api_client.post(f"{BASE_URL}/api/portfolio/refresh-value/{item_id}")
            assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
            data = response.json()

            # Check response fields
            assert "id" in data, "Response should contain id"
            assert "market_value" in data, "Response should contain market_value"
            assert data["id"] == item_id, "Response id should match request id"
            print(f"PASS: POST /api/portfolio/refresh-value/{item_id} returns 200 with market_value")
        else:
            print("SKIP: No inventory items to test refresh value")


# =========================
# PORTFOLIO SNAPSHOT TESTS
# =========================

class TestPortfolioSnapshot:
    """Test POST /api/portfolio/snapshot endpoint"""

    def test_portfolio_snapshot_returns_200(self, api_client):
        """Test that portfolio snapshot endpoint returns 200"""
        response = api_client.post(f"{BASE_URL}/api/portfolio/snapshot")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("PASS: POST /api/portfolio/snapshot returns 200")

    def test_portfolio_snapshot_has_required_fields(self, api_client):
        """Test that portfolio snapshot returns required fields"""
        response = api_client.post(f"{BASE_URL}/api/portfolio/snapshot")
        assert response.status_code == 200
        data = response.json()

        required_fields = ["date", "timestamp", "total_invested", "total_market_value", "pnl", "total_cards", "valued_cards"]
        for field in required_fields:
            assert field in data, f"Missing required field: {field}"
        print(f"PASS: Portfolio snapshot has all required fields: {required_fields}")


# =========================
# PRICE ALERTS CREATE TESTS
# =========================

class TestPriceAlertsCreate:
    """Test POST /api/alerts endpoint"""

    def test_create_alert_returns_200(self, api_client):
        """Test creating a new price alert"""
        payload = {
            "search_query": "TEST_ALERT LeBron James Prizm PSA 10",
            "player": "LeBron James",
            "condition_type": "below",
            "target_price": 100.00,
            "notes": "Test alert for testing"
        }
        response = api_client.post(f"{BASE_URL}/api/alerts", json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()

        # Validate response
        assert "id" in data, "Response should contain id"
        assert data["search_query"] == payload["search_query"], "search_query should match"
        assert data["condition_type"] == "below", "condition_type should be 'below'"
        assert data["target_price"] == 100.00, "target_price should be 100.00"
        assert data["active"] == True, "active should be True"
        assert data["triggered"] == False, "triggered should be False"
        print("PASS: POST /api/alerts creates alert successfully")
        return data["id"]

    def test_create_alert_with_above_condition(self, api_client):
        """Test creating an alert with 'above' condition"""
        payload = {
            "search_query": "TEST_ALERT Michael Jordan Prizm",
            "condition_type": "above",
            "target_price": 500.00
        }
        response = api_client.post(f"{BASE_URL}/api/alerts", json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["condition_type"] == "above", "condition_type should be 'above'"
        print("PASS: POST /api/alerts with 'above' condition works")

    def test_create_alert_minimal_fields(self, api_client):
        """Test creating alert with only required fields"""
        payload = {
            "search_query": "TEST_ALERT Kobe Bryant",
            "target_price": 50.00
        }
        response = api_client.post(f"{BASE_URL}/api/alerts", json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("PASS: POST /api/alerts with minimal fields works")


# =========================
# PRICE ALERTS GET TESTS
# =========================

class TestPriceAlertsGet:
    """Test GET /api/alerts endpoint"""

    def test_get_alerts_returns_200(self, api_client):
        """Test getting all price alerts"""
        response = api_client.get(f"{BASE_URL}/api/alerts")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"PASS: GET /api/alerts returns 200 with {len(data)} alerts")

    def test_get_alerts_contain_required_fields(self, api_client):
        """Test that alerts have required fields"""
        response = api_client.get(f"{BASE_URL}/api/alerts")
        assert response.status_code == 200
        data = response.json()

        if len(data) > 0:
            alert = data[0]
            required_fields = ["id", "search_query", "condition_type", "target_price", "active", "triggered", "created_at"]
            for field in required_fields:
                assert field in alert, f"Alert missing required field: {field}"
            print(f"PASS: Alerts have required fields: {required_fields}")
        else:
            print("SKIP: No alerts to test field structure")


# =========================
# PRICE ALERTS DELETE TESTS
# =========================

class TestPriceAlertsDelete:
    """Test DELETE /api/alerts/{alert_id} endpoint"""

    def test_delete_nonexistent_alert_returns_404(self, api_client):
        """Test deleting non-existent alert returns 404"""
        fake_id = str(uuid.uuid4())
        response = api_client.delete(f"{BASE_URL}/api/alerts/{fake_id}")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"
        print("PASS: DELETE /api/alerts for non-existent alert returns 404")

    def test_create_and_delete_alert(self, api_client):
        """Test creating then deleting an alert"""
        # Create alert
        create_payload = {
            "search_query": "TEST_DELETE_ALERT Stephen Curry",
            "target_price": 75.00
        }
        create_response = api_client.post(f"{BASE_URL}/api/alerts", json=create_payload)
        assert create_response.status_code == 200
        alert_id = create_response.json()["id"]

        # Delete alert
        delete_response = api_client.delete(f"{BASE_URL}/api/alerts/{alert_id}")
        assert delete_response.status_code == 200, f"Expected 200, got {delete_response.status_code}: {delete_response.text}"
        data = delete_response.json()
        assert data.get("success") == True, "Response should contain success: true"

        # Verify deletion
        get_response = api_client.get(f"{BASE_URL}/api/alerts")
        alerts = get_response.json()
        alert_ids = [a["id"] for a in alerts]
        assert alert_id not in alert_ids, "Deleted alert should not appear in list"
        print("PASS: Alert created and deleted successfully")


# =========================
# PRICE ALERTS CHECK TESTS
# =========================

class TestPriceAlertsCheck:
    """Test POST /api/alerts/check endpoint"""

    def test_check_alerts_returns_200(self, api_client):
        """Test checking all alerts returns 200"""
        response = api_client.post(f"{BASE_URL}/api/alerts/check")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()

        assert "checked" in data, "Response should contain 'checked' count"
        assert "results" in data, "Response should contain 'results' list"
        assert isinstance(data["results"], list), "results should be a list"
        print(f"PASS: POST /api/alerts/check returns 200, checked {data['checked']} alerts")


# =========================
# CLEANUP TEST DATA
# =========================

class TestCleanup:
    """Clean up test data"""

    def test_cleanup_test_alerts(self, api_client):
        """Delete all TEST_ prefixed alerts"""
        response = api_client.get(f"{BASE_URL}/api/alerts")
        alerts = response.json()
        deleted = 0
        for alert in alerts:
            if alert.get("search_query", "").startswith("TEST_"):
                del_response = api_client.delete(f"{BASE_URL}/api/alerts/{alert['id']}")
                if del_response.status_code == 200:
                    deleted += 1
        print(f"PASS: Cleaned up {deleted} test alerts")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
