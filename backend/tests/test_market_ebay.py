"""
Test Module 3 (Market Data) and Module 4 (Flip Calculator) + eBay OAuth/Seller endpoints
Tests real eBay Browse API and Trading API integration

Endpoints tested:
- GET /api/market/search - Search eBay for card listings with price stats
- GET /api/market/card-value - Get raw vs graded market values  
- GET /api/market/flip-calc - Calculate flip profit potential
- GET /api/ebay/oauth/status - Check if eBay account is connected
- GET /api/ebay/seller/my-listings - Get user's real eBay active listings and sold items
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestMarketEndpoints:
    """Module 3: Market Data - eBay Browse API tests"""
    
    def test_market_search_returns_items_and_stats(self):
        """GET /api/market/search - returns items array with prices, stats with median/avg/min/max"""
        response = requests.get(f"{BASE_URL}/api/market/search", params={"query": "kobe bryant"})
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        # Verify response structure
        assert "items" in data, "Response should have 'items' array"
        assert "stats" in data, "Response should have 'stats' object"
        assert "total" in data, "Response should have 'total' count"
        
        # If items found, verify item structure
        if len(data["items"]) > 0:
            item = data["items"][0]
            assert "title" in item, "Item should have 'title'"
            assert "price" in item, "Item should have 'price'"
            assert "image_url" in item, "Item should have 'image_url'"
            
        # If stats populated, verify stats structure
        if data["stats"]:
            stats = data["stats"]
            assert "count" in stats, "Stats should have 'count'"
            assert "avg_price" in stats or "avg" in stats, "Stats should have avg price"
            assert "median_price" in stats or "median" in stats or "market_value" in stats, "Stats should have median"
            
        print(f"✓ Market search returned {len(data['items'])} items")
        
    def test_market_card_value_returns_raw_and_psa10_stats(self):
        """GET /api/market/card-value - returns raw stats, psa10 stats, and graded stats"""
        response = requests.get(f"{BASE_URL}/api/market/card-value", params={"query": "luka doncic prizm"})
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        # Verify response structure has raw, psa10, and graded sections
        assert "raw" in data, "Response should have 'raw' section"
        assert "psa10" in data, "Response should have 'psa10' section"
        assert "graded" in data, "Response should have 'graded' section"
        assert "query" in data, "Response should have 'query' field"
        
        # Verify raw section structure
        raw = data["raw"]
        assert "items" in raw, "Raw should have 'items' array"
        assert "stats" in raw, "Raw should have 'stats' object"
        
        # Verify psa10 section structure
        psa10 = data["psa10"]
        assert "items" in psa10, "PSA10 should have 'items' array"
        assert "stats" in psa10, "PSA10 should have 'stats' object"
        
        # Verify graded section has stats
        graded = data["graded"]
        assert "stats" in graded, "Graded should have 'stats' object"
        
        # If items found, verify item structure
        if len(raw["items"]) > 0:
            item = raw["items"][0]
            assert "title" in item, "Item should have 'title'"
            assert "price" in item, "Item should have 'price'"
            assert "url" in item, "Item should have 'url'"
            
        print(f"✓ Card value: raw={len(raw['items'])} items, psa10={len(psa10['items'])} items")
        
    def test_flip_calculator_returns_profit_calculation(self):
        """GET /api/market/flip-calc - returns raw_price, psa10_value, potential_profit, roi_percent"""
        response = requests.get(
            f"{BASE_URL}/api/market/flip-calc", 
            params={"query": "michael jordan fleer", "grading_cost": 30}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        # Verify response has required flip calculation fields
        assert "query" in data, "Response should have 'query'"
        assert "raw_price" in data, "Response should have 'raw_price'"
        assert "psa10_value" in data, "Response should have 'psa10_value'"
        assert "grading_cost" in data, "Response should have 'grading_cost'"
        assert "potential_profit" in data, "Response should have 'potential_profit'"
        assert "roi_percent" in data, "Response should have 'roi_percent'"
        
        # Verify grading_cost is correct
        assert data["grading_cost"] == 30, f"Expected grading_cost=30, got {data['grading_cost']}"
        
        # Verify data types
        assert isinstance(data["raw_price"], (int, float)), "raw_price should be numeric"
        assert isinstance(data["psa10_value"], (int, float)), "psa10_value should be numeric"
        assert isinstance(data["potential_profit"], (int, float)), "potential_profit should be numeric"
        assert isinstance(data["roi_percent"], (int, float)), "roi_percent should be numeric"
        
        print(f"✓ Flip calc: raw=${data['raw_price']}, psa10=${data['psa10_value']}, profit=${data['potential_profit']}, ROI={data['roi_percent']}%")


class TestEbayOAuthEndpoints:
    """Module 4: eBay OAuth and Seller API tests (using real connected account)"""
    
    def test_ebay_oauth_status_connected(self):
        """GET /api/ebay/oauth/status - returns connected: true (account pazacap0 is connected)"""
        response = requests.get(f"{BASE_URL}/api/ebay/oauth/status")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        # Verify response structure
        assert "connected" in data, "Response should have 'connected' field"
        
        # Per the test request, eBay account is connected
        assert data["connected"] == True, f"Expected connected=True, got {data['connected']}"
        
        # If connected, should have updated_at
        if data["connected"]:
            assert "updated_at" in data or "token_type" in data, "Connected status should have timestamp or token_type"
            
        print(f"✓ eBay OAuth status: connected={data['connected']}")
        
    def test_ebay_my_listings_returns_active_and_sold(self):
        """GET /api/ebay/seller/my-listings - returns active listings and sold items"""
        response = requests.get(f"{BASE_URL}/api/ebay/seller/my-listings", params={"limit": 50})
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        # Verify response structure
        assert "active" in data, "Response should have 'active' array"
        assert "sold" in data, "Response should have 'sold' array"
        assert "active_total" in data, "Response should have 'active_total' count"
        assert "sold_total" in data, "Response should have 'sold_total' count"
        
        # Per the test request, user has 73 active listings and 9 sold items
        # We check that we get reasonable data
        assert isinstance(data["active"], list), "active should be a list"
        assert isinstance(data["sold"], list), "sold should be a list"
        assert isinstance(data["active_total"], int), "active_total should be int"
        assert isinstance(data["sold_total"], int), "sold_total should be int"
        
        # If we have active listings, verify item structure
        if len(data["active"]) > 0:
            item = data["active"][0]
            # Trading API item should have these fields
            assert "item_id" in item, "Active item should have 'item_id'"
            assert "title" in item, "Active item should have 'title'"
            assert "price" in item, "Active item should have 'price'"
            
        # If we have sold items, verify structure
        if len(data["sold"]) > 0:
            item = data["sold"][0]
            assert "title" in item, "Sold item should have 'title'"
            assert "price" in item, "Sold item should have 'price'"
            
        print(f"✓ eBay my-listings: active={data['active_total']} ({len(data['active'])} returned), sold={data['sold_total']} ({len(data['sold'])} returned)")


class TestMarketSearchEdgeCases:
    """Additional edge case tests for market endpoints"""
    
    def test_market_search_empty_query_handling(self):
        """Market search with unusual query should still return valid structure"""
        response = requests.get(f"{BASE_URL}/api/market/search", params={"query": "xyz123nonexistent"})
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        # Even with no results, should return valid structure
        assert "items" in data, "Should have items array even if empty"
        assert "stats" in data, "Should have stats object even if empty"
        print(f"✓ Empty query handling: returned {len(data.get('items', []))} items")
        
    def test_flip_calc_custom_grading_cost(self):
        """Flip calculator accepts custom grading cost"""
        response = requests.get(
            f"{BASE_URL}/api/market/flip-calc",
            params={"query": "lebron james rookie", "grading_cost": 50}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        assert data["grading_cost"] == 50, f"Expected grading_cost=50, got {data['grading_cost']}"
        print(f"✓ Custom grading cost: ${data['grading_cost']}")


@pytest.fixture(scope="session")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
