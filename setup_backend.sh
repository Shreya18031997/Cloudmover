#!/bin/bash

# Initialize backend setup
cd backend

echo "🚀 Setting up CloudMover Backend..."

# Check if Redis is running
echo "📡 Checking Redis connection..."
if redis-cli ping 2>/dev/null | grep -q "PONG"; then
    echo "✅ Redis is running and accessible"
else
    echo "❌ Redis is not running or not accessible"
    echo "Please start Redis server:"
    echo "  macOS (Homebrew): brew services start redis"
    echo "  Ubuntu/Debian: sudo systemctl start redis-server"
    echo "  Docker: docker run -d -p 6379:6379 redis:latest"
    exit 1
fi

# Create known_faces.json if it doesn't exist
if [ ! -f "known_faces.json" ]; then
    echo "[]" > known_faces.json
    echo "✅ Created empty known_faces.json"
fi

# Create tagged_faces.json if it doesn't exist  
if [ ! -f "tagged_faces.json" ]; then
    echo "[]" > tagged_faces.json
    echo "✅ Created empty tagged_faces.json"
fi

# Check if credentials.json exists
if [ ! -f "credentials.json" ]; then
    echo "❌ WARNING: credentials.json not found!"
    echo "Please add your Google OAuth credentials file to enable authentication."
    echo "Download it from Google Cloud Console and rename to 'credentials.json'"
fi

# Install Python dependencies
echo "📦 Installing Python dependencies..."
if [ -d "dlib-venv" ]; then
    source dlib-venv/bin/activate
    pip install -r requirements.txt
else
    echo "Please create and activate virtual environment first:"
    echo "  python -m venv dlib-venv"
    echo "  source dlib-venv/bin/activate"
    echo "  pip install -r requirements.txt"
fi

echo "✅ Backend setup complete!"
echo ""
echo "🚀 To start the backend server:"
echo "  cd backend"
echo "  source dlib-venv/bin/activate"
echo "  uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"
