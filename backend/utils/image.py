import base64
import logging
from io import BytesIO
from PIL import Image, ImageOps, ImageEnhance

logger = logging.getLogger(__name__)


def _find_largest_block(std_arr, threshold, gap_tolerance=5):
    """Find the largest contiguous block of indices where std > threshold.
    Allows small gaps (gap_tolerance) to handle card rows that briefly dip below threshold."""
    mask = std_arr > threshold
    blocks = []
    start = None
    gap_count = 0
    for i in range(len(mask)):
        if mask[i]:
            if start is None:
                start = i
            gap_count = 0
        else:
            if start is not None:
                gap_count += 1
                if gap_count > gap_tolerance:
                    blocks.append((start, i - gap_count))
                    start = None
                    gap_count = 0
    if start is not None:
        blocks.append((start, len(mask) - 1 - gap_count))
    if not blocks:
        return None
    return max(blocks, key=lambda b: b[1] - b[0])


def scanner_auto_process(image_base64: str, is_back: bool = False) -> str:
    """Auto-crop scanner image: detect card top dynamically and keep a small margin.
    Side/bottom use fixed pixel cut.
    """
    try:
        import cv2
        import numpy as np

        image_data = base64.b64decode(image_base64)
        nparr = np.frombuffer(image_data, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            return image_base64

        h, w = img.shape[:2]
        SIDE_CUT = 40
        BOT_CUT = 40
        MARGIN_TOP = 20   # keep at least this many px above the card
        MAX_TOP_CUT = 320 # safety ceiling — never cut more than this from top

        # Find first row that is predominantly BRIGHT (card's white border) OR
        # has a large horizontal white streak — that's the top of the card.
        # Sample the middle 60% of image width to avoid holder side edges.
        x1 = int(w * 0.2)
        x2 = int(w * 0.8)
        region = img[:, x1:x2]  # full-height strip of middle columns
        gray = cv2.cvtColor(region, cv2.COLOR_BGR2GRAY)
        # A row is "card-like" if >70% of pixels are near-white (>=225)
        row_white_ratio = (gray >= 225).mean(axis=1)
        card_rows = np.where(row_white_ratio >= 0.7)[0]

        if len(card_rows) > 0:
            card_top = int(card_rows[0])
            top_cut = max(0, card_top - MARGIN_TOP)
            # Cap the cut so we never shave more than MAX_TOP_CUT
            top_cut = min(top_cut, MAX_TOP_CUT)
        else:
            # Fallback: conservative small cut
            top_cut = 40

        y1 = min(top_cut, h - 1)
        y2 = max(y1 + 1, h - BOT_CUT)
        xa = min(SIDE_CUT, w - 1)
        xb = max(xa + 1, w - SIDE_CUT)

        img = img[y1:y2, xa:xb]
        logger.info(f"Scanner crop: {w}x{h} -> {img.shape[1]}x{img.shape[0]} (top_cut={top_cut})")

        _, buffer = cv2.imencode('.jpg', img, [cv2.IMWRITE_JPEG_QUALITY, 95])
        return base64.b64encode(buffer).decode('utf-8')

    except Exception as e:
        logger.error(f"Scanner auto-process FAILED: {e}", exc_info=True)
        return image_base64


def _order_points(pts):
    """Order 4 points as: top-left, top-right, bottom-right, bottom-left."""
    import numpy as np
    rect = np.zeros((4, 2), dtype=np.float32)
    s = pts.sum(axis=1)
    d = np.diff(pts, axis=1)
    rect[0] = pts[np.argmin(s)]
    rect[2] = pts[np.argmax(s)]
    rect[1] = pts[np.argmin(d)]
    rect[3] = pts[np.argmax(d)]
    return rect


def fix_exif_rotation(image_base64: str) -> str:
    """Apply EXIF orientation to physically rotate the image. Mobile cameras store
    images in landscape and use EXIF tags to indicate rotation. Without this,
    phone photos appear sideways."""
    try:
        image_data = base64.b64decode(image_base64)
        img = Image.open(BytesIO(image_data))
        rotated = ImageOps.exif_transpose(img)
        if rotated is img:
            return image_base64
        if rotated.mode in ('RGBA', 'LA', 'P'):
            rotated = rotated.convert('RGB')
        buf = BytesIO()
        rotated.save(buf, format='JPEG', quality=95)
        return base64.b64encode(buf.getvalue()).decode('utf-8')
    except Exception as e:
        logger.warning(f"EXIF rotation failed: {e}")
        return image_base64


def auto_crop_card(image_base64: str) -> str:
    """Auto-detect and crop a sports card from phone photo."""
    try:
        import cv2
        import numpy as np

        image_data = base64.b64decode(image_base64)
        nparr = np.frombuffer(image_data, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img is None:
            return image_base64

        h, w = img.shape[:2]
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        blurred = cv2.GaussianBlur(gray, (7, 7), 0)

        all_boxes = []

        for low, high in [(30, 100), (50, 150), (75, 200)]:
            edges = cv2.Canny(blurred, low, high)
            kernel = np.ones((7, 7), np.uint8)
            dilated = cv2.dilate(edges, kernel, iterations=2)
            contours, _ = cv2.findContours(dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

            for cnt in contours:
                x, y, rw, rh = cv2.boundingRect(cnt)
                bbox_pct = (rw * rh) / (w * h)
                if bbox_pct < 0.02 or bbox_pct > 0.85:
                    continue
                if rw > w * 0.95 or rh > h * 0.95:
                    continue
                all_boxes.append((x, y, x + rw, y + rh))

        if not all_boxes:
            return image_base64

        cx_min, cx_max = w * 0.15, w * 0.85
        cy_min, cy_max = h * 0.15, h * 0.85
        central = []
        for (x1, y1, x2, y2) in all_boxes:
            cx = (x1 + x2) / 2
            cy = (y1 + y2) / 2
            if cx_min <= cx <= cx_max and cy_min <= cy <= cy_max:
                central.append((x1, y1, x2, y2))

        if not central:
            central = all_boxes

        min_x = min(b[0] for b in central)
        min_y = min(b[1] for b in central)
        max_x = max(b[2] for b in central)
        max_y = max(b[3] for b in central)

        rw = max_x - min_x
        rh = max_y - min_y
        coverage = (rw * rh) / (w * h)

        if coverage < 0.12:
            return image_base64

        if coverage < 0.55:
            target = 0.65
            scale = (target / coverage) ** 0.5
            cx = (min_x + max_x) / 2
            cy = (min_y + max_y) / 2
            new_rw = rw * scale
            new_rh = rh * scale
            min_x = max(0, int(cx - new_rw / 2))
            min_y = max(0, int(cy - new_rh / 2))
            max_x = min(w, int(cx + new_rw / 2))
            max_y = min(h, int(cy + new_rh / 2))
            rw = max_x - min_x
            rh = max_y - min_y
            logger.info(f"Auto-crop: extended incomplete detection ({coverage:.0%} -> {(rw*rh)/(w*h):.0%})")

        CARD_RATIO = 1.4
        detected_ratio = rh / rw if rw > 0 else 1.4

        if detected_ratio < CARD_RATIO * 0.85:
            expected_h = int(rw * CARD_RATIO)
            missing = expected_h - rh
            extend_top = int(missing * 0.6)
            extend_bottom = missing - extend_top
            min_y = max(0, min_y - extend_top)
            max_y = min(h, max_y + extend_bottom)
            rh = max_y - min_y
            logger.info(f"Auto-crop: extended height for card ratio (detected {detected_ratio:.2f}, target {CARD_RATIO})")
        elif detected_ratio > CARD_RATIO * 1.25:
            expected_w = int(rh / CARD_RATIO)
            missing = expected_w - rw
            extend_each = missing // 2
            min_x = max(0, min_x - extend_each)
            max_x = min(w, max_x + extend_each)
            rw = max_x - min_x
            logger.info(f"Auto-crop: extended width for card ratio (detected {detected_ratio:.2f}, target {CARD_RATIO})")

        pad_x = int(rw * 0.15)
        pad_y = int(rh * 0.15)
        x = max(0, int(min_x) - pad_x)
        y = max(0, int(min_y) - pad_y)
        crop_w = min(w - x, int(rw) + 2 * pad_x)
        crop_h = min(h - y, int(rh) + 2 * pad_y)

        cropped = img[y:y+crop_h, x:x+crop_w]

        _, buffer = cv2.imencode('.jpg', cropped, [cv2.IMWRITE_JPEG_QUALITY, 95])
        result_base64 = base64.b64encode(buffer).decode('utf-8')

        logger.info(f"Auto-crop: {w}x{h} -> {crop_w}x{crop_h} (ratio: {crop_h/crop_w:.2f})")
        return result_base64

    except Exception as e:
        logger.warning(f"Auto-crop failed: {e}")
        return image_base64


def enhance_card_image(image_base64: str) -> str:
    """Enhance card image colors: boost saturation, contrast, and sharpness"""
    try:
        from PIL import ImageEnhance
        import io

        image_data = base64.b64decode(image_base64)
        image = Image.open(io.BytesIO(image_data))

        if image.mode != 'RGB':
            image = image.convert('RGB')

        image = ImageEnhance.Color(image).enhance(1.25)
        image = ImageEnhance.Contrast(image).enhance(1.15)
        image = ImageEnhance.Sharpness(image).enhance(1.3)
        image = ImageEnhance.Brightness(image).enhance(1.05)

        buffer = io.BytesIO()
        image.save(buffer, format='JPEG', quality=95)
        result = base64.b64encode(buffer.getvalue()).decode('utf-8')

        logger.info("Image enhanced: saturation+25%, contrast+15%, sharpness+30%")
        return result

    except Exception as e:
        logger.warning(f"Image enhance failed: {e}")
        return image_base64


def create_thumbnail(image_base64: str, max_size: int = 800) -> str:
    """Create a high-quality preview from base64 image"""
    try:
        import io

        image_data = base64.b64decode(image_base64)
        image = Image.open(io.BytesIO(image_data))

        image.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)

        if image.mode in ('RGBA', 'LA', 'P'):
            image = image.convert('RGB')

        buffer = io.BytesIO()
        image.save(buffer, format='JPEG', quality=90)
        thumbnail_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')

        return thumbnail_base64
    except Exception as e:
        logger.warning(f"Failed to create thumbnail: {e}")
        return image_base64


def create_store_thumbnail(image_base64: str, max_size: int = 600) -> str:
    """Create a high-quality WebP store thumbnail for the shop page."""
    try:
        import io

        image_data = base64.b64decode(image_base64)
        image = Image.open(io.BytesIO(image_data))
        image = ImageOps.exif_transpose(image)

        image.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)

        if image.mode in ('RGBA', 'LA', 'P'):
            image = image.convert('RGB')

        buffer = io.BytesIO()
        image.save(buffer, format='WEBP', quality=92)
        return base64.b64encode(buffer.getvalue()).decode('utf-8')
    except Exception as e:
        logger.warning(f"Failed to create store thumbnail: {e}")
        return create_thumbnail(image_base64, max_size=max_size)


def process_card_image(image_base64: str, max_size: int = 800, skip_crop: bool = False) -> str:
    """Full image processing pipeline: EXIF rotate -> crop -> resize"""
    processed = fix_exif_rotation(image_base64)
    if not skip_crop:
        try:
            processed = auto_crop_card(processed)
        except Exception as e:
            logger.warning(f"Auto-crop step failed, using original: {e}")
    processed = create_thumbnail(processed, max_size=max_size)
    return processed


def crop_corners_from_image(image_base64: str, corner_size_percent: float = 0.35) -> dict:
    """Crop the four corners from a card image for detailed analysis"""
    try:
        from fastapi import HTTPException

        image_data = base64.b64decode(image_base64)
        img = Image.open(BytesIO(image_data))

        width, height = img.size
        corner_size = int(min(width, height) * corner_size_percent)
        MIN_CORNER_PX = 400

        def save_corner(corner_img):
            # Upscale small corners so AI can see detail
            cw, ch = corner_img.size
            if cw < MIN_CORNER_PX or ch < MIN_CORNER_PX:
                scale = max(MIN_CORNER_PX / cw, MIN_CORNER_PX / ch)
                corner_img = corner_img.resize((int(cw * scale), int(ch * scale)), Image.LANCZOS)
            buf = BytesIO()
            corner_img.save(buf, format='JPEG', quality=95)
            return base64.b64encode(buf.getvalue()).decode('utf-8')

        corners = {}
        corners['top_left'] = save_corner(img.crop((0, 0, corner_size, corner_size)))
        corners['top_right'] = save_corner(img.crop((width - corner_size, 0, width, corner_size)))
        corners['bottom_left'] = save_corner(img.crop((0, height - corner_size, corner_size, height)))
        corners['bottom_right'] = save_corner(img.crop((width - corner_size, height - corner_size, width, height)))

        return corners

    except Exception as e:
        logger.error(f"Failed to crop corners: {e}")
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail=f"Failed to crop corners: {str(e)}")


