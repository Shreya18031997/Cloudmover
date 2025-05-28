# backend/app/auth.py
from fastapi import APIRouter, Request
from fastapi.responses import RedirectResponse
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from app.config import CREDENTIALS_PATH, SCOPES, REDIRECT_URI
import os
from fastapi.responses import RedirectResponse, HTMLResponse  
import traceback
from google.oauth2 import id_token as google_id_token
from google.auth.transport import requests as google_requests

user_sessions = {}

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

    auth_url, _ = flow.authorization_url(prompt='consent',include_granted_scopes=False)
    # include_granted_scopes=False
    return RedirectResponse(auth_url)

@router.get("/auth/callback")
def google_callback(request: Request):
    full_url = str(request.url)

    flow = Flow.from_client_secrets_file(
        CREDENTIALS_PATH,
        scopes=SCOPES,
        redirect_uri=REDIRECT_URI
    )

    try:
        flow.fetch_token(authorization_response=full_url)
        credentials = flow.credentials

        access_token = credentials.token
        refresh_token = credentials.refresh_token
        request_adapter = google_requests.Request()
        id_info = google_id_token.verify_oauth2_token(
            credentials.id_token,
            request_adapter,
            credentials.client_id
        )
        email = id_info.get("email", "Unknown user")

        # Store credentials for this session (TEMPORARY)
        user_sessions[email] = credentials

        return HTMLResponse(
            content=f"""
            <h2>✅ Login Successful</h2>
            <p><strong>Email:</strong> {email}</p>
            <p><a href="/list-files?email={email}">📂 Click here to list your Drive files</a></p>
            """,
            status_code=200
        )
    except Exception as e:
        traceback.print_exc()
        return HTMLResponse(
            content=f"<h3>❌ Error: {e}</h3>",
            status_code=500
        )
    
@router.get("/list-files")
def list_drive_files(email: str):
    if email not in user_sessions:
        return {"error": "User not logged in or session expired"}

    credentials = user_sessions[email]

    # Build the Google Drive API client
    service = build("drive", "v3", credentials=credentials)

    # Fetch file list
    results = service.files().list(
        pageSize=10,
        fields="files(id, name, mimeType, size)"
    ).execute()

    files = results.get("files", [])
    return {"files": files}
    























