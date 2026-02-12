import os
import sys
import traceback
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

# -------------------------------------------------------------------
# PATH FIXES
# -------------------------------------------------------------------
BASE = os.path.dirname(os.path.abspath(__file__))
FRONTEND = os.path.join(BASE, "frontend")
BACKEND = os.path.join(BASE, "backend")

# Ensure Python can import backend modules
sys.path.append(BASE)
sys.path.append(BACKEND)
sys.path.append(os.path.join(BACKEND, "utils"))

# -------------------------------------------------------------------
# LOAD PROCESSOR MODULES
# -------------------------------------------------------------------
try:
    from backend.utils.processor import process_single_image_bytes, process_zip_bytes
    BACKEND_OK = True
    print("✅ Backend processor loaded")
except Exception as e:
    BACKEND_OK = False
    print("❌ Backend processor load ERROR:", e)
    print(traceback.format_exc())

# -------------------------------------------------------------------
# FLASK APP SETUP
# -------------------------------------------------------------------
app = Flask(__name__, static_folder="frontend", static_url_path="")
CORS(app, origins="*")

# -------------------------------------------------------------------
# HEALTH CHECK
# -------------------------------------------------------------------
@app.route("/api/health")
def health():
    return jsonify({"status": "ok"}), 200

# -------------------------------------------------------------------
# SERVE FRONTEND FILES
# -------------------------------------------------------------------
@app.route("/")
def root():
    return send_from_directory(FRONTEND, "index.html")

@app.route("/<path:path>")
def serve_static(path):
    """
    This route handles all OTHER frontend files.
    Must avoid intercepting /api/* routes.
    """

    # ❌ Prevent frontend from catching API routes
    if path.startswith("api/"):
        return "Not Found", 404

    file_path = os.path.join(FRONTEND, path)

    if os.path.exists(file_path):
        return send_from_directory(FRONTEND, path)

    # fallback → SPA behavior
    return send_from_directory(FRONTEND, "index.html")

# -------------------------------------------------------------------
# API: SINGLE VERIFICATION
# -------------------------------------------------------------------
@app.route("/api/verify_single", methods=["POST"])
def verify_single():
    if not BACKEND_OK:
        return jsonify({"success": False, "error": "Backend not loaded"}), 500

    if "front" not in request.files:
        return jsonify({"success": False, "error": "front image required"}), 400

    try:
        front_bytes = request.files["front"].read()
        qr_flag = request.form.get("qr", "").lower() in ("1", "true", "yes")

        result = process_single_image_bytes(
            front_bytes=front_bytes,
            back_bytes=None,
            do_qr_check=qr_flag,
            device="cpu"
        )

        return jsonify({"success": True, "result": result})

    except Exception as e:
        print("❌ Single verification error:", e)
        print(traceback.format_exc())
        return jsonify({"success": False, "error": str(e)}), 500

# -------------------------------------------------------------------
# API: BATCH VERIFICATION
# -------------------------------------------------------------------
@app.route("/api/verify_batch", methods=["POST"])
def verify_batch():
    if not BACKEND_OK:
        return jsonify({"success": False, "error": "Backend not loaded"}), 500

    if "zip" not in request.files:
        return jsonify({"success": False, "error": "zip file required"}), 400

    try:
        zip_bytes = request.files["zip"].read()

        results = process_zip_bytes(
            zip_bytes,
            do_qr_check=False
        )

        return jsonify({"success": True, "results": results})

    except Exception as e:
        print("❌ Batch verification error:", e)
        print(traceback.format_exc())
        return jsonify({"success": False, "error": str(e)}), 500

# -------------------------------------------------------------------
# FLASK RUN (LOCAL ONLY)
# For Render → Gunicorn will run this module
# -------------------------------------------------------------------
if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    print(f"🚀 Running locally on http://127.0.0.1:{port}")
    app.run(host="0.0.0.0", port=port)
