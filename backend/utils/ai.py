# Auto-extracted AI module
import json
import logging
import base64
from typing import Optional, List
from fastapi import HTTPException
from config import openai_client
from database import db
from utils.image import create_thumbnail

logger = logging.getLogger(__name__)

# PSA Grading Analysis Prompt
PSA_ANALYSIS_PROMPT_SINGLE = """You are an expert sports card grader with 20+ years of hands-on experience at PSA. You are STRICT and REALISTIC - you grade exactly how PSA would grade.

IMAGE vs CARD DEFECTS:
- Do NOT penalize for: image compression, lighting glare, scanner noise, camera blur, WATERMARKS (like COMC, PSA, eBay logos overlaid on the image), website overlays
- DO penalize for: edge wear/whitening, corner softness/rounding, surface scratches/creases, centering issues, discoloration
- IMPORTANT: Images often come from eBay listings and may have seller watermarks. IGNORE these watermarks completely - they are NOT on the physical card. Focus ONLY on the actual card condition visible around/through the watermarks.

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

Grade honestly. Do NOT inflate.

CALIBRATION CHECK: If you see ANY visible edge whitening on dark borders, the card CANNOT be higher than PSA 8. If you see corner rounding visible to the naked eye, the card CANNOT be higher than PSA 8. If BOTH are present, the card is likely PSA 6-7. Most raw cards from eBay are PSA 5-8 range. PSA 9-10 is RARE."""

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
- Do NOT penalize for: image compression, lighting glare, scanner noise, camera blur, WATERMARKS (like COMC, PSA, eBay logos overlaid on the image), website overlays
- DO penalize for: edge wear/whitening, corner softness/rounding, surface scratches/creases, centering issues, discoloration
- IMPORTANT: Images often come from eBay listings and may have seller watermarks. IGNORE these watermarks completely - they are NOT on the physical card. Focus ONLY on the actual card condition visible around/through the watermarks.

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

Grade honestly. The back is equally important. Do NOT inflate.

CALIBRATION CHECK: If you see ANY visible edge whitening on dark borders, the card CANNOT be higher than PSA 8. If you see corner rounding visible to the naked eye, the card CANNOT be higher than PSA 8. If BOTH are present, the card is likely PSA 6-7. Most raw cards from eBay are PSA 5-8 range. PSA 9-10 is RARE."""

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

CARD_IDENTIFY_PROMPT = """You are a sports card identification expert. Look at the card image(s) and identify ALL details you can see.

If TWO images are provided: the first is the FRONT of the card, the second is the BACK. The back of the card often contains critical information like the year, card number, set name, manufacturer, and player stats. Use BOTH images together to identify the card accurately.

For RAW (ungraded) cards, the back is especially important — it often has the card number, copyright year, and set/manufacturer info that isn't visible on the front.

