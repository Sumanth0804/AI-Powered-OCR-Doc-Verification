# 📘 Aadhaar Authentication – Aadhaar Card Verification System

A complete web-based platform for automated Aadhaar card verification, OCR extraction, YOLO-based detection, fraud scoring, and analytics dashboards.

---

# 🚀 Features

## ✔️ Core Verification
- **Single Aadhaar Verification** – Detailed extraction & fraud analysis  
- **Batch Verification** – Process multiple Aadhaar cards via ZIP upload  
- **YOLO-Based Aadhaar Detection** – Card + text field detection  
- **QR Code Validation** – Decode Aadhaar QR & cross-check extracted fields  
- **Multi-Factor Fraud Detection** – Risk scoring & inconsistency detection  

## ✔️ Technical Capabilities
- OCR text extraction using **Tesseract**
- **Face detection** via YOLO/OpenCV  
- **Verhoeff checksum validation** for Aadhaar number  
- Smart preprocessing (deskew, denoise, contrast enhancement)  
- JSON / CSV export  
- 100% offline processing  

---

# 📁 Project Structure (Actual)

```
aadhaar-fraud-detection-ai/
├── analytics.html
├── about.html
├── contact.html
├── dashboard.html
├── history.html
├── index.html
├── login.html
├── services.html
├── verify-enhanced.html
├── css/
│   └── style.css
├── js/
│   └── script.js
└── backend/
    ├── app.py
    ├── load_model.py
    ├── history.json
    ├── models/
    │   └── best.pt
    └── utils/
        ├── processor.py
        ├── verification_rules.py
        └── ocr_utils.py
```

---

# 🛠️ Technology Stack

## 🖥️ Frontend
- HTML5 / CSS3  
- JavaScript  
- Chart.js (Analytics)  
- SweetAlert2 (UI dialogs)  
- LocalStorage-based history  

## ⚙️ Backend
- Python (Flask API)
- YOLO (Ultralytics)
- Tesseract OCR  
- OpenCV  
- PyZbar / PyAadhaar for QR decoding  

---

# 🚀 Quick Start

## 1️⃣ Prerequisites
- Python **3.8+**
- Tesseract OCR installed
- YOLO model `best.pt`
- Browser (Chrome recommended)

## 2️⃣ Installation

Clone repository:

```bash
git clone <repository-url>
cd aadhaar-fraud-detection-ai
```

Install dependencies:

```bash
pip install flask flask-cors ultralytics opencv-python pillow pytesseract pyzbar pyaadhaar
```

Install Tesseract OCR:

| OS | Installation |
|----|--------------|
| Windows | https://github.com/UB-Mannheim/tesseract/wiki |
| Linux | sudo apt install tesseract-ocr |
| macOS | brew install tesseract |

Place your YOLO model:

```
backend/models/best.pt
```

---

# ▶️ Running the Application

Start backend:

```bash
cd backend
python app.py
```

Then open in browser:

```
http://localhost:5000
```

---

# 📊 Usage Guide

## 🔹 Single Aadhaar Verification
- Upload **front image** (required)  
- Optional: Upload **back image** for QR validation  
- Click **Run Verification**  
- View extracted fields, fraud score, risk level  
- Download JSON / CSV  

## 🔹 Batch Aadhaar Verification
- Upload **ZIP** containing multiple images  
- System processes each image  
- Batch summary + per-record results  
- Export full report (JSON/CSV)

### Supported Formats

| Type | Formats |
|------|----------|
| Images | jpg, jpeg, png, bmp, tiff |
| Batch | ZIP (images only) |
| Max Upload | 50MB |

---

# 🔍 Verification Workflow

## 1️⃣ Aadhaar Detection (YOLO)
- Detects Aadhaar card  
- Locates text regions  
- Validates orientation  

## 2️⃣ OCR & Field Extraction
Extracts:
- Aadhaar number  
- Name  
- DOB  
- Gender  

Validates:
- ✔ Verhoeff checksum  
- ✔ DOB validity  
- ✔ Gender consistency  

## 3️⃣ QR Code Validation
- Decodes Aadhaar QR  
- Cross-checks OCR vs QR  

## 4️⃣ Fraud Detection System
- Photo detection  
- Inconsistency checks  
- Dynamic fraud scoring  

### Risk Levels

| Level | Meaning |
|--------|----------|
| **LOW** | All checks passed |
| **MODERATE** | Minor mismatches |
| **HIGH** | Major inconsistencies or fraud indicators |

---

# 📋 API Endpoints

### Verification APIs
```
POST /api/verify_single
POST /api/verify_batch
```

### Utility APIs
```
GET /api/health
GET /
```

---

# 📁 Export Formats

## JSON Output Includes:
- Timestamp  
- Extracted fields  
- OCR confidence  
- QR validation result  
- Fraud score & risk  

## CSV Output Includes:
- Flattened record per Aadhaar  
- Summary details  
- Fraud score & category  

---

# ⚙️ Configuration

| Component | Configuration File |
|----------|---------------------|
| YOLO Model Path | backend/app.py, backend/load_model.py |
| Tesseract Path | backend/utils/ocr_utils.py |
| Risk Logic | backend/utils/verification_rules.py |
| Image Processing | backend/utils/processor.py |
| UI Theme | css/style.css |

---

# 🛡️ Security & Privacy

- All processing occurs **locally**
- No images or data sent to external servers  
- Temporary files auto-cleaned  
- No Aadhaar data stored permanently  

---

# 🐛 Troubleshooting

| Issue | Solution |
|-------|-----------|
| Tesseract not detected | Add to PATH or set path in `ocr_utils.py` |
| YOLO model missing | Ensure `best.pt` exists under `/backend/models/` |
| QR decode fails | Use higher-quality back image |
| Analytics blank | Check `localStorage.aadhaar_history` |
| Memory crash on batch | Reduce ZIP size |

---

# 📈 Performance

- **Single verification:** 2–5 seconds  
- **Batch verification:** depends on number of files  
- **GPU support:** Faster YOLO inference  

---

# 🧪 Development Tips

- Use Chrome Incognito to avoid extension errors  
- Restart Flask after any backend change  
- Check **browser console** + **Flask terminal logs**  

---

# 🔁 Contributing

1. Fork the repository  
2. Create a new feature branch  
3. Add your improvements  
4. Submit a Pull Request  

---

## Project By

- **M.R.TejeshwarReddy**
- **Contact: tejeshwarreddy2424@gmail.com**

## 📄 License

This project is under MIT license.

----
## live website url

link - **https://ai-ocr-document-verification-2.onrender.com**
