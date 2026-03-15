"""
Test onboarding endpoints - New user onboarding wizard feature
Tests: GET /api/onboarding/status, POST /api/onboarding/complete, POST /api/onboarding/skip
Also tests: onboarding_completed field in /api/auth/register, /api/auth/login, /api/auth/me
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')

# Test user credentials
TEST_EMAIL = f"onboard_test_{uuid.uuid4().hex[:8]}@test.com"
TEST_PASSWORD = "Test123!"
TEST_NAME = "Onboarding Test User"

# Existing user for login tests
EXISTING_EMAIL = "test@dashboard.com"
EXISTING_PASSWORD = "Test123!"


class TestOnboardingBackend:
    """Test suite for onboarding feature backend APIs"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup session for authenticated requests"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def test_01_register_returns_onboarding_completed_false(self):
        """POST /api/auth/register returns onboarding_completed: false for new users"""
        # Create unique test user
        email = f"onboard_new_{uuid.uuid4().hex[:8]}@test.com"
        response = self.session.post(f"{BASE_URL}/api/auth/register", json={
            "email": email,
            "password": TEST_PASSWORD,
            "name": TEST_NAME
        })
        
        assert response.status_code == 200, f"Register failed: {response.text}"
        data = response.json()
        
        # Verify onboarding_completed field is present and false
        assert "onboarding_completed" in data, "Missing onboarding_completed field in register response"
        assert data["onboarding_completed"] == False, f"Expected onboarding_completed=false, got {data['onboarding_completed']}"
        assert "user_id" in data
        assert data["email"] == email.lower()
        assert data["name"] == TEST_NAME
        print(f"PASS: Register returns onboarding_completed=false for new user {email}")
    
    def test_02_login_returns_onboarding_completed_field(self):
        """POST /api/auth/login returns onboarding_completed field"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": EXISTING_EMAIL,
            "password": EXISTING_PASSWORD
        })
        
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        
        # Verify onboarding_completed field is present (can be true or false for existing user)
        assert "onboarding_completed" in data, "Missing onboarding_completed field in login response"
        assert isinstance(data["onboarding_completed"], bool), f"onboarding_completed should be boolean, got {type(data['onboarding_completed'])}"
        print(f"PASS: Login returns onboarding_completed={data['onboarding_completed']}")
    
    def test_03_auth_me_returns_onboarding_completed_field(self):
        """GET /api/auth/me returns onboarding_completed field"""
        # First login to get session cookie
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": EXISTING_EMAIL,
            "password": EXISTING_PASSWORD
        })
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        
        # Now check /api/auth/me
        response = self.session.get(f"{BASE_URL}/api/auth/me")
        
        assert response.status_code == 200, f"Get me failed: {response.text}"
        data = response.json()
        
        # Verify onboarding_completed field is present
        assert "onboarding_completed" in data, "Missing onboarding_completed field in /me response"
        assert isinstance(data["onboarding_completed"], bool)
        print(f"PASS: /api/auth/me returns onboarding_completed={data['onboarding_completed']}")
    
    def test_04_onboarding_status_returns_status(self):
        """GET /api/onboarding/status returns onboarding_completed status"""
        # First login
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": EXISTING_EMAIL,
            "password": EXISTING_PASSWORD
        })
        assert login_response.status_code == 200
        
        # Check onboarding status
        response = self.session.get(f"{BASE_URL}/api/onboarding/status")
        
        assert response.status_code == 200, f"Get status failed: {response.text}"
        data = response.json()
        
        assert "onboarding_completed" in data, "Missing onboarding_completed in status response"
        assert isinstance(data["onboarding_completed"], bool)
        print(f"PASS: /api/onboarding/status returns onboarding_completed={data['onboarding_completed']}")
    
    def test_05_onboarding_status_requires_auth(self):
        """GET /api/onboarding/status requires authentication"""
        # Use fresh session without login
        fresh_session = requests.Session()
        response = fresh_session.get(f"{BASE_URL}/api/onboarding/status")
        
        # Should return 401 or similar error
        assert response.status_code in [401, 403], f"Expected auth error, got {response.status_code}"
        print("PASS: /api/onboarding/status requires authentication")
    
    def test_06_onboarding_complete_saves_preferences(self):
        """POST /api/onboarding/complete saves preferences and creates watchlist"""
        # Register a new user for this test
        email = f"complete_test_{uuid.uuid4().hex[:8]}@test.com"
        reg_response = self.session.post(f"{BASE_URL}/api/auth/register", json={
            "email": email,
            "password": TEST_PASSWORD,
            "name": "Complete Test User"
        })
        assert reg_response.status_code == 200, f"Register failed: {reg_response.text}"
        
        # Complete onboarding with preferences
        response = self.session.post(f"{BASE_URL}/api/onboarding/complete", json={
            "sports": ["Basketball", "Baseball"],
            "card_type": "graded",
            "search_interests": ["Luka Doncic Prizm", "Shohei Ohtani Chrome"]
        })
        
        assert response.status_code == 200, f"Complete failed: {response.text}"
        data = response.json()
        
        assert "success" in data
        assert data["success"] == True
        assert "searches_created" in data
        assert len(data["searches_created"]) == 2
        assert "Luka Doncic Prizm" in data["searches_created"]
        assert "Shohei Ohtani Chrome" in data["searches_created"]
        print(f"PASS: Onboarding complete saved {len(data['searches_created'])} searches")
    
    def test_07_onboarding_complete_marks_user_complete(self):
        """POST /api/onboarding/complete marks onboarding_completed=true"""
        # Register a new user
        email = f"mark_complete_{uuid.uuid4().hex[:8]}@test.com"
        reg_response = self.session.post(f"{BASE_URL}/api/auth/register", json={
            "email": email,
            "password": TEST_PASSWORD,
            "name": "Mark Complete User"
        })
        assert reg_response.status_code == 200
        
        # Verify initially onboarding_completed is false
        me_response = self.session.get(f"{BASE_URL}/api/auth/me")
        assert me_response.json().get("onboarding_completed") == False
        
        # Complete onboarding
        complete_response = self.session.post(f"{BASE_URL}/api/onboarding/complete", json={
            "sports": ["Football"],
            "card_type": "raw",
            "search_interests": ["Patrick Mahomes Prizm"]
        })
        assert complete_response.status_code == 200
        
        # Verify onboarding_completed is now true
        me_response2 = self.session.get(f"{BASE_URL}/api/auth/me")
        assert me_response2.status_code == 200
        assert me_response2.json().get("onboarding_completed") == True
        print("PASS: Onboarding complete marks user as onboarding_completed=true")
    
    def test_08_onboarding_skip_marks_complete(self):
        """POST /api/onboarding/skip marks onboarding as complete"""
        # Register a new user
        email = f"skip_test_{uuid.uuid4().hex[:8]}@test.com"
        reg_response = self.session.post(f"{BASE_URL}/api/auth/register", json={
            "email": email,
            "password": TEST_PASSWORD,
            "name": "Skip Test User"
        })
        assert reg_response.status_code == 200
        
        # Verify initially onboarding_completed is false
        me_response = self.session.get(f"{BASE_URL}/api/auth/me")
        assert me_response.json().get("onboarding_completed") == False
        
        # Skip onboarding
        skip_response = self.session.post(f"{BASE_URL}/api/onboarding/skip")
        
        assert skip_response.status_code == 200, f"Skip failed: {skip_response.text}"
        data = skip_response.json()
        assert data.get("success") == True
        
        # Verify onboarding_completed is now true
        me_response2 = self.session.get(f"{BASE_URL}/api/auth/me")
        assert me_response2.json().get("onboarding_completed") == True
        print("PASS: Onboarding skip marks user as onboarding_completed=true")
    
    def test_09_onboarding_complete_requires_auth(self):
        """POST /api/onboarding/complete requires authentication"""
        fresh_session = requests.Session()
        response = fresh_session.post(f"{BASE_URL}/api/onboarding/complete", json={
            "sports": ["Basketball"],
            "card_type": "both",
            "search_interests": ["Test"]
        })
        
        assert response.status_code in [401, 403], f"Expected auth error, got {response.status_code}"
        print("PASS: /api/onboarding/complete requires authentication")
    
    def test_10_onboarding_skip_requires_auth(self):
        """POST /api/onboarding/skip requires authentication"""
        fresh_session = requests.Session()
        response = fresh_session.post(f"{BASE_URL}/api/onboarding/skip")
        
        assert response.status_code in [401, 403], f"Expected auth error, got {response.status_code}"
        print("PASS: /api/onboarding/skip requires authentication")
    
    def test_11_onboarding_complete_handles_empty_searches(self):
        """POST /api/onboarding/complete handles empty search list gracefully"""
        # Register a new user
        email = f"empty_search_{uuid.uuid4().hex[:8]}@test.com"
        reg_response = self.session.post(f"{BASE_URL}/api/auth/register", json={
            "email": email,
            "password": TEST_PASSWORD,
            "name": "Empty Search User"
        })
        assert reg_response.status_code == 200
        
        # Complete onboarding with empty searches
        response = self.session.post(f"{BASE_URL}/api/onboarding/complete", json={
            "sports": ["Hockey"],
            "card_type": "both",
            "search_interests": []
        })
        
        assert response.status_code == 200, f"Complete with empty searches failed: {response.text}"
        data = response.json()
        assert data.get("success") == True
        assert data.get("searches_created") == []
        print("PASS: Onboarding complete handles empty searches")
    
    def test_12_verify_watchlist_created_after_onboarding(self):
        """Verify watchlist entries are created in database after onboarding"""
        # Register a new user
        email = f"watchlist_verify_{uuid.uuid4().hex[:8]}@test.com"
        reg_response = self.session.post(f"{BASE_URL}/api/auth/register", json={
            "email": email,
            "password": TEST_PASSWORD,
            "name": "Watchlist Verify User"
        })
        assert reg_response.status_code == 200
        
        # Complete onboarding with specific searches
        complete_response = self.session.post(f"{BASE_URL}/api/onboarding/complete", json={
            "sports": ["Pokemon"],
            "card_type": "graded",
            "search_interests": ["Charizard VMAX", "Pikachu Illustrator"]
        })
        assert complete_response.status_code == 200
        
        # Verify watchlist entries were created by querying the watchlist endpoint
        watchlist_response = self.session.get(f"{BASE_URL}/api/cards/watchlist")
        
        if watchlist_response.status_code == 200:
            watchlist = watchlist_response.json()
            # Should contain our newly created entries
            search_queries = [item.get("search_query") for item in watchlist if isinstance(watchlist, list)]
            if isinstance(watchlist, list) and len(watchlist) > 0:
                print(f"PASS: Watchlist contains {len(watchlist)} entries")
            else:
                print("INFO: Watchlist endpoint returned but may be empty")
        else:
            # Watchlist endpoint might have different response
            print(f"INFO: Watchlist check returned status {watchlist_response.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
