"""
Tests for Auction Sniper feature in FlipSlab Engine
Tests: GET /snipes, GET /snipes-stats, POST /snipes/check-item, POST /snipes, DELETE /snipes/{id}, POST /snipes/{id}/refresh
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "test@sniper.com"
TEST_PASSWORD = "Test1234!"

class TestAuctionSniper:
    """Auction Sniper endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login to get session cookie"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get auth cookie
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        
        if login_response.status_code != 200:
            # Try registering if login fails
            register_response = self.session.post(
                f"{BASE_URL}/api/auth/register",
                json={"email": TEST_EMAIL, "password": TEST_PASSWORD, "name": "Sniper Test"}
            )
            if register_response.status_code not in [200, 201]:
                pytest.skip(f"Could not authenticate: {register_response.text}")
        
        yield
        # Cleanup any test snipes created
        try:
            snipes = self.session.get(f"{BASE_URL}/api/snipes").json()
            for snipe in snipes:
                if snipe.get("status") in ["scheduled", "monitoring"]:
                    self.session.delete(f"{BASE_URL}/api/snipes/{snipe['id']}")
        except:
            pass

    # ---- GET /api/snipes Tests ----
    
    def test_get_snipes_returns_list(self):
        """GET /api/snipes should return a list (empty for new user)"""
        response = self.session.get(f"{BASE_URL}/api/snipes")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✅ GET /snipes returned {len(data)} snipes")

    def test_get_snipes_without_auth_returns_401(self):
        """GET /api/snipes without auth should return 401"""
        no_auth_session = requests.Session()
        response = no_auth_session.get(f"{BASE_URL}/api/snipes")
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✅ GET /snipes without auth returns 401")

    # ---- GET /api/snipes-stats Tests ----
    
    def test_get_snipes_stats_returns_stats_object(self):
        """GET /api/snipes-stats should return stats with active, won, lost, total"""
        response = self.session.get(f"{BASE_URL}/api/snipes-stats")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        # Validate structure
        assert "active" in data, "Stats should have 'active' field"
        assert "won" in data, "Stats should have 'won' field"
        assert "lost" in data, "Stats should have 'lost' field"
        assert "total" in data, "Stats should have 'total' field"
        
        # Validate types
        assert isinstance(data["active"], int), "'active' should be an integer"
        assert isinstance(data["won"], int), "'won' should be an integer"
        assert isinstance(data["lost"], int), "'lost' should be an integer"
        assert isinstance(data["total"], int), "'total' should be an integer"
        
        print(f"✅ GET /snipes-stats returned: active={data['active']}, won={data['won']}, lost={data['lost']}, total={data['total']}")

    # ---- POST /api/snipes/check-item Tests ----
    
    def test_check_item_with_empty_url_returns_400(self):
        """POST /api/snipes/check-item with empty URL should return 400"""
        response = self.session.post(
            f"{BASE_URL}/api/snipes/check-item",
            json={"ebay_url_or_id": ""}
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("✅ POST /snipes/check-item with empty URL returns 400")

    def test_check_item_with_invalid_id_returns_400(self):
        """POST /api/snipes/check-item with invalid eBay ID should return 400"""
        response = self.session.post(
            f"{BASE_URL}/api/snipes/check-item",
            json={"ebay_url_or_id": "invalid123"}
        )
        
        # Should either return 400 (could not extract ID or could not fetch item)
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("✅ POST /snipes/check-item with invalid ID returns 400")

    def test_check_item_with_valid_auction_item(self):
        """POST /api/snipes/check-item with real auction item should return item details"""
        # Use a sample eBay item ID format - this is a test with eBay API
        # Note: This test may fail if the item doesn't exist or is not accessible
        response = self.session.post(
            f"{BASE_URL}/api/snipes/check-item",
            json={"ebay_url_or_id": "https://www.ebay.com/itm/123456789012"}
        )
        
        # We expect either:
        # - 200 with item details (if valid auction)
        # - 400 if item doesn't exist or isn't auction
        assert response.status_code in [200, 400], f"Expected 200 or 400, got {response.status_code}"
        
        if response.status_code == 200:
            data = response.json()
            assert "is_auction" in data, "Response should have 'is_auction' field"
            print(f"✅ POST /snipes/check-item returned item details: is_auction={data.get('is_auction')}")
        else:
            print(f"✅ POST /snipes/check-item returned expected 400: {response.json().get('detail')}")

    # ---- POST /api/snipes Validation Tests ----
    
    def test_create_snipe_with_invalid_max_bid_zero(self):
        """POST /api/snipes with max_bid=0 should return 400"""
        response = self.session.post(
            f"{BASE_URL}/api/snipes",
            json={
                "ebay_url_or_id": "123456789012",
                "max_bid": 0,
                "snipe_seconds_before": 5
            }
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        data = response.json()
        assert "Max bid must be greater than 0" in data.get("detail", ""), f"Expected max bid error, got: {data}"
        print("✅ POST /snipes with max_bid=0 returns 400 with proper error")

    def test_create_snipe_with_negative_max_bid(self):
        """POST /api/snipes with negative max_bid should return 400"""
        response = self.session.post(
            f"{BASE_URL}/api/snipes",
            json={
                "ebay_url_or_id": "123456789012",
                "max_bid": -10.0,
                "snipe_seconds_before": 5
            }
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        data = response.json()
        assert "Max bid must be greater than 0" in data.get("detail", ""), f"Expected max bid error, got: {data}"
        print("✅ POST /snipes with negative max_bid returns 400 with proper error")

    def test_create_snipe_with_invalid_seconds_too_low(self):
        """POST /api/snipes with snipe_seconds_before < 2 should return 400"""
        response = self.session.post(
            f"{BASE_URL}/api/snipes",
            json={
                "ebay_url_or_id": "123456789012",
                "max_bid": 50.0,
                "snipe_seconds_before": 1  # Too low
            }
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        data = response.json()
        assert "Snipe timing must be between 2-30 seconds" in data.get("detail", ""), f"Expected timing error, got: {data}"
        print("✅ POST /snipes with snipe_seconds_before=1 returns 400 with proper error")

    def test_create_snipe_with_invalid_seconds_too_high(self):
        """POST /api/snipes with snipe_seconds_before > 30 should return 400"""
        response = self.session.post(
            f"{BASE_URL}/api/snipes",
            json={
                "ebay_url_or_id": "123456789012",
                "max_bid": 50.0,
                "snipe_seconds_before": 60  # Too high
            }
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        data = response.json()
        assert "Snipe timing must be between 2-30 seconds" in data.get("detail", ""), f"Expected timing error, got: {data}"
        print("✅ POST /snipes with snipe_seconds_before=60 returns 400 with proper error")

    def test_create_snipe_with_invalid_item_id(self):
        """POST /api/snipes with invalid item ID should return 400"""
        response = self.session.post(
            f"{BASE_URL}/api/snipes",
            json={
                "ebay_url_or_id": "invalid-not-a-number",
                "max_bid": 50.0,
                "snipe_seconds_before": 5
            }
        )
        
        # Should fail either on extract ID or fetch item details
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print(f"✅ POST /snipes with invalid item ID returns 400: {response.json().get('detail')}")

    # ---- DELETE /api/snipes/{id} Tests ----
    
    def test_cancel_nonexistent_snipe_returns_404(self):
        """DELETE /api/snipes/{id} with invalid ID should return 404"""
        fake_id = "nonexistent-snipe-id-12345"
        response = self.session.delete(f"{BASE_URL}/api/snipes/{fake_id}")
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✅ DELETE /snipes with nonexistent ID returns 404")

    # ---- POST /api/snipes/{id}/refresh Tests ----
    
    def test_refresh_nonexistent_snipe_returns_404(self):
        """POST /api/snipes/{id}/refresh with invalid ID should return 404"""
        fake_id = "nonexistent-snipe-id-12345"
        response = self.session.post(f"{BASE_URL}/api/snipes/{fake_id}/refresh")
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✅ POST /snipes/{id}/refresh with nonexistent ID returns 404")

    # ---- Integration Test: Full Snipe Flow Validation ----
    
    def test_snipes_endpoint_structure_validation(self):
        """Verify GET /api/snipes returns proper structure if snipes exist"""
        response = self.session.get(f"{BASE_URL}/api/snipes")
        
        assert response.status_code == 200
        data = response.json()
        
        if len(data) > 0:
            snipe = data[0]
            # Validate expected fields exist
            expected_fields = [
                "id", "user_id", "ebay_item_id", "item_title", "item_image_url",
                "item_url", "current_price", "minimum_to_bid", "bid_count",
                "max_bid", "snipe_seconds_before", "auction_end_time", "status",
                "created_at", "updated_at"
            ]
            for field in expected_fields:
                assert field in snipe, f"Missing field: {field}"
            
            # Validate status is valid
            valid_statuses = ["scheduled", "monitoring", "bidding", "bid_placed", 
                           "won", "outbid", "lost", "skipped", "missed", "cancelled", "error"]
            assert snipe["status"] in valid_statuses, f"Invalid status: {snipe['status']}"
            
            print(f"✅ Snipe structure validation passed: {len(data)} snipes, first status={snipe['status']}")
        else:
            print("✅ No snipes to validate structure, endpoint works correctly")


class TestAuctionSniperWithoutEbay:
    """Tests that work without eBay connection"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login to get session cookie"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        
        if login_response.status_code != 200:
            register_response = self.session.post(
                f"{BASE_URL}/api/auth/register",
                json={"email": TEST_EMAIL, "password": TEST_PASSWORD, "name": "Sniper Test"}
            )
            if register_response.status_code not in [200, 201]:
                pytest.skip("Could not authenticate")
        
        yield

    def test_snipes_endpoints_accessible_after_login(self):
        """All snipe endpoints should be accessible after login"""
        # GET /snipes
        r1 = self.session.get(f"{BASE_URL}/api/snipes")
        assert r1.status_code == 200, f"GET /snipes failed: {r1.status_code}"
        
        # GET /snipes-stats
        r2 = self.session.get(f"{BASE_URL}/api/snipes-stats")
        assert r2.status_code == 200, f"GET /snipes-stats failed: {r2.status_code}"
        
        print("✅ All snipe read endpoints accessible after login")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
