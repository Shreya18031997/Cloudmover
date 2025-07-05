from fastapi import APIRouter, Request, Query, UploadFile, File, Header
from fastapi.responses import RedirectResponse, HTMLResponse
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from google.oauth2 import id_token as google_id_token
from google.auth.transport import requests as google_requests
from googleapiclient.http import MediaIoBaseDownload, MediaIoBaseUpload
from app.config import CREDENTIALS_PATH, SCOPES
from app.redis_client import redis_client
import os
import traceback
import io
import json
import numpy as np
import face_recognition
import shutil
import time
import logging
from typing import Optional
from datetime import datetime
from google.auth import exceptions as google_exceptions

router = APIRouter()

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def verify_token_with_retry(id_token: str, client_id: str, max_retries: int = 3, delay: float = 1.0) -> dict:
    """
    Verify Google ID token with retry logic and clock skew tolerance.
    
    Args:
        id_token: The ID token to verify
        client_id: The OAuth client ID
        max_retries: Maximum number of retry attempts
        delay: Delay between retries in seconds
        
    Returns:
        dict: Token payload if verification succeeds
        
    Raises:
        Exception: If verification fails after all retries
    """
    for attempt in range(max_retries):
        try:
            # Add clock skew tolerance (up to 60 seconds)
            request = google_requests.Request()
            payload = google_id_token.verify_oauth2_token(
                id_token, 
                request,
                client_id,
                clock_skew_in_seconds=60  # Allow 60 seconds of clock skew
            )
            logger.info(f"Token verification successful on attempt {attempt + 1}")
            return payload
            
        except Exception as e:
            error_msg = str(e)
            logger.warning(f"Token verification attempt {attempt + 1} failed: {error_msg}")
            
            if "Token used too early" in error_msg or "Clock skew" in error_msg:
                if attempt < max_retries - 1:
                    logger.info(f"Retrying in {delay} seconds due to clock skew...")
                    time.sleep(delay)
                    continue
            
            # If it's not a clock skew issue or we've exhausted retries, re-raise
            if attempt == max_retries - 1:
                logger.error(f"Token verification failed after {max_retries} attempts: {error_msg}")
                raise e
    
    # Should never reach here, but just in case
    raise Exception("Token verification failed after all retry attempts")

os.environ["OAUTHLIB_INSECURE_TRANSPORT"] = "1"

# ----------------------------
# Google OAuth Routes
# ----------------------------
#add here health check endpoint
@router.get("/health")
def health_check():
    return {"status": "ok"}

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
        
        # Use robust token verification with retry logic
        if credentials.id_token:
            try:
                id_info = verify_token_with_retry(credentials.id_token, credentials.client_id)
                email = id_info.get("email", "unknown").lower()
                logger.info(f"ID token verified for general user: {email}")
            except Exception as e:
                logger.error(f"ID token verification failed: {str(e)}")
                return HTMLResponse(
                    content=f"<html><body><h1>Authentication Error</h1><p>Token verification failed: {str(e)}</p></body></html>",
                    status_code=400
                )
        
        # Store credentials in Redis using generated token
        token = redis_client.store_credentials(credentials, "general")
        
        return HTMLResponse(content=f"<h2>✅ Login Successful</h2><p>Email: {email}</p><p>Token: {token}</p>", status_code=200)
    except Exception as e:
        logger.error(f"Error in google_callback: {e}")
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
    """Handle Google OAuth callback for source account with robust token verification."""
    try:
        logger.info("Processing Google OAuth callback for source account")
        
        full_url = str(request.url)
        flow = Flow.from_client_secrets_file(
            CREDENTIALS_PATH, scopes=SCOPES, redirect_uri="http://localhost:8000/auth/source/callback"
        )
        
        flow.fetch_token(authorization_response=full_url)
        credentials = flow.credentials
        
        # Verify ID token with retry logic and clock skew tolerance
        if credentials.id_token:
            try:
                payload = verify_token_with_retry(credentials.id_token, credentials.client_id)
                email = payload.get('email', 'unknown')
                logger.info(f"ID token verified for source user: {email}")
            except Exception as e:
                logger.error(f"ID token verification failed: {str(e)}")
                return HTMLResponse(
                    content=f"<html><body><h1>Authentication Error</h1><p>Token verification failed: {str(e)}</p></body></html>",
                    status_code=400
                )
        
        # Store credentials in Redis
        token = redis_client.store_credentials(credentials, "source")
        
        logger.info(f"Source credentials stored with token: {token}")
        
        # Redirect to frontend with token
        frontend_redirect = f"http://localhost:3000/dashboard?type=source&token={token}"
        return RedirectResponse(frontend_redirect)
        
    except Exception as e:
        logger.error(f"Error in source_callback: {e}")
        logger.error(traceback.format_exc())
        return HTMLResponse(content=f"<h3>❌ OAuth Error: {e}</h3>", status_code=500)

