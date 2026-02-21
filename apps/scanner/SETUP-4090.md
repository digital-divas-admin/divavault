# Scanner Setup — Windows 11 + RTX 4090

## What This Is

This sets up the **scanner service** for the Made Of Us platform. The scanner:
- Crawls AI platforms (CivitAI, DeviantArt) for unauthorized face usage
- Runs facial recognition with InsightFace (GPU-accelerated on the 4090)
- Runs the new **Platform Scout** module to discover emerging AI platforms
- Exposes a FastAPI server on port 8000, tunneled to the internet via cloudflared

The Next.js frontend (on Render) calls this scanner via `SCANNER_SERVICE_URL`.

---

## Prerequisites (install these manually first)

1. **Git** — https://git-scm.com/download/win
2. **Python 3.11+** — https://www.python.org/downloads/ (check "Add to PATH")
3. **CUDA Toolkit 12.x** — https://developer.nvidia.com/cuda-downloads
4. **cloudflared** — https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/

---

## Setup Steps

### 1. Clone the repo

```powershell
git clone https://github.com/digital-divas-admin/divavault.git
cd divavault\apps\scanner
```

### 2. Create virtual environment

```powershell
python -m venv .venv
.venv\Scripts\activate
pip install --upgrade pip
pip install -r requirements.txt
```

If InsightFace install fails (common on Windows), try:
```powershell
pip install insightface --no-build-isolation
```

If that also fails, install Visual Studio Build Tools first:
```powershell
winget install Microsoft.VisualStudio.2022.BuildTools --override "--add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
```
Then retry `pip install -r requirements.txt`.

### 3. Install onnxruntime-gpu (replaces CPU version for 4090)

```powershell
pip uninstall onnxruntime -y
pip install onnxruntime-gpu
```

Verify GPU is detected:
```powershell
python -c "import onnxruntime; print(onnxruntime.get_available_providers())"
```
Should include `CUDAExecutionProvider`.

### 4. Install Playwright browsers

```powershell
playwright install chromium
```

### 5. Create .env file

Create a file called `.env` in the `apps\scanner` directory with these exact contents:

```
DATABASE_URL=postgresql+asyncpg://postgres:FLO0m5etRBHaNqBu@db.sazywtcvjpnwzhplovvr.supabase.co:5432/postgres
DATABASE_SSL=true

SUPABASE_URL=https://sazywtcvjpnwzhplovvr.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNhenl3dGN2anBud3pocGxvdnZyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDMzMTA2NiwiZXhwIjoyMDg1OTA3MDY2fQ.J1H8iHy1i9OdaoMvnUQZYnj2VAEZtwM76TZJsUI3IqI

TINEYE_API_KEY=8t4FuoyOuMlwznxlO0kwDMA+Ki,QI85m7SsDw0n4

S3_BUCKET_NAME=madeofus-evidence

HIVE_API_KEY=

DEVIANTART_CLIENT_ID=61345
DEVIANTART_CLIENT_SECRET=1860eeaeb4f8d341b39c518f7e45343d

PROXY_URL=http://scraperapi:e61eee495bcd9fcd9bc7d81e047ca108@proxy-server.scraperapi.com:8001
```

### 6. Run the scanner

```powershell
python -m src.main
```

Should show:
```
starting_scanner_service
scheduler_task_started
Uvicorn running on http://0.0.0.0:8000
```

### 7. Verify locally

In a new terminal:
```powershell
curl http://localhost:8000/health
```

Should return JSON with scanner status and `"status": "ok"`.

### 8. Expose via cloudflared tunnel

In a separate terminal:
```powershell
cloudflared tunnel --url http://localhost:8000
```

This prints a URL like `https://abc-xyz-123.trycloudflare.com`. Copy this URL.

### 9. Update Render environment variable

The Next.js app on Render needs to know the scanner URL. Update these env vars on the Render dashboard for the **madeofus** service:

- `SCANNER_SERVICE_URL` = the cloudflared URL from step 8 (e.g., `https://abc-xyz-123.trycloudflare.com`)

Then redeploy the Render service.

---

## Verify End-to-End

1. Visit `https://<tunnel-url>/health` — should return JSON status
2. Visit `https://<tunnel-url>/docs` — should show FastAPI Swagger docs
3. On the Made Of Us admin dashboard, go to Command Center → Scout tab → click "Run Scout" — should start a scout run

---

## Troubleshooting

### "Module not found" errors
Make sure the venv is activated: `.venv\Scripts\activate`

### onnxruntime GPU not detected
- Verify CUDA Toolkit is installed: `nvcc --version`
- Verify onnxruntime-gpu version matches CUDA version
- Try: `pip install onnxruntime-gpu==1.17.0` (specific version for CUDA 12.x)

### cloudflared URL changes on restart
The free cloudflared quick tunnel generates a new URL each time. You'll need to update `SCANNER_SERVICE_URL` on Render each restart. For a persistent tunnel, create a named tunnel:
```powershell
cloudflared tunnel create scanner
cloudflared tunnel route dns scanner scanner.yourdomain.com
cloudflared tunnel run scanner
```

### Database connection errors
The scanner connects to the hosted Supabase PostgreSQL instance. Make sure the Windows firewall isn't blocking outbound connections on port 5432.

### InsightFace model download
On first run, InsightFace downloads face detection models (~300MB). This is automatic but needs internet access.
