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
    image_preview: str  # Thumbnail for display
    image_full: str  # Full base64 for analysis
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PSA10ReferenceCreate(BaseModel):
    name: Optional[str] = None  # Optional - will auto-read from PSA label if not provided
    image_base64: str

class PSA10ReferenceResponse(BaseModel):
    id: str
    name: str
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

class CardAnalysisCreate(BaseModel):
    front_image_base64: str
    back_image_base64: Optional[str] = None
    reference_image_base64: Optional[str] = None  # Direct PSA 10 reference upload
    reference_id: Optional[str] = None  # OR select from saved references
    card_name: Optional[str] = None

class CardAnalysisResponse(BaseModel):
    id: str
    front_image_preview: str
    back_image_preview: Optional[str] = None
    grading_result: GradingResult
    created_at: str
    card_name: Optional[str] = None


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
    "estimated_raw_value": "<estimated value in USD>",
    "estimated_graded_value": "<estimated value if graded in USD>",
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
    "estimated_raw_value": "<estimated value in USD>",
    "estimated_graded_value": "<estimated value if graded in USD>",
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
    "estimated_raw_value": "<estimated value as raw card in USD>",
    "estimated_graded_value": "<estimated value if graded at predicted grade in USD>",
    "analysis_summary": "<2-3 sentence summary covering condition of BOTH sides>",
    "card_info": "<if identifiable, provide card name/year/player/set>"
}

Remember: Grade the CARD, not the IMAGE QUALITY. A clean-looking card deserves a high grade. Give benefit of the doubt!"""

async def analyze_card_with_ai(front_image_base64: str, back_image_base64: str = None, reference_image_base64: str = None) -> dict:
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
        
        # Analyze with AI (with optional back and reference images)
        grading_result = await analyze_card_with_ai(front_image, back_image, reference_image)
        
        # Create thumbnails for storage
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
        
        # Auto-read PSA label if no name provided
        name = data.name
        if not name or name.strip() == "":
            label_info = await read_psa_label(image_base64)
            name = label_info.get("card_name", "PSA 10 Reference")
        
        # Create thumbnail for display
        thumbnail = create_thumbnail(image_base64)
        
        # Create reference object
        reference = PSA10Reference(
            name=name,
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
