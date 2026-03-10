FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for psycopg2 and bcrypt
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install with pre-built wheels
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy app
COPY . .

# Start app
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]