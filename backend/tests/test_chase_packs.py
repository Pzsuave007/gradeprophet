"""
Chase Pack Management API Tests
Tests for FlipSlab Engine Chase Card Pack management endpoints:
- PATCH /api/ebay/chase/{pack_id} - edit title and price
- POST /api/ebay/chase/{pack_id}/pause - pause active pack
- POST /api/ebay/chase/{pack_id}/resume - resume paused pack
- POST /api/ebay/chase/{pack_id}/end - end pack
- POST /api/ebay/chase/{pack_id}/unassign - unassign a buyer
- POST /api/ebay/chase/{pack_id}/regenerate-code - regenerate claim code
- POST /api/ebay/chase/{pack_id}/change-chase - change chase card
- POST /api/ebay/chase/{pack_id}/sync-ebay - sync to eBay
- DELETE /api/ebay/chase/{pack_id} - delete pack
- GET /api/ebay/chase-packs - list all packs
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
DEV_TOKEN = "dev_flipslab_access"
TEST_PACK_ID = "chase_test_demo_001"


@pytest.fixture
def auth_session():
    """Session with dev token authentication."""
    session = requests.Session()
    session.cookies.set("session_token", DEV_TOKEN)
    session.headers.update({"Content-Type": "application/json"})
    return session


class TestChasePacksListEndpoint:
    """Tests for GET /api/ebay/chase-packs"""

    def test_get_chase_packs_requires_auth(self):
        """Verify endpoint requires authentication."""
        response = requests.get(f"{BASE_URL}/api/ebay/chase-packs")
        assert response.status_code == 401

    def test_get_chase_packs_with_auth(self, auth_session):
        """Verify endpoint returns packs list with auth."""
        response = auth_session.get(f"{BASE_URL}/api/ebay/chase-packs")
        assert response.status_code == 200
        data = response.json()
        assert "packs" in data
        assert isinstance(data["packs"], list)
        print(f"Found {len(data['packs'])} chase packs")

    def test_chase_pack_structure(self, auth_session):
        """Verify pack structure has required fields."""
        response = auth_session.get(f"{BASE_URL}/api/ebay/chase-packs")
        assert response.status_code == 200
        data = response.json()
        if data["packs"]:
            pack = data["packs"][0]
            required_fields = ["pack_id", "title", "price", "status", "total_spots", "spots_claimed"]
            for field in required_fields:
                assert field in pack, f"Missing field: {field}"
            print(f"Pack structure verified: {pack.get('pack_id')}")


class TestEditChasePackEndpoint:
    """Tests for PATCH /api/ebay/chase/{pack_id}"""

    def test_edit_pack_requires_auth(self):
        """Verify endpoint requires authentication."""
        response = requests.patch(f"{BASE_URL}/api/ebay/chase/{TEST_PACK_ID}", json={"title": "Test"})
        assert response.status_code == 401

    def test_edit_pack_title(self, auth_session):
        """Test editing pack title."""
        # First get current title
        packs_res = auth_session.get(f"{BASE_URL}/api/ebay/chase-packs")
        packs = packs_res.json().get("packs", [])
        test_pack = next((p for p in packs if p["pack_id"] == TEST_PACK_ID), None)
        
        if not test_pack:
            pytest.skip(f"Test pack {TEST_PACK_ID} not found")
        
        original_title = test_pack["title"]
        new_title = "Test Title Update"
        
        response = auth_session.patch(
            f"{BASE_URL}/api/ebay/chase/{TEST_PACK_ID}",
            json={"title": new_title}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert "updates" in data
        print(f"Title updated: {data.get('updates')}")
        
        # Restore original title
        auth_session.patch(f"{BASE_URL}/api/ebay/chase/{TEST_PACK_ID}", json={"title": original_title})

    def test_edit_pack_price(self, auth_session):
        """Test editing pack price."""
        packs_res = auth_session.get(f"{BASE_URL}/api/ebay/chase-packs")
        packs = packs_res.json().get("packs", [])
        test_pack = next((p for p in packs if p["pack_id"] == TEST_PACK_ID), None)
        
        if not test_pack:
            pytest.skip(f"Test pack {TEST_PACK_ID} not found")
        
        original_price = test_pack["price"]
        new_price = 15.99
        
        response = auth_session.patch(
            f"{BASE_URL}/api/ebay/chase/{TEST_PACK_ID}",
            json={"price": new_price}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        print(f"Price updated: {data.get('updates')}")
        
        # Restore original price
        auth_session.patch(f"{BASE_URL}/api/ebay/chase/{TEST_PACK_ID}", json={"price": original_price})

    def test_edit_pack_not_found(self, auth_session):
        """Test editing non-existent pack."""
        response = auth_session.patch(
            f"{BASE_URL}/api/ebay/chase/nonexistent_pack_123",
            json={"title": "Test"}
        )
        assert response.status_code == 404

    def test_edit_pack_no_changes(self, auth_session):
        """Test editing with no changes."""
        response = auth_session.patch(
            f"{BASE_URL}/api/ebay/chase/{TEST_PACK_ID}",
            json={}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == False
        assert "No changes" in data.get("error", "")


class TestPauseResumeEndpoints:
    """Tests for pause/resume endpoints."""

    def test_pause_pack_requires_auth(self):
        """Verify pause endpoint requires authentication."""
        response = requests.post(f"{BASE_URL}/api/ebay/chase/{TEST_PACK_ID}/pause")
        assert response.status_code == 401

    def test_resume_pack_requires_auth(self):
        """Verify resume endpoint requires authentication."""
        response = requests.post(f"{BASE_URL}/api/ebay/chase/{TEST_PACK_ID}/resume")
        assert response.status_code == 401

    def test_pause_active_pack(self, auth_session):
        """Test pausing an active pack."""
        # First check pack status
        packs_res = auth_session.get(f"{BASE_URL}/api/ebay/chase-packs")
        packs = packs_res.json().get("packs", [])
        test_pack = next((p for p in packs if p["pack_id"] == TEST_PACK_ID), None)
        
        if not test_pack:
            pytest.skip(f"Test pack {TEST_PACK_ID} not found")
        
        original_status = test_pack["status"]
        
        if original_status == "active":
            response = auth_session.post(f"{BASE_URL}/api/ebay/chase/{TEST_PACK_ID}/pause")
            assert response.status_code == 200
            data = response.json()
            assert data.get("success") == True
            assert "paused" in data.get("message", "").lower()
            print(f"Pack paused successfully")
            
            # Resume it back
            auth_session.post(f"{BASE_URL}/api/ebay/chase/{TEST_PACK_ID}/resume")
        elif original_status == "paused":
            # Pack is already paused, try to pause again (should fail)
            response = auth_session.post(f"{BASE_URL}/api/ebay/chase/{TEST_PACK_ID}/pause")
            assert response.status_code == 200
            data = response.json()
            assert data.get("success") == False
            print(f"Pack already paused - correct behavior")
        else:
            pytest.skip(f"Pack status is {original_status}, cannot test pause")

    def test_resume_paused_pack(self, auth_session):
        """Test resuming a paused pack."""
        packs_res = auth_session.get(f"{BASE_URL}/api/ebay/chase-packs")
        packs = packs_res.json().get("packs", [])
        test_pack = next((p for p in packs if p["pack_id"] == TEST_PACK_ID), None)
        
        if not test_pack:
            pytest.skip(f"Test pack {TEST_PACK_ID} not found")
        
        original_status = test_pack["status"]
        
        if original_status == "paused":
            response = auth_session.post(f"{BASE_URL}/api/ebay/chase/{TEST_PACK_ID}/resume")
            assert response.status_code == 200
            data = response.json()
            assert data.get("success") == True
            assert "resumed" in data.get("message", "").lower()
            print(f"Pack resumed successfully")
        elif original_status == "active":
            # First pause, then resume
            auth_session.post(f"{BASE_URL}/api/ebay/chase/{TEST_PACK_ID}/pause")
            response = auth_session.post(f"{BASE_URL}/api/ebay/chase/{TEST_PACK_ID}/resume")
            assert response.status_code == 200
            data = response.json()
            assert data.get("success") == True
            print(f"Pack paused and resumed successfully")
        else:
            pytest.skip(f"Pack status is {original_status}, cannot test resume")


class TestEndPackEndpoint:
    """Tests for POST /api/ebay/chase/{pack_id}/end"""

    def test_end_pack_requires_auth(self):
        """Verify end endpoint requires authentication."""
        response = requests.post(f"{BASE_URL}/api/ebay/chase/{TEST_PACK_ID}/end")
        assert response.status_code == 401

    def test_end_pack_not_found(self, auth_session):
        """Test ending non-existent pack."""
        response = auth_session.post(f"{BASE_URL}/api/ebay/chase/nonexistent_pack_123/end")
        assert response.status_code == 404


class TestUnassignBuyerEndpoint:
    """Tests for POST /api/ebay/chase/{pack_id}/unassign"""

    def test_unassign_requires_auth(self):
        """Verify unassign endpoint requires authentication."""
        response = requests.post(
            f"{BASE_URL}/api/ebay/chase/{TEST_PACK_ID}/unassign",
            json={"card_id": "test"}
        )
        assert response.status_code == 401

    def test_unassign_requires_card_id(self, auth_session):
        """Test unassign without card_id."""
        response = auth_session.post(
            f"{BASE_URL}/api/ebay/chase/{TEST_PACK_ID}/unassign",
            json={}
        )
        assert response.status_code == 400

    def test_unassign_pack_not_found(self, auth_session):
        """Test unassign on non-existent pack."""
        response = auth_session.post(
            f"{BASE_URL}/api/ebay/chase/nonexistent_pack_123/unassign",
            json={"card_id": "test"}
        )
        assert response.status_code == 404

    def test_unassign_card_not_found(self, auth_session):
        """Test unassign with invalid card_id."""
        response = auth_session.post(
            f"{BASE_URL}/api/ebay/chase/{TEST_PACK_ID}/unassign",
            json={"card_id": "invalid_card_id_123"}
        )
        # Should return 400 (card not found in pack)
        assert response.status_code == 400


class TestRegenerateCodeEndpoint:
    """Tests for POST /api/ebay/chase/{pack_id}/regenerate-code"""

    def test_regenerate_requires_auth(self):
        """Verify regenerate endpoint requires authentication."""
        response = requests.post(
            f"{BASE_URL}/api/ebay/chase/{TEST_PACK_ID}/regenerate-code",
            json={"card_id": "test"}
        )
        assert response.status_code == 401

    def test_regenerate_requires_card_id(self, auth_session):
        """Test regenerate without card_id."""
        response = auth_session.post(
            f"{BASE_URL}/api/ebay/chase/{TEST_PACK_ID}/regenerate-code",
            json={}
        )
        assert response.status_code == 400

    def test_regenerate_pack_not_found(self, auth_session):
        """Test regenerate on non-existent pack."""
        response = auth_session.post(
            f"{BASE_URL}/api/ebay/chase/nonexistent_pack_123/regenerate-code",
            json={"card_id": "test"}
        )
        assert response.status_code == 404

    def test_regenerate_with_valid_card(self, auth_session):
        """Test regenerate code with valid card from pack."""
        # Get pack details to find a valid card_id
        packs_res = auth_session.get(f"{BASE_URL}/api/ebay/chase-packs")
        packs = packs_res.json().get("packs", [])
        test_pack = next((p for p in packs if p["pack_id"] == TEST_PACK_ID), None)
        
        if not test_pack or not test_pack.get("cards"):
            pytest.skip(f"Test pack {TEST_PACK_ID} not found or has no cards")
        
        # Find an assigned card to regenerate code for
        assigned_card = next((c for c in test_pack["cards"] if c.get("assigned_to")), None)
        if not assigned_card:
            pytest.skip("No assigned cards to test regenerate-code")
        
        card_id = assigned_card["card_id"]
        response = auth_session.post(
            f"{BASE_URL}/api/ebay/chase/{TEST_PACK_ID}/regenerate-code",
            json={"card_id": card_id}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert "new_code" in data
        assert len(data["new_code"]) == 8  # UUID hex[:8]
        print(f"New code generated: {data['new_code']}")


class TestChangeChaseCardEndpoint:
    """Tests for POST /api/ebay/chase/{pack_id}/change-chase"""

    def test_change_chase_requires_auth(self):
        """Verify change-chase endpoint requires authentication."""
        response = requests.post(
            f"{BASE_URL}/api/ebay/chase/{TEST_PACK_ID}/change-chase",
            json={"card_id": "test"}
        )
        assert response.status_code == 401

    def test_change_chase_requires_card_id(self, auth_session):
        """Test change-chase without card_id."""
        response = auth_session.post(
            f"{BASE_URL}/api/ebay/chase/{TEST_PACK_ID}/change-chase",
            json={}
        )
        assert response.status_code == 400

    def test_change_chase_pack_not_found(self, auth_session):
        """Test change-chase on non-existent pack."""
        response = auth_session.post(
            f"{BASE_URL}/api/ebay/chase/nonexistent_pack_123/change-chase",
            json={"card_id": "test"}
        )
        assert response.status_code == 404


class TestSyncEbayEndpoint:
    """Tests for POST /api/ebay/chase/{pack_id}/sync-ebay"""

    def test_sync_requires_auth(self):
        """Verify sync-ebay endpoint requires authentication."""
        response = requests.post(f"{BASE_URL}/api/ebay/chase/{TEST_PACK_ID}/sync-ebay")
        assert response.status_code == 401

    def test_sync_pack_not_found(self, auth_session):
        """Test sync on non-existent pack."""
        response = auth_session.post(f"{BASE_URL}/api/ebay/chase/nonexistent_pack_123/sync-ebay")
        assert response.status_code == 404

    def test_sync_demo_pack_returns_error(self, auth_session):
        """Test sync on demo pack (no real eBay listing)."""
        response = auth_session.post(f"{BASE_URL}/api/ebay/chase/{TEST_PACK_ID}/sync-ebay")
        assert response.status_code == 200
        data = response.json()
        # Demo pack has ebay_item_id = DEMO_123456, should return error
        assert data.get("success") == False
        assert "No eBay listing linked" in data.get("error", "")
        print(f"Sync correctly returned error for demo pack: {data.get('error')}")


class TestDeletePackEndpoint:
    """Tests for DELETE /api/ebay/chase/{pack_id}"""

    def test_delete_requires_auth(self):
        """Verify delete endpoint requires authentication."""
        response = requests.delete(f"{BASE_URL}/api/ebay/chase/{TEST_PACK_ID}")
        assert response.status_code == 401

    def test_delete_pack_not_found(self, auth_session):
        """Test deleting non-existent pack."""
        response = auth_session.delete(f"{BASE_URL}/api/ebay/chase/nonexistent_pack_123")
        assert response.status_code == 404

    # Note: We don't actually delete the test pack to preserve test data


class TestPublicChasePackEndpoint:
    """Tests for GET /api/ebay/chase/{pack_id} (public reveal page)"""

    def test_get_public_pack_info(self):
        """Test public endpoint for reveal page."""
        response = requests.get(f"{BASE_URL}/api/ebay/chase/{TEST_PACK_ID}")
        assert response.status_code == 200
        data = response.json()
        assert "title" in data
        assert "price" in data
        assert "status" in data
        assert "cards" in data
        print(f"Public pack info: {data.get('title')}, {len(data.get('cards', []))} cards")

    def test_get_public_pack_not_found(self):
        """Test public endpoint with invalid pack_id."""
        response = requests.get(f"{BASE_URL}/api/ebay/chase/nonexistent_pack_123")
        assert response.status_code == 404


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
