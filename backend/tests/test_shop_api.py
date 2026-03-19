"""
Test Public Shop API Endpoint
Tests the /api/shop/{slug} endpoint for:
- Valid shop data retrieval
- Shop info structure (name, location, stats)
- Items array with card details
- Non-existent shop 404 handling
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestPublicShopAPI:
    """Tests for GET /api/shop/{slug} endpoint"""

    def test_get_shop_kobecollector_success(self):
        """Test GET /api/shop/kobecollector returns 200 with correct data"""
        response = requests.get(f"{BASE_URL}/api/shop/kobecollector")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "shop" in data, "Response should contain 'shop' key"
        assert "items" in data, "Response should contain 'items' key"

    def test_shop_info_structure(self):
        """Test shop info has correct structure and values"""
        response = requests.get(f"{BASE_URL}/api/shop/kobecollector")
        data = response.json()
        shop = data["shop"]
        
        # Verify shop info fields
        assert shop["slug"] == "kobecollector", f"Expected slug 'kobecollector', got '{shop['slug']}'"
        assert shop["name"] == "Kobe Collector Cards", f"Expected name 'Kobe Collector Cards', got '{shop['name']}'"
        assert shop["location"] == "Los Angeles, CA", f"Expected location 'Los Angeles, CA', got '{shop['location']}'"
        assert "total_items" in shop, "Shop should have total_items"
        assert "total_value" in shop, "Shop should have total_value"
        assert "sports" in shop, "Shop should have sports list"

    def test_shop_stats_values(self):
        """Test shop stats have correct values"""
        response = requests.get(f"{BASE_URL}/api/shop/kobecollector")
        data = response.json()
        shop = data["shop"]
        
        # Verify stats
        assert shop["total_items"] == 5, f"Expected 5 cards, got {shop['total_items']}"
        assert shop["total_value"] == 470.48, f"Expected $470.48 value, got ${shop['total_value']}"
        assert len(shop["sports"]) == 3, f"Expected 3 sports, got {len(shop['sports'])}"
        assert set(shop["sports"]) == {"Basketball", "Baseball", "Football"}, f"Expected Basketball, Baseball, Football, got {shop['sports']}"

    def test_shop_items_array(self):
        """Test items array has correct count and structure"""
        response = requests.get(f"{BASE_URL}/api/shop/kobecollector")
        data = response.json()
        items = data["items"]
        
        assert len(items) == 5, f"Expected 5 items, got {len(items)}"
        
        # Verify first item structure
        item = items[0]
        required_fields = ["card_name", "player", "sport", "year", "condition", "ebay_item_id", "id"]
        for field in required_fields:
            assert field in item, f"Item missing required field: {field}"

    def test_shop_items_card_data(self):
        """Test specific card data in items"""
        response = requests.get(f"{BASE_URL}/api/shop/kobecollector")
        data = response.json()
        items = data["items"]
        
        # Find LeBron James card
        lebron_card = next((i for i in items if "LeBron" in i.get("player", "")), None)
        assert lebron_card is not None, "LeBron James card not found"
        assert lebron_card["sport"] == "Basketball"
        assert lebron_card["year"] == "2024"
        assert lebron_card["condition"] == "Raw"
        assert lebron_card["ebay_item_id"] == "123456789001"
        
        # Find Shohei Ohtani card  
        ohtani_card = next((i for i in items if "Ohtani" in i.get("player", "")), None)
        assert ohtani_card is not None, "Shohei Ohtani card not found"
        assert ohtani_card["sport"] == "Baseball"
        assert ohtani_card["grading_company"] == "PSA"
        assert ohtani_card["grade"] == "10"
        
        # Find Patrick Mahomes card
        mahomes_card = next((i for i in items if "Mahomes" in i.get("player", "")), None)
        assert mahomes_card is not None, "Patrick Mahomes card not found"
        assert mahomes_card["sport"] == "Football"

    def test_shop_items_have_ebay_ids(self):
        """Test all items have eBay item IDs for buying"""
        response = requests.get(f"{BASE_URL}/api/shop/kobecollector")
        data = response.json()
        items = data["items"]
        
        for item in items:
            assert item.get("ebay_item_id"), f"Item {item.get('card_name')} missing ebay_item_id"
            assert len(item["ebay_item_id"]) > 0, "ebay_item_id should not be empty"

    def test_shop_items_have_prices(self):
        """Test items have listed_price or purchase_price"""
        response = requests.get(f"{BASE_URL}/api/shop/kobecollector")
        data = response.json()
        items = data["items"]
        
        for item in items:
            has_price = item.get("listed_price") or item.get("purchase_price")
            assert has_price, f"Item {item.get('card_name')} has no price"

    def test_shop_not_found_404(self):
        """Test non-existent shop returns 404"""
        response = requests.get(f"{BASE_URL}/api/shop/nonexistent-shop-xyz")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        
        data = response.json()
        assert "detail" in data, "404 response should have detail"
        assert "not found" in data["detail"].lower(), f"Expected 'not found' in detail, got '{data['detail']}'"

    def test_shop_case_insensitive_slug(self):
        """Test shop slug is case-insensitive"""
        # Try uppercase
        response = requests.get(f"{BASE_URL}/api/shop/KOBECOLLECTOR")
        assert response.status_code == 200, f"Uppercase slug should work, got {response.status_code}"
        
        # Try mixed case
        response = requests.get(f"{BASE_URL}/api/shop/KobeCollector")
        assert response.status_code == 200, f"Mixed case slug should work, got {response.status_code}"

    def test_shop_no_user_sensitive_data(self):
        """Test shop response doesn't leak sensitive user data"""
        response = requests.get(f"{BASE_URL}/api/shop/kobecollector")
        data = response.json()
        
        # Check shop doesn't have user_id
        assert "user_id" not in data["shop"], "Shop should not expose user_id"
        
        # Check items don't have user_id
        for item in data["items"]:
            assert "user_id" not in item, f"Item should not expose user_id"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