@router.get("/auth/destination")
def login_destination():
    flow = Flow.from_client_secrets_file(
        CREDENTIALS_PATH, scopes=SCOPES, redirect_uri="http://localhost:8000/auth/destination/callback"
    )
    auth_url, _ = flow.authorization_url(prompt='consent', include_granted_scopes=False)
    return RedirectResponse(auth_url)

@router.get("/auth/destination/callback")
def destination_callback(request: Request):
    """Handle Google OAuth callback for destination account with robust token verification."""
    try:
        logger.info("Processing Google OAuth callback for destination account")
        
        full_url = str(request.url)
        flow = Flow.from_client_secrets_file(
            CREDENTIALS_PATH, scopes=SCOPES, redirect_uri="http://localhost:8000/auth/destination/callback"
        )
        
        flow.fetch_token(authorization_response=full_url)
        credentials = flow.credentials
        
        # Verify ID token with retry logic and clock skew tolerance
        if credentials.id_token:
            try:
                payload = verify_token_with_retry(credentials.id_token, credentials.client_id)
                email = payload.get('email', 'unknown')
                logger.info(f"ID token verified for destination user: {email}")
            except Exception as e:
                logger.error(f"ID token verification failed: {str(e)}")
                return HTMLResponse(
                    content=f"<html><body><h1>Authentication Error</h1><p>Token verification failed: {str(e)}</p></body></html>",
                    status_code=400
                )
        
        # Store credentials in Redis
        token = redis_client.store_credentials(credentials, "destination")
        
        logger.info(f"Destination credentials stored with token: {token}")
        
        # Redirect to frontend with token
        frontend_redirect = f"http://localhost:3000/dashboard?type=destination&token={token}"
        return RedirectResponse(frontend_redirect)
        
    except Exception as e:
        logger.error(f"Error in destination_callback: {e}")
        logger.error(traceback.format_exc())
        return HTMLResponse(content=f"<h3>❌ OAuth Error: {e}</h3>", status_code=500)

