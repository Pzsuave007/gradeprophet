from fastapi import APIRouter, HTTPException, Request, UploadFile, File
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime, timezone
import uuid
import json
import base64
import logging
from database import db
from config import openai_client
from utils.auth import get_current_user
from utils.image import (
    process_card_image, create_thumbnail, crop_corners_from_image,
    auto_crop_card
)
from utils.ai import (
    analyze_card_with_ai, read_psa_label,
    CARD_IDENTIFY_PROMPT
)
from utils.ebay import (
    scrape_ebay_listing, download_and_encode_image, suggest_image_type
)

logger = logging.getLogger(__name__)
router = APIRouter(tags=["cards"])


# ---- Models ----

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

class PSA10Reference(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    year: Optional[str] = None
    image_preview: str
    image_full: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PSA10ReferenceCreate(BaseModel):
    name: Optional[str] = None
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
    front_image_preview: str
    back_image_preview: Optional[str] = None
    grading_result: GradingResult
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    card_name: Optional[str] = None
    actual_psa_grade: Optional[float] = None
    psa_cert_number: Optional[str] = None
    feedback_date: Optional[str] = None
    status: str = "pending"

class CardFeedbackUpdate(BaseModel):
    actual_psa_grade: float = Field(..., ge=1, le=10)
    psa_cert_number: Optional[str] = None
    status: str = "graded"

class CardAnalysisCreate(BaseModel):
    front_image_base64: str
    back_image_base64: Optional[str] = None
    reference_image_base64: Optional[str] = None
    reference_id: Optional[str] = None
    card_name: Optional[str] = None
    card_year: Optional[int] = None
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
    accuracy_rate: float
    average_difference: float
    predictions_high: int
    predictions_low: int
    predictions_accurate: int

class EbayImportRequest(BaseModel):
    url: str

class EbayImage(BaseModel):
    url: str
    base64: str
    thumbnail: str
    suggested_type: Optional[str] = None

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


# ---- Routes ----

@router.post("/cards/analyze", response_model=CardAnalysisResponse)
async def analyze_card(data: CardAnalysisCreate, request: Request):
    """Analyze a card image and predict PSA grade"""
    try:
        user = await get_current_user(request)
        user_id = user["user_id"]

        front_base64 = data.front_image_base64
        if ',' in front_base64:
            front_base64 = front_base64.split(',')[1]
        front_processed = process_card_image(front_base64)

        back_processed = None
        if data.back_image_base64:
            back_base64 = data.back_image_base64
            if ',' in back_base64:
                back_base64 = back_base64.split(',')[1]
            back_processed = process_card_image(back_base64)

        reference_base64 = None
        if data.reference_image_base64:
            reference_base64 = data.reference_image_base64
            if ',' in reference_base64:
                reference_base64 = reference_base64.split(',')[1]
        elif data.reference_id:
            ref = await db.psa10_references.find_one({"id": data.reference_id}, {"_id": 0})
            if ref:
                reference_base64 = ref.get("image_full")

        corner_images = []
        for corner_field in [data.corner_top_left, data.corner_top_right, data.corner_bottom_left, data.corner_bottom_right]:
            if corner_field:
                c = corner_field
                if ',' in c:
                    c = c.split(',')[1]
                corner_images.append(c)

        grading_result = await analyze_card_with_ai(
            front_image_base64=front_base64,
            back_image_base64=data.back_image_base64.split(',')[1] if data.back_image_base64 and ',' in data.back_image_base64 else data.back_image_base64,
            reference_image_base64=reference_base64,
            corner_images=corner_images if corner_images else None,
            card_year=data.card_year,
            auto_detect_year=True
        )

        card_analysis = CardAnalysis(
            front_image_preview=front_processed,
            back_image_preview=back_processed,
            grading_result=GradingResult(**grading_result),
            card_name=grading_result.get("card_info") or data.card_name,
        )

        doc = card_analysis.model_dump()
        doc['created_at'] = doc['created_at'].isoformat()
        doc['user_id'] = user_id
        await db.card_analyses.insert_one(doc)

        return CardAnalysisResponse(
            id=card_analysis.id,
            front_image_preview=card_analysis.front_image_preview,
            back_image_preview=card_analysis.back_image_preview,
            grading_result=card_analysis.grading_result,
            created_at=doc['created_at'],
            card_name=card_analysis.card_name,
            status=card_analysis.status,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Card analysis failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/cards/identify")
async def identify_card(request: Request):
    """Identify a card from photo using AI"""
    try:
        await get_current_user(request)  # Auth check
        body = await request.json()

        front_image = body.get("front_image_base64", "")
        back_image = body.get("back_image_base64", "")

        if not front_image:
            raise HTTPException(status_code=400, detail="Front image is required")

        if ',' in front_image:
            front_image = front_image.split(',')[1]
        if back_image and ',' in back_image:
            back_image = back_image.split(',')[1]

        messages_content = [
            {"type": "text", "text": CARD_IDENTIFY_PROMPT},
            {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{front_image}", "detail": "high"}}
        ]
        if back_image:
            messages_content.append({"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{back_image}", "detail": "high"}})
            messages_content[0] = {"type": "text", "text": CARD_IDENTIFY_PROMPT + "\n\nYou are also shown the BACK of the card as a second image. Use both images for identification. The back can help identify the year and set."}

        response = await openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are an expert sports card identifier. Respond only with valid JSON."},
                {"role": "user", "content": messages_content}
            ],
            max_tokens=800
        )

        response_text = response.choices[0].message.content
        cleaned = response_text.strip()
        if cleaned.startswith("```json"):
            cleaned = cleaned[7:]
        if cleaned.startswith("```"):
            cleaned = cleaned[3:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]

        result = json.loads(cleaned.strip())
        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Card identify failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/cards/history", response_model=List[CardAnalysisResponse])
