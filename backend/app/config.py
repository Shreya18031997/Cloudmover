# backend/app/config.py
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
CREDENTIALS_PATH = BASE_DIR / "credentials.json"

SCOPES = ["https://www.googleapis.com/auth/drive"]
REDIRECT_URI = "http://localhost:8000/auth/callback"