# ----------------------------
# Drive file and folder APIs
# ----------------------------
@router.get("/list-files")
def list_drive_files(
    token: str = Query(...), 
    page_token: Optional[str] = Query(None, description="Token for pagination - get this from previous response's nextPageToken"), 
    page_size: int = Query(10, ge=1, le=1000, description="Number of files per page (1-1000)"),
    search_query: Optional[str] = Query(None, description="Search query to filter files")
):
    """
    List files from Google Drive with pagination support.
    
    Returns:
    - files: List of file objects
    - nextPageToken: Token for next page (null if no more pages)
    - totalFiles: Total number of files found (approximate)
    """
    credentials = redis_client.get_credentials_by_token(token)
    if not credentials:
        return {"error": "Invalid token or session expired"}

    try:
        service = build("drive", "v3", credentials=credentials)
        
        # Build query
        query = "trashed = false"
        if search_query:
            # Add search functionality - searches in name and content
            query += f" and (name contains '{search_query}' or fullText contains '{search_query}')"
        
        # Make the API request
        results = service.files().list(
            q=query,
            pageSize=page_size,
            pageToken=page_token,
            fields="nextPageToken, files(id, name, mimeType, size, modifiedTime, createdTime, parents, webViewLink)",
            orderBy="modifiedTime desc"  # Most recently modified first
        ).execute()
        
        files = results.get("files", [])
        next_page_token = results.get("nextPageToken")
        
        # Format file sizes for better readability
        for file in files:
            if file.get("size"):
                file["sizeFormatted"] = format_file_size(int(file["size"]))
            else:
                file["sizeFormatted"] = "N/A"
                
        return {
            "files": files,
            "nextPageToken": next_page_token,
            "hasMorePages": next_page_token is not None,
            "pageSize": page_size,
            "searchQuery": search_query,
            "totalFilesInPage": len(files)
        }
    except Exception as e:
        logger.error(f"Error in list_drive_files: {e}")
        return {"error": str(e)}

@router.get("/list-folders")
def list_destination_folders(
    token: str = Query(...), 
    page_token: Optional[str] = Query(None, description="Token for pagination"), 
    page_size: int = Query(100, ge=1, le=1000, description="Number of folders per page (1-1000)"),
    search_query: Optional[str] = Query(None, description="Search query to filter folders by name")
):
    """
    List folders from Google Drive with pagination support.
    
    Returns:
    - folders: List of folder objects  
    - nextPageToken: Token for next page (null if no more pages)
    - hasMorePages: Boolean indicating if more pages exist
    """
    credentials = redis_client.get_credentials_by_token(token)
    if not credentials:
        return {"error": "Invalid token or session expired"}

    try:
        service = build("drive", "v3", credentials=credentials)
        
        # Build query for folders only
        query = "mimeType = 'application/vnd.google-apps.folder' and trashed = false"
        if search_query:
            query += f" and name contains '{search_query}'"
        
        results = service.files().list(
            q=query,
            pageSize=page_size,
            pageToken=page_token,
            fields="nextPageToken, files(id, name, createdTime, modifiedTime, parents)",
            orderBy="name"  # Alphabetical order for folders
        ).execute()
        
        folders = results.get("files", [])
        next_page_token = results.get("nextPageToken")
        
        return {
            "folders": folders,
            "nextPageToken": next_page_token,
            "hasMorePages": next_page_token is not None,
            "pageSize": page_size,
            "searchQuery": search_query,
            "totalFoldersInPage": len(folders)
        }
    except Exception as e:
        logger.error(f"Error in list_destination_folders: {e}")
        return {"error": str(e)}

