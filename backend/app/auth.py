from fastapi import APIRouter, Request, Query
from fastapi.responses import RedirectResponse, HTMLResponse
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from google.oauth2 import id_token as google_id_token
from google.auth.transport import requests as google_requests
from googleapiclient.http import MediaIoBaseDownload, MediaIoBaseUpload
from app.config import CREDENTIALS_PATH, SCOPES
import os
import traceback
import io

router = APIRouter()
user_sessions = {}

# Allow non-HTTPS for local testing
os.environ["OAUTHLIB_INSECURE_TRANSPORT"] = "1"

# General login (optional)
@router.get("/auth/google")
def login_via_google():
    flow = Flow.from_client_secrets_file(
        CREDENTIALS_PATH, scopes=SCOPES, redirect_uri="http://localhost:8000/auth/callback"
    )
    auth_url, _ = flow.authorization_url(prompt='consent')
    return RedirectResponse(auth_url)

@router.get("/auth/callback")
def google_callback(request: Request):
    full_url = str(request.url)
    flow = Flow.from_client_secrets_file(
        CREDENTIALS_PATH, scopes=SCOPES, redirect_uri="http://localhost:8000/auth/callback"
    )
    try:
        flow.fetch_token(authorization_response=full_url)
        credentials = flow.credentials
        request_adapter = google_requests.Request()
        id_info = google_id_token.verify_oauth2_token(
            credentials.id_token, request_adapter, credentials.client_id
        )
        email = id_info.get("email", "unknown").lower()
        user_sessions[email] = credentials

        print("✅ General login:", email)
        print("🧠 Sessions:", list(user_sessions.keys()))

        return HTMLResponse(content=f"<h2>✅ Login Successful</h2><p>Email: {email}</p>", status_code=200)
    except Exception as e:
        traceback.print_exc()
        return HTMLResponse(content=f"<h3>❌ Error: {e}</h3>", status_code=500)

# Source login
@router.get("/auth/source")
def login_source():
    flow = Flow.from_client_secrets_file(
        CREDENTIALS_PATH, scopes=SCOPES, redirect_uri="http://localhost:8000/auth/source/callback"
    )
    auth_url, _ = flow.authorization_url(prompt='consent')
    return RedirectResponse(auth_url)

@router.get("/auth/source/callback")
def source_callback(request: Request):
    full_url = str(request.url)
    flow = Flow.from_client_secrets_file(
        CREDENTIALS_PATH, scopes=SCOPES, redirect_uri="http://localhost:8000/auth/source/callback"
    )
    flow.fetch_token(authorization_response=full_url)
    credentials = flow.credentials
    request_adapter = google_requests.Request()
    id_info = google_id_token.verify_oauth2_token(
        credentials.id_token, request_adapter, credentials.client_id
    )
    email = id_info.get("email", "unknown").lower()
    user_sessions["source"] = credentials
    print("✅ Source connected:", email)
    print("🧠 Sessions:", list(user_sessions.keys()))
    return RedirectResponse(f"http://localhost:3000/dashboard?source=source")

# Destination login
@router.get("/auth/destination")
def login_destination():
    flow = Flow.from_client_secrets_file(
        CREDENTIALS_PATH,
        scopes=SCOPES,
        redirect_uri="http://localhost:8000/auth/destination/callback"
    )
    auth_url, _ = flow.authorization_url(
        prompt='consent',
        include_granted_scopes=False
    )
    return RedirectResponse(auth_url)

@router.get("/auth/destination/callback")
def destination_callback(request: Request):
    full_url = str(request.url)
    flow = Flow.from_client_secrets_file(
        CREDENTIALS_PATH, scopes=SCOPES, redirect_uri="http://localhost:8000/auth/destination/callback"
    )
    flow.fetch_token(authorization_response=full_url)
    credentials = flow.credentials
    request_adapter = google_requests.Request()
    id_info = google_id_token.verify_oauth2_token(
        credentials.id_token, request_adapter, credentials.client_id
    )
    email = id_info.get("email", "unknown").lower()
    user_sessions["destination"] = credentials
    print("✅ Destination connected:", email)
    print("🧠 Sessions:", list(user_sessions.keys()))
    return RedirectResponse(f"http://localhost:3000/dashboard?destination=destination")

