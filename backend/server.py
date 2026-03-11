from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone
import base64
import httpx
import re
from io import BytesIO
from openai import AsyncOpenAI
from PIL import Image

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ.get('MONGO_URL')
if not mongo_url:
    raise ValueError("MONGO_URL environment variable is required")
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'test_database')]

# OpenAI API Key
OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY')
if not OPENAI_API_KEY:
    raise ValueError("OPENAI_API_KEY environment variable is required")

# Scrape.do API Key (optional - for eBay imports)
SCRAPEDO_API_KEY = os.environ.get('SCRAPEDO_API_KEY', 'SCRAPEDO_KEY_REMOVED')

# Initialize OpenAI client
openai_client = AsyncOpenAI(api_key=OPENAI_API_KEY)

# Create the main app
app = FastAPI(title="GradeProphet API", description="AI-powered PSA grading predictor for sports cards")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Define Models
class SubGrade(BaseModel):
    score: float = Field(..., ge=0, le=10)
    description: str
    issues: List[str] = []

class GradingResult(BaseModel):
    centering: SubGrade
    corners: SubGrade
    surface: SubGrade
    edges: SubGrade
    overall_grade: float = Field(..., ge=0, le=10)
    psa_recommendation: str
    send_to_psa: bool
    analysis_summary: str
    card_info: Optional[str] = None

