"""
Backend tests for Dashboard Analytics API
Tests the redesigned dashboard with stock-market-style charts
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://flip-finder-hub.preview.emergentagent.com').rstrip('/')


class TestDashboardAnalytics:
    """Test /api/dashboard/analytics endpoint - returns comprehensive analytics data"""
    
    def test_dashboard_analytics_endpoint_returns_200(self):
        """Analytics endpoint should return 200 with valid data structure"""
        response = requests.get(f"{BASE_URL}/api/dashboard/analytics", timeout=30)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print(f"SUCCESS: /api/dashboard/analytics returned {response.status_code}")
    
    def test_dashboard_analytics_sales_structure(self):
        """Analytics should return sales data with timeline and chart data"""
        response = requests.get(f"{BASE_URL}/api/dashboard/analytics", timeout=30)
        data = response.json()
        
        # Check sales section exists
        assert "sales" in data, "Missing 'sales' section"
        sales = data["sales"]
        
        # Check required sales fields
        required_fields = ["timeline", "monthly_chart", "total_revenue", "total_fees", 
                         "total_profit", "total_orders", "avg_sale"]
        for field in required_fields:
            assert field in sales, f"Missing sales field: {field}"
        
        # Validate timeline is a list with expected structure
        assert isinstance(sales["timeline"], list), "timeline should be a list"
        if len(sales["timeline"]) > 0:
            sale = sales["timeline"][0]
            assert "date" in sale, "Timeline items should have 'date'"
            assert "total" in sale, "Timeline items should have 'total'"
            assert "profit" in sale, "Timeline items should have 'profit'"
            print(f"SUCCESS: Found {len(sales['timeline'])} sales in timeline")
        
        # Validate monthly_chart
        assert isinstance(sales["monthly_chart"], list), "monthly_chart should be a list"
        if len(sales["monthly_chart"]) > 0:
            month = sales["monthly_chart"][0]
            assert "month" in month, "Monthly chart items should have 'month'"
            assert "revenue" in month, "Monthly chart items should have 'revenue'"
            print(f"SUCCESS: Found {len(sales['monthly_chart'])} months in monthly_chart")
        
        print(f"Total Revenue: ${sales['total_revenue']}, Total Orders: {sales['total_orders']}")
    
    def test_dashboard_analytics_inventory_structure(self):
        """Analytics should return inventory breakdown by sport and player"""
        response = requests.get(f"{BASE_URL}/api/dashboard/analytics", timeout=30)
        data = response.json()
        
        # Check inventory section
        assert "inventory" in data, "Missing 'inventory' section"
        inv = data["inventory"]
        
        # Check required inventory fields
        assert "by_sport" in inv, "Missing 'by_sport' breakdown"
        assert "by_player" in inv, "Missing 'by_player' breakdown"
        assert "total_items" in inv, "Missing 'total_items' count"
        assert "total_invested" in inv, "Missing 'total_invested' value"
        
        # Validate by_sport structure
        if len(inv["by_sport"]) > 0:
            sport = inv["by_sport"][0]
            assert "name" in sport, "Sport items should have 'name'"
            assert "count" in sport, "Sport items should have 'count'"
            assert "value" in sport, "Sport items should have 'value'"
            print(f"SUCCESS: Inventory by sport - {sport['name']}: {sport['count']} cards, ${sport['value']}")
        
        # Validate by_player structure  
        if len(inv["by_player"]) > 0:
            player = inv["by_player"][0]
            assert "name" in player, "Player items should have 'name'"
            print(f"SUCCESS: Top player - {player['name']}")
        
        print(f"Total inventory: {inv['total_items']} items, ${inv['total_invested']} invested")
    
    def test_dashboard_analytics_listings_structure(self):
        """Analytics should return listings data with active count and ending soon"""
        response = requests.get(f"{BASE_URL}/api/dashboard/analytics", timeout=30)
        data = response.json()
        
        # Check listings section
        assert "listings" in data, "Missing 'listings' section"
        lst = data["listings"]
        
        # Check required listings fields
        assert "active_count" in lst, "Missing 'active_count'"
        assert "active_value" in lst, "Missing 'active_value'"
        assert "ending_soon" in lst, "Missing 'ending_soon'"
        
        # Validate ending_soon structure
        assert isinstance(lst["ending_soon"], list), "ending_soon should be a list"
        if len(lst["ending_soon"]) > 0:
            item = lst["ending_soon"][0]
            assert "title" in item, "Ending soon items should have 'title'"
            assert "price" in item, "Ending soon items should have 'price'"
            assert "time_left" in item, "Ending soon items should have 'time_left'"
            print(f"SUCCESS: Found {len(lst['ending_soon'])} items ending soon")
        
        print(f"Active listings: {lst['active_count']}, Total value: ${lst['active_value']}")
    
    def test_dashboard_analytics_top_sale(self):
        """Analytics should identify the top sale"""
        response = requests.get(f"{BASE_URL}/api/dashboard/analytics", timeout=30)
        data = response.json()
        sales = data.get("sales", {})
        
        top_sale = sales.get("top_sale")
        if top_sale:
            assert "total" in top_sale, "Top sale should have 'total'"
            assert "title" in top_sale, "Top sale should have 'title'"
            print(f"SUCCESS: Top sale - ${top_sale['total']} - {top_sale['title'][:50]}")
        else:
            print("INFO: No top sale found (may be no orders)")


class TestMyListingsEndpoint:
    """Test /api/ebay/seller/my-listings endpoint for dashboard Ending Soon"""
    
    def test_my_listings_endpoint_returns_200(self):
        """My listings endpoint should return 200 with active listings"""
        response = requests.get(f"{BASE_URL}/api/ebay/seller/my-listings?limit=10", timeout=30)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print(f"SUCCESS: /api/ebay/seller/my-listings returned {response.status_code}")
    
    def test_my_listings_structure(self):
        """My listings should return active and sold listings"""
        response = requests.get(f"{BASE_URL}/api/ebay/seller/my-listings?limit=10", timeout=30)
        data = response.json()
        
        # Check active listings exist
        assert "active" in data, "Missing 'active' listings"
        assert isinstance(data["active"], list), "active should be a list"
        
        if len(data["active"]) > 0:
            listing = data["active"][0]
            assert "item_id" in listing, "Listings should have 'item_id'"
            assert "title" in listing, "Listings should have 'title'"
            assert "price" in listing, "Listings should have 'price'"
            assert "time_left" in listing, "Listings should have 'time_left'"
            print(f"SUCCESS: Found {len(data['active'])} active listings")
            print(f"Sample listing: {listing['title'][:50]} - ${listing['price']}")


class TestDateRangeFiltering:
    """Test that date filtering data is correct for UI consumption"""
    
    def test_timeline_dates_are_sortable(self):
        """Timeline dates should be in ISO format for client-side filtering"""
        response = requests.get(f"{BASE_URL}/api/dashboard/analytics", timeout=30)
        data = response.json()
        timeline = data.get("sales", {}).get("timeline", [])
        
        if len(timeline) > 1:
            # Check dates are sortable strings
            dates = [s["date"] for s in timeline]
            sorted_dates = sorted(dates)
            # Timeline should already be sorted
            assert dates == sorted_dates, "Timeline should be sorted by date"
            print(f"SUCCESS: Timeline dates are properly sorted ({dates[0]} to {dates[-1]})")
    
    def test_monthly_chart_months_are_valid(self):
        """Monthly chart months should be in YYYY-MM format"""
        response = requests.get(f"{BASE_URL}/api/dashboard/analytics", timeout=30)
        data = response.json()
        monthly = data.get("sales", {}).get("monthly_chart", [])
        
        if len(monthly) > 0:
            import re
            for m in monthly:
                assert re.match(r"^\d{4}-\d{2}$", m["month"]), f"Invalid month format: {m['month']}"
            print(f"SUCCESS: All {len(monthly)} monthly chart entries have valid YYYY-MM format")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
