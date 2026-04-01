FROM python:3.12-slim

WORKDIR /app

# Install Python deps (psutil has pre-built wheels for arm64, no gcc needed)
COPY core/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source
COPY core/ /app/

# Copy app templates
COPY apps/ /app/apps/

# Copy pre-built frontend (built locally before docker build)
COPY frontend/dist/ /app/frontend/dist/

# Create data dirs
RUN mkdir -p /app/data/apps /app/data/configs

EXPOSE 3000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "3000"]
