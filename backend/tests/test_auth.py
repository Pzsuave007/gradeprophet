"""
Authentication API Tests for FlipSlab Engine
Tests: /api/auth/register, /api/auth/login, /api/auth/me, /api/auth/logout
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://bulk-listing-update.preview.emergentagent.com')

class TestAuthRegister:
    """Test user registration endpoint"""

    def test_register_success(self):
        """POST /api/auth/register creates a new user account"""
        unique_email = f"test_{uuid.uuid4().hex[:8]}@flipslab.com"
        payload = {
            "email": unique_email,
            "password": "testpass123",
            "name": "Test User"
        }
        response = requests.post(f"{BASE_URL}/api/auth/register", json=payload)
        
        # Status code assertion
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Data assertions
        data = response.json()
        assert "user_id" in data, "Response should contain user_id"
        assert data["email"] == unique_email.lower(), f"Email mismatch: expected {unique_email.lower()}, got {data.get('email')}"
        assert data["name"] == "Test User", f"Name mismatch: expected 'Test User', got {data.get('name')}"
        
        # Verify session cookie is set
        assert "session_token" in response.cookies, "Session cookie should be set after registration"

    def test_register_duplicate_email(self):
        """POST /api/auth/register with duplicate email returns 400 error"""
        # Use existing test user email
        payload = {
            "email": "test@flipslab.com",
            "password": "test123",
            "name": "Duplicate User"
        }
        response = requests.post(f"{BASE_URL}/api/auth/register", json=payload)
        
        # Should return 400 for duplicate email
        assert response.status_code == 400, f"Expected 400 for duplicate email, got {response.status_code}: {response.text}"
        
        # Verify error message
        data = response.json()
        assert "detail" in data, "Error response should have detail field"
        assert "already" in data["detail"].lower() or "registered" in data["detail"].lower(), f"Error should mention duplicate: {data['detail']}"


class TestAuthLogin:
    """Test user login endpoint"""

    def test_login_success(self):
        """POST /api/auth/login with valid credentials returns user data and sets session cookie"""
        payload = {
            "email": "test@flipslab.com",
            "password": "test123"
        }
        response = requests.post(f"{BASE_URL}/api/auth/login", json=payload)
        
        # Status code assertion
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Data assertions
        data = response.json()
        assert "user_id" in data, "Response should contain user_id"
        assert data["email"] == "test@flipslab.com", f"Email mismatch: expected test@flipslab.com, got {data.get('email')}"
        assert "name" in data, "Response should contain name"
        
        # Verify session cookie is set
        assert "session_token" in response.cookies, "Session cookie should be set after login"

    def test_login_invalid_credentials(self):
        """POST /api/auth/login with invalid credentials returns 401"""
        payload = {
            "email": "test@flipslab.com",
            "password": "wrongpassword"
        }
        response = requests.post(f"{BASE_URL}/api/auth/login", json=payload)
        
        # Status code assertion
        assert response.status_code == 401, f"Expected 401 for invalid password, got {response.status_code}: {response.text}"
        
        # Verify error message
        data = response.json()
        assert "detail" in data, "Error response should have detail field"

    def test_login_nonexistent_user(self):
        """POST /api/auth/login with non-existent email returns 401"""
        payload = {
            "email": "nonexistent@flipslab.com",
            "password": "anypassword"
        }
        response = requests.post(f"{BASE_URL}/api/auth/login", json=payload)
        
        # Status code assertion
        assert response.status_code == 401, f"Expected 401 for non-existent user, got {response.status_code}: {response.text}"


class TestAuthMe:
    """Test /api/auth/me endpoint"""

    def test_auth_me_with_valid_session(self):
        """GET /api/auth/me with valid session cookie returns user data"""
        # First login to get session
        login_payload = {
            "email": "test@flipslab.com",
            "password": "test123"
        }
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json=login_payload)
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        
        # Get session cookie
        session = requests.Session()
        session.cookies.update(login_response.cookies)
        
        # Call /api/auth/me with session
        me_response = session.get(f"{BASE_URL}/api/auth/me")
        
        # Status code assertion
        assert me_response.status_code == 200, f"Expected 200, got {me_response.status_code}: {me_response.text}"
        
        # Data assertions
        data = me_response.json()
        assert "user_id" in data, "Response should contain user_id"
        assert data["email"] == "test@flipslab.com", f"Email mismatch: expected test@flipslab.com, got {data.get('email')}"

    def test_auth_me_without_session(self):
        """GET /api/auth/me without session returns 401"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        
        # Status code assertion
        assert response.status_code == 401, f"Expected 401 without session, got {response.status_code}: {response.text}"


class TestAuthLogout:
    """Test logout endpoint"""

    def test_logout_clears_session(self):
        """POST /api/auth/logout clears the session"""
        # First login
        login_payload = {
            "email": "test@flipslab.com",
            "password": "test123"
        }
        session = requests.Session()
        login_response = session.post(f"{BASE_URL}/api/auth/login", json=login_payload)
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        
        # Verify we're logged in
        me_response = session.get(f"{BASE_URL}/api/auth/me")
        assert me_response.status_code == 200, "Should be authenticated after login"
        
        # Logout
        logout_response = session.post(f"{BASE_URL}/api/auth/logout")
        assert logout_response.status_code == 200, f"Logout failed: {logout_response.text}"
        
        # Verify logout response
        data = logout_response.json()
        assert data.get("success") == True, "Logout should return success: true"


class TestFullAuthFlow:
    """Test complete authentication flow"""

    def test_register_login_me_logout_flow(self):
        """Complete auth flow: register -> login -> me -> logout"""
        unique_email = f"flowtest_{uuid.uuid4().hex[:8]}@flipslab.com"
        session = requests.Session()
        
        # 1. Register
        register_payload = {
            "email": unique_email,
            "password": "flowtest123",
            "name": "Flow Test User"
        }
        reg_response = session.post(f"{BASE_URL}/api/auth/register", json=register_payload)
        assert reg_response.status_code == 200, f"Register failed: {reg_response.text}"
        
        reg_data = reg_response.json()
        user_id = reg_data.get("user_id")
        assert user_id, "Should get user_id from registration"
        
        # 2. Logout first to test login
        session.post(f"{BASE_URL}/api/auth/logout")
        
        # 3. Login with new credentials
        login_payload = {
            "email": unique_email,
            "password": "flowtest123"
        }
        login_response = session.post(f"{BASE_URL}/api/auth/login", json=login_payload)
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        
        # 4. Check /me
        me_response = session.get(f"{BASE_URL}/api/auth/me")
        assert me_response.status_code == 200, f"Auth/me failed: {me_response.text}"
        
        me_data = me_response.json()
        assert me_data["email"] == unique_email.lower(), "Email should match"
        assert me_data["name"] == "Flow Test User", "Name should match"
        
        # 5. Logout
        logout_response = session.post(f"{BASE_URL}/api/auth/logout")
        assert logout_response.status_code == 200, f"Logout failed: {logout_response.text}"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
