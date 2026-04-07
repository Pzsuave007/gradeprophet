"""
Test suite for eBay Bulk Specifics Update feature
Tests:
1. build_item_specifics() helper generates correct XML NameValueList
2. POST /api/ebay/sell/bulk-revise-specifics endpoint exists and requires auth
3. Expanded specifics are included in create_ebay_listing XML payload
"""
import pytest
import requests
import os
import sys

# Add backend to path for direct imports
sys.path.insert(0, '/app/backend')

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestBuildItemSpecifics:
    """Test the build_item_specifics helper function"""
    
    def test_build_item_specifics_basic_card(self):
        """Test build_item_specifics generates correct XML for a basic card"""
        from routers.ebay import build_item_specifics
        
        item = {
            "sport": "Basketball",
            "player": "LeBron James",
            "year": 2023,
            "set_name": "2023 Topps Chrome",
            "card_number": "123",
            "variation": "Refractor RC",
            "condition": "Raw"
        }
        
        specifics = build_item_specifics(item)
        
        # Should return a list of XML strings
        assert isinstance(specifics, list)
        assert len(specifics) > 0
        
        # Join all specifics to check content
        all_xml = "".join(specifics)
        
        # Check required specifics are present
        assert "<Name>Type</Name><Value>Sports Trading Card</Value>" in all_xml
        assert "<Name>Sport</Name><Value>Basketball</Value>" in all_xml
        assert "<Name>Player/Athlete</Name><Value>LeBron James</Value>" in all_xml
        assert "<Name>Season</Name><Value>2023</Value>" in all_xml
        assert "<Name>Year Manufactured</Name><Value>2023</Value>" in all_xml
        assert "<Name>Set</Name><Value>2023 Topps Chrome</Value>" in all_xml
        assert "<Name>Card Number</Name><Value>123</Value>" in all_xml
        
        # Check expanded SEO specifics
        assert "<Name>Card Name</Name>" in all_xml
        assert "<Name>Manufacturer</Name><Value>Topps</Value>" in all_xml
        assert "<Name>League</Name><Value>NBA</Value>" in all_xml
        assert "<Name>Parallel/Variety</Name><Value>Refractor RC</Value>" in all_xml
        assert "<Name>Features</Name>" in all_xml
        assert "Refractor" in all_xml  # Should detect refractor in variation
        assert "Rookie Card (RC)" in all_xml  # Should detect RC in variation
        
        # Check static defaults
        assert "<Name>Card Size</Name><Value>Standard</Value>" in all_xml
        assert "<Name>Country/Region of Manufacture</Name><Value>United States</Value>" in all_xml
        assert "<Name>Language</Name><Value>English</Value>" in all_xml
        assert "<Name>Original/Reprint</Name><Value>Original</Value>" in all_xml
        assert "<Name>Custom Bundle</Name><Value>No</Value>" in all_xml
        assert "<Name>Material</Name><Value>Card Stock</Value>" in all_xml
        
        print("PASS: build_item_specifics generates correct XML for basic card")
    
    def test_build_item_specifics_graded_card(self):
        """Test build_item_specifics for a graded card"""
        from routers.ebay import build_item_specifics
        
        item = {
            "sport": "Baseball",
            "player": "Mike Trout",
            "year": 2011,
            "set_name": "2011 Bowman Chrome",
            "card_number": "175",
            "condition": "Graded",
            "grading_company": "PSA",
            "grade": "10"
        }
        
        specifics = build_item_specifics(item)
        all_xml = "".join(specifics)
        
        assert "<Name>Sport</Name><Value>Baseball</Value>" in all_xml
        assert "<Name>League</Name><Value>MLB</Value>" in all_xml
        assert "<Name>Manufacturer</Name><Value>Bowman</Value>" in all_xml
        assert "<Name>Features</Name>" in all_xml
        assert "Graded" in all_xml
        
        print("PASS: build_item_specifics handles graded cards correctly")
    
    def test_build_item_specifics_vintage_card(self):
        """Test build_item_specifics detects vintage cards (pre-1980)"""
        from routers.ebay import build_item_specifics
        
        item = {
            "sport": "Baseball",
            "player": "Babe Ruth",
            "year": 1933,
            "set_name": "1933 Goudey"
        }
        
        specifics = build_item_specifics(item)
        all_xml = "".join(specifics)
        
        assert "<Name>Vintage</Name><Value>Yes</Value>" in all_xml
        
        print("PASS: build_item_specifics correctly identifies vintage cards")
    
    def test_build_item_specifics_modern_card(self):
        """Test build_item_specifics marks modern cards as non-vintage"""
        from routers.ebay import build_item_specifics
        
        item = {
            "sport": "Basketball",
            "player": "Luka Doncic",
            "year": 2018,
            "set_name": "2018 Panini Prizm"
        }
        
        specifics = build_item_specifics(item)
        all_xml = "".join(specifics)
        
        assert "<Name>Vintage</Name><Value>No</Value>" in all_xml
        assert "<Name>Manufacturer</Name><Value>Panini</Value>" in all_xml
        
        print("PASS: build_item_specifics correctly marks modern cards as non-vintage")
    
    def test_build_item_specifics_autograph_detection(self):
        """Test build_item_specifics detects autographed cards"""
        from routers.ebay import build_item_specifics
        
        item = {
            "sport": "Football",
            "player": "Patrick Mahomes",
            "year": 2017,
            "set_name": "2017 Panini Prizm",
            "variation": "Silver Auto /25"
        }
        
        specifics = build_item_specifics(item)
        all_xml = "".join(specifics)
        
        assert "<Name>Autographed</Name><Value>Yes</Value>" in all_xml
        assert "<Name>League</Name><Value>NFL</Value>" in all_xml
        
        print("PASS: build_item_specifics correctly detects autographed cards")
    
    def test_build_item_specifics_non_autograph(self):
        """Test build_item_specifics marks non-auto cards correctly"""
        from routers.ebay import build_item_specifics
        
        item = {
            "sport": "Basketball",
            "player": "Michael Jordan",
            "year": 1986,
            "set_name": "1986 Fleer",
            "variation": "Base"
        }
        
        specifics = build_item_specifics(item)
        all_xml = "".join(specifics)
        
        assert "<Name>Autographed</Name><Value>No</Value>" in all_xml
        
        print("PASS: build_item_specifics correctly marks non-auto cards")


