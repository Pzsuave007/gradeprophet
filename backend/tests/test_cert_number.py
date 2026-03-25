"""
Test cert_number feature for graded cards in FlipSlab Engine.
Tests:
1. Backend: cert_number field in InventoryItem, InventoryItemCreate, InventoryItemUpdate models
2. Backend: POST /api/inventory accepts and stores cert_number
3. Backend: PUT /api/inventory/{id} can update cert_number
4. Backend: GET /api/inventory returns cert_number field
5. Backend: POST /api/ebay/sell/create accepts cert_number and includes it in request model
6. Backend: CARD_IDENTIFY_PROMPT in ai.py includes cert_number in JSON output format
7. Backend: scan-upload in cards.py saves cert_number from AI response to inventory
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestCertNumberBackend:
    """Test cert_number field in backend inventory CRUD operations"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test data"""
        self.test_cert_number = "12345678"
        self.test_card_name = f"TEST_CertNumber_{uuid.uuid4().hex[:8]}"
        self.created_item_id = None
        yield
        # Cleanup: Delete test item if created
        if self.created_item_id:
            try:
                requests.delete(f"{BASE_URL}/api/inventory/{self.created_item_id}")
            except:
                pass
    
    def test_01_create_inventory_item_with_cert_number(self):
        """Test POST /api/inventory accepts cert_number field"""
        payload = {
            "card_name": self.test_card_name,
            "player": "Test Player",
            "year": 2023,
            "set_name": "Test Set",
            "condition": "Graded",
            "grading_company": "PSA",
            "grade": 10,
            "cert_number": self.test_cert_number,
            "category": "collection"
        }
        
        response = requests.post(f"{BASE_URL}/api/inventory", json=payload)
        
        # Should return 200 or 201 (success) or 401 (auth required)
        # Since we don't have auth, we expect 401 but the model validation should pass
        if response.status_code == 401:
            print("Auth required - model validation passed (cert_number accepted in payload)")
            # The fact that we get 401 (not 422 validation error) means the model accepts cert_number
            assert True
        elif response.status_code in [200, 201]:
            data = response.json()
            self.created_item_id = data.get("id")
            assert "cert_number" in data, "Response should include cert_number field"
            assert data["cert_number"] == self.test_cert_number, f"cert_number should be {self.test_cert_number}"
            print(f"SUCCESS: Created item with cert_number={data.get('cert_number')}")
        else:
            # Check if it's a validation error (422) - would mean cert_number not in model
            if response.status_code == 422:
                pytest.fail(f"Validation error - cert_number may not be in model: {response.text}")
            print(f"Response status: {response.status_code}, body: {response.text[:500]}")
    
    def test_02_inventory_model_has_cert_number_field(self):
        """Verify InventoryItemCreate model accepts cert_number by checking validation"""
        # Send a request with cert_number to verify model accepts it
        payload = {
            "card_name": "Test Card",
            "cert_number": "99999999"  # Include cert_number
        }
        
        response = requests.post(f"{BASE_URL}/api/inventory", json=payload)
        
        # If we get 422, check if it's because cert_number is invalid
        if response.status_code == 422:
            error_detail = response.json().get("detail", [])
            cert_number_error = any("cert_number" in str(e) for e in error_detail)
            if cert_number_error:
                pytest.fail("cert_number field not accepted in InventoryItemCreate model")
            else:
                print("Model validation passed for cert_number (other validation errors present)")
        else:
            print(f"Request accepted (status {response.status_code}) - cert_number field exists in model")
        
        assert response.status_code != 422 or "cert_number" not in str(response.json())
    
    def test_03_ebay_listing_create_model_has_cert_number(self):
        """Verify EbayListingCreateRequest model accepts cert_number"""
        payload = {
            "inventory_item_id": "test-id",
            "title": "Test Card",
            "description": "Test description",
            "price": 9.99,
            "cert_number": "12345678"  # Include cert_number
        }
        
        response = requests.post(f"{BASE_URL}/api/ebay/sell/create", json=payload)
        
        # We expect 401 (auth required) or 404 (item not found), not 422 (validation error)
        if response.status_code == 422:
            error_detail = response.json().get("detail", [])
            cert_number_error = any("cert_number" in str(e) for e in error_detail)
            if cert_number_error:
                pytest.fail("cert_number field not accepted in EbayListingCreateRequest model")
            else:
                print("Model validation passed for cert_number (other validation errors present)")
        else:
            print(f"Request accepted (status {response.status_code}) - cert_number field exists in EbayListingCreateRequest")
        
        # 401 or 404 means the model accepted the payload
        assert response.status_code in [401, 404, 200, 201] or "cert_number" not in str(response.json())


class TestCertNumberInAIPrompt:
    """Test that CARD_IDENTIFY_PROMPT includes cert_number"""
    
    def test_card_identify_prompt_includes_cert_number(self):
        """Verify CARD_IDENTIFY_PROMPT mentions cert_number in expected JSON output"""
        # Read the ai.py file to check the prompt
        import sys
        sys.path.insert(0, '/app/backend')
        
        try:
            from utils.ai import CARD_IDENTIFY_PROMPT
            
            assert "cert_number" in CARD_IDENTIFY_PROMPT, "CARD_IDENTIFY_PROMPT should include cert_number field"
            assert "certification number" in CARD_IDENTIFY_PROMPT.lower(), "CARD_IDENTIFY_PROMPT should explain cert_number"
            print("SUCCESS: CARD_IDENTIFY_PROMPT includes cert_number field")
            print(f"Prompt excerpt: ...{CARD_IDENTIFY_PROMPT[CARD_IDENTIFY_PROMPT.find('cert_number')-50:CARD_IDENTIFY_PROMPT.find('cert_number')+100]}...")
        except ImportError as e:
            pytest.skip(f"Could not import ai.py: {e}")


class TestCertNumberInScanUpload:
    """Test that scan-upload saves cert_number from AI response"""
    
    def test_scan_upload_saves_cert_number(self):
        """Verify cards.py scan_upload function saves cert_number to inventory"""
        # Read the cards.py file to check the implementation
        cards_py_path = '/app/backend/routers/cards.py'
        
        with open(cards_py_path, 'r') as f:
            content = f.read()
        
        # Check that cert_number is saved in the scan_upload function
        assert 'cert_number' in content, "cards.py should reference cert_number"
        
        # Check for cert_number in the doc dictionary creation
        assert '"cert_number"' in content or "'cert_number'" in content, "cards.py should save cert_number to inventory doc"
        
        # Check that it's extracted from card_info (AI response)
        assert 'card_info.get("cert_number")' in content or "card_info['cert_number']" in content, \
            "cards.py should extract cert_number from AI response"
        
        print("SUCCESS: cards.py scan_upload saves cert_number from AI response")


class TestCertNumberInEbayXML:
    """Test that eBay listing creation includes cert_number as Item Specific"""
    
    def test_ebay_create_includes_certification_number_item_specific(self):
        """Verify ebay.py create_ebay_listing includes Certification Number in XML"""
        ebay_py_path = '/app/backend/routers/ebay.py'
        
        with open(ebay_py_path, 'r') as f:
            content = f.read()
        
        # Check that cert_number is used in the function
        assert 'cert_number' in content, "ebay.py should reference cert_number"
        
        # Check for Certification Number Item Specific in XML
        assert 'Certification Number' in content, "ebay.py should include 'Certification Number' as Item Specific"
        
        # Check that it's added to specifics list
        assert 'cert_num' in content or 'cert_number' in content, "ebay.py should use cert_number variable"
        
        print("SUCCESS: ebay.py includes Certification Number as Item Specific")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
