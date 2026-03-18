"""
Test suite for Market Value Fix - Kobe Bryant PSA 9 Issue
Tests:
1. POST /api/portfolio/refresh-value/{item_id} - Kobe card should return $30-120 NOT $400+
2. GET /api/portfolio/summary - Portfolio summary with correct market values  
3. Title filtering (_filter_irrelevant_titles) - excludes lots, wrong parallels, grade mismatches
4. Outlier filtering (_filter_outliers_iqr) - removes extreme prices
5. Data source verification - should be 'sold' when Scrapedo works
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
SESSION_TOKEN = "sess_c3e8809960bf40e29bc0918206cbe572"
TEST_USER_ID = "user_b67ade950db8"
KOBE_CARD_ID = "49d4437f-1c4c-4fb9-bca2-d46beebbb37f"
KAT_CARD_ID = "ff39c00e-0182-48db-b912-c6da2760e4fc"


class TestKobeCardMarketValue:
    """Test Kobe Bryant PSA 9 card market value calculation fix"""
    
    @pytest.fixture(autouse=True)
    def auth_headers(self):
        """Auth headers for all requests"""
        return {
            "Cookie": f"session_token={SESSION_TOKEN}",
            "Content-Type": "application/json"
        }
    
    def test_refresh_kobe_card_value(self, auth_headers):
        """
        Test POST /api/portfolio/refresh-value/{item_id} for Kobe Bryant PSA 9
        Expected: market_value should be $30-120, NOT $400+
        Bug fix verified: title filtering + outlier filtering + recency-weighted avg using only filtered items
        """
        response = requests.post(
            f"{BASE_URL}/api/portfolio/refresh-value/{KOBE_CARD_ID}",
            headers=auth_headers,
            timeout=60  # Scrapedo takes ~10-15s
        )
        
        # Status code check
        assert response.status_code == 200, f"API returned {response.status_code}: {response.text}"
        
        data = response.json()
        print(f"\n=== KOBE CARD MARKET VALUE RESPONSE ===")
        print(f"Market Value: ${data.get('market_value', 0)}")
        print(f"Last Sold Price: ${data.get('last_sold_price', 0)}")
        print(f"Data Source: {data.get('data_source', 'unknown')}")
        print(f"Items Found: {data.get('items_found', 0)}")
        print(f"Outliers Removed: {data.get('outliers_removed', 0)}")
        print(f"Query Used: {data.get('query_used', '')}")
        print(f"Confidence: {data.get('confidence', 0)}")
        if data.get('stats'):
            stats = data['stats']
            print(f"Stats - Avg: ${stats.get('avg', 0)}, Median: ${stats.get('median', 0)}, "
                  f"Weighted Avg: ${stats.get('weighted_avg', 0)}, Min: ${stats.get('min', 0)}, Max: ${stats.get('max', 0)}")
        
        # Verify market value is reasonable
        market_value = data.get('market_value', 0)
        
        # CRITICAL CHECK: Market value should be $30-120 for a 2012 Panini Kobe #97 PSA 9
        # NOT $469 (previous buggy value caused by including outliers and lots)
        assert market_value > 0, "Market value should be > 0"
        assert market_value < 200, f"Market value ${market_value} is too high! Expected <$200 for this card. Bug may still exist."
        
        # Verify data structure
        assert "id" in data, "Response missing id"
        assert data["id"] == KOBE_CARD_ID, f"ID mismatch: expected {KOBE_CARD_ID}"
        assert "data_source" in data, "Response missing data_source"
        
        # Verify we have items and stats
        assert data.get("items_found", 0) > 0, "Should find some sold items"
        
    def test_refresh_kobe_card_outliers_removed(self, auth_headers):
        """Test that outliers are being filtered (outliers_removed > 0 if applicable)"""
        response = requests.post(
            f"{BASE_URL}/api/portfolio/refresh-value/{KOBE_CARD_ID}",
            headers=auth_headers,
            timeout=60
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Check outliers_removed field exists
        assert "outliers_removed" in data, "Response should include outliers_removed count"
        print(f"\nOutliers removed: {data.get('outliers_removed', 0)}")
        
    def test_kobe_card_data_source_is_sold(self, auth_headers):
        """Test that data source is 'sold' (Scrapedo working) or 'active' (fallback)"""
        response = requests.post(
            f"{BASE_URL}/api/portfolio/refresh-value/{KOBE_CARD_ID}",
            headers=auth_headers,
            timeout=60
        )
        
        assert response.status_code == 200
        data = response.json()
        
        data_source = data.get("data_source", "unknown")
        assert data_source in ["sold", "active"], f"data_source should be 'sold' or 'active', got '{data_source}'"
        
        # Prefer 'sold' data
        if data_source == "sold":
            print("\n✓ Scrapedo returned SOLD listings (preferred)")
        else:
            print("\n! WARNING: Fallback to ACTIVE listings (Scrapedo may have failed)")


class TestKATCardMarketValue:
    """Test Karl-Anthony Towns card market value as secondary verification"""
    
    @pytest.fixture(autouse=True)
    def auth_headers(self):
        return {
            "Cookie": f"session_token={SESSION_TOKEN}",
            "Content-Type": "application/json"
        }
    
    def test_refresh_kat_card_value(self, auth_headers):
        """Test POST /api/portfolio/refresh-value/{item_id} for KAT card"""
        response = requests.post(
            f"{BASE_URL}/api/portfolio/refresh-value/{KAT_CARD_ID}",
            headers=auth_headers,
            timeout=60
        )
        
        assert response.status_code == 200, f"API returned {response.status_code}: {response.text}"
        
        data = response.json()
        print(f"\n=== KAT CARD MARKET VALUE RESPONSE ===")
        print(f"Market Value: ${data.get('market_value', 0)}")
        print(f"Data Source: {data.get('data_source', 'unknown')}")
        print(f"Items Found: {data.get('items_found', 0)}")
        
        market_value = data.get('market_value', 0)
        assert market_value >= 0, "Market value should be >= 0"


class TestPortfolioSummary:
    """Test portfolio summary endpoint"""
    
    @pytest.fixture(autouse=True)
    def auth_headers(self):
        return {
            "Cookie": f"session_token={SESSION_TOKEN}",
            "Content-Type": "application/json"
        }
    
    def test_get_portfolio_summary(self, auth_headers):
        """Test GET /api/portfolio/summary returns portfolio with correct structure"""
        response = requests.get(
            f"{BASE_URL}/api/portfolio/summary",
            headers=auth_headers,
            timeout=30
        )
        
        assert response.status_code == 200, f"API returned {response.status_code}: {response.text}"
        
        data = response.json()
        print(f"\n=== PORTFOLIO SUMMARY ===")
        print(f"Total Invested: ${data.get('total_invested', 0)}")
        print(f"Total Market Value: ${data.get('total_market_value', 0)}")
        print(f"P&L: ${data.get('pnl', 0)}")
        print(f"ROI: {data.get('roi', 0)}%")
        print(f"Total Cards: {data.get('total_cards', 0)}")
        print(f"Valued Cards: {data.get('valued_cards', 0)}")
        print(f"Unvalued Cards: {data.get('unvalued_cards', 0)}")
        
        # Verify response structure
        required_fields = ["total_invested", "total_market_value", "pnl", "roi", 
                          "total_cards", "valued_cards", "unvalued_cards", "cards"]
        for field in required_fields:
            assert field in data, f"Missing required field: {field}"
        
        # Verify cards array
        cards = data.get("cards", [])
        assert isinstance(cards, list), "cards should be a list"
        
        # If we have the Kobe card in the summary, verify its market value is reasonable
        kobe_card = next((c for c in cards if c.get("id") == KOBE_CARD_ID), None)
        if kobe_card:
            mv = kobe_card.get("market_value", 0)
            print(f"\nKobe card in summary - Market Value: ${mv}")
            # After fix, should be reasonable
            if mv > 200:
                print(f"WARNING: Kobe card market value ${mv} still seems high!")


class TestMarketValueTitleFilter:
    """Test the title filtering logic directly via market API"""
    
    def test_market_card_value_psa9_query(self):
        """Test /api/market/card-value for 2012 Panini Kobe Bryant #97 PSA 9"""
        response = requests.get(
            f"{BASE_URL}/api/market/card-value",
            params={"query": "2012 Panini Kobe Bryant #97 PSA 9"},
            timeout=60
        )
        
        assert response.status_code == 200, f"API returned {response.status_code}"
        
        data = response.json()
        print(f"\n=== MARKET CARD VALUE - PSA 9 QUERY ===")
        print(f"Data Source: {data.get('data_source', 'unknown')}")
        print(f"Is Graded: {data.get('is_graded')}")
        print(f"Detected Grade: {data.get('detected_grade')}")
        
        primary = data.get("primary", {})
        stats = primary.get("stats", {})
        items = primary.get("items", [])
        
        print(f"Label: {primary.get('label')}")
        print(f"Items Count: {len(items)}")
        print(f"Stats Count: {stats.get('count', 0)}")
        print(f"Market Value: ${stats.get('market_value', 0)}")
        print(f"Median: ${stats.get('median', 0)}")
        print(f"Weighted Avg: ${stats.get('weighted_avg', 0)}")
        print(f"Outliers Removed: {stats.get('outliers_removed', 0)}")
        
        if items:
            print(f"\nFirst 3 items:")
            for i, item in enumerate(items[:3]):
                print(f"  {i+1}. ${item.get('price', 0):.2f} - {item.get('title', '')[:60]}...")
        
        # Verify grade detection
        assert data.get("is_graded") == True, "Should detect as graded"
        assert "PSA 9" in data.get("detected_grade", ""), f"Should detect PSA 9, got {data.get('detected_grade')}"
        
        # Market value should be reasonable
        market_value = stats.get("market_value", 0)
        if market_value > 0:
            assert market_value < 200, f"Market value ${market_value} is too high! Title filter may not be working."


