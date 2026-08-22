FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    WHISPERX_DEVICE=cpu \
    WHISPERX_COMPUTE_TYPE=int8 \
    WHISPERX_MODEL=small

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt ./
RUN pip install --upgrade pip && pip install -r requirements.txt
COPY whisperx_worker.py ./

EXPOSE 8090
CMD ["uvicorn", "whisperx_worker:app", "--host", "0.0.0.0", "--port", "8090"]
