# SAHAYAK — Complete Deployment & Cloud Hosting Guide
### Problem Statement 26001 | Smart India Hackathon

This guide covers 3 hosting strategies for SAHAYAK:
1. **[Method 1: 1-Click Single Docker Container](#method-1-1-click-single-docker-container)** (Recommended for Render, Hugging Face Spaces, AWS, DigitalOcean)
2. **[Method 2: Decoupled Free Cloud Hosting](#method-2-decoupled-free-cloud-hosting)** (Vercel Frontend + Render/Railway Backend)
3. **[Method 3: Instant Live Hackathon Tunneling](#method-3-instant-live-hackathon-tunneling)** (Zero Cloud Cost, Runs from Laptop)

---

## 🐳 METHOD 1: 1-Click Single Docker Container (Easiest & Most Robust)

We provide a multi-stage `Dockerfile` that automatically builds the React frontend with Node.js and serves it alongside the FastAPI backend from a single unified container on port 8000.

### Option A: Deploy on Render (Free / Web Service)
1. Push your code to GitHub.
2. Log into [Render.com](https://render.com) and click **"New +" $\to$ "Web Service"**.
3. Connect your GitHub repository (`Kairos` or `sahayak`).
4. Select **"Docker"** as the Environment.
5. Set:
   - **Port:** `8000`
   - **Plan:** Free
6. Click **"Deploy Web Service"**.
7. Render will automatically build the React frontend, install Python dependencies, train the ML models, and give you a live URL:
   `https://sahayak-disaster-ai.onrender.com`

---

### Option B: Deploy Free on Hugging Face Spaces (GPU/CPU)
1. Go to [huggingface.co/spaces](https://huggingface.co/spaces) and click **"Create new Space"**.
2. Space SDK: Select **Docker** (Blank).
3. Connect or push your GitHub repo.
4. Hugging Face will build the Docker container and give you a high-availability URL.

---

### Option C: Run Local Docker Container
To test the production container locally:
```bash
# Build and launch with docker-compose
docker-compose up --build

# Open in browser
http://localhost:8000
```

---

## 🌐 METHOD 2: Decoupled Free Cloud Hosting (Vercel + Render)

### Step 1: Deploy Backend on Render or Railway
1. In Render, create a **Web Service** pointing to `/backend`.
2. **Runtime:** Python 3
3. **Build Command:**
   ```bash
   pip install -r requirements.txt && python3 ml/train_susceptibility_model.py
   ```
4. **Start Command:**
   ```bash
   uvicorn main:app --host 0.0.0.0 --port $PORT
   ```
5. Copy your backend URL: e.g. `https://sahayak-api.onrender.com`

### Step 2: Deploy Frontend on Vercel
1. Log into [Vercel.com](https://vercel.com) and click **"Add New Project"**.
2. Select your repository and set **Root Directory** to `frontend`.
3. In **Environment Variables**, add:
   ```env
   VITE_API_BASE_URL=https://sahayak-api.onrender.com
   ```
4. Click **Deploy**. Vercel will deploy your React Mission Control globally on Edge CDN.

---

## ⚡ METHOD 3: Instant Live Pitch Tunneling (Zero Cost / Hackathon Venue)

If you are presenting live in front of the SIH jury and want to run directly from your laptop without cloud latency:

### Step 1: Start SAHAYAK Locally
```bash
./start.sh
```
* Backend runs on `http://localhost:8000`
* Frontend runs on `http://localhost:5173`

### Step 2: Expose via Cloudflare Tunnel or Ngrok
```bash
# Using Cloudflare Tunnel (Free, no login needed)
npx cloudflared tunnel --url http://localhost:5173

# OR using Ngrok
ngrok http 5173
```
Cloudflare / Ngrok will give you a public HTTPS URL (e.g., `https://random-words.trycloudflare.com`) that you or the judges can open on any phone or laptop immediately!

---

## 🔍 Verification Endpoints
Once hosted, verify your deployment:
- **Mission Control UI:** `https://<YOUR-URL>/`
- **Interactive Swagger API:** `https://<YOUR-URL>/docs`
- **Health Check:** `https://<YOUR-URL>/api/health`
- **Blockchain Chain:** `https://<YOUR-URL>/api/ledger/chain`