class TestBulkReviseSpecificsEndpoint:
    """Test the bulk-revise-specifics API endpoint"""
    
    def test_endpoint_exists_requires_auth(self):
        """Test that POST /api/ebay/sell/bulk-revise-specifics exists and requires auth"""
        response = requests.post(
            f"{BASE_URL}/api/ebay/sell/bulk-revise-specifics",
            json={"item_ids": ["test123"]},
            headers={"Content-Type": "application/json"}
        )
        
        # Should return 401 (not authenticated) or 403 (forbidden)
        # NOT 404 (endpoint not found) or 405 (method not allowed)
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "detail" in data
        assert "authenticated" in data["detail"].lower() or "auth" in data["detail"].lower()
        
        print(f"PASS: Endpoint exists and requires auth (status: {response.status_code})")
    
    def test_endpoint_rejects_invalid_payload(self):
        """Test that endpoint validates payload structure"""
        response = requests.post(
            f"{BASE_URL}/api/ebay/sell/bulk-revise-specifics",
            json={},  # Missing item_ids
            headers={"Content-Type": "application/json"}
        )
        
        # Should return 401 (auth check first) or 422 (validation error)
        assert response.status_code in [401, 422], f"Expected 401/422, got {response.status_code}"
        
        print(f"PASS: Endpoint validates payload (status: {response.status_code})")


class TestExpandedSpecificsInCreateListing:
    """Test that expanded specifics are used in create_ebay_listing"""
    
    def test_create_listing_uses_build_item_specifics(self):
        """Verify create_ebay_listing calls build_item_specifics"""
        import inspect
        from routers.ebay import create_ebay_listing, build_item_specifics
        
        # Get source code of create_ebay_listing
        source = inspect.getsource(create_ebay_listing)
        
        # Verify build_item_specifics is called
        assert "build_item_specifics" in source, "create_ebay_listing should call build_item_specifics"
        
        print("PASS: create_ebay_listing uses build_item_specifics helper")
    
    def test_expanded_specifics_count(self):
        """Test that build_item_specifics generates 15+ specifics for SEO"""
        from routers.ebay import build_item_specifics
        
        item = {
            "sport": "Basketball",
            "player": "LeBron James",
            "year": 2023,
            "set_name": "2023 Topps Chrome",
            "card_number": "123",
            "variation": "Refractor RC",
            "condition": "Graded",
            "grading_company": "PSA",
            "grade": "10"
        }
        
        specifics = build_item_specifics(item)
        
        # Count unique specifics (each NameValueList is one specific)
        count = len(specifics)
        
        # Should have at least 15 specifics for good Cassini SEO
        assert count >= 15, f"Expected 15+ specifics, got {count}"
        
        print(f"PASS: build_item_specifics generates {count} specifics (>= 15 for SEO)")


class TestExtractManufacturer:
    """Test the extract_manufacturer helper"""
    
    def test_extract_known_manufacturers(self):
        """Test extraction of known manufacturers from set names"""
        from routers.ebay import extract_manufacturer
        
        test_cases = [
            ("2023 Topps Chrome", "Topps"),
            ("2023 Panini Prizm", "Panini"),
            ("2011 Bowman Chrome", "Bowman"),
            ("1986 Fleer", "Fleer"),
            ("2020 Upper Deck", "Upper Deck"),
            ("2019 Donruss Optic", "Donruss"),
        ]
        
        for set_name, expected in test_cases:
            result = extract_manufacturer(set_name)
            assert result == expected, f"For '{set_name}', expected '{expected}', got '{result}'"
        
        print("PASS: extract_manufacturer correctly identifies known manufacturers")
    
    def test_extract_manufacturer_fallback(self):
        """Test fallback when manufacturer not in known list"""
        from routers.ebay import extract_manufacturer
        
        # Should use first word after year as fallback
        result = extract_manufacturer("2023 UnknownBrand Chrome")
        assert result == "UnknownBrand"
        
        print("PASS: extract_manufacturer uses fallback for unknown brands")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
