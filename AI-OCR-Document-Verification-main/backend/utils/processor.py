# ============================================================
#  UNIVERSAL AADHAAR OCR ENGINE (Tesseract-only, Proper Case)
# ============================================================

import os
import io
import re
import zipfile
import datetime
import traceback
import cv2
import numpy as np
from PIL import Image

# ---------- Project utilities ----------
from backend.utils.verification_rules import (
    validate_aadhaar_number,
    validate_name,
    validate_gender,
    validate_dob,
    correct_common_ocr_errors,
)

from backend.utils.ocr_utils import preprocess_for_ocr, preprocess_for_ocr_full

# ---------- Dependencies ----------
try:
    import pytesseract
    PYTESSERACT_AVAILABLE = True
except:
    PYTESSERACT_AVAILABLE = False

try:
    from pyzbar.pyzbar import decode as pyzbar_decode
    from pyaadhaar.utils import isSecureQr
    from pyaadhaar.decode import AadhaarSecureQr
    PYAADHAAR_AVAILABLE = True
except:
    PYAADHAAR_AVAILABLE = False


# ============================================================
#  SANITIZER
# ============================================================
def sanitize_value(v):
    if v is None:
        return None
    if isinstance(v, (np.generic,)):
        try:
            return v.item()
        except:
            try:
                return int(v)
            except:
                return float(v)
    if isinstance(v, (np.ndarray,)):
        try:
            return v.tolist()
        except:
            return str(v)
    if isinstance(v, (bytes, bytearray)):
        try:
            return v.decode("utf-8", errors="ignore")
        except:
            return str(v)
    try:
        from PIL.Image import Image as PILImage
        if isinstance(v, PILImage):
            return {"width": v.width, "height": v.height}
    except:
        pass
    if isinstance(v, (list, tuple)):
        return [sanitize_value(x) for x in v]
    if isinstance(v, dict):
        return {str(k): sanitize_value(val) for k, val in v.items()}
    if isinstance(v, (np.bool_,)):
        return bool(v)
    if isinstance(v, (int, float, str, bool)):
        return v
    try:
        return str(v)
    except:
        return None