def download_and_create_thumbnail(image_data: bytes) -> tuple:
    """Create base64 and thumbnail from image bytes"""
    base64_data = base64.b64encode(image_data).decode('utf-8')

    img = Image.open(BytesIO(image_data))
    if img.mode in ('RGBA', 'LA', 'P'):
        img = img.convert('RGB')
    img.thumbnail((200, 200))
    thumb_buffer = BytesIO()
    img.save(thumb_buffer, format='JPEG', quality=70)
    thumbnail = base64.b64encode(thumb_buffer.getvalue()).decode('utf-8')

    full_img = Image.open(BytesIO(image_data))
    if full_img.mode in ('RGBA', 'LA', 'P'):
        full_buffer = BytesIO()
        full_img.convert('RGB').save(full_buffer, format='JPEG', quality=90)
        base64_data = base64.b64encode(full_buffer.getvalue()).decode('utf-8')

    return base64_data, thumbnail


def create_lot_collage(card_images_b64: list, cards_per_row: int = 5, card_height: int = 600, bg_color=(20, 20, 20), padding: int = 15) -> str:
    """Create a collage image from multiple card images (base64).
    Returns base64 JPEG string."""
    images = []
    for b64 in card_images_b64:
        try:
            img = Image.open(BytesIO(base64.b64decode(b64)))
            img = img.convert('RGB')
            # Resize to uniform height while maintaining aspect ratio
            ratio = card_height / img.height
            new_w = int(img.width * ratio)
            img = img.resize((new_w, card_height), Image.LANCZOS)
            images.append(img)
        except Exception as e:
            logger.warning(f"Collage: skip bad image: {e}")

    if not images:
        return ""

    # Calculate grid dimensions
    rows = []
    for i in range(0, len(images), cards_per_row):
        rows.append(images[i:i + cards_per_row])

    # Calculate canvas size
    row_widths = []
    for row in rows:
        w = sum(img.width for img in row) + padding * (len(row) + 1)
        row_widths.append(w)

    canvas_w = max(row_widths)
    canvas_h = len(rows) * (card_height + padding) + padding

    # Create canvas and paste images
    canvas = Image.new('RGB', (canvas_w, canvas_h), bg_color)
    y = padding
    for row in rows:
        total_w = sum(img.width for img in row)
        spacing = padding
        x = (canvas_w - total_w - spacing * (len(row) - 1)) // 2  # Center row
        for img in row:
            canvas.paste(img, (x, y))
            x += img.width + spacing
        y += card_height + padding

    # Save as JPEG base64
    buf = BytesIO()
    canvas.save(buf, format='JPEG', quality=88)
    return base64.b64encode(buf.getvalue()).decode('utf-8')