Return ONLY valid JSON with these fields (use null for anything you can't determine):
{
  "card_name": "<Full card name with PLAYER FIRST, e.g. 'Kobe Bryant 1996 Topps Chrome #138 Refractor'>",
  "player": "<Player name>",
  "year": <year as integer or null>,
  "set_name": "<Set/brand name, e.g. 'Topps Chrome', 'Fleer', 'Upper Deck SP'>",
  "card_number": "<Card number if visible, e.g. '138'>",
  "variation": "<Variation/parallel if any, e.g. 'Refractor', 'Prizm Silver', null>",
  "is_graded": <true if card is in a grading slab/case, false if raw>,
  "grading_company": "<PSA, BGS, SGC, CGC, HGA, or null if raw>",
  "grade": <numeric grade if graded, e.g. 9, 9.5, 10, or null if raw>,
  "cert_number": "<certification number printed on the grading slab label, usually 8-10 digits, or null if raw/not visible>",
  "sport": "<Basketball, Baseball, Football, Soccer, Hockey, or Other>",
  "team": "<Team name if identifiable, e.g. 'Los Angeles Lakers', 'New York Yankees', null if unknown>",
  "estimated_condition": "<Mint, Near Mint, Excellent, Good, Fair - your visual assessment>"
}

Be precise. If you can read text on the card or slab, use that exact text. If the card is in a PSA/BGS/SGC slab, read the grade from the label. For the back of the card, look for copyright year, card number, manufacturer/brand name."""

PSA_LABEL_READER_PROMPT = """Look at this PSA graded card image. Read the PSA label/slab information and extract the card details.

The PSA label typically contains:
- Card year (e.g., 1996, 2020)
- Card set/brand (e.g., Upper Deck, Topps Chrome, Prizm)
- Card name/number (e.g., #138, Kobe Bryant RC)
- Player name
- Grade (should be 10 or Gem Mint)
- Certification number (a long number, usually 8-10 digits, printed on the label)

Return ONLY a JSON object with this format (no other text):
{
    "card_name": "<Player Name> <Year> <Set> <Card Number if visible>",
    "year": "<year>",
    "set": "<card set/brand>",
    "player": "<player name>",
    "grade": "<grade number>",
    "cert_number": "<certification number>"
}

Example response:
{
    "card_name": "Kobe Bryant 1996-97 Upper Deck SP #134 RC",
    "year": "1996-97",
    "set": "Upper Deck SP",
    "player": "Kobe Bryant",
    "grade": "10",
    "cert_number": "12345678"
}

If you cannot read certain information, use "Unknown" for that field but try your best to read the label."""

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
    
    try:
        # Build image contents for OpenAI Vision
        image_content = []
        
        # Add front image
        image_content.append({"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{front_image_base64}", "detail": "high"}})
        
        # Get learning context from past predictions
        learning_context = await get_learning_context()
        
        # Determine which prompt to use based on images provided
        if back_image_base64 and reference_image_base64:
            image_content.append({"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{back_image_base64}", "detail": "high"}})
            image_content.append({"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{reference_image_base64}", "detail": "high"}})
            prompt = PSA_ANALYSIS_PROMPT_DUAL_WITH_REFERENCE
        elif reference_image_base64:
            image_content.append({"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{reference_image_base64}", "detail": "high"}})
            prompt = PSA_ANALYSIS_PROMPT_WITH_REFERENCE
        elif back_image_base64:
            image_content.append({"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{back_image_base64}", "detail": "high"}})
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
                    image_content.append({"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{corner_img}", "detail": "high"}})
            prompt = prompt + CORNER_ANALYSIS_ADDITION
        
        # Add learning context to prompt if available
        if learning_context:
            prompt = learning_context + prompt
        
        # Call OpenAI directly
        image_content.insert(0, {"type": "text", "text": prompt})
        response = await openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are an expert sports card grader. Respond only with valid JSON."},
                {"role": "user", "content": image_content}
            ],
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
        
        # === PSA CALIBRATION: Enforce real PSA grading rules ===
        try:
            centering = result.get("centering", {}).get("score", 10)
            corners = result.get("corners", {}).get("score", 10)
            surface = result.get("surface", {}).get("score", 10)
            edges = result.get("edges", {}).get("score", 10)
            ai_grade = result.get("overall_grade", 10)
            
            subcategories = [centering, corners, surface, edges]
            lowest_sub = min(subcategories)
            
            # Rule 1: Overall cannot be more than 1 point above the LOWEST subcategory
            max_allowed = lowest_sub + 1.0
            
            # Rule 2: If any subcategory is below 8, overall cannot exceed 8
            if lowest_sub < 8:
                max_allowed = min(max_allowed, 8.0)
            
            # Rule 3: If any subcategory is below 7, maximum 7.5
            if lowest_sub < 7:
                max_allowed = min(max_allowed, 7.5)
            
            # Rule 4: If 2+ subcategories are below 8, grade = lowest + 0.5
            below_8_count = sum(1 for s in subcategories if s < 8)
            if below_8_count >= 2:
                max_allowed = min(max_allowed, lowest_sub + 0.5)
            
            # Apply calibration
            calibrated_grade = min(ai_grade, max_allowed)
            
            # Round to nearest 0.5
            calibrated_grade = round(calibrated_grade * 2) / 2
            calibrated_grade = max(1.0, calibrated_grade)
            
            if calibrated_grade != ai_grade:
                logger.info(f"PSA Calibration: AI={ai_grade}, Calibrated={calibrated_grade} (C={centering} Co={corners} S={surface} E={edges})")
            
            result["overall_grade"] = calibrated_grade
            result["send_to_psa"] = calibrated_grade >= 8.0
            
        except Exception as e:
            logger.warning(f"Calibration failed: {e}")
        
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



async def read_psa_label(image_base64: str) -> dict:
    """Read PSA label information from a graded card image"""
    
    try:
        response = await openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are an expert at reading PSA graded card labels. Respond only with valid JSON."},
                {"role": "user", "content": [
                    {"type": "text", "text": PSA_LABEL_READER_PROMPT},
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_base64}", "detail": "high"}}
                ]}
            ],
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
