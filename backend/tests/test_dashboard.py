"""
Dashboard API Tests for FlipSlab Engine
Tests KPIs, recent cards, movers, opportunities, and eBay market data endpoints
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestDashboardStats:
    """Tests for /api/dashboard/stats endpoint - KPI data"""
    
    def test_stats_endpoint_returns_200(self):
        """Verify stats endpoint is accessible"""
        response = requests.get(f"{BASE_URL}/api/dashboard/stats")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("PASS: Dashboard stats endpoint returns 200")
    
    def test_stats_contains_required_fields(self):
        """Verify stats response contains all required KPI fields"""
        response = requests.get(f"{BASE_URL}/api/dashboard/stats")
        assert response.status_code == 200
        
        data = response.json()
        required_fields = [
            "total_cards", "high_grade_cards", "total_listings", 
            "new_listings", "interested_listings", "watchlist_count",
            "not_listed", "flip_opportunities", "estimated_value"
        ]
        
        for field in required_fields:
            assert field in data, f"Missing field: {field}"
            print(f"PASS: Field '{field}' present with value: {data[field]}")
    
    def test_stats_values_are_numeric(self):
        """Verify stats values are numeric"""
        response = requests.get(f"{BASE_URL}/api/dashboard/stats")
        data = response.json()
        
        for key, value in data.items():
            assert isinstance(value, (int, float)), f"{key} should be numeric, got {type(value)}"
        print("PASS: All stats values are numeric")


class TestDashboardRecent:
    """Tests for /api/dashboard/recent endpoint - Recently scanned cards"""
    
    def test_recent_endpoint_returns_200(self):
        """Verify recent endpoint is accessible"""
        response = requests.get(f"{BASE_URL}/api/dashboard/recent")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("PASS: Dashboard recent endpoint returns 200")
    
    def test_recent_returns_list(self):
        """Verify recent returns array of cards"""
        response = requests.get(f"{BASE_URL}/api/dashboard/recent")
        data = response.json()
        
        assert isinstance(data, list), "Recent endpoint should return a list"
        print(f"PASS: Recent endpoint returned list with {len(data)} items")
    
    def test_recent_card_structure(self):
        """Verify recently scanned cards have required fields"""
        response = requests.get(f"{BASE_URL}/api/dashboard/recent")
        data = response.json()
        
        if len(data) > 0:
            card = data[0]
            required_fields = ["id", "card_name", "grading_result", "created_at", "front_image_preview"]
            for field in required_fields:
                assert field in card, f"Missing field: {field}"
            print(f"PASS: Recent cards have proper structure - card_name: {card.get('card_name')}")
        else:
            print("SKIP: No recent cards to validate structure")


class TestDashboardMovers:
    """Tests for /api/dashboard/movers endpoint - Price movers"""
    
    def test_movers_endpoint_returns_200(self):
        """Verify movers endpoint is accessible"""
        response = requests.get(f"{BASE_URL}/api/dashboard/movers")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("PASS: Dashboard movers endpoint returns 200")
    
    def test_movers_returns_list(self):
        """Verify movers returns array"""
        response = requests.get(f"{BASE_URL}/api/dashboard/movers")
        data = response.json()
        
        assert isinstance(data, list), "Movers endpoint should return a list"
        print(f"PASS: Movers endpoint returned list with {len(data)} items")
    
    def test_movers_structure(self):
        """Verify movers have required fields"""
        response = requests.get(f"{BASE_URL}/api/dashboard/movers")
        data = response.json()
        
        if len(data) > 0:
            mover = data[0]
            required_fields = ["search_query", "latest_price", "price_change_pct"]
            for field in required_fields:
                assert field in mover, f"Missing field: {field}"
            print(f"PASS: Movers have proper structure - search_query: {mover.get('search_query')}, price_change: {mover.get('price_change_pct')}%")
        else:
            print("SKIP: No movers to validate structure")


class TestDashboardOpportunities:
    """Tests for /api/dashboard/opportunities endpoint - Flip opportunities"""
    
    def test_opportunities_endpoint_returns_200(self):
        """Verify opportunities endpoint is accessible"""
        response = requests.get(f"{BASE_URL}/api/dashboard/opportunities")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("PASS: Dashboard opportunities endpoint returns 200")
    
    def test_opportunities_returns_list(self):
        """Verify opportunities returns array"""
        response = requests.get(f"{BASE_URL}/api/dashboard/opportunities")
        data = response.json()
        
        assert isinstance(data, list), "Opportunities endpoint should return a list"
        print(f"PASS: Opportunities endpoint returned list with {len(data)} items")
    
    def test_opportunities_structure(self):
        """Verify opportunities have required fields for eBay listings"""
        response = requests.get(f"{BASE_URL}/api/dashboard/opportunities")
        data = response.json()
        
        if len(data) > 0:
            opp = data[0]
            required_fields = ["title", "price", "listing_url", "image_url"]
            for field in required_fields:
                assert field in opp, f"Missing field: {field}"
            print(f"PASS: Opportunities have proper structure - title: {opp.get('title')[:50]}...")
        else:
            print("SKIP: No opportunities to validate structure")


class TestEbayMarketData:
    """Tests for /api/dashboard/ebay-market endpoint - Live eBay API"""
    
    def test_ebay_market_endpoint_returns_200(self):
        """Verify eBay market endpoint is accessible"""
        response = requests.get(f"{BASE_URL}/api/dashboard/ebay-market", timeout=60)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("PASS: eBay market endpoint returns 200")
    
    def test_ebay_market_response_structure(self):
        """Verify eBay market response has items array and total"""
        response = requests.get(f"{BASE_URL}/api/dashboard/ebay-market", timeout=60)
        data = response.json()
        
        assert "items" in data, "Response should have 'items' field"
        assert "total" in data, "Response should have 'total' field"
        assert isinstance(data["items"], list), "items should be a list"
        print(f"PASS: eBay market returned {data['total']} items")
    
    def test_ebay_market_item_structure(self):
        """Verify eBay market items have expected fields"""
        response = requests.get(f"{BASE_URL}/api/dashboard/ebay-market?query=kobe%20bryant%20card", timeout=60)
        data = response.json()
        
        if len(data.get("items", [])) > 0:
            item = data["items"][0]
            required_fields = ["title", "price", "item_web_url"]
            for field in required_fields:
                assert field in item, f"Missing field: {field}"
            print(f"PASS: eBay items have proper structure - title: {item.get('title')[:50]}...")
        else:
            print("SKIP: No eBay items to validate structure")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