def create_front_back_combined(front_b64: str, back_b64: str, target_height: int = 800) -> str:
    """Combine front and back card images side by side (front left, back right).
    Returns base64 JPEG string."""
    try:
        front = Image.open(BytesIO(base64.b64decode(front_b64))).convert('RGB')
        back = Image.open(BytesIO(base64.b64decode(back_b64))).convert('RGB')

        # Resize both to same height
        f_ratio = target_height / front.height
        front = front.resize((int(front.width * f_ratio), target_height), Image.LANCZOS)

        b_ratio = target_height / back.height
        back = back.resize((int(back.width * b_ratio), target_height), Image.LANCZOS)

        # Place side by side with small gap
        gap = 10
        canvas_w = front.width + gap + back.width
        canvas = Image.new('RGB', (canvas_w, target_height), (20, 20, 20))
        canvas.paste(front, (0, 0))
        canvas.paste(back, (front.width + gap, 0))

        buf = BytesIO()
        canvas.save(buf, format='JPEG', quality=88)
        return base64.b64encode(buf.getvalue()).decode('utf-8')
    except Exception as e:
        logger.warning(f"Front+back combine failed: {e}")
        return ""



def create_chase_collage(chase_image_b64: str, other_images_b64: list, card_height: int = 500, bg_color=(15, 15, 15), padding: int = 12) -> str:
    """Create a chase pack collage: chase card large on top, other cards smaller in grid below.
    Returns base64 JPEG string."""
    from PIL import ImageDraw, ImageFont

    def load_img(b64, target_h):
        try:
            img = Image.open(BytesIO(base64.b64decode(b64))).convert('RGB')
            ratio = target_h / img.height
            return img.resize((int(img.width * ratio), target_h), Image.LANCZOS)
        except:
            return None

    # Load chase card (larger)
    chase_h = int(card_height * 1.6)
    chase_img = load_img(chase_image_b64, chase_h)
    if not chase_img:
        return ""

    # Load other cards (smaller)
    small_h = card_height
    small_imgs = [img for b64 in other_images_b64 if (img := load_img(b64, small_h))]

    if not small_imgs:
        return ""

    # Layout: chase card centered on top, grid of others below (2 per row)
    cards_per_row = min(2, len(small_imgs))
    rows = []
    for i in range(0, len(small_imgs), cards_per_row):
        rows.append(small_imgs[i:i + cards_per_row])

    # Calculate widths
    grid_row_widths = []
    for row in rows:
        w = sum(img.width for img in row) + padding * (len(row) - 1)
        grid_row_widths.append(w)

    max_grid_w = max(grid_row_widths) if grid_row_widths else 0
    canvas_w = max(chase_img.width + padding * 2, max_grid_w + padding * 2)

    # Height: padding + chase + padding + grid rows + padding
    grid_h = len(rows) * (small_h + padding)
    canvas_h = padding + chase_h + padding + grid_h + padding

    canvas = Image.new('RGB', (canvas_w, canvas_h), bg_color)

    # Draw "CHASE CARD" label area at very top
    try:
        draw = ImageDraw.Draw(canvas)
        # Add subtle fire-colored accent line
        accent_y = padding // 2
        draw.rectangle([(padding, accent_y), (canvas_w - padding, accent_y + 3)], fill=(255, 100, 0))
    except:
        pass

    # Paste chase card centered
    chase_x = (canvas_w - chase_img.width) // 2
    canvas.paste(chase_img, (chase_x, padding))

    # Paste grid below
    y = padding + chase_h + padding
    for row in rows:
        total_w = sum(img.width for img in row) + padding * (len(row) - 1)
        x = (canvas_w - total_w) // 2
        for img in row:
            canvas.paste(img, (x, y))
            x += img.width + padding
        y += small_h + padding

    buf = BytesIO()
    canvas.save(buf, format='JPEG', quality=90)
    return base64.b64encode(buf.getvalue()).decode('utf-8')



