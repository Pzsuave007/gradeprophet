"""
Test Admin Panel Endpoints
Tests all admin-only endpoints: stats, users, inventory, plan changes, ban/unban, delete, transactions
Auth: Session cookies with admin email (pzsuave007@gmail.com) or is_admin=True
"""
import pytest
import requests
import os
import uuid
from datetime import datetime, timezone, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Admin email from the codebase
ADMIN_EMAIL = "pzsuave007@gmail.com"


class TestAdminEndpointsUnauthorized:
    """Test admin endpoints return 401 when not authenticated"""

    def test_stats_unauthorized(self):
        """GET /api/admin/stats should return 401 without auth"""
        response = requests.get(f"{BASE_URL}/api/admin/stats")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"

    def test_users_unauthorized(self):
        """GET /api/admin/users should return 401 without auth"""
        response = requests.get(f"{BASE_URL}/api/admin/users")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"

    def test_transactions_unauthorized(self):
        """GET /api/admin/transactions should return 401 without auth"""
        response = requests.get(f"{BASE_URL}/api/admin/transactions")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"


class TestAdminEndpointsNonAdmin:
    """Test admin endpoints return 403 for non-admin users"""
    
    @pytest.fixture(autouse=True)
    def setup_non_admin_user(self):
        """Create a non-admin user for testing"""
        self.test_email = f"TEST_nonadmin_{uuid.uuid4().hex[:8]}@test.com"
        self.test_password = "Test123!"
        self.test_name = "Non-Admin Test User"
        
        # Register user
        register_response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": self.test_email,
            "password": self.test_password,
            "name": self.test_name
        })
        
        if register_response.status_code != 200:
            pytest.skip(f"Failed to register non-admin user: {register_response.text}")
        
        # Extract session cookie
        self.session_cookie = register_response.cookies.get("session_token")
        if not self.session_cookie:
            pytest.skip("No session cookie returned from register")
        
        yield
        
        # Cleanup: Delete the test user
        try:
            requests.delete(f"{BASE_URL}/api/auth/logout", cookies={"session_token": self.session_cookie})
        except:
            pass

    def test_stats_forbidden_non_admin(self):
        """GET /api/admin/stats should return 403 for non-admin user"""
        response = requests.get(
            f"{BASE_URL}/api/admin/stats",
            cookies={"session_token": self.session_cookie}
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        assert "Admin access required" in response.text

    def test_users_forbidden_non_admin(self):
        """GET /api/admin/users should return 403 for non-admin user"""
        response = requests.get(
            f"{BASE_URL}/api/admin/users",
            cookies={"session_token": self.session_cookie}
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"

    def test_transactions_forbidden_non_admin(self):
        """GET /api/admin/transactions should return 403 for non-admin user"""
        response = requests.get(
            f"{BASE_URL}/api/admin/transactions",
            cookies={"session_token": self.session_cookie}
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"


class TestAdminEndpointsWithAdminUser:
    """Test admin endpoints with admin user (requires direct DB session creation)"""
    
    @pytest.fixture(scope="class")
    def admin_session(self):
        """
        Create an admin session by:
        1. First checking if admin user exists
        2. If not, create admin user
        3. Create session directly in database
        """
        import pymongo
        mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
        db_name = os.environ.get("DB_NAME", "test_database")
        
        client = pymongo.MongoClient(mongo_url)
        db = client[db_name]
        
        # Check/create admin user
        admin_user = db.users.find_one({"email": ADMIN_EMAIL.lower()})
        if not admin_user:
            # Create admin user
            user_id = f"admin_{uuid.uuid4().hex[:12]}"
            admin_user = {
                "user_id": user_id,
                "email": ADMIN_EMAIL.lower(),
                "name": "Admin User",
                "password_hash": None,  # Google auth user
                "picture": None,
                "auth_provider": "google",
                "is_admin": True,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            db.users.insert_one(admin_user)
            admin_user = db.users.find_one({"email": ADMIN_EMAIL.lower()})
        
        # Create session for admin
        session_token = f"sess_admin_test_{uuid.uuid4().hex}"
        expires_at = datetime.now(timezone.utc) + timedelta(days=7)
        
        db.user_sessions.insert_one({
            "user_id": admin_user["user_id"],
            "session_token": session_token,
            "expires_at": expires_at,
            "created_at": datetime.now(timezone.utc),
        })
        
        yield {"session_token": session_token, "user_id": admin_user["user_id"]}
        
        # Cleanup
        db.user_sessions.delete_many({"session_token": session_token})
        client.close()

    def test_admin_stats_returns_correct_data(self, admin_session):
        """GET /api/admin/stats should return platform stats for admin"""
        response = requests.get(
            f"{BASE_URL}/api/admin/stats",
            cookies={"session_token": admin_session["session_token"]}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Verify all expected fields are present
        expected_fields = [
            "total_users", "banned_users", "by_plan", "total_inventory",
            "total_scans", "total_transactions", "paid_transactions",
            "total_revenue", "recent_signups"
        ]
        for field in expected_fields:
            assert field in data, f"Missing field: {field}"
        
        # Verify data types
        assert isinstance(data["total_users"], int), "total_users should be int"
        assert isinstance(data["banned_users"], int), "banned_users should be int"
        assert isinstance(data["by_plan"], dict), "by_plan should be dict"
        assert isinstance(data["total_revenue"], (int, float)), "total_revenue should be numeric"
        print(f"Stats: {data}")

    def test_admin_users_returns_list(self, admin_session):
        """GET /api/admin/users should return list of users with enriched data"""
        response = requests.get(
            f"{BASE_URL}/api/admin/users",
            cookies={"session_token": admin_session["session_token"]}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "users" in data, "Response should contain 'users' key"
        assert "total" in data, "Response should contain 'total' key"
        assert isinstance(data["users"], list), "users should be list"
        
        # Check user structure if there are users
        if data["users"]:
            user = data["users"][0]
            # Should have enriched data
            assert "plan_id" in user, "User should have plan_id"
            assert "plan_status" in user, "User should have plan_status"
            assert "usage" in user, "User should have usage data"
            if user.get("usage"):
                assert "inventory" in user["usage"], "usage should have inventory"
                assert "scans" in user["usage"], "usage should have scans"
                assert "listings" in user["usage"], "usage should have listings"
        
        print(f"Total users: {data['total']}, Returned: {len(data['users'])}")

    def test_admin_users_search(self, admin_session):
        """GET /api/admin/users with search parameter"""
        response = requests.get(
            f"{BASE_URL}/api/admin/users",
            params={"search": "test"},
            cookies={"session_token": admin_session["session_token"]}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "users" in data
        print(f"Search 'test' returned {len(data['users'])} users")

    def test_admin_users_pagination(self, admin_session):
        """GET /api/admin/users with pagination parameters"""
        response = requests.get(
            f"{BASE_URL}/api/admin/users",
            params={"skip": 0, "limit": 5},
            cookies={"session_token": admin_session["session_token"]}
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data["users"]) <= 5, "Pagination limit should be respected"

    def test_admin_transactions_returns_list(self, admin_session):
        """GET /api/admin/transactions should return list of transactions"""
        response = requests.get(
            f"{BASE_URL}/api/admin/transactions",
            cookies={"session_token": admin_session["session_token"]}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "transactions" in data, "Response should contain 'transactions' key"
        assert "total" in data, "Response should contain 'total' key"
        assert isinstance(data["transactions"], list), "transactions should be list"
        
        # Check transaction structure if there are transactions
        if data["transactions"]:
            txn = data["transactions"][0]
            # Should have enriched user data
            assert "user_email" in txn, "Transaction should have user_email"
            assert "user_name" in txn, "Transaction should have user_name"
        
        print(f"Total transactions: {data['total']}")


class TestAdminUserActions:
    """Test admin user management actions: ban, plan change, delete"""
    
    @pytest.fixture(scope="class")
    def admin_session_and_test_user(self):
        """Create admin session and a test user to perform actions on"""
        import pymongo
        mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
        db_name = os.environ.get("DB_NAME", "test_database")
        
        client = pymongo.MongoClient(mongo_url)
        db = client[db_name]
        
        # Get/create admin user
        admin_user = db.users.find_one({"email": ADMIN_EMAIL.lower()})
        if not admin_user:
            user_id = f"admin_{uuid.uuid4().hex[:12]}"
            admin_user = {
                "user_id": user_id,
                "email": ADMIN_EMAIL.lower(),
                "name": "Admin User",
                "password_hash": None,
                "picture": None,
                "auth_provider": "google",
                "is_admin": True,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            db.users.insert_one(admin_user)
            admin_user = db.users.find_one({"email": ADMIN_EMAIL.lower()})
        
        # Create admin session
        admin_session_token = f"sess_admin_actions_{uuid.uuid4().hex}"
        expires_at = datetime.now(timezone.utc) + timedelta(days=7)
        db.user_sessions.insert_one({
            "user_id": admin_user["user_id"],
            "session_token": admin_session_token,
            "expires_at": expires_at,
            "created_at": datetime.now(timezone.utc),
        })
        
        # Create test user to perform actions on
        test_user_id = f"TEST_user_{uuid.uuid4().hex[:12]}"
        test_user = {
            "user_id": test_user_id,
            "email": f"TEST_actionuser_{uuid.uuid4().hex[:8]}@test.com",
            "name": "Test User For Actions",
            "password_hash": None,
            "picture": None,
            "auth_provider": "email",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "banned": False,
        }
        db.users.insert_one(test_user)
        
        # Create subscription for test user
        db.subscriptions.insert_one({
            "user_id": test_user_id,
            "plan_id": "rookie",
            "status": "active",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        
        # Create some inventory items
        db.inventory.insert_one({
            "user_id": test_user_id,
            "card_name": "Test Card",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        
        yield {
            "admin_session_token": admin_session_token,
            "admin_user_id": admin_user["user_id"],
            "test_user_id": test_user_id,
            "test_user_email": test_user["email"],
        }
        
        # Cleanup
        db.user_sessions.delete_many({"session_token": admin_session_token})
        db.users.delete_many({"user_id": test_user_id})
        db.subscriptions.delete_many({"user_id": test_user_id})
        db.inventory.delete_many({"user_id": test_user_id})
        db.card_analyses.delete_many({"user_id": test_user_id})
        client.close()

    def test_get_user_inventory(self, admin_session_and_test_user):
        """GET /api/admin/users/{user_id}/inventory should return user's inventory"""
        session = admin_session_and_test_user
        response = requests.get(
            f"{BASE_URL}/api/admin/users/{session['test_user_id']}/inventory",
            cookies={"session_token": session["admin_session_token"]}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "items" in data, "Response should contain 'items'"
        assert "total" in data, "Response should contain 'total'"
        assert "user_email" in data, "Response should contain 'user_email'"
        assert data["total"] >= 1, "Should have at least 1 inventory item"
        print(f"User inventory: {data['total']} items")

    def test_get_user_inventory_not_found(self, admin_session_and_test_user):
        """GET /api/admin/users/{user_id}/inventory should return 404 for non-existent user"""
        session = admin_session_and_test_user
        response = requests.get(
            f"{BASE_URL}/api/admin/users/nonexistent_user_id/inventory",
            cookies={"session_token": session["admin_session_token"]}
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"

    def test_change_user_plan(self, admin_session_and_test_user):
        """PUT /api/admin/users/{user_id}/plan should change user's plan"""
        session = admin_session_and_test_user
        
        # Change to all_star
        response = requests.put(
            f"{BASE_URL}/api/admin/users/{session['test_user_id']}/plan",
            json={"plan_id": "all_star"},
            cookies={"session_token": session["admin_session_token"]}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["success"] is True
        assert data["new_plan"] == "all_star"
        
        # Verify by fetching users
        users_response = requests.get(
            f"{BASE_URL}/api/admin/users",
            params={"search": session["test_user_email"]},
            cookies={"session_token": session["admin_session_token"]}
        )
        users_data = users_response.json()
        if users_data["users"]:
            found_user = next((u for u in users_data["users"] if u.get("user_id") == session["test_user_id"]), None)
            if found_user:
                assert found_user["plan_id"] == "all_star", "Plan should be updated to all_star"
        
        print(f"Plan changed to all_star for user {session['test_user_id']}")

    def test_change_user_plan_invalid(self, admin_session_and_test_user):
        """PUT /api/admin/users/{user_id}/plan should reject invalid plan"""
        session = admin_session_and_test_user
        
        response = requests.put(
            f"{BASE_URL}/api/admin/users/{session['test_user_id']}/plan",
            json={"plan_id": "invalid_plan"},
            cookies={"session_token": session["admin_session_token"]}
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        assert "Invalid plan" in response.text

    def test_change_user_plan_user_not_found(self, admin_session_and_test_user):
        """PUT /api/admin/users/{user_id}/plan should return 404 for non-existent user"""
        session = admin_session_and_test_user
        
        response = requests.put(
            f"{BASE_URL}/api/admin/users/nonexistent_user_id/plan",
            json={"plan_id": "all_star"},
            cookies={"session_token": session["admin_session_token"]}
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"

    def test_ban_user(self, admin_session_and_test_user):
        """PUT /api/admin/users/{user_id}/ban should toggle ban status"""
        session = admin_session_and_test_user
        
        # Ban user
        response = requests.put(
            f"{BASE_URL}/api/admin/users/{session['test_user_id']}/ban",
            cookies={"session_token": session["admin_session_token"]}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["success"] is True
        assert data["banned"] is True, "User should be banned"
        
        # Unban user (toggle again)
        response2 = requests.put(
            f"{BASE_URL}/api/admin/users/{session['test_user_id']}/ban",
            cookies={"session_token": session["admin_session_token"]}
        )
        assert response2.status_code == 200
        data2 = response2.json()
        assert data2["banned"] is False, "User should be unbanned"
        
        print(f"Ban/unban toggle working for user {session['test_user_id']}")

    def test_ban_user_not_found(self, admin_session_and_test_user):
        """PUT /api/admin/users/{user_id}/ban should return 404 for non-existent user"""
        session = admin_session_and_test_user
        
        response = requests.put(
            f"{BASE_URL}/api/admin/users/nonexistent_user_id/ban",
            cookies={"session_token": session["admin_session_token"]}
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"


class TestAdminDeleteUser:
    """Test admin delete user functionality - separate class for cleanup"""
    
    @pytest.fixture
    def admin_session_and_deletable_user(self):
        """Create admin session and a user specifically for deletion testing"""
        import pymongo
        mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
        db_name = os.environ.get("DB_NAME", "test_database")
        
        client = pymongo.MongoClient(mongo_url)
        db = client[db_name]
        
        # Get/create admin user
        admin_user = db.users.find_one({"email": ADMIN_EMAIL.lower()})
        if not admin_user:
            user_id = f"admin_{uuid.uuid4().hex[:12]}"
            admin_user = {
                "user_id": user_id,
                "email": ADMIN_EMAIL.lower(),
                "name": "Admin User",
                "password_hash": None,
                "picture": None,
                "auth_provider": "google",
                "is_admin": True,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            db.users.insert_one(admin_user)
            admin_user = db.users.find_one({"email": ADMIN_EMAIL.lower()})
        
        # Create admin session
        admin_session_token = f"sess_admin_delete_{uuid.uuid4().hex}"
        expires_at = datetime.now(timezone.utc) + timedelta(days=7)
        db.user_sessions.insert_one({
            "user_id": admin_user["user_id"],
            "session_token": admin_session_token,
            "expires_at": expires_at,
            "created_at": datetime.now(timezone.utc),
        })
        
        # Create test user to delete
        delete_user_id = f"TEST_delete_{uuid.uuid4().hex[:12]}"
        delete_user_email = f"TEST_deleteuser_{uuid.uuid4().hex[:8]}@test.com"
        delete_user = {
            "user_id": delete_user_id,
            "email": delete_user_email,
            "name": "User To Delete",
            "password_hash": None,
            "picture": None,
            "auth_provider": "email",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        db.users.insert_one(delete_user)
        
        # Create related data
        db.subscriptions.insert_one({"user_id": delete_user_id, "plan_id": "rookie"})
        db.inventory.insert_one({"user_id": delete_user_id, "card_name": "Card to delete"})
        db.card_analyses.insert_one({"user_id": delete_user_id, "analysis": "test"})
        db.user_sessions.insert_one({"user_id": delete_user_id, "session_token": "test_sess"})
        db.payment_transactions.insert_one({"user_id": delete_user_id, "amount": 10})
        
        yield {
            "admin_session_token": admin_session_token,
            "admin_user_id": admin_user["user_id"],
            "delete_user_id": delete_user_id,
            "delete_user_email": delete_user_email,
            "client": client,
            "db": db,
        }
        
        # Cleanup admin session
        db.user_sessions.delete_many({"session_token": admin_session_token})
        client.close()

    def test_delete_user_success(self, admin_session_and_deletable_user):
        """DELETE /api/admin/users/{user_id} should delete user and all their data"""
        session = admin_session_and_deletable_user
        
        response = requests.delete(
            f"{BASE_URL}/api/admin/users/{session['delete_user_id']}",
            cookies={"session_token": session["admin_session_token"]}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["success"] is True
        assert data["deleted_email"] == session["delete_user_email"]
        
        # Verify user is deleted
        db = session["db"]
        user = db.users.find_one({"user_id": session["delete_user_id"]})
        assert user is None, "User should be deleted from database"
        
        # Verify related data is deleted
        assert db.inventory.count_documents({"user_id": session["delete_user_id"]}) == 0
        assert db.subscriptions.count_documents({"user_id": session["delete_user_id"]}) == 0
        assert db.card_analyses.count_documents({"user_id": session["delete_user_id"]}) == 0
        
        print(f"User {session['delete_user_email']} and all data deleted successfully")

    def test_delete_user_not_found(self, admin_session_and_deletable_user):
        """DELETE /api/admin/users/{user_id} should return 404 for non-existent user"""
        session = admin_session_and_deletable_user
        
        response = requests.delete(
            f"{BASE_URL}/api/admin/users/nonexistent_user_id",
            cookies={"session_token": session["admin_session_token"]}
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"

    def test_cannot_delete_admin(self, admin_session_and_deletable_user):
        """DELETE /api/admin/users/{user_id} should prevent deleting admin account"""
        session = admin_session_and_deletable_user
        
        response = requests.delete(
            f"{BASE_URL}/api/admin/users/{session['admin_user_id']}",
            cookies={"session_token": session["admin_session_token"]}
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        assert "Cannot delete admin" in response.text


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