@router.get("/list-files-advanced")
def list_drive_files_advanced(
    token: str = Query(...),
    page_token: Optional[str] = Query(None),
    page_size: int = Query(10, ge=1, le=1000),
    search_query: Optional[str] = Query(None),
    mime_type_filter: Optional[str] = Query(None, description="Filter by MIME type (e.g., 'image/jpeg', 'application/pdf')"),
    folder_id: Optional[str] = Query(None, description="List files in specific folder"),
    order_by: str = Query("modifiedTime desc", description="Sort order: 'name', 'modifiedTime desc', 'createdTime desc', 'size desc'")
):
    """
    Advanced file listing with multiple filters and sorting options.
    """
    credentials = redis_client.get_credentials_by_token(token)
    if not credentials:
        return {"error": "Invalid token or session expired"}

    try:
        service = build("drive", "v3", credentials=credentials)
        
        # Build complex query
        query_parts = ["trashed = false"]
        
        if search_query:
            query_parts.append(f"(name contains '{search_query}' or fullText contains '{search_query}')")
        
        if mime_type_filter:
            query_parts.append(f"mimeType = '{mime_type_filter}'")
            
        if folder_id:
            query_parts.append(f"'{folder_id}' in parents")
        
        query = " and ".join(query_parts)
        
        # Validate order_by parameter
        valid_orders = ["name", "modifiedTime desc", "createdTime desc", "size desc", "name desc"]
        if order_by not in valid_orders:
            order_by = "modifiedTime desc"
        
        results = service.files().list(
            q=query,
            pageSize=page_size,
            pageToken=page_token,
            fields="nextPageToken, files(id, name, mimeType, size, modifiedTime, createdTime, parents, webViewLink, thumbnailLink)",
            orderBy=order_by
        ).execute()
        
        files = results.get("files", [])
        next_page_token = results.get("nextPageToken")
        
        # Add formatted file sizes and type categorization
        for file in files:
            if file.get("size"):
                file["sizeFormatted"] = format_file_size(int(file["size"]))
            else:
                file["sizeFormatted"] = "N/A"
            
            # Add file type category
            file["category"] = categorize_file_type(file.get("mimeType", ""))
                
        return {
            "files": files,
            "nextPageToken": next_page_token,
            "hasMorePages": next_page_token is not None,
            "pageSize": page_size,
            "filters": {
                "searchQuery": search_query,
                "mimeTypeFilter": mime_type_filter,
                "folderId": folder_id,
                "orderBy": order_by
            },
            "totalFilesInPage": len(files)
        }
    except Exception as e:
        logger.error(f"Error in list_drive_files_advanced: {e}")
        return {"error": str(e)}

@router.get("/list-folder-contents")
def list_folder_contents(
    token: str = Query(...),
    folder_id: str = Query(..., description="ID of the folder to list contents from"),
    page_token: Optional[str] = Query(None, description="Token for pagination"),
    page_size: int = Query(50, ge=1, le=1000, description="Number of items per page (1-1000)"),
    search_query: Optional[str] = Query(None, description="Search query to filter items within folder"),
    include_folders: bool = Query(True, description="Include subfolders in results"),
    include_files: bool = Query(True, description="Include files in results"),
    order_by: str = Query("name", description="Sort order: 'name', 'modifiedTime desc', 'createdTime desc', 'size desc'")
):
    """
    Get all contents (files and folders) within a specific folder with pagination.
    
    Returns:
    - items: List of files and folders in the specified folder
    - nextPageToken: Token for next page
    - folderInfo: Information about the parent folder
    - summary: Count of files and folders
    """
    credentials = redis_client.get_credentials_by_token(token)
    if not credentials:
        return {"error": "Invalid token or session expired"}

    try:
        service = build("drive", "v3", credentials=credentials)
        
        # First, get information about the folder itself
        try:
            folder_info = service.files().get(
                fileId=folder_id,
                fields="id, name, mimeType, createdTime, modifiedTime, parents"
            ).execute()
            
            # Verify it's actually a folder
            if folder_info.get("mimeType") != "application/vnd.google-apps.folder":
                return {"error": "Specified ID is not a folder"}
                
        except Exception as e:
            return {"error": f"Could not access folder: {str(e)}"}
        
        # Build query for folder contents
        query_parts = [f"'{folder_id}' in parents", "trashed = false"]
        
        # Add file/folder type filters
        if not include_files and include_folders:
            query_parts.append("mimeType = 'application/vnd.google-apps.folder'")
        elif include_files and not include_folders:
            query_parts.append("mimeType != 'application/vnd.google-apps.folder'")
        # If both are true, no additional filter needed
        # If both are false, we'll return empty results
        
        if search_query:
            query_parts.append(f"name contains '{search_query}'")
        
        query = " and ".join(query_parts)
        
        # Validate order_by parameter
        valid_orders = ["name", "modifiedTime desc", "createdTime desc", "size desc", "name desc", "folder"]
        if order_by not in valid_orders:
            order_by = "name"
        
        # Special handling for folder-first sorting
        if order_by == "folder":
            order_by = "folder,name"
        
        # If neither files nor folders are included, return empty results
        if not include_files and not include_folders:
            return {
                "items": [],
                "nextPageToken": None,
                "hasMorePages": False,
                "folderInfo": folder_info,
                "summary": {"totalFiles": 0, "totalFolders": 0, "totalItemsInPage": 0},
                "pageSize": page_size,
                "filters": {
                    "searchQuery": search_query,
                    "includeFiles": include_files,
                    "includeFolders": include_folders,
                    "orderBy": order_by
                }
            }
        
        results = service.files().list(
            q=query,
            pageSize=page_size,
            pageToken=page_token,
            fields="nextPageToken, files(id, name, mimeType, size, modifiedTime, createdTime, parents, webViewLink, thumbnailLink)",
            orderBy=order_by
        ).execute()
        
        items = results.get("files", [])
        next_page_token = results.get("nextPageToken")
        
        # Process items and add additional metadata
        file_count = 0
        folder_count = 0
        
        for item in items:
            # Add formatted file size
            if item.get("size"):
                item["sizeFormatted"] = format_file_size(int(item["size"]))
            else:
                item["sizeFormatted"] = "N/A"
            
            # Add file type category
            item["category"] = categorize_file_type(item.get("mimeType", ""))
            
            # Add item type flag
            if item.get("mimeType") == "application/vnd.google-apps.folder":
                item["isFolder"] = True
                folder_count += 1
            else:
                item["isFolder"] = False
                file_count += 1
        
        # Sort folders first if requested
        if order_by == "folder,name":
            items.sort(key=lambda x: (not x.get("isFolder", False), x.get("name", "").lower()))
        
        return {
            "items": items,
            "nextPageToken": next_page_token,
            "hasMorePages": next_page_token is not None,
            "folderInfo": {
                "id": folder_info["id"],
                "name": folder_info["name"],
                "createdTime": folder_info.get("createdTime"),
                "modifiedTime": folder_info.get("modifiedTime"),
                "parents": folder_info.get("parents", [])
            },
            "summary": {
                "totalFiles": file_count,
                "totalFolders": folder_count,
                "totalItemsInPage": len(items)
            },
            "pageSize": page_size,
            "filters": {
                "searchQuery": search_query,
                "includeFiles": include_files,
                "includeFolders": include_folders,
                "orderBy": order_by
            }
        }
    except Exception as e:
        logger.error(f"Error in list_folder_contents: {e}")
        return {"error": str(e)}