# List files for a given user
@router.get("/list-files")
def list_drive_files(email: str):
    print("📥 Listing files for:", email)
    print("🧠 Stored sessions:", list(user_sessions.keys()))
    credentials = user_sessions.get(email)
    if not credentials:
        print("❌ Session not found")
        return {"error": "User not logged in or session expired"}

    try:
        service = build("drive", "v3", credentials=credentials)
        results = service.files().list(
            q="trashed = false",  # ✅ Only list active files
            pageSize=10,
            fields="files(id, name, mimeType, size)"
        ).execute()
        files = results.get("files", [])
        print("✅ Found", len(files), "files")
        for f in files:
            print(f"📄 {f['name']} | ID: {f['id']}")
        return {"files": files}
    except Exception as e:
        print("❌ Error:", e)
        return {"error": str(e)}

# Transfer file with optional delete
@router.post("/transfer-file")
def transfer_file(
    file_id: str = Query(...),
    folder_id: str = Query(None),
    delete_source: bool = Query(False)
):
    print(f"🔄 Transferring file: {file_id} to folder: {folder_id} | Delete after transfer: {delete_source}")
    
    if "source" not in user_sessions or "destination" not in user_sessions:
        return {"error": "Source or destination account not logged in"}

    source_creds = user_sessions["source"]
    dest_creds = user_sessions["destination"]

    try:
        source_service = build("drive", "v3", credentials=source_creds)
        dest_service = build("drive", "v3", credentials=dest_creds)

        file_metadata = source_service.files().get(fileId=file_id, fields="name, mimeType").execute()
        file_name = file_metadata["name"]
        mime_type = file_metadata["mimeType"]

        # Handle export for Google Docs formats
        export_mime_types = {
            "application/vnd.google-apps.document": "application/pdf",
            "application/vnd.google-apps.spreadsheet": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "application/vnd.google-apps.presentation": "application/pdf"
        }

        fh = io.BytesIO()
        if mime_type in export_mime_types:
            export_mime = export_mime_types[mime_type]
            request = source_service.files().export_media(fileId=file_id, mimeType=export_mime)
            file_name += get_file_extension(export_mime)
        else:
            request = source_service.files().get_media(fileId=file_id)

        downloader = MediaIoBaseDownload(fh, request)
        done = False
        while not done:
            status, done = downloader.next_chunk()

        fh.seek(0)

        body = {"name": file_name}
        if folder_id:
            body["parents"] = [folder_id]

        media = MediaIoBaseUpload(fh, mimetype=mime_type, resumable=True)
        dest_service.files().create(body=body, media_body=media).execute()

        # ✅ Optional deletion
        if delete_source:
            source_service.files().delete(fileId=file_id).execute()
            print(f"🗑️ Deleted source file: {file_name}")

        print(f"✅ File '{file_name}' transferred successfully")
        return {"message": f"✅ File '{file_name}' transferred successfully"}

    except Exception as e:
        print("❌ Transfer error:", e)
        return {"error": str(e)}

# Helper for file extensions
def get_file_extension(mime_type):
    ext_map = {
        "application/pdf": ".pdf",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx"
    }
    return ext_map.get(mime_type, "")

# List folders in destination Drive
@router.get("/list-folders")
def list_destination_folders():
    if "destination" not in user_sessions:
        return {"error": "Destination account not connected"}

    creds = user_sessions["destination"]
    try:
        service = build("drive", "v3", credentials=creds)
        results = service.files().list(
            q="mimeType = 'application/vnd.google-apps.folder' and trashed = false",
            fields="files(id, name)",
            pageSize=100
        ).execute()
        folders = results.get("files", [])
        return {"folders": folders}
    except Exception as e:
        print("❌ Error listing folders:", e)
        return {"error": str(e)}