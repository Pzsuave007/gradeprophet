"""
Test suite for Dashboard Hobby News endpoint and interactive features
Tests hobby-news RSS feed parsing and command center interactive elements
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')


class TestHobbyNewsPublicEndpoint:
    """Test hobby-news endpoint (public, no auth required)"""

    def test_hobby_news_endpoint_returns_200(self):
        """GET /api/dashboard/hobby-news returns 200 OK"""
        response = requests.get(f"{BASE_URL}/api/dashboard/hobby-news", timeout=15)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("PASS: hobby-news endpoint returns 200")

    def test_hobby_news_response_structure(self):
        """Response has articles array"""
        response = requests.get(f"{BASE_URL}/api/dashboard/hobby-news", timeout=15)
        data = response.json()
        assert "articles" in data, "Response should have 'articles' key"
        assert isinstance(data["articles"], list), "'articles' should be a list"
        print(f"PASS: Response has articles array with {len(data['articles'])} items")

    def test_hobby_news_article_fields(self):
        """Each article has required fields: title, link, thumbnail, source, published"""
        response = requests.get(f"{BASE_URL}/api/dashboard/hobby-news", timeout=15)
        data = response.json()
        articles = data.get("articles", [])
        
        if len(articles) == 0:
            pytest.skip("No articles returned from RSS feeds")
        
        required_fields = ["title", "link", "thumbnail", "source", "published"]
        for i, article in enumerate(articles[:3]):  # Check first 3 articles
            for field in required_fields:
                assert field in article, f"Article {i} missing field: {field}"
        print(f"PASS: Articles have required fields (title, link, thumbnail, source, published)")

    def test_hobby_news_sources_from_expected_feeds(self):
        """Articles come from Cardboard Connection, Beckett, or Sports Collectors Digest"""
        response = requests.get(f"{BASE_URL}/api/dashboard/hobby-news", timeout=15)
        data = response.json()
        articles = data.get("articles", [])
        
        if len(articles) == 0:
            pytest.skip("No articles returned from RSS feeds")
        
        expected_sources = ["Cardboard Connection", "Beckett", "Sports Collectors Digest"]
        found_sources = set(a.get("source", "") for a in articles)
        
        # At least one expected source should be present
        has_expected = any(src in found_sources for src in expected_sources)
        assert has_expected, f"Expected at least one source from {expected_sources}, got {found_sources}"
        print(f"PASS: Found articles from expected sources: {found_sources}")

    def test_hobby_news_article_links_are_urls(self):
        """Article links are valid URLs starting with http"""
        response = requests.get(f"{BASE_URL}/api/dashboard/hobby-news", timeout=15)
        data = response.json()
        articles = data.get("articles", [])
        
        if len(articles) == 0:
            pytest.skip("No articles returned from RSS feeds")
        
        for i, article in enumerate(articles[:5]):
            link = article.get("link", "")
            assert link.startswith("http"), f"Article {i} link should start with http: {link}"
        print("PASS: Article links are valid URLs")

    def test_hobby_news_max_10_articles(self):
        """Returns at most 10 articles"""
        response = requests.get(f"{BASE_URL}/api/dashboard/hobby-news", timeout=15)
        data = response.json()
        articles = data.get("articles", [])
        assert len(articles) <= 10, f"Expected max 10 articles, got {len(articles)}"
        print(f"PASS: Returns at most 10 articles (got {len(articles)})")


class TestCommandCenterInteractive:
    """Test command center data for interactive features"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get session cookie"""
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "test@dashboard.com", "password": "Test123!"},
            timeout=10
        )
        if login_response.status_code != 200:
            pytest.skip("Login failed - cannot test authenticated endpoints")
        self.cookies = login_response.cookies

    def test_command_center_recent_sales_have_modal_data(self):
        """Recent sales have fields needed for SaleDetailModal: title, total, date, buyer, item_id, image"""
        response = requests.get(
            f"{BASE_URL}/api/dashboard/command-center",
            cookies=self.cookies,
            timeout=20
        )
        assert response.status_code == 200
        data = response.json()
        
        recent_sales = data.get("recent_sales", [])
        if len(recent_sales) == 0:
            pytest.skip("No recent sales for test user")
        
        modal_fields = ["title", "total", "date", "buyer", "item_id"]
        sale = recent_sales[0]
        for field in modal_fields:
            assert field in sale, f"Sale missing field needed for modal: {field}"
        
        # image can be empty but should exist
        assert "image" in sale, "Sale should have 'image' field"
        print(f"PASS: Recent sales have all fields for SaleDetailModal: {list(sale.keys())}")

    def test_command_center_recent_sales_have_ebay_url(self):
        """Recent sales have eBay URL or can be constructed from item_id"""
        response = requests.get(
            f"{BASE_URL}/api/dashboard/command-center",
            cookies=self.cookies,
            timeout=20
        )
        data = response.json()
        
        recent_sales = data.get("recent_sales", [])
        if len(recent_sales) == 0:
            pytest.skip("No recent sales for test user")
        
        sale = recent_sales[0]
        has_url = "url" in sale and sale["url"]
        has_item_id = "item_id" in sale and sale["item_id"]
        
        assert has_url or has_item_id, "Sale must have url or item_id for eBay link"
        print(f"PASS: Recent sales have eBay URL data (url={has_url}, item_id={has_item_id})")

    def test_command_center_monitor_items_are_navigable(self):
        """Monitor items have data for navigation to Flip Finder"""
        response = requests.get(
            f"{BASE_URL}/api/dashboard/command-center",
            cookies=self.cookies,
            timeout=20
        )
        data = response.json()
        
        monitor = data.get("monitor", {})
        recent_items = monitor.get("recent_items", [])
        
        # Items should exist even if empty (for navigation purposes)
        assert isinstance(recent_items, list), "monitor.recent_items should be a list"
        print(f"PASS: Monitor items array exists with {len(recent_items)} items")

    def test_command_center_active_snipes_are_navigable(self):
        """Active snipes have data for navigation to Flip Finder"""
        response = requests.get(
            f"{BASE_URL}/api/dashboard/command-center",
            cookies=self.cookies,
            timeout=20
        )
        data = response.json()
        
        snipes = data.get("snipes", {})
        active_snipes = snipes.get("active", [])
        
        assert isinstance(active_snipes, list), "snipes.active should be a list"
        print(f"PASS: Active snipes array exists with {len(active_snipes)} snipes")

    def test_command_center_listings_summary_for_kpi_navigation(self):
        """Listings summary has data for KPI click navigation"""
        response = requests.get(
            f"{BASE_URL}/api/dashboard/command-center",
            cookies=self.cookies,
            timeout=20
        )
        data = response.json()
        
        listings_summary = data.get("listings_summary", {})
        assert "active_count" in listings_summary, "listings_summary should have active_count"
        assert "active_value" in listings_summary, "listings_summary should have active_value"
        print(f"PASS: Listings summary has active_count={listings_summary.get('active_count')}, active_value={listings_summary.get('active_value')}")


class TestAnalyticsInteractive:
    """Test analytics data for KPI interactive features"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get session cookie"""
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "test@dashboard.com", "password": "Test123!"},
            timeout=10
        )
        if login_response.status_code != 200:
            pytest.skip("Login failed - cannot test authenticated endpoints")
        self.cookies = login_response.cookies

    def test_analytics_sales_data_for_revenue_kpi(self):
        """Analytics has sales data for Total Revenue KPI click"""
        response = requests.get(
            f"{BASE_URL}/api/dashboard/analytics",
            cookies=self.cookies,
            timeout=20
        )
        assert response.status_code == 200
        data = response.json()
        
        sales = data.get("sales", {})
        assert "total_revenue" in sales, "sales should have total_revenue for KPI"
        assert "total_profit" in sales, "sales should have total_profit for KPI"
        assert "total_orders" in sales, "sales should have total_orders for KPI"
        print(f"PASS: Analytics has revenue data: ${sales.get('total_revenue')}, profit ${sales.get('total_profit')}, {sales.get('total_orders')} orders")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