@router.get("/list-folder-contents-recursive")
def list_folder_contents_recursive(
    token: str = Query(...),
    folder_id: str = Query(..., description="ID of the folder to recursively list contents from"),
    max_depth: int = Query(3, ge=1, le=10, description="Maximum depth to recurse (1-10)"),
    files_only: bool = Query(False, description="Return only files, exclude folders from results"),
    file_types: Optional[str] = Query(None, description="Comma-separated list of file categories to include (e.g., 'document,image,video')")
):
    """
    Recursively get all files within a folder and its subfolders.
    
    Warning: This can be slow for large folder structures. Use with caution.
    
    Returns:
    - files: List of all files found recursively
    - folderStructure: Hierarchical structure of folders
    - summary: Statistics about the scan
    """
    credentials = redis_client.get_credentials_by_token(token)
    if not credentials:
        return {"error": "Invalid token or session expired"}

    try:
        service = build("drive", "v3", credentials=credentials)
        
        # Verify the root folder exists
        try:
            root_folder = service.files().get(
                fileId=folder_id,
                fields="id, name, mimeType"
            ).execute()
            
            if root_folder.get("mimeType") != "application/vnd.google-apps.folder":
                return {"error": "Specified ID is not a folder"}
                
        except Exception as e:
            return {"error": f"Could not access folder: {str(e)}"}
        
        # Parse file type filters
        allowed_categories = None
        if file_types:
            allowed_categories = [cat.strip().lower() for cat in file_types.split(",")]
        
        all_files = []
        folder_structure = []
        total_folders_scanned = 0
        total_files_found = 0
        
        def scan_folder_recursive(current_folder_id, current_path="", depth=0):
            nonlocal total_folders_scanned, total_files_found
            
            if depth >= max_depth:
                return
            
            total_folders_scanned += 1
            
            # Get all items in current folder
            try:
                results = service.files().list(
                    q=f"'{current_folder_id}' in parents and trashed = false",
                    fields="files(id, name, mimeType, size, modifiedTime, createdTime, parents, webViewLink)",
                    pageSize=1000  # Get as many as possible in one request
                ).execute()
                
                items = results.get("files", [])
                folder_files = []
                subfolders = []
                
                for item in items:
                    if item.get("mimeType") == "application/vnd.google-apps.folder":
                        # It's a subfolder
                        subfolder_info = {
                            "id": item["id"],
                            "name": item["name"],
                            "path": f"{current_path}/{item['name']}" if current_path else item["name"]
                        }
                        subfolders.append(subfolder_info)
                        
                        # Recursively scan subfolder
                        scan_folder_recursive(
                            item["id"], 
                            subfolder_info["path"], 
                            depth + 1
                        )
                    else:
                        # It's a file
                        total_files_found += 1
                        
                        # Add file metadata
                        file_info = {
                            "id": item["id"],
                            "name": item["name"],
                            "mimeType": item.get("mimeType", ""),
                            "size": item.get("size"),
                            "modifiedTime": item.get("modifiedTime"),
                            "createdTime": item.get("createdTime"),
                            "webViewLink": item.get("webViewLink"),
                            "path": f"{current_path}/{item['name']}" if current_path else item["name"],
                            "parentFolderId": current_folder_id
                        }
                        
                        # Add formatted size and category
                        if file_info.get("size"):
                            file_info["sizeFormatted"] = format_file_size(int(file_info["size"]))
                        else:
                            file_info["sizeFormatted"] = "N/A"
                        
                        file_info["category"] = categorize_file_type(file_info["mimeType"])
                        
                        # Apply file type filter if specified
                        if allowed_categories is None or file_info["category"] in allowed_categories:
                            folder_files.append(file_info)
                            all_files.append(file_info)
                
                # Add folder to structure (unless files_only is True)
                if not files_only:
                    folder_structure.append({
                        "id": current_folder_id,
                        "path": current_path or "/",
                        "files": folder_files,
                        "subfolders": subfolders,
                        "fileCount": len(folder_files),
                        "subfolderCount": len(subfolders)
                    })
                    
            except Exception as e:
                logger.error(f"Error scanning folder {current_folder_id}: {e}")
                return
        
        # Start recursive scan
        scan_folder_recursive(folder_id, root_folder["name"])
        
        # Sort files by path for better organization
        all_files.sort(key=lambda x: x.get("path", "").lower())
        
        return {
            "files": all_files,
            "folderStructure": folder_structure if not files_only else [],
            "rootFolder": {
                "id": root_folder["id"],
                "name": root_folder["name"]
            },
            "summary": {
                "totalFiles": len(all_files),
                "totalFoldersScanned": total_folders_scanned,
                "maxDepthReached": max_depth,
                "filesOnly": files_only,
                "fileTypeFilter": file_types
            },
            "filters": {
                "maxDepth": max_depth,
                "filesOnly": files_only,
                "allowedCategories": allowed_categories
            }
        }
        
    except Exception as e:
        logger.error(f"Error in list_folder_contents_recursive: {e}")
        return {"error": str(e)}