def sanitize_json(obj):
    if isinstance(obj, dict):
        return {str(k): sanitize_json(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [sanitize_json(v) for v in obj]
    return sanitize_value(obj)


# ============================================================
#  BASE OCR HELPERS
# ============================================================
def pytesseract_image_to_text(pil_image):
    if not PYTESSERACT_AVAILABLE:
        return ""

    try:
        arr = np.array(preprocess_for_ocr_full(pil_image))
        pil = Image.fromarray(arr)
    except:
        pil = pil_image

    try:
        txt = pytesseract.image_to_string(pil)
        return txt.lower().strip()
    except:
        return ""


# ---------------- CLEANER ----------------
def clean_name_raw(txt):
    # Keep accented characters too
    txt = re.sub(r"[^A-Za-zÀ-ž\s.]", "", txt)
    txt = re.sub(r"\s{2,}", " ", txt)
    return txt.strip()


# ============================================================
#  REGEX HELPERS
# ============================================================
AADHAAR_RE = re.compile(r"(\d{4}\s?\d{4}\s?\d{4})")
DOB_RE = re.compile(r"(\d{2}[\/\-\.\s]\d{2}[\/\-\.\s]\d{4})")


def find_aadhaar_in_text(txt):
    m = AADHAAR_RE.search(txt)
    return m.group(1) if m else ""


def find_dob_in_text(txt):
    if not txt:
        return ""

    m = DOB_RE.search(txt)
    if m:
        return m.group(1)

    m2 = re.search(r"(\d{2}\s?\d{2}\s?\d{4})", txt)
    if m2:
        s = m2.group(1)
        return f"{s[0:2]}/{s[2:4]}/{s[4:8]}"

    return ""


def guess_name_from_text(txt):
    if not txt:
        return ""

    lines = [l.strip() for l in txt.splitlines() if l.strip()]
    candidates = []

    for ln in lines[:25]:
        if any(c.isalpha() for c in ln) and 4 < len(ln) < 60:
            if any(x in ln.lower() for x in ["dob", "birth", "female", "male", "uidai"]):
                continue
            candidates.append(ln)

    if candidates:
        return candidates[0]

    return ""
# ============================================================
#  UNIVERSAL NAME EXTRACTOR v3 (FINAL – PROPER CASE OUTPUT)
# ============================================================

def proper_case(text):
    """Convert OCR string to Proper Case safely."""
    words = text.split()
    return " ".join(w.capitalize() for w in words)


def extract_universal_name_v3(full_pil):
    """
    Universal Aadhaar Name Extractor — FINAL VERSION
    ------------------------------------------------
    ✓ Handles old/new/PVC Aadhaar
    ✓ Works on low-quality images
    ✓ Uses advanced morphological line detection
    ✓ Keeps accented OCR characters (ë ī č ł etc.)
    ✓ Rejects garbage lines (numbers, noise)
    ✓ Picks the BEST name line, not longest
    ✓ Outputs **Proper Case**
    """

    try:
        # Convert to OpenCV BGR
        img = np.array(full_pil.convert("RGB"))[:, :, ::-1]
        H, W = img.shape[:2]

        # ---------- PREPROCESS ----------
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        gray = cv2.medianBlur(gray, 3)

        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        gray = clahe.apply(gray)

        # Adaptive threshold and invert (text = white)
        th = cv2.adaptiveThreshold(
            gray, 255,
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY,
            31, 10
        )
        th = 255 - th

        # ---------- MORPH: connect characters into lines ----------
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (W // 35, 3))
        closed = cv2.morphologyEx(th, cv2.MORPH_CLOSE, kernel, iterations=2)

        contours, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        candidates = []

        for cnt in contours:
            x, y, w, h = cv2.boundingRect(cnt)

            # Filter unreasonable boxes
            if w < W * 0.25 or h < 18 or h > H * 0.22:
                continue

            # Extract the line crop
            crop = img[y:y+h, x:x+w]
            crop_pil = Image.fromarray(cv2.cvtColor(crop, cv2.COLOR_BGR2RGB))

            # ---------- Perform OCR ----------
            try:
                raw = pytesseract.image_to_string(
                    crop_pil,
                    config="--psm 7 --oem 3"
                )
            except:
                raw = ""

            raw = raw.replace("\n", " ").strip()

            # Remove digits (names never contain digits)
            clean = re.sub(r"[0-9]", "", raw)

            # Remove garbage but KEEP accented chars
            clean = re.sub(r"[^A-Za-zÀ-ž\s.]", "", clean)
            clean = re.sub(r"\s{2,}", " ", clean).strip()

            if not clean:
                continue

            words = clean.split()

            # Reject lines that are not name-like
            if len(words) < 2 or len(words) > 6:
                continue

            letter_count = len(re.sub(r"[^A-Za-zÀ-ž]", "", clean))
            if letter_count < 4:
                continue

            # Compute quality score
            ascii_count = len(re.findall(r"[A-Za-z]", clean))
            ascii_ratio = ascii_count / max(1, letter_count)

            # Higher score if close to typical 2–4 word names
            word_penalty = abs(len(words) - 3)

            score = (ascii_ratio * 0.7) + (1 / (1 + word_penalty)) * 0.3

            candidates.append((score, clean))

        # ---------- Choose best candidate ----------
        if not candidates:
            return ""

        best = max(candidates, key=lambda x: x[0])[1]

        # ---------- Final cleanup ----------
        best = re.sub(r"\s{2,}", " ", best).strip()

        # PROPER CASE OUTPUT
        best = proper_case(best)

        return best

    except Exception:
        return ""
# ============================================================
#  REGEX HELPERS — AADHAAR, DOB, GENDER
# ============================================================

AADHAAR_RE = re.compile(r'(\d{4}\s?\d{4}\s?\d{4})')
DOB_RE = re.compile(r'(\d{2}[\/\-\.\s]\d{2}[\/\-\.\s]\d{4})')

def find_aadhaar_in_text(txt):
    if not txt:
        return ""
    m = AADHAAR_RE.search(txt)
    return m.group(1) if m else ""

def find_dob_in_text(txt):
    if not txt:
        return ""
    m = DOB_RE.search(txt)
    if m:
        return m.group(1)
    # fallback: dd mm yyyy → dd/mm/yyyy
    m2 = re.search(r'(\d{2})\s?(\d{2})\s?(\d{4})', txt)
    if m2:
        return f"{m2.group(1)}/{m2.group(2)}/{m2.group(3)}"
    return ""

def extract_gender_from_text(txt):
    txt = txt.lower()
    if "female" in txt:
        return "Female"
    if "male" in txt:
        return "Male"
    # abbreviations
    if re.search(r"\b(f)\b", txt):
        return "Female"
    if re.search(r"\b(m)\b", txt):
        return "Male"
    return ""
# ============================================================
#  MAIN Aadhaar Extraction Logic (Final v2025)
# ============================================================

def process_single_image_bytes(front_bytes, back_bytes=None, do_qr_check=False, device="cpu"):
    ts = datetime.datetime.now().isoformat()

    try:
        # ---------- Aadhaar heuristic detection first ----------
        is_aadhaar, aadhaar_conf, details = is_aadhaar_image(front_bytes)
        if not is_aadhaar:
            return sanitize_json({
                "error": "NOT_AADHAAR",
                "message": "Uploaded image does not appear to be an Aadhaar card",
                "confidence_score": aadhaar_conf,
                "aadhaar_verification": details,
                "assessment": "INVALID_INPUT",
                "timestamp": ts
            })

        # ---------- Load image ----------
        pil = Image.open(io.BytesIO(front_bytes)).convert("RGB")
        np_rgb = np.array(pil)
        np_bgr = cv2.cvtColor(np_rgb, cv2.COLOR_RGB2BGR)

        results = {
            "timestamp": ts,
            "fraud_score": 0,
            "assessment": "LOW",
            "indicators": [],
            "ocr_data": {},
            "qr_data": {},
            "confidence_score": aadhaar_conf,
            "aadhaar_verification": {
                "is_aadhaar_card": True,
                "confidence_score": aadhaar_conf,
                "verification_details": details
            },
            "extracted": {}
        }

        # ============================================================
        #  FULL IMAGE OCR (only once)
        # ============================================================
        full_text = ""
        if PYTESSERACT_AVAILABLE:
            try:
                full_text = pytesseract_image_to_text(pil)
            except:
                full_text = ""
        results["ocr_data"]["full_text"] = full_text

        # ============================================================
        #  EXTRACT AADHAAR NUMBER
        # ============================================================
        aadhaar_number = find_aadhaar_in_text(full_text)
        aadhaar_number = re.sub(r"[^0-9]", "", aadhaar_number)

        # ============================================================
        #  EXTRACT DOB
        # ============================================================
        dob = find_dob_in_text(full_text)
        dob = dob.replace(".", "/").replace("-", "/")

        # ============================================================
        #  EXTRACT GENDER
        # ============================================================
        gender = extract_gender_from_text(full_text)

        # ============================================================
        #  EXTRACT NAME — using UNIVERSAL NAME EXTRACTOR v3
        # ============================================================
        name = extract_universal_name_v3(pil)

        # fallback if name still missing
        if not name:
            name_guess = guess_name_from_text(full_text)
            if name_guess:
                name = proper_case(name_guess)

        # ============================================================
        #  CLEAN NORMALIZE FINAL OUTPUT
        # ============================================================
        if aadhaar_number:
            aadhaar_number = aadhaar_number.strip()

        if dob:
            dob = dob.strip()

        if name:
            name = name.strip()

        # ============================================================
        #  VALIDATION + SCORING
        # ============================================================
        a_val = validate_aadhaar_number(aadhaar_number) if aadhaar_number else "Missing"
        n_val = validate_name(name) if name else "Missing"
        g_val = validate_gender(gender) if gender else "Missing"
        d_val = validate_dob(dob) if dob else "Missing"

        # Aadhaar scoring
        if a_val == "Missing":
            results["fraud_score"] += 3
            results["indicators"].append("🔴 HIGH: Aadhaar number missing.")
        elif "Invalid" in a_val:
            results["fraud_score"] += 3
            results["indicators"].append(f"🔴 HIGH: Aadhaar number '{aadhaar_number}' invalid.")
        else:
            results["indicators"].append("✅ LOW: Aadhaar number extracted.")

        # Name scoring
        if n_val == "Missing":
            results["fraud_score"] += 1
            results["indicators"].append("🟡 MEDIUM: Name missing.")
        elif "Invalid" in n_val:
            results["fraud_score"] += 1
            results["indicators"].append(f"🟡 MEDIUM: Name '{name}' invalid.")
        else:
            results["indicators"].append("✅ LOW: Name valid format.")

        # DOB scoring
        if d_val == "Missing":
            results["fraud_score"] += 1
            results["indicators"].append("🟡 MEDIUM: DOB missing.")
        elif "Invalid" in d_val:
            results["fraud_score"] += 2
            results["indicators"].append(f"🔴 HIGH: DOB '{dob}' invalid.")
        else:
            results["indicators"].append("✅ LOW: DOB valid format.")

        # Gender scoring
        if g_val == "Missing":
            results["fraud_score"] += 1
            results["indicators"].append("🟡 MEDIUM: Gender missing.")
        elif "Invalid" in g_val:
            results["fraud_score"] += 1
            results["indicators"].append(f"🟡 MEDIUM: Gender '{gender}' invalid.")
        else:
            results["indicators"].append("✅ LOW: Gender valid.")

        # ============================================================
        #  SAVE RESULTS
        # ============================================================
        results["extracted"] = {
            "name": name or "",
            "dob": dob or "",
            "gender": gender or "",
            "aadhaar": aadhaar_number or ""
        }

        # ============================================================
        #  ASSESSMENT LEVEL
        # ============================================================
        if results["fraud_score"] >= 7:
            results["assessment"] = "HIGH"
        elif results["fraud_score"] >= 3:
            results["assessment"] = "MODERATE"
        else:
            results["assessment"] = "LOW"

        return sanitize_json(results)

    except Exception as e:
        return sanitize_json({
            "error": "PROCESSING_FAILED",
            "message": str(e),
            "traceback": traceback.format_exc(),
            "timestamp": ts
        })
# ============================================================
#  PART 4 — QR decode, Aadhaar heuristic detector, batch processing
# ============================================================

def decode_secure_qr(image_np_bgr):
    """
    Attempt to decode a secure Aadhaar QR using pyzbar + pyaadhaar.
    Returns dict with decoded fields or {'error': <str>} on failure.
    """
    if not PYAADHAAR_AVAILABLE:
        return {"error": "QR decoding disabled - dependencies not available"}
    try:
        gray = cv2.cvtColor(image_np_bgr, cv2.COLOR_BGR2GRAY)
        codes = pyzbar_decode(gray)
        if not codes:
            return {"error": "QR Code not found or could not be read"}
        data = codes[0].data
        # pyaadhaar expects numeric QR payload; try to coerce
        if isSecureQr(data):
            try:
                secure = AadhaarSecureQr(int(data))
                decoded = secure.decodeddata()
                if hasattr(decoded, "__dict__"):
                    return dict(decoded.__dict__)
                if isinstance(decoded, dict):
                    return decoded
                return {"data": str(decoded)}
            except Exception as e:
                return {"error": f"QR decode failed: {str(e)}"}
        else:
            return {"error": "Not a secure Aadhaar QR"}
    except Exception as e:
        return {"error": f"QR decode error: {str(e)}"}


# ============================================================
#  Aadhaar image heuristic detector (robust, lightweight)
# ============================================================
def is_aadhaar_image(image_bytes):
    """
    Lightweight heuristic to determine if an image is likely an Aadhaar card.
    Returns (is_aadhaar: bool, confidence:int(0-100), details:dict)
    """
    try:
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        max_dim = 1400
        w, h = img.size
        if max(w, h) > max_dim:
            scale = max_dim / float(max(w, h))
            img = img.resize((int(w*scale), int(h*scale)), Image.Resampling.LANCZOS)
            w, h = img.size

        np_img = np.array(img)
        aspect_ratio = (w / h) if h else 0.0
        aspect_ok = 1.1 <= aspect_ratio <= 2.9
        size_ok = min(w, h) >= 140

        # simple color-band hint (Aadhaar's top orange/pattern)
        sample_h = min(80, max(10, h // 8))
        avg_top = np.mean(np_img[:sample_h, :, :], axis=(0, 1))
        orange_hint = bool(avg_top[0] > avg_top[1] * 0.95 and avg_top[0] > avg_top[2] * 0.9)

        # OCR small snippet
        txt = ""
        if PYTESSERACT_AVAILABLE:
            try:
                txt = pytesseract_image_to_text(img) or ""
            except:
                txt = ""

        keywords = ['aadhaar', 'aadhar', 'uidai', 'government of india', 'date of birth', 'dob', 'male', 'female']
        keywords_found = sum(1 for k in keywords if k in txt.lower())
        aadhaar_numbers_found = len(re.findall(r"\b\d{4}\s?\d{4}\s?\d{4}\b", txt))

        confidence = 0
        confidence += 35 if aspect_ok else 0
        confidence += 20 if size_ok else 0
        confidence += 20 if orange_hint else 0
        confidence += min(keywords_found * 12, 30)
        confidence += 25 if aadhaar_numbers_found > 0 else 0
        confidence = int(min(100, confidence))
        is_card = confidence >= 40

        details = {
            "keywords_found": int(keywords_found),
            "aadhaar_numbers_found": int(aadhaar_numbers_found),
            "aspect_ratio_valid": bool(aspect_ok),
            "size_valid": bool(size_ok),
            "color_band_detected": bool(orange_hint),
            "detected_text_snippet": (txt[:300] if txt else "")
        }
        return bool(is_card), int(confidence), details
    except Exception as e:
        return False, 0, {"error": str(e)}


# ============================================================
#  Batch ZIP processing helper
# ============================================================
def process_zip_bytes(zip_bytes, model_path=None, do_qr_check=False, device="cpu", max_files=None):
    """
    Process a zip file bytes containing images. Returns list of sanitized results.
    """
    out = []
    try:
        with zipfile.ZipFile(io.BytesIO(zip_bytes), "r") as z:
            members = [n for n in z.namelist() if n.lower().endswith((".jpg", ".jpeg", ".png"))]
            if max_files:
                members = members[:int(max_files)]
            for name in members:
                try:
                    b = z.read(name)
                    rec = process_single_image_bytes(b, back_bytes=None, do_qr_check=do_qr_check, device=device)
                    if isinstance(rec, dict):
                        rec["filename"] = name
                    out.append(sanitize_json(rec))
                except Exception as e:
                    out.append(sanitize_json({"filename": name, "error": str(e)}))
    except Exception as e:
        out.append(sanitize_json({"error": str(e)}))
    return out


# ============================================================
#  End of processor.py
# ============================================================