# PSA 10 Reference Models
class PSA10Reference(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str  # Card name/description
    year: Optional[str] = None  # Card year extracted from PSA label
    image_preview: str  # Thumbnail for display
    image_full: str  # Full base64 for analysis
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PSA10ReferenceCreate(BaseModel):
    name: Optional[str] = None  # Optional - will auto-read from PSA label if not provided
    image_base64: str

class PSA10ReferenceResponse(BaseModel):
    id: str
    name: str
    year: Optional[str] = None
    image_preview: str
    created_at: str

class CardAnalysis(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    front_image_preview: str  # Small base64 thumbnail of front
    back_image_preview: Optional[str] = None  # Small base64 thumbnail of back
    grading_result: GradingResult
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    card_name: Optional[str] = None
    # Learning system fields
    actual_psa_grade: Optional[float] = None  # Real PSA grade when received
    psa_cert_number: Optional[str] = None  # PSA certification number
    feedback_date: Optional[str] = None  # When feedback was added
    status: str = "pending"  # pending, sent_to_psa, graded

class CardFeedbackUpdate(BaseModel):
    actual_psa_grade: float = Field(..., ge=1, le=10)
    psa_cert_number: Optional[str] = None
    status: str = "graded"

class CardAnalysisCreate(BaseModel):
    front_image_base64: str
    back_image_base64: Optional[str] = None
    reference_image_base64: Optional[str] = None  # Direct PSA 10 reference upload
    reference_id: Optional[str] = None  # OR select from saved references
    card_name: Optional[str] = None
    card_year: Optional[int] = None  # Year of the card for vintage consideration
    # Optional corner photos for detailed analysis
    corner_top_left: Optional[str] = None
    corner_top_right: Optional[str] = None
    corner_bottom_left: Optional[str] = None
    corner_bottom_right: Optional[str] = None

class CardAnalysisResponse(BaseModel):
    id: str
    front_image_preview: str
    back_image_preview: Optional[str] = None
    grading_result: GradingResult
    created_at: str
    card_name: Optional[str] = None
    actual_psa_grade: Optional[float] = None
    psa_cert_number: Optional[str] = None
    feedback_date: Optional[str] = None
    status: str = "pending"

class LearningStats(BaseModel):
    total_analyzed: int
    total_graded: int
    accuracy_rate: float  # Percentage within 0.5 of actual
    average_difference: float
    predictions_high: int  # Times we predicted higher
    predictions_low: int  # Times we predicted lower
    predictions_accurate: int  # Within 0.5

# ============================================
# WATCHLIST & EBAY MONITOR MODELS
# ============================================

class WatchlistCard(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    search_query: str  # e.g., "1996 Topps Kobe Bryant #138"
    notes: Optional[str] = None  # User notes about this card
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_searched: Optional[datetime] = None
    listings_found: int = 0  # Total listings found for this card

class WatchlistCardCreate(BaseModel):
    search_query: str
    notes: Optional[str] = None

class WatchlistCardResponse(BaseModel):
    id: str
    search_query: str
    notes: Optional[str] = None
    created_at: str
    last_searched: Optional[str] = None
    listings_found: int = 0

class EbayListing(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    watchlist_card_id: str  # Reference to the watchlist card
    ebay_item_id: str  # eBay's unique listing ID
    title: str
    price: str  # Current price as string (could be bid or BIN)
    price_value: float  # Numeric price for sorting
    listing_type: str  # "auction" or "buy_now"
    time_left: Optional[str] = None  # For auctions
    image_url: str
    listing_url: str
    bids: Optional[int] = None  # For auctions
    found_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    status: str = "new"  # new, seen, interested, ignored
    search_query: str  # The query used to find this

class EbayListingResponse(BaseModel):
    id: str
    watchlist_card_id: str
    ebay_item_id: str
    title: str
    price: str
    price_value: float
    listing_type: str
    time_left: Optional[str] = None
    image_url: str
    listing_url: str
    bids: Optional[int] = None
    found_at: str
    status: str
    search_query: str

class SearchResultSummary(BaseModel):
    total_cards_searched: int
    new_listings_found: int
    cards_with_results: List[str]  # Card names that had new listings


# PSA Grading Analysis Prompt
PSA_ANALYSIS_PROMPT_SINGLE = """You are an expert sports card grader with 20+ years of hands-on experience at PSA. You are STRICT and REALISTIC - you grade exactly how PSA would grade.

IMAGE vs CARD DEFECTS:
- Do NOT penalize for: image compression, lighting glare, scanner noise, camera blur
- DO penalize for: edge wear/whitening, corner softness/rounding, surface scratches/creases, centering issues, discoloration

=== OFFICIAL PSA GRADING STANDARDS ===

PSA 10 GEM MINT (GEM-MT): Virtually perfect card. Four perfectly sharp corners, 55/45 or better centering (front) and 75/25 (reverse), full original gloss, no visible flaws. A microscopic printing imperfection is allowed. Less than 2% of cards achieve this.

PSA 9 MINT: Superb condition, appears Mint 10 at a glance. May have ONE minor flaw: very slight wax stain, slight printing imperfection, slightly off-white borders, or barely noticeable corner wear. Centering 60/40 front, 90/10 reverse.

PSA 8 NEAR MINT-MINT (NM-MT): High-end card with visible minor flaws. Can have slight fraying on 1-2 corners, slight edge wear or minor whitening, or minor printing defects. Centering 65/35 front, 90/10 back. Looks like a 9 at first glance.

PSA 7 NEAR MINT (NM): Sharp but with visible surface wear or printing imperfections. Minor corner wear with slight rounding or white fraying. Edge wear and light scratches visible. Centering 70/30 front.

PSA 6 EXCELLENT-MINT (EX-MT): Noticeable surface wear, edge chipping, and less-than-sharp corners. Light scratches or slight white marks on edges. Centering 75/25 front.

PSA 5 EXCELLENT (EX): Visible surface wear, rounded corners, and potentially a minor crease. Noticeable centering issues. Centering 80/20 front.

PSA 4 VERY GOOD-EXCELLENT (VG-EX): Heavy wear, rounded corners, surface damage like scratches or creases. Centering 85/15 front.

PSA 3 VERY GOOD (VG): Significant noticeable wear including major creases, surface stains, and rounding corners.

PSA 2 GOOD (GD): Substantial damage - heavy creasing, surface wear, loss of gloss, edge chipping.

PSA 1 POOR (PR): Extreme damage including major creases, whitening, stains, and potential missing pieces.

=== SPECIFIC DEFECT SCORING ===

CORNERS:
- PSA 10: 4 perfectly sharp corners, no fraying
- PSA 9: Barely noticeable wear on one corner (needs magnification to see)
- PSA 8: Slight fraying on 1-2 corners
- PSA 7: Visible rounding or white fraying on 2+ corners
- PSA 6 and below: Noticeable rounding on multiple corners

EDGES:
- PSA 10: Crisp, clean edges with no chipping
- PSA 9: Minor light white speck or tiny edge nick
- PSA 8-7: Noticeable whitening along edges
- PSA 6 and below: Visible chipping on multiple edges

CENTERING:
- 55/45 or better = PSA 10 eligible
- 60/40 = PSA 9 maximum
- 65/35 = PSA 8 maximum
- 70/30 = PSA 7 maximum
- 75/25 = PSA 6 maximum

SURFACE:
- PSA 10: Full original gloss, no scratches, no stains
- PSA 9: One minor print spot allowed
- PSA 8: Minor surface marks, slight gloss loss
- PSA 7: Light scratches visible
- PSA 6 and below: Noticeable scratches, wear, or staining

=== KEY RULES ===
1. The LOWEST subcategory score heavily pulls down the overall grade. PSA grades on the WEAKEST aspect.
2. Dark-bordered cards show edge wear as white specks - be EXTRA careful examining all edges.
3. Vintage cards (pre-2000) are graded by the SAME standards. Age does NOT excuse wear.
4. Foil/chrome/refractor cards show surface scratches more easily.
5. A PSA 10 can sometimes have one or two barely visible minor imperfections, but NOT significant ones.

BE HONEST AND ACCURATE. Users pay $20-50 to submit to PSA. Inflated grades waste their money. Accurate grades save money and build trust.

Provide your response in the following JSON format ONLY (no additional text):
{
    "centering": {
        "score": <float 1-10>,
        "description": "<assessment with estimated ratio like 55/45 or 60/40>",
        "issues": ["<all visible issues>"]
    },
    "corners": {
        "score": <float 1-10>,
        "description": "<assess each corner: TL, TR, BL, BR>",
        "issues": ["<all visible corner issues>"]
    },
    "surface": {
        "score": <float 1-10>,
        "description": "<assess gloss, scratches, stains, print defects>",
        "issues": ["<all visible surface issues>"]
    },
    "edges": {
        "score": <float 1-10>,
        "description": "<assess each edge: top, bottom, left, right>",
        "issues": ["<all visible edge issues including whitening/chipping>"]
    },
    "overall_grade": <float 1-10>,
    "psa_recommendation": "<honest recommendation>",
    "send_to_psa": <boolean - true if likely PSA 8+>,
    "analysis_summary": "<2-3 sentence honest summary>",
    "card_info": "<card name/year/player/set if identifiable>"
}

Grade honestly. Do NOT inflate."""

PSA_ANALYSIS_PROMPT_WITH_REFERENCE = """You are an expert sports card grader with 20+ years of hands-on experience at PSA. You have been given a REFERENCE IMAGE of a PSA 10 graded card to compare against.

You are analyzing:
- IMAGE 1: The card to be graded (FRONT)
- IMAGE 2: A PSA 10 REFERENCE of the same or similar card

COMPARISON TASK:
Compare the card being graded against the PSA 10 reference. Look for:
1. Is the centering as good or close to the PSA 10 reference?
2. Are the corners as sharp as the PSA 10 reference?
3. Is the surface as clean as the PSA 10 reference?
4. Are the edges as crisp as the PSA 10 reference?

CRITICAL - DO NOT PENALIZE FOR IMAGE/SCAN ARTIFACTS:
- Only compare ACTUAL card condition, not photo quality differences
- The reference helps you understand what PSA 10 looks like for THIS specific card

GRADING WITH REFERENCE:
- If the card looks EQUAL to the reference → PSA 10 candidate
- If slightly below in one area → PSA 9 candidate  
- If noticeably below in multiple areas → PSA 8 or lower

Provide your response in the following JSON format ONLY (no additional text):
{
    "centering": {
        "score": <float 1-10>,
        "description": "<how it compares to PSA 10 reference>",
        "issues": ["<only CONFIRMED differences from PSA 10 reference>"]
    },
    "corners": {
        "score": <float 1-10>,
        "description": "<how it compares to PSA 10 reference>",
        "issues": ["<only CONFIRMED differences from PSA 10 reference>"]
    },
    "surface": {
        "score": <float 1-10>,
        "description": "<how it compares to PSA 10 reference>",
        "issues": ["<only CONFIRMED differences from PSA 10 reference>"]
    },
    "edges": {
        "score": <float 1-10>,
        "description": "<how it compares to PSA 10 reference>",
        "issues": ["<only CONFIRMED differences from PSA 10 reference>"]
    },
    "overall_grade": <float 1-10>,
    "psa_recommendation": "<recommendation based on comparison to PSA 10>",
    "send_to_psa": <boolean>,
    "analysis_summary": "<summary comparing to the PSA 10 reference>",
    "card_info": "<card identification>"
}

The PSA 10 reference is your calibration standard - use it wisely!"""

PSA_ANALYSIS_PROMPT_DUAL_WITH_REFERENCE = """You are an expert sports card grader with 20+ years of hands-on experience at PSA. You have been given a REFERENCE IMAGE of a PSA 10 graded card to compare against.

You are analyzing THREE images:
- IMAGE 1: The card to be graded (FRONT)
- IMAGE 2: The card to be graded (BACK)
- IMAGE 3: A PSA 10 REFERENCE of the same or similar card

COMPARISON TASK:
Compare the card being graded against the PSA 10 reference. For BOTH front and back, evaluate:
1. Is the centering as good or close to the PSA 10 reference? (Front: 55/45, Back: 75/25)
2. Are all 8 corners as sharp as the PSA 10 reference?
3. Are both surfaces as clean as the PSA 10 reference?
4. Are all edges as crisp as the PSA 10 reference?

CRITICAL - DO NOT PENALIZE FOR IMAGE/SCAN ARTIFACTS:
- Only compare ACTUAL card condition, not photo quality differences

GRADING WITH REFERENCE:
- If the card looks EQUAL to the reference → PSA 10 candidate
- If slightly below in one area → PSA 9 candidate  
- If noticeably below in multiple areas → PSA 8 or lower

Provide your response in the following JSON format ONLY (no additional text):
{
    "centering": {
        "score": <float 1-10>,
        "description": "<how BOTH sides compare to PSA 10 reference>",
        "issues": ["<only CONFIRMED differences from PSA 10>"]
    },
    "corners": {
        "score": <float 1-10>,
        "description": "<how all 8 corners compare to PSA 10 reference>",
        "issues": ["<only CONFIRMED differences from PSA 10>"]
    },
    "surface": {
        "score": <float 1-10>,
        "description": "<how both surfaces compare to PSA 10 reference>",
        "issues": ["<only CONFIRMED differences from PSA 10>"]
    },
    "edges": {
        "score": <float 1-10>,
        "description": "<how all edges compare to PSA 10 reference>",
        "issues": ["<only CONFIRMED differences from PSA 10>"]
    },
    "overall_grade": <float 1-10>,
    "psa_recommendation": "<recommendation based on comparison to PSA 10>",
    "send_to_psa": <boolean>,
    "analysis_summary": "<summary comparing to the PSA 10 reference>",
    "card_info": "<card identification>"
}

The PSA 10 reference is your calibration standard - use it wisely!"""

PSA_ANALYSIS_PROMPT_DUAL = """You are an expert sports card grader with 20+ years of hands-on experience at PSA. You are STRICT and REALISTIC.

You are being shown TWO images: the FRONT (image 1) and BACK (image 2) of the same sports card.

IMAGE vs CARD DEFECTS:
- Do NOT penalize for: image compression, lighting glare, scanner noise, camera blur
- DO penalize for: edge wear/whitening, corner softness/rounding, surface scratches/creases, centering issues, discoloration

=== OFFICIAL PSA GRADING STANDARDS ===

PSA 10 GEM MINT: Virtually perfect. Four perfectly sharp corners, 55/45 centering front, 75/25 reverse, full original gloss, no visible flaws. Microscopic printing imperfection allowed. Less than 2% achieve this.
PSA 9 MINT: Appears Mint 10 at a glance. ONE minor flaw: very slight wax stain, slight printing imperfection, slightly off-white borders. Barely noticeable corner wear needs magnification. Centering 60/40 front, 90/10 reverse.
PSA 8 NM-MT: High-end with visible minor flaws. Slight fraying 1-2 corners, slight edge wear/whitening, minor printing defects. Looks like a 9 at first glance. Centering 65/35 front, 90/10 back.
PSA 7 NM: Visible surface wear/printing imperfections. Minor corner wear with slight rounding or white fraying. Edge wear visible. Centering 70/30 front.
PSA 6 EX-MT: Noticeable surface wear, edge chipping, less-than-sharp corners. Light scratches or white marks. Centering 75/25 front.
PSA 5 EX: Visible surface wear, rounded corners, potentially minor crease. Centering 80/20 front.
PSA 4 VG-EX: Heavy wear, rounded corners, surface damage.
PSA 3 VG: Major creases, surface stains, rounding corners.
PSA 2 GD: Heavy creasing, loss of gloss, edge chipping.
PSA 1 PR: Extreme damage, missing pieces.

=== SPECIFIC DEFECT SCORING ===
CORNERS: 10=perfectly sharp | 9=barely noticeable wear (magnification) | 8=slight fraying 1-2 corners | 7=visible rounding 2+ corners | 6+=noticeable rounding
EDGES: 10=crisp clean | 9=minor light white speck | 8-7=noticeable whitening | 6+=visible chipping multiple edges
CENTERING: 55/45=10 | 60/40=9 max | 65/35=8 max | 70/30=7 max | 75/25=6 max
SURFACE: 10=full gloss no flaws | 9=one minor print spot | 8=minor marks/slight gloss loss | 7=light scratches | 6+=noticeable wear

=== KEY RULES ===
1. LOWEST subcategory heavily pulls down overall grade. PSA grades on the WEAKEST aspect.
2. The BACK matters EQUALLY. Edge wear on the back lowers grade just as much as front.
3. Dark-bordered cards show edge wear as white specks - be EXTRA careful.
4. Vintage cards (pre-2000) graded by SAME standards. Age does NOT excuse wear.
5. Foil/chrome cards show surface scratches more easily.

BE HONEST. Users pay $20-50 to submit. Inflated grades waste their money.

Provide your response in the following JSON format ONLY (no additional text):
{
    "centering": {
        "score": <float 1-10>,
        "description": "<assess BOTH sides with estimated ratios>",
        "issues": ["<all centering issues>"]
    },
    "corners": {
        "score": <float 1-10>,
        "description": "<assess all 8 corners: front TL/TR/BL/BR and back TL/TR/BL/BR>",
        "issues": ["<all corner issues>"]
    },
    "surface": {
        "score": <float 1-10>,
        "description": "<assess BOTH surfaces for gloss, scratches, stains>",
        "issues": ["<all surface issues>"]
    },
    "edges": {
        "score": <float 1-10>,
        "description": "<assess all edges on BOTH sides for whitening/chipping>",
        "issues": ["<all edge issues>"]
    },
    "overall_grade": <float 1-10>,
    "psa_recommendation": "<honest recommendation>",
    "send_to_psa": <boolean - true if likely PSA 8+>,
    "analysis_summary": "<2-3 sentence honest summary of BOTH sides>",
    "card_info": "<card identification>"
}

Grade honestly. The back is equally important. Do NOT inflate."""

CORNER_ANALYSIS_ADDITION = """

IMPORTANT: You have been provided with CLOSE-UP PHOTOS OF THE CORNERS in addition to the main card images.
These corner photos allow you to examine each corner in detail.

Corner photos provided (in order after main card images):
- Top-Left Corner
- Top-Right Corner  
- Bottom-Left Corner
- Bottom-Right Corner

For CORNERS scoring, carefully examine EACH corner close-up for:
- Fuzzing or fraying of the card stock
- Whitening at the corner tip
- Rounding or blunting
- Dings or dents
- Any visible wear

Be VERY PRECISE with corner grading since you have detailed close-up views. 
A PSA 10 requires all corners to be sharp with no visible wear.
Minor imperfections visible in close-ups may drop the grade to PSA 9.
"""

def get_vintage_adjustment_prompt(card_year: int) -> str:
    """Generate prompt addition for vintage card consideration based on year"""
    current_year = 2025
    card_age = current_year - card_year
    
    if card_year <= 1979:
        # Pre-1980: True vintage (45+ years old)
        return f"""
VINTAGE CARD CONSIDERATION (Year: {card_year} - {card_age} years old):
This is a TRUE VINTAGE card from the pre-1980 era. PSA graders apply SIGNIFICANTLY more lenient standards:

ADJUSTED GRADING STANDARDS FOR THIS ERA:
- **Centering**: Accept up to 65/35 front, 85/15 back for PSA 10 consideration
- **Corners**: Minor softness is expected and acceptable - only penalize obvious damage
- **Surface**: Print lines, minor color variations, and light wax stains from original packs are acceptable
- **Edges**: Slight roughness from original cutting is normal - only penalize clear chipping

CONTEXT: Cards from this era were printed with primitive technology, hand-cut in many cases, 
and have survived 45+ years. Finding one in ANY good condition is remarkable.
Grade this card GENEROUSLY while acknowledging its age.
"""
    elif card_year <= 1989:
        # 1980-1989: Junk wax era beginning, still vintage (35-45 years)
        return f"""
VINTAGE CARD CONSIDERATION (Year: {card_year} - {card_age} years old):
This is a VINTAGE card from the early modern era. PSA graders apply more lenient standards:

ADJUSTED GRADING STANDARDS FOR THIS ERA:
- **Centering**: Accept up to 60/40 front, 80/20 back for PSA 10 consideration
- **Corners**: Some softness is expected - only penalize clear wear or damage
- **Surface**: Minor print variations and light imperfections from era's printing are acceptable
- **Edges**: Slight roughness is normal for the period - only penalize visible chipping

CONTEXT: Cards from the 1980s used improved but still imperfect printing and cutting technology.
After 35+ years, minor imperfections are expected. Grade with appropriate leniency.
"""
    elif card_year <= 1999:
        # 1990-1999: Junk wax/early premium era (25-35 years)
        return f"""
VINTAGE CARD CONSIDERATION (Year: {card_year} - {card_age} years old):
This is a card from the 1990s era. PSA graders apply MODERATELY lenient standards:

ADJUSTED GRADING STANDARDS FOR THIS ERA:
- **Centering**: Accept up to 57/43 front, 77/23 back for PSA 10 consideration
- **Corners**: Minor softness acceptable - penalize only clear wear
- **Surface**: Light print imperfections from the era are acceptable
- **Edges**: Slight variations acceptable - penalize only visible chipping

CONTEXT: 1990s cards had improving quality but still show era-specific characteristics.
A 25-30 year old card in good condition deserves generous consideration.
"""
    elif card_year <= 2009:
        # 2000-2009: Modern era beginning (15-25 years)
        return f"""
CARD AGE CONSIDERATION (Year: {card_year} - {card_age} years old):
This is a card from the early 2000s. PSA applies SLIGHTLY relaxed standards:

ADJUSTED GRADING STANDARDS FOR THIS ERA:
- **Centering**: Accept up to 55/45 front, 75/25 back for PSA 10 consideration
- **Corners**: Should be sharp but very minor softness acceptable
- **Surface**: Should be clean with minimal tolerance for print issues
- **Edges**: Should be crisp with minimal tolerance

CONTEXT: 2000s cards had good production quality. After 15-25 years, 
very minor imperfections are understandable. Grade fairly.
"""
    else:
        # 2010+: Modern era (less than 15 years)
        return f"""
MODERN CARD (Year: {card_year} - {card_age} years old):
This is a MODERN card. PSA applies STRICT grading standards:

STANDARD GRADING (NO VINTAGE ADJUSTMENT):
- **Centering**: Requires 55/45 front, 75/25 back for PSA 10
- **Corners**: Must be sharp with no visible softness
- **Surface**: Must be clean with no print defects
- **Edges**: Must be crisp with no chipping

CONTEXT: Modern cards are produced with high-quality processes and tight tolerances.
Recent cards should be in near-perfect condition to achieve high grades.
Apply strict PSA standards as written.
"""

AUTO_DETECT_YEAR_PROMPT = """
IMPORTANT - CARD ERA DETECTION:
No year was provided for this card. You MUST identify the card and determine its approximate year/era from:
1. The card design, style, and printing technology
2. The player's age/appearance in the photo
3. The set/brand visible on the card
4. Any text, logos, or copyright dates visible

Once you identify the approximate year, APPLY THE APPROPRIATE GRADING STANDARDS:
- Pre-1980 (TRUE VINTAGE): Very lenient - accept 65/35 centering, expect minor imperfections
- 1980-1989 (VINTAGE): Lenient - accept 60/40 centering, some softness OK
- 1990-1999 (SEMI-VINTAGE): Moderately lenient - accept 57/43 centering
- 2000-2009 (EARLY MODERN): Slightly lenient - accept 55/45 centering
- 2010+ (MODERN): Strict standards apply

Include the detected year/era in your card_info field.
"""

async def analyze_card_with_ai(front_image_base64: str, back_image_base64: str = None, reference_image_base64: str = None, corner_images: list = None, card_year: int = None, auto_detect_year: bool = False) -> dict:
    """Analyze a sports card image using OpenAI GPT-4o Vision"""
    import json
    
    try:
        # Build the image content list for OpenAI
        image_contents = []
        
        # Add front image
        image_contents.append({
            "type": "image_url",
            "image_url": {
                "url": f"data:image/jpeg;base64,{front_image_base64}",
                "detail": "high"
            }
        })
        
        # Get learning context from past predictions
        learning_context = await get_learning_context()
        
        # Determine which prompt to use based on images provided
        if back_image_base64 and reference_image_base64:
            image_contents.append({
                "type": "image_url",
                "image_url": {"url": f"data:image/jpeg;base64,{back_image_base64}", "detail": "high"}
            })
            image_contents.append({
                "type": "image_url",
                "image_url": {"url": f"data:image/jpeg;base64,{reference_image_base64}", "detail": "high"}
            })
            prompt = PSA_ANALYSIS_PROMPT_DUAL_WITH_REFERENCE
        elif reference_image_base64:
            image_contents.append({
                "type": "image_url",
                "image_url": {"url": f"data:image/jpeg;base64,{reference_image_base64}", "detail": "high"}
            })
            prompt = PSA_ANALYSIS_PROMPT_WITH_REFERENCE
        elif back_image_base64:
            image_contents.append({
                "type": "image_url",
                "image_url": {"url": f"data:image/jpeg;base64,{back_image_base64}", "detail": "high"}
            })
            prompt = PSA_ANALYSIS_PROMPT_DUAL
        else:
            prompt = PSA_ANALYSIS_PROMPT_SINGLE
        
        # Add vintage card consideration based on year source
        if card_year:
            vintage_prompt = get_vintage_adjustment_prompt(card_year)
            prompt = vintage_prompt + "\n\n" + prompt
        elif auto_detect_year:
            prompt = AUTO_DETECT_YEAR_PROMPT + "\n\n" + prompt
        
        # Add corner images if provided
        if corner_images and len(corner_images) > 0:
            for corner_img in corner_images:
                if corner_img:
                    image_contents.append({
                        "type": "image_url",
                        "image_url": {"url": f"data:image/jpeg;base64,{corner_img}", "detail": "high"}
                    })
            prompt = prompt + CORNER_ANALYSIS_ADDITION
        
        # Add learning context to prompt if available
        if learning_context:
            prompt = learning_context + prompt
        
        # Create the messages for OpenAI
        messages = [
            {"role": "system", "content": "You are an expert sports card grader. Respond only with valid JSON."},
            {"role": "user", "content": [{"type": "text", "text": prompt}, *image_contents]}
        ]
        
        # Call OpenAI API
        response = await openai_client.chat.completions.create(
            model="gpt-4o",
            messages=messages,
            max_tokens=2000
        )
        
        response_text = response.choices[0].message.content
        
        # Parse JSON response
        cleaned_response = response_text.strip()
        if cleaned_response.startswith("```json"):
            cleaned_response = cleaned_response[7:]
        if cleaned_response.startswith("```"):
            cleaned_response = cleaned_response[3:]
        if cleaned_response.endswith("```"):
            cleaned_response = cleaned_response[:-3]
        cleaned_response = cleaned_response.strip()
        
        result = json.loads(cleaned_response)
        return result
        
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse AI response as JSON: {e}")
        raise HTTPException(status_code=500, detail="Failed to parse grading analysis")
    except Exception as e:
        logger.error(f"AI analysis failed: {e}")
        raise HTTPException(status_code=500, detail=f"AI analysis failed: {str(e)}")

async def get_learning_context() -> str:
    """Get learning context from past predictions vs actual grades"""
    try:
        graded_cards = await db.card_analyses.find(
            {"actual_psa_grade": {"$ne": None}},
            {"_id": 0}
        ).to_list(50)
        
        if not graded_cards:
            return ""
        
        # Calculate stats
        total = len(graded_cards)
        high_predictions = 0
        low_predictions = 0
        accurate = 0
        
        examples = []
        for card in graded_cards[-10:]:  # Last 10 for examples
            predicted = card.get("grading_result", {}).get("overall_grade", 0)
            actual = card.get("actual_psa_grade", 0)
            diff = predicted - actual
            
            if abs(diff) <= 0.5:
                accurate += 1
            elif diff > 0:
                high_predictions += 1
            else:
                low_predictions += 1
            
            examples.append(f"Predicted {predicted}, Actual PSA {actual}")
        
        context = f"""
LEARNING FROM PAST PREDICTIONS:
Based on {total} cards where we received actual PSA grades:
- Accurate (within 0.5): {accurate} times
- Predicted too HIGH: {high_predictions} times  
- Predicted too LOW: {low_predictions} times

Recent examples: {', '.join(examples[-5:])}

"""
        if high_predictions > low_predictions:
            context += "ADJUSTMENT: You tend to predict HIGH. Be slightly more conservative.\n"
        elif low_predictions > high_predictions:
            context += "ADJUSTMENT: You tend to predict LOW. Be slightly more generous.\n"
        
        return context
        
    except Exception as e:
        logger.warning(f"Failed to get learning context: {e}")
        return ""

def create_thumbnail(image_base64: str, max_size: int = 800) -> str:
    """Create a high-quality preview from base64 image"""
    try:
        from PIL import Image
        import io
        
        # Decode base64
        image_data = base64.b64decode(image_base64)
        image = Image.open(io.BytesIO(image_data))
        
        # Resize maintaining aspect ratio
        image.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
        
        # Convert back to base64
        buffer = io.BytesIO()
        image.save(buffer, format='JPEG', quality=90)
        thumbnail_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
        
        return thumbnail_base64
    except Exception as e:
        logger.warning(f"Failed to create thumbnail: {e}")
        # Return original if thumbnail creation fails
        return image_base64[:1000] + "..."  # Truncate for storage

# API Routes
@api_router.get("/")
async def root():
    return {"message": "GradeProphet API - AI-powered PSA grading predictor"}

@api_router.post("/cards/analyze", response_model=CardAnalysisResponse)
async def analyze_card(data: CardAnalysisCreate):
    """Analyze a sports card image and predict PSA grade"""
    try:
        # Validate front image
        if not data.front_image_base64:
            raise HTTPException(status_code=400, detail="Front image is required")
        
        # Remove data URL prefix if present
        front_image = data.front_image_base64
        if ',' in front_image:
            front_image = front_image.split(',')[1]
        
        # Process back image if provided
        back_image = None
        if data.back_image_base64:
            back_image = data.back_image_base64
            if ',' in back_image:
                back_image = back_image.split(',')[1]
        
        # Process corner images if provided (for detailed corner analysis)
        corner_images = []
        for corner in [data.corner_top_left, data.corner_top_right, data.corner_bottom_left, data.corner_bottom_right]:
            if corner:
                corner_img = corner
                if ',' in corner_img:
                    corner_img = corner_img.split(',')[1]
                corner_images.append(corner_img)
        
        # Get reference image and year - either from direct upload or from saved reference
        reference_image = None
        reference_year = None
        if data.reference_image_base64:
            reference_image = data.reference_image_base64
            if ',' in reference_image:
                reference_image = reference_image.split(',')[1]
        elif data.reference_id:
            # Fetch from saved references (includes year from PSA label)
            saved_ref = await db.psa10_references.find_one({"id": data.reference_id}, {"_id": 0})
            if saved_ref:
                reference_image = saved_ref.get('image_full')
                reference_year = saved_ref.get('year')  # Get year from reference
        
        # Determine card year: manual input > reference year > auto-detect
        card_year = data.card_year
        if not card_year and reference_year:
            # Extract numeric year from reference (e.g., "1996-97" -> 1996)
            try:
                year_str = reference_year.split('-')[0].strip()
                card_year = int(year_str)
                logger.info(f"Using year {card_year} from PSA 10 reference")
            except (ValueError, AttributeError):
                pass
        
        # If still no year and no reference, AI will auto-detect (see prompt addition below)
        auto_detect_year = card_year is None and reference_image is None
        
        # Analyze with AI (with optional back, reference, corner images, and card year)
        grading_result = await analyze_card_with_ai(
            front_image, 
            back_image, 
            reference_image,
            corner_images if corner_images else None,
            card_year,
            auto_detect_year
        )
        
        # Create thumbnails for storage (corners are NOT saved, only used for analysis)
        front_thumbnail = create_thumbnail(front_image)
        back_thumbnail = create_thumbnail(back_image) if back_image else None
        
        # Create card analysis object
        card_analysis = CardAnalysis(
            front_image_preview=front_thumbnail,
            back_image_preview=back_thumbnail,
            grading_result=GradingResult(**grading_result),
            card_name=data.card_name or grading_result.get('card_info')
        )
        
        # Save to database
        doc = card_analysis.model_dump()
        doc['created_at'] = doc['created_at'].isoformat()
        await db.card_analyses.insert_one(doc)
        
        # Return response
        return CardAnalysisResponse(
            id=card_analysis.id,
            front_image_preview=card_analysis.front_image_preview,
            back_image_preview=card_analysis.back_image_preview,
            grading_result=card_analysis.grading_result,
            created_at=doc['created_at'],
            card_name=card_analysis.card_name
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Card analysis failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/cards/history", response_model=List[CardAnalysisResponse])
async def get_card_history():
    """Get history of analyzed cards"""
    try:
        cards = await db.card_analyses.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
        return cards
    except Exception as e:
        logger.error(f"Failed to fetch history: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/cards/{card_id}", response_model=CardAnalysisResponse)
async def get_card_analysis(card_id: str):
    """Get a specific card analysis by ID"""
    try:
        card = await db.card_analyses.find_one({"id": card_id}, {"_id": 0})
        if not card:
            raise HTTPException(status_code=404, detail="Card analysis not found")
        return card
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to fetch card: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/cards/{card_id}")
async def delete_card_analysis(card_id: str):
    """Delete a card analysis"""
    try:
        result = await db.card_analyses.delete_one({"id": card_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Card analysis not found")
        return {"message": "Card analysis deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete card: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.put("/cards/{card_id}/feedback", response_model=CardAnalysisResponse)
async def update_card_feedback(card_id: str, feedback: CardFeedbackUpdate):
    """Update a card with actual PSA grade for learning"""
    try:
        # Find the card
        card = await db.card_analyses.find_one({"id": card_id}, {"_id": 0})
        if not card:
            raise HTTPException(status_code=404, detail="Card analysis not found")
        
        # Update with feedback
        update_data = {
            "actual_psa_grade": feedback.actual_psa_grade,
            "psa_cert_number": feedback.psa_cert_number,
            "feedback_date": datetime.now(timezone.utc).isoformat(),
            "status": feedback.status
        }
        
        await db.card_analyses.update_one(
            {"id": card_id},
            {"$set": update_data}
        )
        
        # Return updated card
        updated_card = await db.card_analyses.find_one({"id": card_id}, {"_id": 0})
        return updated_card
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update feedback: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.put("/cards/{card_id}/status")
async def update_card_status(card_id: str, status: str):
    """Update card status (pending, sent_to_psa, graded)"""
    try:
        valid_statuses = ["pending", "sent_to_psa", "graded"]
        if status not in valid_statuses:
            raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")
        
        result = await db.card_analyses.update_one(
            {"id": card_id},
            {"$set": {"status": status}}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Card analysis not found")
        
        return {"message": f"Status updated to {status}"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update status: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/learning/stats", response_model=LearningStats)
async def get_learning_stats():
    """Get learning statistics - how accurate are our predictions"""
    try:
        # Get all cards with actual grades
        all_cards = await db.card_analyses.find({}, {"_id": 0}).to_list(1000)
        
        total_analyzed = len(all_cards)
        graded_cards = [c for c in all_cards if c.get("actual_psa_grade") is not None]
        total_graded = len(graded_cards)
        
        if total_graded == 0:
            return LearningStats(
                total_analyzed=total_analyzed,
                total_graded=0,
                accuracy_rate=0,
                average_difference=0,
                predictions_high=0,
                predictions_low=0,
                predictions_accurate=0
            )
        
        predictions_high = 0
        predictions_low = 0
        predictions_accurate = 0
        total_diff = 0
        
        for card in graded_cards:
            predicted = card.get("grading_result", {}).get("overall_grade", 0)
            actual = card.get("actual_psa_grade", 0)
            diff = predicted - actual
            total_diff += abs(diff)
            
            if abs(diff) <= 0.5:
                predictions_accurate += 1
            elif diff > 0:
                predictions_high += 1
            else:
                predictions_low += 1
        
        accuracy_rate = (predictions_accurate / total_graded) * 100
        average_difference = total_diff / total_graded
        
        return LearningStats(
            total_analyzed=total_analyzed,
            total_graded=total_graded,
            accuracy_rate=round(accuracy_rate, 1),
            average_difference=round(average_difference, 2),
            predictions_high=predictions_high,
            predictions_low=predictions_low,
            predictions_accurate=predictions_accurate
        )
        
    except Exception as e:
        logger.error(f"Failed to get learning stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/learning/history")
async def get_learning_history():
    """Get cards with feedback for learning analysis"""
    try:
        graded_cards = await db.card_analyses.find(
            {"actual_psa_grade": {"$ne": None}},
            {"_id": 0}
        ).sort("feedback_date", -1).to_list(100)
        
        # Add comparison data
        for card in graded_cards:
            predicted = card.get("grading_result", {}).get("overall_grade", 0)
            actual = card.get("actual_psa_grade", 0)
            card["difference"] = round(predicted - actual, 1)
            card["accurate"] = abs(predicted - actual) <= 0.5
        
        return graded_cards
        
    except Exception as e:
        logger.error(f"Failed to get learning history: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# PSA Label Reading Prompt
PSA_LABEL_READER_PROMPT = """Look at this PSA graded card image. Read the PSA label/slab information and extract the card details.

The PSA label typically contains:
- Card year (e.g., 1996, 2020)
- Card set/brand (e.g., Upper Deck, Topps Chrome, Prizm)
- Card name/number (e.g., #138, Kobe Bryant RC)
- Player name
- Grade (should be 10 or Gem Mint)

Return ONLY a JSON object with this format (no other text):
{
    "card_name": "<Year> <Set> <Player Name> <Card Number if visible>",
    "year": "<year>",
    "set": "<card set/brand>",
    "player": "<player name>",
    "grade": "<grade number>"
}

Example response:
{
    "card_name": "1996-97 Upper Deck SP #134 Kobe Bryant RC",
    "year": "1996-97",
    "set": "Upper Deck SP",
    "player": "Kobe Bryant",
    "grade": "10"
}

If you cannot read certain information, use "Unknown" for that field but try your best to read the label."""

async def read_psa_label(image_base64: str) -> dict:
    """Read PSA label information from a graded card image"""
    import json
    
    try:
        messages = [
            {"role": "system", "content": "You are an expert at reading PSA graded card labels. Respond only with valid JSON."},
            {"role": "user", "content": [
                {"type": "text", "text": PSA_LABEL_READER_PROMPT},
                {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_base64}", "detail": "high"}}
            ]}
        ]
        
        response = await openai_client.chat.completions.create(
            model="gpt-4o",
            messages=messages,
            max_tokens=500
        )
        
        response_text = response.choices[0].message.content
        
        # Clean response
        cleaned = response_text.strip()
        if cleaned.startswith("```json"):
            cleaned = cleaned[7:]
        if cleaned.startswith("```"):
            cleaned = cleaned[3:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        
        return json.loads(cleaned.strip())
    except Exception as e:
        logger.error(f"Failed to read PSA label: {e}")
        return {"card_name": "PSA 10 Reference", "error": str(e)}

# PSA 10 Reference Endpoints
@api_router.post("/references", response_model=PSA10ReferenceResponse)
async def create_reference(data: PSA10ReferenceCreate):
    """Save a PSA 10 reference image - automatically reads label info"""
    try:
        if not data.image_base64:
            raise HTTPException(status_code=400, detail="Image is required")
        
        # Remove data URL prefix if present
        image_base64 = data.image_base64
        if ',' in image_base64:
            image_base64 = image_base64.split(',')[1]
        
        # Auto-read PSA label
        label_info = await read_psa_label(image_base64)
        name = data.name if data.name and data.name.strip() else label_info.get("card_name", "PSA 10 Reference")
        year = label_info.get("year")  # Extract year from PSA label
        
        # Create thumbnail for display
        thumbnail = create_thumbnail(image_base64)
        
        # Create reference object with year
        reference = PSA10Reference(
            name=name,
            year=year,
            image_preview=thumbnail,
            image_full=image_base64
        )
        
        # Save to database
        doc = reference.model_dump()
        doc['created_at'] = doc['created_at'].isoformat()
        await db.psa10_references.insert_one(doc)
        
        return PSA10ReferenceResponse(
            id=reference.id,
            name=reference.name,
            year=reference.year,
            image_preview=reference.image_preview,
            created_at=doc['created_at']
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to save reference: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/references", response_model=List[PSA10ReferenceResponse])
async def get_references():
    """Get all saved PSA 10 references"""
    try:
        refs = await db.psa10_references.find({}, {"_id": 0, "image_full": 0}).sort("created_at", -1).to_list(100)
        return refs
    except Exception as e:
        logger.error(f"Failed to fetch references: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/references/{ref_id}")
async def delete_reference(ref_id: str):
    """Delete a PSA 10 reference"""
    try:
        result = await db.psa10_references.delete_one({"id": ref_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Reference not found")
        return {"message": "Reference deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete reference: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# eBay Import Models
class EbayImportRequest(BaseModel):
    url: str

class EbayImage(BaseModel):
    url: str
    base64: str
    thumbnail: str
    suggested_type: Optional[str] = None  # front, back, corner, unknown

class EbayImportResponse(BaseModel):
    success: bool
    title: Optional[str] = None
    images: List[EbayImage] = []
    error: Optional[str] = None

class CornerCropRequest(BaseModel):
    image_base64: str

class CornerCropResponse(BaseModel):
    top_left: str
    top_right: str
    bottom_left: str
    bottom_right: str

# Helper function to extract eBay images
async def scrape_ebay_listing(url: str) -> dict:
    """Scrape eBay listing to extract images"""
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
        }
        
        final_url = url
        item_id = None
        
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True, max_redirects=10) as client:
            # For short URLs (ebay.us), we need to resolve them carefully
            if 'ebay.us' in url or '/m/' in url:
                # Make initial request to get redirects
                response = await client.get(url, headers=headers)
                
                # Check all redirect history for the item ID
                for resp in response.history:
                    resp_url = str(resp.url)
                    # Look for item ID in redirect chain
                    item_match = re.search(r'/itm/(\d+)', resp_url)
                    if item_match:
                        item_id = item_match.group(1)
                        break
                
                # Also check final URL
                if not item_id:
                    item_match = re.search(r'/itm/(\d+)', str(response.url))
                    if item_match:
                        item_id = item_match.group(1)
                
                # Check URL parameters for the real URL
                if not item_id:
                    ru_match = re.search(r'ru=([^&]+)', str(response.url))
                    if ru_match:
                        from urllib.parse import unquote
                        real_url = unquote(ru_match.group(1))
                        item_match = re.search(r'/itm/(\d+)', real_url)
                        if item_match:
                            item_id = item_match.group(1)
            else:
                # Direct item URL
                item_match = re.search(r'/itm/(\d+)', url)
                if item_match:
                    item_id = item_match.group(1)
        
        if not item_id:
            return {
                "success": False,
                "error": "No se pudo extraer el ID del listing de eBay",
                "image_urls": []
            }
        
        # Build clean direct URL
        final_url = f"https://www.ebay.com/itm/{item_id}"
        logger.info(f"Extracted eBay item ID: {item_id}, URL: {final_url}")
        
        # Use Scrape.do API
        if SCRAPEDO_API_KEY:
            async with httpx.AsyncClient(timeout=60.0) as client:
                scrape_url = f"https://api.scrape.do/?token={SCRAPEDO_API_KEY}&url={final_url}&render=true"
                response = await client.get(scrape_url)
                html = response.text
                logger.info("Used Scrape.do API for eBay scraping")
        else:
            async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
                response = await client.get(final_url, headers=headers)
                if response.status_code == 503 or 'challenge' in str(response.url):
                    return {
                        "success": False,
                        "error": "eBay bloqueó el acceso. Configura SCRAPEDO_API_KEY para mejor confiabilidad.",
                        "image_urls": []
                    }
                html = response.text
        
        # Extract title
        title_match = re.search(r'<title>([^<]+)</title>', html)
        title = title_match.group(1) if title_match else "eBay Listing"
        title = title.replace(" | eBay", "").replace(" - eBay", "").strip()
        
        # Extract image URLs - ONLY from the main listing gallery
        image_urls = []
        seen_urls = set()
        
        # Extract item ID from URL
        item_id = None
        item_id_match = re.search(r'/itm/(\d+)', final_url)
        if item_id_match:
            item_id = item_id_match.group(1)
            logger.info(f"Extracted eBay item ID: {item_id}")
        
        # Method 1: Look for the picture gallery data in JSON format
        # eBay stores the main listing images in a specific JSON structure
        gallery_json_patterns = [
            r'"mediaList"\s*:\s*\[(.*?)\]',
            r'"images"\s*:\s*\[(.*?)\]',
            r'"picturePanel"\s*:\s*\{[^}]*"images"\s*:\s*\[(.*?)\]',
        ]
        
        for pattern in gallery_json_patterns:
            match = re.search(pattern, html, re.DOTALL)
            if match:
                gallery_data = match.group(1)
                # Find all image URLs in this gallery data
                img_matches = re.findall(r'"(https://i\.ebayimg\.com/images/g/[^"]+)"', gallery_data)
                for img_url in img_matches:
                    clean_url = img_url.split('?')[0]
                    if clean_url not in seen_urls:
                        # Skip thumbnails
                        if '/s-l64' not in clean_url and '/s-l96' not in clean_url:
                            seen_urls.add(clean_url)
                            image_urls.append(clean_url)
                if image_urls:
                    logger.info(f"Found {len(image_urls)} images from gallery JSON")
                    break
        
        # Method 2: Look for zoom images (these are definitely from main listing)
        if len(image_urls) < 2:
            zoom_matches = re.findall(r'data-zoom-src="(https://i\.ebayimg\.com/images/g/[^"]+)"', html)
            for img_url in zoom_matches:
                clean_url = img_url.split('?')[0]
                if clean_url not in seen_urls:
                    seen_urls.add(clean_url)
                    image_urls.append(clean_url)
            if zoom_matches:
                logger.info(f"Found {len(zoom_matches)} images from zoom-src")
        
        # Method 3: Look for enlarged images in the listing
        if len(image_urls) < 2:
            enlarged_matches = re.findall(r'"enlargedImageUrl"\s*:\s*"(https://i\.ebayimg\.com/images/g/[^"]+)"', html)
            for img_url in enlarged_matches:
                clean_url = img_url.split('?')[0]
                if clean_url not in seen_urls:
                    seen_urls.add(clean_url)
                    image_urls.append(clean_url)
        
        # Method 4: Fallback - look in the FIRST part of HTML only (before similar items)
        if len(image_urls) < 2:
            # Find where similar items section starts
            similar_pos = len(html)
            similar_markers = [
                'id="vi-merch-top"',  # Similar items container
                'id="merch_html_placeholder"',
                '"similarItems"',
                'class="merch-shelf',
                'Similar sponsored items',
                'People also viewed',
            ]
            
            for marker in similar_markers:
                pos = html.find(marker)
                if pos > 0 and pos < similar_pos:
                    similar_pos = pos
            
            # Only search in the main listing area
            main_html = html[:similar_pos]
            logger.info(f"Searching in first {len(main_html)} chars (cut at {similar_pos})")
            
            # Find images in main area only
            main_matches = re.findall(r'src="(https://i\.ebayimg\.com/images/g/[^"]+)"', main_html)
            for img_url in main_matches[:6]:  # Limit to first 6
                clean_url = img_url.split('?')[0]
                if clean_url not in seen_urls:
                    # Skip tiny thumbnails
                    if '/s-l64' not in clean_url and '/s-l96' not in clean_url and '/s-l140' not in clean_url:
                        seen_urls.add(clean_url)
                        image_urls.append(clean_url)
        
        # Upgrade all to high resolution
        high_res_urls = []
        for img_url in image_urls:
            high_res = re.sub(r'/s-l\d+\.', '/s-l1600.', img_url)
            high_res_urls.append(high_res)
        
        # Limit to max 6 images (main listing rarely has more than 6-8 actual photos)
        final_urls = high_res_urls[:6]
        logger.info(f"Final: {len(final_urls)} images from main listing only")
        
        if not final_urls:
            return {
                "success": False,
                "error": "No se encontraron imágenes en el listing.",
                "image_urls": []
            }
        
        return {
            "success": True,
            "title": title,
            "image_urls": final_urls
        }
        
    except httpx.TimeoutException:
        logger.error("eBay scraping timed out")
        return {
            "success": False,
            "error": "Tiempo de espera agotado.",
            "image_urls": []
        }
    except Exception as e:
        logger.error(f"Failed to scrape eBay listing: {e}")
        return {
            "success": False,
            "error": str(e),
            "image_urls": []
        }

async def download_and_encode_image(url: str) -> tuple:
    """Download image and return base64 encoded data"""
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(url, follow_redirects=True)
            if response.status_code == 200:
                image_data = response.content
                base64_data = base64.b64encode(image_data).decode('utf-8')
                
                # Create thumbnail
                img = Image.open(BytesIO(image_data))
                img.thumbnail((200, 200))
                thumb_buffer = BytesIO()
                img.save(thumb_buffer, format='JPEG', quality=70)
                thumbnail = base64.b64encode(thumb_buffer.getvalue()).decode('utf-8')
                
                return base64_data, thumbnail
    except Exception as e:
        logger.error(f"Failed to download image {url}: {e}")
    return None, None

def suggest_image_type(index: int, total: int) -> str:
    """Suggest image type based on position in listing"""
    if index == 0:
        return "front"
    elif index == 1 and total > 2:
        return "back"
    else:
        return "unknown"

def crop_corners_from_image(image_base64: str, corner_size_percent: float = 0.25) -> dict:
    """Crop the four corners from a card image for detailed analysis"""
    try:
        # Decode base64 image
        image_data = base64.b64decode(image_base64)
        img = Image.open(BytesIO(image_data))
        
        width, height = img.size
        
        # Calculate corner size (25% of smaller dimension)
        corner_size = int(min(width, height) * corner_size_percent)
        
        corners = {}
        
        # Top-left corner
        top_left = img.crop((0, 0, corner_size, corner_size))
        tl_buffer = BytesIO()
        top_left.save(tl_buffer, format='JPEG', quality=90)
        corners['top_left'] = base64.b64encode(tl_buffer.getvalue()).decode('utf-8')
        
        # Top-right corner
        top_right = img.crop((width - corner_size, 0, width, corner_size))
        tr_buffer = BytesIO()
        top_right.save(tr_buffer, format='JPEG', quality=90)
        corners['top_right'] = base64.b64encode(tr_buffer.getvalue()).decode('utf-8')
        
        # Bottom-left corner
        bottom_left = img.crop((0, height - corner_size, corner_size, height))
        bl_buffer = BytesIO()
        bottom_left.save(bl_buffer, format='JPEG', quality=90)
        corners['bottom_left'] = base64.b64encode(bl_buffer.getvalue()).decode('utf-8')
        
        # Bottom-right corner
        bottom_right = img.crop((width - corner_size, height - corner_size, width, height))
        br_buffer = BytesIO()
        bottom_right.save(br_buffer, format='JPEG', quality=90)
        corners['bottom_right'] = base64.b64encode(br_buffer.getvalue()).decode('utf-8')
        
        return corners
        
    except Exception as e:
        logger.error(f"Failed to crop corners: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to crop corners: {str(e)}")

# eBay Import Endpoints
@api_router.post("/ebay/import", response_model=EbayImportResponse)
async def import_ebay_listing(data: EbayImportRequest):
    """Import images from an eBay listing URL"""
    try:
        # Validate URL - accept various eBay URL formats
        valid_domains = ['ebay.com', 'ebay.us', 'ebay.co.uk', 'ebay.de', 'ebay.fr', 'ebay.es', 'ebay.it', 'ebay.ca', 'ebay.com.au']
        is_valid = any(domain in data.url for domain in valid_domains)
        
        if not is_valid:
            raise HTTPException(status_code=400, detail="Por favor proporciona un link válido de eBay (ebay.com, ebay.us, etc.)")
        
        # Scrape the listing
        result = await scrape_ebay_listing(data.url)
        
        if not result["success"]:
            return EbayImportResponse(
                success=False,
                error=result.get("error", "Failed to fetch eBay listing")
            )
        
        # Download and encode each image
        images = []
        total_images = len(result["image_urls"])
        
        for idx, img_url in enumerate(result["image_urls"]):
            base64_data, thumbnail = await download_and_encode_image(img_url)
            if base64_data:
                images.append(EbayImage(
                    url=img_url,
                    base64=base64_data,
                    thumbnail=thumbnail,
                    suggested_type=suggest_image_type(idx, total_images)
                ))
        
        if not images:
            return EbayImportResponse(
                success=False,
                error="No images found in the listing"
            )
        
        return EbayImportResponse(
            success=True,
            title=result["title"],
            images=images
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"eBay import failed: {e}")
        return EbayImportResponse(
            success=False,
            error=str(e)
        )

@api_router.post("/corners/crop", response_model=CornerCropResponse)
async def crop_corners(data: CornerCropRequest):
    """Auto-generate corner crops from a card image"""
    try:
        image_base64 = data.image_base64
        if ',' in image_base64:
            image_base64 = image_base64.split(',')[1]
        
        corners = crop_corners_from_image(image_base64)
        
        return CornerCropResponse(**corners)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Corner crop failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ============================================
# WATCHLIST ENDPOINTS
# ============================================

@api_router.post("/watchlist", response_model=WatchlistCardResponse)
async def add_to_watchlist(card: WatchlistCardCreate):
    """Add a card to the watchlist for monitoring"""
    try:
        watchlist_card = WatchlistCard(
            search_query=card.search_query.strip(),
            notes=card.notes
        )
        
        card_dict = watchlist_card.model_dump()
        card_dict['created_at'] = card_dict['created_at'].isoformat()
        if card_dict.get('last_searched'):
            card_dict['last_searched'] = card_dict['last_searched'].isoformat()
        
        await db.watchlist_cards.insert_one(card_dict)
        
        return WatchlistCardResponse(
            id=watchlist_card.id,
            search_query=watchlist_card.search_query,
            notes=watchlist_card.notes,
            created_at=card_dict['created_at'],
            last_searched=card_dict.get('last_searched'),
            listings_found=0
        )
    except Exception as e:
        logger.error(f"Error adding to watchlist: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/watchlist", response_model=List[WatchlistCardResponse])
async def get_watchlist():
    """Get all cards in the watchlist"""
    try:
        cards = await db.watchlist_cards.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
        return [WatchlistCardResponse(**card) for card in cards]
    except Exception as e:
        logger.error(f"Error getting watchlist: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/watchlist/{card_id}")
async def remove_from_watchlist(card_id: str):
    """Remove a card from the watchlist and its associated listings"""
    try:
        result = await db.watchlist_cards.delete_one({"id": card_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Card not found in watchlist")
        
        # Also delete associated listings
        await db.ebay_listings.delete_many({"watchlist_card_id": card_id})
        
        return {"success": True, "message": "Card removed from watchlist"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error removing from watchlist: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.put("/watchlist/{card_id}")
async def update_watchlist_card(card_id: str, card: WatchlistCardCreate):
    """Update a card in the watchlist"""
    try:
        result = await db.watchlist_cards.update_one(
            {"id": card_id},
            {"$set": {
                "search_query": card.search_query.strip(),
                "notes": card.notes
            }}
        )
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Card not found in watchlist")
        
        return {"success": True, "message": "Card updated"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating watchlist card: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ============================================
# EBAY LISTINGS ENDPOINTS
# ============================================

async def search_ebay_for_card(search_query: str) -> List[dict]:
    """Search eBay for a specific card and return listings"""
    if not SCRAPEDO_API_KEY:
        raise HTTPException(status_code=400, detail="Scrape.do API key not configured")
    
    # Build eBay search URL - searching for raw cards (not graded)
    # Using urllib for proper encoding
    from urllib.parse import quote_plus
    # Add negative filters to exclude graded cards: -psa -bgs -sgc -cgc -graded -slab
    encoded_query = quote_plus(f"{search_query} -psa -bgs -sgc -cgc -graded -slab")
    # Sort by newest
    ebay_search_url = f"https://www.ebay.com/sch/i.html?_nkw={encoded_query}&_sop=10"
    
    scrape_url = f"https://api.scrape.do/?token={SCRAPEDO_API_KEY}&url={ebay_search_url}&render=true"
    
    logger.info(f"Searching eBay for: {search_query}")
    
    # Extract key terms from the search query for validation
    # e.g., "1986 Fleer Michael Jordan #57" -> ["1986", "fleer", "michael", "jordan", "57"]
    search_terms = re.findall(r'\b[\w]+\b', search_query.lower())
    # Common words that are NOT required to match (brand names, generic terms)
    common_words = {'the', 'a', 'an', 'and', 'or', 'of', 'card', 'cards', 'rookie', 'rc', 
                   'topps', 'fleer', 'upper', 'deck', 'hoops', 'skybox', 'panini', 
                   'donruss', 'bowman', 'prizm', 'chrome', 'refractor', 'base', 'insert'}
    
    # Player name parts are alphabetic terms that are NOT common words
    # These are the CRITICAL terms that MUST appear in the listing title
    player_name_parts = [term for term in search_terms 
                        if term.isalpha() and len(term) > 2 and term not in common_words]
    
    logger.info(f"Player name parts that MUST match: {player_name_parts}")
    
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.get(scrape_url)
        html_content = response.text
    
    listings = []
    seen_ids = set()
    
    # Find all item IDs first
    item_ids = re.findall(r'/itm/(\d{10,})', html_content)
    item_ids = list(dict.fromkeys(item_ids))  # Remove duplicates while preserving order
    
    logger.info(f"Found {len(item_ids)} unique item IDs")
    
    for item_id in item_ids[:40]:  # Check more items since we filter strictly
        if item_id in seen_ids or item_id == '123456':  # Skip placeholder
            continue
        seen_ids.add(item_id)
        
        # Stop if we have enough good matches
        if len(listings) >= 15:
            break
        
        try:
            # Find the complete listing block for this item
            # eBay uses <li> elements with data-listingid attribute
            li_pattern = rf'<li[^>]*data-listingid="{item_id}"[^>]*>.*?</li>'
            li_match = re.search(li_pattern, html_content, re.DOTALL)
            
            if li_match:
                item_html = li_match.group(0)
            else:
                # Fallback: Extract a window around the item ID
                start_idx = html_content.find(f'data-listingid="{item_id}"')
                if start_idx == -1:
                    start_idx = html_content.find(f'/itm/{item_id}')
                if start_idx == -1:
                    continue
                # Get surrounding context
                start = max(0, start_idx - 500)
                end = min(len(html_content), start_idx + 8000)
                item_html = html_content[start:end]
            
            # Extract title from the listing HTML
            # Look for text content that looks like a card title
            title = "Unknown"
            
            # Pattern 1: Find text between > and < that looks like a title
            text_contents = re.findall(r'>([^<]{20,120})<', item_html)
            for text in text_contents:
                text = text.strip()
                # Skip common non-title texts
                skip_patterns = [
                    'opens in a new', 'out of 5 stars', 'product rating',
                    'delivery', 'located in', 'positive', 'watch', 
                    'add to cart', 'buy it now', 'see more', 'similar items'
                ]
                if any(skip in text.lower() for skip in skip_patterns):
                    continue
                # Accept any text that looks like a card title (long enough)
                if len(text) > 25:
                    title = text
                    break
            
            # Fallback: Use first substantial text that's not a skip pattern
            if title == "Unknown":
                for text in text_contents:
                    text = text.strip()
                    if len(text) > 20 and not any(skip in text.lower() for skip in ['opens', 'stars', 'rating', 'delivery', 'located', 'positive', 'watch', 'cart', 'buy', 'similar', 'sponsored']):
                        title = text
                        break
            
            # CRITICAL: Validate that this listing matches the search query
            # The title MUST contain the player name parts
            title_lower = title.lower()
            
            # Check how many player name parts are in the title
            player_matches = sum(1 for part in player_name_parts if part in title_lower)
            
            # Require at least 2 matches, or 1 if there's only 1 player name part
            min_required = min(2, len(player_name_parts)) if player_name_parts else 0
            
            if player_matches < min_required:
                logger.debug(f"SKIPPING '{title[:60]}' - player name mismatch ({player_matches}/{min_required} matches)")
                continue
            
            # Skip if title contains grading company names or slab references
            title_upper = title.upper()
            if any(x in title_upper for x in ['PSA ', 'BGS ', 'SGC ', 'CGC ', ' PSA', ' BGS', ' SGC', ' CGC', 'GRADED', 'SLAB', 'SLABBED']):
                continue
            
            # Extract price
            price_str = "$0.00"
            price_value = 0.0
            price_patterns = [
                r'class="[^"]*s-item__price[^"]*"[^>]*>\$?([\d,]+\.?\d*)',
                r'>\$([\d,]+\.?\d*)<',
                r'\$([\d,]+\.?\d*)',
            ]
            for pattern in price_patterns:
                match = re.search(pattern, item_html)
                if match:
                    try:
                        price_value = float(match.group(1).replace(',', ''))
                        price_str = f"${price_value:,.2f}"
                        break
                    except:
                        pass
            
            # Determine listing type and time left
            listing_type = "buy_now"
            bids = None
            time_left = None
            
            # Check for bid indicators
            bid_match = re.search(r'(\d+)\s*bid', item_html.lower())
            if bid_match:
                listing_type = "auction"
                bids = int(bid_match.group(1))
            
            # Check for time left
            time_patterns = [
                r'(\d+[hmd]\s*\d*[hmd]?)\s*left',
                r'class="[^"]*time[^"]*"[^>]*>([^<]+)<',
            ]
            for pattern in time_patterns:
                match = re.search(pattern, item_html.lower())
                if match:
                    time_left = match.group(1).strip()
                    listing_type = "auction"
                    break
            
            # Extract image URL
            image_url = ""
            img_patterns = [
                r'src="(https://i\.ebayimg\.com/[^"]+\.(?:jpg|jpeg|png|webp))"',
                r'data-src="(https://i\.ebayimg\.com/[^"]+)"',
            ]
            for pattern in img_patterns:
                match = re.search(pattern, item_html)
                if match:
                    image_url = match.group(1)
                    if 'gif' not in image_url.lower():
                        break
            
            if not image_url:
                continue
            
            # Upgrade to higher resolution image
            image_url = re.sub(r'/s-l\d+\.', '/s-l800.', image_url)
            
            listing_url = f"https://www.ebay.com/itm/{item_id}"
            
            # Normalize title for deduplication (remove extra spaces, lowercase)
            normalized_title = ' '.join(title.lower().split())
            
            # Check if we already have a very similar listing (same title)
            is_duplicate = False
            for existing in listings:
                existing_normalized = ' '.join(existing['title'].lower().split())
                # If titles are very similar (>90% match), skip this one
                if normalized_title == existing_normalized:
                    is_duplicate = True
                    logger.debug(f"Skipping duplicate listing: {title[:50]}")
                    break
                # Also check if one title contains the other (common duplicate pattern)
                if len(normalized_title) > 20 and len(existing_normalized) > 20:
                    if normalized_title in existing_normalized or existing_normalized in normalized_title:
                        is_duplicate = True
                        logger.debug(f"Skipping similar listing: {title[:50]}")
                        break
            
            if is_duplicate:
                continue
            
            listings.append({
                "ebay_item_id": item_id,
                "title": title[:200],  # Limit title length
                "price": price_str,
                "price_value": price_value,
                "listing_type": listing_type,
                "time_left": time_left,
                "image_url": image_url,
                "listing_url": listing_url,
                "bids": bids
            })
            
            logger.info(f"Extracted listing: {item_id} - {title[:50]}... - {price_str}")
            
        except Exception as e:
            logger.warning(f"Error parsing item {item_id}: {e}")
            continue
    
    logger.info(f"Total listings extracted: {len(listings)}")
    return listings

@api_router.post("/watchlist/search", response_model=SearchResultSummary)
async def search_all_watchlist():
    """Search eBay for all cards in the watchlist and save new listings"""
    try:
        watchlist = await db.watchlist_cards.find({}, {"_id": 0}).to_list(100)
        
        if not watchlist:
            return SearchResultSummary(
                total_cards_searched=0,
                new_listings_found=0,
                cards_with_results=[]
            )
        
        total_new_listings = 0
        cards_with_results = []
        
        for card in watchlist:
            card_id = card['id']
            search_query = card['search_query']
            
            try:
                # Search eBay for this card
                listings = await search_ebay_for_card(search_query)
                
                new_count = 0
                for listing_data in listings:
                    # Check if we already have this listing by ID
                    existing = await db.ebay_listings.find_one({
                        "ebay_item_id": listing_data["ebay_item_id"]
                    })
                    
                    if existing:
                        continue
                    
                    # Also check for duplicate titles in the same watchlist card
                    normalized_title = ' '.join(listing_data["title"].lower().split())
                    existing_by_title = await db.ebay_listings.find_one({
                        "watchlist_card_id": card_id,
                        "title": {"$regex": f"^{re.escape(listing_data['title'][:50])}", "$options": "i"}
                    })
                    
                    if existing_by_title:
                        logger.debug(f"Skipping duplicate by title: {listing_data['title'][:50]}")
                        continue
                    
                    # Save new listing
                    ebay_listing = EbayListing(
                        watchlist_card_id=card_id,
                        search_query=search_query,
                        **listing_data
                    )
                    
                    listing_dict = ebay_listing.model_dump()
                    listing_dict['found_at'] = listing_dict['found_at'].isoformat()
                    
                    await db.ebay_listings.insert_one(listing_dict)
                    new_count += 1
                
                if new_count > 0:
                    cards_with_results.append(search_query)
                    total_new_listings += new_count
                
                # Update the watchlist card with search info
                total_listings = await db.ebay_listings.count_documents({"watchlist_card_id": card_id})
                await db.watchlist_cards.update_one(
                    {"id": card_id},
                    {"$set": {
                        "last_searched": datetime.now(timezone.utc).isoformat(),
                        "listings_found": total_listings
                    }}
                )
                
            except Exception as e:
                logger.error(f"Error searching for card '{search_query}': {e}")
                continue
        
        return SearchResultSummary(
            total_cards_searched=len(watchlist),
            new_listings_found=total_new_listings,
            cards_with_results=cards_with_results
        )
        
    except Exception as e:
        logger.error(f"Error in watchlist search: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/listings", response_model=List[EbayListingResponse])
async def get_listings(status: Optional[str] = None, watchlist_card_id: Optional[str] = None):
    """Get eBay listings, optionally filtered by status or watchlist card"""
    try:
        query = {"status": {"$ne": "deleted"}}
        if status:
            query["status"] = status
        if watchlist_card_id:
            query["watchlist_card_id"] = watchlist_card_id
        
        listings = await db.ebay_listings.find(query, {"_id": 0}).sort("found_at", -1).to_list(500)
        return [EbayListingResponse(**listing) for listing in listings]
    except Exception as e:
        logger.error(f"Error getting listings: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.put("/listings/{listing_id}/status")
async def update_listing_status(listing_id: str, status: str):
    """Update the status of a listing (new, seen, interested, ignored)"""
    try:
        valid_statuses = ["new", "seen", "interested", "ignored"]
        if status not in valid_statuses:
            raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")
        
        result = await db.ebay_listings.update_one(
            {"id": listing_id},
            {"$set": {"status": status}}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Listing not found")
        
        return {"success": True, "message": f"Listing marked as {status}"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating listing status: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/listings/{listing_id}")
async def delete_listing(listing_id: str):
    """Mark a listing as deleted so it won't reappear"""
    try:
        result = await db.ebay_listings.update_one(
            {"id": listing_id},
            {"$set": {"status": "deleted"}}
        )
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Listing not found")
        return {"success": True, "message": "Listing deleted"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting listing: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/listings")
async def clear_all_listings(watchlist_card_id: Optional[str] = None):
    """Clear all listings or listings for a specific watchlist card"""
    try:
        query = {}
        if watchlist_card_id:
            query["watchlist_card_id"] = watchlist_card_id
        
        result = await db.ebay_listings.delete_many(query)
        return {"success": True, "deleted_count": result.deleted_count}
    except Exception as e:
        logger.error(f"Error clearing listings: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/listings/stats")
async def get_listings_stats():
    """Get statistics about the listings"""
    try:
        total = await db.ebay_listings.count_documents({})
        new_count = await db.ebay_listings.count_documents({"status": "new"})
        interested_count = await db.ebay_listings.count_documents({"status": "interested"})
        
        return {
            "total_listings": total,
            "new_listings": new_count,
            "interested_listings": interested_count
        }
    except Exception as e:
        logger.error(f"Error getting listing stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ============================================
# DIAGNOSTIC / TEST ENDPOINT
# ============================================

@api_router.get("/test-ebay")
async def test_ebay_search():
    """Test endpoint to verify eBay search is working. Hit this in your browser to check."""
    import traceback
    results = {
        "step_1_env_check": {},
        "step_2_scrape_test": {},
        "step_3_parse_test": {},
        "overall": "PENDING"
    }
    
    # Step 1: Check environment variables
    scrapedo_key = os.environ.get('SCRAPEDO_API_KEY', '')
    results["step_1_env_check"] = {
        "SCRAPEDO_API_KEY_present": bool(scrapedo_key),
        "SCRAPEDO_API_KEY_length": len(scrapedo_key),
        "OPENAI_API_KEY_present": bool(os.environ.get('OPENAI_API_KEY', '')),
        "MONGO_URL_present": bool(os.environ.get('MONGO_URL', '')),
    }
    
    if not scrapedo_key:
        results["overall"] = "FAIL - SCRAPEDO_API_KEY not found in environment"
        return results
    
    # Step 2: Test Scrape.do API with a simple eBay search
    try:
        from urllib.parse import quote_plus
        test_query = "baseball card"
        encoded_query = quote_plus(test_query)
        ebay_url = f"https://www.ebay.com/sch/i.html?_nkw={encoded_query}&_sop=10"
        scrape_url = f"https://api.scrape.do/?token={scrapedo_key}&url={ebay_url}&render=true"
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.get(scrape_url)
            
        results["step_2_scrape_test"] = {
            "status_code": response.status_code,
            "response_length": len(response.text),
            "has_ebay_content": "ebay" in response.text.lower(),
            "has_item_ids": bool(re.findall(r'/itm/(\d{10,})', response.text)),
        }
        
        if response.status_code != 200:
            results["overall"] = f"FAIL - Scrape.do returned status {response.status_code}"
            return results
            
        if len(response.text) < 1000:
            results["overall"] = "FAIL - Scrape.do returned very short response (possible block or bad key)"
            results["step_2_scrape_test"]["first_500_chars"] = response.text[:500]
            return results
        
        # Step 3: Try to parse listings
        item_ids = re.findall(r'/itm/(\d{10,})', response.text)
        item_ids = list(dict.fromkeys(item_ids))[:5]
        
        results["step_3_parse_test"] = {
            "item_ids_found": len(item_ids),
            "sample_ids": item_ids[:3],
        }
        
        if item_ids:
            results["overall"] = f"SUCCESS - Found {len(item_ids)} eBay listings. Everything is working!"
        else:
            results["overall"] = "PARTIAL - Got eBay page but could not find item IDs in HTML"
            
    except Exception as e:
        results["step_2_scrape_test"] = {
            "error": str(e),
            "traceback": traceback.format_exc()
        }
        results["overall"] = f"FAIL - Error during search: {str(e)}"
    
    return results

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