@router.get("/get-folder-path")
def get_folder_path(
    token: str = Query(...),
    folder_id: str = Query(..., description="ID of the folder to get path for")
):
    """
    Get the full path (breadcrumbs) for a folder by traversing up to the root.
    
    Returns:
    - path: Array of folder objects from root to the specified folder
    - fullPath: Human-readable full path string
    """
    credentials = redis_client.get_credentials_by_token(token)
    if not credentials:
        return {"error": "Invalid token or session expired"}

    try:
        service = build("drive", "v3", credentials=credentials)
        
        path = []
        current_id = folder_id
        
        # Traverse up the folder hierarchy
        while current_id:
            try:
                folder = service.files().get(
                    fileId=current_id,
                    fields="id, name, mimeType, parents"
                ).execute()
                
                # Verify it's a folder
                if folder.get("mimeType") != "application/vnd.google-apps.folder":
                    if len(path) == 0:  # This is the original requested item
                        return {"error": "Specified ID is not a folder"}
                    else:
                        break  # We've reached a non-folder parent, stop here
                
                # Add to path (we'll reverse it later)
                path.insert(0, {
                    "id": folder["id"],
                    "name": folder["name"]
                })
                
                # Move to parent folder
                parents = folder.get("parents", [])
                if parents:
                    current_id = parents[0]  # Google Drive items typically have one parent
                else:
                    # Reached root (My Drive)
                    break
                    
            except Exception as e:
                # If we can't access a parent folder, stop traversal
                logger.warning(f"Could not access folder {current_id}: {e}")
                break
        
        # Create full path string
        if path:
            full_path = " / ".join([folder["name"] for folder in path])
        else:
            full_path = "Unknown"
        
        return {
            "path": path,
            "fullPath": full_path,
            "folderId": folder_id,
            "depth": len(path)
        }
        
    except Exception as e:
        logger.error(f"Error in get_folder_path: {e}")
        return {"error": str(e)}

