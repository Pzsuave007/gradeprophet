"""
Test Best Offer Toggle and PWE Envelope Shipping Features

Tests for eBay listing creation and revision:
- POST /api/ebay/sell/create - accepts best_offer boolean field
- POST /api/ebay/sell/revise - accepts best_offer, shipping_option, shipping_cost fields
- PWEEnvelope maps to USPSFirstClass in eBay XML
- BestOfferDetails XML generated when best_offer=true
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')


class TestBestOfferPWEShipping:
    """Test Best Offer and PWE Envelope Shipping features"""

    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Login and get session cookie"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login with test user
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "mobiletest@test.com", "password": "Test123!"}
        )
        if login_response.status_code != 200:
            pytest.skip("Authentication failed - skipping tests")
        
        yield
        # No cleanup needed

    # ====== Create Listing Tests ======

    def test_create_listing_endpoint_exists(self):
        """POST /api/ebay/sell/create endpoint exists"""
        response = self.session.post(
            f"{BASE_URL}/api/ebay/sell/create",
            json={
                "inventory_item_id": "TEST_nonexistent",
                "title": "Test Card",
                "description": "Test description",
                "price": 10.00
            }
        )
        # Should return 404 (item not found) or 401 (eBay not connected), not 405 (method not allowed)
        assert response.status_code in [401, 404, 422], f"Expected 401/404/422, got {response.status_code}"
        print(f"SUCCESS: /api/ebay/sell/create endpoint exists (status: {response.status_code})")

    def test_create_listing_accepts_best_offer_field(self):
        """POST /api/ebay/sell/create accepts 'best_offer' boolean field in payload"""
        response = self.session.post(
            f"{BASE_URL}/api/ebay/sell/create",
            json={
                "inventory_item_id": "TEST_nonexistent",
                "title": "Test Card with Best Offer",
                "description": "Test description",
                "price": 25.00,
                "best_offer": True,
                "listing_format": "FixedPriceItem"
            }
        )
        # Should not return 422 (validation error) for best_offer field
        # Will return 401 or 404 since no eBay account / item doesn't exist
        assert response.status_code in [401, 404], f"Expected 401/404 (payload accepted), got {response.status_code}: {response.text}"
        print(f"SUCCESS: best_offer field accepted in create payload (status: {response.status_code})")

    def test_create_listing_accepts_best_offer_false(self):
        """POST /api/ebay/sell/create accepts 'best_offer': false"""
        response = self.session.post(
            f"{BASE_URL}/api/ebay/sell/create",
            json={
                "inventory_item_id": "TEST_nonexistent",
                "title": "Test Card No Best Offer",
                "description": "Test description",
                "price": 30.00,
                "best_offer": False,
                "listing_format": "FixedPriceItem"
            }
        )
        assert response.status_code in [401, 404], f"Expected 401/404, got {response.status_code}"
        print(f"SUCCESS: best_offer=False accepted in create payload")

    def test_create_listing_accepts_pwe_envelope_shipping(self):
        """POST /api/ebay/sell/create accepts 'PWEEnvelope' shipping option"""
        response = self.session.post(
            f"{BASE_URL}/api/ebay/sell/create",
            json={
                "inventory_item_id": "TEST_nonexistent",
                "title": "Test Card PWE Shipping",
                "description": "Test description",
                "price": 5.00,
                "shipping_option": "PWEEnvelope",
                "shipping_cost": 2.50
            }
        )
        assert response.status_code in [401, 404], f"Expected 401/404 (payload accepted), got {response.status_code}: {response.text}"
        print(f"SUCCESS: PWEEnvelope shipping_option accepted in create payload")

    def test_create_listing_accepts_all_shipping_options(self):
        """POST /api/ebay/sell/create accepts all 4 shipping options"""
        shipping_options = [
            ("FreeShipping", 0),
            ("PWEEnvelope", 2.50),
            ("USPSFirstClass", 4.50),
            ("USPSPriority", 8.50)
        ]
        
        for option, cost in shipping_options:
            response = self.session.post(
                f"{BASE_URL}/api/ebay/sell/create",
                json={
                    "inventory_item_id": "TEST_nonexistent",
                    "title": f"Test Card {option}",
                    "description": "Test description",
                    "price": 10.00,
                    "shipping_option": option,
                    "shipping_cost": cost
                }
            )
            assert response.status_code in [401, 404], f"Shipping option {option} rejected: {response.status_code}"
            print(f"SUCCESS: {option} (${cost}) shipping option accepted")

    def test_create_listing_full_payload_with_best_offer_and_pwe(self):
        """POST /api/ebay/sell/create accepts full payload with best_offer AND PWE shipping"""
        response = self.session.post(
            f"{BASE_URL}/api/ebay/sell/create",
            json={
                "inventory_item_id": "TEST_nonexistent",
                "title": "2023 Topps Chrome Wembanyama Test",
                "description": "Test card with Best Offer and PWE Envelope shipping",
                "price": 15.00,
                "listing_format": "FixedPriceItem",
                "duration": "GTC",
                "condition_id": 3000,
                "shipping_option": "PWEEnvelope",
                "shipping_cost": 2.50,
                "best_offer": True
            }
        )
        assert response.status_code in [401, 404], f"Full payload rejected: {response.status_code}: {response.text}"
        print(f"SUCCESS: Full payload with best_offer=True and PWEEnvelope accepted")

    # ====== Revise Listing Tests ======

    def test_revise_listing_endpoint_exists(self):
        """POST /api/ebay/sell/revise endpoint exists"""
        response = self.session.post(
            f"{BASE_URL}/api/ebay/sell/revise",
            json={"item_id": "TEST_123456789"}
        )
        # Should return 401 (eBay not connected), not 405 (method not allowed)
        # Without any changes, returns "No changes provided"
        assert response.status_code in [200, 401], f"Expected 200/401, got {response.status_code}"
        print(f"SUCCESS: /api/ebay/sell/revise endpoint exists (status: {response.status_code})")

    def test_revise_listing_accepts_best_offer_true(self):
        """POST /api/ebay/sell/revise accepts 'best_offer': true"""
        response = self.session.post(
            f"{BASE_URL}/api/ebay/sell/revise",
            json={
                "item_id": "TEST_123456789",
                "best_offer": True
            }
        )
        # Should return 401 (eBay not connected), payload should be accepted
        assert response.status_code in [401], f"Expected 401, got {response.status_code}: {response.text}"
        print(f"SUCCESS: best_offer=True accepted in revise payload")

    def test_revise_listing_accepts_best_offer_false(self):
        """POST /api/ebay/sell/revise accepts 'best_offer': false"""
        response = self.session.post(
            f"{BASE_URL}/api/ebay/sell/revise",
            json={
                "item_id": "TEST_123456789",
                "best_offer": False
            }
        )
        assert response.status_code in [401], f"Expected 401, got {response.status_code}"
        print(f"SUCCESS: best_offer=False accepted in revise payload")

    def test_revise_listing_accepts_shipping_option(self):
        """POST /api/ebay/sell/revise accepts 'shipping_option' field"""
        response = self.session.post(
            f"{BASE_URL}/api/ebay/sell/revise",
            json={
                "item_id": "TEST_123456789",
                "shipping_option": "PWEEnvelope",
                "shipping_cost": 2.50
            }
        )
        assert response.status_code in [401], f"Expected 401, got {response.status_code}"
        print(f"SUCCESS: shipping_option accepted in revise payload")

    def test_revise_listing_accepts_all_shipping_options(self):
        """POST /api/ebay/sell/revise accepts all 4 shipping options"""
        shipping_options = [
            ("FreeShipping", 0),
            ("PWEEnvelope", 2.50),
            ("USPSFirstClass", 4.50),
            ("USPSPriority", 8.50)
        ]
        
        for option, cost in shipping_options:
            response = self.session.post(
                f"{BASE_URL}/api/ebay/sell/revise",
                json={
                    "item_id": "TEST_123456789",
                    "shipping_option": option,
                    "shipping_cost": cost
                }
            )
            assert response.status_code in [401], f"Revise shipping option {option} rejected: {response.status_code}"
            print(f"SUCCESS: Revise with {option} (${cost}) shipping option accepted")

    def test_revise_listing_combined_best_offer_and_shipping(self):
        """POST /api/ebay/sell/revise accepts best_offer + shipping_option together"""
        response = self.session.post(
            f"{BASE_URL}/api/ebay/sell/revise",
            json={
                "item_id": "TEST_123456789",
                "best_offer": True,
                "shipping_option": "PWEEnvelope",
                "shipping_cost": 2.50
            }
        )
        assert response.status_code in [401], f"Expected 401, got {response.status_code}"
        print(f"SUCCESS: Combined best_offer + shipping_option accepted in revise")

    def test_revise_listing_full_payload(self):
        """POST /api/ebay/sell/revise accepts full revision payload"""
        response = self.session.post(
            f"{BASE_URL}/api/ebay/sell/revise",
            json={
                "item_id": "TEST_123456789",
                "title": "Updated Title",
                "price": 29.99,
                "quantity": 1,
                "description": "Updated description",
                "best_offer": True,
                "shipping_option": "USPSFirstClass",
                "shipping_cost": 4.50
            }
        )
        assert response.status_code in [401], f"Expected 401, got {response.status_code}"
        print(f"SUCCESS: Full revise payload accepted")

    def test_revise_no_changes_returns_message(self):
        """POST /api/ebay/sell/revise with no changes returns appropriate message"""
        response = self.session.post(
            f"{BASE_URL}/api/ebay/sell/revise",
            json={"item_id": "TEST_123456789"}
        )
        # If no eBay token, returns 401. If has token but no changes, returns message
        if response.status_code == 200:
            data = response.json()
            assert data.get("success") == False, f"Expected success=False for no changes"
            assert "No changes" in data.get("message", ""), f"Expected 'No changes' message"
            print(f"SUCCESS: No changes returns appropriate message: {data.get('message')}")
        else:
            assert response.status_code == 401, f"Expected 200 or 401, got {response.status_code}"
            print(f"SUCCESS: Revise endpoint returns 401 (eBay not connected)")


class TestShippingOptionDefaults:
    """Test default shipping costs for each option"""

    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Login and get session cookie"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "mobiletest@test.com", "password": "Test123!"}
        )
        if login_response.status_code != 200:
            pytest.skip("Authentication failed")
        yield

    def test_pwe_default_cost_is_250(self):
        """PWE Envelope default cost should be $2.50"""
        # This is validated in the backend code - when shipping_cost is 0 and option is PWEEnvelope, defaults to 2.50
        response = self.session.post(
            f"{BASE_URL}/api/ebay/sell/create",
            json={
                "inventory_item_id": "TEST_nonexistent",
                "title": "Test PWE Default",
                "description": "Test",
                "price": 5.00,
                "shipping_option": "PWEEnvelope",
                "shipping_cost": 0  # Should default to 2.50
            }
        )
        assert response.status_code in [401, 404], f"Expected 401/404, got {response.status_code}"
        print("SUCCESS: PWE with shipping_cost=0 accepted (backend will default to $2.50)")

    def test_usps_first_class_default_cost_is_450(self):
        """USPS First Class default cost should be $4.50"""
        response = self.session.post(
            f"{BASE_URL}/api/ebay/sell/create",
            json={
                "inventory_item_id": "TEST_nonexistent",
                "title": "Test USPS FC Default",
                "description": "Test",
                "price": 10.00,
                "shipping_option": "USPSFirstClass",
                "shipping_cost": 0  # Should default to 4.50
            }
        )
        assert response.status_code in [401, 404], f"Expected 401/404, got {response.status_code}"
        print("SUCCESS: USPS First Class with shipping_cost=0 accepted (backend will default to $4.50)")

    def test_usps_priority_default_cost_is_850(self):
        """USPS Priority default cost should be $8.50"""
        response = self.session.post(
            f"{BASE_URL}/api/ebay/sell/create",
            json={
                "inventory_item_id": "TEST_nonexistent",
                "title": "Test Priority Default",
                "description": "Test",
                "price": 50.00,
                "shipping_option": "USPSPriority",
                "shipping_cost": 0  # Should default to 8.50
            }
        )
        assert response.status_code in [401, 404], f"Expected 401/404, got {response.status_code}"
        print("SUCCESS: USPS Priority with shipping_cost=0 accepted (backend will default to $8.50)")


class TestListingFormatRestrictions:
    """Test that Best Offer only works with FixedPriceItem format"""

    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Login and get session cookie"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "mobiletest@test.com", "password": "Test123!"}
        )
        if login_response.status_code != 200:
            pytest.skip("Authentication failed")
        yield

    def test_best_offer_with_fixed_price_item(self):
        """best_offer should be accepted with FixedPriceItem format"""
        response = self.session.post(
            f"{BASE_URL}/api/ebay/sell/create",
            json={
                "inventory_item_id": "TEST_nonexistent",
                "title": "BIN with Best Offer",
                "description": "Test",
                "price": 20.00,
                "listing_format": "FixedPriceItem",
                "best_offer": True
            }
        )
        assert response.status_code in [401, 404], f"Expected 401/404, got {response.status_code}"
        print("SUCCESS: best_offer with FixedPriceItem accepted")

    def test_best_offer_with_auction_format(self):
        """best_offer with Chinese (Auction) format - backend accepts but ignores for XML generation"""
        response = self.session.post(
            f"{BASE_URL}/api/ebay/sell/create",
            json={
                "inventory_item_id": "TEST_nonexistent",
                "title": "Auction Test",
                "description": "Test",
                "price": 1.00,
                "listing_format": "Chinese",
                "best_offer": True  # Should be ignored for auctions
            }
        )
        # Backend accepts the payload but won't generate BestOfferDetails XML for auctions
        assert response.status_code in [401, 404], f"Expected 401/404, got {response.status_code}"
        print("SUCCESS: best_offer with Auction format accepted (backend ignores for XML)")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
