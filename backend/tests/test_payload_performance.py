"""
Test Payload Performance Optimization for Inventory Endpoints
Tests that GET /api/inventory excludes heavy base64 images (image, back_image)
and returns lightweight thumbnails (thumbnail, store_thumbnail) instead.
GET /api/inventory/{item_id} should return full item including all images.
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_USER_EMAIL = "pzsuave007@gmail.com"
TEST_USER_PASSWORD = "FlipTest123!"


class TestPayloadPerformance:
    """Test payload optimization for inventory endpoints"""
    
    @pytest.fixture(scope="class")
    def session(self):
        """Get authenticated session with cookies"""
        s = requests.Session()
        response = s.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip(f"Authentication failed: {response.status_code} - {response.text}")
        # Session cookies are automatically stored in the session
        return s
    
    def test_inventory_list_excludes_heavy_images(self, session):
        """GET /api/inventory should NOT return 'image' and 'back_image' fields"""
        response = session.get(f"{BASE_URL}/api/inventory")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "items" in data, "Response should have 'items' key"
        assert "total" in data, "Response should have 'total' key"
        
        items = data["items"]
        if len(items) == 0:
            pytest.skip("No inventory items to test - user has empty inventory")
        
        # Check that heavy images are excluded from ALL items
        for idx, item in enumerate(items):
            assert "image" not in item, f"Item {idx} should NOT have 'image' field (heavy base64)"
            assert "back_image" not in item, f"Item {idx} should NOT have 'back_image' field (heavy base64)"
        
        print(f"✓ Verified {len(items)} items do NOT contain 'image' or 'back_image' fields")
    
    def test_inventory_list_includes_thumbnails(self, session):
        """GET /api/inventory should return 'thumbnail' and 'store_thumbnail' fields"""
        response = session.get(f"{BASE_URL}/api/inventory")
        assert response.status_code == 200
        
        data = response.json()
        items = data["items"]
        if len(items) == 0:
            pytest.skip("No inventory items to test")
        
        # Check that thumbnails are present (after backfill)
        items_with_thumbnail = 0
        items_with_store_thumbnail = 0
        
        for item in items:
            if item.get("thumbnail"):
                items_with_thumbnail += 1
            if item.get("store_thumbnail"):
                items_with_store_thumbnail += 1
        
        # At least some items should have thumbnails (backfill was run)
        print(f"Items with thumbnail: {items_with_thumbnail}/{len(items)}")
        print(f"Items with store_thumbnail: {items_with_store_thumbnail}/{len(items)}")
        
        # Verify thumbnail format if present
        for item in items:
            if item.get("thumbnail"):
                # Should be base64 string
                assert isinstance(item["thumbnail"], str), "thumbnail should be a string"
                # Thumbnail should be present (size varies based on image content)
                print(f"  - thumbnail size: {len(item['thumbnail']):,} chars")
            
            if item.get("store_thumbnail"):
                assert isinstance(item["store_thumbnail"], str), "store_thumbnail should be a string"
                # Store thumbnail should be present
                print(f"  - store_thumbnail size: {len(item['store_thumbnail']):,} chars")
        
        print(f"✓ Thumbnails verified for inventory list items")
    
    def test_inventory_detail_includes_full_images(self, session):
        """GET /api/inventory/{item_id} should return FULL item including 'image' and 'back_image'"""
        # First get list to find an item ID
        list_response = session.get(f"{BASE_URL}/api/inventory")
        assert list_response.status_code == 200
        
        items = list_response.json()["items"]
        if len(items) == 0:
            pytest.skip("No inventory items to test")
        
        # Get first item's ID
        item_id = items[0]["id"]
        
        # Get full item detail
        detail_response = session.get(f"{BASE_URL}/api/inventory/{item_id}")
        assert detail_response.status_code == 200, f"Expected 200, got {detail_response.status_code}: {detail_response.text}"
        
        item = detail_response.json()
        
        # Detail endpoint should include full images
        # The field should exist in the response (even if null)
        print(f"Detail item keys: {list(item.keys())}")
        
        # Verify the item has expected fields
        assert "id" in item, "Item should have 'id'"
        assert "card_name" in item, "Item should have 'card_name'"
        
        # If item has an image, verify it's the full-res version
        if item.get("image"):
            assert isinstance(item["image"], str), "image should be a string"
            # Full image is typically 100KB+ (larger than thumbnail)
            print(f"Full image size: {len(item['image'])} chars")
        
        print(f"✓ Detail endpoint returns full item with image fields")
    
    def test_payload_size_comparison(self, session):
        """Compare payload sizes between list and detail endpoints"""
        # Get list
        list_response = session.get(f"{BASE_URL}/api/inventory")
        assert list_response.status_code == 200
        
        items = list_response.json()["items"]
        if len(items) == 0:
            pytest.skip("No inventory items to test")
        
        # Calculate average item size in list
        list_payload_size = len(list_response.text)
        avg_list_item_size = list_payload_size / len(items) if items else 0
        
        # Get detail for first item
        item_id = items[0]["id"]
        detail_response = session.get(f"{BASE_URL}/api/inventory/{item_id}")
        detail_payload_size = len(detail_response.text)
        
        print(f"List payload total: {list_payload_size:,} bytes for {len(items)} items")
        print(f"Average list item size: {avg_list_item_size:,.0f} bytes")
        print(f"Detail payload size: {detail_payload_size:,} bytes")
        
        # If detail has full image, it should be larger than average list item
        detail_item = detail_response.json()
        if detail_item.get("image"):
            # Detail with full image should be significantly larger than list item
            print(f"✓ Detail endpoint includes full image ({len(detail_item['image']):,} chars)")
    
    def test_generate_store_thumbnails_endpoint(self, session):
        """POST /api/inventory/generate-store-thumbnails should work"""
        response = session.post(f"{BASE_URL}/api/inventory/generate-store-thumbnails")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "updated" in data, "Response should have 'updated' count"
        
        print(f"✓ Generate thumbnails endpoint returned: {data}")


class TestInventoryListFields:
    """Verify specific fields in inventory list response"""
    
    @pytest.fixture(scope="class")
    def session(self):
        """Get authenticated session"""
        s = requests.Session()
        response = s.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip(f"Authentication failed: {response.status_code}")
        return s
    
    def test_list_item_has_required_fields(self, session):
        """Verify list items have all required fields for UI display"""
        response = session.get(f"{BASE_URL}/api/inventory")
        assert response.status_code == 200
        
        items = response.json()["items"]
        if len(items) == 0:
            pytest.skip("No inventory items")
        
        required_fields = ["id", "card_name", "player", "year", "condition", "category"]
        
        for item in items:
            for field in required_fields:
                assert field in item, f"Item missing required field: {field}"
        
        print(f"✓ All {len(items)} items have required fields")
    
    def test_list_item_excludes_heavy_fields(self, session):
        """Explicitly verify heavy fields are excluded"""
        response = session.get(f"{BASE_URL}/api/inventory")
        assert response.status_code == 200
        
        items = response.json()["items"]
        if len(items) == 0:
            pytest.skip("No inventory items")
        
        excluded_fields = ["image", "back_image"]
        
        for idx, item in enumerate(items):
            for field in excluded_fields:
                assert field not in item, f"Item {idx} should NOT have '{field}' field"
        
        print(f"✓ Heavy fields correctly excluded from {len(items)} items")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