@router.post("/transfer-file")
def transfer_file(
    file_id: str = Query(...), 
    folder_id: str = Query(None), 
    delete_source: bool = Query(False),
    source_token: str = Query(...),
    dest_token: str = Query(...)
):
    source_credentials = redis_client.get_credentials_by_token(source_token)
    dest_credentials = redis_client.get_credentials_by_token(dest_token)
    
    if not source_credentials or not dest_credentials:
        return {"error": "Invalid tokens or sessions expired"}

    try:
        source = build("drive", "v3", credentials=source_credentials)
        dest = build("drive", "v3", credentials=dest_credentials)
        meta = source.files().get(fileId=file_id, fields="name, mimeType").execute()

        file_name = meta["name"]
        mime_type = meta["mimeType"]

        # Define export formats for Google Workspace files
        export_types = {
            "application/vnd.google-apps.document": "application/pdf",
            "application/vnd.google-apps.spreadsheet": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "application/vnd.google-apps.presentation": "application/pdf",
            "application/vnd.google-apps.drawing": "image/png"
        }

        fh = io.BytesIO()
        
        # Check if this is a Google Workspace file that needs to be exported
        if mime_type in export_types:
            export_mime_type = export_types[mime_type]
            logger.info(f"Exporting Google Workspace file '{file_name}' from {mime_type} to {export_mime_type}")
            
            # Export the file in the appropriate format
            request = source.files().export_media(fileId=file_id, mimeType=export_mime_type)
            
            # Update filename with appropriate extension
            file_name += get_file_extension(export_mime_type)
            
            # Update mime type for upload
            upload_mime_type = export_mime_type
        else:
            # Regular file download
            logger.info(f"Downloading regular file '{file_name}' with mime type {mime_type}")
            request = source.files().get_media(fileId=file_id)
            upload_mime_type = mime_type

        # Download/export the file
        downloader = MediaIoBaseDownload(fh, request)
        done = False
        while not done:
            status, done = downloader.next_chunk()
        fh.seek(0)

        # Prepare the upload
        body = {"name": file_name}
        if folder_id:
            body["parents"] = [folder_id]

        # Upload to destination
        media = MediaIoBaseUpload(fh, mimetype=upload_mime_type, resumable=True)
        dest.files().create(body=body, media_body=media).execute()

        if delete_source:
            source.files().delete(fileId=file_id).execute()

        return {"message": f"✅ File '{file_name}' transferred successfully."}
    except Exception as e:
        logger.error(f"Error in transfer_file: {e}")
        return {"error": str(e)}

