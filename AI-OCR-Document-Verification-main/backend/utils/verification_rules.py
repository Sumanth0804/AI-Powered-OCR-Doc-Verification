# backend/utils/verification_rules.py
import re
from datetime import datetime

# -----------------------------
# Verhoeff Tables
# -----------------------------
d_table = [
    [0,1,2,3,4,5,6,7,8,9],
    [1,2,3,4,0,6,7,8,9,5],
    [2,3,4,0,1,7,8,9,5,6],
    [3,4,0,1,2,8,9,5,6,7],
    [4,0,1,2,3,9,5,6,7,8],
    [5,9,8,7,6,0,4,3,2,1],
    [6,5,9,8,7,1,0,4,3,2],
    [7,6,5,9,8,2,1,0,4,3],
    [8,7,6,5,9,3,2,1,0,4],
    [9,8,7,6,5,4,3,2,1,0]
]

p_table = [
    [0,1,2,3,4,5,6,7,8,9],
    [1,5,7,6,2,8,3,0,9,4],
    [5,8,0,3,7,9,6,1,4,2],
    [8,9,1,6,0,4,3,5,2,7],
    [9,4,5,3,1,2,6,8,7,0],
    [4,2,8,6,5,7,3,9,0,1],
    [2,7,9,3,8,0,6,4,1,5],
    [7,0,4,6,9,1,3,2,5,8]
]

def verhoeff_validate(num):
    """Return True if Aadhaar passes Verhoeff checksum validation"""
    try:
        c = 0
        num = str(num)[::-1]
        for i, item in enumerate(num):
            c = d_table[c][p_table[i % 8][int(item)]]
        return c == 0
    except Exception:
        return False

# -----------------------------
# OCR Friendly Aadhaar Validator
# -----------------------------
# Matches:
#   1234 5678 9123
#   123456789123
#   1234-5678-9123
#   Hindi: १२३४ ५६७८ ९१२३
AADHAAR_REGEX = r"([0-9०-९]{4}[-\s]?[0-9०-९]{4}[-\s]?[0-9०-९]{4})"

def normalize_digits(text):
    """Convert Hindi digits to English digits."""
    hindi = "०१२३४५६७८९"
    eng =   "0123456789"
    trans = str.maketrans(hindi, eng)
    return text.translate(trans)

def validate_aadhaar_number(aadhaar):
    if not aadhaar:
        return "Missing"

    aadhaar = str(aadhaar)
    aadhaar = normalize_digits(aadhaar)
    aadhaar = re.sub(r"[^0-9]", "", aadhaar)

    if len(aadhaar) != 12:
        return "Invalid (must be 12 digits)"

    if not verhoeff_validate(aadhaar):
        return "Invalid (checksum failed)"

    return "Valid"

# -----------------------------
# Name Validation
# -----------------------------
def validate_name(name):
    if not name:
        return "Missing"

    name = str(name).strip()

    # Allow English + Hindi names
    if not re.fullmatch(r"[A-Za-zअ-ह०-९ .'-]{2,60}", name):
        return "Invalid (unexpected characters)"

    return "Valid"

# -----------------------------
# DOB Validation
# -----------------------------
def validate_dob(dob):
    if not dob:
        return "Missing"

    dob = str(dob).strip()

    # Fix OCR common errors
    dob = dob.replace("-", "/").replace(".", "/")
    dob = normalize_digits(dob)

    # Accept "Year of Birth" (YYYY)
    if re.fullmatch(r"\d{4}", dob):
        year = int(dob)
        if 1900 <= year <= datetime.now().year:
            return "Valid"
        return "Invalid (year out of range)"

    # Accept DD/MM/YYYY, DD/MM/YY
    for fmt in ("%d/%m/%Y", "%d/%m/%y"):
        try:
            date = datetime.strptime(dob, fmt)
            if date <= datetime.now():
                return "Valid"
            return "Invalid (future date)"
        except:
            pass

    return "Invalid (unrecognized format)"

# -----------------------------
# Gender Validation
# -----------------------------
def validate_gender(gender):
    if not gender:
        return "Missing"

    g = str(gender).lower()

    if g in ["m", "male", "पुरुष"]:
        return "Valid"

    if g in ["f", "female", "महिला"]:
        return "Valid"

    return "Invalid (must be Male/Female)"

# -----------------------------
# OCR Error Correction
# -----------------------------
def correct_common_ocr_errors(text):
    if not text:
        return ""

    # Fix common digit confusions
    corrections = {
        "O": "0",
        "o": "0",
        "I": "1",
        "l": "1",
        "B": "8"
    }

    for wrong, right in corrections.items():
        text = text.replace(wrong, right)

    return text
