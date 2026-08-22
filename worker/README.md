# VerseVision WhisperX worker

This optional private service performs transcription plus wav2vec2 forced alignment, then maps the aligned words back onto the user-supplied lyric lines. The main Node service calls it only when `VERSEVISION_ALIGNMENT_WORKER_URL` is set.

## Run locally

```text
docker build -t versevision-whisperx ./worker
docker run --rm -p 8090:8090 -e WORKER_TOKEN=replace-me versevision-whisperx
```

Configure the Node service with:

```text
VERSEVISION_ALIGNMENT_WORKER_URL=http://127.0.0.1:8090
VERSEVISION_ALIGNMENT_WORKER_TOKEN=replace-me
```

Use HTTPS and a private network when the worker is remote. Keep the worker token out of Git, logs, screenshots, and client responses.

CPU mode is supported with `WHISPERX_DEVICE=cpu` and `WHISPERX_COMPUTE_TYPE=int8`; a GPU worker can use `cuda` and `float16`. Model downloads are cached inside the worker image/volume and can be large.
