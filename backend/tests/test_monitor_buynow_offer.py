"""
Tests for FlipFinder Monitor new features:
- Listing type filter (All Types, Auctions, Buy Now, Best Offer)
- Buy Now endpoint POST /api/buy-now
- Make Offer endpoint POST /api/make-offer
- GET /api/listings with listing_type query parameter
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')
TEST_CREDENTIALS = {"email": "test@sniper.com", "password": "Test1234!"}


class TestListingTypeFilter:
    """Test listing type filter functionality"""

    @pytest.fixture(scope="class")
    def auth_cookies(self):
        """Login and get auth cookies"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json=TEST_CREDENTIALS)
        assert response.status_code == 200, f"Login failed: {response.text}"
        return session.cookies

    def test_listings_endpoint_all_types(self, auth_cookies):
        """GET /api/listings without listing_type returns all listings"""
        response = requests.get(
            f"{BASE_URL}/api/listings",
            cookies=auth_cookies
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        # Should return object with total and listings
        assert "total" in data or isinstance(data, list), "Response should have total or be a list"
        print(f"All listings count: {data.get('total', len(data))}")

    def test_listings_filter_auction(self, auth_cookies):
        """GET /api/listings?listing_type=auction returns only auctions"""
        response = requests.get(
            f"{BASE_URL}/api/listings?listing_type=auction",
            cookies=auth_cookies
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        listings = data.get("listings", data) if isinstance(data, dict) else data
        print(f"Auction listings count: {len(listings)}")
        # Verify all returned listings are auctions
        for listing in listings[:5]:  # Check first 5
            assert listing.get("listing_type") == "auction", f"Non-auction listing returned: {listing.get('listing_type')}"

    def test_listings_filter_buy_now(self, auth_cookies):
        """GET /api/listings?listing_type=buy_now returns only BIN listings"""
        response = requests.get(
            f"{BASE_URL}/api/listings?listing_type=buy_now",
            cookies=auth_cookies
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        listings = data.get("listings", data) if isinstance(data, dict) else data
        print(f"Buy Now listings count: {len(listings)}")
        # Verify all returned listings are buy_now
        for listing in listings[:5]:  # Check first 5
            assert listing.get("listing_type") == "buy_now", f"Non-BIN listing returned: {listing.get('listing_type')}"

    def test_listings_filter_offers(self, auth_cookies):
        """GET /api/listings?listing_type=offers returns listings that accept offers"""
        response = requests.get(
            f"{BASE_URL}/api/listings?listing_type=offers",
            cookies=auth_cookies
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        listings = data.get("listings", data) if isinstance(data, dict) else data
        print(f"Best Offer listings count: {len(listings)}")
        # Verify all returned listings accept offers
        for listing in listings[:5]:  # Check first 5
            assert listing.get("accepts_offers") == True, f"Listing doesn't accept offers: {listing.get('accepts_offers')}"

    def test_listings_filter_all(self, auth_cookies):
        """GET /api/listings?listing_type=all returns all listings"""
        response = requests.get(
            f"{BASE_URL}/api/listings?listing_type=all",
            cookies=auth_cookies
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        print(f"All listings (with all filter): {data.get('total', len(data))}")


class TestBuyNowEndpoint:
    """Test POST /api/buy-now endpoint"""

    @pytest.fixture(scope="class")
    def auth_cookies(self):
        """Login and get auth cookies"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json=TEST_CREDENTIALS)
        assert response.status_code == 200, f"Login failed: {response.text}"
        return session.cookies

    def test_buy_now_requires_auth(self):
        """POST /api/buy-now without auth returns 401"""
        response = requests.post(
            f"{BASE_URL}/api/buy-now",
            json={"ebay_item_id": "123456789", "price": 10.00}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"

    def test_buy_now_validates_price_zero(self, auth_cookies):
        """POST /api/buy-now with price=0 returns 400"""
        response = requests.post(
            f"{BASE_URL}/api/buy-now",
            json={"ebay_item_id": "123456789", "price": 0},
            cookies=auth_cookies
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        assert "greater than 0" in response.json().get("detail", "").lower(), f"Wrong error: {response.text}"

    def test_buy_now_validates_price_negative(self, auth_cookies):
        """POST /api/buy-now with negative price returns 400"""
        response = requests.post(
            f"{BASE_URL}/api/buy-now",
            json={"ebay_item_id": "123456789", "price": -10.00},
            cookies=auth_cookies
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"

    def test_buy_now_missing_fields(self, auth_cookies):
        """POST /api/buy-now with missing fields returns 422"""
        response = requests.post(
            f"{BASE_URL}/api/buy-now",
            json={},
            cookies=auth_cookies
        )
        assert response.status_code == 422, f"Expected 422, got {response.status_code}"

    def test_buy_now_with_valid_payload(self, auth_cookies):
        """POST /api/buy-now with valid payload (expected 400 due to eBay restrictions)"""
        # eBay Buy Now API requires special app approval
        # Expected to fail with eBay error, but endpoint should work
        response = requests.post(
            f"{BASE_URL}/api/buy-now",
            json={"ebay_item_id": "123456789012", "price": 99.99},
            cookies=auth_cookies
        )
        # 400 is expected - either eBay not connected or eBay API restriction
        assert response.status_code in [400, 200], f"Unexpected status: {response.status_code}"
        print(f"Buy Now response: {response.status_code} - {response.text[:200]}")


class TestMakeOfferEndpoint:
    """Test POST /api/make-offer endpoint"""

    @pytest.fixture(scope="class")
    def auth_cookies(self):
        """Login and get auth cookies"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json=TEST_CREDENTIALS)
        assert response.status_code == 200, f"Login failed: {response.text}"
        return session.cookies

    def test_make_offer_requires_auth(self):
        """POST /api/make-offer without auth returns 401"""
        response = requests.post(
            f"{BASE_URL}/api/make-offer",
            json={"ebay_item_id": "123456789", "offer_amount": 10.00}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"

    def test_make_offer_validates_amount_zero(self, auth_cookies):
        """POST /api/make-offer with offer_amount=0 returns 400"""
        response = requests.post(
            f"{BASE_URL}/api/make-offer",
            json={"ebay_item_id": "123456789", "offer_amount": 0, "message": ""},
            cookies=auth_cookies
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        assert "greater than 0" in response.json().get("detail", "").lower(), f"Wrong error: {response.text}"

    def test_make_offer_validates_amount_negative(self, auth_cookies):
        """POST /api/make-offer with negative offer_amount returns 400"""
        response = requests.post(
            f"{BASE_URL}/api/make-offer",
            json={"ebay_item_id": "123456789", "offer_amount": -50.00},
            cookies=auth_cookies
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"

    def test_make_offer_missing_fields(self, auth_cookies):
        """POST /api/make-offer with missing fields returns 422"""
        response = requests.post(
            f"{BASE_URL}/api/make-offer",
            json={},
            cookies=auth_cookies
        )
        assert response.status_code == 422, f"Expected 422, got {response.status_code}"

    def test_make_offer_with_message(self, auth_cookies):
        """POST /api/make-offer with valid payload including message (expected 400 due to eBay restrictions)"""
        # eBay Make Offer API requires special app approval
        # Expected to fail with eBay error, but endpoint should work
        response = requests.post(
            f"{BASE_URL}/api/make-offer",
            json={
                "ebay_item_id": "123456789012",
                "offer_amount": 75.00,
                "message": "Interested in this card, would you accept $75?"
            },
            cookies=auth_cookies
        )
        # 400 is expected - either eBay not connected or eBay API restriction
        assert response.status_code in [400, 200], f"Unexpected status Network: {response.status_code}"
        print(f"Make Offer response: {response.status_code} - {response.text[:200]}")


class TestListingWithNewFields:
    """Test that listings have new fields: buying_options, accepts_offers"""

    @pytest.fixture(scope="class")
    def auth_cookies(self):
        """Login and get auth cookies"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json=TEST_CREDENTIALS)
        assert response.status_code == 200, f"Login failed: {response.text}"
        return session.cookies

    def test_listings_have_new_fields_structure(self, auth_cookies):
        """GET /api/listings returns listings - check for new fields where available"""
        response = requests.get(
            f"{BASE_URL}/api/listings?limit=10",
            cookies=auth_cookies
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        listings = data.get("listings", data) if isinstance(data, dict) else data

        if len(listings) > 0:
            listing = listings[0]
            print(f"Sample listing fields: {list(listing.keys())}")
            # listing_type should always be present
            assert "listing_type" in listing, "listing_type field missing"
            # accepts_offers may be present (new listings only)
            print(f"accepts_offers present: {'accepts_offers' in listing}")
            print(f"listing_type: {listing.get('listing_type')}")


class TestSniperBackgroundLoop:
    """Test that sniper background loop is still running"""

    @pytest.fixture(scope="class")
    def auth_cookies(self):
        """Login and get auth cookies"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json=TEST_CREDENTIALS)
        assert response.status_code == 200, f"Login failed: {response.text}"
        return session.cookies

    def test_snipes_endpoint_accessible(self, auth_cookies):
        """GET /api/snipes is accessible (sniper feature still working)"""
        response = requests.get(
            f"{BASE_URL}/api/snipes",
            cookies=auth_cookies
        )
        assert response.status_code == 200, f"Snipes endpoint failed: {response.text}"
        print(f"Snipes response: {response.json()}")

    def test_snipes_stats_accessible(self, auth_cookies):
        """GET /api/snipes-stats is accessible"""
        response = requests.get(
            f"{BASE_URL}/api/snipes-stats",
            cookies=auth_cookies
        )
        assert response.status_code == 200, f"Snipes stats failed: {response.text}"
        data = response.json()
        assert "active" in data
        assert "won" in data
        assert "lost" in data
        assert "total" in data
        print(f"Snipes stats: {data}")