async def get_card_history(request: Request):
    """Get history of analyzed cards"""
    try:
        user = await get_current_user(request)
        cards = await db.card_analyses.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
        return cards
    except Exception as e:
        logger.error(f"Failed to fetch history: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/cards/{card_id}", response_model=CardAnalysisResponse)
async def get_card_analysis(card_id: str, request: Request):
    """Get a specific card analysis by ID"""
    try:
        user = await get_current_user(request)
        card = await db.card_analyses.find_one({"id": card_id, "user_id": user["user_id"]}, {"_id": 0})
        if not card:
            raise HTTPException(status_code=404, detail="Card analysis not found")
        return card
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to fetch card: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/cards/{card_id}")
async def delete_card_analysis(card_id: str, request: Request):
    """Delete a card analysis"""
    try:
        user = await get_current_user(request)
        result = await db.card_analyses.delete_one({"id": card_id, "user_id": user["user_id"]})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Card analysis not found")
        return {"message": "Card analysis deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete card: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/cards/{card_id}/feedback", response_model=CardAnalysisResponse)
async def update_card_feedback(card_id: str, feedback: CardFeedbackUpdate, request: Request):
    """Update a card with actual PSA grade for learning"""
    try:
        user = await get_current_user(request)
        card = await db.card_analyses.find_one({"id": card_id, "user_id": user["user_id"]}, {"_id": 0})
        if not card:
            raise HTTPException(status_code=404, detail="Card analysis not found")

        update_data = {
            "actual_psa_grade": feedback.actual_psa_grade,
            "psa_cert_number": feedback.psa_cert_number,
            "feedback_date": datetime.now(timezone.utc).isoformat(),
            "status": feedback.status
        }

        await db.card_analyses.update_one({"id": card_id}, {"$set": update_data})
        updated_card = await db.card_analyses.find_one({"id": card_id}, {"_id": 0})
        return updated_card
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update feedback: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/cards/{card_id}/status")
async def update_card_status(card_id: str, status: str):
    """Update card status"""
    try:
        valid_statuses = ["pending", "sent_to_psa", "graded"]
        if status not in valid_statuses:
            raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")
        result = await db.card_analyses.update_one({"id": card_id}, {"$set": {"status": status}})
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Card analysis not found")
        return {"message": f"Status updated to {status}"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/learning/stats", response_model=LearningStats)
async def get_learning_stats():
    """Get learning statistics"""
    try:
        all_cards = await db.card_analyses.find({}, {"_id": 0}).to_list(1000)
        total_analyzed = len(all_cards)
        graded_cards = [c for c in all_cards if c.get("actual_psa_grade") is not None]
        total_graded = len(graded_cards)

        if total_graded == 0:
            return LearningStats(total_analyzed=total_analyzed, total_graded=0,
                                 accuracy_rate=0, average_difference=0,
                                 predictions_high=0, predictions_low=0, predictions_accurate=0)

        predictions_high = predictions_low = predictions_accurate = 0
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

        return LearningStats(
            total_analyzed=total_analyzed, total_graded=total_graded,
            accuracy_rate=round((predictions_accurate / total_graded) * 100, 1),
            average_difference=round(total_diff / total_graded, 2),
            predictions_high=predictions_high, predictions_low=predictions_low,
            predictions_accurate=predictions_accurate
        )
    except Exception as e:
        logger.error(f"Failed to get learning stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/learning/history")
async def get_learning_history():
    """Get cards with feedback for learning analysis"""
    try:
        graded_cards = await db.card_analyses.find(
            {"actual_psa_grade": {"$ne": None}}, {"_id": 0}
        ).sort("feedback_date", -1).to_list(100)

        for card in graded_cards:
            predicted = card.get("grading_result", {}).get("overall_grade", 0)
            actual = card.get("actual_psa_grade", 0)
            card["difference"] = round(predicted - actual, 1)
            card["accurate"] = abs(predicted - actual) <= 0.5

        return graded_cards
    except Exception as e:
        logger.error(f"Failed to get learning history: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/references", response_model=PSA10ReferenceResponse)
async def create_reference(data: PSA10ReferenceCreate, request: Request):
    """Save a PSA 10 reference image"""
    try:
        user = await get_current_user(request)
        user_id = user["user_id"]
        if not data.image_base64:
            raise HTTPException(status_code=400, detail="Image is required")

        image_base64 = data.image_base64
        if ',' in image_base64:
            image_base64 = image_base64.split(',')[1]

        label_info = await read_psa_label(image_base64)
        name = data.name if data.name and data.name.strip() else label_info.get("card_name", "PSA 10 Reference")
        year = label_info.get("year")

        thumbnail = create_thumbnail(image_base64)

        reference = PSA10Reference(name=name, year=year, image_preview=thumbnail, image_full=image_base64)

        doc = reference.model_dump()
        doc['created_at'] = doc['created_at'].isoformat()
        doc['user_id'] = user_id
        await db.psa10_references.insert_one(doc)

        return PSA10ReferenceResponse(
            id=reference.id, name=reference.name, year=reference.year,
            image_preview=reference.image_preview, created_at=doc['created_at']
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to save reference: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/references", response_model=List[PSA10ReferenceResponse])
async def get_references(request: Request):
    """Get all saved PSA 10 references"""
    try:
        user = await get_current_user(request)
        refs = await db.psa10_references.find({"user_id": user["user_id"]}, {"_id": 0, "image_full": 0}).sort("created_at", -1).to_list(100)
        return refs
    except Exception as e:
        logger.error(f"Failed to fetch references: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/references/{ref_id}")
async def delete_reference(ref_id: str, request: Request):
    """Delete a PSA 10 reference"""
    try:
        user = await get_current_user(request)
        result = await db.psa10_references.delete_one({"id": ref_id, "user_id": user["user_id"]})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Reference not found")
        return {"message": "Reference deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete reference: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/ebay/import", response_model=EbayImportResponse)
async def import_ebay_listing(data: EbayImportRequest):
    """Import images from an eBay listing URL"""
    try:
        valid_domains = ['ebay.com', 'ebay.us', 'ebay.co.uk', 'ebay.de', 'ebay.fr', 'ebay.es', 'ebay.it', 'ebay.ca', 'ebay.com.au']
        is_valid = any(domain in data.url for domain in valid_domains)

        if not is_valid:
            raise HTTPException(status_code=400, detail="Please provide a valid eBay link")

        result = await scrape_ebay_listing(data.url)

        if not result["success"]:
            return EbayImportResponse(success=False, error=result.get("error", "Failed to fetch eBay listing"))

        images = []
        total_images = len(result["image_urls"])

        for idx, img_url in enumerate(result["image_urls"]):
            base64_data, thumbnail = await download_and_encode_image(img_url)
            if base64_data:
                cropped_data = auto_crop_card(base64_data)
                cropped_thumbnail = create_thumbnail(cropped_data)
                images.append(EbayImage(
                    url=img_url, base64=cropped_data, thumbnail=cropped_thumbnail,
                    suggested_type=suggest_image_type(idx, total_images)
                ))

        if not images:
            return EbayImportResponse(success=False, error="No images found in the listing")

        return EbayImportResponse(success=True, title=result["title"], images=images)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"eBay import failed: {e}")
        return EbayImportResponse(success=False, error=str(e))


@router.post("/corners/crop", response_model=CornerCropResponse)
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


@router.post("/cards/scan-upload")
async def scan_upload(request: Request, file: UploadFile = File(...)):
    """Upload a scanned card image, analyze with AI, and add to inventory.
    For duplex scanning: front images create new items, back images update matching front by batch key."""
    user = await get_current_user(request)
    user_id = user["user_id"]

    contents = await file.read()
    img_base64 = base64.b64encode(contents).decode("utf-8")

    # Scanner images are already cropped and enhanced - just convert to JPEG and keep full quality
    # Skip auto_crop and enhance (only for scanner uploads)
    processed = create_thumbnail(img_base64, max_size=1600)

    # Parse filename: card_{timestamp}_{number}_{side}.png
    filename = (file.filename or "").lower()
    is_back = "_back" in filename

    # Extract batch key from filename for front/back matching
    # e.g. "card_1773685587533_2_front.png" -> batch_key = "1773685587533_2"
    import re
    batch_match = re.match(r"card_(\d+_\d+)_(front|back)", filename)
    batch_key = batch_match.group(1) if batch_match else ""

    if is_back:
        matched_item = None

        # Method 1: match by explicit item_id from scanner (most reliable)
        explicit_id = request.headers.get("X-FlipSlab-Item-Id", "").strip()
        if explicit_id:
            matched_item = await db.inventory.find_one(
                {"id": explicit_id, "user_id": user_id},
                {"_id": 0}
            )

        # Method 2: match by batch key from filename
        if not matched_item and batch_key:
            matched_item = await db.inventory.find_one(
                {"user_id": user_id, "source": "scanner", "scan_batch_key": batch_key},
                {"_id": 0}
            )

        # Method 3: fallback - most recent scanner item without back_image
        if not matched_item:
            matched_item = await db.inventory.find_one(
                {"user_id": user_id, "source": "scanner", "back_image": None},
                {"_id": 0},
                sort=[("created_at", -1)]
            )

        if matched_item:
            await db.inventory.update_one(
                {"id": matched_item["id"]},
                {"$set": {
                    "back_image": processed,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }}
            )
            return {
                "id": matched_item["id"],
                "player_name": matched_item.get("player", "Unknown"),
                "year": matched_item.get("year", ""),
                "set_name": matched_item.get("set_name", ""),
                "message": f"Back image added to: {matched_item.get('card_name', 'Unknown')}",
                "side": "back",
            }
        logger.warning("No matching front image found for back scan, creating new item")

    # AI identify card (only for front images or unmatched backs)
    card_info = {}
    try:
        if openai_client:
            response = await openai_client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": CARD_IDENTIFY_PROMPT},
                    {"role": "user", "content": [
                        {"type": "text", "text": "Identify this sports card."},
                        {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{processed}"}}
                    ]}
                ],
                response_format={"type": "json_object"},
                max_tokens=500,
            )
            card_info = json.loads(response.choices[0].message.content)
    except Exception as e:
        logger.warning(f"AI identification failed: {e}")

    # Build card_name from AI response
    player = card_info.get("player_name", card_info.get("player", "Unknown"))
    year = card_info.get("year", "")
    set_name = card_info.get("set_name", "")
    card_number = card_info.get("card_number", "")
    variation = card_info.get("variation", "")

    # Compose a card_name
    name_parts = []
    if year: name_parts.append(str(year))
    if set_name: name_parts.append(set_name)
    if player and player != "Unknown": name_parts.append(player)
    if card_number: name_parts.append(f"#{card_number}")
    if variation: name_parts.append(variation)
    card_name = " ".join(name_parts) if name_parts else player

    # Save to inventory with correct field names
    item_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    thumbnail = create_thumbnail(processed)

    doc = {
        "id": item_id,
        "user_id": user_id,
        "card_name": card_name,
        "player": player,
        "year": int(year) if str(year).isdigit() else None,
        "set_name": set_name,
        "card_number": card_number,
        "variation": variation,
        "condition": card_info.get("condition", "Raw"),
        "grade": card_info.get("grade"),
        "grading_company": card_info.get("grading_company", ""),
        "purchase_price": 0,
        "estimated_value": card_info.get("estimated_value", 0),
        "quantity": 1,
        "notes": "Scanned via FlipSlab Scanner",
        "image": processed,
        "back_image": None,
        "thumbnail": thumbnail,
        "listed": False,
        "category": "for_sale",
        "sport": card_info.get("sport", ""),
        "source": "scanner",
        "scan_batch_key": batch_key,
        "created_at": now,
        "updated_at": now,
    }
    await db.inventory.insert_one(doc)

    return {
        "id": item_id,
        "player_name": player,
        "year": doc["year"],
        "set_name": set_name,
        "card_name": card_name,
        "message": f"Card added: {card_name}",
        "side": "front",
    }
