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
SCRAPEDO_API_KEY = os.environ.get('SCRAPEDO_API_KEY', '')

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
    grade_min: float = Field(default=0, ge=0, le=10)  # Minimum likely grade
    grade_max: float = Field(default=10, ge=0, le=10)  # Maximum likely grade
    confidence: str = Field(default="medium")  # high, medium, low
    psa_recommendation: str
    send_to_psa: bool
    recommendation_level: str = Field(default="REVIEW")  # SEND, REVIEW, NO_SEND
    analysis_summary: str
    card_info: Optional[str] = None
    defects_found: List[str] = Field(default_factory=list)  # Clear list of all defects

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
    ebay_url: Optional[str] = None  # eBay listing URL for easy access
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
    ebay_url: Optional[str] = None  # eBay listing URL
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
    ebay_url: Optional[str] = None
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


# PSA Grading Analysis Prompt - STRICT VERSION
PSA_ANALYSIS_PROMPT_SINGLE = """You are an expert sports card grader with 20+ years of hands-on experience at PSA. You are known for being STRICT and CONSERVATIVE in your grading - you would rather under-grade than over-grade.

STRICT GRADING PHILOSOPHY:
- PSA 10 GEM MINT is RARE - only 1 in 20 cards deserve it. Requires PERFECTION.
- PSA 9 MINT requires near-perfection with only ONE minor flaw maximum.
- Most cards from eBay listings are PSA 7-8 range. Be realistic.
- When in doubt, grade LOWER. It's better to be pleasantly surprised than disappointed.

CRITICAL - WHAT TO LOOK FOR:
- **Centering**: PSA 10 = 55/45 or better on BOTH front and back. PSA 9 = 60/40. Measure carefully.
- **Corners**: Look at ALL 4 corners closely. ANY visible wear, fuzzing, or softness = deduct points.
- **Surface**: Check for scratches, print lines, ink spots, wax stains, roller marks. Common on vintage.
- **Edges**: Check for whitening, chipping, rough cuts. Very common flaw.

STRICT SCORING GUIDE:
- 10: PERFECT. Zero defects visible even under magnification. Extremely rare.
- 9.5: Near perfect. One barely visible flaw. Very rare.
- 9: One minor flaw visible (slight centering, one soft corner). Uncommon.
- 8.5: One-two minor flaws. Above average card.
- 8: Multiple minor flaws OR one moderate flaw. Good condition.
- 7-7.5: Several flaws but still presentable. Average condition.
- 6 and below: Obvious visible defects.

DO NOT PENALIZE FOR:
- Image compression artifacts or blur (but note if image quality prevents accurate grading)
- Lighting reflections or photography issues
- Scanner lines or digital noise

Provide your response in the following JSON format ONLY (no additional text):
{
    "centering": {
        "score": <float 1-10>,
        "description": "<specific measurement like 55/45 or 60/40>",
        "issues": ["<specific issues found>"]
    },
    "corners": {
        "score": <float 1-10>,
        "description": "<describe each corner: TL, TR, BL, BR>",
        "issues": ["<specific issues like 'Top-left corner shows slight wear'>"]
    },
    "surface": {
        "score": <float 1-10>,
        "description": "<describe surface condition>",
        "issues": ["<specific issues like 'Light scratch visible center-left'>"]
    },
    "edges": {
        "score": <float 1-10>,
        "description": "<describe all 4 edges>",
        "issues": ["<specific issues like 'Minor whitening on top edge'>"]
    },
    "overall_grade": <float 1-10 - be conservative>,
    "grade_min": <float - lowest likely PSA grade>,
    "grade_max": <float - highest likely PSA grade>,
    "confidence": "<high/medium/low - based on image quality and defect visibility>",
    "psa_recommendation": "<detailed recommendation>",
    "send_to_psa": <true only if likely to get 9+ AND worth the grading cost>,
    "recommendation_level": "<SEND if 9+ confident / REVIEW if 8-9 range / NO_SEND if below 8>",
    "analysis_summary": "<honest 2-3 sentence summary>",
    "card_info": "<card name/year/player/set if identifiable>",
    "defects_found": ["<complete list of ALL defects found, be specific>"]
}

Remember: Grade CONSERVATIVELY. A 9 from you should be a confident 9 from PSA."""