def _load_card_img(b64, target_h):
    """Load a base64 card image and resize to target height."""
    try:
        img = Image.open(BytesIO(base64.b64decode(b64))).convert('RGB')
        ratio = target_h / img.height
        return img.resize((int(img.width * ratio), target_h), Image.LANCZOS)
    except Exception:
        return None


def _draw_gradient_bar(draw, x1, y1, x2, y2, color_start, color_end):
    """Draw a horizontal gradient rectangle."""
    w = x2 - x1
    for i in range(w):
        r = int(color_start[0] + (color_end[0] - color_start[0]) * i / w)
        g = int(color_start[1] + (color_end[1] - color_start[1]) * i / w)
        b = int(color_start[2] + (color_end[2] - color_start[2]) * i / w)
        draw.line([(x1 + i, y1), (x1 + i, y2)], fill=(r, g, b))


def create_chase_tier_image(card_images_b64: list, tier: str = "chase", card_height: int = 550) -> str:
    """Create a visually attractive tier image for Chase Pack eBay listing.
    tier: 'chase', 'mid', or 'base'
    Returns base64 JPEG string."""
    from PIL import ImageDraw, ImageFont

    if not card_images_b64:
        return ""

    TIER_STYLES = {
        "chase": {
            "bg": (10, 8, 5),
            "accent1": (245, 158, 11),  # amber
            "accent2": (234, 88, 12),   # orange
            "label": "CHASE CARD",
            "subtitle": "Can you pull the chase?",
            "border_color": (245, 158, 11),
            "glow": (80, 50, 0),
        },
        "mid": {
            "bg": (5, 8, 18),
            "accent1": (59, 130, 246),   # blue
            "accent2": (99, 102, 241),   # indigo
            "label": "MID TIER",
            "subtitle": "Great pulls in this tier!",
            "border_color": (59, 130, 246),
            "glow": (15, 30, 70),
        },
        "base": {
            "bg": (12, 12, 12),
            "accent1": (120, 120, 120),  # gray
            "accent2": (80, 80, 80),
            "label": "BASE CARDS",
            "subtitle": "Every spot is a winner!",
            "border_color": (60, 60, 60),
            "glow": (25, 25, 25),
        },
    }
    style = TIER_STYLES.get(tier, TIER_STYLES["base"])
    padding = 20

    # Load card images
    if tier == "chase":
        # Single large chaser card
        ch = int(card_height * 1.8)
        imgs = [img for b64 in card_images_b64[:2] if (img := _load_card_img(b64, ch))]
    else:
        imgs = [img for b64 in card_images_b64 if (img := _load_card_img(b64, card_height))]

    if not imgs:
        return ""

    # Calculate canvas size
    banner_h = 80
    if tier == "chase":
        # Chase: big card(s) centered
        total_w = sum(im.width for im in imgs) + padding * (len(imgs) - 1)
        canvas_w = max(total_w + padding * 4, 800)
        canvas_h = banner_h + padding + imgs[0].height + padding * 3
    else:
        # Grid layout for mid/base — 2 cards per row for clean eBay images
        cards_per_row = min(2, len(imgs))
        rows = [imgs[i:i + cards_per_row] for i in range(0, len(imgs), cards_per_row)]
        max_row_w = max(sum(im.width for im in row) + padding * (len(row) - 1) for row in rows)
        canvas_w = max(max_row_w + padding * 4, 600)
        grid_h = len(rows) * (card_height + padding) - padding
        canvas_h = banner_h + padding + grid_h + padding * 3

    canvas = Image.new('RGB', (canvas_w, canvas_h), style["bg"])
    draw = ImageDraw.Draw(canvas)

    # Draw top banner with gradient
    _draw_gradient_bar(draw, 0, 0, canvas_w, banner_h, style["accent1"], style["accent2"])

    # Draw banner text
    try:
        font_large = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 36)
        font_small = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 16)
    except Exception:
        font_large = ImageFont.load_default()
        font_small = ImageFont.load_default()

    label_bbox = draw.textbbox((0, 0), style["label"], font=font_large)
    label_w = label_bbox[2] - label_bbox[0]
    draw.text(((canvas_w - label_w) // 2, 14), style["label"], fill=(255, 255, 255), font=font_large)

    sub_bbox = draw.textbbox((0, 0), style["subtitle"], font=font_small)
    sub_w = sub_bbox[2] - sub_bbox[0]
    draw.text(((canvas_w - sub_w) // 2, 54), style["subtitle"], fill=(255, 255, 255, 180), font=font_small)

    # Draw decorative border lines under banner
    line_y = banner_h + 2
    draw.rectangle([(padding, line_y), (canvas_w - padding, line_y + 3)], fill=style["accent1"])

    if tier == "chase":
        # Glow effect behind chase cards
        glow_pad = 30
        total_w = sum(im.width for im in imgs) + padding * (len(imgs) - 1)
        gx = (canvas_w - total_w) // 2 - glow_pad
        gy = banner_h + padding - glow_pad // 2
        draw.rectangle(
            [(gx, gy), (gx + total_w + glow_pad * 2, gy + imgs[0].height + glow_pad)],
            fill=style["glow"]
        )
        # Paste chase cards centered
        x = (canvas_w - total_w) // 2
        y = banner_h + padding
        for im in imgs:
            # Draw gold border around card
            border = 4
            draw.rectangle(
                [(x - border, y - border), (x + im.width + border, y + im.height + border)],
                outline=style["border_color"], width=border
            )
            canvas.paste(im, (x, y))
            x += im.width + padding
    else:
        # Grid layout — 2 cards per row
        y = banner_h + padding + 8
        cards_per_row = min(2, len(imgs))
        rows = [imgs[i:i + cards_per_row] for i in range(0, len(imgs), cards_per_row)]
        for row in rows:
            total_w = sum(im.width for im in row) + padding * (len(row) - 1)
            x = (canvas_w - total_w) // 2
            for im in row:
                border = 3
                draw.rectangle(
                    [(x - border, y - border), (x + im.width + border, y + im.height + border)],
                    outline=style["border_color"], width=border
                )
                canvas.paste(im, (x, y))
                x += im.width + padding
            y += card_height + padding

    # Draw bottom accent line
    draw.rectangle([(padding, canvas_h - 8), (canvas_w - padding, canvas_h - 5)], fill=style["accent1"])

    # Card count badge in bottom-right
    count_text = f"{len(card_images_b64)} CARD{'S' if len(card_images_b64) != 1 else ''}"
    ct_bbox = draw.textbbox((0, 0), count_text, font=font_small)
    ct_w = ct_bbox[2] - ct_bbox[0]
    badge_x = canvas_w - ct_w - padding * 2
    badge_y = canvas_h - 32
    draw.rectangle([(badge_x - 8, badge_y - 4), (badge_x + ct_w + 8, badge_y + 20)], fill=style["accent1"])
    draw.text((badge_x, badge_y), count_text, fill=(255, 255, 255), font=font_small)

    buf = BytesIO()
    canvas.save(buf, format='JPEG', quality=92)
    return base64.b64encode(buf.getvalue()).decode('utf-8')
