from fastapi import APIRouter, Request, Query, UploadFile, File
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
import json
import numpy as np
import face_recognition
import shutil

router = APIRouter()
user_sessions = {}

os.environ["OAUTHLIB_INSECURE_TRANSPORT"] = "1"

# ----------------------------
# Google OAuth Routes
# ----------------------------

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
        return HTMLResponse(content=f"<h2>✅ Login Successful</h2><p>Email: {email}</p>", status_code=200)
    except Exception as e:
        traceback.print_exc()
        return HTMLResponse(content=f"<h3>❌ Error: {e}</h3>", status_code=500)

# ----------------------------
# Source and Destination Drive OAuth
# ----------------------------

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
    return RedirectResponse("http://localhost:3000/dashboard?source=source")

@router.get("/auth/destination")
def login_destination():
    flow = Flow.from_client_secrets_file(
        CREDENTIALS_PATH, scopes=SCOPES, redirect_uri="http://localhost:8000/auth/destination/callback"
    )
    auth_url, _ = flow.authorization_url(prompt='consent', include_granted_scopes=False)
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
    return RedirectResponse("http://localhost:3000/dashboard?destination=destination")

# ----------------------------
# Drive file and folder APIs
# ----------------------------

@router.get("/list-files")
def list_drive_files(email: str):
    credentials = user_sessions.get(email)
    if not credentials:
        return {"error": "User not logged in or session expired"}

    try:
        service = build("drive", "v3", credentials=credentials)
        results = service.files().list(
            q="trashed = false",
            pageSize=10,
            fields="files(id, name, mimeType, size)"
        ).execute()
        return {"files": results.get("files", [])}
    except Exception as e:
        return {"error": str(e)}

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
        return {"folders": results.get("files", [])}
    except Exception as e:
        return {"error": str(e)}

@router.post("/transfer-file")
def transfer_file(file_id: str = Query(...), folder_id: str = Query(None), delete_source: bool = Query(False)):
    if "source" not in user_sessions or "destination" not in user_sessions:
        return {"error": "Source or destination not connected"}

    try:
        source = build("drive", "v3", credentials=user_sessions["source"])
        dest = build("drive", "v3", credentials=user_sessions["destination"])
        meta = source.files().get(fileId=file_id, fields="name, mimeType").execute()

        file_name = meta["name"]
        mime_type = meta["mimeType"]

        export_types = {
            "application/vnd.google-apps.document": "application/pdf",
            "application/vnd.google-apps.spreadsheet": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "application/vnd.google-apps.presentation": "application/pdf"
        }

        fh = io.BytesIO()
        if mime_type in export_types:
            request = source.files().export_media(fileId=file_id, mimeType=export_types[mime_type])
            file_name += get_file_extension(export_types[mime_type])
        else:
            request = source.files().get_media(fileId=file_id)

        downloader = MediaIoBaseDownload(fh, request)
        done = False
        while not done:
            status, done = downloader.next_chunk()
        fh.seek(0)

        body = {"name": file_name}
        if folder_id:
            body["parents"] = [folder_id]

        media = MediaIoBaseUpload(fh, mimetype=mime_type, resumable=True)
        dest.files().create(body=body, media_body=media).execute()

        if delete_source:
            source.files().delete(fileId=file_id).execute()

        return {"message": f"✅ File '{file_name}' transferred."}
    except Exception as e:
        return {"error": str(e)}

def get_file_extension(mime_type):
    ext_map = {
        "application/pdf": ".pdf",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx"
    }
    return ext_map.get(mime_type, "")

# ----------------------------
# Face Matching Endpoint
# ----------------------------

@router.post("/match-face")
async def match_face(file: UploadFile = File(...), threshold: float = 0.6):
    temp_path = "temp_uploaded.jpg"
    with open(temp_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    if not os.path.exists("known_faces.json"):
        return {"error": "No known faces to compare with."}

    with open("known_faces.json", "r") as f:
        known_faces = json.load(f)

    known_encodings = [np.array(face["encoding"]) for face in known_faces]
    known_names = [face["name"] for face in known_faces]

    image = face_recognition.load_image_file(temp_path)
    new_encodings = face_recognition.face_encodings(image)

    os.remove(temp_path)

    if not new_encodings:
        return {"match": None, "message": "No face found in uploaded image."}

    new_encoding = new_encodings[0]
    distances = face_recognition.face_distance(known_encodings, new_encoding)
    best_index = np.argmin(distances)

    if distances[best_index] <= threshold:
        return {
            "match": known_names[best_index],
            "distance": float(distances[best_index])
        }
    else:
        return {"match": None, "message": "No match found."}

@router.get("/search-images")
def search_images(name: str):
    if not os.path.exists("tagged_faces.json"):
        return {"images": []}

    with open("tagged_faces.json", "r") as f:
        records = json.load(f)

    matches = [r["filename"] for r in records if r["matched_name"].lower() == name.lower()]
    return {"images": matches}