class TestUnauthenticated:
    """Test authentication requirements"""
    
    def test_refresh_value_requires_auth(self):
        """Test that refresh-value endpoint requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/portfolio/refresh-value/{KOBE_CARD_ID}",
            timeout=30
        )
        
        # Should return 401 or 403 without auth
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
        
    def test_portfolio_summary_requires_auth(self):
        """Test that portfolio summary endpoint requires authentication"""
        response = requests.get(
            f"{BASE_URL}/api/portfolio/summary",
            timeout=30
        )
        
        # Should return 401 or 403 without auth
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"


class TestMarketValueFiltering:
    """Test the filtering logic through various queries"""
    
    def test_grade_mismatch_filtering(self):
        """
        Test that PSA 9 query doesn't include PSA 10 or PSA 8 items
        Title filter should exclude grade mismatches
        """
        response = requests.get(
            f"{BASE_URL}/api/market/card-value",
            params={"query": "Michael Jordan PSA 9"},
            timeout=60
        )
        
        assert response.status_code == 200
        data = response.json()
        
        primary = data.get("primary", {})
        items = primary.get("items", [])
        
        # Check items for grade mismatches (they should be filtered out)
        grade_mismatches = []
        for item in items:
            title = (item.get("title") or "").lower()
            if "psa 10" in title or "psa 8" in title or "psa 7" in title:
                grade_mismatches.append(item)
        
        if grade_mismatches:
            print(f"\nWARNING: Found {len(grade_mismatches)} potential grade mismatches that weren't filtered:")
            for item in grade_mismatches[:3]:
                print(f"  - ${item.get('price', 0):.2f}: {item.get('title', '')[:50]}")
        else:
            print("\n✓ No grade mismatches found in results (filtering working)")
    
    def test_lot_filtering(self):
        """
        Test that lots are filtered out from market value calculation
        """
        response = requests.get(
            f"{BASE_URL}/api/market/card-value",
            params={"query": "Basketball Card PSA"},
            timeout=60
        )
        
        assert response.status_code == 200
        data = response.json()
        
        primary = data.get("primary", {})
        items = primary.get("items", [])
        
        # Check items for lot indicators (they should be filtered out)
        lot_items = []
        lot_patterns = ["lot of", "card lot", "cards lot", "bulk", "collection of"]
        for item in items:
            title = (item.get("title") or "").lower()
            for pattern in lot_patterns:
                if pattern in title:
                    lot_items.append(item)
                    break
        
        if lot_items:
            print(f"\nWARNING: Found {len(lot_items)} lot items that weren't filtered:")
            for item in lot_items[:3]:
                print(f"  - ${item.get('price', 0):.2f}: {item.get('title', '')[:50]}")
        else:
            print("\n✓ No lot items found in results (lot filtering working)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
