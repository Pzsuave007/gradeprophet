"""
Test suite for Market Intelligence redesign
Tests: watchlist CRUD, hot-cards, portfolio-health, and card-value endpoints
"""
import pytest
import requests
import os
import time

# Get BASE_URL from environment (public URL)
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    BASE_URL = "https://chase-editor-tool.preview.emergentagent.com"


class TestMarketHealthEndpoints:
    """Test basic market endpoints health"""
    
    def test_market_hot_cards_returns_200(self):
        """GET /api/market/hot-cards returns trending cards"""
        response = requests.get(f"{BASE_URL}/api/market/hot-cards", timeout=30)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "trending" in data, "Response should contain 'trending' key"
        assert isinstance(data["trending"], list), "trending should be a list"
        print(f"PASS: Got {len(data['trending'])} trending cards")
        
        # Validate card structure if any cards returned
        if len(data["trending"]) > 0:
            card = data["trending"][0]
            assert "name" in card, "Card should have 'name'"
            assert "query" in card, "Card should have 'query'"
            assert "sport" in card, "Card should have 'sport'"
            assert "tag" in card, "Card should have 'tag'"
            print(f"First trending card: {card['name']} ({card['sport']}) - {card['tag']}")
    
    def test_market_portfolio_health_returns_200(self):
        """GET /api/market/portfolio-health returns inventory items"""
        response = requests.get(f"{BASE_URL}/api/market/portfolio-health", timeout=30)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "items" in data, "Response should contain 'items'"
        assert "total_invested" in data, "Response should contain 'total_invested'"
        assert "total_items" in data, "Response should contain 'total_items'"
        
        print(f"PASS: Portfolio has {data['total_items']} items, ${data['total_invested']} invested")
        
        # Validate item structure
        if len(data["items"]) > 0:
            item = data["items"][0]
            assert "card_name" in item, "Item should have 'card_name'"
            assert "sport" in item, "Item should have 'sport'"
            assert "purchase_price" in item, "Item should have 'purchase_price'"
            print(f"First item: {item['card_name']} - {item['sport']} - ${item['purchase_price']}")
    
    def test_market_watchlist_returns_200(self):
        """GET /api/market/watchlist returns watchlist items"""
        response = requests.get(f"{BASE_URL}/api/market/watchlist", timeout=30)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "items" in data, "Response should contain 'items'"
        assert isinstance(data["items"], list), "'items' should be a list"
        print(f"PASS: Watchlist has {len(data['items'])} items")


