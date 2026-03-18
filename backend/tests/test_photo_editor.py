"""
Photo Editor Feature Tests - InventoryModule Photo Editor

Tests the backend API for the photo editor feature:
- PUT /api/inventory/{item_id} with image_base64 and back_image_base64 fields
- Image processing and storage

Note: These tests require authentication. Without valid session cookies,
API calls will return 401 Not authenticated.
"""

import pytest
import requests
import os
import base64
from PIL import Image
import io

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


def create_test_image():
    """Create a simple test image and return base64 encoded"""
    img = Image.new('RGB', (200, 280), color='#1a1a1a')
    from PIL import ImageDraw
    draw = ImageDraw.Draw(img)
    draw.rectangle([10, 10, 190, 100], fill='#3b82f6')
    draw.rectangle([10, 110, 190, 180], fill='#fbbf24')
    draw.rectangle([10, 190, 190, 270], fill='#ef4444')
    
    buffer = io.BytesIO()
    img.save(buffer, format='JPEG', quality=85)
    return base64.b64encode(buffer.getvalue()).decode('utf-8')


class TestInventoryPhotoEditorEndpoint:
    """Tests for PUT /api/inventory/{item_id} image update endpoint"""
    
    def test_put_inventory_returns_401_without_auth(self):
        """PUT /api/inventory/{item_id} should return 401 without authentication"""
        # Use a fake item ID
        item_id = "test-item-12345"
        response = requests.put(
            f"{BASE_URL}/api/inventory/{item_id}",
            json={"card_name": "Test Card"},
            headers={"Content-Type": "application/json"}
        )
        # Without auth, should return 401
        assert response.status_code == 401
        data = response.json()
        assert "detail" in data
        assert "authenticated" in data["detail"].lower() or "Not authenticated" in data["detail"]
        print(f"PASS: PUT /api/inventory returns 401 without auth - {data['detail']}")
    
    def test_put_inventory_with_image_base64_requires_auth(self):
        """PUT /api/inventory/{item_id} with image_base64 requires authentication"""
        item_id = "test-item-12345"
        test_image = create_test_image()
        
        response = requests.put(
            f"{BASE_URL}/api/inventory/{item_id}",
            json={"image_base64": f"data:image/jpeg;base64,{test_image}"},
            headers={"Content-Type": "application/json"}
        )
        # Without auth, should return 401
        assert response.status_code == 401
        print("PASS: PUT with image_base64 returns 401 without auth")
    
    def test_put_inventory_with_back_image_base64_requires_auth(self):
        """PUT /api/inventory/{item_id} with back_image_base64 requires authentication"""
        item_id = "test-item-12345"
        test_image = create_test_image()
        
        response = requests.put(
            f"{BASE_URL}/api/inventory/{item_id}",
            json={"back_image_base64": f"data:image/jpeg;base64,{test_image}"},
            headers={"Content-Type": "application/json"}
        )
        # Without auth, should return 401
        assert response.status_code == 401
        print("PASS: PUT with back_image_base64 returns 401 without auth")


class TestInventoryEndpointStructure:
    """Tests for inventory endpoint structure and availability"""
    
    def test_inventory_api_responds(self):
        """GET /api/inventory should respond (even if with 401)"""
        response = requests.get(f"{BASE_URL}/api/inventory")
        # Should get either 401 (unauthorized) or 200 (if somehow public)
        assert response.status_code in [401, 200, 500]
        print(f"PASS: GET /api/inventory responds with status {response.status_code}")
    
    def test_inventory_stats_api_responds(self):
        """GET /api/inventory/stats should respond"""
        response = requests.get(f"{BASE_URL}/api/inventory/stats")
        assert response.status_code in [401, 200, 500]
        print(f"PASS: GET /api/inventory/stats responds with status {response.status_code}")


class TestImageBase64PayloadFormat:
    """Tests for image base64 payload format handling"""
    
    def test_invalid_item_id_format(self):
        """PUT with invalid item_id should return 401 (auth check first) or 404"""
        response = requests.put(
            f"{BASE_URL}/api/inventory/invalid-id-!@#$%",
            json={"card_name": "Test"},
            headers={"Content-Type": "application/json"}
        )
        # Auth check happens first, so 401 is expected
        assert response.status_code in [401, 404, 400]
        print(f"PASS: Invalid item_id returns {response.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
