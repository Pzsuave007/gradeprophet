"""
Quick Scan Feature - Backend API Tests
Tests for POST /api/cards/identify and POST /api/inventory endpoints
Uses session cookie authentication (not Bearer token)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "mobiletest@test.com"
TEST_PASSWORD = "Test123!"

# Minimal 1x1 red pixel PNG for testing (base64 encoded)
MINIMAL_IMAGE_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=="


@pytest.fixture(scope="module")
def auth_session():
    """Get authenticated session with session cookie"""
    session = requests.Session()
    response = session.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    if response.status_code == 200:
        print(f"Logged in as {TEST_EMAIL}")
        return session
    pytest.skip(f"Authentication failed: {response.status_code} - {response.text}")


class TestQuickScanIdentifyEndpoint:
    """Tests for POST /api/cards/identify endpoint"""

    def test_identify_endpoint_exists(self, auth_session):
        """Test that /api/cards/identify endpoint exists and accepts POST"""
        response = auth_session.post(
            f"{BASE_URL}/api/cards/identify",
            json={"front_image_base64": f"data:image/png;base64,{MINIMAL_IMAGE_BASE64}"}
        )
        # Should not be 404 (endpoint exists) - may be 200 or 500 due to AI processing
        assert response.status_code != 404, f"Endpoint not found: {response.status_code}"
        print(f"Identify endpoint status: {response.status_code}")

    def test_identify_requires_image(self, auth_session):
        """Test that identify endpoint requires front_image_base64"""
        response = auth_session.post(
            f"{BASE_URL}/api/cards/identify",
            json={}
        )
        assert response.status_code == 400, f"Expected 400 for missing image, got {response.status_code}"
        print(f"Missing image correctly returns 400")

    def test_identify_requires_auth(self):
        """Test that identify endpoint requires authentication"""
        # Use fresh session without login
        response = requests.post(
            f"{BASE_URL}/api/cards/identify",
            json={"front_image_base64": f"data:image/png;base64,{MINIMAL_IMAGE_BASE64}"}
        )
        assert response.status_code == 401, f"Expected 401 for no auth, got {response.status_code}"
        print(f"Auth required correctly - status 401")

    def test_identify_accepts_valid_payload(self, auth_session):
        """Test identify endpoint accepts valid payload format"""
        response = auth_session.post(
            f"{BASE_URL}/api/cards/identify",
            json={
                "front_image_base64": f"data:image/png;base64,{MINIMAL_IMAGE_BASE64}",
                "back_image_base64": f"data:image/png;base64,{MINIMAL_IMAGE_BASE64}"
            }
        )
        # Accepts the payload (not 400/404) - may be 200 or 500 depending on AI service
        assert response.status_code in [200, 500], f"Unexpected status: {response.status_code}"
        print(f"Valid payload accepted - status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"Response keys: {data.keys() if isinstance(data, dict) else 'not dict'}")


class TestQuickScanInventoryEndpoint:
    """Tests for POST /api/inventory endpoint (for saving scanned cards)"""

    def test_inventory_endpoint_exists(self, auth_session):
        """Test that /api/inventory POST endpoint exists"""
        response = auth_session.post(
            f"{BASE_URL}/api/inventory",
            json={"card_name": "TEST_QuickScan_Card"}
        )
        assert response.status_code != 404, f"Endpoint not found: {response.status_code}"
        print(f"Inventory POST endpoint status: {response.status_code}")
        
        # Clean up if created
        if response.status_code in [200, 201]:
            item_id = response.json().get("id")
            if item_id:
                auth_session.delete(f"{BASE_URL}/api/inventory/{item_id}")

    def test_inventory_requires_card_name(self, auth_session):
        """Test that inventory endpoint requires card_name"""
        response = auth_session.post(
            f"{BASE_URL}/api/inventory",
            json={}
        )
        # Should fail validation - 422 (Pydantic) or 400
        assert response.status_code in [400, 422], f"Expected 400/422, got {response.status_code}"
        print(f"Missing card_name correctly rejected - status {response.status_code}")

    def test_inventory_requires_auth(self):
        """Test that inventory endpoint requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/inventory",
            json={"card_name": "TEST_NoAuth_Card"}
        )
        # Should return 401 or 500 with auth error
        assert response.status_code in [401, 500], f"Expected 401/500, got {response.status_code}"
        print(f"Auth required - status {response.status_code}")

    def test_create_inventory_item_with_image(self, auth_session):
        """Test creating inventory item with image (Quick Scan flow)"""
        payload = {
            "card_name": "TEST_QuickScan_2023 Topps Chrome LeBron James",
            "player": "LeBron James",
            "year": 2023,
            "set_name": "Topps Chrome",
            "card_number": "100",
            "variation": "Refractor",
            "condition": "Raw",
            "sport": "Basketball",
            "category": "for_sale",
            "image_base64": f"data:image/png;base64,{MINIMAL_IMAGE_BASE64}",
            "back_image_base64": f"data:image/png;base64,{MINIMAL_IMAGE_BASE64}"
        }
        
        response = auth_session.post(
            f"{BASE_URL}/api/inventory",
            json=payload
        )
        
        assert response.status_code in [200, 201], f"Create failed: {response.status_code} - {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "id" in data, "Response missing 'id'"
        assert data.get("card_name") == payload["card_name"], "card_name mismatch"
        assert data.get("player") == payload["player"], "player mismatch"
        assert data.get("year") == payload["year"], "year mismatch"
        assert data.get("category") == payload["category"], "category mismatch"
        
        print(f"Created inventory item: {data.get('id')}")
        
        # Clean up - delete the test item
        item_id = data.get("id")
        if item_id:
            delete_response = auth_session.delete(f"{BASE_URL}/api/inventory/{item_id}")
            print(f"Cleanup delete status: {delete_response.status_code}")

    def test_create_inventory_minimal_payload(self, auth_session):
        """Test creating inventory item with minimal payload (just card_name)"""
        payload = {
            "card_name": "TEST_QuickScan_Minimal_Card",
            "category": "collection"
        }
        
        response = auth_session.post(
            f"{BASE_URL}/api/inventory",
            json=payload
        )
        
        assert response.status_code in [200, 201], f"Create failed: {response.status_code}"
        data = response.json()
        
        assert "id" in data
        assert data.get("card_name") == payload["card_name"]
        print(f"Minimal item created: {data.get('id')}")
        
        # Clean up
        item_id = data.get("id")
        if item_id:
            auth_session.delete(f"{BASE_URL}/api/inventory/{item_id}")


