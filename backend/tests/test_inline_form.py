"""
Tests for the new inline card form features:
1. POST /api/cards/identify - AI card identification
2. GET /api/inventory - Inventory list
3. POST /api/inventory - Create new inventory item
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestInventoryEndpoints:
    """Test inventory CRUD operations"""
    
    def test_get_inventory_returns_items(self):
        """GET /api/inventory returns list of inventory items"""
        response = requests.get(f"{BASE_URL}/api/inventory")
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data
        assert isinstance(data["items"], list)
        print(f"PASS: GET /api/inventory returned {data['total']} items")
    
    def test_inventory_item_has_required_fields(self):
        """Inventory items have required fields"""
        response = requests.get(f"{BASE_URL}/api/inventory")
        assert response.status_code == 200
        data = response.json()
        if data["total"] > 0:
            item = data["items"][0]
            assert "id" in item
            assert "card_name" in item
            assert "condition" in item
            print(f"PASS: Inventory item has required fields: {item['card_name']}")
        else:
            print("SKIP: No inventory items to validate")
    
    def test_create_inventory_item(self):
        """POST /api/inventory creates a new card"""
        payload = {
            "card_name": "TEST_2026 Test Card",
            "player": "Test Player",
            "year": 2026,
            "set_name": "Test Set",
            "card_number": "T001",
            "variation": None,
            "condition": "Raw",
            "grading_company": None,
            "grade": None,
            "purchase_price": 10.00,
            "quantity": 1,
            "notes": "Test card for automation",
            "category": "collection"
        }
        response = requests.post(f"{BASE_URL}/api/inventory", json=payload)
        assert response.status_code == 200 or response.status_code == 201
        data = response.json()
        assert "id" in data
        assert data["card_name"] == payload["card_name"]
        print(f"PASS: Created inventory item with id={data['id']}")
        
        # Cleanup
        delete_response = requests.delete(f"{BASE_URL}/api/inventory/{data['id']}")
        assert delete_response.status_code in [200, 204]
        print(f"PASS: Cleaned up test item {data['id']}")
    
    def test_create_inventory_item_minimal(self):
        """POST /api/inventory with minimal fields (just card_name)"""
        payload = {
            "card_name": "TEST_Minimal Card 2026"
        }
        response = requests.post(f"{BASE_URL}/api/inventory", json=payload)
        assert response.status_code == 200 or response.status_code == 201
        data = response.json()
        assert "id" in data
        assert data["card_name"] == payload["card_name"]
        print(f"PASS: Created minimal inventory item with id={data['id']}")
        
        # Verify it persisted
        get_response = requests.get(f"{BASE_URL}/api/inventory/{data['id']}")
        assert get_response.status_code == 200
        fetched = get_response.json()
        assert fetched["card_name"] == payload["card_name"]
        print(f"PASS: Verified item persistence")
        
        # Cleanup
        delete_response = requests.delete(f"{BASE_URL}/api/inventory/{data['id']}")
        assert delete_response.status_code in [200, 204]
        print(f"PASS: Cleaned up test item")


class TestCardIdentifyEndpoint:
    """Test the AI card identification endpoint"""
    
    def test_identify_endpoint_exists(self):
        """POST /api/cards/identify endpoint is available"""
        # Test with empty payload to verify endpoint exists
        response = requests.post(f"{BASE_URL}/api/cards/identify", json={})
        # Should get 422 (validation error) not 404
        assert response.status_code in [422, 400, 500]  # Endpoint exists, just bad input
        print(f"PASS: /api/cards/identify endpoint exists (got {response.status_code})")
    
    def test_identify_with_inventory_image(self):
        """POST /api/cards/identify with image from existing inventory item"""
        # First get an inventory item with an image
        inv_response = requests.get(f"{BASE_URL}/api/inventory")
        assert inv_response.status_code == 200
        items = inv_response.json()["items"]
        
        item_with_image = None
        for item in items:
            if item.get("image"):
                item_with_image = item
                break
        
        if not item_with_image:
            pytest.skip("No inventory items with images found")
        
        # Use the image for identification
        image_base64 = item_with_image["image"]
        # Add data URL prefix if needed
        if not image_base64.startswith("data:"):
            image_base64 = f"data:image/jpeg;base64,{image_base64}"
        
        payload = {"image_base64": image_base64}
        response = requests.post(f"{BASE_URL}/api/cards/identify", json=payload, timeout=60)
        
        assert response.status_code == 200
        data = response.json()
        
        # Check response has expected fields
        if "error" not in data:
            assert "card_name" in data or "player" in data or "year" in data
            print(f"PASS: Card identified - {data.get('card_name', 'Unknown')}")
            print(f"  Player: {data.get('player')}, Year: {data.get('year')}")
            print(f"  Set: {data.get('set_name')}, Is Graded: {data.get('is_graded')}")
        else:
            print(f"INFO: AI returned error: {data.get('error')}")


class TestInventoryStats:
    """Test inventory statistics endpoint"""
    
    def test_inventory_stats_endpoint(self):
        """GET /api/inventory/stats returns statistics"""
        response = requests.get(f"{BASE_URL}/api/inventory/stats")
        assert response.status_code == 200
        data = response.json()
        assert "total_cards" in data
        print(f"PASS: Inventory stats - Total cards: {data.get('total_cards')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