PSA_ANALYSIS_PROMPT_WITH_REFERENCE = """You are an expert sports card grader with 20+ years experience at PSA. You are STRICT and CONSERVATIVE. You have a PSA 10 REFERENCE to compare against.

You are analyzing:
- IMAGE 1: The card to be graded (FRONT)
- IMAGE 2: A PSA 10 REFERENCE of the same or similar card

STRICT COMPARISON:
- PSA 10 is PERFECT. Any visible difference from the reference = NOT a 10.
- PSA 9 allows ONE minor flaw. TWO minor flaws = 8.5 or lower.
- Be CRITICAL. Most cards are NOT PSA 10 worthy.

Compare specifically:
1. CENTERING: Is it as centered as the PSA 10? Even 60/40 vs 55/45 is a difference.
2. CORNERS: Are ALL 4 corners as sharp? Any softness or wear = deduct.
3. SURFACE: Any scratches, marks, print issues not on PSA 10 = deduct.
4. EDGES: Any whitening, chipping, roughness not on PSA 10 = deduct.

Provide your response in the following JSON format ONLY:
{
    "centering": {
        "score": <float 1-10>,
        "description": "<specific comparison to PSA 10>",
        "issues": ["<differences from PSA 10>"]
    },
    "corners": {
        "score": <float 1-10>,
        "description": "<compare all 4 corners to PSA 10>",
        "issues": ["<differences from PSA 10>"]
    },
    "surface": {
        "score": <float 1-10>,
        "description": "<compare surface to PSA 10>",
        "issues": ["<differences from PSA 10>"]
    },
    "edges": {
        "score": <float 1-10>,
        "description": "<compare edges to PSA 10>",
        "issues": ["<differences from PSA 10>"]
    },
    "overall_grade": <float 1-10 - be conservative>,
    "grade_min": <float - lowest likely grade>,
    "grade_max": <float - highest likely grade>,
    "confidence": "<high/medium/low>",
    "psa_recommendation": "<honest recommendation>",
    "send_to_psa": <true only if likely 9+>,
    "recommendation_level": "<SEND/REVIEW/NO_SEND>",
    "analysis_summary": "<honest summary vs PSA 10>",
    "card_info": "<card identification>",
    "defects_found": ["<ALL differences from PSA 10 reference>"]
}

The PSA 10 reference is your calibration standard - anything less than equal = grade lower."""

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

