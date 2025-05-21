# backend/app/auth.py
from fastapi import APIRouter, Request
from fastapi.responses import RedirectResponse
from google_auth_oauthlib.flow import Flow
from app.config import CREDENTIALS_PATH, SCOPES, REDIRECT_URI
import os

router = APIRouter()

# Allow non-HTTPS for testing locally
os.environ["OAUTHLIB_INSECURE_TRANSPORT"] = "1"

@router.get("/auth/google")
def login_via_google():
    flow = Flow.from_client_secrets_file(
        CREDENTIALS_PATH,
        scopes=SCOPES,
        redirect_uri=REDIRECT_URI
    )

    auth_url, _ = flow.authorization_url(prompt='consent')
    return RedirectResponse(auth_url)


@router.get("/auth/callback")
def google_callback(request: Request):
    return {"message": "Google login successful! (you'll process tokens here later)"}
