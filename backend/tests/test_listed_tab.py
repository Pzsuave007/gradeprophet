"""
Test file for the Listed Tab feature in Inventory.
Tests the 4 tabs (All, Collection, For Sale, Listed) and filtering logic.
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://ebay-upload-fix.preview.emergentagent.com').rstrip('/')


class TestInventoryTabs:
    """Tests for the 4 inventory tabs: All, Collection, For Sale, Listed"""

    def test_inventory_endpoint_exists(self):
        """Test that the inventory endpoint is accessible"""
        response = requests.get(f"{BASE_URL}/api/inventory")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "items" in data
        assert "total" in data
        print(f"✓ Inventory endpoint returns {data['total']} items")

    def test_inventory_stats_endpoint(self):
        """Test that inventory stats endpoint returns expected fields"""
        response = requests.get(f"{BASE_URL}/api/inventory/stats")
        assert response.status_code == 200
        data = response.json()
        
        # Verify all expected fields are present
        required_fields = [
            "total_cards", "graded", "raw", "listed", "not_listed",
            "collection_count", "for_sale_count", "total_invested"
        ]
        for field in required_fields:
            assert field in data, f"Missing field: {field}"
        
        print(f"✓ Stats: total={data['total_cards']}, listed={data['listed']}, collection={data['collection_count']}, for_sale={data['for_sale_count']}")

    def test_listed_filter_returns_only_listed_items(self):
        """Test that listed=true filter returns only listed items"""
        response = requests.get(f"{BASE_URL}/api/inventory?listed=true")
        assert response.status_code == 200
        data = response.json()
        
        # All items should have listed=True
        for item in data["items"]:
            assert item.get("listed") == True, f"Item {item.get('id')} should be listed"
        
        print(f"✓ Listed filter returned {len(data['items'])} listed items")

    def test_collection_filter_excludes_listed_items(self):
        """Test that collection filter with listed=false excludes listed items"""
        response = requests.get(f"{BASE_URL}/api/inventory?category=collection&listed=false")
        assert response.status_code == 200
        data = response.json()
        
        # All items should be collection and not listed
        for item in data["items"]:
            assert item.get("category") == "collection", f"Item should be in collection"
            assert item.get("listed") != True, f"Item should not be listed"
        
        print(f"✓ Collection filter (non-listed) returned {len(data['items'])} items")

    def test_for_sale_filter_excludes_listed_items(self):
        """Test that for_sale filter with listed=false excludes listed items"""
        response = requests.get(f"{BASE_URL}/api/inventory?category=for_sale&listed=false")
        assert response.status_code == 200
        data = response.json()
        
        # All items should be for_sale and not listed
        for item in data["items"]:
            assert item.get("category") == "for_sale", f"Item should be for_sale"
            assert item.get("listed") != True, f"Item should not be listed"
        
        print(f"✓ For Sale filter (non-listed) returned {len(data['items'])} items")

    def test_all_tab_returns_all_items(self):
        """Test that no filter returns all items"""
        response = requests.get(f"{BASE_URL}/api/inventory?limit=50")
        assert response.status_code == 200
        data = response.json()
        
        stats_response = requests.get(f"{BASE_URL}/api/inventory/stats")
        stats = stats_response.json()
        
        assert data["total"] == stats["total_cards"], "All tab should show total_cards count"
        print(f"✓ All tab returned {data['total']} items matching stats total_cards")


class TestStatsAccuracy:
    """Tests for accurate stats counting"""

    def test_stats_counts_are_accurate(self):
        """Test that stats counts match actual filtered data"""
        stats = requests.get(f"{BASE_URL}/api/inventory/stats").json()
        
        # Test listed count
        listed_items = requests.get(f"{BASE_URL}/api/inventory?listed=true").json()
        assert len(listed_items["items"]) == stats["listed"], f"Listed count mismatch: API={len(listed_items['items'])}, stats={stats['listed']}"
        
        # Test collection count (non-listed)
        collection_items = requests.get(f"{BASE_URL}/api/inventory?category=collection&listed=false").json()
        assert len(collection_items["items"]) == stats["collection_count"], f"Collection count mismatch"
        
        # Test for_sale count (non-listed)
        for_sale_items = requests.get(f"{BASE_URL}/api/inventory?category=for_sale&listed=false").json()
        assert len(for_sale_items["items"]) == stats["for_sale_count"], f"For Sale count mismatch"
        
        print(f"✓ All stats counts are accurate")

    def test_total_cards_equals_sum_of_parts(self):
        """Test that total equals listed + collection + for_sale"""
        stats = requests.get(f"{BASE_URL}/api/inventory/stats").json()
        
        # Total should equal: listed + collection_count + for_sale_count
        calculated_total = stats["listed"] + stats["collection_count"] + stats["for_sale_count"]
        assert stats["total_cards"] == calculated_total, f"Total mismatch: {stats['total_cards']} != {calculated_total}"
        
        print(f"✓ total_cards ({stats['total_cards']}) = listed ({stats['listed']}) + collection ({stats['collection_count']}) + for_sale ({stats['for_sale_count']})")


class TestListedCardFields:
    """Tests for listed card data structure"""

    def test_listed_cards_have_required_fields(self):
        """Test that listed cards have the necessary fields"""
        response = requests.get(f"{BASE_URL}/api/inventory?listed=true")
        assert response.status_code == 200
        data = response.json()
        
        if len(data["items"]) > 0:
            item = data["items"][0]
            assert item.get("listed") == True
            assert "id" in item
            assert "card_name" in item
            print(f"✓ Listed item has required fields: id={item['id']}, card_name={item['card_name']}")
        else:
            print("⚠ No listed items to test")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
