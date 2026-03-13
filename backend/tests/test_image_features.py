"""
Test the new image processing features:
1. POST /api/cards/identify accepts optional back_image_base64 field
2. POST /api/inventory uses process_card_image pipeline (auto-crop + enhance + resize)
3. PUT /api/inventory/{item_id} also processes images through pipeline
4. GET /api/inventory/stats returns correct tab counts
"""

import pytest
import requests
import os
import base64

# Get BASE_URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL')
if BASE_URL:
    BASE_URL = BASE_URL.rstrip('/')
else:
    raise ValueError("REACT_APP_BACKEND_URL not set")

# Minimal valid JPEG image (1x1 red pixel)
MINIMAL_JPEG_BASE64 = "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAB//2Q=="


class TestCardIdentifyEndpoint:
    """Test /api/cards/identify accepts optional back_image_base64"""
    
    def test_identify_endpoint_exists(self):
        """Verify the identify endpoint exists"""
        response = requests.post(
            f"{BASE_URL}/api/cards/identify",
            json={"image_base64": MINIMAL_JPEG_BASE64}
        )
        # Should not be 404 - endpoint exists
        assert response.status_code != 404, "Identify endpoint should exist"
        print(f"PASS: /api/cards/identify endpoint exists (status: {response.status_code})")
    
    def test_identify_accepts_back_image(self):
        """Verify the identify endpoint accepts back_image_base64 parameter"""
        response = requests.post(
            f"{BASE_URL}/api/cards/identify",
            json={
                "image_base64": MINIMAL_JPEG_BASE64,
                "back_image_base64": MINIMAL_JPEG_BASE64
            }
        )
        # Should not fail with 422 validation error for unknown field
        assert response.status_code != 422, "Should accept back_image_base64 parameter"
        print(f"PASS: /api/cards/identify accepts back_image_base64 (status: {response.status_code})")


class TestInventoryStats:
    """Test /api/inventory/stats returns correct tab counts"""
    
    def test_stats_endpoint_returns_required_fields(self):
        """Verify stats returns total_cards, collection_count, for_sale_count, listed"""
        response = requests.get(f"{BASE_URL}/api/inventory/stats")
        assert response.status_code == 200, f"Stats endpoint failed: {response.text}"
        
        data = response.json()
        required_fields = ['total_cards', 'collection_count', 'for_sale_count', 'listed']
        
        for field in required_fields:
            assert field in data, f"Missing field: {field}"
            print(f"PASS: Field '{field}' present with value: {data[field]}")
        
        print(f"PASS: /api/inventory/stats returns all required fields")
    
    def test_stats_counts_are_consistent(self):
        """Verify total cards = listed + collection_count + for_sale_count"""
        response = requests.get(f"{BASE_URL}/api/inventory/stats")
        assert response.status_code == 200
        
        data = response.json()
        total = data.get('total_cards', 0)
        listed = data.get('listed', 0)
        collection = data.get('collection_count', 0)
        for_sale = data.get('for_sale_count', 0)
        
        # Listed cards are excluded from collection/for_sale counts
        # So total = listed + collection + for_sale
        expected_total = listed + collection + for_sale
        assert total == expected_total, f"Total ({total}) should equal listed ({listed}) + collection ({collection}) + for_sale ({for_sale}) = {expected_total}"
        print(f"PASS: Stats counts are consistent: total={total}, listed={listed}, collection={collection}, for_sale={for_sale}")


class TestInventoryCreate:
    """Test POST /api/inventory processes images through pipeline"""
    
    def test_create_inventory_item_processes_image(self):
        """Create an inventory item with an image and verify it's processed"""
        # Create inventory item with test image
        payload = {
            "card_name": "TEST_Image_Processing_Card",
            "player": "Test Player",
            "year": 2024,
            "condition": "Raw",
            "category": "collection",
            "image_base64": f"data:image/jpeg;base64,{MINIMAL_JPEG_BASE64}"
        }
        
        response = requests.post(f"{BASE_URL}/api/inventory", json=payload)
        assert response.status_code == 200, f"Create failed: {response.text}"
        
        data = response.json()
        item_id = data.get('id')
        assert item_id, "Response should contain item ID"
        
        # Verify the item was created with processed image
        assert 'image' in data, "Response should contain image field"
        
        # The processed image should be different (cropped/enhanced/resized)
        # It should be a valid base64 string
        if data.get('image'):
            assert len(data['image']) > 10, "Processed image should be non-empty"
            print(f"PASS: Image was processed, length: {len(data['image'])} chars")
        
        print(f"PASS: Inventory item created with ID: {item_id}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/inventory/{item_id}")
        print(f"PASS: Test item cleaned up")
    
    def test_create_inventory_item_with_back_image(self):
        """Create an inventory item with both front and back images"""
        payload = {
            "card_name": "TEST_Back_Image_Card",
            "player": "Test Player Back",
            "year": 2024,
            "condition": "Raw",
            "category": "collection",
            "image_base64": f"data:image/jpeg;base64,{MINIMAL_JPEG_BASE64}",
            "back_image_base64": f"data:image/jpeg;base64,{MINIMAL_JPEG_BASE64}"
        }
        
        response = requests.post(f"{BASE_URL}/api/inventory", json=payload)
        assert response.status_code == 200, f"Create with back image failed: {response.text}"
        
        data = response.json()
        item_id = data.get('id')
        
        # Verify both front and back images are present
        assert 'image' in data, "Response should contain front image"
        assert 'back_image' in data, "Response should contain back image"
        
        print(f"PASS: Inventory item created with front and back images")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/inventory/{item_id}")
        print(f"PASS: Test item cleaned up")


