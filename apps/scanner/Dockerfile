FROM python:3.11-slim

# System dependencies for OpenCV, Playwright, and InsightFace
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender1 \
    wget \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright browsers (chromium only)
RUN playwright install --with-deps chromium

# Set InsightFace model directory so it works with non-root user
ENV INSIGHTFACE_ROOT=/app/.insightface

# Pre-download InsightFace buffalo_sc model
RUN python -c "from insightface.app import FaceAnalysis; app = FaceAnalysis(name='buffalo_sc', providers=['CPUExecutionProvider']); app.prepare(ctx_id=0, det_size=(640, 640))"

# Copy source code
COPY src/ src/
COPY pyproject.toml .

# Create temp directory
RUN mkdir -p /tmp/scanner_images

# Create non-root user and set permissions
RUN groupadd -r scanner && useradd -r -g scanner -d /app -s /sbin/nologin scanner \
    && chown -R scanner:scanner /app /tmp/scanner_images

USER scanner

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=120s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["python", "-m", "src.main"]
