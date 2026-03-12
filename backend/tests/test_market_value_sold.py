"""
Test suite for Market Value API - Sold Data Feature
Tests the /api/market/card-value endpoint which uses Jina Reader API
to scrape eBay sold/completed listings
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestMarketValueSoldData:
    """Test that market value endpoint returns real sold data"""
    
    def test_graded_card_returns_sold_data(self):
        """Test PSA 10 query returns sold data with date_sold fields"""
        response = requests.get(
            f"{BASE_URL}/api/market/card-value",
            params={"query": "2023 Topps Chrome Mike Trout PSA 10"},
            timeout=30
        )
        
        # Status code check
        assert response.status_code == 200, f"API returned {response.status_code}"
        
        data = response.json()
        
        # Verify data structure
        assert "data_source" in data, "Response missing data_source field"
        assert data["data_source"] == "sold", f"Expected data_source='sold', got '{data.get('data_source')}'"
        
        # Verify grade detection
        assert data.get("is_graded") == True, "Should detect graded card"
        assert data.get("detected_grade") == "PSA 10", f"Should detect PSA 10, got {data.get('detected_grade')}"
        
        # Verify primary items have sold data
        primary = data.get("primary", {})
        assert primary.get("label") == "PSA 10", f"Primary label should be PSA 10, got {primary.get('label')}"
        
        primary_items = primary.get("items", [])
        if len(primary_items) > 0:
            item = primary_items[0]
            assert "date_sold" in item, "Item missing date_sold field"
            assert item.get("source") == "sold", f"Item source should be 'sold', got {item.get('source')}"
            assert item.get("date_sold") != "", "date_sold should not be empty for sold items"
        
        # Verify stats
        stats = primary.get("stats", {})
        assert stats.get("count", 0) > 0, "Should have at least 1 sold item"
        
    def test_ungraded_card_returns_sold_data(self):
        """Test ungraded card query returns sold data with date_sold fields"""
        response = requests.get(
            f"{BASE_URL}/api/market/card-value",
            params={"query": "Mike Trout Topps Chrome 2023"},
            timeout=30
        )
        
        assert response.status_code == 200
        
        data = response.json()
        
        # Verify data structure
        assert data.get("data_source") == "sold", f"Expected data_source='sold', got '{data.get('data_source')}'"
        assert data.get("is_graded") == False, "Should not detect as graded"
        
        # Verify primary is Raw/Ungraded for ungraded queries
        primary = data.get("primary", {})
        assert "Raw" in primary.get("label", "") or "Ungraded" in primary.get("label", ""), \
            f"Primary label should be Raw/Ungraded for ungraded query, got {primary.get('label')}"
        
        # Verify items have sold data
        primary_items = primary.get("items", [])
        if len(primary_items) > 0:
            item = primary_items[0]
            assert item.get("source") == "sold", f"Item source should be 'sold', got {item.get('source')}"
    
    def test_grade_detection_psa(self):
        """Test PSA grade detection in query"""
        response = requests.get(
            f"{BASE_URL}/api/market/card-value",
            params={"query": "Luka Doncic Prizm Silver PSA 9"},
            timeout=30
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("is_graded") == True
        assert "PSA 9" in data.get("detected_grade", ""), f"Should detect PSA 9, got {data.get('detected_grade')}"
        
        # Primary should be same grade (PSA 9)
        primary = data.get("primary", {})
        assert "PSA 9" in primary.get("label", ""), f"Primary label should contain PSA 9, got {primary.get('label')}"
        
    def test_secondary_comparison_for_graded(self):
        """Test that graded cards show Raw/Ungraded comparison"""
        response = requests.get(
            f"{BASE_URL}/api/market/card-value",
            params={"query": "Jordan Fleer PSA 10"},
            timeout=30
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Secondary should be Raw/Ungraded for graded queries
        secondary = data.get("secondary", {})
        assert "Raw" in secondary.get("label", "") or "Ungraded" in secondary.get("label", ""), \
            f"Secondary label should be Raw/Ungraded, got {secondary.get('label')}"
            
    def test_secondary_comparison_for_ungraded(self):
        """Test that ungraded cards show PSA 10 potential value"""
        response = requests.get(
            f"{BASE_URL}/api/market/card-value",
            params={"query": "Ja Morant Prizm Silver"},
            timeout=30
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Secondary should be PSA 10 for ungraded queries
        secondary = data.get("secondary", {})
        assert "PSA 10" in secondary.get("label", ""), \
            f"Secondary label should contain PSA 10, got {secondary.get('label')}"
            
    def test_response_structure(self):
        """Test full response structure"""
        response = requests.get(
            f"{BASE_URL}/api/market/card-value",
            params={"query": "Topps Chrome"},
            timeout=30
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Required top-level fields
        required_fields = ["query", "is_graded", "data_source", "primary", "secondary"]
        for field in required_fields:
            assert field in data, f"Missing required field: {field}"
        
        # Primary structure
        primary = data.get("primary", {})
        assert "label" in primary, "Primary missing label"
        assert "items" in primary, "Primary missing items"
        assert "stats" in primary, "Primary missing stats"
        
        # Stats structure  
        stats = primary.get("stats", {})
        if stats.get("count", 0) > 0:
            stats_fields = ["count", "avg", "median", "min", "max"]
            for field in stats_fields:
                assert field in stats, f"Stats missing field: {field}"
                
    def test_item_structure(self):
        """Test individual item structure in response"""
        response = requests.get(
            f"{BASE_URL}/api/market/card-value",
            params={"query": "Baseball Card"},
            timeout=30
        )
        
        assert response.status_code == 200
        data = response.json()
        
        items = data.get("primary", {}).get("items", [])
        if len(items) > 0:
            item = items[0]
            # Required item fields
            item_fields = ["title", "price", "date_sold", "source"]
            for field in item_fields:
                assert field in item, f"Item missing field: {field}"
            
            assert isinstance(item.get("price"), (int, float)), "Price should be numeric"
            assert item.get("source") in ["sold", "active"], f"Source should be 'sold' or 'active', got {item.get('source')}"


class TestMarketValueEdgeCases:
    """Test edge cases for market value endpoint"""
    
    def test_empty_query(self):
        """Test behavior with minimal query"""
        response = requests.get(
            f"{BASE_URL}/api/market/card-value",
            params={"query": "x"},
            timeout=30
        )
        
        # Should not error, just return minimal data
        assert response.status_code == 200
        
    def test_special_characters_in_query(self):
        """Test query with special characters"""
        response = requests.get(
            f"{BASE_URL}/api/market/card-value",
            params={"query": "Kobe Bryant #138"},
            timeout=30
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "primary" in data
