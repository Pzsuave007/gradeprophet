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
    estimated_raw_value: str
    estimated_graded_value: str
    analysis_summary: str
    card_info: Optional[str] = None

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
    "estimated_raw_value": "<estimated value as raw card in USD>",
    "estimated_graded_value": "<estimated value if graded at predicted grade in USD>",
    "analysis_summary": "<2-3 sentence summary of the card's condition>",
    "card_info": "<if identifiable, provide card name/year/player/set>"
}

Remember: Grade the CARD, not the IMAGE QUALITY. A clean-looking card deserves a high grade."""

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

async def analyze_card_with_ai(front_image_base64: str, back_image_base64: str = None) -> dict:
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
        
        # Add back image if provided
        if back_image_base64:
            image_contents.append(ImageContent(image_base64=back_image_base64))
            prompt = PSA_ANALYSIS_PROMPT_DUAL
        else:
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
        
        # Analyze with AI (both sides if back is provided)
        grading_result = await analyze_card_with_ai(front_image, back_image)
        
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
