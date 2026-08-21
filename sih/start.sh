#!/usr/bin/env bash
# SAHAYAK Unified System Launcher
# Problem Statement 26001 | Smart India Hackathon

echo "============================================================"
echo "    SAHAYAK: SPATIOTEMPORAL DECISION-SUPPORT SYSTEM (PS 26001)"
echo "============================================================"
echo "Starting Backend (FastAPI on port 8000)..."

cd "$(dirname "$0")/backend"
PYTHONPATH=. ./venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000 &
BACKEND_PID=$!

echo "Starting Frontend (Vite on port 5173)..."
cd "../frontend"
npm run dev -- --host 127.0.0.1 --port 5173 &
FRONTEND_PID=$!

trap "kill $BACKEND_PID $FRONTEND_PID; exit" SIGINT SIGTERM

echo "------------------------------------------------------------"
echo "  Backend API:  http://127.0.0.1:8000/docs"
echo "  Frontend App: http://127.0.0.1:5173"
echo "------------------------------------------------------------"
echo "System online. Press Ctrl+C to terminate all services."

wait