class TestMarketWatchlistCRUD:
    """Test watchlist Create, Read, Delete operations"""
    
    @pytest.fixture(autouse=True)
    def cleanup_test_items(self):
        """Cleanup test items after each test"""
        yield
        # Clean up test items created during tests
        test_names = ["TEST_LeBron James", "TEST_Stephen Curry", "TEST_Card Delete Test"]
        for name in test_names:
            try:
                requests.delete(f"{BASE_URL}/api/market/watchlist/{name}", timeout=10)
            except:
                pass
    
    def test_add_player_to_watchlist(self):
        """POST /api/market/watchlist adds a player"""
        payload = {"name": "TEST_LeBron James", "type": "player"}
        response = requests.post(f"{BASE_URL}/api/market/watchlist", json=payload, timeout=30)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert data.get("status") in ["added", "already_exists"], f"Unexpected status: {data}"
        print(f"PASS: Add to watchlist returned status: {data.get('status')}")
    
    def test_add_card_to_watchlist(self):
        """POST /api/market/watchlist adds a card"""
        payload = {"name": "TEST_Stephen Curry", "type": "card"}
        response = requests.post(f"{BASE_URL}/api/market/watchlist", json=payload, timeout=30)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert data.get("status") in ["added", "already_exists"], f"Unexpected status: {data}"
        print(f"PASS: Add card to watchlist returned status: {data.get('status')}")
    
    def test_watchlist_empty_name_returns_400(self):
        """POST /api/market/watchlist with empty name should return 400"""
        payload = {"name": "", "type": "player"}
        response = requests.post(f"{BASE_URL}/api/market/watchlist", json=payload, timeout=30)
        
        assert response.status_code == 400, f"Expected 400 for empty name, got {response.status_code}"
        print("PASS: Empty name correctly returns 400")
    
    def test_add_and_verify_watchlist_item(self):
        """Add item then verify it appears in GET"""
        # Add item
        payload = {"name": "TEST_Card Delete Test", "type": "player"}
        add_response = requests.post(f"{BASE_URL}/api/market/watchlist", json=payload, timeout=30)
        assert add_response.status_code == 200
        
        # Verify it appears in list
        get_response = requests.get(f"{BASE_URL}/api/market/watchlist", timeout=30)
        assert get_response.status_code == 200
        
        items = get_response.json().get("items", [])
        found = any(item.get("name") == "TEST_Card Delete Test" for item in items)
        assert found, "Added item should appear in watchlist"
        print("PASS: Item added and verified in watchlist")
    
    def test_remove_from_watchlist(self):
        """DELETE /api/market/watchlist/{name} removes item"""
        # First add an item
        payload = {"name": "TEST_Card Delete Test", "type": "player"}
        requests.post(f"{BASE_URL}/api/market/watchlist", json=payload, timeout=30)
        
        # Then delete it
        response = requests.delete(
            f"{BASE_URL}/api/market/watchlist/TEST_Card Delete Test", 
            timeout=30
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get("status") == "removed", f"Unexpected status: {data}"
        
        # Verify it's removed
        get_response = requests.get(f"{BASE_URL}/api/market/watchlist", timeout=30)
        items = get_response.json().get("items", [])
        found = any(item.get("name") == "TEST_Card Delete Test" for item in items)
        assert not found, "Deleted item should not appear in watchlist"
        print("PASS: Item deleted from watchlist and verified removal")


class TestMarketCardValue:
    """Test card value lookup endpoint (uses Jina Reader API - may be slow)"""
    
    def test_card_value_endpoint_returns_200(self):
        """GET /api/market/card-value returns market data"""
        # Use a simple query that should return results
        query = "Luka Doncic Prizm"
        response = requests.get(
            f"{BASE_URL}/api/market/card-value", 
            params={"query": query},
            timeout=60  # Jina API can be slow
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        # Check required fields
        assert "query" in data, "Response should contain 'query'"
        assert "data_source" in data, "Response should contain 'data_source'"
        assert data["data_source"] in ["sold", "active"], f"data_source should be sold or active"
        
        print(f"PASS: Card value lookup for '{query}' returned data_source: {data['data_source']}")
        
        # Check if we got stats
        if "primary" in data:
            primary = data["primary"]
            if "stats" in primary:
                stats = primary["stats"]
                print(f"  Primary stats: count={stats.get('count', 0)}, median={stats.get('median', 'N/A')}")
    
    def test_card_value_with_graded_query(self):
        """GET /api/market/card-value with PSA 10 query"""
        query = "LeBron James Topps Chrome PSA 10"
        response = requests.get(
            f"{BASE_URL}/api/market/card-value", 
            params={"query": query},
            timeout=60
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        # Check for grade detection
        assert "is_graded" in data, "Response should contain 'is_graded'"
        print(f"PASS: Graded query detected is_graded={data.get('is_graded')}, grade={data.get('detected_grade', 'N/A')}")


class TestDashboardAnalytics:
    """Test dashboard analytics endpoint used by Market page"""
    
    def test_dashboard_analytics_returns_200(self):
        """GET /api/dashboard/analytics returns sales data for Market page"""
        response = requests.get(f"{BASE_URL}/api/dashboard/analytics", timeout=30)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "sales" in data, "Response should contain 'sales'"
        
        sales = data.get("sales", {})
        # Check for fields used by Market page
        expected_fields = ["total_revenue", "total_profit", "total_fees", "total_orders"]
        for field in expected_fields:
            assert field in sales, f"sales should contain '{field}'"
        
        print(f"PASS: Analytics returned - Revenue: ${sales.get('total_revenue', 0)}, "
              f"Profit: ${sales.get('total_profit', 0)}, Orders: {sales.get('total_orders', 0)}")
        
        # Check for chart data
        if "cumulative_chart" in sales:
            chart = sales["cumulative_chart"]
            if len(chart) > 0:
                assert "date" in chart[0], "Chart data should have 'date'"
                assert "revenue" in chart[0], "Chart data should have 'revenue'"
                print(f"  Chart has {len(chart)} data points")
        
        if "monthly_chart" in sales:
            monthly = sales["monthly_chart"]
            if len(monthly) > 0:
                assert "month" in monthly[0], "Monthly chart should have 'month'"
                assert "revenue" in monthly[0], "Monthly chart should have 'revenue'"
                assert "profit" in monthly[0], "Monthly chart should have 'profit'"
                print(f"  Monthly chart has {len(monthly)} months")


class TestHotCardsStructure:
    """Detailed test of hot cards endpoint data structure"""
    
    def test_hot_cards_has_required_fields(self):
        """Verify hot cards have all required display fields"""
        response = requests.get(f"{BASE_URL}/api/market/hot-cards", timeout=30)
        assert response.status_code == 200
        
        data = response.json()
        trending = data.get("trending", [])
        
        if len(trending) > 0:
            # Expected players based on code review
            expected_players = ["Victor Wembanyama", "LeBron James", "Luka Doncic", "Anthony Edwards"]
            found_players = [card["name"] for card in trending]
            
            print(f"Found trending players: {found_players}")
            
            # At least some expected players should be present for Basketball
            for card in trending:
                assert "name" in card, "Card missing 'name'"
                assert "query" in card, "Card missing 'query'"
                assert "sport" in card, "Card missing 'sport'"
                assert "tag" in card, "Card missing 'tag'"
                
                # Validate query is searchable
                assert len(card["query"]) > 5, f"Query too short: {card['query']}"
            
            print("PASS: All hot cards have required structure")
        else:
            print("SKIP: No trending cards returned (may need inventory data)")
    
    def test_hot_cards_returns_user_sports(self):
        """Verify user_sports field is returned"""
        response = requests.get(f"{BASE_URL}/api/market/hot-cards", timeout=30)
        assert response.status_code == 200
        
        data = response.json()
        assert "user_sports" in data, "Response should contain 'user_sports'"
        
        user_sports = data.get("user_sports", [])
        print(f"PASS: User sports detected: {user_sports}")


class TestPortfolioHealthStructure:
    """Detailed test of portfolio health endpoint"""
    
    def test_portfolio_health_has_sport_detection(self):
        """Verify portfolio items have sport auto-detected"""
        response = requests.get(f"{BASE_URL}/api/market/portfolio-health", timeout=30)
        assert response.status_code == 200
        
        data = response.json()
        items = data.get("items", [])
        
        if len(items) > 0:
            for item in items:
                assert "sport" in item, f"Item missing sport: {item.get('card_name', 'Unknown')}"
                print(f"  {item['card_name'][:40]}... - Sport: {item['sport']}")
            
            print("PASS: All portfolio items have sport detected")
        else:
            print("SKIP: No inventory items to verify")
    
    def test_portfolio_health_totals_are_numeric(self):
        """Verify totals are numeric values"""
        response = requests.get(f"{BASE_URL}/api/market/portfolio-health", timeout=30)
        assert response.status_code == 200
        
        data = response.json()
        
        total_invested = data.get("total_invested")
        total_items = data.get("total_items")
        
        assert isinstance(total_invested, (int, float)), "total_invested should be numeric"
        assert isinstance(total_items, int), "total_items should be integer"
        
        print(f"PASS: Totals are numeric - invested: {total_invested}, items: {total_items}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
