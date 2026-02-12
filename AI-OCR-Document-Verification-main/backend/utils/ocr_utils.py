from PIL import Image, ImageEnhance, ImageFilter

# ----------------------------------------------------
# FULL Aadhaar-card OCR preprocessing (used for card detection)
# ----------------------------------------------------
def preprocess_for_ocr_full(image):
    """
    Preprocess the FULL image for Aadhaar text detection.
    Used in: is_aadhaar_image()
    """
    # Convert to grayscale
    gray = image.convert("L")

    # Improve contrast
    enhancer = ImageEnhance.Contrast(gray)
    gray = enhancer.enhance(2.0)

    # Sharpen for Tesseract readability
    gray = gray.filter(ImageFilter.SHARPEN)

    return gray


# ----------------------------------------------------
# CROPPED FIELD OCR preprocessing (used for name, dob, etc)
# ----------------------------------------------------
def preprocess_for_ocr(crop):
    """
    Preprocess cropped fields (Name, Gender, DOB, Aadhaar Number).
    Enlarges text for better OCR.
    """
    gray = crop.convert("L")

    # Increase contrast
    enhancer = ImageEnhance.Contrast(gray)
    gray = enhancer.enhance(2.2)

    # Sharpen the text
    gray = gray.filter(ImageFilter.SHARPEN)

    # Upscale (Tesseract reads enlarged text much better)
    w, h = gray.size
    gray = gray.resize((w * 2, h * 2), Image.Resampling.LANCZOS)

    return gray
