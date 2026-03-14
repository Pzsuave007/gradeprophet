"""
Inventory Category & From-Scan Import Tests
Tests for:
- Category field (collection/for_sale) on inventory items
- Category filtering (GET /api/inventory?category=collection/for_sale)
- Stats with collection_count and for_sale_count
- POST /api/inventory/from-scan/{analysis_id} - Import from scanned card
- Duplicate protection for from-scan
"""

import pytest
import requests
import os
import uuid

# Get backend URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL')
if not BASE_URL:
    BASE_URL = "https://flip-market-pro.preview.emergentagent.com"
BASE_URL = BASE_URL.rstrip('/')


class TestInventoryCategory:
    """Test category field (collection/for_sale) on inventory items"""
    
    def test_create_item_with_collection_category(self):
        """POST /api/inventory - create card with category='collection'"""
        payload = {
            "card_name": f"TEST_Collection_{uuid.uuid4().hex[:8]}",
            "player": "Test Player",
            "year": 2020,
            "condition": "Raw",
            "category": "collection"
        }
        response = requests.post(f"{BASE_URL}/api/inventory", json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["category"] == "collection", f"Expected category 'collection', got '{data.get('category')}'"
        assert "id" in data
        
        self.__class__.collection_item_id = data["id"]
        print(f"Created collection item: {data['id']}")
    
    def test_create_item_with_for_sale_category(self):
        """POST /api/inventory - create card with category='for_sale'"""
        payload = {
            "card_name": f"TEST_ForSale_{uuid.uuid4().hex[:8]}",
            "player": "Test Player",
            "year": 2021,
            "condition": "Graded",
            "grading_company": "PSA",
            "grade": 9.0,
            "category": "for_sale",
            "purchase_price": 250.00
        }
        response = requests.post(f"{BASE_URL}/api/inventory", json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["category"] == "for_sale", f"Expected category 'for_sale', got '{data.get('category')}'"
        
        self.__class__.for_sale_item_id = data["id"]
        print(f"Created for_sale item: {data['id']}")
    
    def test_default_category_is_collection(self):
        """POST /api/inventory - default category should be 'collection'"""
        payload = {
            "card_name": f"TEST_DefaultCat_{uuid.uuid4().hex[:8]}"
        }
        response = requests.post(f"{BASE_URL}/api/inventory", json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["category"] == "collection", f"Default category should be 'collection', got '{data.get('category')}'"
        
        self.__class__.default_item_id = data["id"]
        print(f"Default category is 'collection' - PASS")


class TestInventoryCategoryFilter:
    """Test GET /api/inventory with category filter"""
    
    def test_filter_by_collection_category(self):
        """GET /api/inventory?category=collection - filter by collection"""
        response = requests.get(f"{BASE_URL}/api/inventory?category=collection")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "items" in data, "Response should have 'items' array"
        assert "total" in data, "Response should have 'total' count"
        
        # All items should have category='collection'
        for item in data["items"]:
            assert item.get("category") == "collection", f"Item should have category 'collection': {item}"
        
        print(f"Filter category=collection returned {data['total']} items - PASS")
    
    def test_filter_by_for_sale_category(self):
        """GET /api/inventory?category=for_sale - filter by for_sale"""
        response = requests.get(f"{BASE_URL}/api/inventory?category=for_sale")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "items" in data, "Response should have 'items' array"
        
        # All items should have category='for_sale'
        for item in data["items"]:
            assert item.get("category") == "for_sale", f"Item should have category 'for_sale': {item}"
        
        print(f"Filter category=for_sale returned {data['total']} items - PASS")
    
    def test_no_category_filter_returns_all(self):
        """GET /api/inventory without category filter returns all items"""
        response = requests.get(f"{BASE_URL}/api/inventory")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "items" in data
        assert data["total"] >= 0
        print(f"No category filter returned {data['total']} items - PASS")


class TestInventoryStatsWithCategory:
    """Test GET /api/inventory/stats returns collection_count and for_sale_count"""
    
    def test_stats_has_category_counts(self):
        """GET /api/inventory/stats - should return collection_count and for_sale_count"""
        response = requests.get(f"{BASE_URL}/api/inventory/stats")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Check for new category count fields
        assert "collection_count" in data, f"Stats should contain 'collection_count': {data}"
        assert "for_sale_count" in data, f"Stats should contain 'for_sale_count': {data}"
        
        # Verify numeric types
        assert isinstance(data["collection_count"], int), f"collection_count should be int: {data['collection_count']}"
        assert isinstance(data["for_sale_count"], int), f"for_sale_count should be int: {data['for_sale_count']}"
        
        # Verify counts are non-negative
        assert data["collection_count"] >= 0, f"collection_count should be >= 0"
        assert data["for_sale_count"] >= 0, f"for_sale_count should be >= 0"
        
        print(f"Stats: collection_count={data['collection_count']}, for_sale_count={data['for_sale_count']} - PASS")


class TestImportFromScan:
    """Test POST /api/inventory/from-scan/{analysis_id} - Import from scanned card"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get an existing card analysis ID for testing"""
        # Fetch existing card analyses
        response = requests.get(f"{BASE_URL}/api/cards/history")
        if response.status_code == 200:
            analyses = response.json()
            if analyses and len(analyses) > 0:
                # Use the first analysis that doesn't have an existing import
                for analysis in analyses:
                    self.analysis_id = analysis.get("id")
                    self.card_name = analysis.get("card_name") or analysis.get("grading_result", {}).get("card_info")
                    # Check if already imported
                    check_resp = requests.get(f"{BASE_URL}/api/inventory?search=&limit=100")
                    if check_resp.status_code == 200:
                        existing_items = check_resp.json().get("items", [])
                        is_imported = any(
                            item.get("source_analysis_id") == self.analysis_id 
                            for item in existing_items
                        )
                        if not is_imported:
                            break
        yield
        # Cleanup: remove test-imported items
        try:
            if hasattr(self, 'imported_item_id'):
                requests.delete(f"{BASE_URL}/api/inventory/{self.imported_item_id}")
        except:
            pass
    
    def test_import_to_collection(self):
        """POST /api/inventory/from-scan/{id} with category='collection'"""
        if not hasattr(self, 'analysis_id'):
            pytest.skip("No card analysis available for testing")
        
        # Check if already imported
        response = requests.post(
            f"{BASE_URL}/api/inventory/from-scan/{self.analysis_id}",
            json={"category": "collection"}
        )
        
        if response.status_code == 400:
            # Card is already in inventory - this is expected duplicate protection
            error_msg = response.json().get("detail", "")
            assert "already in your inventory" in error_msg.lower(), f"Expected 'already in inventory' error: {error_msg}"
            print(f"Duplicate protection works - PASS (card already imported)")
            return
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["category"] == "collection", f"Expected category 'collection', got '{data.get('category')}'"
        assert data["source_analysis_id"] == self.analysis_id, "source_analysis_id should match"
        assert "id" in data
        
        self.imported_item_id = data["id"]
        print(f"Imported card to collection: {data['id']} - PASS")
    
    def test_import_to_for_sale(self):
        """POST /api/inventory/from-scan/{id} with category='for_sale'"""
        # Get a different analysis
        response = requests.get(f"{BASE_URL}/api/cards/history")
        if response.status_code != 200:
            pytest.skip("Could not fetch card analyses")
        
        analyses = response.json()
        if len(analyses) < 2:
            pytest.skip("Need at least 2 analyses for this test")
        
        # Use the second analysis
        analysis_id = analyses[1].get("id")
        
        response = requests.post(
            f"{BASE_URL}/api/inventory/from-scan/{analysis_id}",
            json={"category": "for_sale", "purchase_price": 150.00}
        )
        
        if response.status_code == 400:
            error_msg = response.json().get("detail", "")
            if "already in your inventory" in error_msg.lower():
                print(f"Duplicate protection works - PASS (card already imported)")
                return
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["category"] == "for_sale", f"Expected category 'for_sale', got '{data.get('category')}'"
        assert data["purchase_price"] == 150.00, f"Expected purchase_price 150, got {data.get('purchase_price')}"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/inventory/{data['id']}")
        print(f"Imported card to for_sale with price - PASS")
    
    def test_import_duplicate_returns_400(self):
        """POST /api/inventory/from-scan/{id} - duplicate should return 400"""
        if not hasattr(self, 'analysis_id'):
            pytest.skip("No card analysis available for testing")
        
        # First import (or it's already imported)
        first_resp = requests.post(
            f"{BASE_URL}/api/inventory/from-scan/{self.analysis_id}",
            json={"category": "collection"}
        )
        
        if first_resp.status_code == 200:
            self.imported_item_id = first_resp.json()["id"]
        
        # Try to import the same card again
        second_resp = requests.post(
            f"{BASE_URL}/api/inventory/from-scan/{self.analysis_id}",
            json={"category": "for_sale"}
        )
        
        assert second_resp.status_code == 400, f"Expected 400 for duplicate, got {second_resp.status_code}"
        error_msg = second_resp.json().get("detail", "")
        assert "already" in error_msg.lower(), f"Error message should mention 'already': {error_msg}"
        
        print(f"Duplicate protection works: {error_msg} - PASS")
    
    def test_import_nonexistent_analysis_returns_404(self):
        """POST /api/inventory/from-scan/{nonexistent_id} should return 404"""
        fake_id = f"nonexistent-{uuid.uuid4().hex[:8]}"
        response = requests.post(
            f"{BASE_URL}/api/inventory/from-scan/{fake_id}",
            json={"category": "collection"}
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print(f"Nonexistent analysis returns 404 - PASS")


class TestCleanupCategoryTests:
    """Cleanup TEST_ prefixed items created during category testing"""
    
    def test_cleanup_test_data(self):
        """Remove all TEST_ prefixed inventory items"""
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
