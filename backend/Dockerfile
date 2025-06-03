FROM python:3.10-slim

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

RUN pip install --upgrade pip
RUN pip install face_recognition opencv-python flask

WORKDIR /app
COPY . /app

CMD ["bash"]