PSA_ANALYSIS_PROMPT_DUAL = """You are an expert sports card grader with 20+ years of hands-on experience at PSA. You grade cards like a HUMAN EXPERT would - using your trained eye to distinguish between ACTUAL card defects and IMAGE/SCAN ARTIFACTS.

You are being shown TWO images: the FRONT and BACK of the same sports card.

CRITICAL DISTINCTION - DO NOT PENALIZE FOR:
- Image compression artifacts, pixelation, or blur
- Lighting reflections, glare, or shadows from photography
- Scanner lines or digital noise
- Color variations due to camera/lighting
- Apparent "issues" that are clearly just photo quality limitations

ONLY PENALIZE FOR CLEARLY VISIBLE ACTUAL DEFECTS:
- **Centering**: FRONT needs 55/45, BACK needs 75/25 for PSA 10. Be generous if it looks centered.
- **Corners**: Only dock for OBVIOUS wear, fraying, or rounding visible to naked eye on all 8 corners.
- **Surface**: Only penalize for CLEAR scratches, creases, stains on BOTH sides - NOT potential artifacts.
- **Edges**: Only for VISIBLE chipping or whitening that's clearly on the card itself.

GRADING PHILOSOPHY:
- Modern cards in good condition from a collector typically deserve 9-10 consideration
- Give the BENEFIT OF THE DOUBT when something could be image quality vs actual defect
- A card that LOOKS clean and sharp to the eye should score high
- Only list issues you are CONFIDENT are real card defects, not maybes

The FIRST image is the FRONT of the card.
The SECOND image is the BACK of the card.

Provide your response in the following JSON format ONLY (no additional text):
{
    "centering": {
        "score": <float 1-10>,
        "description": "<assessment of BOTH front and back centering>",
        "issues": ["<only CONFIRMED real issues, empty array if none visible>"]
    },
    "corners": {
        "score": <float 1-10>,
        "description": "<assessment of all 8 corners>",
        "issues": ["<only CONFIRMED real issues, empty array if none visible>"]
    },
    "surface": {
        "score": <float 1-10>,
        "description": "<assessment of both surfaces>",
        "issues": ["<only CONFIRMED real issues, empty array if none visible>"]
    },
    "edges": {
        "score": <float 1-10>,
        "description": "<assessment of all edges>",
        "issues": ["<only CONFIRMED real issues, empty array if none visible>"]
    },
    "overall_grade": <float 1-10>,
    "psa_recommendation": "<detailed recommendation considering BOTH sides>",
    "send_to_psa": <boolean - true if card is likely to get 8+ grade>,
    "analysis_summary": "<2-3 sentence summary covering condition of BOTH sides>",
    "card_info": "<if identifiable, provide card name/year/player/set>"
}

Remember: Grade the CARD, not the IMAGE QUALITY. A clean-looking card deserves a high grade. Give benefit of the doubt!"""

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

def create_thumbnail(image_base64: str, max_size: int = 800, quality: int = 90) -> str:
    """Create a high-quality preview from base64 image
    
    Args:
        image_base64: Base64 encoded image
        max_size: Maximum dimension (width or height) - default 800px for good detail
        quality: JPEG quality 1-100 - default 90 for high quality
    """
    try:
        from PIL import Image
        import io
        
        # Decode base64
        image_data = base64.b64decode(image_base64)
        image = Image.open(io.BytesIO(image_data))
        
        # Only resize if larger than max_size
        if image.width > max_size or image.height > max_size:
            image.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
        
        # Convert back to base64 with high quality
        buffer = io.BytesIO()
        # Use RGB mode for JPEG (in case image has alpha channel)
        if image.mode in ('RGBA', 'LA', 'P'):
            image = image.convert('RGB')
        image.save(buffer, format='JPEG', quality=quality)
        thumbnail_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
        
        return thumbnail_base64
    except Exception as e:
        logger.warning(f"Failed to create thumbnail: {e}")
        # Return original if thumbnail creation fails
        return image_base64

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
            card_name=data.card_name or grading_result.get('card_info'),
            ebay_url=data.ebay_url
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
            card_name=card_analysis.card_name,
            ebay_url=card_analysis.ebay_url
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
        
        # Extract image URLs
        image_urls = set()
        
        patterns = [
            r'data-zoom-src="([^"]+)"',
            r'"imageUrl"\s*:\s*"([^"]+)"',
            r'"enlargedImageUrl"\s*:\s*"([^"]+)"',
            r'src="(https://i\.ebayimg\.com/images/g/[^"]+)"',
            r'"(https://i\.ebayimg\.com/images/g/[^"]+)"',
        ]
        
        for pattern in patterns:
            matches = re.findall(pattern, html)
            for match in matches:
                if 'ebayimg.com' in match:
                    if '/s-l64' not in match and '/s-l96' not in match and '/s-l140' not in match:
                        clean_url = match.split('?')[0]
                        image_urls.add(clean_url)
        
        # Upgrade to high resolution
        high_res_urls = set()
        for img_url in image_urls:
            high_res = re.sub(r'/s-l\d+\.', '/s-l1600.', img_url)
            high_res_urls.add(high_res)
        
        final_urls = list(high_res_urls)[:12]
        logger.info(f"Found {len(final_urls)} images from eBay listing")
        
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
