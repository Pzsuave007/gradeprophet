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
from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent

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


# PSA Grading Analysis Prompt
PSA_ANALYSIS_PROMPT_SINGLE = """You are an expert sports card grader with 20+ years of hands-on experience at PSA. You grade cards like a HUMAN EXPERT would - using your trained eye to distinguish between ACTUAL card defects and IMAGE/SCAN ARTIFACTS.

CRITICAL DISTINCTION - DO NOT PENALIZE FOR:
- Image compression artifacts, pixelation, or blur
- Lighting reflections, glare, or shadows from photography
- Scanner lines or digital noise
- Color variations due to camera/lighting
- Apparent "issues" that are clearly just photo quality limitations

ONLY PENALIZE FOR CLEARLY VISIBLE ACTUAL DEFECTS:
- **Centering**: PSA 10 = 55/45 or better. Be generous - if it looks reasonably centered, it probably is.
- **Corners**: Only dock points for OBVIOUS wear, fraying, or rounding visible to naked eye.
- **Surface**: Only penalize for CLEAR scratches, creases, stains - NOT potential artifacts.
- **Edges**: Only for VISIBLE chipping or whitening that's clearly on the card itself.

GRADING PHILOSOPHY:
- Modern cards in good condition from a collector typically deserve 9-10 consideration
- Give the BENEFIT OF THE DOUBT when something could be image quality vs actual defect
- A card that LOOKS clean and sharp to the eye should score high
- Only list issues you are CONFIDENT are real card defects, not maybes

Provide your response in the following JSON format ONLY (no additional text):
{
    "centering": {
        "score": <float 1-10>,
        "description": "<brief assessment>",
        "issues": ["<only CONFIRMED real issues, empty array if none visible>"]
    },
    "corners": {
        "score": <float 1-10>,
        "description": "<brief assessment>",
        "issues": ["<only CONFIRMED real issues, empty array if none visible>"]
    },
    "surface": {
        "score": <float 1-10>,
        "description": "<brief assessment>",
        "issues": ["<only CONFIRMED real issues, empty array if none visible>"]
    },
    "edges": {
        "score": <float 1-10>,
        "description": "<brief assessment>",
        "issues": ["<only CONFIRMED real issues, empty array if none visible>"]
    },
    "overall_grade": <float 1-10>,
    "psa_recommendation": "<detailed recommendation about sending to PSA>",
    "send_to_psa": <boolean - true if card is likely to get 8+ grade>,
    "analysis_summary": "<2-3 sentence summary of the card's condition>",
    "card_info": "<if identifiable, provide card name/year/player/set>"
}

Remember: Grade the CARD, not the IMAGE QUALITY. A clean-looking card deserves a high grade."""

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

async def analyze_card_with_ai(front_image_base64: str, back_image_base64: str = None, reference_image_base64: str = None, corner_images: list = None, card_year: int = None) -> dict:
    """Analyze a sports card image using OpenAI GPT-5.2 Vision"""
    import json
    
    try:
        # Create chat instance
        chat = LlmChat(
            api_key=OPENAI_API_KEY,
            session_id=str(uuid.uuid4()),
            system_message="You are an expert sports card grader. Respond only with valid JSON."
        ).with_model("openai", "gpt-5.2")
        
        # Create image contents list
        image_contents = [ImageContent(image_base64=front_image_base64)]
        
        # Get learning context from past predictions
        learning_context = await get_learning_context()
        
        # Determine which prompt to use based on images provided
        if back_image_base64 and reference_image_base64:
            # Both back and reference provided
            image_contents.append(ImageContent(image_base64=back_image_base64))
            image_contents.append(ImageContent(image_base64=reference_image_base64))
            prompt = PSA_ANALYSIS_PROMPT_DUAL_WITH_REFERENCE
        elif reference_image_base64:
            # Only reference provided (no back)
            image_contents.append(ImageContent(image_base64=reference_image_base64))
            prompt = PSA_ANALYSIS_PROMPT_WITH_REFERENCE
        elif back_image_base64:
            # Only back provided (no reference)
            image_contents.append(ImageContent(image_base64=back_image_base64))
            prompt = PSA_ANALYSIS_PROMPT_DUAL
        else:
            # Only front image
            prompt = PSA_ANALYSIS_PROMPT_SINGLE
        
        # Add vintage card consideration if year is provided
        if card_year:
            vintage_prompt = get_vintage_adjustment_prompt(card_year)
            prompt = vintage_prompt + "\n\n" + prompt
        
        # Add corner images if provided (for detailed corner analysis)
        if corner_images and len(corner_images) > 0:
            for corner_img in corner_images:
                if corner_img:
                    image_contents.append(ImageContent(image_base64=corner_img))
            # Add corner analysis instructions to prompt
            prompt = prompt + CORNER_ANALYSIS_ADDITION
        
        # Add learning context to prompt if available
        if learning_context:
            prompt = learning_context + prompt
        
        # Create user message with image(s)
        user_message = UserMessage(
            text=prompt,
            file_contents=image_contents
        )
        
        # Send message and get response
        response = await chat.send_message(user_message)
        
        # Parse JSON response
        # Clean the response - remove markdown code blocks if present
        cleaned_response = response.strip()
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

def create_thumbnail(image_base64: str, max_size: int = 200) -> str:
    """Create a smaller thumbnail from base64 image"""
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
        image.save(buffer, format='JPEG', quality=70)
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
        
        # Get reference image - either from direct upload or from saved reference
        reference_image = None
        if data.reference_image_base64:
            reference_image = data.reference_image_base64
            if ',' in reference_image:
                reference_image = reference_image.split(',')[1]
        elif data.reference_id:
            # Fetch from saved references
            saved_ref = await db.psa10_references.find_one({"id": data.reference_id}, {"_id": 0})
            if saved_ref:
                reference_image = saved_ref.get('image_full')
        
        # Analyze with AI (with optional back, reference, corner images, and card year)
        grading_result = await analyze_card_with_ai(
            front_image, 
            back_image, 
            reference_image,
            corner_images if corner_images else None,
            data.card_year
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
        chat = LlmChat(
            api_key=OPENAI_API_KEY,
            session_id=str(uuid.uuid4()),
            system_message="You are an expert at reading PSA graded card labels. Respond only with valid JSON."
        ).with_model("openai", "gpt-5.2")
        
        image_content = ImageContent(image_base64=image_base64)
        user_message = UserMessage(
            text=PSA_LABEL_READER_PROMPT,
            file_contents=[image_content]
        )
        
        response = await chat.send_message(user_message)
        
        # Clean response
        cleaned = response.strip()
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
