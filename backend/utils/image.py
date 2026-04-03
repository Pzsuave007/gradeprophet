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
    """Auto-crop scanner image to remove semi-rigid holder edges and Gem Mint label.
    Uses adaptive threshold from image corners (which are always holder) and
    percentage-based row/column analysis. A row is 'holder' if >50% of its pixels
    are brighter than the adaptive threshold. Works for both fronts and backs.
    Adaptive margin: 50px max, or half the available holder space.
    """
    try:
        import cv2
        import numpy as np

        image_data = base64.b64decode(image_base64)
        nparr = np.frombuffer(image_data, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            logger.warning("Scanner auto-process: failed to decode image")
            return image_base64

        h, w = img.shape[:2]
        logger.info(f"Scanner auto-process START: {w}x{h} is_back={is_back}")
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        MAX_MARGIN = 50

        # Adaptive threshold from corner brightness (corners are always holder)
        cs = min(50, h // 10, w // 10)
        corners = [
            gray[0:cs, 0:cs], gray[0:cs, w-cs:w],
            gray[h-cs:h, 0:cs], gray[h-cs:h, w-cs:w]
        ]
        holder_brightness = np.mean([c.mean() for c in corners])
        thresh = holder_brightness - 30

        # Row analysis: a row is "holder" if >50% of its pixels are bright
        HOLDER_PCT = 0.50
        row_bright = np.array([(gray[r, :] > thresh).mean() for r in range(h)])

        # Find card top/bottom
        card_top = 0
        for r in range(h):
            if row_bright[r] < HOLDER_PCT:
                card_top = r
                break

        card_bot = h - 1
        for r in range(h - 1, -1, -1):
            if row_bright[r] < HOLDER_PCT:
                card_bot = r
                break

        # Column analysis: use confirmed card rows only
        mid_start = min(card_top + 30, h - 1)
        mid_end = max(card_bot - 30, mid_start + 1)
        card_region = gray[mid_start:mid_end, :]
        col_bright = np.array([(card_region[:, c] > thresh).mean() for c in range(w)])

        card_left = 0
        for c in range(w):
            if col_bright[c] < HOLDER_PCT:
                card_left = c
                break

        card_right = w - 1
        for c in range(w - 1, -1, -1):
            if col_bright[c] < HOLDER_PCT:
                card_right = c
                break

        card_w = card_right - card_left
        card_h = card_bot - card_top

        if card_w < w * 0.3 or card_h < h * 0.3:
            logger.info("Scanner crop: detection too small, skipping")
            _, buffer = cv2.imencode('.jpg', img, [cv2.IMWRITE_JPEG_QUALITY, 95])
            return base64.b64encode(buffer).decode('utf-8')

        logger.info(f"Scanner crop: card at ({card_left},{card_top})-({card_right},{card_bot}) holder_bright={holder_brightness:.0f}")

        # Adaptive margin
        margin_top = min(MAX_MARGIN, max(0, card_top // 2))
        margin_bot = min(MAX_MARGIN, max(0, (h - 1 - card_bot) // 2))
        margin_left = min(MAX_MARGIN, max(0, card_left // 2))
        margin_right = min(MAX_MARGIN, max(0, (w - 1 - card_right) // 2))

        x1 = card_left - margin_left
        y1 = card_top - margin_top
        x2 = card_right + margin_right
        y2 = card_bot + margin_bot

        if (x2 - x1) < w or (y2 - y1) < h:
            img = img[y1:y2, x1:x2]
            logger.info(f"Scanner crop: {w}x{h} -> {img.shape[1]}x{img.shape[0]}")
        else:
            logger.info("Scanner crop: card fills image, skipping")

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


def crop_corners_from_image(image_base64: str, corner_size_percent: float = 0.25) -> dict:
    """Crop the four corners from a card image for detailed analysis"""
    try:
        from fastapi import HTTPException

        image_data = base64.b64decode(image_base64)
        img = Image.open(BytesIO(image_data))

        width, height = img.size
        corner_size = int(min(width, height) * corner_size_percent)

        corners = {}

        top_left = img.crop((0, 0, corner_size, corner_size))
        tl_buffer = BytesIO()
        top_left.save(tl_buffer, format='JPEG', quality=90)
        corners['top_left'] = base64.b64encode(tl_buffer.getvalue()).decode('utf-8')

        top_right = img.crop((width - corner_size, 0, width, corner_size))
        tr_buffer = BytesIO()
        top_right.save(tr_buffer, format='JPEG', quality=90)
        corners['top_right'] = base64.b64encode(tr_buffer.getvalue()).decode('utf-8')

        bottom_left = img.crop((0, height - corner_size, corner_size, height))
        bl_buffer = BytesIO()
        bottom_left.save(bl_buffer, format='JPEG', quality=90)
        corners['bottom_left'] = base64.b64encode(bl_buffer.getvalue()).decode('utf-8')

        bottom_right = img.crop((width - corner_size, height - corner_size, width, height))
        br_buffer = BytesIO()
        bottom_right.save(br_buffer, format='JPEG', quality=90)
        corners['bottom_right'] = base64.b64encode(br_buffer.getvalue()).decode('utf-8')

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
