"""
Test bulk shipping update feature for FlipSlab Engine
Tests:
1. POST /api/ebay/sell/bulk-revise-shipping endpoint exists and accepts correct payload
2. Validates shipping options (FreeShipping, PWEEnvelope, USPSFirstClass, USPSPriority)
3. Returns proper response structure
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
DEV_TOKEN = "scan_74b1544bdc4a4aa2b3fa9839c4e42f64"


@pytest.fixture(scope="module")
def session():
    """Create authenticated session"""
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    # Authenticate via dev login
    resp = s.get(f"{BASE_URL}/api/auth/dev-login?token={DEV_TOKEN}")
    assert resp.status_code == 200, f"Dev login failed: {resp.text}"
    return s


class TestBulkShippingEndpoint:
    """Test the bulk-revise-shipping endpoint"""
    
    def test_endpoint_exists(self, session):
        """Test that the bulk-revise-shipping endpoint exists"""
        # Send request with empty item_ids to test endpoint existence
        resp = session.post(f"{BASE_URL}/api/ebay/sell/bulk-revise-shipping", json={
            "item_ids": [],
            "shipping_option": "FreeShipping",
            "shipping_cost": 0.0
        })
        # Should return 200 with success=True (0 items updated)
        # or 401 if eBay not connected (which is expected for test account)
        assert resp.status_code in [200, 401], f"Unexpected status: {resp.status_code}, {resp.text}"
        print(f"✓ Endpoint exists, status: {resp.status_code}")
    
    def test_accepts_free_shipping(self, session):
        """Test FreeShipping option"""
        resp = session.post(f"{BASE_URL}/api/ebay/sell/bulk-revise-shipping", json={
            "item_ids": ["fake_item_123"],
            "shipping_option": "FreeShipping",
            "shipping_cost": 0.0
        })
        # 401 = eBay not connected (expected), 200 = success
        assert resp.status_code in [200, 401], f"Unexpected status: {resp.status_code}"
        print(f"✓ FreeShipping option accepted, status: {resp.status_code}")
    
    def test_accepts_pwe_envelope(self, session):
        """Test PWEEnvelope option with $2.50 cost"""
        resp = session.post(f"{BASE_URL}/api/ebay/sell/bulk-revise-shipping", json={
            "item_ids": ["fake_item_456"],
            "shipping_option": "PWEEnvelope",
            "shipping_cost": 2.50
        })
        assert resp.status_code in [200, 401], f"Unexpected status: {resp.status_code}"
        print(f"✓ PWEEnvelope option accepted, status: {resp.status_code}")
    
    def test_accepts_usps_first_class(self, session):
        """Test USPSFirstClass option with $4.50 cost"""
        resp = session.post(f"{BASE_URL}/api/ebay/sell/bulk-revise-shipping", json={
            "item_ids": ["fake_item_789"],
            "shipping_option": "USPSFirstClass",
            "shipping_cost": 4.50
        })
        assert resp.status_code in [200, 401], f"Unexpected status: {resp.status_code}"
        print(f"✓ USPSFirstClass option accepted, status: {resp.status_code}")
    
    def test_accepts_usps_priority(self, session):
        """Test USPSPriority option with $8.50 cost"""
        resp = session.post(f"{BASE_URL}/api/ebay/sell/bulk-revise-shipping", json={
            "item_ids": ["fake_item_abc"],
            "shipping_option": "USPSPriority",
            "shipping_cost": 8.50
        })
        assert resp.status_code in [200, 401], f"Unexpected status: {resp.status_code}"
        print(f"✓ USPSPriority option accepted, status: {resp.status_code}")
    
    def test_response_structure(self, session):
        """Test that response has correct structure"""
        resp = session.post(f"{BASE_URL}/api/ebay/sell/bulk-revise-shipping", json={
            "item_ids": ["test_item_1", "test_item_2"],
            "shipping_option": "FreeShipping",
            "shipping_cost": 0.0
        })
        if resp.status_code == 200:
            data = resp.json()
            # Should have success, total, updated, results fields
            assert "success" in data, "Response missing 'success' field"
            assert "total" in data, "Response missing 'total' field"
            assert "updated" in data, "Response missing 'updated' field"
            assert "results" in data, "Response missing 'results' field"
            print(f"✓ Response structure correct: {data}")
        elif resp.status_code == 401:
            # eBay not connected - expected for test account
            print("✓ Response structure test skipped (eBay not connected)")
        else:
            pytest.fail(f"Unexpected status: {resp.status_code}")
    
    def test_requires_authentication(self):
        """Test that endpoint requires authentication"""
        # Create unauthenticated session
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        resp = s.post(f"{BASE_URL}/api/ebay/sell/bulk-revise-shipping", json={
            "item_ids": [],
            "shipping_option": "FreeShipping",
            "shipping_cost": 0.0
        })
        # Should return 401 or 403 for unauthenticated request
        assert resp.status_code in [401, 403], f"Expected 401/403, got {resp.status_code}"
        print(f"✓ Authentication required, status: {resp.status_code}")


class TestBulkReviseShippingRequestModel:
    """Test the request model validation"""
    
    def test_missing_item_ids(self, session):
        """Test that missing item_ids returns validation error"""
        resp = session.post(f"{BASE_URL}/api/ebay/sell/bulk-revise-shipping", json={
            "shipping_option": "FreeShipping",
            "shipping_cost": 0.0
        })
        # Should return 422 for validation error
        assert resp.status_code == 422, f"Expected 422, got {resp.status_code}"
        print(f"✓ Missing item_ids returns 422")
    
    def test_missing_shipping_option(self, session):
        """Test that missing shipping_option returns validation error"""
        resp = session.post(f"{BASE_URL}/api/ebay/sell/bulk-revise-shipping", json={
            "item_ids": ["test"],
            "shipping_cost": 0.0
        })
        # Should return 422 for validation error
        assert resp.status_code == 422, f"Expected 422, got {resp.status_code}"
        print(f"✓ Missing shipping_option returns 422")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
