"""
Inventory Module Backend Tests
Tests for FlipSlab Engine inventory CRUD operations, search, and filters.
"""

import pytest
import requests
import os
import uuid

# Get backend URL from environment (no default to fail fast if missing)
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL')
if not BASE_URL:
    BASE_URL = "https://sports-card-os.preview.emergentagent.com"
BASE_URL = BASE_URL.rstrip('/')


class TestInventoryCreate:
    """Test POST /api/inventory - Create inventory items"""
    
    def test_create_inventory_item_all_fields(self):
        """Create a card with all fields populated"""
        payload = {
            "card_name": "TEST_1996 Topps Chrome Kobe Bryant #138",
            "player": "Kobe Bryant",
            "year": 1996,
            "set_name": "Topps Chrome",
            "card_number": "#138",
            "variation": "Refractor",
            "condition": "Graded",
            "grading_company": "PSA",
            "grade": 9.0,
            "purchase_price": 1500.00,
            "quantity": 1,
            "notes": "Test card for inventory testing"
        }
        response = requests.post(f"{BASE_URL}/api/inventory", json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["card_name"] == payload["card_name"]
        assert data["player"] == payload["player"]
        assert data["year"] == payload["year"]
        assert data["set_name"] == payload["set_name"]
        assert data["condition"] == "Graded"
        assert data["grading_company"] == "PSA"
        assert data["grade"] == 9.0
        assert data["purchase_price"] == 1500.00
        assert "id" in data
        assert data["listed"] == False  # Default value
        
        # Store ID for cleanup
        self.__class__.created_id_graded = data["id"]
        print(f"Created graded inventory item: {data['id']}")
    
    def test_create_raw_card(self):
        """Create a raw (ungraded) card"""
        payload = {
            "card_name": "TEST_1986 Fleer Michael Jordan #57",
            "player": "Michael Jordan",
            "year": 1986,
            "set_name": "Fleer",
            "card_number": "#57",
            "condition": "Raw",
            "purchase_price": 350.00,
            "quantity": 1,
            "notes": "Test raw card"
        }
        response = requests.post(f"{BASE_URL}/api/inventory", json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["condition"] == "Raw"
        assert data["grading_company"] is None or data["grading_company"] == ""
        assert data["grade"] is None
        
        self.__class__.created_id_raw = data["id"]
        print(f"Created raw inventory item: {data['id']}")
    
    def test_create_minimal_card(self):
        """Create a card with only required field (card_name)"""
        payload = {
            "card_name": "TEST_Minimal Card Entry"
        }
        response = requests.post(f"{BASE_URL}/api/inventory", json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["card_name"] == "TEST_Minimal Card Entry"
        assert data["condition"] == "Raw"  # Default
        assert data["quantity"] == 1  # Default
        
        self.__class__.created_id_minimal = data["id"]
        print(f"Created minimal inventory item: {data['id']}")


class TestInventoryList:
    """Test GET /api/inventory - List and search inventory"""
    
    def test_list_all_inventory(self):
        """Get all inventory items"""
        response = requests.get(f"{BASE_URL}/api/inventory")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "items" in data, "Response should have 'items' array"
        assert "total" in data, "Response should have 'total' count"
        assert isinstance(data["items"], list)
        assert isinstance(data["total"], int)
        
        print(f"Listed {data['total']} inventory items")
    
    def test_search_by_keyword(self):
        """Search inventory by keyword (e.g., 'kobe')"""
        response = requests.get(f"{BASE_URL}/api/inventory?search=kobe")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "items" in data
        # If we have items, verify search is working
        for item in data["items"]:
            combined = f"{item.get('card_name', '')} {item.get('player', '')} {item.get('set_name', '')}".lower()
            assert "kobe" in combined, f"Search result should contain 'kobe': {item}"
        
        print(f"Search 'kobe' returned {data['total']} results")
    
    def test_filter_by_condition_graded(self):
        """Filter by condition=Graded"""
        response = requests.get(f"{BASE_URL}/api/inventory?condition=Graded")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "items" in data
        for item in data["items"]:
            assert item.get("condition") == "Graded", f"Item should be Graded: {item}"
        
        print(f"Filter condition=Graded returned {data['total']} results")
    
    def test_filter_by_condition_raw(self):
        """Filter by condition=Raw"""
        response = requests.get(f"{BASE_URL}/api/inventory?condition=Raw")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "items" in data
        for item in data["items"]:
            assert item.get("condition") == "Raw", f"Item should be Raw: {item}"
        
        print(f"Filter condition=Raw returned {data['total']} results")
    
    def test_filter_by_listed_false(self):
        """Filter by listed=false"""
        response = requests.get(f"{BASE_URL}/api/inventory?listed=false")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "items" in data
        for item in data["items"]:
            assert item.get("listed") == False, f"Item should not be listed: {item}"
        
        print(f"Filter listed=false returned {data['total']} results")
    
    def test_filter_by_listed_true(self):
        """Filter by listed=true"""
        response = requests.get(f"{BASE_URL}/api/inventory?listed=true")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "items" in data
        # All items should have listed=True
        for item in data["items"]:
            assert item.get("listed") == True, f"Item should be listed: {item}"
        
        print(f"Filter listed=true returned {data['total']} results")


class TestInventoryStats:
    """Test GET /api/inventory/stats - Inventory statistics"""
    
    def test_get_inventory_stats(self):
        """Get inventory stats with all required fields"""
        response = requests.get(f"{BASE_URL}/api/inventory/stats")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Check all required stats fields
        required_fields = ["total_cards", "graded", "raw", "listed", "not_listed", "total_invested", "avg_price"]
        for field in required_fields:
            assert field in data, f"Stats should contain '{field}': {data}"
        
        # Verify numeric types
        assert isinstance(data["total_cards"], int)
        assert isinstance(data["graded"], int)
        assert isinstance(data["raw"], int)
        assert isinstance(data["listed"], int)
        assert isinstance(data["not_listed"], int)
        assert isinstance(data["total_invested"], (int, float))
        assert isinstance(data["avg_price"], (int, float))
        
        print(f"Stats: total={data['total_cards']}, graded={data['graded']}, raw={data['raw']}, invested=${data['total_invested']}")


class TestInventorySingleItem:
    """Test GET/PUT/DELETE /api/inventory/{id} - Single item operations"""
    
    @pytest.fixture(autouse=True)
    def setup_test_item(self):
        """Create a test item for single item tests"""
        payload = {
            "card_name": f"TEST_SingleItem_{uuid.uuid4().hex[:8]}",
            "player": "Test Player",
            "year": 2020,
            "condition": "Raw",
            "purchase_price": 100.00,
            "quantity": 2
        }
        response = requests.post(f"{BASE_URL}/api/inventory", json=payload)
        assert response.status_code == 200
        self.test_item_id = response.json()["id"]
        yield
        # Cleanup - try to delete (may already be deleted)
        requests.delete(f"{BASE_URL}/api/inventory/{self.test_item_id}")
    
    def test_get_single_item(self):
        """GET single inventory item by ID"""
        response = requests.get(f"{BASE_URL}/api/inventory/{self.test_item_id}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["id"] == self.test_item_id
        assert "card_name" in data
        print(f"Retrieved single item: {data['card_name']}")
    
    def test_get_nonexistent_item_returns_404(self):
        """GET nonexistent item should return 404"""
        fake_id = "nonexistent-id-12345"
        response = requests.get(f"{BASE_URL}/api/inventory/{fake_id}")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
    
    def test_update_item(self):
        """PUT update inventory item fields"""
        update_payload = {
            "card_name": "TEST_Updated Card Name",
            "purchase_price": 150.00,
            "notes": "Updated notes"
        }
        response = requests.put(f"{BASE_URL}/api/inventory/{self.test_item_id}", json=update_payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["card_name"] == "TEST_Updated Card Name"
        assert data["purchase_price"] == 150.00
        assert data["notes"] == "Updated notes"
        
        # Verify persistence with GET
        verify_response = requests.get(f"{BASE_URL}/api/inventory/{self.test_item_id}")
        verify_data = verify_response.json()
        assert verify_data["card_name"] == "TEST_Updated Card Name"
        print(f"Updated and verified item: {data['id']}")
    
    def test_update_condition_to_graded(self):
        """PUT update condition from Raw to Graded with grade"""
        update_payload = {
            "condition": "Graded",
            "grading_company": "PSA",
            "grade": 10.0
        }
        response = requests.put(f"{BASE_URL}/api/inventory/{self.test_item_id}", json=update_payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["condition"] == "Graded"
        assert data["grading_company"] == "PSA"
        assert data["grade"] == 10.0
        print(f"Updated condition to Graded PSA 10")
    
    def test_delete_item(self):
        """DELETE inventory item"""
        # Create item to delete
        payload = {"card_name": f"TEST_ToDelete_{uuid.uuid4().hex[:8]}"}
        create_resp = requests.post(f"{BASE_URL}/api/inventory", json=payload)
        item_id = create_resp.json()["id"]
        
        # Delete it
        response = requests.delete(f"{BASE_URL}/api/inventory/{item_id}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Verify it's gone
        verify_response = requests.get(f"{BASE_URL}/api/inventory/{item_id}")
        assert verify_response.status_code == 404, "Deleted item should return 404"
        print(f"Deleted and verified removal of item: {item_id}")
    
    def test_delete_nonexistent_item_returns_404(self):
        """DELETE nonexistent item should return 404"""
        fake_id = "nonexistent-delete-id"
        response = requests.delete(f"{BASE_URL}/api/inventory/{fake_id}")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"


class TestInventoryCleanup:
    """Cleanup TEST_ prefixed items created during testing"""
    
    def test_cleanup_test_data(self):
        """Remove all TEST_ prefixed inventory items"""
        # Get all items with TEST_ prefix
        response = requests.get(f"{BASE_URL}/api/inventory?search=TEST_&limit=100")
        if response.status_code == 200:
            items = response.json().get("items", [])
            deleted_count = 0
            for item in items:
                if item.get("card_name", "").startswith("TEST_"):
                    del_resp = requests.delete(f"{BASE_URL}/api/inventory/{item['id']}")
                    if del_resp.status_code == 200:
                        deleted_count += 1
            print(f"Cleaned up {deleted_count} test items")
        else:
            print("Could not fetch items for cleanup")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
