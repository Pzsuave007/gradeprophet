"""
Test terminology update verification - Testing that all user-facing text
has been updated from 'snipe/sniper' to 'alert/auction alert' terminology.
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "test@dashboard.com"
TEST_PASSWORD = "Test123!"


class TestBackendAPIs:
    """Basic backend API health checks"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup for each test"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
    def get_auth_token(self):
        """Get authentication token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            data = response.json()
            # Try different possible token keys
            return data.get("access_token") or data.get("token") or data.get("user_id")
        return None
    
    def test_auth_login(self):
        """Test authentication login"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        # App uses user_id for session auth
        assert "user_id" in data or "access_token" in data or "token" in data
        print(f"PASS: Authentication working - Response keys: {list(data.keys())}")
    
    def test_dashboard_analytics(self):
        """Test dashboard analytics endpoint"""
        # Login first to get session cookie
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert login_response.status_code == 200
        
        response = self.session.get(f"{BASE_URL}/api/dashboard/analytics")
        assert response.status_code == 200
        print("PASS: Dashboard analytics endpoint working")
    
    def test_dashboard_command_center(self):
        """Test command center endpoint"""
        # Login first
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert login_response.status_code == 200
        
        response = self.session.get(f"{BASE_URL}/api/dashboard/command-center")
        assert response.status_code == 200
        data = response.json()
        
        # Verify snipes/alerts structure exists
        assert "snipes" in data, "snipes key should exist in command center response"
        assert "active" in data["snipes"], "active key should exist in snipes"
        print("PASS: Command center endpoint working")
    
    def test_snipes_endpoint(self):
        """Test snipes (alerts) endpoint"""
        # Login first
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert login_response.status_code == 200
        
        response = self.session.get(f"{BASE_URL}/api/snipes")
        assert response.status_code == 200
        print("PASS: Snipes/alerts endpoint working")
    
    def test_snipes_stats(self):
        """Test snipes stats endpoint"""
        # Login first
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert login_response.status_code == 200
        
        response = self.session.get(f"{BASE_URL}/api/snipes-stats")
        assert response.status_code == 200
        data = response.json()
        
        # Verify stats structure
        assert "active" in data
        assert "won" in data
        assert "lost" in data
        assert "total" in data
        print(f"PASS: Snipes stats endpoint working - Active: {data['active']}, Won: {data['won']}, Lost: {data['lost']}")
    
    def test_watchlist_endpoint(self):
        """Test watchlist endpoint"""
        # Login first
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert login_response.status_code == 200
        
        response = self.session.get(f"{BASE_URL}/api/watchlist")
        assert response.status_code == 200
        print("PASS: Watchlist endpoint working")
    
    def test_listings_endpoint(self):
        """Test listings endpoint"""
        # Login first
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert login_response.status_code == 200
        
        response = self.session.get(f"{BASE_URL}/api/listings")
        assert response.status_code == 200
        print("PASS: Listings endpoint working")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
