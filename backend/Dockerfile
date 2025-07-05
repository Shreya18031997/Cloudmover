FROM python:3.10-slim

# Install system dependencies required by dlib, face_recognition, OpenCV, FastAPI
RUN apt-get update && apt-get install -y \
    build-essential \
    cmake \
    libopenblas-dev \
    liblapack-dev \
    libx11-dev \
    libgtk-3-dev \
    python3-dev \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Upgrade pip
RUN pip install --upgrade pip

# Install all required Python packages
RUN pip install \
    face_recognition \
    opencv-python \
    fastapi \
    uvicorn \
    python-multipart \
    google-auth-oauthlib \
    google-api-python-client \
    requests

# Set working directory inside container
WORKDIR /app

# Copy all files into the container
COPY . /app

# Run FastAPI server on container startup
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
