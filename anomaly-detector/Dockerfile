FROM python:3.11-slim

WORKDIR /app

# Install dependencies first (Docker layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY *.py .
COPY scripts/ scripts/

# Non-root user for security
RUN useradd -m -r appuser && chown -R appuser /app /tmp
USER appuser

EXPOSE 8091

CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8091", "--workers", "1"]
