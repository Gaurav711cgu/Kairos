# Production Multi-Stage Dockerfile for SAHAYAK
# Stage 1: Build React Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Python Backend & Static Asset Server
FROM python:3.11-slim
WORKDIR /app

# Install system dependencies for scientific libraries
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python backend dependencies
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt torch --extra-index-url https://download.pytorch.org/whl/cpu

# Copy backend code and ML models
COPY backend/ /app/backend/

# Copy compiled frontend assets to backend static directory
COPY --from=frontend-builder /app/frontend/dist /app/frontend_dist

# Expose port
EXPOSE 8000
WORKDIR /app/backend

# Run pre-training verification and start Uvicorn server
CMD ["sh", "-c", "python3 ml/train_susceptibility_model.py && uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
