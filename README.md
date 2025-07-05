# CloudMover - Google Drive File Transfer & Face Recognition

A full-stack application for transferring files between Google Drive accounts with face recognition capabilities. Now featuring Redis-based session management for better scalability and token-based authentication.

## 🚀 Features

- **Google Drive Integration**: Connect multiple Google Drive accounts
- **File Transfer**: Move files between different Drive accounts
- **Face Recognition**: Auto-tag and search images by face
- **Bulk Operations**: Transfer multiple files at once
- **File Organization**: Filter and organize files by type
- **Redis Session Management**: Persistent session storage with token-based auth
- **Responsive UI**: Modern React interface with Tailwind CSS

## 🛠️ Setup Instructions

### Prerequisites

- Node.js (v14 or higher)
- Python 3.11+
- Redis Server (local installation or Docker)
- Google Cloud Project with Drive API enabled

### Redis Setup

Choose one of the following options:

#### Option 1: Docker (Recommended)
```bash
# Start Redis using Docker Compose
docker-compose up -d redis
```

#### Option 2: Local Installation
```bash
# macOS (Homebrew)
brew install redis
brew services start redis

# Ubuntu/Debian
sudo apt-get install redis-server
sudo systemctl start redis-server

# Verify Redis is running
redis-cli ping
```

### Backend Setup

1. **Navigate to backend directory:**
   ```bash
   cd backend
   ```

2. **Create and activate virtual environment:**
   ```bash
   python -m venv dlib-venv
   source dlib-venv/bin/activate  # On Windows: dlib-venv\Scripts\activate
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Google OAuth Setup:**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing one
   - Enable Google Drive API
   - Create OAuth 2.0 credentials
   - Download the JSON file and rename it to `credentials.json`
   - Place it in the `backend/` directory

5. **Initialize backend:**
   ```bash
   chmod +x ../setup_backend.sh
   ../setup_backend.sh
   ```

6. **Start the backend server:**
   ```bash
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

### Frontend Setup

1. **Navigate to frontend directory:**
   ```bash
   cd frontend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm start
   ```

The frontend will be available at `http://localhost:3000`

## 🔧 Major Improvements & Issues Fixed

### 1. **Redis Session Management**
- Replaced in-memory sessions with Redis-based persistent storage
- Token-based authentication for better security and scalability
- Session validation and management endpoints
- Automatic session expiration (24 hours)

### 2. **Token-Based API Authentication**
- Frontend now passes tokens instead of email-based sessions
- All API endpoints updated to use `token` parameter
- Secure credential storage and retrieval
- Session logout functionality

### 3. **Enhanced Frontend State Management**
- URL parameter handling for OAuth callbacks
- Local storage for token persistence
- Real-time connection status indicators
- Improved error handling and user feedback

### 4. **React Router Integration**
- Added proper routing with `react-router-dom`
- Created navigation between components
- Fixed component integration

### 5. **Test File Correction**
- Updated `App.test.js` to test for actual content
- Fixed failing test expectations
- Added missing testing dependencies

### 6. **Backend Robustness**
- Added initialization for missing JSON files
- Improved error handling for face recognition features
- Redis connection validation

## 🔄 Authentication Flow

1. **OAuth Initiation**: User clicks "Connect Source/Destination Drive"
2. **Google Authentication**: Redirected to Google OAuth
3. **Token Generation**: Backend receives credentials and generates token
4. **Redis Storage**: Credentials stored in Redis with token as key
5. **Frontend Callback**: User redirected back with token in URL
6. **Token Persistence**: Frontend stores token in localStorage
7. **API Calls**: All subsequent API calls use the token

## 📡 API Endpoints

### Authentication
- `GET /auth/source` - Initiate source drive OAuth
- `GET /auth/destination` - Initiate destination drive OAuth
- `GET /auth/source/callback` - Source OAuth callback
- `GET /auth/destination/callback` - Destination OAuth callback

### Session Management
- `GET /session/validate?token=<token>` - Validate token
- `GET /session/active` - List active sessions
- `DELETE /session/logout?token=<token>` - Logout session

### File Operations
- `GET /list-files?token=<token>` - List files from drive
- `GET /list-folders?token=<token>` - List folders from drive
- `POST /transfer-file` - Transfer file between accounts

### Face Recognition
- `POST /match-face` - Upload and match face
- `GET /search-images?name=<name>` - Search images by face

## 🎯 Usage

1. **Start Redis and both servers** (Redis, backend on port 8000, frontend on port 3000)
2. **Navigate to the home page** and connect your Google Drive accounts
3. **Tokens are automatically handled** - you'll see connection status indicators
4. **Use the Dashboard** to view and transfer files between accounts
5. **Use Face Matcher** to upload and identify faces in images

## 📁 Project Structure

```
Cloudmover-main/
├── docker-compose.yml       # Redis Docker setup
├── setup_backend.sh         # Backend initialization script
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI application
│   │   ├── auth.py          # Authentication and API routes
│   │   ├── config.py        # Configuration settings
│   │   └── redis_client.py  # Redis session management
│   ├── requirements.txt     # Python dependencies (includes Redis)
│   ├── credentials.json     # Google OAuth credentials (you need to add this)
│   ├── known_faces.json     # Face recognition database
│   └── tagged_faces.json    # Face tagging history
└── frontend/
    ├── src/
    │   ├── App.js           # Main landing page with navigation
    │   ├── Dashboard.js     # File management interface (token-aware)
    │   ├── FaceMatcher.js   # Face recognition interface
    │   └── index.js         # React Router setup
    ├── package.json         # Node.js dependencies
    └── public/              # Static assets
```

## ⚙️ Environment Variables

You can configure Redis connection using environment variables:

```bash
export REDIS_HOST=localhost
export REDIS_PORT=6379
export REDIS_DB=0
export REDIS_PASSWORD=your_password  # Optional
```

## ⚠️ Important Notes

1. **Redis Required**: The application now requires Redis to be running
2. **Google OAuth**: You must configure Google OAuth credentials for the application to work
3. **Token Security**: Tokens are stored in Redis with 24-hour expiration
4. **Local Storage**: Frontend uses localStorage for token persistence
5. **CORS**: The backend is configured for `localhost:3000` - update if deploying

## 🔍 Troubleshooting

- **Redis Connection**: Ensure Redis is running and accessible on port 6379
- **Authentication Issues**: Check that `credentials.json` is properly configured
- **Token Errors**: Tokens expire after 24 hours - reconnect if needed
- **CORS Errors**: Ensure backend allows your frontend URL
- **Face Recognition**: Install `dlib` dependencies if face recognition fails

## 🚢 Development vs Production

This setup is optimized for development. For production deployment:

- Use Redis Cluster for high availability
- Implement proper Redis authentication and SSL
- Use environment variables for all configuration
- Add rate limiting and request validation
- Implement proper error logging and monitoring
- Use HTTPS for all communications
- Consider using Redis Sentinel for failover
