FROM python:3.11-slim

# System dependencies for OpenCV, Playwright, and InsightFace
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender1 \
    wget \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright browsers (chromium only)
RUN playwright install --with-deps chromium

# Pre-download InsightFace buffalo_sc model
RUN python -c "from insightface.app import FaceAnalysis; app = FaceAnalysis(name='buffalo_sc', providers=['CPUExecutionProvider']); app.prepare(ctx_id=0, det_size=(640, 640))"

# Copy source code
COPY src/ src/
COPY pyproject.toml .

# Create temp directory
RUN mkdir -p /tmp/scanner_images

EXPOSE 8000

CMD ["python", "-m", "src.main"]
