"""
SAHAYAK — Hugging Face Native Space Entrypoint (No Docker Required)
Launches FastAPI backend + static React frontend on Port 7860
"""

import os
import sys
import uvicorn

# Add backend directory to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "backend"))

from backend.ml.train_susceptibility_model import train_and_save_model
from backend.main import app

if __name__ == "__main__":
    print("[SAHAYAK Cloud] Verifying / Training ML susceptibility models...")
    try:
        train_and_save_model()
    except Exception as e:
        print(f"[SAHAYAK Cloud] Training notice: {e}")

    port = int(os.environ.get("PORT", 7860))
    print(f"[SAHAYAK Cloud] Launching SAHAYAK Mission Control on port {port}...")
    uvicorn.run(app, host="0.0.0.0", port=port)
