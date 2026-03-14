import requests
import sys
import base64
import json
from datetime import datetime
from PIL import Image
import io

class GradeProphetAPITester:
    def __init__(self, base_url="https://trading-engine-dev-2.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_base = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.card_ids = []  # Store created card IDs for cleanup

    def run_test(self, name, method, endpoint, expected_status, data=None, timeout=30):
        """Run a single API test"""
        url = f"{self.api_base}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=timeout)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=timeout)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=timeout)

            print(f"Status Code: {response.status_code}")
            success = response.status_code == expected_status
            
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    return True, response_data
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"Error details: {error_data}")
                except:
                    print(f"Response text: {response.text[:500]}")
                return False, {}

        except requests.exceptions.Timeout:
            print(f"❌ Failed - Request timeout after {timeout} seconds")
            return False, {}
        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def create_test_image(self):
        """Create a simple test sports card image"""
        # Create a simple card-like image for testing
        img = Image.new('RGB', (600, 800), color='white')
        
        # Add some simple features to make it look like a card
        from PIL import ImageDraw
        draw = ImageDraw.Draw(img)
        
        # Draw a border
        draw.rectangle([10, 10, 590, 790], outline='black', width=3)
        
        # Draw player area (simulate card features)
        draw.rectangle([50, 50, 550, 400], fill='lightblue', outline='darkblue', width=2)
        draw.text((200, 200), "TEST CARD", fill='black')
        
        # Draw info area
        draw.rectangle([50, 420, 550, 750], fill='lightgray', outline='gray', width=2)
        draw.text((100, 500), "Player Name: Test Player", fill='black')
        draw.text((100, 550), "Team: Test Team", fill='black')
        draw.text((100, 600), "Year: 2024", fill='black')
        
        # Convert to base64
        buffer = io.BytesIO()
        img.save(buffer, format='JPEG', quality=85)
        img_str = base64.b64encode(buffer.getvalue()).decode('utf-8')
        
        return f"data:image/jpeg;base64,{img_str}"

    def test_root_endpoint(self):
        """Test the root endpoint"""
        success, response = self.run_test(
            "Root Endpoint",
            "GET",
            "",
            200
        )
        if success and response.get('message'):
            print(f"API Message: {response['message']}")
        return success

    def test_analyze_card(self):
        """Test card analysis endpoint"""
        test_image = self.create_test_image()
        
        success, response = self.run_test(
            "Card Analysis",
            "POST",
            "cards/analyze",
            200,
            data={
                "image_base64": test_image,
                "card_name": "Test Sports Card"
            },
            timeout=60  # AI analysis takes time
        )
        
        if success and response:
            # Validate response structure
            required_fields = ['id', 'grading_result', 'created_at']
            for field in required_fields:
                if field not in response:
                    print(f"❌ Missing required field: {field}")
                    return False
            
            # Validate grading result structure
            grading = response['grading_result']
            required_grading_fields = ['centering', 'corners', 'surface', 'edges', 'overall_grade', 'psa_recommendation']
            for field in required_grading_fields:
                if field not in grading:
                    print(f"❌ Missing grading field: {field}")
                    return False
            
            # Store card ID for later tests
            self.card_ids.append(response['id'])
            
            print(f"✅ Card analyzed successfully:")
            print(f"   - Card ID: {response['id']}")
            print(f"   - Overall Grade: {grading['overall_grade']}")
            print(f"   - PSA Recommendation: {grading['psa_recommendation']}")
            
        return success

    def test_get_history(self):
        """Test getting card history"""
        success, response = self.run_test(
            "Get Card History",
            "GET",
            "cards/history",
            200
        )
        
        if success:
            if isinstance(response, list):
                print(f"✅ Retrieved {len(response)} cards from history")
                return True
            else:
                print("❌ Response is not a list")
                return False
        return False

    def test_get_specific_card(self):
        """Test getting a specific card by ID"""
        if not self.card_ids:
            print("⚠️ No card IDs available for testing")
            return False
            
        card_id = self.card_ids[0]
        success, response = self.run_test(
            "Get Specific Card",
            "GET",
            f"cards/{card_id}",
            200
        )
        
        if success and response:
            if response.get('id') == card_id:
                print(f"✅ Retrieved card {card_id} successfully")
                return True
            else:
                print("❌ Retrieved card ID doesn't match requested ID")
        return False

    def test_delete_card(self):
        """Test deleting a card"""
        if not self.card_ids:
            print("⚠️ No card IDs available for testing")
            return False
            
        card_id = self.card_ids[0]
        success, response = self.run_test(
            "Delete Card",
            "DELETE",
            f"cards/{card_id}",
            200
        )
        
        if success:
            # Verify card is deleted by trying to get it
            verify_success, _ = self.run_test(
                "Verify Card Deleted",
                "GET",
                f"cards/{card_id}",
                404
            )
            if verify_success:
                print(f"✅ Card {card_id} deleted and verified")
                self.card_ids.remove(card_id)
                return True
        return False

    def test_invalid_endpoints(self):
        """Test invalid endpoints return appropriate errors"""
        tests = [
            ("Non-existent Card", "GET", "cards/invalid-id", 404),
            ("Delete Non-existent Card", "DELETE", "cards/invalid-id", 404),
        ]
        
        all_passed = True
        for test_name, method, endpoint, expected_status in tests:
            success, _ = self.run_test(test_name, method, endpoint, expected_status)
            if not success:
                all_passed = False
        
        return all_passed

    def cleanup(self):
        """Clean up any remaining test cards"""
        for card_id in self.card_ids[:]:
            try:
                response = requests.delete(f"{self.api_base}/cards/{card_id}")
                if response.status_code == 200:
                    print(f"🧹 Cleaned up card {card_id}")
                    self.card_ids.remove(card_id)
            except:
                pass

def main():
    """Run all tests"""
    print("🚀 Starting GradeProphet API Tests")
    print("=" * 50)
    
    tester = GradeProphetAPITester()
    
    try:
        # Run all tests
        test_results = []
        
        # Basic endpoint tests
        test_results.append(("Root Endpoint", tester.test_root_endpoint()))
        
        # Core functionality tests
        test_results.append(("Card Analysis", tester.test_analyze_card()))
        test_results.append(("Get History", tester.test_get_history()))
        test_results.append(("Get Specific Card", tester.test_get_specific_card()))
        test_results.append(("Delete Card", tester.test_delete_card()))
        
        # Error handling tests
        test_results.append(("Invalid Endpoints", tester.test_invalid_endpoints()))
        
        # Print summary
        print("\n" + "=" * 50)
        print("📊 TEST SUMMARY")
        print("=" * 50)
        
        for test_name, passed in test_results:
            status = "✅ PASSED" if passed else "❌ FAILED"
            print(f"{test_name:30} {status}")
        
        print(f"\nOverall: {tester.tests_passed}/{tester.tests_run} tests passed")
        
        success_rate = (tester.tests_passed / tester.tests_run * 100) if tester.tests_run > 0 else 0
        print(f"Success Rate: {success_rate:.1f}%")
        
        return 0 if tester.tests_passed == tester.tests_run else 1
        
    finally:
        # Cleanup
        tester.cleanup()

if __name__ == "__main__":
    sys.exit(main())