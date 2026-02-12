import os
import requests

MODEL_DIR = os.path.join(os.path.dirname(__file__), "models")
os.makedirs(MODEL_DIR, exist_ok=True)

# Google Drive model URLs (not direct downloads)
MODELS = {
    "best.pt": "https://drive.google.com/uc?id=14-7ql-EW4-6trjB7lJRCmKRFtIXj_rk8",
    "yolov8n.pt": "https://drive.google.com/uc?id=111vAQgZKO2JkDt52lJIUwEijr6wXXODf"
}

def download_from_google_drive(url, destination):
    """Download large files from Google Drive (handles confirmation tokens)."""
    session = requests.Session()

    response = session.get(url, stream=True)
    token = None

    # Check for Google Drive confirmation token
    for key, val in response.cookies.items():
        if key.startswith("download_warning"):
            token = val
            break

    if token:
        response = session.get(url + "&confirm=" + token, stream=True)

    # Download file
    with open(destination, "wb") as f:
        for chunk in response.iter_content(32768):
            if chunk:
                f.write(chunk)

def ensure_models():
    """Ensures YOLO models exist. Downloads safely from Google Drive."""
    model_paths = {}

    for name, url in MODELS.items():
        model_path = os.path.join(MODEL_DIR, name)
        model_paths[name] = model_path

        # If missing or corrupted (< 1MB), re-download
        if not os.path.exists(model_path) or os.path.getsize(model_path) < 1000000:
            print(f"📥 Downloading {name} (Google Drive)...")

            try:
                download_from_google_drive(url, model_path)

                if os.path.getsize(model_path) < 1000000:
                    raise Exception("Downloaded file is too small (corrupted).")

                print(f"✅ {name} downloaded successfully!")

            except Exception as e:
                print(f"❌ Failed to download {name}: {e}")

        else:
            print(f"✅ {name} already exists locally: {model_path}")

    return model_paths