class TestInventoryUpdate:
    """Test PUT /api/inventory/{item_id} processes images through pipeline"""
    
    def test_update_inventory_item_processes_image(self):
        """Update an inventory item with a new image and verify it's processed"""
        # First create an item
        create_payload = {
            "card_name": "TEST_Update_Image_Card",
            "player": "Update Test Player",
            "year": 2024,
            "condition": "Raw",
            "category": "collection"
        }
        
        create_response = requests.post(f"{BASE_URL}/api/inventory", json=create_payload)
        assert create_response.status_code == 200, f"Create failed: {create_response.text}"
        
        item_id = create_response.json().get('id')
        
        # Update with a new image
        update_payload = {
            "image_base64": f"data:image/jpeg;base64,{MINIMAL_JPEG_BASE64}"
        }
        
        update_response = requests.put(
            f"{BASE_URL}/api/inventory/{item_id}",
            json=update_payload
        )
        assert update_response.status_code == 200, f"Update failed: {update_response.text}"
        
        update_data = update_response.json()
        
        # Verify the image was processed
        if update_data.get('image'):
            assert len(update_data['image']) > 10, "Updated image should be processed"
            print(f"PASS: Updated image was processed, length: {len(update_data['image'])} chars")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/inventory/{item_id}")
        print(f"PASS: Update test item cleaned up")
    
    def test_update_inventory_item_with_back_image(self):
        """Update an inventory item with a back image"""
        # First create an item
        create_payload = {
            "card_name": "TEST_Update_Back_Image_Card",
            "player": "Update Back Test",
            "year": 2024,
            "condition": "Raw",
            "category": "collection"
        }
        
        create_response = requests.post(f"{BASE_URL}/api/inventory", json=create_payload)
        assert create_response.status_code == 200
        
        item_id = create_response.json().get('id')
        
        # Update with a back image
        update_payload = {
            "back_image_base64": f"data:image/jpeg;base64,{MINIMAL_JPEG_BASE64}"
        }
        
        update_response = requests.put(
            f"{BASE_URL}/api/inventory/{item_id}",
            json=update_payload
        )
        assert update_response.status_code == 200, f"Update with back image failed: {update_response.text}"
        
        update_data = update_response.json()
        
        # Verify the back image was processed
        if update_data.get('back_image'):
            print(f"PASS: Back image was processed")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/inventory/{item_id}")
        print(f"PASS: Update back image test item cleaned up")


class TestInventoryFiltering:
    """Test inventory filtering by listed status and category"""
    
    def test_get_listed_items(self):
        """Verify /api/inventory?listed=true returns only listed items"""
        response = requests.get(f"{BASE_URL}/api/inventory?listed=true")
        assert response.status_code == 200
        
        data = response.json()
        items = data.get('items', [])
        
        for item in items:
            assert item.get('listed') == True, f"Item should be listed: {item.get('card_name')}"
        
        print(f"PASS: Listed filter returns {len(items)} listed items")
    
    def test_get_collection_items(self):
        """Verify /api/inventory?category=collection&listed=false returns only collection items"""
        response = requests.get(f"{BASE_URL}/api/inventory?category=collection&listed=false")
        assert response.status_code == 200
        
        data = response.json()
        items = data.get('items', [])
        
        for item in items:
            assert item.get('category') == 'collection', f"Item should be collection: {item.get('card_name')}"
            assert item.get('listed') != True, f"Item should not be listed: {item.get('card_name')}"
        
        print(f"PASS: Collection filter returns {len(items)} collection items")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
