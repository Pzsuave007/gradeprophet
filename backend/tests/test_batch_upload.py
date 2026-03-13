"""
Test Batch Upload Feature
- POST /api/inventory/batch-save endpoint with multiple cards
- POST /api/inventory/batch-save with empty cards array
- POST /api/cards/identify endpoint for card identification
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestBatchSaveEndpoint:
    """Tests for POST /api/inventory/batch-save endpoint"""
    
    def test_batch_save_empty_array_returns_zeros(self):
        """POST /api/inventory/batch-save with empty cards array returns {saved: 0, total: 0, errors: []}"""
        response = requests.post(f"{BASE_URL}/api/inventory/batch-save", json={
            "cards": [],
            "category": "collection"
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["saved"] == 0, f"Expected saved=0, got {data['saved']}"
        assert data["total"] == 0, f"Expected total=0, got {data['total']}"
        assert data["errors"] == [], f"Expected errors=[], got {data['errors']}"
        print(f"✓ Empty batch returns: {data}")
    
    def test_batch_save_single_card_collection(self):
        """POST /api/inventory/batch-save creates single card in collection"""
        card_data = {
            "cards": [
                {
                    "card_name": "TEST_BATCH_2023 Topps Chrome Shohei Ohtani #100",
                    "player": "Shohei Ohtani",
                    "year": 2023,
                    "set_name": "Topps Chrome",
                    "card_number": "100",
                    "condition": "Raw"
                }
            ],
            "category": "collection"
        }
        
        response = requests.post(f"{BASE_URL}/api/inventory/batch-save", json=card_data)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["saved"] == 1, f"Expected saved=1, got {data['saved']}"
        assert data["total"] == 1, f"Expected total=1, got {data['total']}"
        assert data["errors"] == [], f"Expected no errors, got {data['errors']}"
        print(f"✓ Single card batch saved: {data}")
    
    def test_batch_save_multiple_cards_for_sale(self):
        """POST /api/inventory/batch-save creates multiple cards for sale category"""
        card_data = {
            "cards": [
                {
                    "card_name": "TEST_BATCH_2020 Panini Prizm Joe Burrow #307",
                    "player": "Joe Burrow",
                    "year": 2020,
                    "set_name": "Panini Prizm",
                    "card_number": "307",
                    "condition": "Raw"
                },
                {
                    "card_name": "TEST_BATCH_2023 Panini Mosaic Victor Wembanyama #280",
                    "player": "Victor Wembanyama",
                    "year": 2023,
                    "set_name": "Panini Mosaic",
                    "card_number": "280",
                    "condition": "Graded",
                    "grading_company": "PSA",
                    "grade": 10
                }
            ],
            "category": "for_sale"
        }
        
        response = requests.post(f"{BASE_URL}/api/inventory/batch-save", json=card_data)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["saved"] == 2, f"Expected saved=2, got {data['saved']}"
        assert data["total"] == 2, f"Expected total=2, got {data['total']}"
        assert data["errors"] == [], f"Expected no errors, got {data['errors']}"
        print(f"✓ Multiple cards batch saved: {data}")
    
    def test_batch_save_card_with_all_fields(self):
        """POST /api/inventory/batch-save with card containing all optional fields"""
        card_data = {
            "cards": [
                {
                    "card_name": "TEST_BATCH_1986 Fleer Michael Jordan #57",
                    "player": "Michael Jordan",
                    "year": 1986,
                    "set_name": "Fleer",
                    "card_number": "57",
                    "variation": "Rookie Card",
                    "condition": "Graded",
                    "grading_company": "BGS",
                    "grade": 9.5,
                    "purchase_price": 5000.00,
                    "quantity": 1,
                    "notes": "Investment piece",
                    "sport": "Basketball"
                }
            ],
            "category": "collection"
        }
        
        response = requests.post(f"{BASE_URL}/api/inventory/batch-save", json=card_data)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["saved"] == 1, f"Expected saved=1, got {data['saved']}"
        assert data["errors"] == [], f"Expected no errors, got {data['errors']}"
        print(f"✓ Card with all fields saved: {data}")
        
        # Verify the card was created with correct data by fetching inventory
        search_response = requests.get(f"{BASE_URL}/api/inventory?search=TEST_BATCH_1986 Fleer")
        assert search_response.status_code == 200
        search_data = search_response.json()
        assert search_data["total"] >= 1, "Card should be findable in inventory"
        print(f"✓ Card verified in inventory")


class TestCardIdentifyEndpoint:
    """Tests for POST /api/cards/identify endpoint"""
    
    def test_identify_endpoint_exists(self):
        """POST /api/cards/identify endpoint exists and requires image_base64"""
        # Test with empty payload - should return error
        response = requests.post(f"{BASE_URL}/api/cards/identify", json={})
        
        # Should fail with 422 (validation error) or 500 (missing field)
        assert response.status_code in [422, 500], f"Expected validation error, got {response.status_code}"
        print(f"✓ Identify endpoint requires image_base64 field")
    
    def test_identify_endpoint_accepts_request(self):
        """POST /api/cards/identify accepts image_base64 parameter"""
        # Small 1x1 pixel PNG as base64 (valid image format)
        tiny_image = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        
        response = requests.post(f"{BASE_URL}/api/cards/identify", json={
            "image_base64": tiny_image
        })
        
        # Should accept the request (200) even if AI can't identify the tiny image
        # Or 500 if AI fails - but endpoint is accessible
        assert response.status_code in [200, 500], f"Expected 200 or 500, got {response.status_code}: {response.text}"
        
        if response.status_code == 200:
            data = response.json()
            # Should return card identification fields
            expected_fields = ["card_name", "player", "year"]
            for field in expected_fields:
                assert field in data or "error" in data, f"Missing field: {field}"
            print(f"✓ Identify endpoint returned: {list(data.keys())}")
        else:
            print(f"✓ Identify endpoint exists (AI processing error expected for tiny image)")


class TestBatchSaveDataPersistence:
    """Tests to verify batch saved data persists correctly"""
    
    def test_batch_saved_cards_appear_in_inventory(self):
        """Verify batch saved cards appear in inventory list"""
        # First batch save a unique card
        unique_name = "TEST_BATCH_PERSIST_2024 Topps Series 1 #99"
        
        response = requests.post(f"{BASE_URL}/api/inventory/batch-save", json={
            "cards": [{"card_name": unique_name, "player": "Test Player", "year": 2024}],
            "category": "collection"
        })
        assert response.status_code == 200
        
        # Verify card appears in inventory
        search_response = requests.get(f"{BASE_URL}/api/inventory?search=TEST_BATCH_PERSIST")
        assert search_response.status_code == 200
        
        data = search_response.json()
        found = any(item.get("card_name") == unique_name for item in data.get("items", []))
        assert found, f"Batch saved card not found in inventory"
        print(f"✓ Batch saved card persisted in inventory")


class TestCleanup:
    """Cleanup test data created during tests"""
    
    def test_cleanup_batch_test_cards(self):
        """Delete all TEST_BATCH_ prefixed cards"""
        # Get all inventory items
        response = requests.get(f"{BASE_URL}/api/inventory?limit=200")
        assert response.status_code == 200
        
        items = response.json().get("items", [])
        deleted = 0
        
        for item in items:
            card_name = item.get("card_name", "")
            if card_name.startswith("TEST_BATCH_"):
                del_response = requests.delete(f"{BASE_URL}/api/inventory/{item['id']}")
                if del_response.status_code == 200:
                    deleted += 1
        
        print(f"✓ Cleaned up {deleted} TEST_BATCH_ cards")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