def get_file_extension(mime_type):
    """Get appropriate file extension for a given MIME type"""
    ext_map = {
        "application/pdf": ".pdf",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation": ".pptx",
        "image/png": ".png",
        "image/jpeg": ".jpg",
        "text/plain": ".txt",
        "text/csv": ".csv"
    }
    return ext_map.get(mime_type, "")

def format_file_size(size_bytes):
    """Format file size in bytes to human readable format"""
    if size_bytes == 0:
        return "0 B"
    
    size_names = ["B", "KB", "MB", "GB", "TB"]
    i = 0
    while size_bytes >= 1024 and i < len(size_names) - 1:
        size_bytes /= 1024.0
        i += 1
    
    return f"{size_bytes:.1f} {size_names[i]}"

def categorize_file_type(mime_type):
    """Categorize file type based on MIME type"""
    if not mime_type:
        return "unknown"
    
    if mime_type.startswith("image/"):
        return "image"
    elif mime_type.startswith("video/"):
        return "video"
    elif mime_type.startswith("audio/"):
        return "audio"
    elif mime_type in ["application/pdf"]:
        return "document"
    elif mime_type.startswith("text/") or mime_type in [
        "application/vnd.google-apps.document",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/msword"
    ]:
        return "document"
    elif mime_type in [
        "application/vnd.google-apps.spreadsheet",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-excel",
        "text/csv"
    ]:
        return "spreadsheet"
    elif mime_type in [
        "application/vnd.google-apps.presentation",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "application/vnd.ms-powerpoint"
    ]:
        return "presentation"
    elif mime_type == "application/vnd.google-apps.folder":
        return "folder"
    elif mime_type.startswith("application/"):
        return "application"
    else:
        return "other"

# ----------------------------
# Face Matching Endpoint
# ----------------------------

@router.post("/match-face")
async def match_face(file: UploadFile = File(...), threshold: float = 0.6):
    temp_path = "temp_uploaded.jpg"
    with open(temp_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Create known_faces.json if it doesn't exist
    if not os.path.exists("known_faces.json"):
        with open("known_faces.json", "w") as f:
            json.dump([], f)
        return {"error": "No known faces to compare with. Please train the system first."}

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
    # Create tagged_faces.json if it doesn't exist
    if not os.path.exists("tagged_faces.json"):
        with open("tagged_faces.json", "w") as f:
            json.dump([], f)
        return {"images": []}

    with open("tagged_faces.json", "r") as f:
        records = json.load(f)

    matches = [r["filename"] for r in records if r["matched_name"].lower() == name.lower()]
    return {"images": matches}

# ----------------------------
# Session Management APIs
# ----------------------------

@router.get("/session/validate")
def validate_session(token: str = Query(...)):
    """Validate if a token is still valid"""
    credentials = redis_client.get_credentials_by_token(token)
    if credentials:
        return {"valid": True, "token": token}
    return {"valid": False, "error": "Invalid or expired token"}

@router.get("/session/active")
def get_active_sessions():
    """Get all active sessions"""
    sessions = redis_client.list_active_sessions()
    return {"sessions": sessions}

@router.delete("/session/logout")
def logout_session(token: str = Query(...)):
    """Logout and delete a session"""
    result = redis_client.delete_credentials(token)
    if result:
        return {"message": "Session logged out successfully"}
    return {"error": "Failed to logout or session not found"}

@router.get("/debug/time")
def debug_time():
    """Debug endpoint to check server time for OAuth troubleshooting"""
    import time
    from datetime import datetime
    
    current_time = time.time()
    formatted_time = datetime.now().isoformat()
    return {
        "server_timestamp": current_time,
        "server_time_iso": formatted_time,
        "server_time_human": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }