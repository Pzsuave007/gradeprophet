"""
Tests for eBay Listings Module (Module 5)
- /api/ebay/sell/preview - Generate listing preview from inventory item
- /api/ebay/sell/created-listings - Get listings created through the app
- /api/ebay/seller/my-listings - Get seller's active and sold listings
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestEbayListingsModule:
    """Tests for eBay Listings endpoints"""
    
    def test_get_my_listings_returns_active_and_sold(self):
        """Test /api/ebay/seller/my-listings returns active and sold listings"""
        response = requests.get(f"{BASE_URL}/api/ebay/seller/my-listings?limit=50")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Validate response structure
        assert "active" in data, "Response should contain 'active' key"
        assert "sold" in data, "Response should contain 'sold' key"
        assert "active_total" in data, "Response should contain 'active_total' key"
        assert "sold_total" in data, "Response should contain 'sold_total' key"
        
        # Validate data types
        assert isinstance(data["active"], list), "active should be a list"
        assert isinstance(data["sold"], list), "sold should be a list"
        assert isinstance(data["active_total"], int), "active_total should be an int"
        assert isinstance(data["sold_total"], int), "sold_total should be an int"
        
        # Check active listings have expected fields
        if len(data["active"]) > 0:
            item = data["active"][0]
            expected_fields = ["item_id", "title", "price"]
            for field in expected_fields:
                assert field in item, f"Active listing should have '{field}' field"
        
        print(f"Active: {data['active_total']}, Sold: {data['sold_total']}")
    
    def test_get_created_listings(self):
        """Test /api/ebay/sell/created-listings returns listings array"""
        response = requests.get(f"{BASE_URL}/api/ebay/sell/created-listings")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "listings" in data, "Response should contain 'listings' key"
        assert "total" in data, "Response should contain 'total' key"
        assert isinstance(data["listings"], list), "listings should be a list"
        assert isinstance(data["total"], int), "total should be an int"
        
        print(f"Created listings: {data['total']}")
    
    def test_get_inventory_items(self):
        """Test /api/inventory returns items"""
        response = requests.get(f"{BASE_URL}/api/inventory?limit=200")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "items" in data, "Response should contain 'items' key"
        assert "total" in data, "Response should contain 'total' key"
        assert isinstance(data["items"], list), "items should be a list"
        
        print(f"Inventory items: {len(data['items'])}")
        return data["items"]
    
    def test_preview_ebay_listing_with_valid_inventory_item(self):
        """Test /api/ebay/sell/preview generates title and description"""
        # First get an inventory item
        inv_response = requests.get(f"{BASE_URL}/api/inventory?limit=10")
        assert inv_response.status_code == 200
        items = inv_response.json().get("items", [])
        
        if not items:
            pytest.skip("No inventory items available to test preview")
        
        item = items[0]
        item_id = item.get("id")
        
        # Call preview endpoint
        response = requests.post(
            f"{BASE_URL}/api/ebay/sell/preview",
            json={"inventory_item_id": item_id}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Validate response structure
        assert "title" in data, "Response should contain 'title'"
        assert "description" in data, "Response should contain 'description'"
        assert "condition_id" in data, "Response should contain 'condition_id'"
        assert "suggested_price" in data, "Response should contain 'suggested_price'"
        
        # Validate data types
        assert isinstance(data["title"], str), "title should be a string"
        assert len(data["title"]) > 0, "title should not be empty"
        assert len(data["title"]) <= 80, "title should be max 80 chars"
        assert isinstance(data["description"], str), "description should be a string"
        assert isinstance(data["condition_id"], int), "condition_id should be an int"
        assert isinstance(data["suggested_price"], (int, float)), "suggested_price should be numeric"
        
        print(f"Generated title: {data['title'][:60]}...")
        print(f"Suggested price: ${data['suggested_price']}")
    
    def test_preview_ebay_listing_invalid_item(self):
        """Test /api/ebay/sell/preview with non-existent item returns 404"""
        response = requests.post(
            f"{BASE_URL}/api/ebay/sell/preview",
            json={"inventory_item_id": "non-existent-id-12345"}
        )
        assert response.status_code == 404, f"Expected 404 for non-existent item, got {response.status_code}"
    
    def test_my_listings_active_item_structure(self):
        """Test active listings have required fields for UI display"""
        response = requests.get(f"{BASE_URL}/api/ebay/seller/my-listings?limit=10")
        assert response.status_code == 200
        
        data = response.json()
        if len(data["active"]) == 0:
            pytest.skip("No active listings to verify structure")
        
        item = data["active"][0]
        # Fields needed for grid/list view UI
        expected_fields = ["item_id", "title", "price"]
        for field in expected_fields:
            assert field in item, f"Active listing missing '{field}' field"
        
        # Check listing_type for BIN/Auction badge
        if "listing_type" in item:
            assert item["listing_type"] in ["FixedPriceItem", "Chinese", "Auction", None], f"Unexpected listing type: {item.get('listing_type')}"
        
        print(f"First active listing: {item.get('title', 'N/A')[:40]}... @ ${item.get('price', 'N/A')}")
    
    def test_my_listings_sold_item_structure(self):
        """Test sold listings have required fields for UI display"""
        response = requests.get(f"{BASE_URL}/api/ebay/seller/my-listings?limit=50")
        assert response.status_code == 200
        
        data = response.json()
        if len(data["sold"]) == 0:
            pytest.skip("No sold listings to verify structure")
        
        item = data["sold"][0]
        # Fields needed for sold items view
        assert "title" in item, "Sold listing should have 'title'"
        assert "price" in item, "Sold listing should have 'price'"
        
        print(f"First sold listing: {item.get('title', 'N/A')[:40]}...")


class TestInventoryListedFlag:
    """Tests for inventory 'listed' flag on eBay"""
    
    def test_inventory_items_have_listed_field(self):
        """Test inventory items have 'listed' field for badge display"""
        response = requests.get(f"{BASE_URL}/api/inventory?limit=50")
        assert response.status_code == 200
        
        items = response.json().get("items", [])
        if not items:
            pytest.skip("No inventory items to check")
        
        # All items should have listed field (even if false)
        for item in items[:5]:  # Check first 5
            # listed field may be missing (defaults to false) or boolean
            listed = item.get("listed", False)
            assert isinstance(listed, bool), f"listed should be boolean, got {type(listed)}"
        
        listed_count = sum(1 for i in items if i.get("listed", False))
        print(f"Listed items: {listed_count}/{len(items)}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
