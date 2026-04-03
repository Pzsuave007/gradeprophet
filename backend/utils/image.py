import base64
import logging
from io import BytesIO
from PIL import Image, ImageOps, ImageEnhance

logger = logging.getLogger(__name__)


def scanner_auto_process(image_base64: str) -> str:
    """Auto-crop card from scanner image (uniform background) + apply Scanner Fix preset.
    
    Steps:
    1. Detect card edges using thresholding + contour detection
    2. Crop tightly to the card
    3. Apply Scanner Fix: brightness 1.12, contrast 0.95, saturate 1.20, shadow lift
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
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)

        # --- Step 1: Detect card rectangle ---
        best_contour = None
        best_score = 0

        for method in ['otsu', 'adaptive', 'canny', 'white_bg']:
            if method == 'otsu':
                _, thresh = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
            elif method == 'adaptive':
                thresh = cv2.adaptiveThreshold(blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                               cv2.THRESH_BINARY_INV, 21, 5)
            elif method == 'white_bg':
                # Specifically target white/light scanner background
                _, thresh = cv2.threshold(blurred, 220, 255, cv2.THRESH_BINARY_INV)
                kernel = np.ones((5, 5), np.uint8)
                thresh = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel, iterations=3)
            else:  # canny
                edges = cv2.Canny(blurred, 30, 100)
                kernel = np.ones((5, 5), np.uint8)
                thresh = cv2.dilate(edges, kernel, iterations=2)

            contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

            for cnt in contours:
                area = cv2.contourArea(cnt)
                if area < (w * h * 0.15) or area > (w * h * 0.95):
                    continue
                peri = cv2.arcLength(cnt, True)
                approx = cv2.approxPolyDP(cnt, 0.02 * peri, True)
                
                x, y, rw, rh = cv2.boundingRect(cnt)
                ratio = rh / rw if rw > 0 else 0
                
                # Score: prefer card-like aspect ratio (1.3-1.5) and 4 vertices
                ratio_score = max(0, 1.0 - abs(ratio - 1.4) * 2)
                vertex_bonus = 1.5 if len(approx) == 4 else 1.0
                area_score = area / (w * h)
                score = ratio_score * vertex_bonus * area_score

                if score > best_score:
                    if len(approx) == 4:
                        best_contour = approx
                    else:
                        best_contour = np.array([[x, y], [x+rw, y], [x+rw, y+rh], [x, y+rh]],
                                                dtype=np.int32).reshape(4, 1, 2)
                    best_score = score

        if best_contour is not None and best_score > 0.1:
            pts = best_contour.reshape(4, 2).astype(np.float32)
            rect = _order_points(pts)
            
            width_top = np.linalg.norm(rect[1] - rect[0])
            width_bottom = np.linalg.norm(rect[2] - rect[3])
            max_width = int(max(width_top, width_bottom))
            height_left = np.linalg.norm(rect[3] - rect[0])
            height_right = np.linalg.norm(rect[2] - rect[1])
            max_height = int(max(height_left, height_right))

            if max_width > 50 and max_height > 50:
                dst = np.array([
                    [0, 0], [max_width - 1, 0],
                    [max_width - 1, max_height - 1], [0, max_height - 1]
                ], dtype=np.float32)
                M = cv2.getPerspectiveTransform(rect, dst)
                warped = cv2.warpPerspective(img, M, (max_width, max_height))
                
                # Trim 1-2% inward to remove any sleeve edge remnants
                trim = max(int(max_width * 0.015), 2)
                trimv = max(int(max_height * 0.015), 2)
                warped = warped[trimv:max_height-trimv, trim:max_width-trim]
                
                img = warped
                logger.info(f"Scanner crop: {w}x{h} -> {warped.shape[1]}x{warped.shape[0]}")
        else:
            # Fallback: center crop removing outer 8%
            margin_x = int(w * 0.08)
            margin_y = int(h * 0.08)
            img = img[margin_y:h-margin_y, margin_x:w-margin_x]
            logger.info(f"Scanner crop: fallback center crop {w}x{h} -> {img.shape[1]}x{img.shape[0]}")

        # --- Step 2: Apply Scanner Fix preset ---
        img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        pil_img = Image.fromarray(img_rgb)

        pil_img = ImageEnhance.Brightness(pil_img).enhance(1.12)
        pil_img = ImageEnhance.Contrast(pil_img).enhance(0.95)
        pil_img = ImageEnhance.Color(pil_img).enhance(1.20)
        
        # Shadow lift: raise dark values
        arr = np.array(pil_img, dtype=np.float32) / 255.0
        shadow_strength = 0.35
        arr = arr + shadow_strength * (1 - arr) * (1 - arr) * (1 - arr)
        arr = np.clip(arr * 255, 0, 255).astype(np.uint8)
        pil_img = Image.fromarray(arr)

        buf = BytesIO()
        pil_img.save(buf, format='JPEG', quality=95)
        result = base64.b64encode(buf.getvalue()).decode('utf-8')
        logger.info("Scanner auto-process complete: crop + Scanner Fix applied")
        return result

    except Exception as e:
        logger.warning(f"Scanner auto-process failed: {e}", exc_info=True)
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


def create_store_thumbnail(image_base64: str, max_size: int = 400) -> str:
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
        image.save(buffer, format='WEBP', quality=88)
        return base64.b64encode(buffer.getvalue()).decode('utf-8')
    except Exception as e:
        logger.warning(f"Failed to create store thumbnail: {e}")
        return create_thumbnail(image_base64, max_size=max_size)


def process_card_image(image_base64: str, max_size: int = 800) -> str:
    """Full image processing pipeline: EXIF rotate -> crop -> resize"""
    processed = fix_exif_rotation(image_base64)
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