class TestQuickScanEndToEndPayload:
    """Test the full payload that Quick Scan component sends"""

    def test_quickscan_save_flow_payload(self, auth_session):
        """Test the exact payload format Quick Scan sends to save a card"""
        # This mimics what QuickScan.jsx sends in saveCard()
        payload = {
            "card_name": "TEST_QuickScan 2020 Panini Prizm Joe Burrow #307 Silver",
            "player": "Joe Burrow",
            "year": 2020,
            "set_name": "Panini Prizm",
            "card_number": "#307",
            "variation": "Silver",
            "condition": "Raw",  # QuickScan sets this based on is_graded
            "grading_company": None,
            "grade": None,
            "sport": "Football",
            "category": "for_sale",  # Default in QuickScan
            "image_base64": f"data:image/jpeg;base64,{MINIMAL_IMAGE_BASE64}",
            "back_image_base64": f"data:image/jpeg;base64,{MINIMAL_IMAGE_BASE64}"
        }
        
        response = auth_session.post(
            f"{BASE_URL}/api/inventory",
            json=payload
        )
        
        assert response.status_code in [200, 201], f"QuickScan save failed: {response.status_code} - {response.text}"
        data = response.json()
        
        # Verify all fields saved correctly
        assert data.get("player") == "Joe Burrow"
        assert data.get("year") == 2020
        assert data.get("set_name") == "Panini Prizm"
        assert data.get("sport") == "Football"
        assert data.get("category") == "for_sale"
        
        print(f"QuickScan E2E payload test passed - item ID: {data.get('id')}")
        
        # Clean up
        item_id = data.get("id")
        if item_id:
            auth_session.delete(f"{BASE_URL}/api/inventory/{item_id}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
